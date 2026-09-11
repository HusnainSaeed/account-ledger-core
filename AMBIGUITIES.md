# AMBIGUITIES.md

Specification gaps found during implementation, and how each was resolved in this codebase.

## 1. Stream order vs booking day (E10 after E9)

**Ambiguity:** E10 is booked on Day 5 but appears *after* E9 (Day 6) in the mandatory replay order.

**Resolution:** Process strictly in stream order E1→E10. Booking day is metadata for reporting and fee `bookedOn`; it does not reorder the stream. Day reports are projections over the append-only log after the full replay (plus interest capitalization).

**Rejected alternative:** Bucket events by `bookedOn` then play Day 1..6. That would run E10 before E9 and violate “replayed in this order.”

## 2. What “day assessed” means for overdraft `value_date`

**Ambiguity:** Fee is “booked with value_date equal to the day assessed.” Is that the day whose close is negative (Day 2), or the processing day when the imbalance was detected (Day 5 for E7)?

**Resolution:** `value_date` = the **day whose closing balance is negative** (the economic day). `bookedOn` records when the fee row was appended (the processing horizon). “Once per day per account” is therefore keyed to the close being charged.

## 3. Fee re-scan after backdated posts

**Ambiguity:** When E7 backdates a debit to Day 2, do we only fee Day 2, or every day whose recomputed close is now negative?

**Resolution:** Re-scan days 1..`throughDay` after money movements and book a missing fee for **each** negative close (stabilizing loop). E7 makes Day 2 and Day 4 (and Day 5) negative before fees — so multiple fees. See REJECTED.md.

## 4. Settlement amount vs hold amount

### 4a. Settle less than hold (Auth-A: 185 vs 200)

**Ambiguity:** Settle 185 against a 200 hold — reduce hold by 185 and leave 15 active, or debit 185 and release the entire hold?

**Resolution:** **Debit settlement amount; release the entire hold** (capture-then-close). Matches common card partial-capture behaviour and treats Auth-A as a completed authorization lifecycle.

**Rejected alternative:** Leave a residual 15 hold — invents an open authorization the stream never settles.

### 4b. Settle greater than hold (not in the event stream)

**Ambiguity:** If settlement exceeds the reserved hold, should the core reject, require an incremental authorization first, or debit the full settle amount anyway?

**Related concern:** If over-settlement were allowed, the excess (`settle − hold`) is unreserved spend. Available would need a fresh check after releasing the hold (or against ledger − other holds) before debiting the excess; insufficient available should surface an error rather than silently overdrawing via settlement.

**Resolution (scope):** Only **settle ≤ hold** is exercised (Auth-A). No over-settlement case is provided. This implementation does **not** add a `settle > hold` guard or an excess-available check — either would invent product policy beyond what is specified.

**Production stance (documented, not coded):** Prefer reject (`SETTLEMENT_EXCEEDS_HOLD`) or require incremental auth to raise the hold, then settle. If a scheme truly allows over-capture, gate the excess on available and error when it would not clear. See also ARCHITECTURE.md cuts.

## 5. Unknown authorization settlement (Auth-Z)

**Ambiguity:** Reject only, or reject and still post a free-standing debit?

**Resolution:** Reject with error; **no ledger debit**. Funds must not leave.

## 6. Does reversing E7 reverse consequential overdraft fees?

**Ambiguity:** Whether a reversal of the originating debit should also unwind fees that were assessed because of it.

**Resolution:** Reversal appends a compensating entry for E7 only. Fees already appended stay (append-only; no silent delete; no implied fee cascade). Pre-E7 fee count was zero; after E9 those fee rows remain → see REJECTED.md.

**Rejected alternative:** Auto-post fee reversals when the originating debit reverses — not stated in the non-negotiable rules; would weaken append-only discipline.

## 7. Auth-B approval after E7 left the ledger negative

**Ambiguity:** After E7, value-dated ledger as of Day 5 is negative. The rule says approve an authorization only if available stays ≥ 0 after the hold. That rejects Auth-B. Notes that “Auth-B is never settled” and the conditional criterion “If Auth-B is approved…” do not require approval.

**Resolution:** Apply the available-balance rule strictly → **Auth-B is rejected** with `AUTH_REJECTED_INSUFFICIENT_AVAILABLE`. Hold semantics (reduces available, not ledger) are still demonstrated by Auth-A while it was active.

**Abandoned approach:** Invent a second “booking balance” that ignores backdates for auth checks — not in the specification; would approve Auth-B only by bypassing the stated rule.

## 8. Interest base: before or after overdraft fees?

**Ambiguity:** Is “closing ledger balance” for interest pre-fee or post-fee?

**Resolution:** **Post-fee** closes. Fees are ledger entries with value dates; excluding them would invent a shadow close. Accrue only when that close is strictly positive.

## 9. When is interest capitalized relative to Day-6 events?

**Ambiguity:** Capitalize using closes before or after the capitalization credit itself?

**Resolution:** Compute all daily accruals from the ledger **after** user events + OD fees, **then** append one capitalization credit per account. Day-6 accrual therefore does not include the capitalization row. Capitalized total := sum of rounded dailies.

## 10. BHD instalment equal split

**Ambiguity:** “Three equal instalments” of 10.000 at 3 dp cannot be three identical amounts.

**Resolution:** Remainder-on-last → 3.333 + 3.333 + 3.334. See REJECTED.md for the refused “each must be 3.334” claim.

## 11. Available balance “as of” which day during auth?

**Ambiguity:** `bookedOn` vs `valueDate` of the authorization.

**Resolution:** Use ledger `balanceAsOf(bookedOn)` minus active holds — the authorization decision is made on the booking day in stream time.

## 12. Concurrency

**Ambiguity:** None in scope; single-threaded replay. Called out as a deliberate cut in ARCHITECTURE.md.
