/**
 * @flexprice/billing/react — React Hooks & Components
 *
 * Provides usePlans, useSubscriptions, useEntitlements, useUsage hooks
 * and the FeatureGate component. All hooks call the auto-mounted
 * billing API routes via the FlexpriceClient.
 *
 * IMPORTANT: <FeatureGate> is for UX only, NOT for security.
 * Always enforce access server-side with requireFeature() or hasAccess().
 */
"use client"; // Required for Next.js App Router when using hooks

export { usePlans } from "./use-plans.js";
export { useSubscriptions } from "./use-subscriptions.js";
export { useEntitlements, useHasFeature } from "./use-entitlements.js";
export { useUsage } from "./use-usage.js";
export { FeatureGate } from "./feature-gate.jsx";
export { BillingProvider, useBillingClient } from "./provider.jsx";
