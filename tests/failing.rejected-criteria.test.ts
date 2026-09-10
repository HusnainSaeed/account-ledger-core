/**
 * INTENTIONALLY FAILING TEST
 *
 * What it reveals:
 * The acceptance criterion "E7 causes exactly one overdraft fee to be assessed,
 * on Day 2" is incorrect. A value-dated debit of 620 on Day 2 does not only
 * move Day 2 negative — recomputed closes for later days that already had
 * outflows (Day 4 settlement) also go negative, so the once-per-negative-day
 * policy books more than one fee.
 *
 * This test encodes the *false* criterion so the suite documents the refusal.
 * Keep it failing; see REJECTED.md.
 */
import { describe, expect, it } from "vitest";
import { replayThrough } from "../src/replay.js";

describe("REJECTED criterion: exactly one OD fee on Day 2 from E7", () => {
  // vitest it.fails: assertion fails against our design → reported as expected failure.
  // If someone "fixed" the suite to make this pass, vitest would fail the run.
  it.fails("falsely expects a single Day-2 overdraft fee after E7", () => {
    const { ledger } = replayThrough((_, index) => index <= 6);
    const odFees = ledger
      .all()
      .filter((e) => e.kind === "OVERDRAFT_FEE" && e.accountId === "ACC-001");

    // FALSE EXPECTATION (acceptance criterion we refuse):
    expect(odFees).toHaveLength(1);
    expect(odFees[0]?.valueDate).toBe(2);
  });
});
