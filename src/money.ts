/**
 * Fixed-scale money helpers.
 * Why bigint minor units: IEEE floats cannot represent 0.01 / 0.001 exactly;
 * ledger checksums drift at fils scale if we use `number`.
 */

import type { CurrencyCode, MinorUnits } from "./types.js";

/**
 * Returns the decimal scale fixed by the specification (AED=2, BHD=3).
 *
 * @param currency - Account currency code
 * @returns Number of fractional digits
 */
export function scaleFor(currency: CurrencyCode): number {
  switch (currency) {
    case "AED":
      return 2;
    case "BHD":
      return 3;
    default: {
      const _exhaustive: never = currency;
      return _exhaustive;
    }
  }
}

/**
 * Parses a decimal display string into integer minor units at the currency scale.
 *
 * @param display - Human amount, e.g. `"1200.00"` or `"10.000"`
 * @param currency - Controls allowed fractional digits
 * @returns Signed minor units (`bigint`)
 * @throws If the string has more fractional digits than the currency allows
 */
export function parseMinor(display: string, currency: CurrencyCode): MinorUnits {
  const scale = scaleFor(currency);
  const negative = display.trim().startsWith("-");
  const raw = display.trim().replace(/^-/, "").replace(/,/g, "");
  const [wholePart, fracPart = ""] = raw.split(".");
  if (fracPart.length > scale) {
    throw new Error(`Too many decimals for ${currency}: ${display}`);
  }
  const fracPadded = fracPart.padEnd(scale, "0");
  const combined = `${wholePart}${fracPadded}`;
  const minor = BigInt(combined);
  return negative ? -minor : minor;
}

/**
 * Formats minor units back to a fixed-scale decimal string for reports/tests.
 *
 * @param minor - Signed minor units
 * @param currency - Controls fractional width
 * @returns Display string such as `"-370.00"`
 */
export function formatMinor(minor: MinorUnits, currency: CurrencyCode): string {
  const scale = scaleFor(currency);
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const s = abs.toString().padStart(scale + 1, "0");
  const whole = s.slice(0, -scale) || "0";
  const frac = s.slice(-scale);
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/**
 * Rounds daily interest: `(balance * num / den)` half-up for non-negative balances.
 * Zero/negative balances accrue nothing (interest is positive-balance only).
 *
 * @param balanceMinor - Closing ledger in minor units
 * @param numerator - Rate numerator (4 for 0.04%)
 * @param denominator - Rate denominator (10_000)
 * @returns Accrual in minor units (0 if balance ≤ 0)
 */
export function roundInterestMinor(
  balanceMinor: MinorUnits,
  numerator: bigint,
  denominator: bigint,
): MinorUnits {
  if (balanceMinor <= 0n) {
    return 0n;
  }
  // (balance * num + den/2) / den — classic half-up for non-negative values
  const product = balanceMinor * numerator;
  return (product + denominator / 2n) / denominator;
}

/**
 * Splits a total into `parts` equal shares at currency scale (remainder-on-last).
 * Why not 3.334×3 for BHD 10.000: that sums to 10.002 and invents money.
 *
 * @param totalMinor - Total to distribute (non-negative)
 * @param parts - Number of instalments (≥ 1)
 * @returns Array of minor-unit shares that sum exactly to `totalMinor`
 */
export function splitEqualWithRemainderOnLast(
  totalMinor: MinorUnits,
  parts: number,
): MinorUnits[] {
  if (parts <= 0) {
    throw new Error("parts must be positive");
  }
  if (totalMinor < 0n) {
    throw new Error("total must be non-negative for instalment split");
  }
  const n = BigInt(parts);
  const base = totalMinor / n;
  const result: MinorUnits[] = [];
  let allocated = 0n;
  for (let i = 0; i < parts - 1; i++) {
    result.push(base);
    allocated += base;
  }
  result.push(totalMinor - allocated);
  return result;
}
