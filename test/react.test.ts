/**
 * Tests for the React hooks module.
 * These are import-level tests — full rendering tests require jsdom or a test renderer.
 */
import { describe, it, expect } from "vitest";

describe("React module exports", () => {
  it("exports usePlans", async () => {
    const mod = await import("../src/react/use-plans.js");
    expect(typeof mod.usePlans).toBe("function");
  });

  it("exports useSubscriptions", async () => {
    const mod = await import("../src/react/use-subscriptions.js");
    expect(typeof mod.useSubscriptions).toBe("function");
  });

  it("exports useEntitlements and useHasFeature", async () => {
    const mod = await import("../src/react/use-entitlements.js");
    expect(typeof mod.useEntitlements).toBe("function");
    expect(typeof mod.useHasFeature).toBe("function");
  });

  it("exports useUsage", async () => {
    const mod = await import("../src/react/use-usage.js");
    expect(typeof mod.useUsage).toBe("function");
  });

  it("exports FeatureGate", async () => {
    const mod = await import("../src/react/feature-gate.jsx");
    expect(typeof mod.FeatureGate).toBe("function");
  });

  it("exports BillingProvider and useBillingClient", async () => {
    const mod = await import("../src/react/provider.jsx");
    expect(typeof mod.BillingProvider).toBe("function");
    expect(typeof mod.useBillingClient).toBe("function");
  });

  it("useAsync helper exports correctly", async () => {
    const mod = await import("../src/react/use-async.js");
    expect(typeof mod.useAsync).toBe("function");
  });
});
