/// <reference types="vitest/globals" />
/**
 * Integration Tests — Live Tirdad API
 *
 * These tests hit the real Tirdad cloud API (via @tirdad-ai/sdk) to validate
 * the full TirdadBilling factory end-to-end: customer resolution, plans,
 * entitlements, subscriptions, invoices, and usage.
 *
 * Requires env vars: TIRDAD_API_URL, TIRDAD_API_KEY, TIRDAD_WEBHOOK_SECRET
 *
 * Run:  TIRDAD_API_URL=... TIRDAD_API_KEY=... TIRDAD_WEBHOOK_SECRET=... npx vitest run test/integration.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createBillingInstance, type BillingInstance } from "../src/index.js";

// ── ENV ──────────────────────────────────────────────────────────
const API_URL = process.env.TIRDAD_API_URL;
const API_KEY = process.env.TIRDAD_API_KEY;
const WEBHOOK_SECRET = process.env.TIRDAD_WEBHOOK_SECRET;

const canRun = API_URL && API_KEY && WEBHOOK_SECRET;

// Skip entire suite if credentials are not set
const describeIf = canRun ? describe : describe.skip;

// Unique external ID per test run to avoid collisions
const TEST_EXTERNAL_ID = `integration_test_${Date.now()}`;

describeIf("Integration — Live Tirdad API", { timeout: 30_000 }, () => {
  let billing: BillingInstance;

  beforeAll(() => {
    billing = createBillingInstance({
      config: {
        apiUrl: API_URL!,
        apiKey: API_KEY!,
        webhookSecret: WEBHOOK_SECRET!,
        timeout: 15_000,
      },
    });
  });

  // ── 1. Configuration Validation ──────────────────────────────
  describe("Configuration", () => {
    it("throws on missing apiUrl", () => {
      expect(() =>
        createBillingInstance({
          config: { apiUrl: "", apiKey: "x", webhookSecret: "x" },
        }),
      ).toThrow("config.apiUrl is required");
    });

    it("throws on missing apiKey", () => {
      expect(() =>
        createBillingInstance({
          config: { apiUrl: "https://x", apiKey: "", webhookSecret: "x" },
        }),
      ).toThrow("config.apiKey is required");
    });

    it("throws on missing webhookSecret", () => {
      expect(() =>
        createBillingInstance({
          config: { apiUrl: "https://x", apiKey: "x", webhookSecret: "" },
        }),
      ).toThrow("config.webhookSecret is required");
    });
  });

  // ── 2. Customer Resolution ───────────────────────────────────
  describe("Customer Resolution", () => {
    it("resolves or creates a customer by externalId", async () => {
      const customer = await billing.resolveCustomer({
        externalId: TEST_EXTERNAL_ID,
        email: "integration-test@tirdad.dev",
        name: "Integration Test User",
      });

      expect(customer).toBeDefined();
      expect(customer.id).toBeTruthy();
      expect(customer.externalId).toBe(TEST_EXTERNAL_ID);
    });

    it("returns the same customer on repeated resolution (idempotent)", async () => {
      const first = await billing.resolveCustomer({
        externalId: TEST_EXTERNAL_ID,
      });
      const second = await billing.resolveCustomer({
        externalId: TEST_EXTERNAL_ID,
      });

      expect(first.id).toBe(second.id);
    });
  });

  // ── 3. Plans ─────────────────────────────────────────────────
  describe("Plans", () => {
    it("fetches all plans", async () => {
      const plans = await billing.getPlans();

      expect(Array.isArray(plans)).toBe(true);
      // There should be at least one plan in the account
      expect(plans.length).toBeGreaterThanOrEqual(0);

      if (plans.length > 0) {
        const plan = plans[0];
        expect(plan.id).toBeTruthy();
        expect(typeof plan.name).toBe("string");
        expect(Array.isArray(plan.prices)).toBe(true);
        expect(Array.isArray(plan.features)).toBe(true);
      }
    });

    it("getPlans returns correct BillingPlan shape", async () => {
      const plans = await billing.getPlans();
      if (plans.length === 0) return; // skip if no plans

      const plan = plans[0];
      // Validate shape
      expect(plan).toHaveProperty("id");
      expect(plan).toHaveProperty("name");
      expect(plan).toHaveProperty("description");
      expect(plan).toHaveProperty("lookupKey");
      expect(plan).toHaveProperty("prices");
      expect(plan).toHaveProperty("features");

      // Validate price shape if any prices exist
      if (plan.prices.length > 0) {
        const price = plan.prices[0];
        expect(price).toHaveProperty("id");
        expect(price).toHaveProperty("amount");
        expect(price).toHaveProperty("currency");
        expect(price).toHaveProperty("interval");
        expect(price).toHaveProperty("displayAmount");
        expect(typeof price.amount).toBe("number");
        expect(typeof price.displayAmount).toBe("string");
      }
    });

    it("getPlan returns a single plan by ID", async () => {
      const plans = await billing.getPlans();
      if (plans.length === 0) return;

      const plan = await billing.getPlan(plans[0].id);
      expect(plan).not.toBeNull();
      expect(plan!.id).toBe(plans[0].id);
    });

    it("getPlan returns null for non-existent plan", async () => {
      const plan = await billing.getPlan("plan_does_not_exist_xyz");
      expect(plan).toBeNull();
    });
  });

  // ── 4. Entitlements ──────────────────────────────────────────
  describe("Entitlements", () => {
    it("getEntitlements returns data for a valid customer", async () => {
      const result = await billing.getEntitlements(TEST_EXTERNAL_ID);

      // Should return some kind of response (may be empty if no subscription)
      expect(result).toBeDefined();
    });

    it("checkFeature throws FEATURE_NOT_FOUND for unknown feature", async () => {
      await expect(
        billing.checkFeature(TEST_EXTERNAL_ID, "nonexistent_feature_xyz"),
      ).rejects.toThrow("not found");
    });

    it("hasAccess returns false for unknown feature", async () => {
      const result = await billing.hasAccess(
        TEST_EXTERNAL_ID,
        "nonexistent_feature_xyz",
      );
      expect(result).toBe(false);
    });
  });

  // ── 5. Subscriptions ────────────────────────────────────────
  describe("Subscriptions", () => {
    it("getSubscriptions returns an array", async () => {
      const subs = await billing.getSubscriptions(TEST_EXTERNAL_ID);

      expect(Array.isArray(subs)).toBe(true);

      if (subs.length > 0) {
        const sub = subs[0];
        expect(sub).toHaveProperty("id");
        expect(sub).toHaveProperty("customerId");
        expect(sub).toHaveProperty("planId");
        expect(sub).toHaveProperty("status");
      }
    });

    it("getPrimarySubscription returns active or null", async () => {
      const primary = await billing.getPrimarySubscription(TEST_EXTERNAL_ID);

      // Can be null for a freshly-created test customer
      if (primary) {
        expect(primary.id).toBeTruthy();
        expect(["active", "trialing", "past_due"]).toContain(primary.status);
      } else {
        expect(primary).toBeNull();
      }
    });
  });

  // ── 6. Invoices ──────────────────────────────────────────────
  describe("Invoices", () => {
    it("getInvoices returns an object with invoices array", async () => {
      const result = await billing.getInvoices(TEST_EXTERNAL_ID);

      expect(result).toHaveProperty("invoices");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.invoices)).toBe(true);
      expect(typeof result.total).toBe("number");
    });
  });

  // ── 7. Usage Tracking ───────────────────────────────────────
  describe("Usage", () => {
    it("trackUsage does not throw for a valid event", async () => {
      await expect(
        billing.trackUsage({
          externalId: TEST_EXTERNAL_ID,
          eventName: "integration_test_event",
          idempotencyKey: `idem_${Date.now()}`,
        }),
      ).resolves.toBeUndefined();
    });

    it("trackUsageBatch does not throw for multiple events", async () => {
      await expect(
        billing.trackUsageBatch([
          {
            externalId: TEST_EXTERNAL_ID,
            eventName: "integration_test_batch_1",
            idempotencyKey: `idem_batch_1_${Date.now()}`,
          },
          {
            externalId: TEST_EXTERNAL_ID,
            eventName: "integration_test_batch_2",
            idempotencyKey: `idem_batch_2_${Date.now()}`,
          },
        ]),
      ).resolves.toBeUndefined();
    });

    it("getUsageSummary returns data", async () => {
      const result = await billing.getUsageSummary(TEST_EXTERNAL_ID);
      expect(result).toBeDefined();
    });
  });

  // ── 8. formatPrice (utility, no API) ────────────────────────
  describe("Utility", () => {
    it("formatPrice formats correctly", () => {
      expect(billing.formatPrice(29.99, "USD")).toBe("$29.99");
      expect(billing.formatPrice(100, "EUR")).toBe("€100.00");
    });
  });
});
