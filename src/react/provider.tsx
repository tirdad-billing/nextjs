/**
 * @flexprice/billing/react — BillingProvider
 *
 * Context provider for FlexpriceClient. Wraps the component tree
 * so that hooks can access the client without prop drilling.
 */
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { FlexpriceClient, type FlexpriceClientOptions } from "../client/index.js";

const BillingContext = createContext<FlexpriceClient | null>(null);

export interface BillingProviderProps {
  children: ReactNode;
  /** FlexpriceClient options. Default basePath: "/api/billing" */
  options?: FlexpriceClientOptions;
  /** Pre-constructed client instance (overrides options). */
  client?: FlexpriceClient;
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
    () => client ?? new FlexpriceClient(options),
    [client, options],
  );

  return (
    <BillingContext.Provider value={billingClient}>
      {children}
    </BillingContext.Provider>
  );
}

/**
 * Access the FlexpriceClient from context.
 * Must be called within a <BillingProvider>.
 */
export function useBillingClient(): FlexpriceClient {
  const client = useContext(BillingContext);
  if (!client) {
    throw new Error(
      "useBillingClient must be used within a <BillingProvider>. " +
        "Wrap your component tree with <BillingProvider> from @flexprice/billing/react.",
    );
  }
  return client;
}
