/**
 * Overdraft fee policy.
 * Once per account per day when that day's closing ledger (value_date <= day)
 * is negative. Fee is booked with value_date = the day assessed (the negative day).
 *
 * After backdated posts we re-scan all days up to the horizon: a single debit
 * can make multiple historical days negative (E7 → Day 2 and Day 4).
 */

import type { AuthorizationStore } from "../authorizations.js";
import type { Ledger } from "../ledger.js";
import {
  ACCOUNTS,
  OVERDRAFT_FEE_AED_MINOR,
  WINDOW_DAYS,
  type AccountId,
  type Day,
} from "../types.js";

/**
 * Balance used to decide "is this day negative?" must exclude that day's own
 * OD fee so we do not double-assess. We compute gross close then subtract any
 * OD fee already present for that day (equivalent: sum non-fee + other entries).
 */
/**
 * Balance used to decide "is this day negative?" must exclude *that day's*
 * own OD fee so we do not double-assess. Earlier days' fees remain — they
 * correctly change later closes (Day-2 fee flows into Day-4).
 */
function closingBeforeOdFee(ledger: Ledger, accountId: AccountId, day: Day): bigint {
  const closing = ledger.balanceAsOf(accountId, day);
  if (!ledger.hasOverdraftFeeFor(accountId, day)) {
    return closing;
  }
  // Fee is stored as -OVERDRAFT_FEE_AED_MINOR; add it back to recover pre-fee close.
  return closing + OVERDRAFT_FEE_AED_MINOR;
}

/**
 * Assess any missing OD fees for days 1..throughDay.
 * Loops until stable because booking a Day-2 fee changes later closes.
 * Only AED accounts receive the AED 25 fee per the brief.
 */
export function assessOverdraftFees(
  ledger: Ledger,
  _auths: AuthorizationStore,
  throughDay: Day,
): void {
  let changed = true;
  let guard = 0;
  while (changed && guard < 20) {
    guard += 1;
    changed = false;
    for (const accountId of Object.keys(ACCOUNTS) as AccountId[]) {
      if (ACCOUNTS[accountId].currency !== "AED") {
        continue;
      }
      for (const day of WINDOW_DAYS) {
        if (day > throughDay) {
          break;
        }
        if (ledger.hasOverdraftFeeFor(accountId, day)) {
          continue;
        }
        const preFee = closingBeforeOdFee(ledger, accountId, day);
        if (preFee < 0n) {
          // value_date = day assessed (the day whose close went negative)
          ledger.append({
            accountId,
            kind: "OVERDRAFT_FEE",
            valueDate: day,
            bookedOn: throughDay,
            amountMinor: -OVERDRAFT_FEE_AED_MINOR,
            currency: "AED",
            ref: `OD-${accountId}-D${day}`,
          });
          changed = true;
        }
      }
    }
  }
}
