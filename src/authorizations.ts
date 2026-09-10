/**
 * Authorization holds: reduce available balance, never ledger balance.
 */

import type { AccountId, Authorization, Day, LedgerError, MinorUnits } from "./types.js";
import type { Ledger } from "./ledger.js";

/** Mutable store of auth holds and rejected-operation errors. */
export class AuthorizationStore {
  private readonly byId = new Map<string, Authorization>();
  private readonly errors: LedgerError[] = [];

  /**
   * @param authId - Authorization identifier (e.g. `"Auth-A"`)
   * @returns The auth record, or `undefined` if unknown
   */
  get(authId: string): Authorization | undefined {
    return this.byId.get(authId);
  }

  /**
   * @returns Snapshot of all authorizations (any status)
   */
  all(): readonly Authorization[] {
    return [...this.byId.values()];
  }

  /**
   * Sum of ACTIVE hold amounts for an account (SETTLED holds do not count).
   *
   * @param accountId - Account whose holds to sum
   * @returns Total reserved minor units
   */
  activeHolds(accountId: AccountId): MinorUnits {
    let total = 0n;
    for (const a of this.byId.values()) {
      if (a.accountId === accountId && a.status === "ACTIVE") {
        total += a.holdMinor;
      }
    }
    return total;
  }

  /**
   * Available = ledger balance (as of booking day) − active holds.
   * An auth is approved only if available stays ≥ 0 after the new hold.
   *
   * @param ledger - Source of value-dated ledger balance
   * @param accountId - Account
   * @param asOfDay - Usually the auth’s `bookedOn`
   * @returns Available minor units (may be negative before a reject decision)
   */
  availableBalance(ledger: Ledger, accountId: AccountId, asOfDay: Day): MinorUnits {
    return ledger.balanceAsOf(accountId, asOfDay) - this.activeHolds(accountId);
  }

  /**
   * Records a rejected operation for the day report (does not touch the ledger).
   *
   * @param error - Structured error with `bookedOn` for per-day printing
   */
  recordError(error: LedgerError): void {
    this.errors.push(error);
  }

  /**
   * @returns All recorded rejects in append order
   */
  getErrors(): readonly LedgerError[] {
    return this.errors;
  }

  /**
   * Inserts a new ACTIVE authorization, or records `AUTH_DUPLICATE` and fails.
   *
   * @param auth - Auth fields without status (status set to ACTIVE here)
   * @returns `true` if stored; `false` if id already exists
   */
  tryApprove(auth: Omit<Authorization, "status">): boolean {
    const existing = this.byId.get(auth.authId);
    if (existing) {
      this.recordError({
        bookedOn: auth.bookedOn,
        code: "AUTH_DUPLICATE",
        message: `Authorization ${auth.authId} already exists`,
        ref: auth.authId,
      });
      return false;
    }
    this.byId.set(auth.authId, { ...auth, status: "ACTIVE" });
    return true;
  }

  /**
   * Marks an ACTIVE auth SETTLED and releases the full hold.
   * Partial capture (settle amount < hold) still releases the entire remainder —
   * card-scheme “capture then close” (Auth-A: hold 200, settle 185).
   *
   * @param authId - Authorization to close
   * @returns The settled auth, or `undefined` if missing/inactive
   */
  settle(authId: string): Authorization | undefined {
    const auth = this.byId.get(authId);
    if (!auth || auth.status !== "ACTIVE") {
      return undefined;
    }
    auth.status = "SETTLED";
    return auth;
  }
}
