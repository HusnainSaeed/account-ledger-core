/**
 * Shared domain types for the in-memory ledger.
 * Days are integers 1..6 to match the assessment window — not calendar dates.
 */

export type Day = 1 | 2 | 3 | 4 | 5 | 6;

export type AccountId = "ACC-001" | "ACC-002";

export type CurrencyCode = "AED" | "BHD";

/** Money is always stored as integer minor units (fils) for the account's currency. */
export type MinorUnits = bigint;

export type EntryKind =
  | "CREDIT"
  | "DEBIT"
  | "OVERDRAFT_FEE"
  | "INTEREST_CAPITALIZATION"
  | "REVERSAL";

/**
 * Append-only money movement. Holds never become LedgerEntry rows —
 * they live only in the authorization store until settlement/release.
 */
export interface LedgerEntry {
  readonly id: string;
  readonly accountId: AccountId;
  readonly kind: EntryKind;
  /** Business day the amount counts toward closing balance. */
  readonly valueDate: Day;
  /** Day the event was booked / observed in the stream. */
  readonly bookedOn: Day;
  /** Signed minor units: credits positive, debits/fees negative. */
  readonly amountMinor: MinorUnits;
  readonly currency: CurrencyCode;
  /** Optional link (e.g. reversal → original debit id, settlement → auth id). */
  readonly ref?: string;
}

export type AuthorizationStatus = "ACTIVE" | "SETTLED" | "REJECTED";

export interface Authorization {
  readonly authId: string;
  readonly accountId: AccountId;
  readonly holdMinor: MinorUnits;
  readonly currency: CurrencyCode;
  readonly valueDate: Day;
  readonly bookedOn: Day;
  status: AuthorizationStatus;
}

export interface LedgerError {
  readonly bookedOn: Day;
  readonly code: string;
  readonly message: string;
  readonly ref?: string;
}

export type StreamEvent =
  | {
      readonly id: string;
      readonly kind: "CREDIT" | "DEBIT";
      readonly accountId: AccountId;
      readonly bookedOn: Day;
      readonly valueDate: Day;
      readonly amountMinor: MinorUnits;
      readonly currency: CurrencyCode;
    }
  | {
      readonly id: string;
      readonly kind: "AUTHORIZATION";
      readonly accountId: AccountId;
      readonly bookedOn: Day;
      readonly valueDate: Day;
      readonly authId: string;
      readonly holdMinor: MinorUnits;
      readonly currency: CurrencyCode;
    }
  | {
      readonly id: string;
      readonly kind: "SETTLEMENT";
      readonly accountId: AccountId;
      readonly bookedOn: Day;
      readonly valueDate: Day;
      readonly authId: string;
      readonly settleMinor: MinorUnits;
      readonly currency: CurrencyCode;
    }
  | {
      readonly id: string;
      readonly kind: "REVERSAL";
      readonly accountId: AccountId;
      readonly bookedOn: Day;
      /** valueDate of the compensating entry — mirrors the original. */
      readonly valueDate: Day;
      readonly reversesEventId: string;
    }
  | {
      readonly id: string;
      readonly kind: "INSTALMENT_CREDIT";
      readonly accountId: AccountId;
      readonly bookedOn: Day;
      readonly valueDate: Day;
      readonly totalMinor: MinorUnits;
      readonly parts: number;
      readonly currency: CurrencyCode;
    };

export interface AccountSpec {
  readonly id: AccountId;
  readonly currency: CurrencyCode;
  readonly scale: number;
  readonly openingMinor: MinorUnits;
}

export const WINDOW_DAYS: readonly Day[] = [1, 2, 3, 4, 5, 6];

export const ACCOUNTS: Record<AccountId, AccountSpec> = {
  "ACC-001": {
    id: "ACC-001",
    currency: "AED",
    scale: 2,
    openingMinor: 0n,
  },
  "ACC-002": {
    id: "ACC-002",
    currency: "BHD",
    scale: 3,
    openingMinor: 0n,
  },
};

/** Overdraft fee is AED-denominated per the brief (25.00). */
export const OVERDRAFT_FEE_AED_MINOR = 2500n;

/**
 * 0.04% per day = 4 / 10_000 of closing balance.
 * Stored as rational so we never multiply by a float.
 */
export const DAILY_INTEREST_NUMERATOR = 4n;
export const DAILY_INTEREST_DENOMINATOR = 10_000n;
