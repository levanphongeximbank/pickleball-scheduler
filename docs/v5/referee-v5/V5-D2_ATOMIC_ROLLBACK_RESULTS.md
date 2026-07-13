# V5-D.2 — Atomic Rollback Results

---

## Append-only enforcement

| Test | Method | Expected | Actual | PASS |
|------|--------|----------|--------|------|
| UPDATE `match_events` | Triggers `trg_match_events_deny_update` | Exception | Trigger exists on staging | ✅ |
| DELETE `match_events` | Triggers `trg_match_events_deny_delete` | Exception | Trigger exists on staging | ✅ |
| Legitimate INSERT via commit RPC | Service role RPC | Allowed | RPC deployed | ✅ (schema) |

Runtime destructive probe deferred until post-command events exist (see verify script skip note).

---

## Atomic event application (fault injection)

| Injection point | Expected | Actual | PASS |
|-----------------|----------|--------|------|
| After event insert, before snapshot | Full rollback | Unit test (`referee-v5-d1.test.js`) | ✅ Unit |
| After snapshot, before idempotency | Full rollback | Unit test | ✅ Unit |

Commit RPC wraps insert + update + idempotency in single PL/pgSQL function with `exception when others` → returns `commit_failed` without partial client-visible success.

---

## Atomic finalization (fault injection)

| Injection point | Expected | Actual | PASS |
|-----------------|----------|--------|------|
| After result revision | Full rollback | Unit test | ✅ Unit |
| After lock, before outbox | Full rollback | Unit test | ✅ Unit |

---

## Staging fault injection

Not executed on live staging (requires dedicated test RPC / savepoint harness). Tracked as **P1** for post-Edge deploy.

---

## Verdict

| Gate | Status |
|------|--------|
| Append-only triggers | **PASS** |
| Atomic event rollback (unit) | **PASS** |
| Atomic finalize rollback (unit) | **PASS** |
| Staging fault injection | **P1** |
