# Architecture & Trade-offs

Decisions and production trade-offs from this in-memory ledger core.

## 1. Append-only at scale

### What breaks first at ~100× volume?

Two things fail in order:

1. **Latency** — every balance and overdraft check scans the full entry list (`O(n)` per query). Backdated posts make that worse because we re-scan many days after each change.
2. **Memory** — the entry log, hold map, and error list all grow without bound in process RAM.

On a small single-process core, **CPU/latency usually hurts before out-of-memory**.

### Where unbounded state accumulates

| Structure | What it holds |
|-----------|----------------|
| Ledger entry array | Every money movement (never deleted) |
| Authorization map | Holds by auth id |
| Error log | Rejected operations |

Balances are **recomputed** from the log. We do not keep daily snapshots, so cost rises with history length.

### Cheapest fix that keeps the same semantics

Do **not** change append-only rules. Add a cheap index:

- **Per-account daily balance checkpoints** (or value-date buckets) updated on each append
- Then `balanceAsOf(day)` is roughly **O(1)** / **O(log n)** instead of a full scan
- Optionally move old entries to disk and keep checkpoints hot in memory

Same events and meanings; only the lookup path changes.

---

## 2. Value-dated entries in production (UAE-licensed bank)

### What value dates create operationally

`bookedOn` and `valueDate` can differ. When they do, **past closing balances can change after the fact**.

In this codebase that immediately:

- Reassesses overdraft fees on affected days
- Restates daily interest (including after corrective / reversing entries with an earlier value date)

In a UAE-licensed bank, that same behaviour shows up as:

- Customer statement restatements and complaints
- Shifted profit / interest recognition
- Risk to CBUAE (and other) reports that assumed a day was closed
- Harder AML monitoring when economic date ≠ posting date
- Disputes when a fee appears “for a past day” after a later backdated post

### One control before go-live

**Maker-checker + hard backdating window**

- Value date cannot go earlier than **N business days**, and cannot enter a **closed GL period**, without a second approver
- Keep an **immutable audit** of who authorized the backdate
- Queue auto-generated fees/interest from backdates for **review** before they are customer-visible

---

## 3. Authorization lifecycle — endings other than matching settlement

Today an auth is either:

- **Approved** → active hold, or
- **Settled** → hold released and a debit posted, or
- **Never approved** (e.g. insufficient available)

Production needs explicit endings beyond “matching settlement”:

| Ending | Real-world case | Required system behaviour |
|--------|-----------------|---------------------------|
| **Expiry / TTL** | Card auth not captured in time | Release hold; record `AUTH_EXPIRED`; available goes up; **no** debit |
| **Merchant void** | Merchant cancels the pre-auth | Release hold (`AUTH_RELEASE`); **no** debit |
| **Partial capture** | Capture < hold (Auth-A: 185 on 200) | Debit the capture amount; **release the whole** remaining hold |
| **Over-capture** | Capture > hold | **Out of scope here.** Prefer reject or incremental auth first. If allowed, check available for the excess and error if it would not clear. See AMBIGUITIES.md §4b |
| **Incremental replace** | Hotel / car rental top-up | Raise or replace hold only if available allows; else reject |
| **Ops force-release** | Fraud, stuck hold, chargeback prep | Privileged `AUTH_FORCE_RELEASE` with audit — never silent delete |
| **Account closure** | Close while a hold is open | Block close until holds clear, or force-release under policy then close |

**Scope note:** this build has no expiry/void path. Auth-B is rejected when available would go negative after a backdated debit. Those are cuts, not production recommendations.

---

## 4. What you cut and why

| What we cut | Why (this core) | Risk if left as-is in production |
|-------------|-----------------|----------------------------------|
| Persistence / multi-process HA | In-memory only by design | Restart loses the ledger |
| Concurrency / locking | Single-threaded replay | Parallel auths can race on available balance |
| FX / cross-currency | One currency per account | Cross-currency auth/settle undefined |
| Fee reversal when a debit reverses | Append-only; reversal does not cascade to fees | Customer may keep OD fees after a correcting entry |
| Auth expiry / void | Only approve → settle (or leave open) | Stuck holds reduce available forever |
| `settle > hold` guard + excess available check | Only settle ≤ hold is exercised | Over-capture can debit unreserved funds with no error |
| Double-entry GL | Single-sided account ledger | Cannot prove the book to bank GL |
| Idempotency keys | Deterministic local fixtures | Retries can double-post |
| Indexed / checkpoint balances | Tiny window; full scan is fine | Latency collapses at volume (see §1) |
| Continuous interest posting | One capitalization at window end | Does not match real period-end schedules |

---

## Traceability

These claims map to the code:

- Full-scan balances → `ledger.ts`, `policies/overdraft.ts`
- Holds / available → `authorizations.ts`
- Missing DB, TTL worker, GL, etc. → absent modules (intentional cuts)
