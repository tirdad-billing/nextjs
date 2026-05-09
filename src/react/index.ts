/**
 * @tirdad/billing/react — React Hooks & Components
 *
 * Provides React hooks for plans, entitlements,
 * and the FeatureGate component.
 *
 * NOTE: useSubscriptions, useInvoices, useUsage are hidden for beta.
 * These are covered by the Flexprice Customer Portal.
 * Re-enable when needed by uncommenting below.
 *
 * IMPORTANT: <FeatureGate> is for UX only, NOT for security.
 * Always enforce access server-side with requireFeature() or hasAccess().
 */
"use client"; // Required for Next.js App Router when using hooks

export { usePlans } from "./use-plans.js";
// export { useSubscriptions } from "./use-subscriptions.js";  // Hidden: use Customer Portal
export { useEntitlements, useHasFeature } from "./use-entitlements.js";
// export { useUsage } from "./use-usage.js";                  // Hidden: use Customer Portal
// export { useInvoices } from "./use-invoices.js";            // Hidden: use Customer Portal
export { FeatureGate } from "./feature-gate.jsx";
export { BillingProvider, useBillingClient } from "./provider.jsx";
