/**
 * Test/harness helpers for mid-stream snapshots.
 * Kept out of `src/` so production modules stay domain-facing.
 */

import { applyEvent, finalizeFees } from "../../src/apply.js";
import { AuthorizationStore } from "../../src/authorizations.js";
import { Ledger } from "../../src/ledger.js";
import {
  capitalizeInterest,
  computeDailyAccruals,
  type DailyAccrual,
} from "../../src/policies/interest.js";
import type { ReplayResult } from "../../src/replay.js";
import { EVENT_STREAM } from "../../src/stream.js";
import type { StreamEvent } from "../../src/types.js";

/**
 * Applies events while `predicate` returns true, then finalizes fees.
 * Optional interest capitalization for end-state checks.
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
