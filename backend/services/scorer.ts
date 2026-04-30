// backend/services/scorer.ts
// Converts raw Lighthouse + HTML signals into weighted category scores,
// findings, and an overall score out of 100.

import type {
  LighthouseResult,
  CategoryScore,
  Finding,
  WebsiteAuditResult,
  ImpactLevel,
} from '../../shared/types';

// ── Weight table ─────────────────────────────────────────────────────────────

const WEIGHTS = {
  technicalSeo:   0.20,
  performance:    0.15,
  ux:             0.15,
  conversion:     0.20,
  security:       0.10,
  contentSeo:     0.20,
};

// ── Scoring helpers ───────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

/** Map a 0–100 metric score to a 0–10 sub-score */
function scoreToTen(score: number): number {
  return Math.round(clamp(score) / 10);
}

function weightedPoints(score: number, weight: number): number {
  // score is 0–100, weight is e.g. 0.20 → max contribution is 20 pts
  return (score / 100) * (weight * 100);
}

// ── Technical SEO (20%) ───────────────────────────────────────────────────────

function scoreTechnicalSeo(
  lighthouse: LighthouseResult,
  html: HtmlSignals,
  ssl: SSLSignals,
): CategoryScore {
  const subs = [
    {
      name:     'Sitemap',
      score:    html.hasSitemap ? 10 : 0,
      maxScore: 10,
      notes:    html.hasSitemap ? 'Sitemap detected' : 'No sitemap.xml found',
    },
    {
      name:     'Robots.txt',
      score:    html.hasRobotsTxt ? 10 : 3,
      maxScore: 10,
      notes:    html.hasRobotsTxt ? 'robots.txt present' : 'robots.txt missing',
    },
    {
      name:     'Crawlability (Lighthouse SEO)',
      score:    scoreToTen(lighthouse.seoScore),
      maxScore: 10,
      notes:    `Lighthouse SEO score: ${lighthouse.seoScore}/100`,
    },
    {
      name:     'Canonical tag',
      score:    html.hasCanonical ? 10 : 4,
      maxScore: 10,
      notes:    html.hasCanonical ? 'Canonical tag present' : 'No canonical tag',
    },
    {
      name:     'Mobile viewport',
      score:    html.hasViewport ? 10 : 0,
      maxScore: 10,
      notes:    html.hasViewport ? 'Viewport meta tag found' : 'Missing viewport meta tag',
    },
  ];

  const avg = subs.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) / subs.length;
  const earnedPoints = weightedPoints(avg, WEIGHTS.technicalSeo);

  return {
    name:         'Technical SEO',
    score:        Math.round(avg),
    maxPoints:    Math.round(WEIGHTS.technicalSeo * 100),
    earnedPoints: Math.round(earnedPoints),
    weight:       WEIGHTS.technicalSeo,
    breakdown:    subs,
  };
}

// ── Performance (15%) ─────────────────────────────────────────────────────────

function scorePerformance(lighthouse: LighthouseResult): CategoryScore {
  const cwv = lighthouse.coreWebVitals;

  const subs = [
    {
      name:     'Performance score',
      score:    scoreToTen(lighthouse.performanceScore),
      maxScore: 10,
      notes:    `Lighthouse performance: ${lighthouse.performanceScore}/100`,
    },
    {
      name:     'LCP (Largest Contentful Paint)',
      score:    scoreToTen(cwv.lcp.score),
      maxScore: 10,
      notes:    `${(cwv.lcp.value / 1000).toFixed(1)}s — ${cwv.lcp.label}`,
    },
    {
      name:     'CLS (Cumulative Layout Shift)',
      score:    scoreToTen(cwv.cls.score),
      maxScore: 10,
      notes:    `${cwv.cls.value.toFixed(3)} — ${cwv.cls.label}`,
    },
    {
      name:     'TTFB (Server response)',
      score:    scoreToTen(cwv.ttfb.score),
      maxScore: 10,
      notes:    `${Math.round(cwv.ttfb.value)}ms — ${cwv.ttfb.label}`,
    },
    {
      name:     'Speed Index',
      score:    scoreToTen(cwv.si.score),
      maxScore: 10,
      notes:    `${(cwv.si.value / 1000).toFixed(1)}s — ${cwv.si.label}`,
    },
  ];

  const avg = subs.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) / subs.length;
  const earnedPoints = weightedPoints(avg, WEIGHTS.performance);

  return {
    name:         'Performance',
    score:        Math.round(avg),
    maxPoints:    Math.round(WEIGHTS.performance * 100),
    earnedPoints: Math.round(earnedPoints),
    weight:       WEIGHTS.performance,
    breakdown:    subs,
  };
}

// ── UX / UI (15%) ─────────────────────────────────────────────────────────────

