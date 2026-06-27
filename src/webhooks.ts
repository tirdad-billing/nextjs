/**
 * @tirdad/billing — Webhook Handler
 *
 * Svix signature verification + deduplication + typed callback dispatch.
 */

import { Webhook } from "svix";
import type {
  TirdadCallbacks,
  TirdadEventName,
  WebhookConfig,
  DedupStore,
  MinimalLogger,
  TirdadCustomerInfo,
  TirdadSubscriptionInfo,
  TirdadInvoiceInfo,
  TirdadWalletInfo,
} from "./types.js";
import { BillingCoreError } from "./errors.js";
import { InMemoryDedupStore } from "./dedup.js";

/** Known event names that we dispatch to callbacks. */
const KNOWN_EVENTS = new Set<string>([
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "invoice.created",
  "invoice.finalized",
  "invoice.paid",
  "invoice.voided",
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "customer.created",
  "customer.updated",
  "wallet.credited",
  "wallet.debited",
]);

/**
 * Maps Tirdad's actual webhook event type strings to our normalized event names.
 * The SDK emits events like "subscription.cancelled" (British spelling) etc.
 */
const EVENT_ALIASES: Record<string, TirdadEventName> = {
  // Tirdad uses British "cancelled", we normalize to American "canceled"
  "subscription.cancelled": "subscription.canceled",
  // Tirdad may send more specific sub-events
  "subscription.activated": "subscription.created",
  "invoice.update.finalized": "invoice.finalized",
  "invoice.update.payment": "invoice.paid",
  "invoice.update.voided": "invoice.voided",
  "payment.success": "payment.succeeded",
  "payment.created": "payment.succeeded",
};

export interface WebhookHandlerOptions {
  secret: string;
  callbacks?: TirdadCallbacks;
  webhookConfig?: WebhookConfig;
  logger?: MinimalLogger;
  onWebhook?: (event: {
    eventType: string;
    customerId: string;
    messageId: string;
    success: boolean;
  }) => void;
  /**
   * Called for events that may change a customer's entitlements, so the caller
   * can bust any entitlement cache. Fires only after the event is accepted
   * (signature verified, not a duplicate, callback didn't fail-and-propagate).
   */
  invalidateCustomer?: (
    customer: TirdadCustomerInfo,
    eventType: TirdadEventName,
  ) => void;
}

/**
 * Events that can change a customer's entitlements/usage allowances and should
 * therefore invalidate the entitlement cache. Invoice/customer-profile events
 * do not affect entitlements and are intentionally excluded.
 */
const ENTITLEMENT_MUTATING_PREFIXES = ["subscription.", "payment.", "wallet."];

function mutatesEntitlements(eventType: TirdadEventName): boolean {
  return ENTITLEMENT_MUTATING_PREFIXES.some((p) => eventType.startsWith(p));
}

export interface WebhookHandlerResult {
  status: number;
  body: string;
}

/**
 * Create a webhook handler that verifies signatures, deduplicates, and dispatches callbacks.
 */
export function createWebhookHandler(options: WebhookHandlerOptions) {
  const { secret, callbacks, webhookConfig, logger, onWebhook, invalidateCustomer } =
    options;
  const svixWebhook = new Webhook(secret);

  // Initialize dedup store
  let dedupStore: DedupStore | null = null;
  if (webhookConfig?.dedupStore) {
    dedupStore = webhookConfig.dedupStore;
  } else if (webhookConfig?.dedup !== "none") {
    dedupStore = new InMemoryDedupStore();
  }

  const errorStrategy = webhookConfig?.onCallbackError ?? "propagate";

  /**
   * Handle an incoming webhook request.
   */
  return async function handleWebhook(
    body: string,
    headers: Record<string, string>,
  ): Promise<WebhookHandlerResult> {
    // 1. Verify Svix signature
    let payload: Record<string, unknown>;
    try {
      payload = svixWebhook.verify(body, headers) as Record<string, unknown>;
    } catch (err) {
      logger?.warn("[billing] Webhook signature verification failed");
      throw new BillingCoreError(
        "WEBHOOK_SIGNATURE_INVALID",
        "Webhook signature verification failed",
        { statusCode: 400, cause: err },
      );
    }

    // 2. Extract message ID for deduplication
    const messageId =
      (headers["svix-id"] as string) ??
      (headers["webhook-id"] as string) ??
      "";

    // 3. Deduplicate — CHECK only. We defer marking the message as seen until
    //    after it has been successfully processed (below). Marking it here, as
    //    the old code did, meant a callback that threw and returned 500 would be
    //    deduped-and-dropped on Svix's retry, defeating the retry entirely.
    if (dedupStore && messageId) {
      const seen = await dedupStore.has(messageId);
      if (seen) {
        logger?.debug?.(
          `[billing] Duplicate webhook skipped: messageId=${messageId}`,
        );
        return { status: 200, body: '{"status":"duplicate"}' };
      }
    }

    // 4. Parse event type
    const rawEventType = (payload.event_type ?? payload.type ?? "") as string;
    const eventType = normalizeEventType(rawEventType);

    // 5. Extract customer info from payload
    const customer = extractCustomerInfo(payload);

    // 6. Dispatch to callback if registered
    if (eventType && callbacks && eventType in callbacks) {
      const callback = callbacks[eventType];
      if (callback) {
        const ctx = buildCallbackContext(
          eventType,
          payload,
          customer,
          messageId,
        );

        try {
          await callback(ctx as never);
          onWebhook?.({
            eventType: rawEventType,
            customerId: customer.externalId,
            messageId,
            success: true,
          });
        } catch (err) {
          logger?.error(
            `[billing] Webhook callback error for ${rawEventType}: ${err}`,
          );
          onWebhook?.({
            eventType: rawEventType,
            customerId: customer.externalId,
            messageId,
            success: false,
          });

          if (errorStrategy === "propagate") {
            // Return 500 WITHOUT marking the message as seen, so Svix's retry
            // is reprocessed rather than silently dropped as a duplicate.
            return { status: 500, body: '{"status":"callback_error"}' };
          }
          // "swallow" — fall through, return 200, and mark as seen so Svix
          // doesn't retry an error we've chosen to ignore.
        }
      }
    } else {
      logger?.debug?.(
        `[billing] No callback registered for event: ${rawEventType}`,
      );
    }

    // 7. Bust the entitlement cache for events that can change entitlements.
    if (eventType && mutatesEntitlements(eventType)) {
      try {
        invalidateCustomer?.(customer, eventType);
      } catch (err) {
        logger?.warn?.(
          `[billing] Entitlement cache invalidation failed for ${rawEventType}: ${err}`,
        );
      }
    }

    // 8. Mark as seen now that the event was processed (delivered, swallowed, or
    //    had no registered callback). Reached only when we are returning 200.
    if (dedupStore && messageId) {
      await dedupStore.set(messageId);
    }

    return { status: 200, body: '{"status":"ok"}' };
  };
}

