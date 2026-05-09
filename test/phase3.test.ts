/**
 * Tests for Phase 3 features via MockTirdadBilling.
 */
import { describe, it, expect } from "vitest";
import { MockTirdadBilling } from "../src/testing/index.js";

describe("Phase 3 — Invoices (mock)", () => {
  it("getInvoices returns empty array", async () => {
    const billing = MockTirdadBilling();
    const result = await billing.getInvoices("user_123");
    expect(result).toEqual({ invoices: [], total: 0 });
  });

  it("getInvoice returns null", async () => {
    const billing = MockTirdadBilling();
    const invoice = await billing.getInvoice("inv_123");
    expect(invoice).toBeNull();
  });

  it("getInvoicePdfUrl returns null", async () => {
    const billing = MockTirdadBilling();
    const url = await billing.getInvoicePdfUrl("inv_123");
    expect(url).toBeNull();
  });
});

describe("Phase 3 — Coupons (mock)", () => {
  it("validateCoupon returns null by default", async () => {
    const billing = MockTirdadBilling();
    const coupon = await billing.validateCoupon("SAVE20");
    expect(coupon).toBeNull();
  });
});

describe("Phase 3 — Plan Change (mock)", () => {
  it("previewPlanChange returns default preview", async () => {
    const billing = MockTirdadBilling();
    const preview = await billing.previewPlanChange("sub_1", "plan_pro");
    expect(preview.changeType).toBe("upgrade");
    expect(preview.warnings).toEqual([]);
  });

  it("changePlan does not throw", async () => {
    const billing = MockTirdadBilling();
    await expect(
      billing.changePlan("sub_1", "plan_pro"),
    ).resolves.toBeDefined();
  });
});

describe("Phase 3 — Batch Usage (mock)", () => {
  it("trackUsageBatch does not throw", async () => {
    const billing = MockTirdadBilling();
    await expect(
      billing.trackUsageBatch([
        {
          externalId: "user_1",
          eventName: "api_call",
          quantity: 1,
          idempotencyKey: "idem_1",
        },
        {
          externalId: "user_1",
          eventName: "api_call",
          quantity: 1,
          idempotencyKey: "idem_2",
        },
      ]),
    ).resolves.toBeUndefined();
  });
});

describe("Phase 3 — React exports", () => {
  it("exports useInvoices", async () => {
    const mod = await import("../src/react/use-invoices.js");
    expect(typeof mod.useInvoices).toBe("function");
  });
});
