/**
 * @tirdad/billing/react — React Hooks & Components
 *
 * Provides React hooks for plans, entitlements, subscriptions, usage, and
 * invoices, plus the FeatureGate component. Each data hook is backed by an
 * auto-mounted route on the Next.js adapter.
 *
 * IMPORTANT: <FeatureGate> is for UX only, NOT for security.
 * Always enforce access server-side with requireFeature() or hasAccess().
 */
"use client"; // Required for Next.js App Router when using hooks

export { usePlans } from "./use-plans.js";
export { useSubscriptions } from "./use-subscriptions.js";
export { useEntitlements, useHasFeature } from "./use-entitlements.js";
export { useUsage } from "./use-usage.js";
export { useInvoices } from "./use-invoices.js";
export { FeatureGate } from "./feature-gate.jsx";
export { BillingProvider, useBillingClient } from "./provider.jsx";
