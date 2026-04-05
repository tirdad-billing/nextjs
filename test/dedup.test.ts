import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemoryDedupStore } from "../src/dedup.js";

describe("InMemoryDedupStore", () => {
  let store: InMemoryDedupStore;

  beforeEach(() => {
    store = new InMemoryDedupStore(1000); // 1 second TTL for testing
  });

  afterEach(() => {
    store.destroy();
  });

  it("returns false for unseen message IDs", async () => {
    expect(await store.has("msg_1")).toBe(false);
  });

  it("returns true after setting a message ID", async () => {
    await store.set("msg_1");
    expect(await store.has("msg_1")).toBe(true);
  });

  it("tracks multiple message IDs independently", async () => {
    await store.set("msg_1");
    await store.set("msg_2");
    expect(await store.has("msg_1")).toBe(true);
    expect(await store.has("msg_2")).toBe(true);
    expect(await store.has("msg_3")).toBe(false);
  });

  it("expires entries after TTL", async () => {
    const shortStore = new InMemoryDedupStore(50); // 50ms TTL
    await shortStore.set("msg_1");
    expect(await shortStore.has("msg_1")).toBe(true);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(await shortStore.has("msg_1")).toBe(false);
    shortStore.destroy();
  });

  it("reports correct size", async () => {
    expect(store.size).toBe(0);
    await store.set("msg_1");
    await store.set("msg_2");
    expect(store.size).toBe(2);
  });
});
