/**
 * @tirdad/billing — Plans Module
 *
 * Plan catalog helpers: getPlans, getPlan.
 * Wraps SDK plans.queryPlan() and plans.getPlan().
 */

import type { Flexprice } from "@flexprice/sdk";
import type { BillingPlan, BillingPrice, BillingFeature } from "./types.js";
import { formatPrice } from "./currency.js";

export interface GetPlansOptions {
  /** Filter prices to a specific currency. */
  currency?: string;
  /** Filter by plan lookup key. */
  lookupKey?: string;
}

/**
 * Fetch all plans from Tirdad, transformed into the BillingPlan shape.
 */
export async function getPlans(
  sdk: Flexprice,
  options?: GetPlansOptions,
): Promise<BillingPlan[]> {
  const response = await sdk.plans.queryPlan({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (response as any)?.items ?? (response as any)?.plans ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let plans: BillingPlan[] = items.map((plan: any) =>
    mapPlanResponse(plan, options?.currency),
  );

  // Filter by lookupKey if specified
  if (options?.lookupKey) {
    plans = plans.filter((p) => p.lookupKey === options.lookupKey);
  }

  return plans;
}

/**
 * Fetch a single plan by ID or lookup key.
 */
export async function getPlan(
  sdk: Flexprice,
  idOrLookupKey: string,
): Promise<BillingPlan | null> {
  // First try to get by ID directly
  try {
    const response = await sdk.plans.getPlan(idOrLookupKey);
    if (response) {
      return mapPlanResponse(response);
    }
  } catch {
    // If not found by ID, try by lookup key
  }

  // Fallback: query all and filter by lookupKey
  const plans = await getPlans(sdk, { lookupKey: idOrLookupKey });
  return plans[0] ?? null;
}

/**
 * Map a raw SDK plan response to the BillingPlan shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlanResponse(raw: any, currencyFilter?: string): BillingPlan {
  // Extract prices from the plan's price entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPrices: any[] = raw.prices ?? raw.plan_prices ?? [];
  let prices: BillingPrice[] = rawPrices.map(mapPriceEntry);

  // Filter by currency if specified
  if (currencyFilter) {
    prices = prices.filter(
      (p) => p.currency.toUpperCase() === currencyFilter.toUpperCase(),
    );
  }

  // Extract features/entitlements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawFeatures: any[] =
    raw.features ?? raw.entitlements ?? raw.plan_entitlements ?? [];
  const features: BillingFeature[] = rawFeatures.map(mapFeatureEntry);

  return {
    id: raw.id ?? "",
    name: raw.name ?? raw.display_name ?? "",
    description: raw.description ?? "",
    lookupKey: raw.lookup_key ?? raw.lookupKey ?? raw.name?.toLowerCase().replace(/\s+/g, "_") ?? "",
    prices,
    features,
    metadata: raw.metadata ?? {},
  };
}

/**
 * Map a raw price entry to BillingPrice.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPriceEntry(raw: any): BillingPrice {
  const price = raw.price ?? raw;
  const amount = Number(price.amount ?? price.unit_amount ?? 0);
  const currency = (
    price.currency ?? price.price_currency ?? "USD"
  ).toUpperCase();
  const interval =
    price.billing_period ??
    price.interval ??
    price.invoicing_cycle ??
    "month";

  return {
    id: price.id ?? "",
    amount,
    currency,
    interval: normalizeInterval(interval),
    displayAmount: formatPrice(amount, currency),
  };
}

/**
 * Map a raw feature/entitlement entry to BillingFeature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFeatureEntry(raw: any): BillingFeature {
  const feature = raw.feature ?? raw;
  return {
    lookupKey: feature.lookup_key ?? feature.lookupKey ?? "",
    name: feature.name ?? "",
    type: feature.type ?? "boolean",
    usageLimit: raw.usage_limit ?? raw.usageLimit ?? undefined,
  };
}

/** Normalize billing period strings to a consistent format. */
function normalizeInterval(interval: string): string {
  const lower = interval.toLowerCase();
  if (lower.includes("month")) return "month";
  if (lower.includes("year") || lower.includes("annual")) return "year";
  if (lower.includes("one") || lower.includes("once")) return "one_time";
  if (lower.includes("week")) return "week";
  if (lower.includes("day")) return "day";
  return lower;
}
