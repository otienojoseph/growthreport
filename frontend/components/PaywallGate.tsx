"use client";
// frontend/components/PaywallGate.tsx
// Wraps premium content with a blur + unlock CTA.
// Shows content normally if audit.paid === true.

import { useState } from "react";
import { redirectToCheckout } from "../lib/api";

interface PaywallGateProps {
  auditId: string;
  paid: boolean;
  children: React.ReactNode;
  /** Number of additional items locked (shown in the CTA) */
  lockedCount?: number;
  label?: string;
  price?: number;
}

export default function PaywallGate({
  auditId,
  paid,
  children,
  lockedCount,
  label = "findings",
  price = 49,
}: PaywallGateProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (paid) return <>{children}</>;

  async function handleUnlock() {
    try {
      setLoading(true);
      setError(null);
      await redirectToCheckout(auditId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      {/* Blurred preview of children */}
      <div
        aria-hidden
        className="pointer-events-none select-none"
        style={{ filter: "blur(4px)", opacity: 0.5 }}
      >
        {children}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-lg max-w-sm w-full mx-4">
          <div className="text-2xl mb-2">🔒</div>
          <h3 className="font-semibold text-gray-900 mb-1">
            {lockedCount
              ? `${lockedCount} more ${label} locked`
              : `Full report locked`}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Unlock the complete audit — all findings, 12 recommendations, and
            the full action plan.
          </p>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <button
            onClick={handleUnlock}
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {loading
              ? "Redirecting to checkout…"
              : `Unlock full report — $${price}`}
          </button>

          <p className="mt-2 text-xs text-gray-400">
            One-time payment · Instant access · PDF included
          </p>
        </div>
      </div>
    </div>
  );
}
