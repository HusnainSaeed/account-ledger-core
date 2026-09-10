# WORKLOG.md

Timestamped work log for the assessment build.

| When (local) | What |
|--------------|------|
| 2026-09-10 23:20 | Plan locked; `create_project` MCP hung — switched to direct file writes under `~/Documents/account-ledger-core` |
| 2026-09-10 23:25 | Scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` |
| 2026-09-10 23:30 | Domain: `types.ts`, `money.ts` (bigint minor units, remainder split), `ledger.ts`, `authorizations.ts` |
| 2026-09-10 23:40 | Policies: overdraft re-scan, interest accrue + capitalize; `apply.ts` exhaustive switch |
| 2026-09-10 23:50 | Stream E1–E10, `replay.ts`, `report.ts`, `main.ts` |
| 2026-09-10 23:55 | Tests: money, replay, intentional `it.fails` rejected criterion |
| 2026-09-11 00:05 | Docs: README, NUMBERS, AMBIGUITIES, REJECTED, ARCHITECTURE, WORKLOG |
| 2026-09-11 00:10 | `npm install`, run suite + replay; local git commits (intact history) |
