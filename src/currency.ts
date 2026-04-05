/**
 * @tirdad/billing — Currency Formatting
 *
 * Locale-aware price formatting using Intl.NumberFormat.
 */

/**
 * Format a price amount for display.
 *
 * @param amount - The numeric amount (e.g. 29.00)
 * @param currency - ISO 4217 currency code (e.g. "USD", "SAR")
 * @param locale - Optional locale for formatting (e.g. "en-US", "ar-SA"). Defaults to "en-US".
 * @returns Formatted price string (e.g. "$29.00", "109.00 SAR", "٢٩٫٠٠ US$")
 */
export function formatPrice(
  amount: number,
  currency: string,
  locale?: string,
): string {
  try {
    return new Intl.NumberFormat(locale ?? "en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if currency code is invalid
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}
