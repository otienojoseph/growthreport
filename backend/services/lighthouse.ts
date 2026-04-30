// backend/services/lighthouse.ts
// Calls Google PageSpeed Insights API (which runs Lighthouse server-side).
// Docs: https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed

import axios from 'axios';
import type { LighthouseResult, CoreWebVitals } from '../../shared/types';

const PAGESPEED_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

interface RawCategory {
  score: number | null;
}

interface RawAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  numericValue?: number;
  displayValue?: string;
  details?: Record<string, unknown>;
}

interface RawPageSpeedResponse {
  lighthouseResult: {
    categories: {
      performance?: RawCategory;
      accessibility?: RawCategory;
      'best-practices'?: RawCategory;
      seo?: RawCategory;
    };
    audits: Record<string, RawAudit>;
  };
}

function scoreLabel(score: number): string {
  if (score >= 0.9) return 'good';
  if (score >= 0.5) return 'needs improvement';
  return 'poor';
}

function msToSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Fetch Lighthouse data for a URL via PageSpeed Insights API.
 * strategy: 'mobile' | 'desktop'
 */
export async function runLighthouseAudit(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<LighthouseResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set');

  const params = new URLSearchParams({
    url,
    key: apiKey,
    strategy,
    // Only fetch the categories we need to reduce response size
    'category': ['performance', 'accessibility', 'best-practices', 'seo'].join('&category='),
  });

  const response = await axios.get<RawPageSpeedResponse>(
    `${PAGESPEED_BASE}?${params.toString()}`,
    { timeout: 60_000 }
  );

  const lr = response.data.lighthouseResult;
  const audits = lr.audits;
  const cats = lr.categories;

  // ── Core Web Vitals ────────────────────────────────────────────────────────
  const lcpAudit  = audits['largest-contentful-paint'];
  const clsAudit  = audits['cumulative-layout-shift'];
  const fidAudit  = audits['total-blocking-time'];   // TBT is the lab proxy for FID/INP
  const ttfbAudit = audits['server-response-time'];
  const fcpAudit  = audits['first-contentful-paint'];
  const siAudit   = audits['speed-index'];

  const coreWebVitals: CoreWebVitals = {
    lcp: {
      value: lcpAudit?.numericValue ?? 0,
      score: (lcpAudit?.score ?? 0) * 100,
      label: scoreLabel(lcpAudit?.score ?? 0),
    },
    cls: {
      value: clsAudit?.numericValue ?? 0,
      score: (clsAudit?.score ?? 0) * 100,
      label: scoreLabel(clsAudit?.score ?? 0),
    },
    fid: {
      value: fidAudit?.numericValue ?? 0,
      score: (fidAudit?.score ?? 0) * 100,
      label: scoreLabel(fidAudit?.score ?? 0),
    },
    ttfb: {
      value: ttfbAudit?.numericValue ?? 0,
      score: (ttfbAudit?.score ?? 0) * 100,
      label: scoreLabel(ttfbAudit?.score ?? 0),
    },
    fcp: {
      value: fcpAudit?.numericValue ?? 0,
      score: (fcpAudit?.score ?? 0) * 100,
      label: scoreLabel(fcpAudit?.score ?? 0),
    },
    si: {
      value: siAudit?.numericValue ?? 0,
      score: (siAudit?.score ?? 0) * 100,
      label: scoreLabel(siAudit?.score ?? 0),
    },
  };

  // ── Opportunities (things Lighthouse flagged as fixable) ───────────────────
  const OPPORTUNITY_IDS = [
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'uses-optimized-images',
    'uses-webp-images',
    'uses-text-compression',
    'uses-responsive-images',
    'efficient-animated-content',
    'duplicated-javascript',
  ];

  const opportunities = OPPORTUNITY_IDS
    .map(id => audits[id])
    .filter(Boolean)
    .filter(a => a.score !== null && a.score < 0.9)
    .map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      score: (a.score ?? 0) * 100,
      displayValue: a.displayValue ?? '',
      details: a.details,
    }));

  // ── Diagnostics (informational) ────────────────────────────────────────────
  const DIAGNOSTIC_IDS = [
    'dom-size',
    'critical-request-chains',
    'network-requests',
    'network-rtt',
    'total-byte-weight',
    'uses-long-cache-ttl',
    'font-display',
    'third-party-summary',
    'mainthread-work-breakdown',
    'bootup-time',
  ];

  const diagnostics = DIAGNOSTIC_IDS
    .map(id => audits[id])
    .filter(Boolean)
    .map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      score: a.score !== null ? (a.score ?? 0) * 100 : null,
      displayValue: a.displayValue,
    }));

  // ── Passed audits (for "what's working well" section) ─────────────────────
  const passedAudits = Object.values(audits)
    .filter(a => a.score === 1)
    .map(a => a.title);

  return {
    performanceScore:    Math.round((cats.performance?.score ?? 0) * 100),
    accessibilityScore:  Math.round((cats.accessibility?.score ?? 0) * 100),
    bestPracticesScore:  Math.round((cats['best-practices']?.score ?? 0) * 100),
    seoScore:            Math.round((cats.seo?.score ?? 0) * 100),
    coreWebVitals,
    opportunities,
    diagnostics,
    passedAudits,
  };
}

