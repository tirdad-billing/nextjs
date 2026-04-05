/**
 * @tirdad/billing/react — useInvoices hook
 */
"use client";

import { useBillingClient } from "./provider.jsx";
import { useAsync } from "./use-async.js";

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
  const { data, isLoading, error, refetch } = useAsync(
    () => client.getInvoices(options),
    [options?.limit, options?.offset],
  );

  return {
    invoices: data?.invoices ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refetch,
  };
}
