# REJECTED.md

Acceptance criteria we refuse, with reasons. Also approaches abandoned mid-build.

## Refused criteria

### 1. “E7 causes exactly one overdraft fee to be assessed, on Day 2.”

**Refused.**

E7 posts AED −620 with `value_date` Day 2. Recomputed closes *before fees*:

| Day | Close before OD fees (approx) |
|-----|-------------------------------|
| 2 | −370.00 |
| 3 | +30.00 |
| 4 | −155.00 |
| 5 | −155.00 |

The non-negotiable rule fees **each** day whose closing ledger is negative (once per day). Day 2 is not alone — Day 4 and Day 5 also qualify when E7 is applied on Day 5. Our implementation books multiple OD fees. Encoded as the intentional failing test in `tests/failing.rejected-criteria.test.ts`.

### 2. “After E9, all balances and fees return to their pre-E7 values.”

**Refused.**

E9 appends a reversal of E7 (append-only). It does **not** delete or reverse overdraft fees that were assessed because E7 made historical days negative. Pre-E7 there were **zero** OD fees; after E9 those fee rows remain. Saying “fees return” requires either mutation/deletion or an unstated fee-cascade — both contradict append-only / stated rules.

### 3. “The three BHD instalments in E10 must each be BHD 3.334.”

**Refused.**

`3.334 × 3 = 10.002 ≠ 10.000`. That invents 0.002 BHD. Correct equal split at 3 dp uses remainder distribution: **3.333 + 3.333 + 3.334**.

### 4. “If the rounded daily interest accruals do not sum to the capitalized total, the remainder is discarded.”

**Refused.**

Non-negotiable rule: rounded daily accruals **must sum exactly** to the capitalized total. Discarding a remainder violates that. Our capitalization credit **is** the sum of the rounded dailies (by construction).

---

## Criteria we accept (for clarity)

- Day 2 closing at end of Day 5 **before fees** = AED −370.00 → `1200 − 950 − 620`.
- Day 4 Auth-A settlement accepted.
- Settlement of unknown auth id rejected; funds do not leave.
- An approved hold reduces available, not ledger (shown with Auth-A; Auth-B is rejected under the available ≥ 0 rule after E7 — see AMBIGUITIES.md §7).

## Approaches abandoned mid-build

1. **Discard interest remainder / adjust last day ad-hoc** — abandoned because it conflicts with exact sum = capitalization; replaced by “capitalized := Σ rounded dailies.”
2. **Ignore backdates when checking available for Auth-B** — abandoned; would approve Auth-B only by inventing a second balance type not in the brief.
3. **Auto-reverse OD fees when E9 posts** — abandoned; not in rules and weakens append-only honesty.
4. **Reorder stream by `bookedOn`** — abandoned; violates mandatory E1→E10 order (E10 after E9).
