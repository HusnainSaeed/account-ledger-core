/**
 * Overdraft fee policy.
 * Once per account per day when that day's closing ledger (`value_date <= day`)
 * is negative. Fee is booked with `value_date` = the day assessed (the negative day).
 *
 * After backdated posts we re-scan days up to the horizon: one debit can make
 * multiple historical days negative (E7 → Day 2 and Day 4).
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
 * Closing balance used for the negativity test, excluding *this day's* own OD fee
 * so we do not double-assess. Earlier days' fees remain — they correctly change
 * later closes (Day-2 fee flows into Day-4).
 *
 * @param ledger - Ledger including any already-booked fees
 * @param accountId - Account under review
 * @param day - Candidate fee day
 * @returns Pre-fee closing minor units for `day`
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
 * Assesses any missing OD fees for days 1..`throughDay`.
 * Loops until stable because booking a Day-2 fee changes later closes.
 * Only AED accounts receive the AED 25 fee per the specification.
 *
 * @param ledger - Append target for new fee rows
 * @param _auths - Reserved for future available/fee coupling; unused today
 * @param throughDay - Highest day to evaluate (usually event `bookedOn`)
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
