# NUMBERS.md

Every constant chosen in this implementation, and why not a nearby alternative.

## Currency scales

| Currency | Scale | Minor unit |
|----------|-------|------------|
| AED | **2** | fils (0.01) |
| BHD | **3** | fils (0.001) |

**Why not floats?** Binary floating point cannot represent `0.01` / `0.001` exactly. A ledger that stores `number` will eventually fail a fils-level checksum in defense. We store `bigint` minor units only.

**Why not scale 4 “for safety”?** The brief fixes AED at 2 and BHD at 3. Extra scale invents precision the products do not have and breaks instalment / fee display.

## Overdraft fee

- **Value:** `OVERDRAFT_FEE_AED_MINOR = 2500` → **AED 25.00**
- **Why not 12.50?** The brief states 25.00; half would understate the assessed fee and fail any gold expected total.
- **Currency:** AED only (ACC-001). ACC-002 is BHD; the brief’s fee is AED-denominated.

## Daily interest rate

- **Value:** `0.04% per day` = **4 / 10_000** (`DAILY_INTEREST_NUMERATOR / DAILY_INTEREST_DENOMINATOR`)
- **Why a rational, not `0.0004` float?** Same float hazard as money; integer multiply-then-divide keeps accruals deterministic.
- **Why not half (0.02%)?** Spec is 0.04%; changing it changes capitalization and the defense numbers.

## Interest rounding

- **Mode:** half-up away from zero on non-negative accruals: `(balance * 4 + 5000) / 10000` in integer math.
- **Why not banker’s rounding?** Brief requires rounded dailies to sum exactly to the capitalized credit. We define capitalization **as** that sum, so rounding mode only needs to be stable and stated. Half-up is the common retail-banking default and easy to defend.
- **Why not truncate?** Truncation systematically under-accrues; still valid if capitalized = sum, but half-up matches “0.04% of closing” intuition better at half-fils boundaries.

## Instalment split (E10)

- **Method:** remainder-on-last. `floor(total / parts)` for the first `parts - 1` shares; last share gets the residual.
- **BHD 10.000 / 3 → 3.333 + 3.333 + 3.334**
- **Why not three × 3.334?** `3.334 × 3 = 10.002` invents 0.002 BHD.
- **Why not three × 3.333?** `3.333 × 3 = 9.999` destroys 0.001 BHD.
- **Why remainder on last (not largest-remainder / Hamilton)?** For equal instalments with `parts = 3` and a 1-fils remainder, both put the extra fils on one share; last-share is the simplest deterministic rule to explain in a defense.

## Window

- **Days:** 1..6 inclusive.
- **Why not a real calendar?** The assessment defines an abstract six-day window; mapping to dates adds no correctness and invites timezone noise.

## Authorization IDs

- **Auth-A, Auth-B, Auth-Z** — string identifiers from the brief, not hashed or normalized. Case-sensitive exact match so Auth-Z cannot silently alias.