function scoreUX(lighthouse: LighthouseResult, html: HtmlSignals): CategoryScore {
  const subs = [
    {
      name:     'Accessibility',
      score:    scoreToTen(lighthouse.accessibilityScore),
      maxScore: 10,
      notes:    `Lighthouse accessibility: ${lighthouse.accessibilityScore}/100`,
    },
    {
      name:     'Image alt text',
      score:    html.missingAltImages === 0 ? 10 : html.missingAltImages < 5 ? 6 : 2,
      maxScore: 10,
      notes:    `${html.missingAltImages} images missing alt text`,
    },
    {
      name:     'Best practices',
      score:    scoreToTen(lighthouse.bestPracticesScore),
      maxScore: 10,
      notes:    `Lighthouse best practices: ${lighthouse.bestPracticesScore}/100`,
    },
    {
      name:     'Open Graph / social preview',
      score:    html.hasOpenGraph ? 10 : 3,
      maxScore: 10,
      notes:    html.hasOpenGraph ? 'OG tags present' : 'No Open Graph tags',
    },
    {
      name:     'Internal linking',
      score:    html.internalLinks > 10 ? 10 : html.internalLinks > 3 ? 6 : 2,
      maxScore: 10,
      notes:    `${html.internalLinks} internal links found`,
    },
  ];

  const avg = subs.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) / subs.length;
  const earnedPoints = weightedPoints(avg, WEIGHTS.ux);

  return {
    name:         'UX / UI',
    score:        Math.round(avg),
    maxPoints:    Math.round(WEIGHTS.ux * 100),
    earnedPoints: Math.round(earnedPoints),
    weight:       WEIGHTS.ux,
    breakdown:    subs,
  };
}

// ── Content / SEO (20%) ───────────────────────────────────────────────────────

function scoreContentSeo(html: HtmlSignals): CategoryScore {
  const subs = [
    {
      name:     'Page title',
      score:    html.title ? (html.title.length >= 30 && html.title.length <= 60 ? 10 : 6) : 0,
      maxScore: 10,
      notes:    html.title
        ? `Title: "${html.title.substring(0, 50)}..." (${html.title.length} chars)`
        : 'No title tag found',
    },
    {
      name:     'Meta description',
      score:    html.metaDescription ? (html.metaDescription.length >= 120 ? 10 : 5) : 0,
      maxScore: 10,
      notes:    html.metaDescription
        ? `${html.metaDescription.length} chars`
        : 'Missing meta description',
    },
    {
      name:     'H1 heading',
      score:    html.h1Count === 1 ? 10 : html.h1Count === 0 ? 0 : 5,
      maxScore: 10,
      notes:    `${html.h1Count} H1 tag(s) found (target: exactly 1)`,
    },
    {
      name:     'Content structure',
      score:    html.internalLinks > 5 ? 8 : 4,
      maxScore: 10,
      notes:    `${html.internalLinks} internal links (suggests content depth)`,
    },
  ];

  const avg = subs.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) / subs.length;
  const earnedPoints = weightedPoints(avg, WEIGHTS.contentSeo);

  return {
    name:         'Content / SEO',
    score:        Math.round(avg),
    maxPoints:    Math.round(WEIGHTS.contentSeo * 100),
    earnedPoints: Math.round(earnedPoints),
    weight:       WEIGHTS.contentSeo,
    breakdown:    subs,
  };
}

// ── Conversion / CRO (20%) ────────────────────────────────────────────────────
// CRO is harder to assess from Lighthouse alone — we use proxy signals.

function scoreConversion(lighthouse: LighthouseResult, html: HtmlSignals): CategoryScore {
  // Proxy: fast pages convert better
  const speedProxy = lighthouse.performanceScore;
  // Proxy: good accessibility = usable forms
  const accessProxy = lighthouse.accessibilityScore;
  // Proxy: external links = outbound CTAs (some is good, too many = distraction)
  const externalProxy = html.externalLinks > 0 && html.externalLinks < 20 ? 70 : 40;

  const subs = [
    {
      name:     'Page speed (conversion proxy)',
      score:    scoreToTen(speedProxy),
      maxScore: 10,
      notes:    `Perf score ${speedProxy} — faster pages have lower bounce rates`,
    },
    {
      name:     'Form/CTA accessibility',
      score:    scoreToTen(accessProxy),
      maxScore: 10,
      notes:    `Accessibility ${accessProxy} — affects button/form usability`,
    },
    {
      name:     'Outbound CTAs',
      score:    scoreToTen(externalProxy),
      maxScore: 10,
      notes:    `${html.externalLinks} external links`,
    },
    {
      name:     'Trust signals (OG / structured data)',
      score:    html.hasOpenGraph ? 8 : 3,
      maxScore: 10,
      notes:    html.hasOpenGraph
        ? 'OG tags present — page previews well on social'
        : 'No OG tags — poor social sharing previews',
    },
  ];

  const avg = subs.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) / subs.length;
  const earnedPoints = weightedPoints(avg, WEIGHTS.conversion);

  return {
    name:         'Conversion (CRO)',
    score:        Math.round(avg),
    maxPoints:    Math.round(WEIGHTS.conversion * 100),
    earnedPoints: Math.round(earnedPoints),
    weight:       WEIGHTS.conversion,
    breakdown:    subs,
  };
}

