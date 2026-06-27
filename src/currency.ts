/**
 * @tirdad/billing — Currency Formatting
 *
 * Locale-aware price formatting using Intl.NumberFormat.
 */

/**
 * Format a price amount for display.
 *
 * `amount` is expected in MAJOR currency units (e.g. 29.00 → "$29.00"), matching
 * the amounts returned by the plan/price helpers — it is NOT divided by 100.
 *
 * The number of fraction digits follows the currency's own convention via
 * `Intl.NumberFormat`: 2 for USD/SAR, 0 for JPY, 3 for KWD/BHD, etc. We do not
 * hardcode 2 digits, which previously rendered zero- and three-decimal
 * currencies incorrectly.
 *
 * @param amount - The numeric amount in major units (e.g. 29.00)
 * @param currency - ISO 4217 currency code (e.g. "USD", "SAR", "JPY")
 * @param locale - Optional locale for formatting (e.g. "en-US", "ar-SA"). Defaults to "en-US".
 * @returns Formatted price string (e.g. "$29.00", "SAR 109.00", "¥2,999", "٢٩٫٠٠ US$")
 */
export function formatPrice(
  amount: number,
  currency: string,
  locale?: string,
): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(locale ?? "en-US", {
      style: "currency",
      currency: code,
      // Omit min/maxFractionDigits so Intl uses each currency's natural scale.
    }).format(amount);
  } catch {
    // Fallback if the currency code is invalid/unknown to Intl. We can't know
    // the currency's scale here, so use a generic 2-decimal money string.
    return `${amount.toFixed(2)} ${code}`;
  }
}
