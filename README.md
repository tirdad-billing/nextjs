<p align="center">
  <strong>@tirdad/billing</strong>
</p>

<p align="center">
  The official TypeScript SDK for integrating <a href="https://tirdad.ai">Tirdad</a> billing into Next.js applications.
  <br/>
  Plans · Checkout · Entitlements · Webhooks — one package, zero boilerplate.
</p>

<p align="center">
  <a href="#install"><img alt="npm" src="https://img.shields.io/npm/v/@tirdad/billing?style=flat-square&color=0070f3"/></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square"/>
  <img alt="Tests" src="https://img.shields.io/badge/tests-88%20passed-brightgreen?style=flat-square"/>
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green?style=flat-square"/>
  <img alt="Beta" src="https://img.shields.io/badge/status-beta-orange?style=flat-square"/>
</p>

---

## Overview

`@tirdad/billing` connects your SaaS application to the [Tirdad](https://tirdad.ai) billing platform. It handles the integration surface you build on top of — plan display, checkout initiation, feature gating, and webhook processing — while delegating customer-facing billing management (invoices, subscriptions, usage dashboards) to the Tirdad **Customer Portal**.

```
Your App                           Tirdad
┌──────────────────────┐          ┌──────────────────────┐
│  Pricing Page        │◄─plans──►│  Plan Catalog        │
│  Checkout Flow       │◄─sub────►│  Subscription Engine │
│  Feature Gates       │◄─ent────►│  Entitlement Engine  │
│  Webhook Handlers    │◄─hook───►│  Event Bus           │
│                      │          │                      │
│  "Manage Billing" ───┼──portal──►  Customer Portal     │
│  (redirect)          │          │  (invoices, usage,   │
│                      │          │   subscriptions)     │
└──────────────────────┘          └──────────────────────┘
```

---

## Install

```bash
npm install @tirdad/billing
```

| Peer Dependency | Required When |
|---|---|
| `react` ≥ 18 | Using `@tirdad/billing/react` |
| `next` ≥ 14 | Using `@tirdad/billing/next` |

---

## Quick Start

### 1. Configure the billing instance

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
    resolveActor: async () => {
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
      console.log(`New subscription: ${ctx.customer.externalId}`);
    },
  },
});
```

### 2. Mount the API routes

```ts
// app/api/billing/[...billing]/route.ts
import { billing } from "@/lib/billing";

export const { GET, POST } = billing.handlers;
```

### 3. Add the React provider

```tsx
// app/layout.tsx or providers.tsx
import { BillingProvider } from "@tirdad/billing/react";
import { TirdadClient } from "@tirdad/billing/client";

const client = new TirdadClient({ basePath: "/api/billing" });

export default function Layout({ children }) {
  return (
    <BillingProvider client={client}>
      {children}
    </BillingProvider>
  );
}
```

That's it. You now have billing routes, React hooks, and webhook processing ready to use.

---

## API Routes

When mounted, the following routes are automatically available:

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/billing/plans` | List available plans |
| `POST` | `/api/billing/checkout` | Initiate a checkout session |
| `POST` | `/api/billing/portal` | Get customer portal URL |
| `GET` | `/api/billing/entitlements` | List entitlements |
| `POST` | `/api/billing/entitlements/check` | Check a specific feature |
| `POST` | `/api/billing/webhook` | Receive Tirdad webhooks |

---

## React Hooks

All hooks require `<BillingProvider>` as an ancestor.

### `usePlans`

Fetch available plans for pricing pages.

```tsx
import { usePlans } from "@tirdad/billing/react";

function PricingPage() {
  const { plans, isLoading, error } = usePlans({ currency: "USD" });

  if (isLoading) return <p>Loading plans...</p>;

  return (
    <div className="grid grid-cols-3 gap-6">
      {plans.map((plan) => (
        <div key={plan.id}>
          <h3>{plan.name}</h3>
          <p>{plan.prices[0]?.displayAmount}/mo</p>
        </div>
      ))}
    </div>
  );
}
```

### `useHasFeature`

Check if the current user has access to a specific feature.

```tsx
import { useHasFeature } from "@tirdad/billing/react";

function ExportButton() {
  const { hasAccess, isLoading } = useHasFeature("pdf_exports");

  if (isLoading) return <button disabled>Loading...</button>;
  if (!hasAccess) return <button disabled>Upgrade to export</button>;

  return <button onClick={handleExport}>Export PDF</button>;
}
```

### `useEntitlements`

Fetch all entitlements for the current user.

```tsx
import { useEntitlements } from "@tirdad/billing/react";

function EntitlementsList() {
  const { entitlements, isLoading } = useEntitlements();
  // ...
}
```

---

## Components

### `<FeatureGate>`

Conditionally render content based on feature entitlements.

```tsx
import { FeatureGate } from "@tirdad/billing/react";

<FeatureGate
  feature="advanced_analytics"
  loading={<Skeleton />}
  fallback={<UpgradeBanner />}
>
  <AdvancedAnalyticsPanel />
</FeatureGate>
```

| Prop | Type | Description |
|---|---|---|
| `feature` | `string` | Feature lookup key to check |
| `children` | `ReactNode` | Rendered when access is granted |
| `fallback` | `ReactNode` | Rendered when access is denied |
| `loading` | `ReactNode` | Rendered while checking |

