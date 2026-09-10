# ARCHITECTURE.md

Architecture decisions, trade-offs, and production considerations arising from this ledger implementation. Does not restate the event stream or Part 1 rule text.

## 1. Append-only at scale

**What breaks first at ~100× volume?**  
Balance-as-of and overdraft re-scans walk the full in-memory entry array (`O(entries)` per query). After backdated posts we may rescan the whole day window repeatedly. At 100× event volume on this shape, **CPU/latency** fails before we even enjoy the drama of a heap OOM — every auth check and fee pass gets slower with log length. At larger multi-account 100×, the **unbounded in-memory entry list** (plus holds and error log) is the hard memory ceiling.

**Where unbounded state accumulates**  
The append-only ledger array, the authorization map, and the error list are retained for the process lifetime. We recompute projections; we do not store daily balances, so cost grows with history length.

**Cheapest structural change that defers the problem**  
Keep append-only semantics; add **per-account daily balance checkpoints** (or a value-date bucket prefix structure) updated on append. `balanceAsOf(day)` becomes O(1)/O(log n) against checkpoints instead of a full scan. Optionally tier cold entries to disk while hot checkpoints stay resident. No change to event meaning.

## 2. Value-dated entries in production (UAE-licensed bank)

**Operational / regulatory surface this design creates**  
A booking day ≠ value date means historical closes can move after the fact. In this codebase that immediately restates OD fees and interest. In a UAE-licensed bank that surface includes: customer statement restatements and complaints; profit/interest recognition timing; CBUAE / regulatory reporting cutoffs that assumed a closed day; AML transaction monitoring where economic date and posting date diverge; ops dispute handling when a fee appears “for a past day” after a later backdated post.

**One control before go-live**  
**Maker-checker plus a hard backdating window:** value dates may not land earlier than N business days or into a closed GL period without a second approver; immutable audit of who authorized the backdate; auto-generated fees/interest from backdates queued for review before customer-visible release.

## 3. Authorization lifecycle — endings other than matching settlement

In code today an auth is active until settled (or never approved). Production must define every other ending:

| Ending | Real-world scenario | Mandated behaviour |
|--------|---------------------|--------------------|
| Expiry / TTL | Card auth not captured in scheme window | Auto-release hold; append `AUTH_EXPIRED`; available ↑; no debit |
| Merchant void / reverse | Merchant cancels pre-auth | `AUTH_RELEASE`; release hold; no debit |
| Partial capture then close | Capture < hold (our Auth-A shape) | Debit capture; **release entire** remaining hold |
| Incremental replace | Hotel/car rental top-up | Replace hold amount only if available allows; else reject |
| Force clear / ops | Fraud, stuck hold, chargeback prep | Privileged `AUTH_FORCE_RELEASE` with audit; never silent delete |
| Account closure | Close requested while hold open | Block closure until holds clear, or force-release under policy then close |

Part 1 leaves open-ended holds unimplemented (and Auth-B is rejected by available rules after a backdated debit). That is a scope cut, not a claim that open holds are safe in production.

## 4. What you cut and why

| Cut | Why | Production risk deferred |
|-----|-----|--------------------------|
| No persistence / single process | Assessment: in-memory only | Restart loses the ledger; no durability/HA |
| No concurrency control | Single-threaded replay | Parallel auth races on available balance |
| No FX / cross-currency | Accounts are single-currency | Cross-currency auth/settle undefined |
| No fee cascade on reversal | Append-only honesty; reversal ≠ fee delete | Customer may keep OD fees after correcting debit |
| No auth expiry/void in code | Stream only settles or leaves open | Stuck holds starve available |
| No double-entry GL | Single-sided account ledger | Cannot prove balance to bank GL |
| No idempotency keys | Deterministic fixture stream | Duplicate posts on retry |
| Full-scan balances | Six-day toy window | Latency collapse at volume (§1) |
| Interest capitalizes once at window end | Six-day problem window | Mismatch vs continuous/period production schedules |

---

Every claim above maps to this repo: scans in `ledger.ts` / `policies/overdraft.ts`, holds in `authorizations.ts`, cuts visible as absent modules (no DB, no TTL worker, no GL).
