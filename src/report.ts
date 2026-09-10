/**
 * Human-readable per-day report for the runnable suite / CLI.
 */

import { formatMinor } from "./money.js";
import type { ReplayResult } from "./replay.js";
import { ACCOUNTS, WINDOW_DAYS, type AccountId, type Day } from "./types.js";

export function formatDayReport(result: ReplayResult): string {
  const { ledger, auths, accruals } = result;
  const lines: string[] = [];
  lines.push("=== In-Memory Account Ledger — Day Report ===");
  lines.push("");

  for (const day of WINDOW_DAYS) {
    lines.push(`--- Day ${day} ---`);
    for (const accountId of Object.keys(ACCOUNTS) as AccountId[]) {
      const spec = ACCOUNTS[accountId];
      const closing = ledger.balanceAsOfExcludingCapitalization(accountId, day);
      // Available uses *current* active holds (end-state of replay).
      const available = closing - auths.activeHolds(accountId);
      lines.push(
        `  ${accountId} (${spec.currency}) closing ledger: ${formatMinor(closing, spec.currency)}`,
      );
      if (auths.activeHolds(accountId) > 0n) {
        lines.push(
          `    available (ledger − active holds): ${formatMinor(available, spec.currency)}`,
        );
      }
      const fees = ledger.feesOnValueDate(accountId, day);
      if (fees.length > 0) {
        for (const f of fees) {
          lines.push(
            `    overdraft fee: ${formatMinor(f.amountMinor, f.currency)} (bookedOn Day ${f.bookedOn})`,
          );
        }
      }
      const dayAccruals = accruals.filter(
        (a) => a.accountId === accountId && a.day === day && a.accrualMinor > 0n,
      );
      for (const a of dayAccruals) {
        lines.push(
          `    interest accrual: ${formatMinor(a.accrualMinor, spec.currency)}`,
        );
      }
    }

    for (const a of auths.all()) {
      if (a.bookedOn === day) {
        lines.push(
          `  AUTH ${a.authId}: hold ${formatMinor(a.holdMinor, a.currency)} status=${a.status} (booked Day ${a.bookedOn})`,
        );
      }
    }

    const errs = auths.getErrors().filter((e) => e.bookedOn === day);
    for (const e of errs) {
      lines.push(`  ERROR [${e.code}] ${e.message}`);
    }
    lines.push("");
  }

  // End-state authorization summary
  lines.push("--- Authorization end state ---");
  for (const a of auths.all()) {
    lines.push(
      `  ${a.authId}: ${a.status} hold=${formatMinor(a.holdMinor, a.currency)} account=${a.accountId}`,
    );
  }
  lines.push("");

  lines.push("--- Interest capitalization (Day 6 credits) ---");
  for (const e of ledger.all()) {
    if (e.kind === "INTEREST_CAPITALIZATION") {
      lines.push(
        `  ${e.accountId}: ${formatMinor(e.amountMinor, e.currency)}`,
      );
    }
  }

  const byAccount = new Map<string, bigint>();
  for (const a of accruals) {
    byAccount.set(
      a.accountId,
      (byAccount.get(a.accountId) ?? 0n) + a.accrualMinor,
    );
  }
  lines.push("");
  lines.push("--- Accrual checksum (sum of rounded dailies) ---");
  for (const [accountId, total] of byAccount) {
    const currency = ACCOUNTS[accountId as AccountId].currency;
    lines.push(`  ${accountId}: ${formatMinor(total, currency)}`);
  }

  lines.push("");
  lines.push("--- All ledger entries (append-only) ---");
  for (const e of ledger.all()) {
    lines.push(
      `  ${e.id} ${e.kind} ${e.accountId} VD${e.valueDate} booked${e.bookedOn} ${formatMinor(e.amountMinor, e.currency)}${e.ref ? ` ref=${e.ref}` : ""}`,
    );
  }

  return lines.join("\n");
}

/** Helper exported for tests that assert a specific day's close. */
export function closingOn(
  result: ReplayResult,
  accountId: AccountId,
  day: Day,
): bigint {
  return result.ledger.balanceAsOf(accountId, day);
}
