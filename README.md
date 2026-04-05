# @flexprice/billing

> Universal billing integration layer for [Flexprice](https://flexprice.io). Works with **Next.js**, **Express**, **React**, and any JavaScript/TypeScript framework.

[![Tests](https://img.shields.io/badge/tests-71%2F71-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

## Why

- **One config** — Wire up Flexprice in 5 minutes, not 5 days
- **Framework agnostic** — Core logic works everywhere; adapters for Next.js and Express
- **Type-safe** — Strict TypeScript with custom error classes and SDK enums
- **Security first** — Svix webhook verification with replay protection
- **React ready** — 7 hooks + 2 components for instant billing UI

## Install

```bash
npm install @flexprice/billing @flexprice/sdk
```

**Peer dependencies:**

| Package | When needed |
|---|---|
| `react` ≥ 18 | `@flexprice/billing/react` |
| `svix` ≥ 1 | Webhook verification (auto-installed) |

## Quick Start

### Next.js App Router

```ts
// lib/billing.ts
import { FlexpriceBilling } from "@flexprice/billing/next";
import { auth } from "@/lib/auth";

export const billing = FlexpriceBilling({
  config: {
    apiUrl: process.env.FLEXPRICE_API_URL!,
    apiKey: process.env.FLEXPRICE_API_KEY!,
    webhookSecret: process.env.FLEXPRICE_WEBHOOK_SECRET!,
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
  // Optional: cache entitlement checks for 60s
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

That's it. You now have 11 API routes auto-mounted:

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
| POST | `/api/billing/webhook` | Receive Flexprice webhooks |

### Express

```ts
import express from "express";
import { FlexpriceBillingExpress } from "@flexprice/billing/express";

const app = express();

app.use("/api/billing", FlexpriceBillingExpress({
  config: {
    apiUrl: process.env.FLEXPRICE_API_URL!,
    apiKey: process.env.FLEXPRICE_API_KEY!,
    webhookSecret: process.env.FLEXPRICE_WEBHOOK_SECRET!,
  },
  auth: {
    resolveActor: async (req) => {
      // Your auth logic here
      const user = (req as any).user;
      if (!user) return null;
      return { externalId: user.id, email: user.email };
    },
  },
}));

app.listen(3000);
```

## React Hooks

Wrap your app with `<BillingProvider>`:

```tsx
import { BillingProvider } from "@flexprice/billing/react";
import { FlexpriceClient } from "@flexprice/billing/client";

const client = new FlexpriceClient({ basePath: "/api/billing" });

function App() {
  return (
    <BillingProvider client={client}>
      <PricingPage />
    </BillingProvider>
  );
}
```

### Available Hooks

```tsx
import {
  usePlans,
  useSubscriptions,
  useEntitlements,
  useHasFeature,
  useUsage,
  useInvoices,
} from "@flexprice/billing/react";

// Plans
const { plans, isLoading } = usePlans({ currency: "USD" });

// Subscriptions
const { subscriptions, primary } = useSubscriptions();

// Entitlements
const { entitlements } = useEntitlements();
const { hasAccess, entitlement } = useHasFeature("advanced_reports");

// Usage
const { usage } = useUsage();

// Invoices
const { invoices, total } = useInvoices({ limit: 10 });
```

### Components

```tsx
import { FeatureGate, UsageBar } from "@flexprice/billing/react";

// Conditionally render based on entitlements (UX only — always enforce server-side)
<FeatureGate feature="advanced_reports" fallback={<UpgradePrompt />}>
  <AdvancedReports />
</FeatureGate>

// Visual usage progress bar with color thresholds
<UsageBar feature="api_calls" showLabel />
<UsageBar feature="storage_gb" used={7.5} limit={10} height={12} />
```

`UsageBar` color thresholds: 🔵 blue `< 80%` → 🟡 amber `80-95%` → 🔴 red `> 95%`

## Server-Side API

The billing instance exposes 26 methods:

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

## Middleware

### Entitlement Gating

```ts
// Protect a route with an entitlement check
export const GET = billing.requireFeature("advanced_reports", async (req, ctx) => {
  // ctx.actor and ctx.customerId are available
  return Response.json({ data: "protected content" });
});
```

### Usage Tracking

```ts
// Automatically track usage on successful responses
export const GET = billing.trackUsageMiddleware("api_call", async (req) => {
  return Response.json({ result: "..." });
});
```

## Entitlement Caching

Enable in-memory caching to reduce API calls:

```ts
const billing = FlexpriceBilling({
  // ... config
  entitlementCache: true, // 60s TTL, 500 max entries
});

// Or configure:
const billing = FlexpriceBilling({
  // ... config
  entitlementCache: {
    ttlMs: 30_000,    // 30 seconds
    maxEntries: 1000,
  },
});
```

Cached methods: `checkFeature()`, `hasAccess()`, `getEntitlements()`.
Cache is automatically invalidated on TTL expiry. Use `billing.sdk` for uncached access.

## Webhooks

Configure webhook handlers with type-safe callbacks:

```ts
on: {
  "subscription.created": async (ctx) => { /* ... */ },
  "subscription.canceled": async (ctx) => { /* ... */ },
  "invoice.paid": async (ctx) => { /* ... */ },
  "payment.failed": async (ctx) => { /* ... */ },
}
```

Verification is handled automatically via [Svix](https://svix.com) with replay protection.

## Testing

Use the mock for unit tests:

```ts
import { MockFlexpriceBilling, webhookFixtures } from "@flexprice/billing/testing";

const billing = MockFlexpriceBilling();

// All methods return safe defaults
const plans = await billing.getPlans();           // []
const check = await billing.checkFeature("u1", "feature"); // { isEnabled: false, ... }
const invoices = await billing.getInvoices("u1"); // { invoices: [], total: 0 }

// Test webhook handling
const { body, headers } = webhookFixtures.create("subscription.created", {
  subscription: { id: "sub_1" },
});
```

## Export Paths

| Import | Purpose | Environment |
|---|---|---|
| `@flexprice/billing` | Core factory (26 methods) | Server |
| `@flexprice/billing/next` | Next.js App Router adapter | Server |
| `@flexprice/billing/express` | Express adapter | Server |
| `@flexprice/billing/client` | Browser fetch client | Browser |
| `@flexprice/billing/react` | 7 hooks + 2 components | Browser |
| `@flexprice/billing/testing` | Mock + webhook fixtures | Test |

## Configuration

```ts
interface FlexpriceBillingConfig {
  config: {
    apiUrl: string;       // Flexprice API URL
    apiKey: string;       // API key
    webhookSecret: string; // Svix webhook secret
    timeout?: number;     // Request timeout in ms (default: 10000)
  };
  auth: {
    resolveActor: (req: Request) => Promise<BillingActor | null>;
  };
  checkout?: {
    successUrl?: string;
    cancelUrl?: string;
  };
  routes?: {
    basePath?: string;    // Default: "/api/billing"
    disable?: RouteKey[]; // Routes to disable
  };
  webhooks?: {
    tolerance?: number;   // Svix time tolerance
  };
  entitlementCache?: boolean | { ttlMs?: number; maxEntries?: number };
  on?: FlexpriceCallbacks;
}
```

## License

MIT
