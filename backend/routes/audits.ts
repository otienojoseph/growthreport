// backend/routes/audits.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { auditQueue } from '../workers/auditWorker';
import rateLimit from 'express-rate-limit';
import type { CreateAuditRequest, CreateAuditResponse } from '../../shared/types';

const router = Router();
const prisma = new PrismaClient();

const createAuditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many audits created. Please try again in 15 minutes.' },
});

// POST /audits — create and enqueue a new audit
router.post('/', createAuditLimiter, async (req: Request, res: Response) => {
  const { url, social, type }: CreateAuditRequest = req.body;

  if (!type) {
    return res.status(400).json({ error: 'type is required' });
  }
  if ((type === 'website' || type === 'full') && !url) {
    return res.status(400).json({ error: 'url is required for website audits' });
  }

  const auditId = uuid();

  // Create DB record first
  await prisma.audit.create({
    data: {
      id:           auditId,
      type,
      status:       'queued',
      url:          url ?? null,
      socialHandles: social ?? null,
    },
  });

  // Enqueue the job — job name = auditId so the worker can find the DB record
  await auditQueue.add(auditId, { url, social, type }, {
    jobId: auditId,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  });

  const response: CreateAuditResponse = { auditId, status: 'queued' };
  res.status(202).json(response);
});

// GET /audits/:id — poll status and get results
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { full } = req.query; // ?full=true requires paid=true

  const audit = await prisma.audit.findUnique({ where: { id } });
  if (!audit) return res.status(404).json({ error: 'Audit not found' });

  // If requesting full results, verify payment
  if (full === 'true' && !audit.paid) {
    return res.status(402).json({
      error: 'Payment required',
      code: 'PAYMENT_REQUIRED',
      auditId: id,
    });
  }

  // Get live job progress if still in flight
  let progress = 0;
  if (audit.status === 'queued' || audit.status === 'processing') {
    const job = await auditQueue.getJob(id);
    progress = typeof job?.progress === 'number' ? job.progress : 0;
  }

  const response = {
    id:           audit.id,
    type:         audit.type,
    status:       audit.status,
    url:          audit.url,
    social:       audit.socialHandles,
    paid:         audit.paid,
    progress,
    errorMessage: audit.errorMessage ?? null,
    createdAt:    audit.createdAt,
    completedAt:  audit.completedAt ?? null,
    freeResults:  audit.status === 'complete' ? audit.freeResults : null,
    fullResults:  audit.paid && full === 'true' ? audit.fullResults : null,
  };

  // Auto-repair: If paid but full results are missing, re-enqueue
  if (audit.paid && !audit.fullResults && audit.status === 'complete') {
    console.log(`[api] Audit ${id} is paid but missing fullResults. Re-enqueuing for repair...`);
    await prisma.audit.update({ where: { id }, data: { status: 'queued' } });
    await auditQueue.add(id, { url: audit.url, type: audit.type }, { jobId: id });
    response.status = 'queued'; // Tell frontend it's processing again
  }

  if (response.fullResults) {
    const fr = response.fullResults as any;
    console.log(`[api] Audit ${id} full results found. Recos: ${fr.website?.recommendations?.length}, ActionPlan: ${fr.actionPlan?.length}`);
  }

  res.json(response);
});

// GET /audits/:id/progress — SSE stream for real-time progress
router.get('/:id/progress', async (req: Request, res: Response) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const interval = setInterval(async () => {
    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { status: true, completedAt: true, errorMessage: true },
    });

    if (!audit) {
      clearInterval(interval);
      res.end();
      return;
    }

    const job = await auditQueue.getJob(id);
    const progress = typeof job?.progress === 'number' ? job.progress : 0;

    send({ status: audit.status, progress });

    if (audit.status === 'complete' || audit.status === 'failed') {
      clearInterval(interval);
      res.end();
    }
  }, 1500);

  req.on('close', () => clearInterval(interval));
});

export default router;
