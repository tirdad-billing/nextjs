/**
 * @flexprice/billing — Main Entry Point
 *
 * FlexpriceBilling factory: the ONE function that configures everything.
 * Re-exports all types and the SDK for escape hatches.
 */

import { Flexprice } from "@flexprice/sdk";
import type {
  FlexpriceBillingConfig,
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
  pauseSubscription as pauseSubscriptionHelper,
  resumeSubscription as resumeSubscriptionHelper,
} from "./subscriptions.js";


/** The billing instance returned by FlexpriceBilling(). */
export interface BillingInstance {
  /** The underlying @flexprice/sdk client (escape hatch). */
  sdk: Flexprice;

  // ── Customer Resolution ───────────────────
  /** Resolve a BillingActor to a Flexprice customer. */
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
  /** Cancel a subscription. */
  cancelSubscription(
    subscriptionId: string,
    options?: { cancelAtPeriodEnd?: boolean },
  ): Promise<void>;
  /** Pause a subscription. */
  pauseSubscription(
    subscriptionId: string,
    options?: { pauseDays?: number; pauseUntil?: string },
  ): Promise<void>;
  /** Resume a paused subscription. */
  resumeSubscription(subscriptionId: string): Promise<void>;

  // ── Webhook ───────────────────────────────
  /** Handle an incoming webhook request (internal use by adapters). */
  handleWebhook(
    body: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: string }>;

  // ── Internal ──────────────────────────────
  /** The full configuration. */
  config: FlexpriceBillingConfig;
}

/**
 * Create a configured billing instance.
 *
 * This is the core factory — framework adapters (Next.js, Express) wrap this
 * to add route handling.
 */
export function createBillingInstance(
  billingConfig: FlexpriceBillingConfig,
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

  // Customer ID cache: externalId → Flexprice customerId
  const customerIdCache = new Map<string, string>();

  /**
   * Resolve externalId to Flexprice customerId, with caching.
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
      return getEntitlements(sdk, customerId);
    },

    async checkFeature(
      externalId: string,
      lookupKey: string,
    ): Promise<EntitlementCheckResult> {
      const customerId = await resolveCustomerId(externalId);
      return checkFeature(sdk, customerId, lookupKey);
    },

    async hasAccess(
      externalId: string,
      lookupKey: string,
    ): Promise<boolean> {
      const customerId = await resolveCustomerId(externalId);
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

      // Create subscription via SDK
      const sub = await sdk.subscriptions.createSubscription({
        customerId: customer.id,
        planId: params.planId,
        currency: params.currency ?? "USD",
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

    async pauseSubscription(
      subscriptionId: string,
      options?: { pauseDays?: number; pauseUntil?: string },
    ): Promise<void> {
      return pauseSubscriptionHelper(sdk, subscriptionId, options);
    },

    async resumeSubscription(subscriptionId: string): Promise<void> {
      return resumeSubscriptionHelper(sdk, subscriptionId);
    },

    // ── Webhook ───────────────────────────────
    handleWebhook,
  };

  logger.info("[billing] FlexpriceBilling initialized");

  return instance;
}

// ─── Re-exports ───────────────────────────────────────────────

export { BillingCoreError, FlexpriceClientError } from "./errors.js";
export { formatPrice } from "./currency.js";
export { matchRoute, getActiveRoutes } from "./router.js";

export type {
  BillingActor,
  BillingPlan,
  BillingPrice,
  BillingFeature,
  BillingSubscription,
  EntitlementCheckResult,
  FeatureUsageResult,
  TrackUsageParams,
  CheckoutParams,
  FlexpriceEventMap,
  FlexpriceEventName,
  FlexpriceCallbacks,
  FlexpriceBillingConfig,
  FlexpriceConnectionConfig,
  AuthConfig,
  CheckoutConfig,
  RouteKey,
  RouteConfig,
  WebhookConfig,
  DedupStore,
  ObservabilityConfig,
  MinimalLogger,
  SubscriptionStatus,
  WebhookContext,
  FlexpriceCustomerInfo,
  FlexpriceSubscriptionInfo,
  FlexpriceInvoiceInfo,
  FlexpriceWalletInfo,
} from "./types.js";

export type { ResolvedCustomer } from "./auth.js";
