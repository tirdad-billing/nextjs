/**
 * Field-mapping tests against recorded @tirdad-ai/sdk response shapes.
 *
 * These exercise the REAL helper code (not MockTirdadBilling), feeding each
 * helper a fake `sdk` whose methods return camelCase payloads matching the
 * @tirdad-ai/sdk models. This is the layer the mock-only suite never covered —
 * and where the original snake_case field bugs lived. If a mapper reads the
 * wrong field name, these fail.
 */
import { describe, it, expect } from "vitest";
import type { Tirdad } from "@tirdad-ai/sdk";
import { getFeatureUsage, isWithinLimit } from "../src/usage.js";
import { validateCoupon } from "../src/coupons.js";
import { getSubscriptions } from "../src/subscriptions.js";
import { checkFeature, hasAccess } from "../src/entitlements.js";
import { getPlans } from "../src/plans.js";

/** Build a fake Tirdad SDK from a sparse spec of resource→method→return value. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeSdk(spec: Record<string, Record<string, any>>): Tirdad {
  const sdk: Record<string, unknown> = {};
  for (const [resource, methods] of Object.entries(spec)) {
    const impl: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(methods)) {
      impl[name] =
        typeof value === "function" ? value : async () => value;
    }
    sdk[resource] = impl;
  }
  return sdk as unknown as Tirdad;
}

describe("usage mapping (FeatureUsageSummary is camelCase)", () => {
  const summary = {
    customerId: "cust_1",
    features: [
      {
        feature: { lookupKey: "api_calls", name: "API Calls" },
        currentUsage: "5", // SDK sends numeric strings
        totalLimit: 10,
        usagePercent: "50",
        isEnabled: true,
        isSoftLimit: false,
        isUnlimited: false,
        nextUsageResetAt: "2026-07-01T00:00:00Z",
      },
    ],
  };

  it("reads camelCase fields and coerces numeric strings", async () => {
    const sdk = fakeSdk({ customers: { getCustomerUsageSummary: summary } });
    const usage = await getFeatureUsage(sdk, "cust_1", "api_calls");
    expect(usage.currentUsage).toBe(5);
    expect(usage.totalLimit).toBe(10);
    expect(usage.usagePercent).toBe(50);
    expect(usage.isEnabled).toBe(true);
    expect(usage.nextResetAt).toBe("2026-07-01T00:00:00Z");
    expect(usage.feature.lookupKey).toBe("api_calls");
  });

  it("isWithinLimit returns true when under the limit (regression: was always false)", async () => {
    const sdk = fakeSdk({ customers: { getCustomerUsageSummary: summary } });
    await expect(isWithinLimit(sdk, "cust_1", "api_calls")).resolves.toBe(true);
  });

  it("isWithinLimit returns false when at/over the limit", async () => {
    const atLimit = {
      features: [
        {
          feature: { lookupKey: "api_calls" },
          currentUsage: "10",
          totalLimit: 10,
          isSoftLimit: false,
          isUnlimited: false,
        },
      ],
    };
    const sdk = fakeSdk({ customers: { getCustomerUsageSummary: atLimit } });
    await expect(isWithinLimit(sdk, "cust_1", "api_calls")).resolves.toBe(false);
  });

  it("unlimited features are always within limit", async () => {
    const unlimited = {
      features: [
        {
          feature: { lookupKey: "api_calls" },
          currentUsage: "9999",
          totalLimit: 0,
          isUnlimited: true,
        },
      ],
    };
    const sdk = fakeSdk({ customers: { getCustomerUsageSummary: unlimited } });
    await expect(isWithinLimit(sdk, "cust_1", "api_calls")).resolves.toBe(true);
  });
});

describe("coupon mapping (CouponResponse: amountOff/percentageOff/type/status)", () => {
  const published = {
    id: "coupon_1",
    name: "SAVE20",
    type: "percentage",
    percentageOff: "20",
    amountOff: undefined,
    currency: "USD",
    status: "published",
    totalRedemptions: 3,
    maxRedemptions: 100,
    redeemBefore: "2999-01-01T00:00:00Z",
    redeemAfter: "2020-01-01T00:00:00Z",
  };

  it("maps a published percentage coupon to the right discount value/type", async () => {
    const sdk = fakeSdk({ coupons: { getCoupon: published } });
    const coupon = await validateCoupon(sdk, "coupon_1");
    expect(coupon).not.toBeNull();
    expect(coupon!.discountType).toBe("percentage");
    expect(coupon!.discountValue).toBe(20); // regression: was always 0
    expect(coupon!.isActive).toBe(true);
    expect(coupon!.timesRedeemed).toBe(3);
    expect(coupon!.validUntil).toBe("2999-01-01T00:00:00Z");
  });

  it("maps a fixed coupon's amountOff", async () => {
    const fixed = { ...published, type: "fixed", amountOff: "15", percentageOff: undefined };
    const sdk = fakeSdk({ coupons: { getCoupon: fixed } });
    const coupon = await validateCoupon(sdk, "coupon_1");
    expect(coupon!.discountType).toBe("fixed");
    expect(coupon!.discountValue).toBe(15);
  });

  it("rejects an archived coupon (status !== published)", async () => {
    const sdk = fakeSdk({ coupons: { getCoupon: { ...published, status: "archived" } } });
    await expect(validateCoupon(sdk, "coupon_1")).resolves.toBeNull();
  });

  it("rejects an expired coupon (redeemBefore in the past)", async () => {
    const expired = { ...published, redeemBefore: "2000-01-01T00:00:00Z" };
    const sdk = fakeSdk({ coupons: { getCoupon: expired } });
    await expect(validateCoupon(sdk, "coupon_1")).resolves.toBeNull();
  });

  it("rejects a coupon that hit its redemption cap", async () => {
    const maxed = { ...published, totalRedemptions: 100, maxRedemptions: 100 };
    const sdk = fakeSdk({ coupons: { getCoupon: maxed } });
    await expect(validateCoupon(sdk, "coupon_1")).resolves.toBeNull();
  });
});

describe("subscription mapping (querySubscription → items)", () => {
  it("maps items and resolves status", async () => {
    const sdk = fakeSdk({
      subscriptions: {
        querySubscription: {
          items: [
            {
              id: "sub_1",
              customerId: "cust_1",
              planId: "plan_pro",
              subscriptionStatus: "active",
              currentPeriodStart: "2026-06-01",
              currentPeriodEnd: "2026-07-01",
            },
          ],
        },
      },
    });
    const subs = await getSubscriptions(sdk, "cust_1");
    expect(Array.isArray(subs)).toBe(true);
    expect(subs).toHaveLength(1);
    expect(subs[0].id).toBe("sub_1");
    expect(subs[0].planId).toBe("plan_pro");
    expect(subs[0].status).toBe("active");
  });
});

describe("entitlement mapping (CustomerEntitlementsResponse → features[])", () => {
  const response = {
    customerId: "cust_1",
    features: [
      {
        feature: { lookupKey: "advanced_reports", name: "Advanced Reports", type: "boolean" },
        entitlement: { isEnabled: true },
        sources: [{ entityType: "plan", entityName: "Pro" }],
      },
    ],
  };

  it("checkFeature reads the aggregated feature/entitlement shape", async () => {
    const sdk = fakeSdk({ customers: { getCustomerEntitlements: response } });
    const result = await checkFeature(sdk, "cust_1", "advanced_reports");
    expect(result.isEnabled).toBe(true);
    expect(result.feature.lookupKey).toBe("advanced_reports");
    expect(result.sources[0].entityName).toBe("Pro");
  });

  it("hasAccess returns false for an unknown feature", async () => {
    const sdk = fakeSdk({ customers: { getCustomerEntitlements: response } });
    await expect(hasAccess(sdk, "cust_1", "nope")).resolves.toBe(false);
  });
});

describe("plan mapping (queryPlan → items, prices)", () => {
  it("maps plans and their prices", async () => {
    const sdk = fakeSdk({
      plans: {
        queryPlan: {
          items: [
            {
              id: "plan_pro",
              name: "Pro",
              lookupKey: "pro",
              prices: [{ id: "price_1", amount: "29.00", currency: "USD", billingPeriod: "MONTHLY" }],
            },
          ],
        },
      },
    });
    const plans = await getPlans(sdk, { currency: "USD" });
    expect(plans).toHaveLength(1);
    expect(plans[0].lookupKey).toBe("pro");
    expect(plans[0].prices[0].amount).toBe(29);
    expect(plans[0].prices[0].currency).toBe("USD");
    expect(plans[0].prices[0].displayAmount).toContain("29");
  });
});
