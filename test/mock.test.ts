import { describe, it, expect } from "vitest";
import {
  MockFlexpriceBilling,
  webhookFixtures,
} from "../src/testing/index.js";

describe("MockFlexpriceBilling", () => {
  it("returns configured plans", async () => {
    const billing = MockFlexpriceBilling({
      plans: [
        {
          id: "plan_001",
          name: "Pro",
          description: "Pro plan",
          lookupKey: "pro",
          prices: [
            {
              id: "price_001",
              amount: 29,
              currency: "USD",
              interval: "month",
              displayAmount: "$29.00",
            },
          ],
          features: [],
          metadata: {},
        },
      ],
    });

    const plans = await billing.getPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0]?.name).toBe("Pro");
  });

  it("resolves customers with actor data", async () => {
    const billing = MockFlexpriceBilling();
    const customer = await billing.resolveCustomer({
      externalId: "user_123",
      email: "user@test.com",
    });
    expect(customer.externalId).toBe("user_123");
    expect(customer.email).toBe("user@test.com");
  });

  it("checks entitlements from config", async () => {
    const billing = MockFlexpriceBilling({
      entitlements: { advanced_reports: true, api_calls: false },
    });

    expect(await billing.hasAccess("user_1", "advanced_reports")).toBe(true);
    expect(await billing.hasAccess("user_1", "api_calls")).toBe(false);
    expect(await billing.hasAccess("user_1", "unknown")).toBe(false);
  });

  it("tracks usage events", async () => {
    const billing = MockFlexpriceBilling();
    await billing.trackUsage({
      externalId: "user_1",
      eventName: "api_call",
      quantity: 1,
      idempotencyKey: "key_1",
    });
    // No error = success
  });

  it("returns usage data from config", async () => {
    const billing = MockFlexpriceBilling({
      usage: {
        api_calls: { currentUsage: 42, totalLimit: 100 },
        storage: { currentUsage: 0, totalLimit: 0, isUnlimited: true },
      },
    });

    const apiUsage = await billing.getFeatureUsage("user_1", "api_calls");
    expect(apiUsage.currentUsage).toBe(42);
    expect(apiUsage.totalLimit).toBe(100);
    expect(apiUsage.usagePercent).toBe(42);

    expect(await billing.isWithinLimit("user_1", "api_calls")).toBe(true);
    expect(await billing.isWithinLimit("user_1", "storage")).toBe(true);
  });

  it("returns checkout URL", async () => {
    const billing = MockFlexpriceBilling();
    const result = await billing.checkout(
      { externalId: "user_1" },
      { planId: "plan_pro" },
    );
    expect(result.url).toBe("/checkout/success");
    expect(result.subscriptionId).toBe("sub_mock_001");
  });

  it("throws configured checkout errors", async () => {
    const billing = MockFlexpriceBilling({
      checkoutError: new Error("Payment required"),
    });

    await expect(
      billing.checkout({ externalId: "user_1" }, { planId: "plan_pro" }),
    ).rejects.toThrow("Payment required");
  });
});

describe("webhookFixtures", () => {
  it("creates a valid webhook payload", () => {
    const fixture = webhookFixtures.create("subscription.created", {
      subscription: { id: "sub_001" },
    });

    expect(fixture.headers["svix-id"]).toBeTruthy();
    expect(fixture.headers["content-type"]).toBe("application/json");

    const body = JSON.parse(fixture.body);
    expect(body.event_type).toBe("subscription.created");
    expect(body.data.subscription.id).toBe("sub_001");
  });
});
