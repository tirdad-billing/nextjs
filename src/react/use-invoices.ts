/**
 * @tirdad/billing/react — useInvoices hook
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useBillingClient } from "./provider.jsx";

export interface UseInvoicesResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoices: any[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch invoices for the current user.
 *
 * ```tsx
 * const { invoices, isLoading } = useInvoices();
 * ```
 */
export function useInvoices(options?: {
  limit?: number;
  offset?: number;
}): UseInvoicesResult {
  const client = useBillingClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tirdad", "invoices", options],
    queryFn: () => client.getInvoices(options),
  });

  return {
    invoices: data?.invoices ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  };
}
