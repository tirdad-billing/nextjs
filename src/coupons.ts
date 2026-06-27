/**
 * @tirdad/billing — Coupons Module
 *
 * Coupon validation and retrieval helpers.
 */

import type { Tirdad } from "@tirdad-ai/sdk";

/** Simplified coupon shape for the billing layer. */
export interface BillingCoupon {
  id: string;
  code: string;
  name: string;
  discountType: "percentage" | "fixed" | string;
  /** Discount magnitude: a percentage (0–100) when type is "percentage", else a fixed amount. */
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
  sdk: Tirdad,
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

/**
 * Map a raw @tirdad-ai/sdk CouponResponse to BillingCoupon.
 *
 * Field reference (camelCase): `type` ("fixed"|"percentage"), `amountOff` and
 * `percentageOff` (numeric strings), `status` ("published"|"archived"|"deleted"),
 * `totalRedemptions`/`maxRedemptions`, `redeemAfter`/`redeemBefore` (validity
 * window). There is no `code` field — coupons are identified by `name`/`id`.
 * snake_case fallbacks are retained for forward-compat with raw payloads.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoupon(raw: any): BillingCoupon {
  const discountType: string =
    raw.type ?? raw.discountType ?? raw.discount_type ?? "percentage";

  // Pick the discount magnitude that matches the coupon type.
  const percentageOff = raw.percentageOff ?? raw.percentage_off;
  const amountOff = raw.amountOff ?? raw.amount_off;
  const rawDiscount =
    discountType === "percentage"
      ? (percentageOff ?? amountOff)
      : (amountOff ?? percentageOff);

  const status: string | undefined = raw.status;

  return {
    id: raw.id ?? "",
    code: raw.code ?? raw.name ?? raw.id ?? "",
    name: raw.name ?? "",
    discountType,
    discountValue: parseFloat(String(rawDiscount ?? "0")) || 0,
    currency: raw.currency ?? null,
    // A coupon is usable only while published; archived/deleted are inactive.
    // Fall back to true only when status is entirely absent from the payload.
    isActive: status !== undefined ? status === "published" : true,
    maxRedemptions:
      raw.maxRedemptions ?? raw.max_redemptions ?? null,
    timesRedeemed:
      raw.totalRedemptions ?? raw.total_redemptions ?? raw.timesRedeemed ?? 0,
    validFrom: raw.redeemAfter ?? raw.redeem_after ?? null,
    validUntil: raw.redeemBefore ?? raw.redeem_before ?? null,
  };
}
