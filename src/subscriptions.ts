/**
 * @tirdad/billing — Subscriptions Module
 *
 * Subscription lifecycle helpers: query, cancel, pause, resume.
 * Wraps SDK subscriptions.* methods.
 */

import type { Tirdad } from "@tirdad-ai/sdk";
import type { BillingSubscription } from "./types.js";

/**
 * Get all subscriptions for a customer.
 */
export async function getSubscriptions(
  sdk: Tirdad,
  customerId: string,
): Promise<BillingSubscription[]> {
  const response = await sdk.subscriptions.querySubscription({
    customerId,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] =
    (response as any)?.items ?? (response as any)?.subscriptions ?? [];

  return items.map(mapSubscription);
}

/**
 * Get the primary (active) subscription for a customer.
 * Returns the first active subscription, or the most recent non-canceled one.
 */
export async function getPrimarySubscription(
  sdk: Tirdad,
  customerId: string,
): Promise<BillingSubscription | null> {
  const subs = await getSubscriptions(sdk, customerId);

  // Prefer active subscriptions
  const active = subs.find((s) => s.status === "active");
  if (active) return active;

  // Fall back to most recent non-canceled
  const nonCanceled = subs.filter((s) => s.status !== "canceled");
  return nonCanceled[0] ?? null;
}

/**
 * Cancel a subscription.
 *
 * @param options.cancelAtPeriodEnd - If true (default), cancels at end of billing period.
 *   If false, cancels immediately.
 */
export async function cancelSubscription(
  sdk: Tirdad,
  subscriptionId: string,
  options?: { cancelAtPeriodEnd?: boolean },
): Promise<void> {
  const cancellationType =
    options?.cancelAtPeriodEnd === false ? "immediate" : "end_of_period";

  await sdk.subscriptions.cancelSubscription(subscriptionId, {
    cancellationType,
  });
}


/**
 * Map a raw @tirdad-ai/sdk SubscriptionResponse to BillingSubscription.
 *
 * Note: the meaningful subscription state is `subscriptionStatus` (values like
 * "active"/"cancelled"/"trialing"), NOT the generic `status` field (which is the
 * "published"/"archived" lifecycle flag). The SDK uses British "cancelled"; we
 * normalize to American "canceled" to match our SubscriptionStatus type and the
 * getPrimarySubscription filter. Period fields arrive as Date objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSubscription(raw: any): BillingSubscription {
  return {
    id: raw.id ?? "",
    customerId: raw.customerId ?? raw.customer_id ?? "",
    planId: raw.planId ?? raw.plan_id ?? "",
    status: normalizeStatus(
      raw.subscriptionStatus ?? raw.subscription_status ?? "unknown",
    ),
    currentPeriodStart: toIso(raw.currentPeriodStart ?? raw.current_period_start),
    currentPeriodEnd: toIso(raw.currentPeriodEnd ?? raw.current_period_end),
    cancelAtPeriodEnd:
      raw.cancelAtPeriodEnd ?? raw.cancel_at_period_end ?? false,
    trialEnd: toIso(raw.trialEnd ?? raw.trial_end),
    metadata: raw.metadata ?? {},
  };
}

/** Normalize SDK subscription status (British spelling) to our vocabulary. */
function normalizeStatus(status: string): BillingSubscription["status"] {
  if (status === "cancelled") return "canceled";
  return status as BillingSubscription["status"];
}

/** Coerce a Date | ISO string | null to an ISO string (or null). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toIso(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
