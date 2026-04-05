/**
 * @tirdad/billing/react — BillingProvider
 *
 * Context provider for TirdadClient. Wraps the component tree
 * so that hooks can access the client without prop drilling.
 */
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { TirdadClient, type TirdadClientOptions } from "../client/index.js";

const BillingContext = createContext<TirdadClient | null>(null);

export interface BillingProviderProps {
  children: ReactNode;
  /** TirdadClient options. Default basePath: "/api/billing" */
  options?: TirdadClientOptions;
  /** Pre-constructed client instance (overrides options). */
  client?: TirdadClient;
}

/**
 * Wrap your app (or a subtree) with BillingProvider to enable billing hooks.
 *
 * ```tsx
 * <BillingProvider>
 *   <YourApp />
 * </BillingProvider>
 * ```
 */
export function BillingProvider({
  children,
  options,
  client,
}: BillingProviderProps) {
  const billingClient = useMemo(
    () => client ?? new TirdadClient(options),
    [client, options],
  );

  return (
    <BillingContext.Provider value={billingClient}>
      {children}
    </BillingContext.Provider>
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
