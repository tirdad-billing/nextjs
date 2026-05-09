/**
 * @tirdad/billing — Main Entry Point
 *
 * TirdadBilling factory: the ONE function that configures everything.
 * Re-exports all types and the SDK for escape hatches.
 */

import { Flexprice } from "@flexprice/sdk";
import type {
  TirdadBillingConfig,
  BillingActor,
  BillingPlan,
  BillingSubscription,
  EntitlementCheckResult,
  FeatureUsageResult,
  TrackUsageParams,
  CheckoutParams,
  MinimalLogger,
} from "./types.js";
import { BillingCoreError } from "./errors.js";
import { resolveCustomer, type ResolvedCustomer } from "./auth.js";
import { createWebhookHandler } from "./webhooks.js";
import { getPlans, getPlan, type GetPlansOptions } from "./plans.js";
import { formatPrice } from "./currency.js";
import {
  getEntitlements,
  checkFeature,
  hasAccess,
} from "./entitlements.js";
import {
  trackUsage,
  getUsageSummary,
  getFeatureUsage,
  isWithinLimit,
} from "./usage.js";
import {
  getSubscriptions as getSubscriptionsHelper,
  getPrimarySubscription,
  cancelSubscription as cancelSubscriptionHelper,
} from "./subscriptions.js";
import {
  getInvoices as getInvoicesHelper,
  getInvoice as getInvoiceHelper,
  getInvoicePdfUrl as getInvoicePdfUrlHelper,
  type BillingInvoice,
} from "./invoices.js";
import {
  validateCoupon as validateCouponHelper,
  type BillingCoupon,
} from "./coupons.js";
import {
  previewPlanChange as previewPlanChangeHelper,
  changePlan as changePlanHelper,
  type PlanChangePreview,
} from "./plan-change.js";
import { EntitlementCache } from "./cache.js";


/** The billing instance returned by TirdadBilling(). */
export interface BillingInstance {
  /** The underlying @flexprice/sdk client (escape hatch). */
  sdk: Flexprice;

  // ── Customer Resolution ───────────────────
  /** Resolve a BillingActor to a Tirdad customer. */
  resolveCustomer(actor: BillingActor): Promise<ResolvedCustomer>;

  // ── Plans ─────────────────────────────────
  /** Get all plans (for pricing pages). */
  getPlans(options?: GetPlansOptions): Promise<BillingPlan[]>;
  /** Get a single plan by ID or lookup key. */
  getPlan(idOrLookupKey: string): Promise<BillingPlan | null>;
  /** Format a price for display. */
  formatPrice(amount: number, currency: string, locale?: string): string;

  // ── Entitlements ──────────────────────────
  /** Get all entitlements for a customer by externalId. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEntitlements(externalId: string): Promise<any>;
  /** Check a specific feature's entitlement. */
  checkFeature(
    externalId: string,
    lookupKey: string,
  ): Promise<EntitlementCheckResult>;
  /** Simple boolean: does the user have access to this feature? */
  hasAccess(externalId: string, lookupKey: string): Promise<boolean>;

  // ── Usage ─────────────────────────────────
  /** Track a usage event. */
  trackUsage(params: TrackUsageParams): Promise<void>;
  /** Get the full usage summary for a customer. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getUsageSummary(externalId: string): Promise<any>;
  /** Get real-time usage for a single feature. */
  getFeatureUsage(
    externalId: string,
    lookupKey: string,
  ): Promise<FeatureUsageResult>;
  /** Is the customer within their usage limit? */
  isWithinLimit(externalId: string, lookupKey: string): Promise<boolean>;

  // ── Checkout ──────────────────────────────
  /** Create a checkout session. */
  checkout(
    actor: BillingActor,
    params: CheckoutParams,
  ): Promise<{ url: string; subscriptionId?: string }>;

  // ── Subscriptions ─────────────────────────
  /** Get all subscriptions for a customer. */
  getSubscriptions(externalId: string): Promise<BillingSubscription[]>;
  /** Get the primary (active) subscription. */
  getPrimarySubscription(externalId: string): Promise<BillingSubscription | null>;
  cancelSubscription(
    subscriptionId: string,
    options?: { cancelAtPeriodEnd?: boolean },
  ): Promise<void>;

