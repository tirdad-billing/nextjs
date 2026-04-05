/**
 * Tests for the Express adapter.
 */
import { describe, it, expect } from "vitest";

describe("Express adapter exports", () => {
  it("exports TirdadBillingExpress", async () => {
    const mod = await import("../src/express/index.js");
    expect(typeof mod.TirdadBillingExpress).toBe("function");
  });
});
