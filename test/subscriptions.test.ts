/**
 * Tests for the subscriptions module.
 */
import { describe, it, expect } from "vitest";
import { MockTirdadBilling } from "../src/testing/index.js";

describe("Subscriptions (via MockTirdadBilling)", () => {
  it("getSubscriptions returns empty array by default", async () => {
    const billing = MockTirdadBilling();
    const subs = await billing.getSubscriptions("user_123");
    // Real getSubscriptions returns a bare array; the mock must match.
    expect(subs).toEqual([]);
  });

  it("getSubscriptions returns the seeded subscriptions as an array", async () => {
    const seeded = [{ id: "sub_1" }, { id: "sub_2" }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const billing = MockTirdadBilling({ subscriptions: seeded as any });
    const subs = await billing.getSubscriptions("user_123");
    expect(Array.isArray(subs)).toBe(true);
    expect(subs).toHaveLength(2);
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


});
