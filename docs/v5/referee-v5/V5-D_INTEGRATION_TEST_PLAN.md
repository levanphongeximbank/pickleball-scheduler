# V5-D — Integration Test Plan

**Status:** DRAFT  
**Phase 1 (now):** In-memory service tests — **50/50 PASS**  
**Phase 2 (staging):** NOT RUN — awaits owner GO

---

## 1. Test matrix (owner spec §16)

### 16.1 Integration (in-memory ✅)

| # | Scenario | File | Status |
|---|----------|------|--------|
| 1 | Load match state | `referee-v5-persistence.test.js` | PASS |
| 2 | Assigned referee rally | | PASS |
| 3 | Unassigned rejected | | PASS |
| 4 | Player rejected | | PASS |
| 5 | Other tenant rejected | | PASS |
| 6 | One event per command | | PASS |
| 7 | Snapshot updated | | PASS |
| 8 | Atomic event + snapshot | | PASS |
| 9 | Engine = persisted | | PASS |
| 10–12 | Reload server/receiver/direction | | PASS |
| 13 | Switch ends identities | | PASS |
| 14–15 | Undo revert / no delete | | PASS |

### 16.2 Concurrency (in-memory ✅)

| # | Scenario | Status |
|---|----------|--------|
| 16 | Same version — one wins | PASS |
| 17 | Loser gets CONFLICT | PASS |
| 18–20 | No overwrite, no dup sequence | PASS |

### 16.3 Idempotency (in-memory ✅)

| # | Scenario | Status |
|---|----------|--------|
| 21–24 | Double click / retry | PASS |
| 25 | Finalize twice → one result | PASS |

### 16.4 RLS (in-memory intent ✅ / Supabase NOT RUN)

| # | Scenario | In-memory | Supabase |
|---|----------|-----------|----------|
| 26–35 | Policy scenarios | PASS (JS mirror) | NOT RUN |

### 16.5 Finalize (in-memory ✅)

| # | Scenario | Status |
|---|----------|--------|
| 36–45 | Finalize guards + hooks | PASS |

### 16.6 Regression

| Suite | Target | Status |
|-------|--------|--------|
| V5-B engine | 36+ tests | Run in CI |
| V5-C UI | 36 tests | Run in CI |
| Legacy referee RPC | 16 tests | Run in CI |
| Build | `npm run build` | Run |
| Lint | `npm run lint` | Run |

---

## 2. Staging integration (post GO)

1. Apply `PHASE_V5A` then `PHASE_V5D` on staging
2. Deploy Edge Function wrapping `RefereeV5PersistenceService`
3. Run `scripts/verify-referee-v5-persistence-staging.mjs` (to be added)
4. Two-browser manual smoke on assigned match
5. RLS probe with referee + player JWT fixtures

---

## 3. Snapshot replay verification

Automated in service:

```javascript
service.verifySnapshotMatchesReplay(matchStateId)
// rebuildMatchState(initial, events) === snapshot
```

Mandatory FAIL if divergence detected before finalize.

---

## 4. Exit criteria for staging GO

- 50/50 in-memory PASS ✅
- Staging RPC E2E PASS
- RLS 26–35 PASS on real Supabase
- V5-B, V5-C, legacy regression PASS
- Owner sign-off on SQL + grants

**Current verdict:** Draft complete — **OWNER REVIEW BEFORE STAGING APPLY**
