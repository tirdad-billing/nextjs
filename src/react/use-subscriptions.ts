/**
 * @flexprice/billing/react — useSubscriptions hook
 */
"use client";

import type { BillingSubscription } from "../types.js";
import { useBillingClient } from "./provider.jsx";
import { useAsync } from "./use-async.js";

export interface UseSubscriptionsResult {
  /** All subscriptions for the current user. */
  subscriptions: BillingSubscription[];
  /** Convenience: the first active sub, or most recent non-canceled. */
  primary: BillingSubscription | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch all subscriptions for the current user.
 *
 * ```tsx
 * const { subscriptions, primary, isLoading } = useSubscriptions();
 * ```
 */
export function useSubscriptions(): UseSubscriptionsResult {
  const client = useBillingClient();
  const { data, isLoading, error, refetch } = useAsync(
    () => client.getSubscriptions(),
    [],
  );

  const subscriptions = data?.subscriptions ?? [];

  // Determine primary: first active, or most recent non-canceled
  const primary =
    subscriptions.find((s) => s.status === "active") ??
    subscriptions.filter((s) => s.status !== "canceled")[0] ??
    null;

  return {
    subscriptions,
    primary,
    isLoading,
    error,
    refetch,
  };
}
