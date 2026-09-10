/**
 * Full replay: apply stream in order, finalize fees, accrue + capitalize interest.
 */

import { applyEvent, finalizeFees } from "./apply.js";
import { AuthorizationStore } from "./authorizations.js";
import { Ledger } from "./ledger.js";
import {
  capitalizeInterest,
  computeDailyAccruals,
  type DailyAccrual,
} from "./policies/interest.js";
import { EVENT_STREAM } from "./stream.js";
import type { StreamEvent } from "./types.js";

/** Outcome of a full or partial replay for reports/tests. */
export interface ReplayResult {
  readonly ledger: Ledger;
  readonly auths: AuthorizationStore;
  readonly accruals: DailyAccrual[];
}

/**
 * Replays the assessment stream (default E1–E10), then fees + interest.
 *
 * @param events - Ordered events; defaults to {@link EVENT_STREAM}
 * @returns Ledger, auths, and daily accruals after capitalization
 */
export function replay(events: readonly StreamEvent[] = EVENT_STREAM): ReplayResult {
  const ledger = new Ledger();
  const auths = new AuthorizationStore();

  for (const event of events) {
    applyEvent(ledger, auths, event);
  }

  finalizeFees(ledger, auths);

  const accruals = computeDailyAccruals(ledger);
  capitalizeInterest(ledger, accruals);

  return { ledger, auths, accruals };
}

/**
 * Replays events while `predicate` returns true (mid-stream snapshots for tests).
 * Does not capitalize interest unless `options.withInterest` is true.
 *
 * @param predicate - Called with `(event, index)`; stop when it returns false
 * @param options - Optional event list and interest flag
 * @returns Partial replay state
 */
export function replayThrough(
  predicate: (event: StreamEvent, index: number) => boolean,
  options?: { withInterest?: boolean; events?: readonly StreamEvent[] },
): ReplayResult {
  const events = options?.events ?? EVENT_STREAM;
  const ledger = new Ledger();
  const auths = new AuthorizationStore();

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event || !predicate(event, i)) {
      break;
    }
    applyEvent(ledger, auths, event);
  }

  finalizeFees(ledger, auths);

  let accruals: DailyAccrual[] = [];
  if (options?.withInterest) {
    accruals = computeDailyAccruals(ledger);
    capitalizeInterest(ledger, accruals);
  }

  return { ledger, auths, accruals };
}
