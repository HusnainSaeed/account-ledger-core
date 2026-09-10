# NUMBERS.md

Constants chosen in this implementation, and why not a nearby alternative.

## Currency scales

| Currency | Scale | Minor unit |
|----------|-------|------------|
| AED | **2** | fils (0.01) |
| BHD | **3** | fils (0.001) |

**Why not floats?** Binary floating point cannot represent `0.01` / `0.001` exactly. Storing amounts as `number` risks silent fils-level drift. This implementation stores `bigint` minor units only.

**Why not scale 4 “for safety”?** The specification fixes AED at 2 and BHD at 3. Extra scale invents precision the products do not have and breaks instalment / fee display.

## Overdraft fee

- **Value:** `OVERDRAFT_FEE_AED_MINOR = 2500` → **AED 25.00**
- **Why not 12.50?** The specification states 25.00; half would understate the assessed fee.
- **Currency:** AED only (ACC-001). ACC-002 is BHD; the stated fee is AED-denominated.

## Daily interest rate

- **Value:** `0.04% per day` = **4 / 10_000** (`DAILY_INTEREST_NUMERATOR / DAILY_INTEREST_DENOMINATOR`)
- **Why a rational, not `0.0004` float?** Same float hazard as money; integer multiply-then-divide keeps accruals deterministic.
- **Why not half (0.02%)?** Spec is 0.04%; changing it changes capitalization totals.

## Interest rounding

- **Mode:** half-up on non-negative accruals: `(balance * 4 + 5000) / 10000` in integer math.
- **Why not banker’s rounding?** Spec requires rounded dailies to sum exactly to the capitalized credit. Capitalization **is** that sum, so the rounding mode only needs to be stable and stated. Half-up is a common retail-banking default.
- **Why not truncate?** Truncation systematically under-accrues; still valid if capitalized = sum, but half-up matches “0.04% of closing” at half-fils boundaries more naturally.

## Instalment split (E10)

- **Method:** remainder-on-last. `floor(total / parts)` for the first `parts - 1` shares; last share gets the residual.
- **BHD 10.000 / 3 → 3.333 + 3.333 + 3.334**
- **Why not three × 3.334?** `3.334 × 3 = 10.002` invents 0.002 BHD.
- **Why not three × 3.333?** `3.333 × 3 = 9.999` destroys 0.001 BHD.
- **Why remainder on last (not largest-remainder / Hamilton)?** For equal instalments with `parts = 3` and a 1-fils remainder, both put the extra fils on one share; last-share is the simplest deterministic rule.

## Window

- **Days:** 1..6 inclusive.
- **Why not a real calendar?** The problem defines an abstract six-day window; mapping to calendar dates adds no correctness and invites timezone noise.

## Authorization IDs

- **Auth-A, Auth-B, Auth-Z** — string identifiers from the specification, not hashed or normalized. Case-sensitive exact match so Auth-Z cannot silently alias.
