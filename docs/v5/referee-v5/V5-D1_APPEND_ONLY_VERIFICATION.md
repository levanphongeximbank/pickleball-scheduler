# V5-D.1 — Append-Only Verification

---

## Requirement

`match_events` is append-only at runtime.

Undo creates new `UNDO_LAST_EVENT` row with `generated_events` containing `EVENT_REVERTED` — never UPDATE/DELETE prior rows.

## Database enforcement (V5-D.1 SQL)

```sql
CREATE TRIGGER trg_match_events_deny_update ...
CREATE TRIGGER trg_match_events_deny_delete ...
```

Triggers raise `APPEND_ONLY_VIOLATION`.

## Why RLS alone is insufficient

Service role bypasses RLS. Triggers fire for all roles including service role — maintenance must use controlled path.

## In-memory test mirror

`InMemoryMatchRepository.updateEventRecord()` / `deleteEventRecord()` return `APPEND_ONLY_VIOLATION`.

## Verification matrix

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Authenticated UPDATE event | Denied (RLS + trigger) |
| 2 | Authenticated DELETE event | Denied |
| 3 | Runtime service UPDATE event | Denied (trigger) |
| 4 | Undo command | PASS — new event |
| 5 | Original events preserved | PASS |

Tests 17–20 in `referee-v5-d1.test.js` — **PASS** (in-memory).

Staging RLS/trigger tests — **NOT RUN**.
