# Account Ledger Core

In-memory account ledger (TypeScript). No web layer, no database, no UI.

## Setup

```bash
cd ~/Documents/account-ledger-core
npm install
```

## Run the suite

```bash
npm test
```

This runs Vitest: money helpers, full event replay assertions, and one **intentionally failing** acceptance criterion encoded with `it.fails` (see `tests/failing.rejected-criteria.test.ts` and `REJECTED.md`).

## Print the day report

```bash
npm run replay
```

Output is per Day 1–6: closing ledger balances, overdraft fees, authorization state, errors, interest accruals, capitalization, and the full append-only entry log.

## How to read the output

- **closing ledger** — sum of money entries with `value_date ≤ day` (holds excluded)
- **available** — printed when holds remain active (ledger − active holds)
- **overdraft fee** — AED 25.00 once per negative closing day, `value_date` = that day
- **ERROR** — rejected operations (e.g. settlement of unknown Auth-Z)
- **Interest capitalization** — single Day-6 credit equal to the sum of rounded daily accruals

## Docs

| File | Purpose |
|------|---------|
| `NUMBERS.md` | Constants and why those values |
| `AMBIGUITIES.md` | Ambiguities found and resolutions |
| `REJECTED.md` | False acceptance criteria refused |
| `ARCHITECTURE.md` | Part 2 trade-offs |
| `WORKLOG.md` | Timestamped work log |
