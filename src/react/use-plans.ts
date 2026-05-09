/**
 * @tirdad/billing/react — usePlans hook
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import type { BillingPlan } from "../types.js";
import { useBillingClient } from "./provider.jsx";

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
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tirdad", "plans", options],
    queryFn: () => client.getPlans(options),
  });

  return {
    plans: data ?? [],
    isLoading,
    error,
    refetch,
  };
}
