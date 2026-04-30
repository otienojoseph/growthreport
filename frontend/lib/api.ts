// frontend/lib/api.ts
// Type-safe API client for the GrowthAudit backend.

import type {
  Audit,
  CreateAuditRequest,
  CreateAuditResponse,
  CheckoutSessionResponse,
} from '../../shared/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error ?? `HTTP ${res.status}`);
    (error as any).status = res.status;
    (error as any).code   = body.code;
    throw error;
  }

  return res.json() as Promise<T>;
}

// ── Audit API ─────────────────────────────────────────────────────────────────

export async function createAudit(data: CreateAuditRequest): Promise<CreateAuditResponse> {
  return request<CreateAuditResponse>('/audits', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getAudit(id: string, full = false): Promise<Audit> {
  return request<Audit>(`/audits/${id}${full ? '?full=true' : ''}`);
}

/**
 * Poll audit status until complete or failed.
 * Calls onProgress with each update.
 */
export async function pollAudit(
  id: string,
  onProgress: (audit: Audit) => void,
  intervalMs = 2000,
): Promise<Audit> {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const audit = await getAudit(id);
        onProgress(audit);

        if (audit.status === 'complete') {
          clearInterval(timer);
          resolve(audit);
        } else if (audit.status === 'failed') {
          clearInterval(timer);
          reject(new Error(audit.errorMessage ?? 'Audit failed'));
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}

// ── Payment API ───────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  auditId: string,
): Promise<CheckoutSessionResponse> {
  return request<CheckoutSessionResponse>('/payments/checkout', {
    method: 'POST',
    body: JSON.stringify({ auditId }),
  });
}

/**
 * Redirect the user to Stripe Checkout.
 * Returns after redirect (i.e. never returns normally on success).
 */
export async function redirectToCheckout(auditId: string): Promise<void> {
  const { url } = await createCheckoutSession(auditId);
  window.location.href = url;
}

export async function verifyPaymentSession(sessionId: string): Promise<{ paid: boolean }> {
  return request<{ paid: boolean }>(`/payments/verify-session?sessionId=${sessionId}`);
}
