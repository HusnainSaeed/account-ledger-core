import { describe, expect, it } from "vitest";
import {
  formatMinor,
  parseMinor,
  roundInterestMinor,
  splitEqualWithRemainderOnLast,
} from "../src/money.js";
import {
  DAILY_INTEREST_DENOMINATOR,
  DAILY_INTEREST_NUMERATOR,
} from "../src/types.js";

describe("money", () => {
  it("parses and formats AED at 2 decimal places", () => {
    expect(parseMinor("1200.00", "AED")).toBe(120000n);
    expect(formatMinor(120000n, "AED")).toBe("1200.00");
    expect(formatMinor(-37000n, "AED")).toBe("-370.00");
  });

  it("parses and formats BHD at 3 decimal places", () => {
    expect(parseMinor("10.000", "BHD")).toBe(10000n);
    expect(formatMinor(3333n, "BHD")).toBe("3.333");
    expect(formatMinor(3334n, "BHD")).toBe("3.334");
  });

  it("splits BHD 10.000 into remainder-on-last instalments", () => {
    const parts = splitEqualWithRemainderOnLast(parseMinor("10.000", "BHD"), 3);
    expect(parts).toEqual([3333n, 3333n, 3334n]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(10000n);
  });

  it("rejects the false claim that each instalment is 3.334", () => {
    // 3.334 × 3 = 10.002 ≠ 10.000 — invents 0.002 BHD
    expect(3334n * 3n).not.toBe(10000n);
  });

  it("rounds daily interest half-up on positive balances", () => {
    // 250.00 AED * 0.04% = 0.10 exactly
    expect(
      roundInterestMinor(25000n, DAILY_INTEREST_NUMERATOR, DAILY_INTEREST_DENOMINATOR),
    ).toBe(10n);
    expect(roundInterestMinor(0n, DAILY_INTEREST_NUMERATOR, DAILY_INTEREST_DENOMINATOR)).toBe(
      0n,
    );
    expect(roundInterestMinor(-100n, DAILY_INTEREST_NUMERATOR, DAILY_INTEREST_DENOMINATOR)).toBe(
      0n,
    );
  });
});
