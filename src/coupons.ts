/**
 * @tirdad/billing — Coupons Module
 *
 * Coupon validation and retrieval helpers.
 */

import type { Flexprice } from "@flexprice/sdk";

/** Simplified coupon shape for the billing layer. */
export interface BillingCoupon {
  id: string;
  code: string;
  name: string;
  discountType: "percentage" | "fixed" | string;
  discountValue: number;
  currency: string | null;
  isActive: boolean;
  maxRedemptions: number | null;
  timesRedeemed: number;
  validFrom: string | null;
  validUntil: string | null;
}

/**
 * Validate a coupon code.
 * Returns the coupon details if valid, null if not found or expired.
 */
export async function validateCoupon(
  sdk: Flexprice,
  codeOrId: string,
): Promise<BillingCoupon | null> {
  try {
    // Try getting by ID first
    const raw = await sdk.coupons.getCoupon(codeOrId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = mapCoupon(raw as any);

    // Check if currently active
    if (!coupon.isActive) return null;

    // Check if within validity window
    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
      return null;
    }

    // Check if max redemptions reached
    if (
      coupon.maxRedemptions !== null &&
      coupon.timesRedeemed >= coupon.maxRedemptions
    ) {
      return null;
    }

    return coupon;
  } catch {
    // If not found by ID, try querying by code
    try {
      const response = await sdk.coupons.queryCoupon({});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = (response as any)?.items ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = items.find((c: any) => {
        const code = c.code ?? c.coupon_code ?? c.name ?? "";
        return (
          code.toLowerCase() === codeOrId.toLowerCase() ||
          c.id === codeOrId
        );
      });
      if (!match) return null;
      return mapCoupon(match);
    } catch {
      return null;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoupon(raw: any): BillingCoupon {
  return {
    id: raw.id ?? "",
    code: raw.code ?? raw.coupon_code ?? raw.name ?? "",
    name: raw.name ?? raw.code ?? "",
    discountType:
      raw.discountType ?? raw.discount_type ?? raw.type ?? "percentage",
    discountValue: parseFloat(
      raw.discountValue ?? raw.discount_value ?? raw.amount ?? "0",
    ),
    currency: raw.currency ?? null,
    isActive:
      (raw.status === "published" ||
      raw.status === "active" ||
      raw.isActive) ??
      true,
    maxRedemptions:
      raw.maxRedemptions ?? raw.max_redemptions ?? raw.redemptionLimit ?? null,
    timesRedeemed:
      raw.timesRedeemed ?? raw.times_redeemed ?? raw.redemptionCount ?? 0,
    validFrom: raw.validFrom ?? raw.valid_from ?? raw.startDate ?? null,
    validUntil: raw.validUntil ?? raw.valid_until ?? raw.expiresAt ?? null,
  };
}