/**
 * Analyse the HTML of a URL for SEO / technical signals not covered by Lighthouse.
 * This is a lightweight fetch + parse pass.
 */
export async function analyseHtmlSignals(url: string): Promise<{
  title: string | null;
  metaDescription: string | null;
  hasH1: boolean;
  h1Count: number;
  hasCanonical: boolean;
  hasViewport: boolean;
  hasOpenGraph: boolean;
  missingAltImages: number;
  internalLinks: number;
  externalLinks: number;
}> {
  // Fetch raw HTML (with a realistic user-agent to avoid bot blocks)
  let html = '';
  try {
    const res = await axios.get(url, {
      timeout: 15_000,
      headers: {
        'User-Agent': 'GrowthAuditBot/1.0 (compatible; site-audit)',
        'Accept': 'text/html',
      },
      maxContentLength: 5_000_000, // 5MB cap
    });
    html = res.data as string;
  } catch {
    // If fetch fails, return safe defaults
    return {
      title: null, metaDescription: null, hasH1: false, h1Count: 0,
      hasCanonical: false, hasViewport: false, hasOpenGraph: false,
      missingAltImages: 0, internalLinks: 0, externalLinks: 0,
    };
  }

  // Basic regex-based parse (avoids heavy DOM library in serverless context)
  const titleMatch        = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const metaDescMatch     = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const h1Matches         = html.match(/<h1[^>]*>/gi) ?? [];
  const canonicalExists   = /<link[^>]+rel=["']canonical["']/i.test(html);
  const viewportExists    = /<meta[^>]+name=["']viewport["']/i.test(html);
  const ogExists          = /<meta[^>]+property=["']og:/i.test(html);

  // Count images missing alt
  const imgMatches = html.match(/<img[^>]*>/gi) ?? [];
  const missingAlt = imgMatches.filter(img => !/alt=["'][^"']+["']/i.test(img)).length;

  // Count links
  const urlObj = new URL(url);
  const allLinks = html.match(/href=["']([^"']+)["']/gi) ?? [];
  let internal = 0, external = 0;
  for (const link of allLinks) {
    const href = link.replace(/href=["']|["']/g, '');
    if (href.startsWith('http')) {
      try {
        const linkUrl = new URL(href);
        linkUrl.hostname === urlObj.hostname ? internal++ : external++;
      } catch { /* ignore malformed */ }
    } else if (href.startsWith('/')) {
      internal++;
    }
  }

  return {
    title: titleMatch?.[1]?.trim() ?? null,
    metaDescription: metaDescMatch?.[1]?.trim() ?? null,
    hasH1: h1Matches.length > 0,
    h1Count: h1Matches.length,
    hasCanonical: canonicalExists,
    hasViewport: viewportExists,
    hasOpenGraph: ogExists,
    missingAltImages: missingAlt,
    internalLinks: internal,
    externalLinks: external,
  };
}

/**
 * Check SSL certificate status.
 */
export async function checkSSL(hostname: string): Promise<{
  valid: boolean;
  daysUntilExpiry: number | null;
}> {
  try {
    const tls = await import('tls');
    const net = await import('net');

    return new Promise((resolve) => {
      const socket = tls.connect(
        { host: hostname, port: 443, servername: hostname, timeout: 10_000 },
        () => {
          const cert = socket.getPeerCertificate();
          socket.destroy();
          if (!cert?.valid_to) {
            resolve({ valid: false, daysUntilExpiry: null });
            return;
          }
          const expiry = new Date(cert.valid_to);
          const days   = Math.floor((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          resolve({ valid: days > 0, daysUntilExpiry: days });
        }
      );
      socket.on('error', () => resolve({ valid: false, daysUntilExpiry: null }));
    });
  } catch {
    return { valid: false, daysUntilExpiry: null };
  }
}
