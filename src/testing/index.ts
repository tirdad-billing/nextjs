/**
 * @tirdad/billing/testing — Mock Billing Instance
 *
 * In-memory mock for unit testing and Storybook development.
 * Mirrors the BillingInstance interface without hitting real APIs.
 */

import type {
  BillingPlan,
  BillingActor,
  EntitlementCheckResult,
  FeatureUsageResult,
  TrackUsageParams,
  CheckoutParams,
  TirdadBillingConfig,
} from "../types.js";
import type { BillingInstance } from "../index.js";
import type { ResolvedCustomer } from "../auth.js";

export interface MockBillingOptions {
  /** Pre-loaded plans for getPlans(). */
  plans?: BillingPlan[];
  /** Pre-loaded subscriptions for getSubscriptions(). */
  subscriptions?: any[];
  /** Pre-loaded invoices for getInvoices(). */
  invoices?: any[];
  /** Pre-loaded entitlements: { featureLookupKey: isEnabled } */
  entitlements?: Record<string, boolean>;
  /** Pre-loaded usage: { featureLookupKey: { current, limit } } */
  usage?: Record<
    string,
    { currentUsage: number; totalLimit: number; isUnlimited?: boolean }
  >;
  /** Default customer to resolve. */
  customer?: Partial<ResolvedCustomer>;
  /** Should checkout throw? For testing error flows. */
  checkoutError?: Error;
}

/**
 * Create a mock billing instance for testing.
 * All methods return predictable data from the options.
 */
export function MockTirdadBilling(
  options: MockBillingOptions = {},
): BillingInstance {
  const trackedEvents: TrackUsageParams[] = [];
  const webhookCalls: Array<{ body: string; headers: Record<string, string> }> =
    [];

  const defaultCustomer: ResolvedCustomer = {
    id: options.customer?.id ?? "cust_mock_001",
    externalId: options.customer?.externalId ?? "user_mock_001",
    email: options.customer?.email ?? "test@example.com",
    name: options.customer?.name ?? "Test User",
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sdk: {} as any,
    config: {} as TirdadBillingConfig,

    async resolveCustomer(_actor: BillingActor): Promise<ResolvedCustomer> {
      return {
        ...defaultCustomer,
        externalId: _actor.externalId,
        email: _actor.email ?? defaultCustomer.email,
        name: _actor.name ?? defaultCustomer.name,
      };
    },

    async getPlans(): Promise<BillingPlan[]> {
      return options.plans ?? [];
    },

    async getPlan(idOrLookupKey: string): Promise<BillingPlan | null> {
      return (
        options.plans?.find(
          (p) => p.id === idOrLookupKey || p.lookupKey === idOrLookupKey,
        ) ?? null
      );
    },

    formatPrice(amount: number, currency: string): string {
      return `${currency} ${amount.toFixed(2)}`;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getEntitlements(): Promise<any> {
      // Mirror the real shape: CustomerEntitlementsResponse { customerId, features }
      // where each feature is an aggregated { feature, entitlement, sources }.
      const map = options.entitlements ?? {};
      return {
        customerId: defaultCustomer.id,
        features: Object.entries(map).map(([lookupKey, isEnabled]) => ({
          feature: { lookupKey, name: lookupKey, type: "boolean" },
          entitlement: { isEnabled },
          sources: [],
        })),
      };
    },

    async checkFeature(
      _externalId: string,
      lookupKey: string,
    ): Promise<EntitlementCheckResult> {
      const isEnabled = options.entitlements?.[lookupKey] ?? false;
      return {
        isEnabled,
        feature: { lookupKey, type: "boolean", name: lookupKey },
        isSoftLimit: false,
        sources: [],
      };
    },

    async hasAccess(
      _externalId: string,
      lookupKey: string,
    ): Promise<boolean> {
      return options.entitlements?.[lookupKey] ?? false;
    },

    async trackUsage(params: TrackUsageParams): Promise<void> {
      trackedEvents.push(params);
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getUsageSummary(): Promise<any> {
      return { features: options.usage ?? {} };
    },

    async getFeatureUsage(
      _externalId: string,
      lookupKey: string,
    ): Promise<FeatureUsageResult> {
      const data = options.usage?.[lookupKey];
      return {
        currentUsage: data?.currentUsage ?? 0,
        totalLimit: data?.totalLimit ?? 0,
        usagePercent:
          data?.totalLimit
            ? ((data?.currentUsage ?? 0) / data.totalLimit) * 100
            : 0,
        isEnabled: true,
        isSoftLimit: false,
        isUnlimited: data?.isUnlimited ?? false,
        nextResetAt: null,
        feature: { lookupKey, name: lookupKey },
      };
    },

    async isWithinLimit(
      _externalId: string,
      lookupKey: string,
    ): Promise<boolean> {
      const data = options.usage?.[lookupKey];
      if (!data) return false;
      if (data.isUnlimited) return true;
      return data.currentUsage < data.totalLimit;
    },

    async checkout(
      _actor: BillingActor,
      _params: CheckoutParams,
    ): Promise<{ url: string; subscriptionId?: string }> {
      if (options.checkoutError) throw options.checkoutError;
      return {
        url: "/checkout/success",
        subscriptionId: "sub_mock_001",
      };
    },

    async getPortalUrl(
      _actor: BillingActor,
    ): Promise<{ url: string; customerId: string }> {
      return {
        url: `/portal/customer/${defaultCustomer.id}`,
        customerId: defaultCustomer.id,
      };
    },

    async handleWebhook(
      body: string,
      headers: Record<string, string>,
    ): Promise<{ status: number; body: string }> {
      webhookCalls.push({ body, headers });
      return { status: 200, body: '{"status":"ok"}' };
    },

    async getSubscriptions() {
      // Real getSubscriptions returns a bare array (BillingSubscription[]).
      return (options.subscriptions ?? []) as any;
    },

    async getPrimarySubscription() {
      return options.subscriptions?.[0] ?? null;
    },

    async cancelSubscription() {
      // no-op in mock
    },

    async getInvoices() {
      return { invoices: options.invoices ?? [], total: options.invoices?.length ?? 0 } as any;
    },

    async getInvoice() {
      return null;
    },

    async getInvoicePdfUrl() {
      return null;
    },

    async validateCoupon() {
      return null;
    },

    async previewPlanChange() {
      return {
        changeType: "upgrade",
        currentPlanId: null,
        currentPlanName: null,
        targetPlanId: null,
        targetPlanName: null,
        effectiveDate: null,
        subscriptionId: null,
        prorationDetails: null,
        nextInvoicePreview: null,
        warnings: [],
      };
    },

    async changePlan() {
      return {};
    },

    async trackUsageBatch() {
      // no-op in mock
    },
  };
}

/** Webhook fixture helpers for testing. */
export const webhookFixtures = {
  /**
   * Create a mock webhook payload.
   * Does NOT generate a real Svix signature — use with MockTirdadBilling only.
   */
  create(
    eventType: string,
    data: Record<string, unknown> = {},
  ): { body: string; headers: Record<string, string> } {
    const payload = {
      event_type: eventType,
      data,
      timestamp: new Date().toISOString(),
    };

    return {
      body: JSON.stringify(payload),
      headers: {
        "svix-id": `msg_${Date.now()}`,
        "svix-timestamp": String(Math.floor(Date.now() / 1000)),
        "svix-signature": "mock_signature_for_testing_only",
        "content-type": "application/json",
      },
    };
  },
};
