/**
 * @tirdad/billing — Usage Module
 *
 * Usage event ingestion + real-time usage summary queries.
 * Wraps SDK events.createEvent() and customers.getCustomerUsageSummary().
 */

import type { Flexprice } from "@flexprice/sdk";
import type { TrackUsageParams, FeatureUsageResult } from "./types.js";
import { BillingCoreError } from "./errors.js";

/**
 * Ingest a usage event into Tirdad.
 * Requires an idempotencyKey (enforced at the type level and runtime).
 */
export async function trackUsage(
  sdk: Flexprice,
  customerId: string,
  params: TrackUsageParams,
): Promise<void> {
  if (!params.idempotencyKey) {
    throw new BillingCoreError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Usage events require an idempotencyKey to prevent double-counting",
    );
  }

  await sdk.events.ingestEvent({
    eventName: params.eventName,
    externalCustomerId: params.externalId,
    customerId: customerId,
    properties: params.properties ?? {},
    timestamp: (params.timestamp ?? new Date()).toISOString(),
    eventId: params.idempotencyKey,
  });
}

/**
 * Get the full usage summary for a customer.
 * Returns real-time usage vs. limits for all metered features.
 */
export async function getUsageSummary(
  sdk: Flexprice,
  customerId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  return sdk.customers.getCustomerUsageSummary({
    customerId: customerId,
  });
}

/**
 * Get real-time usage for a single feature by lookup key.
 * Fetches the full usage summary and filters to the matching feature.
 */
export async function getFeatureUsage(
  sdk: Flexprice,
  customerId: string,
  lookupKey: string,
): Promise<FeatureUsageResult> {
  const summary = await getUsageSummary(sdk, customerId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features: any[] = summary?.features ?? [];
  const match = features.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) =>
      f.feature?.lookup_key === lookupKey ||
      f.feature?.lookupKey === lookupKey,
  );

  if (!match) {
    throw new BillingCoreError(
      "FEATURE_NOT_FOUND",
      `Feature "${lookupKey}" not found in customer usage summary`,
      { statusCode: 404 },
    );
  }

  return {
    currentUsage: Number(match.current_usage ?? 0),
    totalLimit: Number(match.total_limit ?? 0),
    usagePercent: Number(match.usage_percent ?? 0),
    isEnabled: match.is_enabled ?? false,
    isSoftLimit: match.is_soft_limit ?? false,
    isUnlimited: match.is_unlimited ?? false,
    nextResetAt: match.next_usage_reset_at ?? null,
    feature: {
      lookupKey: match.feature?.lookup_key ?? lookupKey,
      name: match.feature?.name ?? "",
    },
  };
}

/**
 * Quick boolean: is the customer within their usage limit for this feature?
 */
export async function isWithinLimit(
  sdk: Flexprice,
  customerId: string,
  lookupKey: string,
): Promise<boolean> {
  try {
    const usage = await getFeatureUsage(sdk, customerId, lookupKey);
    if (usage.isUnlimited || usage.isSoftLimit) return true;
    return usage.currentUsage < usage.totalLimit;
  } catch (err) {
    if (err instanceof BillingCoreError && err.code === "FEATURE_NOT_FOUND") {
      return false;
    }
    throw err;
  }
}
