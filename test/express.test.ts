/**
 * Tests for the Express adapter.
 */
import { describe, it, expect } from "vitest";

describe("Express adapter exports", () => {
  it("exports FlexpriceBillingExpress", async () => {
    const mod = await import("../src/express/index.js");
    expect(typeof mod.FlexpriceBillingExpress).toBe("function");
  });
});
