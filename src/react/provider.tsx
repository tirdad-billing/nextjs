/**
 * @tirdad/billing/react — BillingProvider
 *
 * Context provider for TirdadClient. Wraps the component tree
 * so that hooks can access the client without prop drilling.
 */
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { TirdadClient, type TirdadClientOptions } from "../client/index.js";

const BillingContext = createContext<TirdadClient | null>(null);

export interface BillingProviderProps {
  children: ReactNode;
  /** TirdadClient options. Default basePath: "/api/billing" */
  options?: TirdadClientOptions;
  /** Pre-constructed client instance (overrides options). */
  client?: TirdadClient;
  /** Initial entitlements to seed the cache (prevents loading flashes on SSR) */
  initialEntitlements?: unknown;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

/**
 * Wrap your app (or a subtree) with BillingProvider to enable billing hooks.
 *
 * ```tsx
 * <BillingProvider initialEntitlements={entitlements}>
 *   <YourApp />
 * </BillingProvider>
 * ```
 */
export function BillingProvider({
  children,
  options,
  client,
  initialEntitlements,
}: BillingProviderProps) {
  const billingClient = useMemo(
    () => client ?? new TirdadClient(options),
    [client, options],
  );

  // Initialize the query client
  const queryClient = getQueryClient();

  // If initialEntitlements is provided, seed the cache immediately
  if (initialEntitlements !== undefined) {
    queryClient.setQueryData(["tirdad", "entitlements"], initialEntitlements);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BillingContext.Provider value={billingClient}>
        {children}
      </BillingContext.Provider>
    </QueryClientProvider>
  );
}

/**
 * Access the TirdadClient from context.
 * Must be called within a <BillingProvider>.
 */
export function useBillingClient(): TirdadClient {
  const client = useContext(BillingContext);
  if (!client) {
    throw new Error(
      "useBillingClient must be used within a <BillingProvider>. " +
        "Wrap your component tree with <BillingProvider> from @tirdad/billing/react.",
    );
  }
  return client;
}
