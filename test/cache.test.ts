/**
 * Tests for EntitlementCache.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EntitlementCache } from "../src/cache.js";

describe("EntitlementCache", () => {
  let cache: EntitlementCache;

  beforeEach(() => {
    cache = new EntitlementCache({ ttlMs: 100, maxEntries: 3 });
  });

  it("returns null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("stores and retrieves values", () => {
    cache.set("key1", { foo: "bar" });
    expect(cache.get("key1")).toEqual({ foo: "bar" });
  });

  it("expires entries after TTL", async () => {
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 150));
    expect(cache.get("key1")).toBeNull();
  });

  it("evicts oldest entry when maxEntries is reached", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.size).toBe(3);

    // Add a 4th entry — should evict "a"
    cache.set("d", 4);
    expect(cache.size).toBe(3);
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("d")).toBe(4);
  });

  it("invalidates a specific key", () => {
    cache.set("key1", "value1");
    cache.set("key2", "value2");
    cache.invalidate("key1");
    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBe("value2");
  });

  it("invalidates all entries for a customer", () => {
    cache.set("cust_1:feature_a", true);
    cache.set("cust_1:feature_b", false);
    cache.set("cust_2:feature_a", true);

    cache.invalidateCustomer("cust_1");
    expect(cache.get("cust_1:feature_a")).toBeNull();
    expect(cache.get("cust_1:feature_b")).toBeNull();
    expect(cache.get("cust_2:feature_a")).toBe(true);
  });

  it("clears all entries", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeNull();
  });

  it("generates correct cache keys", () => {
    expect(EntitlementCache.key("cust_1", "api_calls")).toBe(
      "cust_1:api_calls",
    );
    expect(EntitlementCache.allEntitlementsKey("cust_1")).toBe(
      "cust_1:__all__",
    );
  });

  it("uses default config values", () => {
    const defaultCache = new EntitlementCache();
    defaultCache.set("key", "value");
    expect(defaultCache.get("key")).toBe("value");
  });
});
