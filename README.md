# @tirdad/billing

> The official TypeScript SDK for integrating [Tirdad](https://tirdad.io) subscription billing into any JavaScript or TypeScript application.

[![Tests](https://img.shields.io/badge/tests-71%2F71-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## What is this?

`@tirdad/billing` is a **full-lifecycle subscription management SDK** that gives you everything you need to add billing to your SaaS application — plan selection, checkout, entitlement gating, usage metering, invoice history, plan upgrades/downgrades with proration, coupon redemption, and real-time webhook processing.

Instead of wiring up dozens of API calls, webhook parsers, and frontend state yourself, this package provides:

- A **single factory function** that initializes a fully configured billing instance
- **11 auto-mounted API routes** (Next.js / Express) for immediate backend integration
- **7 React hooks + 2 components** for building billing UIs
- **Type-safe webhook handling** with Svix signature verification and replay protection
- **Entitlement caching** to reduce latency on feature-gate checks

---

## Why use it?

| Problem | How `@tirdad/billing` solves it |
|---|---|
| Setting up billing takes weeks | One config object, 5 minutes to production |
| Multiple frameworks, multiple patterns | Framework-agnostic core; ready-made adapters for Next.js and Express |
| Webhook verification is error-prone | Built-in Svix signature verification with deduplication and replay protection |
| Frontend entitlement checks are messy | `useHasFeature("advanced_reports")` — one hook, done |
| Usage metering requires custom infra | `trackUsage()` and `isWithinLimit()` out of the box |
| Plan changes need proration math | `previewPlanChange()` shows proration details before committing |
| Mocking billing in tests is painful | `MockTirdadBilling()` with safe defaults for every method |

---

## Features

### Subscription Lifecycle
- **Create** subscriptions via checkout
- **List** and **query** active subscriptions
- **Cancel** (immediate or at period end)
- **Pause** (for a set number of days or until a specific date)
- **Resume** paused subscriptions

### Plan Management
- Fetch all plans (filterable by currency) for pricing pages
- Retrieve individual plans by ID or lookup key
- **Preview** plan changes with full proration breakdown (credits, charges, next invoice)
- **Execute** plan changes with configurable proration behavior

### Entitlements & Feature Gating
- Check if a customer has access to a specific feature (`hasAccess()`)
- Get detailed entitlement info including limits, reset periods, and source entities (`checkFeature()`)
- Server-side route protection via `requireFeature()` middleware
- Client-side `<FeatureGate>` component for conditional UI rendering

### Usage-Based Metering
- Track individual usage events with idempotency keys
- Batch usage ingestion for high-throughput scenarios
- Real-time feature usage queries with percentage and limit info
- `isWithinLimit()` for quota enforcement
- Auto-tracking middleware (`trackUsageMiddleware()`)

### Invoices
- List invoices with pagination
- Retrieve individual invoices
- Generate PDF download URLs

### Coupons & Discounts
- Validate coupon codes (checks expiry, max redemptions, validity)
- Apply coupons at checkout

### Webhooks (14 Events)
- **Subscription**: `created`, `updated`, `canceled`
- **Invoice**: `created`, `finalized`, `paid`, `voided`
- **Payment**: `succeeded`, `failed`, `refunded`
- **Customer**: `created`, `updated`
- **Wallet**: `credited`, `debited`

All webhook handlers are type-safe with full IntelliSense support. Verification is handled automatically via [Svix](https://svix.com) with configurable replay protection and deduplication (in-memory or custom store).

### Observability
- Pluggable structured logger (pino, winston, or any `info/warn/error` interface)
- `onError`, `onWebhook`, and `onRequest` callbacks for custom telemetry

---

## Install

```bash
npm install @tirdad/billing @flexprice/sdk
```

**Peer dependencies:**

| Package | When needed |
|---|---|
| `react` ≥ 18 | `@tirdad/billing/react` |
| `next` ≥ 14 | `@tirdad/billing/next` |
| `svix` ≥ 1 | Webhook verification (auto-installed) |

---

## Quick Start

### Next.js App Router

```ts
// lib/billing.ts
import { TirdadBilling } from "@tirdad/billing/next";
import { auth } from "@/lib/auth";

export const billing = TirdadBilling({
  config: {
    apiUrl: process.env.TIRDAD_API_URL!,
    apiKey: process.env.TIRDAD_API_KEY!,
    webhookSecret: process.env.TIRDAD_WEBHOOK_SECRET!,
  },
  auth: {
    resolveActor: async (req) => {
      const session = await auth();
      if (!session?.user) return null;
      return {
        externalId: session.user.id,
        email: session.user.email!,
        name: session.user.name!,
      };
    },
  },
  entitlementCache: true,
  on: {
    "subscription.created": async (ctx) => {
      console.log(`New subscription for ${ctx.customer.externalId}`);
    },
  },
});
```

```ts
// app/api/billing/[...billing]/route.ts
import { billing } from "@/lib/billing";

export const { GET, POST } = billing.handlers;
```

That's it. You now have **11 API routes** auto-mounted:

| Method | Route | Description |
|---|---|---|
| GET | `/api/billing/plans` | List available plans |
| POST | `/api/billing/checkout` | Create a checkout session |
| POST | `/api/billing/portal` | Get customer portal URL |
| GET | `/api/billing/subscriptions` | List subscriptions |
| GET | `/api/billing/entitlements` | List entitlements |
| POST | `/api/billing/entitlements/check` | Check a specific feature |
| POST | `/api/billing/usage` | Track usage events |
| GET | `/api/billing/usage/summary` | Get usage summary |
| GET | `/api/billing/invoices` | List invoices |
| POST | `/api/billing/coupons/validate` | Validate a coupon code |
| POST | `/api/billing/webhook` | Receive Tirdad webhooks |

### Express

```ts
import express from "express";
import { TirdadBillingExpress } from "@tirdad/billing/express";

const app = express();

app.use("/api/billing", TirdadBillingExpress({
  config: {
    apiUrl: process.env.TIRDAD_API_URL!,
    apiKey: process.env.TIRDAD_API_KEY!,
    webhookSecret: process.env.TIRDAD_WEBHOOK_SECRET!,
  },
  auth: {
    resolveActor: async (req) => {
      const user = (req as any).user;
      if (!user) return null;
      return { externalId: user.id, email: user.email };
    },
  },
}));

app.listen(3000);
```

---

## React Hooks & Components

Wrap your app with `<BillingProvider>`:

```tsx
import { BillingProvider } from "@tirdad/billing/react";
import { TirdadClient } from "@tirdad/billing/client";

const client = new TirdadClient({ basePath: "/api/billing" });

function App() {
  return (
    <BillingProvider client={client}>
      <PricingPage />
    </BillingProvider>
  );
}
```

### Available Hooks

| Hook | Returns | Purpose |
|---|---|---|
| `usePlans({ currency })` | `{ plans, isLoading }` | Fetch available plans for pricing pages |
| `useSubscriptions()` | `{ subscriptions, primary }` | Get customer subscriptions |
| `useEntitlements()` | `{ entitlements }` | List all entitlements |
| `useHasFeature(key)` | `{ hasAccess, entitlement }` | Check a single feature |
| `useUsage()` | `{ usage }` | Get usage summary |
| `useInvoices({ limit })` | `{ invoices, total }` | Fetch invoice history |

### Components

```tsx
import { FeatureGate, UsageBar } from "@tirdad/billing/react";

// Conditionally render based on entitlements (UX only — always enforce server-side)
<FeatureGate feature="advanced_reports" fallback={<UpgradePrompt />}>
  <AdvancedReports />
</FeatureGate>

// Visual usage progress bar with color thresholds
<UsageBar feature="api_calls" showLabel />
<UsageBar feature="storage_gb" used={7.5} limit={10} height={12} />
```

`UsageBar` color thresholds: 🔵 blue `< 80%` → 🟡 amber `80-95%` → 🔴 red `> 95%`

---

## Server-Side API Reference

The billing instance exposes **26 methods** across 8 domains:

### Plans & Checkout

```ts
const plans = await billing.getPlans({ currency: "USD" });
const plan = await billing.getPlan("plan_pro");
const formatted = billing.formatPrice(2999, "USD"); // "$29.99"

const result = await billing.checkout(actor, {
  planId: "plan_pro",
  couponCode: "SAVE20",
});
```

### Entitlements

```ts
const entitlements = await billing.getEntitlements(externalId);
const check = await billing.checkFeature(externalId, "api_calls");
const allowed = await billing.hasAccess(externalId, "advanced_reports");
```

### Usage

```ts
await billing.trackUsage({
  externalId: "user_123",
  eventName: "api_call",
  idempotencyKey: "unique_key",
  quantity: 1,
});

// Batch ingestion
await billing.trackUsageBatch([
  { externalId: "u1", eventName: "api_call", idempotencyKey: "k1" },
  { externalId: "u1", eventName: "api_call", idempotencyKey: "k2" },
]);

const usage = await billing.getFeatureUsage(externalId, "api_calls");
const withinLimit = await billing.isWithinLimit(externalId, "api_calls");
```

### Subscriptions

```ts
const subs = await billing.getSubscriptions(externalId);
const primary = await billing.getPrimarySubscription(externalId);
await billing.cancelSubscription(subId, { cancelAtPeriodEnd: true });
await billing.pauseSubscription(subId, { pauseDays: 30 });
await billing.resumeSubscription(subId);
```

### Plan Changes (with Proration Preview)

```ts
// Preview before committing
const preview = await billing.previewPlanChange("sub_1", "plan_pro");
console.log(preview.prorationDetails);
console.log(preview.nextInvoicePreview);
console.log(preview.warnings);

// Execute the change
await billing.changePlan("sub_1", "plan_pro");
```

### Invoices

```ts
const { invoices, total } = await billing.getInvoices(externalId);
const invoice = await billing.getInvoice("inv_123");
const pdfUrl = await billing.getInvoicePdfUrl("inv_123");
```

### Coupons

```ts
const coupon = await billing.validateCoupon("SAVE20");
// Returns null if invalid, expired, or max redemptions reached
if (coupon) {
  console.log(`${coupon.discountValue}% off`);
}
```

### Customer Resolution

```ts
// Resolve a BillingActor to a Tirdad customer (creates if not exists)
const customer = await billing.resolveCustomer({
  externalId: "user_123",
  email: "user@example.com",
  name: "Jane Doe",
});
```

---

## Middleware

### Entitlement Gating

Protect server-side routes with an entitlement check. Returns 403 if the customer doesn't have access:

```ts
export const GET = billing.requireFeature("advanced_reports", async (req, ctx) => {
  // ctx.actor and ctx.customerId are available
  return Response.json({ data: "protected content" });
});
```

### Usage Tracking

Automatically track usage on successful responses:

```ts
export const GET = billing.trackUsageMiddleware("api_call", async (req) => {
  return Response.json({ result: "..." });
});
```

---

## Entitlement Caching

Enable in-memory caching to reduce API calls for entitlement checks:

```ts
const billing = TirdadBilling({
  // ... config
  entitlementCache: true, // 60s TTL, 500 max entries
});

// Or configure:
const billing = TirdadBilling({
  // ... config
  entitlementCache: {
    ttlMs: 30_000,    // 30 seconds
    maxEntries: 1000,
  },
});
```

Cached methods: `checkFeature()`, `hasAccess()`, `getEntitlements()`.
Cache is automatically invalidated on TTL expiry. Use `billing.sdk` for uncached access.

---

## Webhooks

Configure type-safe webhook handlers with full IntelliSense:

```ts
on: {
  "subscription.created": async (ctx) => { /* ... */ },
  "subscription.canceled": async (ctx) => { /* ... */ },
  "invoice.paid": async (ctx) => { /* ... */ },
  "payment.failed": async (ctx) => { /* ... */ },
  "wallet.credited": async (ctx) => { /* ... */ },
}
```

Each callback receives a typed context with `customer`, `eventType`, `messageId`, `timestamp`, plus the event-specific payload (e.g. `ctx.subscription`, `ctx.invoice`, `ctx.wallet`).

Verification is handled automatically via [Svix](https://svix.com) with replay protection. Configure error handling and deduplication:

```ts
webhooks: {
  onCallbackError: "propagate", // or "swallow" to always return 200
  dedup: "memory",              // or "none", or provide a custom DedupStore
},
```

---

## Testing

Use the mock for unit tests — no API calls, no configuration required:

```ts
import { MockTirdadBilling, webhookFixtures } from "@tirdad/billing/testing";

const billing = MockTirdadBilling();

// All methods return safe defaults
const plans = await billing.getPlans();           // []
const check = await billing.checkFeature("u1", "feature"); // { isEnabled: false, ... }
const invoices = await billing.getInvoices("u1"); // { invoices: [], total: 0 }

// Test webhook handling
const { body, headers } = webhookFixtures.create("subscription.created", {
  subscription: { id: "sub_1" },
});
```

---

## Export Paths

| Import | Purpose | Environment |
|---|---|---|
| `@tirdad/billing` | Core factory (26 methods) | Server |
| `@tirdad/billing/next` | Next.js App Router adapter | Server |
| `@tirdad/billing/express` | Express adapter | Server |
| `@tirdad/billing/client` | Browser fetch client | Browser |
| `@tirdad/billing/react` | 7 hooks + 2 components | Browser |
| `@tirdad/billing/testing` | Mock + webhook fixtures | Test |

---

## Full Configuration Reference

```ts
interface TirdadBillingConfig {
  config: {
    apiUrl: string;         // Tirdad API base URL
    apiKey: string;         // API key for server-to-server auth
    webhookSecret: string;  // Svix webhook secret
    tenantId?: string;      // Multi-tenancy identifier
    environmentId?: string; // Environment (default: "live")
    timeout?: number;       // Request timeout in ms (default: 10000)
  };
  auth: {
    resolveActor: (req: Request) => Promise<BillingActor | null>;
  };
  checkout?: {
    successUrl?: string;    // Redirect after successful checkout
    cancelUrl?: string;     // Redirect on cancellation
  };
  routes?: {
    basePath?: string;      // Default: "/api/billing"
    disable?: RouteKey[];   // Routes to omit
    csrfProtection?: boolean;
  };
  webhooks?: {
    onCallbackError?: "propagate" | "swallow";
    dedup?: "memory" | "none";
    dedupStore?: DedupStore; // Custom dedup implementation
  };
  observability?: {
    logger?: MinimalLogger;  // pino, winston, or { info, warn, error }
    onError?: (err, ctx) => void;
    onWebhook?: (event) => void;
    onRequest?: (meta) => void;
  };
  entitlementCache?: boolean | { ttlMs?: number; maxEntries?: number };
  on?: TirdadCallbacks;     // Webhook event handlers
}
```

---

## Architecture

```
@tirdad/billing
├── Core Factory (index.ts)          ← createBillingInstance() — 26 methods
├── Framework Adapters
│   ├── next.ts                      ← TirdadBilling() + auto-routing
│   └── express/                     ← TirdadBillingExpress() middleware
├── Domain Modules
│   ├── auth.ts                      ← Customer resolution (find-or-create)
│   ├── subscriptions.ts             ← CRUD + pause/resume/cancel
│   ├── plans.ts                     ← Plan listing & lookup
│   ├── plan-change.ts               ← Preview & execute plan changes
│   ├── entitlements.ts              ← Feature gating & access checks
│   ├── usage.ts                     ← Metering & quota enforcement
│   ├── invoices.ts                  ← Invoice listing & PDF generation
│   ├── coupons.ts                   ← Coupon validation
│   └── webhooks.ts                  ← Svix verification + typed dispatch
├── Infrastructure
│   ├── cache.ts                     ← LRU entitlement cache
│   ├── dedup.ts                     ← Webhook deduplication
│   ├── currency.ts                  ← Price formatting (Intl.NumberFormat)
│   ├── errors.ts                    ← Custom error classes
│   ├── router.ts                    ← Route matching engine
│   └── types.ts                     ← All TypeScript interfaces
├── Client
│   └── client/index.ts              ← Browser-safe fetch client
├── React
│   └── react/index.ts               ← Hooks, Provider, FeatureGate, UsageBar
└── Testing
    └── testing/index.ts             ← MockTirdadBilling + webhook fixtures
```

The core factory (`createBillingInstance`) is framework-agnostic. The `@flexprice/sdk` handles HTTP transport to the Tirdad API. Framework adapters (Next.js, Express) wrap the core instance and add request/response routing.

---

## License

MIT
