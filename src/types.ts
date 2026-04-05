/**
 * @flexprice/billing — Core Types
 *
 * All type definitions for the Billing Core integration layer.
 * SDK types (DtoCustomerResponse, etc.) are re-exported from @flexprice/sdk.
 */

// ─── Actor Model ──────────────────────────────────────────────

/**
 * The resolved user or organization from the host app's auth system.
 * Returned by `resolveActor()` in the auth bridge configuration.
 */
export type BillingActor = {
  /** Maps to Flexprice customer.externalId. REQUIRED. */
  externalId: string;
  /** Whether this actor represents a user or an organization. Defaults to "user". */
  type?: "user" | "organization";
  /** Email for customer creation and invoice delivery. */
  email?: string;
  /** Display name for the customer record. */
  name?: string;
  /** Arbitrary metadata passed to Flexprice customer.metadata. */
  metadata?: Record<string, string>;
  /** Preferred currency for pricing display and checkout (e.g. "USD", "SAR"). */
  currency?: string;
};

// ─── Webhook Event Map ────────────────────────────────────────

/**
 * Base context shared by all webhook callbacks.
 */
export type WebhookContext = {
  /** The Flexprice customer this event relates to */
  customer: FlexpriceCustomerInfo;
  /** The raw event type string */
  eventType: string;
  /** Svix message ID (used for idempotency) */
  messageId: string;
  /** Event timestamp */
  timestamp: Date;
};

/** Minimal customer info extracted from webhook payloads. */
export type FlexpriceCustomerInfo = {
  id: string;
  externalId: string;
  email: string;
  name: string;
};

/** Subscription data from webhook payloads. */
export type FlexpriceSubscriptionInfo = {
  id: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
};

/** Invoice data from webhook payloads. */
export type FlexpriceInvoiceInfo = {
  id: string;
  customerId: string;
  status: string;
  amountDue: number;
  currency: string;
};

/** Wallet data from webhook payloads. */
export type FlexpriceWalletInfo = {
  id: string;
  customerId: string;
  balance: number;
  currency: string;
};

// Per-event payload types
type SubscriptionPayload = { subscription: FlexpriceSubscriptionInfo };
type InvoicePayload = { invoice: FlexpriceInvoiceInfo };
type PaymentPayload = { invoice: FlexpriceInvoiceInfo; attemptCount: number };
type CustomerPayload = Record<string, never>; // customer is already in WebhookContext
type WalletPayload = {
  wallet: FlexpriceWalletInfo;
  amount: number;
  currency: string;
};

/**
 * The event map that drives IntelliSense for webhook callbacks.
 * Each key is an event name, each value is the full callback context type.
 */
export interface FlexpriceEventMap {
  "subscription.created": WebhookContext & SubscriptionPayload;
  "subscription.updated": WebhookContext & SubscriptionPayload;
  "subscription.canceled": WebhookContext & SubscriptionPayload;
  "invoice.created": WebhookContext & InvoicePayload;
  "invoice.finalized": WebhookContext & InvoicePayload;
  "invoice.paid": WebhookContext & InvoicePayload;
  "invoice.voided": WebhookContext & InvoicePayload;
  "payment.succeeded": WebhookContext & PaymentPayload;
  "payment.failed": WebhookContext & PaymentPayload;
  "payment.refunded": WebhookContext & PaymentPayload;
  "customer.created": WebhookContext & CustomerPayload;
  "customer.updated": WebhookContext & CustomerPayload;
  "wallet.credited": WebhookContext & WalletPayload;
  "wallet.debited": WebhookContext & WalletPayload;
}

/** All known webhook event names. */
export type FlexpriceEventName = keyof FlexpriceEventMap;

/** Callback function type for a specific event. */
export type FlexpriceCallbacks = {
  [K in keyof FlexpriceEventMap]?: (
    ctx: FlexpriceEventMap[K],
  ) => void | Promise<void>;
};

// ─── Route Configuration ──────────────────────────────────────

/** Union of all auto-mounted route identifiers. */
export type RouteKey =
  | "plans"
  | "checkout"
  | "portal"
  | "webhook"
  | "subscriptions"
  | "entitlements"
  | "entitlements.check"
  | "usage"
  | "usage.summary";

/** Route configuration options. */
export interface RouteConfig {
  /** Mount point for all billing routes. Default: "/api/billing" */
  basePath?: string;
  /** Routes to omit — IntelliSense-driven, compile error on typo */
  disable?: RouteKey[];
  /** Enable CSRF token validation on POST routes (for cookie-session apps) */
  csrfProtection?: boolean;
}

