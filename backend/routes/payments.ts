// backend/routes/payments.ts
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import type { CheckoutSessionRequest, CheckoutSessionResponse } from '../../shared/types';

const router = Router();
const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

// ── POST /payments/checkout ───────────────────────────────────────────────────
// Creates a Stripe Checkout Session for the full audit report.

router.post('/checkout', async (req: Request, res: Response) => {
  const { auditId }: CheckoutSessionRequest = req.body;

  if (!auditId) {
    return res.status(400).json({ error: 'auditId is required' });
  }

  const audit = await prisma.audit.findUnique({ where: { id: auditId } });
  if (!audit) return res.status(404).json({ error: 'Audit not found' });
  if (audit.paid) return res.status(400).json({ error: 'Audit already unlocked' });
  if (audit.status !== 'complete') {
    return res.status(400).json({ error: 'Audit must be complete before purchasing' });
  }

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID_FULL_REPORT!,
        quantity: 1,
      },
    ],
    // Embed auditId in metadata so the webhook can find the right record
    metadata: {
      auditId,
      url: audit.url ?? '',
    },
    // Show audit URL in the checkout description
    custom_text: {
      submit: {
        message: `Unlock your full audit report for ${audit.url ?? 'your site'} — includes all findings, 12+ recommendations, and the complete 3-phase action plan.`,
      },
    },
    success_url: `${frontendUrl}/audit/${auditId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${frontendUrl}/audit/${auditId}?payment=cancelled`,
    // Pre-fill email if we have a user
    ...(audit.userId ? {} : {}),
  });

  // Store the session ID so we can look it up in the webhook
  await prisma.audit.update({
    where: { id: auditId },
    data: { stripeSessionId: session.id },
  });

  const response: CheckoutSessionResponse = { url: session.url! };
  res.json(response);
});

// ── GET /payments/verify-session ─────────────────────────────────────────────
// Synchronous check for users returning to the success page.
// This handles cases where the webhook is delayed or fails to deliver.

router.get('/verify-session', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  console.log(`[api] Verifying session: ${sessionId}`);

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const auditId = session.metadata?.auditId;

    if (!auditId) {
      console.warn(`[api] Session ${sessionId} missing auditId metadata`);
      return res.status(400).json({ error: 'Session missing auditId metadata' });
    }

    if (session.payment_status === 'paid') {
      console.log(`[api] Stripe confirms session ${sessionId} is paid. Updating DB...`);
      
      const audit = await prisma.audit.update({
        where: { id: auditId },
        data: {
          paid: true,
          stripeSessionId: session.id,
        },
      });

      // Double check the record was actually updated
      const verify = await prisma.audit.findUnique({ where: { id: auditId } });
      console.log(`[api] DB Verification — Audit ${auditId} paid status is: ${verify?.paid}`);
      
      return res.json({ success: true, paid: verify?.paid ?? false, audit: verify });
    }

    console.log(`[api] Session ${sessionId} not paid yet (status: ${session.payment_status})`);
    res.json({ success: true, paid: false });
  } catch (err: any) {
    console.error('[api] Verify session failed:', err.message);
    res.status(500).json({ error: 'Failed to verify payment session' });
  }
});

// ── POST /webhooks/stripe ─────────────────────────────────────────────────────
// Stripe sends events here. We listen for checkout.session.completed.
// IMPORTANT: This route must receive the RAW request body (not JSON-parsed).
// Make sure to register it BEFORE express.json() middleware in app.ts.

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post(
  '/stripe',
  // Raw body is needed for Stripe signature verification
  // Use express.raw({ type: 'application/json' }) for this route
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

    let event: Stripe.Event;

    try {
      // req.body must be the raw Buffer here (not parsed JSON)
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig as string,
        webhookSecret,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[webhook] Signature verification failed:', message);
      return res.status(400).json({ error: `Webhook Error: ${message}` });
    }

    console.log(`[webhook] Received event ${event.id}: ${event.type}`);

    // Handle events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const auditId = session.metadata?.auditId;

        if (!auditId) {
          console.error('[webhook] checkout.session.completed missing auditId in metadata');
          break;
        }

        if (session.payment_status === 'paid') {
          await prisma.audit.update({
            where: { id: auditId },
            data: {
              paid:           true,
              stripeSessionId: session.id,
            },
          });
          console.log(`[webhook] Audit ${auditId} unlocked — payment confirmed`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.warn(`[webhook] Payment failed for PI: ${pi.id}`);
        // Optionally notify the user via email
        break;
      }

      default:
        // Unhandled events are fine — just acknowledge
        break;
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true });
  }
);

export default router;
