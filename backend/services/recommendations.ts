// backend/services/recommendations.ts
// Generates prioritised, actionable recommendations from scored audit data.
// Each recommendation includes: problem, solution, expected impact, difficulty, time estimate.

import type {
  WebsiteAuditResult,
  Recommendation,
  ActionItem,
  AuditResult,
  Finding,
} from '../../shared/types';

let _id = 0;
const nextId = () => `reco-${++_id}`;

// ── Individual recommendation templates ──────────────────────────────────────

function makeReco(
  partial: Omit<Recommendation, 'id' | 'priority'>,
  priority: number,
): Recommendation {
  return { id: nextId(), priority, ...partial };
}

// ── Website recommendations ───────────────────────────────────────────────────

export function generateWebsiteRecommendations(
  result: Omit<WebsiteAuditResult, 'recommendations'>,
): Recommendation[] {
  const recos: Recommendation[] = [];
  const cwv = result.lighthouse.coreWebVitals;
  let p = 1; // priority counter

  // High-impact performance issues
  if (cwv.lcp.value > 2500) {
    recos.push(makeReco({
      category: 'Performance',
      problem:  `LCP of ${(cwv.lcp.value / 1000).toFixed(1)}s is hurting Google rankings and bounce rate`,
      solution: 'Compress and convert hero images to WebP format, defer non-critical JavaScript, and enable browser caching with long cache TTL headers',
      expectedImpact: '+20–35% organic traffic within 60 days',
      difficulty: 'medium',
      estimatedTime: '4–8 hrs',
      isPremium: false,
    }, p++));
  }

  if (cwv.cls.value > 0.1) {
    recos.push(makeReco({
      category: 'Performance',
      problem:  `CLS of ${cwv.cls.value.toFixed(3)} — layout shifts frustrate users`,
      solution: 'Add explicit width/height attributes to all images, avoid inserting content above existing content, and use CSS transform for animations',
      expectedImpact: '+5–10% conversion rate (better UX)',
      difficulty: 'medium',
      estimatedTime: '2–4 hrs',
      isPremium: false,
    }, p++));
  }

  // SEO: missing meta description
  if (result.missingMetaDescriptions.length > 0) {
    recos.push(makeReco({
      category: 'SEO',
      problem:  `${result.missingMetaDescriptions.length} page(s) missing meta descriptions — reducing click-through from Google`,
      solution: 'Write unique, keyword-rich meta descriptions of 150–160 characters for every key page, focusing on the value proposition and a clear CTA',
      expectedImpact: '+8–15% organic click-through rate',
      difficulty: 'easy',
      estimatedTime: '1–3 hrs',
      isPremium: false,
    }, p++));
  }

  // Images missing alt text
  if (result.missingAltText > 0) {
    recos.push(makeReco({
      category: 'SEO / Accessibility',
      problem:  `${result.missingAltText} images missing alt text — missed SEO and accessibility risk`,
      solution: 'Add descriptive alt text to every image. For product images use the product name + key attribute. For decorative images use alt=""',
      expectedImpact: '+3–8% image search traffic, WCAG compliance',
      difficulty: 'easy',
      estimatedTime: '1–2 hrs',
      isPremium: false,
    }, p++));
  }

  // SSL expiry
  if (result.sslExpiryDays !== undefined && result.sslExpiryDays < 60) {
    recos.push(makeReco({
      category: 'Security',
      problem:  `SSL certificate expires in ${result.sslExpiryDays} days`,
      solution: 'Enable auto-renewal in your hosting control panel (cPanel, Cloudflare, or your DNS provider). Takes under 5 minutes to configure',
      expectedImpact: 'Prevents "Not Secure" warning and ranking drop',
      difficulty: 'easy',
      estimatedTime: '< 30 mins',
      isPremium: false,
    }, p++));
  }

  // Lighthouse opportunities → premium recommendations
  for (const opp of result.lighthouse.opportunities) {
    recos.push(makeReco({
      category: 'Performance',
      problem:  opp.title,
      solution: `${opp.description}${opp.displayValue ? ` (potential saving: ${opp.displayValue})` : ''}`,
      expectedImpact: 'Improved load speed and Core Web Vitals score',
      difficulty: 'medium',
      estimatedTime: '2–6 hrs',
      isPremium: p > 5, // first 5 are free, rest gated
    }, p++));
  }

  // CRO — these are always premium (too specific to generate without human review)
  recos.push(makeReco({
    category: 'Conversion (CRO)',
    problem:  'No clear call-to-action analysis — most SMB websites lose 30–50% of potential leads due to unclear next steps',
    solution: 'Add a high-contrast primary CTA button above the fold on every key page. Use action-oriented copy: "Book a free call", "Get a quote", "Start your trial"',
    expectedImpact: '+15–30% conversion rate from organic visitors',
    difficulty: 'easy',
    estimatedTime: '1–2 hrs',
    isPremium: true,
  }, p++));

  recos.push(makeReco({
    category: 'Conversion (CRO)',
    problem:  'No email capture strategy detected — most first-time visitors never return',
    solution: 'Add an email opt-in popup or inline form with a compelling lead magnet (free guide, checklist, or discount). Use a tool like Mailchimp, ConvertKit, or Klaviyo',
    expectedImpact: '+25–40% lead generation from existing traffic',
    difficulty: 'medium',
    estimatedTime: '4–8 hrs',
    isPremium: true,
  }, p++));

  recos.push(makeReco({
    category: 'SEO',
    problem:  'Low internal linking structure reduces ability to pass page authority through the site',
    solution: 'Audit your top 10 pages and add 3–5 contextual internal links per page to related content. Prioritise links from your homepage and blog posts',
    expectedImpact: '+10–20% organic ranking improvement for linked pages',
    difficulty: 'easy',
    estimatedTime: '2–3 hrs',
    isPremium: true,
  }, p++));

  return recos.sort((a, b) => a.priority - b.priority);
}

