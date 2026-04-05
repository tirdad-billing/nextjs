/**
 * @flexprice/billing — Entitlements Module
 *
 * Convenience wrappers over SDK's getCustomerEntitlements.
 * Resolves externalId → customerId internally.
 */

import type { Flexprice } from "@flexprice/sdk";
import type { EntitlementCheckResult } from "./types.js";
import { BillingCoreError } from "./errors.js";

/**
 * Get ALL entitlements for a customer.
 * Returns the raw SDK response.
 */
export async function getEntitlements(
  sdk: Flexprice,
  customerId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  return sdk.customers.getCustomerEntitlements(customerId);
}

/**
 * Check a specific feature's entitlement by lookup_key.
 * Fetches all entitlements and filters to the matching feature.
 */
export async function checkFeature(
  sdk: Flexprice,
  customerId: string,
  lookupKey: string,
): Promise<EntitlementCheckResult> {
  const response = await getEntitlements(sdk, customerId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const features: any[] = response?.features ?? [];
  const match = features.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) =>
      f.feature?.lookup_key === lookupKey ||
      f.feature?.lookupKey === lookupKey,
  );

  if (!match) {
    throw new BillingCoreError(
      "FEATURE_NOT_FOUND",
      `Feature "${lookupKey}" not found in customer entitlements`,
      { statusCode: 404 },
    );
  }

  return {
    isEnabled: match.entitlement?.is_enabled ?? false,
    feature: {
      lookupKey: match.feature?.lookup_key ?? lookupKey,
      type: match.feature?.type ?? "boolean",
      name: match.feature?.name ?? "",
    },
    isSoftLimit: match.entitlement?.is_soft_limit ?? false,
    usageLimit: match.entitlement?.usage_limit ?? undefined,
    usageResetPeriod: match.entitlement?.usage_reset_period ?? undefined,
    sources: (match.sources ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => ({
        entityType: s.entity_type ?? "",
        entityName: s.entity_name ?? "",
      }),
    ),
  };
}

/**
 * Simple boolean check: does the customer have access to this feature?
 */
export async function hasAccess(
  sdk: Flexprice,
  customerId: string,
  lookupKey: string,
): Promise<boolean> {
  try {
    const result = await checkFeature(sdk, customerId, lookupKey);
    return result.isEnabled;
  } catch (err) {
    if (err instanceof BillingCoreError && err.code === "FEATURE_NOT_FOUND") {
      return false;
    }
    throw err;
  }
}
