/**
 * @flexprice/billing/react — usePlans hook
 */
"use client";

import type { BillingPlan } from "../types.js";
import { useBillingClient } from "./provider.jsx";
import { useAsync } from "./use-async.js";

export interface UsePlansOptions {
  /** Filter prices to a specific currency (e.g. "SAR"). */
  currency?: string;
  /** Filter by plan lookup key. */
  lookupKey?: string;
}

export interface UsePlansResult {
  plans: BillingPlan[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch all plans from the billing API.
 * Public — no auth required.
 *
 * ```tsx
 * const { plans, isLoading } = usePlans();
 * const { plans: sarPlans } = usePlans({ currency: "SAR" });
 * ```
 */
export function usePlans(options?: UsePlansOptions): UsePlansResult {
  const client = useBillingClient();
  const { data, isLoading, error, refetch } = useAsync(
    () => client.getPlans(options),
    [options?.currency, options?.lookupKey],
  );

  return {
    plans: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
