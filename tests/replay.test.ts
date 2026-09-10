import { describe, expect, it } from "vitest";
import { formatMinor, parseMinor } from "../src/money.js";
import { replay, replayThrough } from "../src/replay.js";

describe("event stream replay", () => {
  it("Day 2 closing at end of Day 5 before fees is AED -370.00", () => {
    // Through E7 (index 0..6). Fees are assessed inside apply, so read pre-fee helper.
    const { ledger } = replayThrough((_, index) => index <= 6);
    expect(ledger.balanceAsOfBeforeFees("ACC-001", 2)).toBe(
      parseMinor("-370.00", "AED"),
    );
  });

  it("E7 causes overdraft fees on more than Day 2 alone", () => {
    const { ledger } = replayThrough((_, index) => index <= 6);
    const feeDays = ledger
      .all()
      .filter((e) => e.kind === "OVERDRAFT_FEE" && e.accountId === "ACC-001")
      .map((e) => e.valueDate);
    expect(feeDays).toContain(2);
    // Backdated E7 also leaves Day 4 (and Day 5) negative before their fees.
    expect(feeDays.length).toBeGreaterThan(1);
    expect(feeDays).toContain(4);
  });

  it("accepts Day 4 settlement of Auth-A", () => {
    const { ledger, auths } = replay();
    const authA = auths.get("Auth-A");
    expect(authA?.status).toBe("SETTLED");
    const settleDebit = ledger.all().find((e) => e.id === "E5");
    expect(settleDebit?.amountMinor).toBe(parseMinor("-185.00", "AED"));
  });

  it("rejects Auth-Z settlement and does not debit funds", () => {
    const { ledger, auths } = replay();
    const errors = auths.getErrors().filter((e) => e.ref === "Auth-Z");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.code === "SETTLEMENT_UNKNOWN_AUTH")).toBe(true);
    const rogue = ledger
      .all()
      .filter((e) => e.ref === "Auth-Z" && e.kind === "DEBIT");
    expect(rogue).toHaveLength(0);
  });

  it("Auth-A hold reduced available but not ledger while active", () => {
    // After E3: ledger 250, hold 200, available 50
    const { ledger, auths } = replayThrough((_, index) => index <= 2);
    expect(ledger.balanceAsOf("ACC-001", 2)).toBe(parseMinor("250.00", "AED"));
    expect(auths.activeHolds("ACC-001")).toBe(parseMinor("200.00", "AED"));
    expect(auths.availableBalance(ledger, "ACC-001", 2)).toBe(
      parseMinor("50.00", "AED"),
    );
  });

  it("after E9, OD fees from E7 remain (append-only; not auto-reversed)", () => {
    const beforeE7 = replayThrough((_, index) => index <= 5); // through E6
    const feesBefore = beforeE7.ledger
      .all()
      .filter((e) => e.kind === "OVERDRAFT_FEE");
    expect(feesBefore).toHaveLength(0);

    const full = replay();
    const feesAfter = full.ledger
      .all()
      .filter((e) => e.kind === "OVERDRAFT_FEE" && e.accountId === "ACC-001");
    expect(feesAfter.length).toBeGreaterThan(0);
    // E9 reversed E7 but fees stay — balances therefore ≠ pure pre-E7 world.
    expect(full.ledger.findById("E9")?.kind).toBe("REVERSAL");
  });

  it("BHD instalments are 3.333, 3.333, 3.334", () => {
    const { ledger } = replay();
    const parts = ledger
      .all()
      .filter((e) => e.ref === "E10")
      .map((e) => e.amountMinor);
    expect(parts).toEqual([3333n, 3333n, 3334n]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(10000n);
  });

  it("capitalized interest equals the sum of rounded daily accruals", () => {
    const { ledger, accruals } = replay();
    for (const accountId of ["ACC-001", "ACC-002"] as const) {
      const sum = accruals
        .filter((a) => a.accountId === accountId)
        .reduce((s, a) => s + a.accrualMinor, 0n);
      const cap = ledger
        .all()
        .find(
          (e) =>
            e.kind === "INTEREST_CAPITALIZATION" && e.accountId === accountId,
        );
      if (sum === 0n) {
        expect(cap).toBeUndefined();
      } else {
        expect(cap?.amountMinor).toBe(sum);
      }
    }
  });

  it("prints a non-empty day report shape via balances", () => {
    const { ledger } = replay();
    expect(formatMinor(ledger.balanceAsOf("ACC-002", 5), "BHD")).toBe("10.000");
  });
});
