import { describe, it, expect } from "vitest";
import { formatPrice } from "../src/currency.js";

describe("formatPrice", () => {
  it("formats USD prices in en-US locale", () => {
    expect(formatPrice(29, "USD")).toBe("$29.00");
    expect(formatPrice(99.99, "USD")).toBe("$99.99");
    expect(formatPrice(0, "USD")).toBe("$0.00");
  });

  it("formats SAR prices in en-US locale", () => {
    const result = formatPrice(109, "SAR");
    expect(result).toContain("109.00");
    expect(result).toContain("SAR");
  });

  it("respects locale parameter", () => {
    const result = formatPrice(29, "USD", "ar-SA");
    // Arabic locale should still produce a valid string
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("handles lowercase currency codes", () => {
    expect(formatPrice(29, "usd")).toBe("$29.00");
  });

  it("falls back gracefully for invalid currencies", () => {
    const result = formatPrice(29, "INVALID");
    expect(result).toContain("29.00");
  });

  it("formats large numbers", () => {
    const result = formatPrice(1234567.89, "USD");
    expect(result).toContain("1,234,567.89");
  });
});
