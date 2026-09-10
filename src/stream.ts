/**
 * Assessment event stream E1–E10 in mandatory replay order.
 * Amounts are minor units (AED scale 2, BHD scale 3).
 */

import { parseMinor } from "./money.js";
import type { StreamEvent } from "./types.js";

export const EVENT_STREAM: readonly StreamEvent[] = [
  {
    id: "E1",
    kind: "CREDIT",
    accountId: "ACC-001",
    bookedOn: 1,
    valueDate: 1,
    amountMinor: parseMinor("1200.00", "AED"),
    currency: "AED",
  },
  {
    id: "E2",
    kind: "DEBIT",
    accountId: "ACC-001",
    bookedOn: 1,
    valueDate: 1,
    amountMinor: parseMinor("950.00", "AED"),
    currency: "AED",
  },
  {
    id: "E3",
    kind: "AUTHORIZATION",
    accountId: "ACC-001",
    bookedOn: 2,
    valueDate: 2,
    authId: "Auth-A",
    holdMinor: parseMinor("200.00", "AED"),
    currency: "AED",
  },
  {
    id: "E4",
    kind: "CREDIT",
    accountId: "ACC-001",
    bookedOn: 3,
    valueDate: 3,
    amountMinor: parseMinor("400.00", "AED"),
    currency: "AED",
  },
  {
    id: "E5",
    kind: "SETTLEMENT",
    accountId: "ACC-001",
    bookedOn: 4,
    valueDate: 4,
    authId: "Auth-A",
    settleMinor: parseMinor("185.00", "AED"),
    currency: "AED",
  },
  {
    id: "E6",
    kind: "SETTLEMENT",
    accountId: "ACC-001",
    bookedOn: 4,
    valueDate: 4,
    authId: "Auth-Z",
    settleMinor: parseMinor("180.00", "AED"),
    currency: "AED",
  },
  {
    id: "E7",
    kind: "DEBIT",
    accountId: "ACC-001",
    bookedOn: 5,
    valueDate: 2,
    amountMinor: parseMinor("620.00", "AED"),
    currency: "AED",
  },
  {
    id: "E8",
    kind: "AUTHORIZATION",
    accountId: "ACC-001",
    bookedOn: 5,
    valueDate: 5,
    authId: "Auth-B",
    holdMinor: parseMinor("90.00", "AED"),
    currency: "AED",
  },
  {
    id: "E9",
    kind: "REVERSAL",
    accountId: "ACC-001",
    bookedOn: 6,
    valueDate: 2,
    reversesEventId: "E7",
  },
  {
    id: "E10",
    kind: "INSTALMENT_CREDIT",
    accountId: "ACC-002",
    bookedOn: 5,
    valueDate: 5,
    totalMinor: parseMinor("10.000", "BHD"),
    parts: 3,
    currency: "BHD",
  },
];
