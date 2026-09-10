/**
 * Daily interest accrual and end-of-window capitalization.
 *
 * Accrue 0.04%/day on positive closing ledger balances only.
 * Capitalized total = exact sum of rounded daily accruals (by construction),
 * posted as a single credit on Day 6 — remainder is never discarded.
 */

import { roundInterestMinor } from "../money.js";
import type { Ledger } from "../ledger.js";
import {
  ACCOUNTS,
  DAILY_INTEREST_DENOMINATOR,
  DAILY_INTEREST_NUMERATOR,
  WINDOW_DAYS,
  type AccountId,
  type Day,
  type MinorUnits,
} from "../types.js";

/** One day's interest calculation result (before capitalization). */
export interface DailyAccrual {
  readonly accountId: AccountId;
  readonly day: Day;
  readonly closingMinor: MinorUnits;
  readonly accrualMinor: MinorUnits;
}

/**
 * Computes per-day accruals from final closes (after OD fees).
 * Does not append — caller capitalizes the sum so Day-6 close is not circular.
 *
 * @param ledger - Ledger after user events + fees (before interest credit)
 * @returns Flat list of per-account, per-day accrual rows
 */
export function computeDailyAccruals(ledger: Ledger): DailyAccrual[] {
  const accruals: DailyAccrual[] = [];
  for (const accountId of Object.keys(ACCOUNTS) as AccountId[]) {
    for (const day of WINDOW_DAYS) {
      const closing = ledger.balanceAsOf(accountId, day);
      const accrual =
        closing > 0n
          ? roundInterestMinor(
              closing,
              DAILY_INTEREST_NUMERATOR,
              DAILY_INTEREST_DENOMINATOR,
            )
          : 0n;
      accruals.push({
        accountId,
        day,
        closingMinor: closing,
        accrualMinor: accrual,
      });
    }
  }
  return accruals;
}

/**
 * Sums rounded dailies per account and appends one Day-6 credit when non-zero.
 * By construction capitalized total === Σ rounded accruals (no discarded remainder).
 *
 * @param ledger - Append target for capitalization credits
 * @param accruals - Output of {@link computeDailyAccruals}
 */
export function capitalizeInterest(ledger: Ledger, accruals: DailyAccrual[]): void {
  const totals = new Map<AccountId, MinorUnits>();
  for (const a of accruals) {
    totals.set(a.accountId, (totals.get(a.accountId) ?? 0n) + a.accrualMinor);
  }
  for (const [accountId, total] of totals) {
    if (total === 0n) {
      continue;
    }
    const currency = ACCOUNTS[accountId].currency;
    ledger.append({
      accountId,
      kind: "INTEREST_CAPITALIZATION",
      valueDate: 6,
      bookedOn: 6,
      amountMinor: total,
      currency,
      ref: `INT-CAP-${accountId}`,
    });
  }
}
