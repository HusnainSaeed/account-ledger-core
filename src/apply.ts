/**
 * Applies a single stream event.
 * Exhaustive `switch` + `never` default: new event kinds fail at compile time.
 */

import { splitEqualWithRemainderOnLast } from "./money.js";
import type { AuthorizationStore } from "./authorizations.js";
import type { Ledger } from "./ledger.js";
import { assessOverdraftFees } from "./policies/overdraft.js";
import { type Day, type StreamEvent } from "./types.js";

/**
 * Narrows a number to the problem-window day type.
 *
 * @param n - Candidate day
 * @returns Day 1..6
 * @throws If outside the window
 */
function asDay(n: number): Day {
  if (n < 1 || n > 6) {
    throw new Error(`Day out of window: ${n}`);
  }
  return n as Day;
}

/**
 * Applies one user/system stream event to ledger + auth store.
 * Money-moving kinds trigger an overdraft re-scan through `event.bookedOn`.
 *
 * @param ledger - Append-only money log
 * @param auths - Holds and error log
 * @param event - Discriminated stream event (E1–E10 kinds)
 */
export function applyEvent(
  ledger: Ledger,
  auths: AuthorizationStore,
  event: StreamEvent,
): void {
  switch (event.kind) {
    case "CREDIT":
    case "DEBIT": {
      const signed =
        event.kind === "CREDIT" ? event.amountMinor : -event.amountMinor;
      ledger.append({
        id: event.id,
        accountId: event.accountId,
        kind: event.kind,
        valueDate: event.valueDate,
        bookedOn: event.bookedOn,
        amountMinor: signed,
        currency: event.currency,
      });
      assessOverdraftFees(ledger, auths, event.bookedOn);
      return;
    }
    case "AUTHORIZATION": {
      // Approve only if available stays >= 0 after the hold.
      const available = auths.availableBalance(
        ledger,
        event.accountId,
        event.bookedOn,
      );
      if (available - event.holdMinor < 0n) {
        auths.recordError({
          bookedOn: event.bookedOn,
          code: "AUTH_REJECTED_INSUFFICIENT_AVAILABLE",
          message: `Authorization ${event.authId} rejected: available would go negative`,
          ref: event.authId,
        });
        return;
      }
      auths.tryApprove({
        authId: event.authId,
        accountId: event.accountId,
        holdMinor: event.holdMinor,
        currency: event.currency,
        valueDate: event.valueDate,
        bookedOn: event.bookedOn,
      });
      return;
    }
    case "SETTLEMENT": {
      const auth = auths.get(event.authId);
      // Unknown auth id → reject; funds must not leave the account.
      if (!auth || auth.status !== "ACTIVE") {
        auths.recordError({
          bookedOn: event.bookedOn,
          code: "SETTLEMENT_UNKNOWN_AUTH",
          message: `Settlement references unknown or inactive authorization ${event.authId}`,
          ref: event.authId,
        });
        return;
      }
      if (auth.accountId !== event.accountId) {
        auths.recordError({
          bookedOn: event.bookedOn,
          code: "SETTLEMENT_ACCOUNT_MISMATCH",
          message: `Settlement account does not match authorization ${event.authId}`,
          ref: event.authId,
        });
        return;
      }
      auths.settle(event.authId);
      ledger.append({
        id: event.id,
        accountId: event.accountId,
        kind: "DEBIT",
        valueDate: event.valueDate,
        bookedOn: event.bookedOn,
        amountMinor: -event.settleMinor,
        currency: event.currency,
        ref: event.authId,
      });
      assessOverdraftFees(ledger, auths, event.bookedOn);
      return;
    }
    case "REVERSAL": {
      // Append compensating entry; do not mutate the original (append-only).
      // Consequential OD fees are NOT auto-reversed — that is intentional.
      const original = ledger.findById(event.reversesEventId);
      if (!original) {
        auths.recordError({
          bookedOn: event.bookedOn,
          code: "REVERSAL_UNKNOWN_ENTRY",
          message: `Cannot reverse missing entry ${event.reversesEventId}`,
          ref: event.reversesEventId,
        });
        return;
      }
      ledger.append({
        id: event.id,
        accountId: event.accountId,
        kind: "REVERSAL",
        valueDate: event.valueDate,
        bookedOn: event.bookedOn,
        amountMinor: -original.amountMinor,
        currency: original.currency,
        ref: event.reversesEventId,
      });
      assessOverdraftFees(ledger, auths, event.bookedOn);
      return;
    }
    case "INSTALMENT_CREDIT": {
      const parts = splitEqualWithRemainderOnLast(event.totalMinor, event.parts);
      parts.forEach((part, index) => {
        ledger.append({
          id: `${event.id}-${index + 1}`,
          accountId: event.accountId,
          kind: "CREDIT",
          valueDate: event.valueDate,
          bookedOn: event.bookedOn,
          amountMinor: part,
          currency: event.currency,
          ref: event.id,
        });
      });
      assessOverdraftFees(ledger, auths, event.bookedOn);
      return;
    }
    default: {
      const _exhaustive: never = event;
      void _exhaustive;
      throw new Error("Unhandled stream event kind");
    }
  }
}

/**
 * Final OD pass through Day 6 after the full stream (covers any deferred horizon).
 *
 * @param ledger - Ledger after all user events
 * @param auths - Auth store (unused by fee math; kept for call-site symmetry)
 */
export function finalizeFees(ledger: Ledger, auths: AuthorizationStore): void {
  assessOverdraftFees(ledger, auths, asDay(6));
}