/**
 * Normalize a raw event type string to a known TirdadEventName.
 * Returns null if the event is not recognized.
 */
function normalizeEventType(raw: string): TirdadEventName | null {
  if (KNOWN_EVENTS.has(raw)) return raw as TirdadEventName;
  if (raw in EVENT_ALIASES) return EVENT_ALIASES[raw];
  return null;
}

/**
 * Extract customer info from the webhook payload.
 */
function extractCustomerInfo(
  payload: Record<string, unknown>,
): TirdadCustomerInfo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (payload.data ?? payload) as any;
  const customer = data.customer ?? data;

  return {
    id: customer.id ?? customer.customer_id ?? "",
    externalId:
      customer.external_id ?? customer.externalId ?? customer.external_customer_id ?? "",
    email: customer.email ?? "",
    name: customer.name ?? "",
  };
}

/**
 * Build the full typed callback context for a given event.
 */
function buildCallbackContext(
  eventType: TirdadEventName,
  payload: Record<string, unknown>,
  customer: TirdadCustomerInfo,
  messageId: string,
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (payload.data ?? payload) as any;

  const base = {
    customer,
    eventType,
    messageId,
    timestamp: new Date(
      (payload.timestamp as string) ?? Date.now(),
    ),
  };

  // Add event-specific payload fields
  if (eventType.startsWith("subscription.")) {
    return {
      ...base,
      subscription: extractSubscriptionInfo(data),
    };
  }

  if (
    eventType.startsWith("invoice.") ||
    eventType.startsWith("payment.")
  ) {
    const ctx: Record<string, unknown> = {
      ...base,
      invoice: extractInvoiceInfo(data),
    };
    if (eventType.startsWith("payment.")) {
      ctx.attemptCount = data.attempt_count ?? data.attemptCount ?? 1;
    }
    return ctx;
  }

  if (eventType.startsWith("wallet.")) {
    return {
      ...base,
      wallet: extractWalletInfo(data),
      amount: data.amount ?? 0,
      currency: data.currency ?? "",
    };
  }

  // customer.* events — customer is already in base context
  return base;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSubscriptionInfo(data: any): TirdadSubscriptionInfo {
  const sub = data.subscription ?? data;
  return {
    id: sub.id ?? sub.subscription_id ?? "",
    customerId: sub.customer_id ?? sub.customerId ?? "",
    planId: sub.plan_id ?? sub.planId ?? "",
    status: sub.status ?? "active",
    currentPeriodStart:
      sub.current_period_start ?? sub.currentPeriodStart ?? "",
    currentPeriodEnd: sub.current_period_end ?? sub.currentPeriodEnd ?? "",
    cancelAtPeriodEnd:
      sub.cancel_at_period_end ?? sub.cancelAtPeriodEnd ?? false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractInvoiceInfo(data: any): TirdadInvoiceInfo {
  const inv = data.invoice ?? data;
  return {
    id: inv.id ?? inv.invoice_id ?? "",
    customerId: inv.customer_id ?? inv.customerId ?? "",
    status: inv.status ?? "",
    amountDue: inv.amount_due ?? inv.amountDue ?? 0,
    currency: inv.currency ?? "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractWalletInfo(data: any): TirdadWalletInfo {
  const w = data.wallet ?? data;
  return {
    id: w.id ?? w.wallet_id ?? "",
    customerId: w.customer_id ?? w.customerId ?? "",
    balance: w.balance ?? 0,
    currency: w.currency ?? "",
  };
}
