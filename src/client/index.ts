/**
 * @tirdad/billing/client — Browser-safe Client SDK
 *
 * Typed fetch wrappers for calling billing API routes from the browser.
 * No server-side dependencies (no @tirdad-ai/sdk, no svix).
 */

import { TirdadClientError } from "../errors.js";
import type {
  BillingPlan,
  EntitlementCheckResult,
  BillingSubscription,
} from "../types.js";

export interface TirdadClientOptions {
  /** Base URL for billing API routes. Default: "/api/billing" */
  basePath?: string;
  /** Custom fetch function (for testing or SSR). */
  fetch?: typeof globalThis.fetch;
  /** Custom headers to include in every request. */
  headers?: Record<string, string>;
}

/**
 * Browser-safe client for calling billing API routes.
 */
export class TirdadClient {
  private basePath: string;
  private fetchFn: typeof globalThis.fetch;
  private headers: Record<string, string>;

  constructor(options?: TirdadClientOptions) {
    this.basePath = options?.basePath ?? "/api/billing";
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis);
    this.headers = options?.headers ?? {};
  }

  // ── Plans ─────────────────────────────────

  async getPlans(options?: {
    currency?: string;
    lookupKey?: string;
  }): Promise<BillingPlan[]> {
    const params = new URLSearchParams();
    if (options?.currency) params.set("currency", options.currency);
    if (options?.lookupKey) params.set("lookupKey", options.lookupKey);

    const qs = params.toString();
    const url = `${this.basePath}/plans${qs ? `?${qs}` : ""}`;
    const data = await this.get<{ plans: BillingPlan[] }>(url);
    return data.plans;
  }

  // ── Checkout ──────────────────────────────

  async checkout(params: {
    planId: string;
    couponCode?: string;
    currency?: string;
  }): Promise<{ url: string; subscriptionId?: string }> {
    return this.post(`${this.basePath}/checkout`, params);
  }

  // ── Portal ────────────────────────────────

  async getPortalUrl(): Promise<{ url: string }> {
    return this.post(`${this.basePath}/portal`, {});
  }

  // ── Subscriptions ─────────────────────────

  async getSubscriptions(): Promise<{ subscriptions: BillingSubscription[] }> {
    return this.get(`${this.basePath}/subscriptions`);
  }

  // ── Entitlements ──────────────────────────

  async getEntitlements(): Promise<unknown> {
    return this.get(`${this.basePath}/entitlements`);
  }

  async checkFeature(lookupKey: string): Promise<EntitlementCheckResult> {
    return this.post(`${this.basePath}/entitlements/check`, { lookupKey });
  }

  // ── Usage ─────────────────────────────────

  async trackUsage(params: {
    eventName: string;
    quantity?: number;
    idempotencyKey: string;
    properties?: Record<string, string>;
  }): Promise<void> {
    await this.post(`${this.basePath}/usage`, params);
  }

  async getUsageSummary(): Promise<unknown> {
    return this.get(`${this.basePath}/usage/summary`);
  }

  // ── Invoices ──────────────────────────────

  async getInvoices(options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ invoices: unknown[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const qs = params.toString();
    const url = `${this.basePath}/invoices${qs ? `?${qs}` : ""}`;
    return this.get(url);
  }

  // ── Coupons ───────────────────────────────

  async validateCoupon(code: string): Promise<unknown> {
    return this.post(`${this.basePath}/coupons/validate`, { code });
  }

  // ── Internal HTTP Methods ─────────────────

  private async get<T>(url: string): Promise<T> {
    const res = await this.fetchFn(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      credentials: "include",
    });

    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = (await res.json().catch(() => ({}))) as Record<string, any>;
      throw new TirdadClientError(
        res.status,
        body.error ?? res.statusText,
        body.code,
      );
    }

    return res.json() as Promise<T>;
  }

  private async post<T>(url: string, body: unknown): Promise<T> {
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await res.json().catch(() => ({}))) as Record<string, any>;
      throw new TirdadClientError(
        res.status,
        data.error ?? res.statusText,
        data.code,
      );
    }

    return res.json() as Promise<T>;
  }
}
