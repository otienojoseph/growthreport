// backend/workers/auditWorker.ts
// BullMQ worker that processes audit jobs off the queue.
// Orchestrates: Lighthouse → HTML signals → SSL check → scoring → recommendations → DB save

import { Worker, Queue, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { runLighthouseAudit, analyseHtmlSignals, checkSSL } from '../services/lighthouse';
import { scoreWebsiteAudit, HtmlSignals, SSLSignals } from '../services/scorer';
import {
  generateWebsiteRecommendations,
  generateActionPlan,
  generateDiagnosis,
  generateStrengths,
  generateCriticalIssues,
} from '../services/recommendations';
import type { CreateAuditRequest, AuditResult, WebsiteAuditResult } from '../../shared/types';

const prisma = new PrismaClient();

// ── Queue setup ───────────────────────────────────────────────────────────────

const REDIS_CONFIG = {
  connection: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
};

export const auditQueue = new Queue<CreateAuditRequest>('audits', REDIS_CONFIG);

// ── Helper: normalise URL ─────────────────────────────────────────────────────

function normaliseUrl(raw: string): string {
  let url = raw.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/$/, '');
}

// ── Helper: check robots.txt and sitemap ─────────────────────────────────────

async function checkSitemapAndRobots(baseUrl: string): Promise<{
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
}> {
  const check = async (path: string): Promise<boolean> => {
    try {
      const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(8000) });
      return res.ok;
    } catch {
      return false;
    }
  };

  const [hasSitemap, hasRobotsTxt] = await Promise.all([
    check('/sitemap.xml'),
    check('/robots.txt'),
  ]);

  return { hasSitemap, hasRobotsTxt };
}

// ── Main audit processor ──────────────────────────────────────────────────────

async function processWebsiteAudit(
  url: string,
  job: Job,
): Promise<WebsiteAuditResult> {
  await job.updateProgress(5);
  console.log(`[worker] Starting website audit for: ${url}`);

  const normUrl = normaliseUrl(url);
  const hostname = new URL(normUrl).hostname;

  // Run all data-gathering tasks in parallel where possible
  await job.updateProgress(10);

  const [
    lighthouse,
    htmlSignals,
    ssl,
    sitemapRobots,
  ] = await Promise.all([
    runLighthouseAudit(normUrl, 'mobile'),
    analyseHtmlSignals(normUrl),
    checkSSL(hostname),
    checkSitemapAndRobots(normUrl),
  ]);

  await job.updateProgress(60);
  console.log(`[worker] Data gathered — LH performance: ${lighthouse.performanceScore}`);

  // Merge HTML signals with sitemap/robots data
  const fullHtmlSignals: HtmlSignals = {
    ...htmlSignals,
    hasSitemap: sitemapRobots.hasSitemap,
    hasRobotsTxt: sitemapRobots.hasRobotsTxt,
  };

  // Score
  const scored = scoreWebsiteAudit(normUrl, lighthouse, fullHtmlSignals, ssl);
  await job.updateProgress(75);

  // Generate recommendations
  const recommendations = generateWebsiteRecommendations(scored);
  await job.updateProgress(85);

  return {
    ...scored,
    recommendations,
  };
}

// ── Worker ────────────────────────────────────────────────────────────────────

const worker = new Worker<CreateAuditRequest>(
  'audits',
  async (job: Job<CreateAuditRequest>) => {
    const { url, social, type } = job.data;
    const auditId = job.name; // we set job.name = auditId when enqueueing

    console.log(`[worker] Processing job ${job.id} — audit ${auditId} — type: ${type}`);

    // Mark as processing
    await prisma.audit.update({
      where: { id: auditId },
      data: { status: 'processing', jobId: String(job.id) },
    });

    try {
      let websiteResult: WebsiteAuditResult | undefined;

      // ── Website audit ────────────────────────────────────────────────────
      if ((type === 'website' || type === 'full') && url) {
        websiteResult = await processWebsiteAudit(url, job);
      }

      // ── Social audit (stub — real implementation needs official APIs) ────
      // Social platforms don't offer public APIs for page metrics without auth.
      // Real-world approach: use RapidAPI's social-media-data providers,
      // or require users to connect their accounts via OAuth.
      // Here we generate realistic mock scores to demonstrate the structure.
      let socialResult = undefined;
      if ((type === 'social' || type === 'full') && social) {
        // In production: await runSocialAudit(social)
        // For now, return structured placeholder indicating auth needed
        socialResult = {
          platforms: Object.entries(social)
            .filter(([, handle]) => handle)
            .map(([platform, handle]) => ({
              platform,
              handle,
              found: false,
              requiresAuth: true,
              message: `Connect your ${platform} account to enable real metrics`,
            })),
        };
      }

      await job.updateProgress(90);

      // ── Compile full result ───────────────────────────────────────────────
      const categoryScores = websiteResult?.categories.map(c => ({
        name:  c.name,
        score: c.score,
      })) ?? [];

      const overallScore    = websiteResult?.overallScore ?? 50;
      const allFindings     = websiteResult?.findings ?? [];
      const allRecos        = websiteResult?.recommendations ?? [];
      const actionPlan      = generateActionPlan(allRecos);
      const diagnosis       = generateDiagnosis(overallScore, categoryScores);
      const topStrengths    = websiteResult ? generateStrengths(websiteResult) : [];
      const criticalIssues  = generateCriticalIssues(allFindings);

      const fullResults: AuditResult = {
        overallScore,
        diagnosis,
        topStrengths,
        criticalIssues,
        website:    websiteResult,
        social:     socialResult as any,
        actionPlan,
      };

      // ── Free tier subset (no paywall data) ───────────────────────────────
      const freeResults = {
        overallScore,
        diagnosis,
        topStrengths,
        criticalIssues,
        categoryScores,
        // Only top 3 recos free; rest require payment
        topRecommendations: allRecos.filter(r => !r.isPremium).slice(0, 3),
      };

      // ── Save to DB ────────────────────────────────────────────────────────
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status:       'complete',
          completedAt:  new Date(),
          freeResults:  freeResults as any,
          fullResults:  fullResults as any,
        },
      });

      await job.updateProgress(100);
      console.log(`[worker] Audit ${auditId} complete — score: ${overallScore}`);

      return { auditId, overallScore };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[worker] Audit ${auditId} failed:`, message);

      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status:       'failed',
          errorMessage: message,
        },
      });

      throw err; // re-throw so BullMQ marks the job as failed
    }
  },
  {
    ...REDIS_CONFIG,
    concurrency: 3,             // run up to 3 audits in parallel
    limiter: {
      max: 10,                  // max 10 jobs per duration window
      duration: 60_000,         // per minute (respects PageSpeed API quota)
    },
  }
);

worker.on('completed', (job, result) => {
  console.log(`[worker] Job ${job.id} completed — score ${result.overallScore}`);
});

worker.on('failed', (job, err) => {
  console.error(`[worker] Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err);
});

console.log('[worker] Audit worker started');
export default worker;