  // ── Invoices ──────────────────────────────
  /** Get invoices for a customer. */
  getInvoices(
    externalId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ invoices: BillingInvoice[]; total: number }>;
  /** Get a single invoice by ID. */
  getInvoice(invoiceId: string): Promise<BillingInvoice | null>;
  /** Get invoice PDF download URL. */
  getInvoicePdfUrl(invoiceId: string): Promise<string | null>;

  // ── Coupons ───────────────────────────────
  /** Validate a coupon code. Returns null if invalid/expired. */
  validateCoupon(codeOrId: string): Promise<BillingCoupon | null>;

  // ── Plan Change ───────────────────────────
  /** Preview a plan change (proration details). */
  previewPlanChange(
    subscriptionId: string,
    targetPlanId: string,
    options?: { billingCadence?: string; billingPeriod?: string; prorationBehavior?: string },
  ): Promise<PlanChangePreview>;
  /** Execute a plan change. */
  changePlan(
    subscriptionId: string,
    targetPlanId: string,
    options?: { billingCadence?: string; billingPeriod?: string; prorationBehavior?: string },
  ): Promise<unknown>;

  // ── Batch Usage ───────────────────────────
  /** Track multiple usage events at once. */
  trackUsageBatch(events: TrackUsageParams[]): Promise<void>;

  // ── Webhook ───────────────────────────────
  /** Handle an incoming webhook request (internal use by adapters). */
  handleWebhook(
    body: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: string }>;

  // ── Internal ──────────────────────────────
  /** The full configuration. */
  config: TirdadBillingConfig;
}

/**
 * Create a configured billing instance.
 *
 * This is the core factory — framework adapters (Next.js, Express) wrap this
 * to add route handling.
 */