> **⚠️ Security Note:** `<FeatureGate>` is a UX helper, not a security boundary. Always enforce access server-side with `hasAccess()` or `requireFeature()`.

---

## Server-Side API

The billing instance exposes these methods:

### Plans & Checkout

```ts
const plans = await billing.getPlans({ currency: "USD" });
const plan  = await billing.getPlan("plan_pro");
const price = billing.formatPrice(2999, "USD"); // "$29.99"

const { url } = await billing.checkout(actor, {
  planId: "plan_pro",
  couponCode: "SAVE20",
});
```

### Entitlements

```ts
const entitlements = await billing.getEntitlements(externalId);
const check   = await billing.checkFeature(externalId, "api_calls");
const allowed = await billing.hasAccess(externalId, "advanced_reports");
```

### Customer Resolution

```ts
const customer = await billing.resolveCustomer({
  externalId: "user_123",
  email: "user@example.com",
  name: "Jane Doe",
});
```

Uses a create-or-fetch pattern — race-safe with no TOCTOU window.

---

## Webhooks

Configure type-safe webhook handlers:

```ts
const billing = TirdadBilling({
  // ...config
  on: {
    "subscription.created":  async (ctx) => { /* ... */ },
    "subscription.canceled": async (ctx) => { /* ... */ },
    "invoice.paid":          async (ctx) => { /* ... */ },
    "payment.failed":        async (ctx) => { /* ... */ },
    "customer.created":      async (ctx) => { /* ... */ },
    "wallet.credited":       async (ctx) => { /* ... */ },
  },
});
```

**Supported events:** `subscription.created`, `subscription.updated`, `subscription.canceled`, `invoice.created`, `invoice.finalized`, `invoice.paid`, `invoice.voided`, `payment.succeeded`, `payment.failed`, `payment.refunded`, `customer.created`, `customer.updated`, `wallet.credited`, `wallet.debited`

Verification is handled automatically via [Svix](https://svix.com) with replay protection and configurable deduplication.

---

## Entitlement Caching

Reduce API calls for entitlement checks:

```ts
// Enable with defaults (60s TTL, 500 max entries)
entitlementCache: true,

// Or configure
entitlementCache: {
  ttlMs: 30_000,
  maxEntries: 1000,
},
```

Cached methods: `checkFeature()`, `hasAccess()`, `getEntitlements()`.

---

## Testing

Use the mock for unit tests — no API calls, no configuration:

```ts
import { MockTirdadBilling, webhookFixtures } from "@tirdad/billing/testing";

const billing = MockTirdadBilling({
  plans: [{ id: "plan_1", name: "Pro", ... }],
  entitlements: { advanced_reports: true },
});

// All methods return predictable data
const plans = await billing.getPlans();                      // [{ id: "plan_1", ... }]
const check = await billing.checkFeature("u1", "advanced_reports"); // { isEnabled: true }

// Generate webhook fixtures
const { body, headers } = webhookFixtures.create("subscription.created", {
  subscription: { id: "sub_1" },
});
```

---

## Export Paths

| Import | Purpose | Environment |
|---|---|---|
| `@tirdad/billing` | Core factory | Server |
| `@tirdad/billing/next` | Next.js App Router adapter | Server |
| `@tirdad/billing/client` | Browser fetch client | Browser |
| `@tirdad/billing/react` | React hooks + components | Browser |
| `@tirdad/billing/testing` | Mock + webhook fixtures | Test |

---

## Configuration Reference

```ts
TirdadBilling({
  config: {
    apiUrl: string,           // Tirdad API base URL
    apiKey: string,           // API key (server-to-server)
    webhookSecret: string,    // Svix webhook secret
    timeout?: number,         // Request timeout in ms (default: 10000)
  },
  auth: {
    resolveActor: (req) => Promise<BillingActor | null>,
  },
  checkout?: {
    successUrl?: string,      // Redirect after checkout
    cancelUrl?: string,       // Redirect on cancel
  },
  routes?: {
    basePath?: string,        // Default: "/api/billing"
    disable?: RouteKey[],     // Routes to omit
  },
  webhooks?: {
    onCallbackError?: "propagate" | "swallow",
    dedup?: "memory" | "none",
  },
  observability?: {
    logger?: { info, warn, error },
    onError?: (err, ctx) => void,
    onWebhook?: (event) => void,
  },
  entitlementCache?: boolean | { ttlMs?: number, maxEntries?: number },
  on?: { [eventName]: (ctx) => Promise<void> },
});
```

---

## Customer Portal

For customer-facing billing management (invoices, subscriptions, usage analytics), redirect users to the Tirdad Customer Portal:

```ts
// Server: generate a portal session
const { url } = await billing.getPortalUrl(actor);
// Redirect the user to `url`
```

```tsx
// Client: redirect from a button
import { TirdadClient } from "@tirdad/billing/client";

const client = new TirdadClient();

async function openBillingPortal() {
  const { url } = await client.getPortalUrl();
  window.location.href = url;
}

<button onClick={openBillingPortal}>Manage Billing</button>
```

---

## Requirements

- Node.js ≥ 18
- TypeScript ≥ 5 (recommended)
- React ≥ 18 (for hooks/components)
- Next.js ≥ 14 (for App Router adapter)

---

## License

MIT