// ── Action plan generator ─────────────────────────────────────────────────────

export function generateActionPlan(recos: Recommendation[]): ActionItem[] {
  const plan: ActionItem[] = [];

  const easyRecos  = recos.filter(r => r.difficulty === 'easy'     && !r.isPremium);
  const medRecos   = recos.filter(r => r.difficulty === 'medium'   && !r.isPremium);
  const hardRecos  = recos.filter(r => r.difficulty === 'advanced' || r.isPremium);

  // Immediate (0–7 days): quick wins from easy tasks
  for (const r of easyRecos.slice(0, 5)) {
    plan.push({
      task: r.solution.split('.')[0],  // first sentence only for conciseness
      phase: 'immediate',
      category: r.category,
      estimatedTime: r.estimatedTime,
      isPremium: false,
    });
  }

  // Short-term (1–4 weeks): medium tasks
  for (const r of medRecos.slice(0, 5)) {
    plan.push({
      task: r.solution.split('.')[0],
      phase: 'short_term',
      category: r.category,
      estimatedTime: r.estimatedTime,
      isPremium: false,
    });
  }

  // Long-term (1–3 months): strategic + premium
  const longTermDefaults = [
    { task: 'Launch a content marketing blog targeting low-competition keywords in your niche', category: 'SEO' },
    { task: 'Set up email nurture automation (welcome sequence → value emails → offer)', category: 'Conversion' },
    { task: 'Run A/B tests on your top landing page headline and primary CTA', category: 'CRO' },
    { task: 'Build a Google Business Profile and citation strategy for local SEO', category: 'SEO' },
    { task: 'Create a case study or social proof page featuring customer results', category: 'Conversion' },
  ];

  for (const item of longTermDefaults) {
    plan.push({
      task: item.task,
      phase: 'long_term',
      category: item.category,
      estimatedTime: '2–6 weeks',
      isPremium: true,
    });
  }

  return plan;
}

// ── Overall diagnosis generator ───────────────────────────────────────────────

export function generateDiagnosis(score: number, categories: { name: string; score: number }[]): string {
  const sorted = [...categories].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  if (score >= 80) {
    return `Strong digital presence with good fundamentals. Focus on fine-tuning ${weakest.name.toLowerCase()} to reach top-tier performance.`;
  }
  if (score >= 60) {
    return `Solid ${strongest.name.toLowerCase()} foundation, but ${weakest.name.toLowerCase()} gaps are limiting your growth potential and online revenue.`;
  }
  if (score >= 40) {
    return `Significant improvement opportunities across ${weakest.name.toLowerCase()} and ${sorted[1]?.name.toLowerCase() ?? 'conversion'}. Fixing these would meaningfully grow revenue.`;
  }
  return `Multiple critical issues — especially in ${weakest.name.toLowerCase()} — are actively costing you traffic, leads, and sales. Immediate action needed.`;
}

export function generateStrengths(
  result: Omit<WebsiteAuditResult, 'recommendations'>,
): string[] {
  const strengths: string[] = [];
  const cwv = result.lighthouse.coreWebVitals;

  if (result.hasSSL) strengths.push('HTTPS security properly configured');
  if (result.mobileResponsive) strengths.push('Mobile-responsive design detected');
  if (cwv.ttfb.value < 600) strengths.push(`Fast server response time (TTFB: ${Math.round(cwv.ttfb.value)}ms)`);
  if (result.lighthouse.performanceScore >= 75) strengths.push(`Strong performance score (${result.lighthouse.performanceScore}/100)`);
  if (result.lighthouse.seoScore >= 80) strengths.push(`Good Lighthouse SEO score (${result.lighthouse.seoScore}/100)`);
  if (result.hasSitemap) strengths.push('Sitemap.xml present and crawlable');
  if (result.lighthouse.accessibilityScore >= 80) strengths.push(`Good accessibility score (${result.lighthouse.accessibilityScore}/100)`);

  return strengths.slice(0, 3);
}

export function generateCriticalIssues(findings: Finding[]): string[] {
  return findings
    .filter(f => f.impact === 'high')
    .slice(0, 3)
    .map(f => f.title);
}
