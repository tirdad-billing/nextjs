/**
 * @tirdad/billing/react — useUsage hook
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useBillingClient } from "./provider.jsx";

export interface UseUsageResult {
  /** Full usage summary. */
  usage: unknown;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch usage summary for the current user.
 *
 * ```tsx
 * const { usage, isLoading } = useUsage();
 * ```
 */
export function useUsage(): UseUsageResult {
  const client = useBillingClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tirdad", "usage"],
    queryFn: () => client.getUsageSummary(),
  });

  return {
    usage: data,
    isLoading,
    error,
    refetch,
  };
}
