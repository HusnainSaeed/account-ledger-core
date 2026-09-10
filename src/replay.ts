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

export interface ReplayResult {
  readonly ledger: Ledger;
  readonly auths: AuthorizationStore;
  readonly accruals: DailyAccrual[];
}

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
 * Replay only user events through a predicate (for tests that need mid-stream state).
 * Does not capitalize interest unless `withInterest` is true.
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