// ── Security (10%) ────────────────────────────────────────────────────────────

function scoreSecurity(ssl: SSLSignals, lighthouse: LighthouseResult): CategoryScore {
  const subs = [
    {
      name:     'HTTPS / SSL',
      score:    ssl.valid ? 10 : 0,
      maxScore: 10,
      notes:    ssl.valid ? `SSL valid — expires in ${ssl.daysUntilExpiry} days` : 'No valid SSL',
    },
    {
      name:     'SSL expiry buffer',
      score:    ssl.daysUntilExpiry == null ? 0 : ssl.daysUntilExpiry > 60 ? 10 : ssl.daysUntilExpiry > 14 ? 5 : 1,
      maxScore: 10,
      notes:    ssl.daysUntilExpiry ? `${ssl.daysUntilExpiry} days until expiry` : 'Unknown',
    },
    {
      name:     'Best practices (security headers)',
      score:    scoreToTen(lighthouse.bestPracticesScore),
      maxScore: 10,
      notes:    `Lighthouse best practices: ${lighthouse.bestPracticesScore}/100`,
    },
  ];

  const avg = subs.reduce((acc, s) => acc + (s.score / s.maxScore) * 100, 0) / subs.length;
  const earnedPoints = weightedPoints(avg, WEIGHTS.security);

  return {
    name:         'Security',
    score:        Math.round(avg),
    maxPoints:    Math.round(WEIGHTS.security * 100),
    earnedPoints: Math.round(earnedPoints),
    weight:       WEIGHTS.security,
    breakdown:    subs,
  };
}

// ── Findings generator ────────────────────────────────────────────────────────

