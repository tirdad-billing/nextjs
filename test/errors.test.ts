import { describe, it, expect } from "vitest";
import { BillingCoreError, FlexpriceClientError } from "../src/errors.js";

describe("BillingCoreError", () => {
  it("creates error with correct properties", () => {
    const err = new BillingCoreError("UNAUTHENTICATED", "Not logged in");
    expect(err.name).toBe("BillingCoreError");
    expect(err.code).toBe("UNAUTHENTICATED");
    expect(err.message).toBe("Not logged in");
    expect(err.statusCode).toBe(401);
  });

  it("maps error codes to correct HTTP status codes", () => {
    const cases: Array<[string, number]> = [
      ["UNAUTHENTICATED", 401],
      ["CUSTOMER_NOT_FOUND", 404],
      ["CUSTOMER_CREATION_FAILED", 500],
      ["CUSTOMER_RESOLUTION_AMBIGUOUS", 409],
      ["WEBHOOK_SIGNATURE_INVALID", 400],
      ["CONFIGURATION_ERROR", 500],
      ["FEATURE_NOT_FOUND", 404],
      ["IDEMPOTENCY_KEY_REQUIRED", 400],
      ["TIMEOUT", 504],
    ];

    for (const [code, expectedStatus] of cases) {
      const err = new BillingCoreError(code as any, "test");
      expect(err.statusCode).toBe(expectedStatus);
    }
  });

  it("allows custom statusCode override", () => {
    const err = new BillingCoreError("UNAUTHENTICATED", "test", {
      statusCode: 403,
    });
    expect(err.statusCode).toBe(403);
  });

  it("preserves correlationId", () => {
    const err = new BillingCoreError("UNAUTHENTICATED", "test", {
      correlationId: "req_123",
    });
    expect(err.correlationId).toBe("req_123");
  });

  it("preserves cause", () => {
    const cause = new Error("original");
    const err = new BillingCoreError("CUSTOMER_CREATION_FAILED", "test", {
      cause,
    });
    expect(err.cause).toBe(cause);
  });

  it("is instanceof Error", () => {
    const err = new BillingCoreError("UNAUTHENTICATED", "test");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof BillingCoreError).toBe(true);
  });
});

describe("FlexpriceClientError", () => {
  it("creates error with correct properties", () => {
    const err = new FlexpriceClientError(404, "Not found", "PLAN_NOT_FOUND");
    expect(err.name).toBe("FlexpriceClientError");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err.code).toBe("PLAN_NOT_FOUND");
  });

  it("is instanceof Error", () => {
    const err = new FlexpriceClientError(500, "test");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof FlexpriceClientError).toBe(true);
  });
});