export function createBillingInstance(
  billingConfig: TirdadBillingConfig,
): BillingInstance {
  const { config } = billingConfig;
  const logger: MinimalLogger = billingConfig.observability?.logger ?? console;

  // Validate required configuration
  if (!config.apiUrl) {
    throw new BillingCoreError(
      "CONFIGURATION_ERROR",
      "config.apiUrl is required",
    );
  }
  if (!config.apiKey) {
    throw new BillingCoreError(
      "CONFIGURATION_ERROR",
      "config.apiKey is required",
    );
  }
  if (!config.webhookSecret) {
    throw new BillingCoreError(
      "CONFIGURATION_ERROR",
      "config.webhookSecret is required",
    );
  }

  // Initialize the SDK client
  const sdk = new Flexprice({
    serverURL: config.apiUrl,
    apiKeyAuth: config.apiKey,
    timeoutMs: config.timeout ?? 10_000,
  });

  // Initialize webhook handler
  const handleWebhook = createWebhookHandler({
    secret: config.webhookSecret,
    callbacks: billingConfig.on,
    webhookConfig: billingConfig.webhooks,
    logger,
    onWebhook: billingConfig.observability?.onWebhook,
  });

  // Customer ID cache: externalId → Tirdad customerId
  const customerIdCache = new Map<string, string>();

  // Entitlement cache (optional)
  const entitlementCacheConfig = billingConfig.entitlementCache;
  const entitlementCache = entitlementCacheConfig
    ? new EntitlementCache(
        typeof entitlementCacheConfig === "object" ? entitlementCacheConfig : undefined,
      )
    : null;

  /**
   * Resolve externalId to Tirdad customerId, with caching.
   */
  async function resolveCustomerId(externalId: string): Promise<string> {
    const cached = customerIdCache.get(externalId);
    if (cached) return cached;

    const customer = await resolveCustomer(sdk, { externalId }, logger);
    customerIdCache.set(externalId, customer.id);
    return customer.id;
  }

  const instance: BillingInstance = {
    sdk,
    config: billingConfig,

    // ── Customer Resolution ───────────────────
    async resolveCustomer(actor: BillingActor): Promise<ResolvedCustomer> {
      const customer = await resolveCustomer(sdk, actor, logger);
      customerIdCache.set(actor.externalId, customer.id);
      return customer;
    },

    // ── Plans ─────────────────────────────────
    async getPlans(options?: GetPlansOptions): Promise<BillingPlan[]> {
      return getPlans(sdk, options);
    },

    async getPlan(idOrLookupKey: string): Promise<BillingPlan | null> {
      return getPlan(sdk, idOrLookupKey);
    },

    formatPrice(amount: number, currency: string, locale?: string): string {
      return formatPrice(amount, currency, locale);
    },

    // ── Entitlements ──────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getEntitlements(externalId: string): Promise<any> {
      const customerId = await resolveCustomerId(externalId);

      if (entitlementCache) {
        const cacheKey = EntitlementCache.allEntitlementsKey(customerId);
        const cached = entitlementCache.get(cacheKey);
        if (cached) return cached;
        const result = await getEntitlements(sdk, customerId);
        entitlementCache.set(cacheKey, result);
        return result;
      }

      return getEntitlements(sdk, customerId);
    },

    async checkFeature(
      externalId: string,
      lookupKey: string,
    ): Promise<EntitlementCheckResult> {
      const customerId = await resolveCustomerId(externalId);

      if (entitlementCache) {
        const cacheKey = EntitlementCache.key(customerId, lookupKey);
        const cached = entitlementCache.get<EntitlementCheckResult>(cacheKey);
        if (cached) return cached;
        const result = await checkFeature(sdk, customerId, lookupKey);
        entitlementCache.set(cacheKey, result);
        return result;
      }

      return checkFeature(sdk, customerId, lookupKey);
    },

    async hasAccess(
      externalId: string,
      lookupKey: string,
    ): Promise<boolean> {
      const customerId = await resolveCustomerId(externalId);

      if (entitlementCache) {
        const cacheKey = EntitlementCache.key(customerId, `access:${lookupKey}`);
        const cached = entitlementCache.get<boolean>(cacheKey);
        if (cached !== null) return cached;
        const result = await hasAccess(sdk, customerId, lookupKey);
        entitlementCache.set(cacheKey, result);
        return result;
      }

      return hasAccess(sdk, customerId, lookupKey);
    },

    // ── Usage ─────────────────────────────────
    async trackUsage(params: TrackUsageParams): Promise<void> {
      const customerId = await resolveCustomerId(params.externalId);
      return trackUsage(sdk, customerId, params);
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getUsageSummary(externalId: string): Promise<any> {
      const customerId = await resolveCustomerId(externalId);
      return getUsageSummary(sdk, customerId);
    },

    async getFeatureUsage(
      externalId: string,
      lookupKey: string,
    ): Promise<FeatureUsageResult> {
      const customerId = await resolveCustomerId(externalId);
      return getFeatureUsage(sdk, customerId, lookupKey);
    },

    async isWithinLimit(
      externalId: string,
      lookupKey: string,
    ): Promise<boolean> {
      const customerId = await resolveCustomerId(externalId);
      return isWithinLimit(sdk, customerId, lookupKey);
    },

    // ── Checkout ──────────────────────────────
    async checkout(
      actor: BillingActor,
      params: CheckoutParams,
    ): Promise<{ url: string; subscriptionId?: string }> {
      const customer = await instance.resolveCustomer(actor);

      // Resolve the actual currency from the plan's prices if not explicitly provided
      let currency = params.currency;
      if (!currency) {
        const plan = await getPlan(sdk, params.planId);
        currency = plan?.prices?.[0]?.currency ?? "USD";
        logger.info(`[billing] Resolved currency=${currency} from plan ${params.planId}`);
      }

      // Create subscription via SDK
      const sub = await sdk.subscriptions.createSubscription({
        customerId: customer.id,
        planId: params.planId,
        currency,
        billingCadence: "RECURRING",
        billingPeriod: "MONTHLY",
        ...(params.couponCode ? { coupons: [params.couponCode] } : {}),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subResponse = sub as any;

      // Return checkout URL if present, otherwise subscription ID
      const checkoutUrl =
        subResponse.checkout_url ??
        subResponse.checkoutUrl ??
        subResponse.payment_link ??
        billingConfig.checkout?.successUrl ??
        "/";

      return {
        url: checkoutUrl,
        subscriptionId: subResponse.id ?? subResponse.subscription_id,
      };
    },

    // ── Subscriptions ─────────────────────────
    async getSubscriptions(externalId: string): Promise<BillingSubscription[]> {
      const customerId = await resolveCustomerId(externalId);
      return getSubscriptionsHelper(sdk, customerId);
    },

    async getPrimarySubscription(
      externalId: string,
    ): Promise<BillingSubscription | null> {
      const customerId = await resolveCustomerId(externalId);
      return getPrimarySubscription(sdk, customerId);
    },

    async cancelSubscription(
      subscriptionId: string,
      options?: { cancelAtPeriodEnd?: boolean },
    ): Promise<void> {
      return cancelSubscriptionHelper(sdk, subscriptionId, options);
    },

    // ── Invoices ──────────────────────────────
    async getInvoices(
      externalId: string,
      options?: { limit?: number; offset?: number },
    ): Promise<{ invoices: BillingInvoice[]; total: number }> {
      const customerId = await resolveCustomerId(externalId);
      return getInvoicesHelper(sdk, customerId, options);
    },

    async getInvoice(invoiceId: string): Promise<BillingInvoice | null> {
      return getInvoiceHelper(sdk, invoiceId);
    },

    async getInvoicePdfUrl(invoiceId: string): Promise<string | null> {
      return getInvoicePdfUrlHelper(sdk, invoiceId);
    },

    // ── Coupons ───────────────────────────────
    async validateCoupon(codeOrId: string): Promise<BillingCoupon | null> {
      return validateCouponHelper(sdk, codeOrId);
    },

    // ── Plan Change ──────────────────────────
    async previewPlanChange(
      subscriptionId: string,
      targetPlanId: string,
      options?: { billingCadence?: string; billingPeriod?: string; prorationBehavior?: string },
    ): Promise<PlanChangePreview> {
      return previewPlanChangeHelper(sdk, subscriptionId, targetPlanId, options);
    },

    async changePlan(
      subscriptionId: string,
      targetPlanId: string,
      options?: { billingCadence?: string; billingPeriod?: string; prorationBehavior?: string },
    ): Promise<unknown> {
      return changePlanHelper(sdk, subscriptionId, targetPlanId, options);
    },

    // ── Batch Usage ──────────────────────────
    async trackUsageBatch(events: TrackUsageParams[]): Promise<void> {
      await Promise.allSettled(
        events.map(async (params) => {
          const customerId = await resolveCustomerId(params.externalId);
          return trackUsage(sdk, customerId, params);
        }),
      );
    },

    // ── Webhook ───────────────────────────────
    handleWebhook,
  };

  logger.info("[billing] TirdadBilling initialized");

  return instance;
}

// ─── Re-exports ───────────────────────────────────────────────

export { BillingCoreError, TirdadClientError } from "./errors.js";
export { formatPrice } from "./currency.js";
export { matchRoute, getActiveRoutes } from "./router.js";

export type {
  BillingActor,
  BillingPlan,
  BillingPrice,
  BillingFeature,
  // BillingSubscription,         // Hidden: use Customer Portal
  EntitlementCheckResult,
  // FeatureUsageResult,          // Hidden: use Customer Portal
  // TrackUsageParams,            // Hidden: use Customer Portal
  CheckoutParams,
  TirdadEventMap,
  TirdadEventName,
  TirdadCallbacks,
  TirdadBillingConfig,
  TirdadConnectionConfig,
  AuthConfig,
  CheckoutConfig,
  RouteKey,
  RouteConfig,
  WebhookConfig,
  DedupStore,
  ObservabilityConfig,
  MinimalLogger,
  // SubscriptionStatus,          // Hidden: use Customer Portal
  WebhookContext,
  TirdadCustomerInfo,
  // TirdadSubscriptionInfo,      // Hidden: use Customer Portal
  // TirdadInvoiceInfo,           // Hidden: use Customer Portal
  TirdadWalletInfo,
} from "./types.js";

export type { ResolvedCustomer } from "./auth.js";
