/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { BillingProvider } from "../../src/react/provider.jsx";
import { FeatureGate } from "../../src/react/feature-gate.jsx";
import { TirdadClient } from "../../src/client/index.js";

describe("React Components", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  /**
   * Create a properly-typed TirdadClient with a fake fetch
   * that returns entitlement data for known feature keys.
   */
  const createMockClient = () => {
    const fakeFetch: typeof globalThis.fetch = async (input, _init) => {
      const url = typeof input === "string" ? input : (input as Request).url;

      // POST /entitlements/check
      if (url.includes("/entitlements/check")) {
        const body = _init?.body ? JSON.parse(_init.body as string) : {};
        const lookupKey = body.lookupKey ?? "";
        const isEnabled = lookupKey === "feature_yes";

        return new Response(
          JSON.stringify({
            isEnabled,
            feature: { lookupKey, type: "boolean", name: lookupKey },
            isSoftLimit: false,
            sources: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // Default: 404
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    };

    return new TirdadClient({
      basePath: "/api/billing",
      fetch: fakeFetch,
    });
  };

  const createWrapper = () => {
    const client = createMockClient();

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <BillingProvider client={client}>
          {children}
        </BillingProvider>
      </QueryClientProvider>
    );
  };

  describe("FeatureGate", () => {
    it("renders children when feature is enabled", async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <FeatureGate feature="feature_yes" fallback={<div data-testid="fallback" />}>
            <div data-testid="content">Enabled Content</div>
          </FeatureGate>
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("content")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("fallback")).not.toBeInTheDocument();
    });

    it("renders fallback when feature is disabled", async () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <FeatureGate feature="feature_no" fallback={<div data-testid="fallback">Fallback</div>}>
            <div data-testid="content" />
          </FeatureGate>
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId("fallback")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("content")).not.toBeInTheDocument();
    });
  });
});
