import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { BillingProvider } from "../src/react/provider.jsx";
import { MockTirdadBilling } from "../src/testing/index.js";
import { usePlans } from "../src/react/use-plans.js";
import { useSubscriptions } from "../src/react/use-subscriptions.js";
import { useInvoices } from "../src/react/use-invoices.js";
import { useEntitlements, useHasFeature } from "../src/react/use-entitlements.js";
import { useUsage } from "../src/react/use-usage.js";

const TEST_CUSTOMER = "cust_test123";

describe("React Hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const createWrapper = () => {
    const mockClient = {
      getPlans: async () => [{ id: "plan_1", name: "Pro Plan", lookupKey: "pro", features: [], prices: [] }],
      getSubscriptions: async () => ({ subscriptions: [{ id: "sub_1", status: "active" }], total: 1 }),
      getInvoices: async () => ({ invoices: [{ id: "inv_1", totalAmount: 100 }], total: 1 }),
      getEntitlements: async () => ({ "feature_1": true, "feature_2": false }),
      checkFeature: async (lookupKey: string) => ({
        isEnabled: lookupKey === "feature_1",
        feature: { lookupKey, type: "boolean", name: lookupKey },
        isSoftLimit: false,
        sources: [],
      }),
      getUsageSummary: async () => ({ features: { "api_calls": { currentUsage: 50, totalLimit: 100 } } }),
    } as any;

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <BillingProvider client={mockClient}>
          {children}
        </BillingProvider>
      </QueryClientProvider>
    );
  };

  it("usePlans fetches and returns plans", async () => {
    const { result } = renderHook(() => usePlans(), { wrapper: createWrapper() });
    
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.plans).toHaveLength(1);
    expect(result.current.plans[0].name).toBe("Pro Plan");
  });

  it("useSubscriptions fetches and returns subscriptions", async () => {
    const { result } = renderHook(() => useSubscriptions(), { wrapper: createWrapper() });
    
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.subscriptions).toHaveLength(1);
    expect(result.current.subscriptions[0].id).toBe("sub_1");
  });

  it("useInvoices fetches and returns invoices", async () => {
    const { result } = renderHook(() => useInvoices(), { wrapper: createWrapper() });
    
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.invoices).toHaveLength(1);
    expect(result.current.invoices[0].id).toBe("inv_1");
  });

  it("useEntitlements fetches full entitlements", async () => {
    const { result } = renderHook(() => useEntitlements(), { wrapper: createWrapper() });
    
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.entitlements).toEqual({
      "feature_1": true,
      "feature_2": false,
    });
  });

  it("useHasFeature returns boolean for specific feature", async () => {
    const { result } = renderHook(() => useHasFeature("feature_1"), { wrapper: createWrapper() });
    
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.hasAccess).toBe(true);
  });

  it("useUsage fetches usage summary", async () => {
    const { result } = renderHook(() => useUsage(), { wrapper: createWrapper() });
    
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    
    expect(result.current.usage).toEqual({ features: { "api_calls": { currentUsage: 50, totalLimit: 100 } } });
  });
});
