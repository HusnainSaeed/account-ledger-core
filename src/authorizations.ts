/**
 * Authorization holds: reduce available balance, never ledger balance.
 */

import type { AccountId, Authorization, Day, LedgerError, MinorUnits } from "./types.js";
import type { Ledger } from "./ledger.js";

export class AuthorizationStore {
  private readonly byId = new Map<string, Authorization>();
  private readonly errors: LedgerError[] = [];

  get(authId: string): Authorization | undefined {
    return this.byId.get(authId);
  }

  all(): readonly Authorization[] {
    return [...this.byId.values()];
  }

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
   * Auth is approved only if available stays >= 0 after applying the new hold.
   */
  availableBalance(ledger: Ledger, accountId: AccountId, asOfDay: Day): MinorUnits {
    return ledger.balanceAsOf(accountId, asOfDay) - this.activeHolds(accountId);
  }

  recordError(error: LedgerError): void {
    this.errors.push(error);
  }

  getErrors(): readonly LedgerError[] {
    return this.errors;
  }

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
   * Release the full hold and mark SETTLED.
   * Partial capture (settle < hold) still releases the entire remainder —
   * that matches card-scheme "capture then close" behaviour for Auth-A.
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
