# V5-D.2 — Concurrency & Idempotency Results

---

## Real DB concurrency (Cases A–C)

| Case | Method | Expected | Actual | PASS |
|------|--------|----------|--------|------|
| A — Same expected version | Two concurrent Edge/RPC commits | One success, one `MATCH_STATE_CONFLICT` | Not run (Edge not deployed) | ⏸ P1 |
| B — Double click (same idempotencyKey) | Duplicate requests | Single event, duplicate response | In-memory: **PASS** (unit tests) | ⚠ Unit only |
| C — Idempotency reuse mismatch | Same key, different hash | `IDEMPOTENCY_KEY_REUSE_MISMATCH` | In-memory: **PASS** (unit tests) | ⚠ Unit only |

**Unit test evidence:** `node --test tests/referee-v5/*.test.js` → **123/123 PASS** including concurrency + idempotency suites in `referee-v5-d1.test.js` and `referee-v5-persistence.test.js`.

---

## Staging DB idempotency schema

| Check | PASS |
|-------|------|
| `match_sync_mutations (match_state_id, idempotency_key)` unique | ✅ |
| Commit RPC checks `request_hash` mismatch | ✅ (SQL verified) |

---

## Recommended staging replay (after Edge deploy)

```bash
node scripts/verify-phase-v5d2-concurrency-staging.mjs   # TODO V5-D.2 follow-up
```

---

## Verdict

| Gate | Status |
|------|--------|
| Real DB optimistic locking | **P1** — pending Edge + harness |
| Real DB idempotency | **P1** — pending Edge + harness |
| In-memory / unit parity | **PASS** |

**Overall: CONDITIONAL** — schema + RPC logic ready; runtime concurrency proof deferred to Edge deploy.
