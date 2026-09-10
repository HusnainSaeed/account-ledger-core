/**
 * Append-only ledger store and balance queries.
 * Entries are never mutated or deleted — reversals append compensating rows.
 */

import { ACCOUNTS, type AccountId, type Day, type LedgerEntry, type MinorUnits } from "./types.js";

/** In-memory append-only log of money movements (no holds). */
export class Ledger {
  private readonly entries: LedgerEntry[] = [];
  private seq = 0;

  /**
   * Appends a new entry. Never updates or removes an existing row.
   *
   * @param entry - Money movement; `id` optional (auto `LE-n` if omitted)
   * @returns The stored immutable-shaped row
   */
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

  /**
   * @returns Read-only view of every appended entry in append order
   */
  all(): readonly LedgerEntry[] {
    return this.entries;
  }

  /**
   * Looks up an entry by its primary id (e.g. `"E7"` for reversal).
   *
   * @param id - Entry id
   * @returns The entry, or `undefined` if never posted
   */
  findById(id: string): LedgerEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  /**
   * Closing ledger balance as of day D:
   * opening + sum(entries with `value_date <= D`).
   * Holds are excluded — they are not ledger entries.
   *
   * @param accountId - Account to total
   * @param asOfDay - Inclusive value-date cutoff
   * @returns Signed minor units
   */
  balanceAsOf(accountId: AccountId, asOfDay: Day): MinorUnits {
    return this.sumAsOf(accountId, asOfDay, () => true);
  }

  /**
   * Closing balance for day reports excluding interest capitalization,
   * so Day 6’s printed close matches the accrual base (cap listed separately).
   *
   * @param accountId - Account to total
   * @param asOfDay - Inclusive value-date cutoff
   * @returns Signed minor units without `INTEREST_CAPITALIZATION` rows
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
   * Closing balance as of day D excluding overdraft fee rows.
   * Models the “pre-fee close” used when deciding whether a day is negative
   * and when stating closes before fee assessment.
   *
   * @param accountId - Account to total
   * @param asOfDay - Inclusive value-date cutoff
   * @returns Signed minor units without `OVERDRAFT_FEE` rows
   */
  balanceAsOfBeforeFees(accountId: AccountId, asOfDay: Day): MinorUnits {
    return this.sumAsOf(
      accountId,
      asOfDay,
      (e) => e.kind !== "OVERDRAFT_FEE",
    );
  }

  /**
   * Shared summer for balance helpers: opening + filtered entries by value date.
   *
   * @param accountId - Account to total
   * @param asOfDay - Inclusive value-date cutoff
   * @param include - Predicate selecting which entries count
   * @returns Signed minor units
   */
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

  /**
   * Whether an OD fee row already exists for this account/day (once-per-day guard).
   *
   * @param accountId - Account
   * @param day - Value date of the fee
   * @returns `true` if a fee for that day is already appended
   */
  hasOverdraftFeeFor(accountId: AccountId, day: Day): boolean {
    return this.entries.some(
      (e) =>
        e.accountId === accountId &&
        e.kind === "OVERDRAFT_FEE" &&
        e.valueDate === day,
    );
  }

  /**
   * Lists overdraft fee entries whose `value_date` equals `day` (for the report).
   *
   * @param accountId - Account
   * @param day - Fee value date
   * @returns Matching fee rows
   */
  feesOnValueDate(accountId: AccountId, day: Day): readonly LedgerEntry[] {
    return this.entries.filter(
      (e) =>
        e.accountId === accountId &&
        e.kind === "OVERDRAFT_FEE" &&
        e.valueDate === day,
    );
  }
}