function generateFindings(
  lighthouse: LighthouseResult,
  html: HtmlSignals,
  ssl: SSLSignals,
): Finding[] {
  const findings: Finding[] = [];
  let idx = 0;
  const id = () => `finding-${++idx}`;

  const cwv = lighthouse.coreWebVitals;

  // LCP - Be strict: anything under 90 score is a finding
  if (cwv.lcp.score < 90) {
    findings.push({
      id: id(),
      category: 'Performance — Core Web Vitals',
      title: `LCP ${(cwv.lcp.value / 1000).toFixed(1)}s — target is under 2.5s`,
      description: `Largest Contentful Paint of ${(cwv.lcp.value / 1000).toFixed(1)}s is ${cwv.lcp.label}. This is the primary signal Google uses to measure load speed.`,
      impact: cwv.lcp.score < 50 ? 'high' : 'medium',
      businessImpact: 'Slow load time → higher bounce rate → Google penalises ranking → fewer visitors → reduced sales',
      metricValue: `${(cwv.lcp.value / 1000).toFixed(1)}s`,
      threshold: '< 2.5s',
    });
  }

  // CLS - Be strict
  if (cwv.cls.score < 90) {
    findings.push({
      id: id(),
      category: 'Performance — Layout Stability',
      title: `CLS ${cwv.cls.value.toFixed(3)} — target is under 0.1`,
      description: 'Layout shifts frustrate users and signal poor quality to Google.',
      impact: cwv.cls.score < 50 ? 'high' : 'medium',
      businessImpact: 'Unexpected shifts → users click wrong elements → abandonment',
      metricValue: cwv.cls.value.toFixed(3),
      threshold: '< 0.1',
    });
  }

  // Missing meta description
  if (!html.metaDescription) {
    findings.push({
      id: id(),
      category: 'SEO — Meta data',
      title: 'Homepage missing meta description',
      description: 'The meta description is what Google shows in search results. Without it, Google generates one automatically — often poorly.',
      impact: 'high',
      businessImpact: 'Lower click-through rates from Google → competitors capture your traffic',
    });
  }

  // Multiple H1s
  if (html.h1Count !== 1) {
    findings.push({
      id: id(),
      category: 'SEO — Headings',
      title: html.h1Count === 0 ? 'No H1 heading found' : `${html.h1Count} H1 headings found (target: 1)`,
      description: 'Each page should have exactly one H1 that clearly states the page topic.',
      impact: 'medium',
      businessImpact: 'Confused heading structure → lower keyword relevance → ranking drop',
      metricValue: `${html.h1Count} H1 tags`,
      threshold: 'Exactly 1',
    });
  }

  // Missing alt text
  if (html.missingAltImages > 0) {
    findings.push({
      id: id(),
      category: 'SEO — Images',
      title: `${html.missingAltImages} images missing alt text`,
      description: 'Alt text helps Google understand images and is required for accessibility compliance.',
      impact: html.missingAltImages > 10 ? 'high' : 'medium',
      businessImpact: 'Missed image SEO + accessibility risk (WCAG compliance)',
      metricValue: `${html.missingAltImages} images`,
    });
  }

  // SSL expiry
  if (ssl.valid && ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry < 60) {
    findings.push({
      id: id(),
      category: 'Security',
      title: `SSL certificate expires in ${ssl.daysUntilExpiry} days`,
      description: 'An expired SSL certificate causes browser security warnings, which immediately drive visitors away.',
      impact: ssl.daysUntilExpiry < 14 ? 'high' : 'low',
      businessImpact: 'Expired SSL → browser shows "Not Secure" → visitors leave immediately → zero revenue',
      metricValue: `${ssl.daysUntilExpiry} days remaining`,
    });
  }

  // No SSL
  if (!ssl.valid) {
    findings.push({
      id: id(),
      category: 'Security',
      title: 'No valid SSL certificate',
      description: 'HTTPS is required by Google and expected by users. Without it, Chrome shows a "Not Secure" warning.',
      impact: 'high',
      businessImpact: '"Not Secure" warning → immediate loss of trust → visitor abandonment',
    });
  }

  // Accessibility - Be strict
  if (lighthouse.accessibilityScore < 100) {
    findings.push({
      id: id(),
      category: 'UX / Accessibility',
      title: `Accessibility score is ${lighthouse.accessibilityScore}/100`,
      description: 'Your site has accessibility violations that make it harder for disabled users to navigate.',
      impact: lighthouse.accessibilityScore < 80 ? 'high' : 'medium',
      businessImpact: 'Accessibility issues → legal compliance risk + poor UX',
      metricValue: `${lighthouse.accessibilityScore}/100`,
    });
  }

  // Best Practices
  if (lighthouse.bestPracticesScore < 100) {
    findings.push({
      id: id(),
      category: 'Technical Best Practices',
      title: `Best Practices score is ${lighthouse.bestPracticesScore}/100`,
      description: 'Your site is missing modern web standards or has security header misconfigurations.',
      impact: 'medium',
      businessImpact: 'Poor best practices → security vulnerabilities + lower trust',
      metricValue: `${lighthouse.bestPracticesScore}/100`,
    });
  }

  // Lighthouse opportunities — add top issues as findings
  for (const opp of lighthouse.opportunities.slice(0, 8)) {
    findings.push({
      id: id(),
      category: 'Performance — Optimisation',
      title: opp.title,
      description: opp.description,
      impact: opp.score < 33 ? 'high' : opp.score < 66 ? 'medium' : 'low',
      businessImpact: `${opp.displayValue ? `${opp.displayValue} — ` : ''}fixing this improves load speed and conversion rate`,
    });
  }

  return findings;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface HtmlSignals {
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
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
}

export interface SSLSignals {
  valid: boolean;
  daysUntilExpiry: number | null;
}

// ── Main scoring function ─────────────────────────────────────────────────────

export function scoreWebsiteAudit(
  url: string,
  lighthouse: LighthouseResult,
  html: HtmlSignals,
  ssl: SSLSignals,
): Omit<WebsiteAuditResult, 'recommendations'> {
  const cats = [
    scoreTechnicalSeo(lighthouse, html, ssl),
    scorePerformance(lighthouse),
    scoreUX(lighthouse, html),
    scoreContentSeo(html),
    scoreConversion(lighthouse, html),
    scoreSecurity(ssl, lighthouse),
  ];

  // Overall = sum of all earnedPoints
  const overallScore = clamp(
    Math.round(cats.reduce((acc, c) => acc + c.earnedPoints, 0))
  );

  const findings = generateFindings(lighthouse, html, ssl);

  return {
    url,
    lighthouse,
    categories: cats,
    findings,
    overallScore,
    hasSSL: ssl.valid,
    sslExpiryDays: ssl.daysUntilExpiry ?? undefined,
    hasSitemap: html.hasSitemap,
    hasRobotsTxt: html.hasRobotsTxt,
    mobileResponsive: html.hasViewport,
    brokenLinks: [],          // populated separately if needed
    missingMetaDescriptions:  html.metaDescription ? [] : [url],
    missingAltText: html.missingAltImages,
    h1Count: html.h1Count,
  };
}
