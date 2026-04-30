# GrowthAudit — Production Platform

Full-stack audit platform with real Lighthouse data, AI scoring engine, and Stripe paywall.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Node.js + Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Queue | BullMQ + Redis |
| Payments | Stripe Checkout + Webhooks |
| Auditing | Google PageSpeed Insights API (Lighthouse) |
| PDF | Puppeteer (server-side render) |
| Auth | NextAuth.js (email magic link) |

## Architecture

```
Browser → Next.js Frontend
            ↓ REST
         Express API (Backend)
            ↓
         BullMQ Job Queue → Audit Worker
            ↓                   ↓
         PostgreSQL         PageSpeed API
         (results)          (Lighthouse)
            ↓
         Stripe (paywall)
```

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Stripe account
- Google API key (PageSpeed Insights)

### 1. Clone and install

```bash
git clone https://github.com/yourorg/growthaudit
cd growthaudit

# Install all workspaces
npm install
```

### 2. Environment setup

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Fill in the values (see Environment Variables section below).

### 3. Database setup

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Run in development

```bash
# Terminal 1 — Backend API + Worker
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### 5. Stripe webhook (local)

```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/growthaudit"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
JWT_SECRET="your-secret-here"

# Google PageSpeed Insights
GOOGLE_API_KEY="AIza..."

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID_FULL_REPORT="price_..."

# App
PORT=4000
FRONTEND_URL="http://localhost:3000"
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
```

---

## Project Structure

```
growthaudit/
├── frontend/                 # Next.js 14 App Router
│   ├── app/
│   │   ├── page.tsx          # Landing + audit input
│   │   ├── audit/[id]/       # Results dashboard
│   │   ├── report/[id]/      # Full gated report
│   │   ├── dashboard/        # User account
│   │   ├── pricing/          # Plans page
│   │   └── api/              # Next.js API routes (auth)
│   ├── components/
│   │   ├── AuditForm.tsx
│   │   ├── ScoreRing.tsx
│   │   ├── CategoryCard.tsx
│   │   ├── FindingItem.tsx
│   │   ├── RecoCard.tsx
│   │   ├── ActionPlan.tsx
│   │   ├── PaywallGate.tsx
│   │   └── StripeCheckout.tsx
│   └── lib/
│       ├── api.ts            # API client
│       └── stripe.ts         # Stripe client
│
├── backend/                  # Express API
│   ├── routes/
│   │   ├── audits.ts         # POST /audits, GET /audits/:id
│   │   ├── payments.ts       # POST /payments/checkout
│   │   └── webhooks.ts       # POST /webhooks/stripe
│   ├── services/
│   │   ├── lighthouse.ts     # PageSpeed Insights wrapper
│   │   ├── scorer.ts         # Weighted scoring engine
│   │   ├── recommendations.ts# Recommendation generator
│   │   └── pdf.ts            # Puppeteer PDF renderer
│   ├── workers/
│   │   └── auditWorker.ts    # BullMQ job processor
│   ├── db/
│   │   └── prisma/
│   │       └── schema.prisma
│   └── middleware/
│       ├── auth.ts
│       └── rateLimit.ts
│
└── shared/
    └── types.ts              # Shared TypeScript types
```

---

## Stripe Paywall Flow

1. User runs free audit → gets executive summary (score + top 3 issues)
2. Full report locked behind `$49` one-time payment
3. User clicks "Unlock full report"
4. Backend creates Stripe Checkout Session with `audit_id` metadata
5. User completes payment → Stripe fires `checkout.session.completed` webhook
6. Webhook handler marks `audit.paid = true` in DB
7. User redirected back → full report now visible

---

## Scoring Engine Weights

### Website Audit (100 pts)
| Category | Weight |
|---|---|
| Technical SEO | 20% |
| Performance (Core Web Vitals) | 15% |
| UX / UI | 15% |
| Conversion (CRO) | 20% |
| Security | 10% |
| Content / SEO | 20% |

### Social Media Audit (100 pts)
| Category | Weight |
|---|---|
| Profile optimisation | 15% |
| Content quality | 20% |
| Engagement | 20% |
| Growth | 15% |
| Branding | 10% |
| Conversion readiness | 20% |

---

## API Reference

### POST /audits
Start a new audit job.

```json
{
  "url": "https://example.com",
  "social": {
    "instagram": "@handle",
    "facebook": "/page",
    "linkedin": "company/name"
  },
  "type": "website" | "social" | "full"
}
```

Response:
```json
{
  "auditId": "uuid",
  "status": "queued"
}
```

### GET /audits/:id
Poll audit status and results.

```json
{
  "id": "uuid",
  "status": "queued" | "processing" | "complete" | "failed",
  "paid": false,
  "freeResults": { ... },
  "fullResults": null
}
```

### POST /payments/checkout
Create Stripe checkout session.

```json
{ "auditId": "uuid" }
```

Response: `{ "url": "https://checkout.stripe.com/..." }`

### POST /webhooks/stripe
Stripe webhook endpoint (raw body required).

---

## Deployment

### Docker Compose (recommended)

```bash
docker-compose up -d
```

Includes: Postgres, Redis, backend API, worker, frontend.

### Production checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use Stripe live keys
- [ ] Configure domain in `NEXTAUTH_URL` and `FRONTEND_URL`
- [ ] Set up SSL
- [ ] Configure Redis persistence
- [ ] Set up DB backups
- [ ] Add Sentry for error tracking
- [ ] Set rate limits on audit endpoint
