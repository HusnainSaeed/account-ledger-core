/**
 * Append-only ledger store and balance queries.
 * Entries are never mutated or deleted — reversals append compensating rows.
 */

import { ACCOUNTS, type AccountId, type Day, type LedgerEntry, type MinorUnits } from "./types.js";

export class Ledger {
  private readonly entries: LedgerEntry[] = [];
  private seq = 0;

  /** Append a new entry; returns the stored row (with generated id if needed). */
  append(entry: Omit<LedgerEntry, "id"> & { id?: string }): LedgerEntry {
    this.seq += 1;
    const stored: LedgerEntry = {
      id: entry.id ?? `LE-${this.seq}`,
      accountId: entry.accountId,
      kind: entry.kind,
      valueDate: entry.valueDate,
      bookedOn: entry.bookedOn,
      amountMinor: entry.amountMinor,
      currency: entry.currency,
      ...(entry.ref !== undefined ? { ref: entry.ref } : {}),
    };
    this.entries.push(stored);
    return stored;
  }

  all(): readonly LedgerEntry[] {
    return this.entries;
  }

  findById(id: string): LedgerEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  findByRef(ref: string): LedgerEntry | undefined {
    return this.entries.find((e) => e.ref === ref || e.id === ref);
  }

  /**
   * Closing ledger balance as of day D:
   * opening + sum(entries with value_date <= D).
   * Holds are intentionally excluded — they are not ledger entries.
   */
  balanceAsOf(accountId: AccountId, asOfDay: Day): MinorUnits {
    return this.sumAsOf(accountId, asOfDay, () => true);
  }

  /**
   * Closing balance for customer day reports: excludes interest capitalization
   * so Day 6’s printed close matches the accrual base (cap is listed separately).
   */
  balanceAsOfExcludingCapitalization(
    accountId: AccountId,
    asOfDay: Day,
  ): MinorUnits {
    return this.sumAsOf(
      accountId,
      asOfDay,
      (e) => e.kind !== "INTEREST_CAPITALIZATION",
    );
  }

  /**
   * Same as balanceAsOf but skips overdraft fees — used to assert the
   * acceptance check “Day 2 close before any fee is assessed”.
   */
  balanceAsOfBeforeFees(accountId: AccountId, asOfDay: Day): MinorUnits {
    return this.sumAsOf(
      accountId,
      asOfDay,
      (e) => e.kind !== "OVERDRAFT_FEE",
    );
  }

  private sumAsOf(
    accountId: AccountId,
    asOfDay: Day,
    include: (e: LedgerEntry) => boolean,
  ): MinorUnits {
    const opening = ACCOUNTS[accountId].openingMinor;
    let sum = opening;
    for (const e of this.entries) {
      if (e.accountId !== accountId) {
        continue;
      }
      if (e.valueDate <= asOfDay && include(e)) {
        sum += e.amountMinor;
      }
    }
    return sum;
  }

  /** Latest bookedOn observed in the log (0 if empty). */
  maxBookedOn(): number {
    let max = 0;
    for (const e of this.entries) {
      if (e.bookedOn > max) {
        max = e.bookedOn;
      }
    }
    return max;
  }

  hasOverdraftFeeFor(accountId: AccountId, day: Day): boolean {
    return this.entries.some(
      (e) =>
        e.accountId === accountId &&
        e.kind === "OVERDRAFT_FEE" &&
        e.valueDate === day,
    );
  }

  feesOnValueDate(accountId: AccountId, day: Day): readonly LedgerEntry[] {
    return this.entries.filter(
      (e) =>
        e.accountId === accountId &&
        e.kind === "OVERDRAFT_FEE" &&
        e.valueDate === day,
    );
  }
}