// ─── Subscription Status ──────────────────────────────────────

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "paused"
  | "trialing"
  | "past_due"
  | "expired";

// ─── Webhook Configuration ────────────────────────────────────

/** Custom deduplication store interface. */
export interface DedupStore {
  has(messageId: string): Promise<boolean>;
  set(messageId: string): Promise<void>;
}

/** Webhook handler configuration. */
export interface WebhookConfig {
  /** Failure strategy: "propagate" returns 500 (Svix retries), "swallow" returns 200 */
  onCallbackError?: "propagate" | "swallow";
  /** Deduplication mode. Default: "memory" */
  dedup?: "memory" | "none";
  /** Custom dedup store (overrides dedup option). */
  dedupStore?: DedupStore;
}

// ─── Observability Configuration ──────────────────────────────

export interface ObservabilityConfig {
  /** Structured logger. Accepts pino, winston, or any object with info/warn/error methods. */
  logger?: MinimalLogger;
  /** Called on any SDK or Billing Core error */
  onError?: (
    err: Error,
    ctx: { correlationId: string; operation: string },
  ) => void;
  /** Called after every webhook is processed */
  onWebhook?: (event: {
    eventType: string;
    customerId: string;
    messageId: string;
    success: boolean;
  }) => void;
  /** Called on every billing API request */
  onRequest?: (meta: {
    correlationId: string;
    method: string;
    path: string;
    durationMs: number;
  }) => void;
}

export interface MinimalLogger {
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  debug?(msg: string, ...args: unknown[]): void;
}

// ─── Main Configuration ───────────────────────────────────────

/** Flexprice connection configuration. */
export interface FlexpriceConnectionConfig {
  /** Flexprice API base URL (e.g. "https://billing.yourapp.com/v1") */
  apiUrl: string;
  /** API key for server-to-server auth */
  apiKey: string;
  /** Tenant ID for multi-tenancy */
  tenantId?: string;
  /** Environment ID. Default: "live" */
  environmentId?: string;
  /** Svix webhook secret for signature verification */
  webhookSecret: string;
  /** Request timeout in ms. Default: 10000 */
  timeout?: number;
}

/** Auth bridge configuration. */
export interface AuthConfig {
  /** Resolve the current user/org from the incoming request. Return null for unauthenticated. */
  resolveActor: (req: Request) => Promise<BillingActor | null>;
}

/** Checkout defaults. */
export interface CheckoutConfig {
  /** URL to redirect after successful checkout */
  successUrl: string;
  /** URL to redirect on checkout cancellation */
  cancelUrl: string;
}

/** Full FlexpriceBilling initialization options. */
export interface FlexpriceBillingConfig {
  config: FlexpriceConnectionConfig;
  auth: AuthConfig;
  checkout?: CheckoutConfig;
  routes?: RouteConfig;
  webhooks?: WebhookConfig;
  observability?: ObservabilityConfig;
  on?: FlexpriceCallbacks;
}

// ─── Helper Return Types ──────────────────────────────────────

/** Plan shape returned by the billing helpers. */
export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  lookupKey: string;
  prices: BillingPrice[];
  features: BillingFeature[];
  metadata: Record<string, string>;
}

export interface BillingPrice {
  id: string;
  amount: number;
  currency: string;
  interval: string;
  displayAmount: string;
}

export interface BillingFeature {
  lookupKey: string;
  name: string;
  type: "boolean" | "metered" | "static";
  usageLimit?: number;
}

/** Entitlement check result. */
export interface EntitlementCheckResult {
  isEnabled: boolean;
  feature: {
    lookupKey: string;
    type: string;
    name: string;
  };
  isSoftLimit: boolean;
  usageLimit?: number;
  usageResetPeriod?: string;
  sources: Array<{
    entityType: string;
    entityName: string;
  }>;
}

/** Feature usage result. */
export interface FeatureUsageResult {
  currentUsage: number;
  totalLimit: number;
  usagePercent: number;
  isEnabled: boolean;
  isSoftLimit: boolean;
  isUnlimited: boolean;
  nextResetAt: string | null;
  feature: {
    lookupKey: string;
    name: string;
  };
}

/** Track usage parameters. */
export interface TrackUsageParams {
  externalId: string;
  eventName: string;
  quantity: number;
  idempotencyKey: string;
  properties?: Record<string, string>;
  timestamp?: Date;
}

/** Checkout parameters. */
export interface CheckoutParams {
  planId: string;
  couponCode?: string;
  currency?: string;
  idempotencyKey?: string;
}

/** Subscription shape returned by subscriptions route. */
export interface BillingSubscription {
  id: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  metadata: Record<string, string>;
}
