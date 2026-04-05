/**
 * @flexprice/billing/react — useEntitlements / useHasFeature hooks
 */
"use client";

import type { EntitlementCheckResult } from "../types.js";
import { useBillingClient } from "./provider.jsx";
import { useAsync } from "./use-async.js";

export interface UseEntitlementsResult {
  entitlements: unknown;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch all entitlements for the current user.
 *
 * ```tsx
 * const { entitlements, isLoading } = useEntitlements();
 * ```
 */
export function useEntitlements(): UseEntitlementsResult {
  const client = useBillingClient();
  const { data, isLoading, error, refetch } = useAsync(
    () => client.getEntitlements(),
    [],
  );

  return {
    entitlements: data,
    isLoading,
    error,
    refetch,
  };
}

export interface UseHasFeatureResult {
  /** Whether the feature is enabled for this user. */
  hasAccess: boolean;
  /** Full entitlement check result (when loaded). */
  entitlement: EntitlementCheckResult | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Check a single feature's entitlement for the current user.
 *
 * ```tsx
 * const { hasAccess, isLoading } = useHasFeature("advanced_reports");
 * ```
 */
export function useHasFeature(lookupKey: string): UseHasFeatureResult {
  const client = useBillingClient();
  const { data, isLoading, error, refetch } = useAsync(
    () => client.checkFeature(lookupKey),
    [lookupKey],
  );

  return {
    hasAccess: data?.isEnabled ?? false,
    entitlement: data ?? null,
    isLoading,
    error,
    refetch,
  };
}
