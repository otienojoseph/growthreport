// shared/types.ts — shared across frontend and backend

export type AuditType = 'website' | 'social' | 'full';
export type AuditStatus = 'queued' | 'processing' | 'complete' | 'failed';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type Difficulty = 'easy' | 'medium' | 'advanced';

// ── Lighthouse / PageSpeed data ──────────────────────────────────────────────

export interface CoreWebVitals {
  lcp: { value: number; score: number; label: string };   // Largest Contentful Paint (ms)
  cls: { value: number; score: number; label: string };   // Cumulative Layout Shift
  fid: { value: number; score: number; label: string };   // First Input Delay (ms)
  ttfb: { value: number; score: number; label: string };  // Time to First Byte (ms)
  fcp: { value: number; score: number; label: string };   // First Contentful Paint (ms)
  si: { value: number; score: number; label: string };    // Speed Index
}

export interface LighthouseResult {
  performanceScore: number;       // 0–100
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  coreWebVitals: CoreWebVitals;
  opportunities: LighthouseOpportunity[];
  diagnostics: LighthouseDiagnostic[];
  passedAudits: string[];
}

export interface LighthouseOpportunity {
  id: string;
  title: string;
  description: string;
  score: number;
  displayValue: string;
  details?: Record<string, unknown>;
}

export interface LighthouseDiagnostic {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
}

// ── Category scores ──────────────────────────────────────────────────────────

export interface CategoryScore {
  name: string;
  score: number;      // 0–100 (normalised)
  maxPoints: number;  // weighted max (e.g. 20 for a 20% category)
  earnedPoints: number;
  weight: number;     // decimal, e.g. 0.20
  breakdown: SubScore[];
}

export interface SubScore {
  name: string;
  score: number;  // 0–10
  maxScore: number;
  notes: string;
}

// ── Findings ─────────────────────────────────────────────────────────────────

export interface Finding {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: ImpactLevel;
  businessImpact: string;   // "Slow LCP → higher bounce → fewer sales"
  affectedUrl?: string;
  metricValue?: string;     // e.g. "5.2s", "7 pages"
  threshold?: string;       // e.g. "< 2.5s"
}

// ── Recommendations ──────────────────────────────────────────────────────────

export interface Recommendation {
  id: string;
  priority: number;         // 1 = highest
  category: string;
  problem: string;
  solution: string;
  expectedImpact: string;   // "+15–25% conversion potential"
  difficulty: Difficulty;
  estimatedTime: string;    // "1–2 hrs"
  isPremium: boolean;       // locked behind paywall if true
}

// ── Action plan ──────────────────────────────────────────────────────────────

export interface ActionItem {
  task: string;
  phase: 'immediate' | 'short_term' | 'long_term';
  category: string;
  estimatedTime: string;
  isPremium: boolean;
}

// ── Social audit ─────────────────────────────────────────────────────────────

export interface SocialPlatformData {
  platform: 'instagram' | 'facebook' | 'linkedin';
  handle: string;
  found: boolean;
  // Metrics (from API or scraped)
  followers?: number;
  following?: number;
  posts?: number;
  avgLikes?: number;
  avgComments?: number;
  engagementRate?: number;
  // Scores per category
  profileScore: number;
  contentScore: number;
  engagementScore: number;
  growthScore: number;
  brandingScore: number;
  conversionScore: number;
  overallScore: number;
}

export interface SocialAuditResult {
  platforms: SocialPlatformData[];
  combinedScore: number;
  categories: CategoryScore[];
  findings: Finding[];
  recommendations: Recommendation[];
}

// ── Website audit ────────────────────────────────────────────────────────────

export interface WebsiteAuditResult {
  url: string;
  lighthouse: LighthouseResult;
  categories: CategoryScore[];
  findings: Finding[];
  recommendations: Recommendation[];
  overallScore: number;
  // Technical checks
  hasSSL: boolean;
  sslExpiryDays?: number;
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
  mobileResponsive: boolean;
  brokenLinks: string[];
  missingMetaDescriptions: string[];
  missingAltText: number;
  h1Count: number;
}

// ── Full audit ───────────────────────────────────────────────────────────────

export interface AuditResult {
  overallScore: number;
  diagnosis: string;
  topStrengths: string[];
  criticalIssues: string[];
  website?: WebsiteAuditResult;
  social?: SocialAuditResult;
  actionPlan: ActionItem[];
}

// ── Audit record (DB) ────────────────────────────────────────────────────────

export interface Audit {
  id: string;
  type: AuditType;
  status: AuditStatus;
  url?: string;
  social?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
  paid: boolean;
  stripeSessionId?: string;
  userId?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  // Results split by access tier
  freeResults?: Pick<AuditResult, 'overallScore' | 'diagnosis' | 'topStrengths' | 'criticalIssues'> & {
    topRecommendations: Recommendation[];  // first 3 only
    categoryScores: { name: string; score: number }[];
  };
  fullResults?: AuditResult;
}

// ── API payloads ─────────────────────────────────────────────────────────────

export interface CreateAuditRequest {
  url?: string;
  social?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
  type: AuditType;
}

export interface CreateAuditResponse {
  auditId: string;
  status: AuditStatus;
}

export interface CheckoutSessionRequest {
  auditId: string;
}

export interface CheckoutSessionResponse {
  url: string;
}
