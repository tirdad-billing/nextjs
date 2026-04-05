/**
 * @flexprice/billing/react — FeatureGate component
 *
 * Conditionally renders children based on entitlement.
 * WARNING: This is UX only, NOT security. Enforce server-side with requireFeature().
 */
"use client";

import type { ReactNode } from "react";
import { useHasFeature } from "./use-entitlements.js";

export interface FeatureGateProps {
  /** The feature lookup key to check (e.g. "advanced_reports"). */
  feature: string;
  /** Content to render when the feature is enabled. */
  children: ReactNode;
  /** Content to render when the feature is NOT enabled. Defaults to null. */
  fallback?: ReactNode;
  /** Content to render while loading. Defaults to null. */
  loading?: ReactNode;
}

/**
 * Gate UI features based on entitlements.
 *
 * ```tsx
 * <FeatureGate feature="advanced_reports" fallback={<UpgradePrompt />}>
 *   <AdvancedReportsPanel />
 * </FeatureGate>
 * ```
 *
 * ⚠️ This is a UX convenience — a user can bypass this by calling your API directly.
 * Always enforce access server-side with `requireFeature()` or `billing.hasAccess()`.
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
  loading = null,
}: FeatureGateProps) {
  const { hasAccess, isLoading } = useHasFeature(feature);

  if (isLoading) return <>{loading}</>;
  if (!hasAccess) return <>{fallback}</>;
  return <>{children}</>;
}
