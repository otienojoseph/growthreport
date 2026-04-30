'use client';
// frontend/app/audit/[id]/page.tsx
// Polls audit status, shows progress, then renders free or full results.

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getAudit, pollAudit } from '../../../lib/api';
import PaywallGate from '../../../components/PaywallGate';
import type { Audit } from '../../../../shared/types';

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressScreen({ progress, status }: { progress: number; status: string }) {
  const steps = [
    'Fetching page data…',
    'Running Lighthouse audit…',
    'Analysing Core Web Vitals…',
    'Checking SEO signals…',
    'Evaluating security…',
    'Generating recommendations…',
    'Building your report…',
  ];
  const stepIdx = Math.floor((progress / 100) * steps.length);
  const label = steps[Math.min(stepIdx, steps.length - 1)];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <div className="text-4xl mb-4">⚡</div>
        <h2 className="text-xl font-semibold text-gray-900">Auditing your site</h2>
        <p className="mt-1 text-sm text-gray-500">{label}</p>
      </div>

      <div className="w-full max-w-xs">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{status}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'text-green-700 bg-green-50 border-green-200'
    : score >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';

  return (
    <div className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${color}`}>
      {score}/100
    </div>
  );
}

function CategoryBar({ name, score }: { name: string; score: number }) {
  const fill = score >= 75 ? 'bg-green-500'
    : score >= 50 ? 'bg-amber-500'
    : 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700">{name}</span>
        <span className="font-medium text-gray-900">{score}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full ${fill} transition-all`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function ImpactBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const styles = {
    high:   'text-red-700 bg-red-50',
    medium: 'text-amber-700 bg-amber-50',
    low:    'text-green-700 bg-green-50',
  };
  const labels = { high: 'High impact', medium: 'Medium', low: 'Low' };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[level]}`}>
      {labels[level]}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const params      = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;

  const [audit, setAudit]     = useState<Audit | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const paymentSuccess  = searchParams.get('payment') === 'success';
  const paymentCancelled = searchParams.get('payment') === 'cancelled';

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const initial = await getAudit(id);
        setAudit(initial);

        if (initial.status === 'complete' || initial.status === 'failed') return;

        // Poll until done
        await pollAudit(
          id,
          (updated) => {
            setAudit(updated);
            setProgress((updated as any).progress ?? 0);
          },
        );

        // Final fetch with full results
        const final = await getAudit(id);
        setAudit(final);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load audit');
      }
    }

    load();
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900">Audit failed</h2>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!audit || audit.status === 'queued' || audit.status === 'processing') {
    return <ProgressScreen progress={progress} status={audit?.status ?? 'queued'} />;
  }

  const free = audit.freeResults as any;
  const full = audit.fullResults as any;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header bar */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-blue-700">GrowthAudit</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500 truncate max-w-xs">{audit.url}</span>
        </div>
        <div className="flex gap-2">
          {!audit.paid && (
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => window.location.href = `/api/checkout?auditId=${id}`}
            >
              Unlock full report — $49
            </button>
          )}
          {audit.paid && (
            <a
              href={`/report/${id}/pdf`}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Export PDF
            </a>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Payment success banner */}
        {paymentSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <span className="text-green-600 text-xl">✓</span>
            <div>
              <p className="font-semibold text-green-800">Full report unlocked!</p>
              <p className="text-sm text-green-700">You now have access to all findings, recommendations and the action plan.</p>
            </div>
          </div>
        )}

        {paymentCancelled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">Payment cancelled. Your free results are still available below.</p>
          </div>
        )}

        {/* Executive summary */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h1 className="text-lg font-semibold text-gray-900 mb-4">Executive summary</h1>

          <div className="flex items-start gap-6">
            {/* Score ring (simple CSS) */}
            <div className="flex-shrink-0 text-center">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#F1EFE8" strokeWidth="8" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke="#3266ad" strokeWidth="8"
                    strokeDasharray={`${(free?.overallScore ?? 0) / 100 * 201} 201`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">{free?.overallScore ?? '–'}</span>
                  <span className="text-xs text-gray-400">/100</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Overall score</p>
            </div>

            <div className="flex-1 min-w-0">
              <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm text-gray-700 mb-4">
                "{free?.diagnosis}"
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Top strengths</p>
                  {(free?.topStrengths ?? []).map((s: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600 mb-1">
                      <span className="text-green-500 mt-0.5">●</span> {s}
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Critical issues</p>
                  {(free?.criticalIssues ?? []).map((s: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600 mb-1">
                      <span className="text-red-500 mt-0.5">●</span> {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Category scores */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            {(free?.categoryScores ?? []).map((c: { name: string; score: number }) => (
              <CategoryBar key={c.name} name={c.name} score={c.score} />
            ))}
          </div>
        </section>

        {/* Top recommendations */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Priority recommendations</h2>
          <div className="space-y-3">
            {(free?.topRecommendations ?? []).map((r: any, i: number) => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-1">{r.problem}</p>
                  <p className="text-sm font-medium text-gray-900">{r.solution}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="rounded-full bg-green-50 text-green-700 text-xs px-2 py-0.5 font-medium">{r.expectedImpact}</span>
                    <span className="rounded-full bg-gray-100 text-gray-600 text-xs px-2 py-0.5">{r.difficulty} · {r.estimatedTime}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Paywall for additional recommendations */}
            <PaywallGate auditId={id} paid={audit.paid} lockedCount={9} label="recommendations">
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 opacity-40 pointer-events-none">
                <p className="text-sm text-gray-500">9 more recommendations locked…</p>
              </div>
            </PaywallGate>
          </div>
        </section>

        {/* Findings — gated */}
        {audit.paid && full ? (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Detailed findings</h2>
            <div className="space-y-3">
              {(full?.website?.findings ?? []).map((f: any) => (
                <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.category}</span>
                    <ImpactBadge level={f.impact} />
                  </div>
                  <p className="text-sm font-semibold text-blue-700 mb-1">{f.title}</p>
                  <p className="text-xs text-gray-500">{f.businessImpact}</p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <PaywallGate auditId={id} paid={audit.paid} lockedCount={6} label="detailed findings">
            <div className="rounded-xl border border-gray-200 bg-white p-4 h-32" />
          </PaywallGate>
        )}

        {/* Services CTA */}
        <section className="rounded-2xl bg-blue-700 p-8 text-center text-white">
          <h2 className="text-xl font-semibold mb-2">Ready to fix what's holding you back?</h2>
          <p className="text-blue-200 text-sm mb-6">
            Our team implements every recommendation — faster, better, with guaranteed results.
          </p>
          <button
            className="rounded-lg bg-white text-blue-700 font-semibold px-6 py-3 hover:bg-blue-50 transition-colors"
            onClick={() => window.open('https://growthaudit.io/call', '_blank')}
          >
            Book a free strategy call
          </button>
        </section>

      </div>
    </div>
  );
}
