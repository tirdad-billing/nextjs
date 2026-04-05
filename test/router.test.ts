import { describe, it, expect } from "vitest";
import { matchRoute, getActiveRoutes } from "../src/router.js";

describe("matchRoute", () => {
  it("matches GET /api/billing/plans", () => {
    const result = matchRoute("GET", "/api/billing/plans");
    expect(result).toEqual({
      key: "plans",
      method: "GET",
      handler: "plans",
    });
  });

  it("matches POST /api/billing/checkout", () => {
    const result = matchRoute("POST", "/api/billing/checkout");
    expect(result).toEqual({
      key: "checkout",
      method: "POST",
      handler: "checkout",
    });
  });

  it("matches POST /api/billing/webhook", () => {
    const result = matchRoute("POST", "/api/billing/webhook");
    expect(result).toEqual({
      key: "webhook",
      method: "POST",
      handler: "webhook",
    });
  });

  it("matches POST /api/billing/entitlements/check", () => {
    const result = matchRoute("POST", "/api/billing/entitlements/check");
    expect(result).toEqual({
      key: "entitlements.check",
      method: "POST",
      handler: "entitlements.check",
    });
  });

  it("matches GET /api/billing/usage/summary", () => {
    const result = matchRoute("GET", "/api/billing/usage/summary");
    expect(result).toEqual({
      key: "usage.summary",
      method: "GET",
      handler: "usage.summary",
    });
  });

  it("returns null for unknown paths", () => {
    expect(matchRoute("GET", "/api/unknown")).toBeNull();
    expect(matchRoute("GET", "/other/path")).toBeNull();
  });

  it("returns null for wrong HTTP method", () => {
    expect(matchRoute("POST", "/api/billing/plans")).toBeNull();
    expect(matchRoute("GET", "/api/billing/checkout")).toBeNull();
  });

  it("respects custom basePath", () => {
    const result = matchRoute("GET", "/custom/path/plans", {
      basePath: "/custom/path",
    });
    expect(result).toEqual({
      key: "plans",
      method: "GET",
      handler: "plans",
    });

    // Default path should not match anymore
    expect(
      matchRoute("GET", "/api/billing/plans", {
        basePath: "/custom/path",
      }),
    ).toBeNull();
  });

  it("respects disabled routes", () => {
    const result = matchRoute("GET", "/api/billing/plans", {
      disable: ["plans"],
    });
    expect(result).toBeNull();
  });

  it("still matches non-disabled routes when some are disabled", () => {
    const result = matchRoute("POST", "/api/billing/checkout", {
      disable: ["plans", "webhook"],
    });
    expect(result).toEqual({
      key: "checkout",
      method: "POST",
      handler: "checkout",
    });
  });
});

describe("getActiveRoutes", () => {
  it("returns all 9 routes with defaults", () => {
    const routes = getActiveRoutes();
    expect(routes).toHaveLength(11);
    expect(routes[0]).toEqual({
      key: "plans",
      method: "GET",
      fullPath: "/api/billing/plans",
    });
  });

  it("excludes disabled routes", () => {
    const routes = getActiveRoutes({ disable: ["plans", "webhook"] });
    expect(routes).toHaveLength(9);
    expect(routes.find((r) => r.key === "plans")).toBeUndefined();
    expect(routes.find((r) => r.key === "webhook")).toBeUndefined();
  });

  it("respects custom basePath", () => {
    const routes = getActiveRoutes({ basePath: "/v1/billing" });
    expect(routes[0]?.fullPath).toBe("/v1/billing/plans");
  });
});
