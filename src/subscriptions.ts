/**
 * @tirdad/billing — Subscriptions Module
 *
 * Subscription lifecycle helpers: query, cancel, pause, resume.
 * Wraps SDK subscriptions.* methods.
 */

import type { Flexprice } from "@flexprice/sdk";
import type { BillingSubscription } from "./types.js";

/**
 * Get all subscriptions for a customer.
 */
export async function getSubscriptions(
  sdk: Flexprice,
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
  sdk: Flexprice,
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
  sdk: Flexprice,
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
 * Pause a subscription.
 *
 * @param options.pauseDays - Number of days to pause.
 * @param options.pauseUntil - ISO 8601 date when pause should end.
 */
export async function pauseSubscription(
  sdk: Flexprice,
  subscriptionId: string,
  options?: { pauseDays?: number; pauseUntil?: string },
): Promise<void> {
  await sdk.subscriptions.pauseSubscription(subscriptionId, {
    pauseMode: "immediate",
    ...(options?.pauseDays ? { pauseDays: options.pauseDays } : {}),
    ...(options?.pauseUntil ? { pauseEnd: options.pauseUntil } : {}),
  });
}

/**
 * Resume a paused subscription.
 */
export async function resumeSubscription(
  sdk: Flexprice,
  subscriptionId: string,
): Promise<void> {
  await sdk.subscriptions.resumeSubscription(subscriptionId, {
    resumeMode: "immediate",
  });
}

/**
 * Map a raw SDK subscription response to BillingSubscription.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSubscription(raw: any): BillingSubscription {
  return {
    id: raw.id ?? "",
    customerId: raw.customer_id ?? raw.customerId ?? "",
    planId: raw.plan_id ?? raw.planId ?? "",
    status: raw.subscription_status ?? raw.status ?? "unknown",
    currentPeriodStart:
      raw.current_period_start ?? raw.currentPeriodStart ?? null,
    currentPeriodEnd: raw.current_period_end ?? raw.currentPeriodEnd ?? null,
    cancelAtPeriodEnd:
      raw.cancel_at_period_end ?? raw.cancelAtPeriodEnd ?? false,
    trialEnd: raw.trial_end ?? raw.trialEnd ?? null,
    metadata: raw.metadata ?? {},
  };
}
