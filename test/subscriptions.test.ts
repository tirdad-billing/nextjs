/**
 * Tests for the subscriptions module.
 */
import { describe, it, expect } from "vitest";
import { MockTirdadBilling } from "../src/testing/index.js";

describe("Subscriptions (via MockTirdadBilling)", () => {
  it("getSubscriptions returns empty array by default", async () => {
    const billing = MockTirdadBilling();
    const subs = await billing.getSubscriptions("user_123");
    expect(subs).toEqual([]);
  });

  it("getPrimarySubscription returns null by default", async () => {
    const billing = MockTirdadBilling();
    const primary = await billing.getPrimarySubscription("user_123");
    expect(primary).toBeNull();
  });

  it("cancelSubscription does not throw", async () => {
    const billing = MockTirdadBilling();
    await expect(
      billing.cancelSubscription("sub_123"),
    ).resolves.toBeUndefined();
  });

  it("pauseSubscription does not throw", async () => {
    const billing = MockTirdadBilling();
    await expect(
      billing.pauseSubscription("sub_123"),
    ).resolves.toBeUndefined();
  });

  it("resumeSubscription does not throw", async () => {
    const billing = MockTirdadBilling();
    await expect(
      billing.resumeSubscription("sub_123"),
    ).resolves.toBeUndefined();
  });
});
