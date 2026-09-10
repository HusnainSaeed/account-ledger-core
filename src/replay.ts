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

/** Outcome of a full replay (ledger, auths, daily accruals). */
export interface ReplayResult {
  readonly ledger: Ledger;
  readonly auths: AuthorizationStore;
  readonly accruals: DailyAccrual[];
}

/**
 * Replays the event stream (default E1–E10), then fees + interest.
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
