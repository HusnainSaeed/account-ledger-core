/**
 * Fixed-scale money helpers.
 * Why bigint minor units: IEEE floats cannot represent 0.01 / 0.001 exactly;
 * ledger defenses fail on "where did the fils go?" if we use number.
 */

import type { CurrencyCode, MinorUnits } from "./types.js";

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

/** Parse a decimal display string into minor units at the currency's scale. */
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
 * Half-up away from zero for positive interest accruals.
 * balance * num / den, rounded to integer minor units.
 */
export function roundInterestMinor(
  balanceMinor: MinorUnits,
  numerator: bigint,
  denominator: bigint,
): MinorUnits {
  if (balanceMinor <= 0n) {
    return 0n;
  }
  // (balance * num + den/2) / den  — classic half-up for non-negative values
  const product = balanceMinor * numerator;
  return (product + denominator / 2n) / denominator;
}

/**
 * Split total into `parts` equal shares at currency scale.
 * Remainder-on-last: first (parts-1) get floor(total/parts); last gets the rest.
 * Why not 3.334×3 for BHD 10.000: that sums to 10.002 and invents money.
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
