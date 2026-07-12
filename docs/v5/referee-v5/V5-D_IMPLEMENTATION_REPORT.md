# V5-D — Implementation Report

**Date:** 2026-07-12  
**Phase:** V5-D — Persistence, RPC, RLS (DRAFT)  
**Owner gate:** CONDITIONAL GO — draft only

---

## 1. Summary

Referee V5-D connects the V5-B domain engine to a transactional persistence layer using **Approach C** (Postgres locks + JS engine). All mutations flow through `RefereeV5PersistenceService`; clients send intent commands only.

Legacy referee module is **unchanged**.

---

## 2. Code delivered

| Path | Description |
|------|-------------|
| `persistence/RefereeV5PersistenceService.js` | Command apply, finalize, replay verify |
| `persistence/InMemoryMatchRepository.js` | Lock queue, events, idempotency |
| `persistence/validateCommandPayload.js` | Reject official fields + MLP |
| `persistence/validatePersistedState.js` | Post-engine validation |
| `persistence/refereeV5Authorization.js` | Assignment + tenant auth |
| `persistence/errors.js` | Error codes + VI messages |
| `persistence/auditLog.js` | Audit entry builder |
| `persistence/matchStateSerializer.js` | Serialize/hash state |
| `adapters/LocalPrototypeAdapter.js` | V5-C prototype |
| `adapters/RemotePersistenceAdapter.js` | Remote path + conflict handling |
| `services/refereeV5RpcService.js` | Supabase RPC client stub |

---

## 3. Tests

| Suite | Result |
|-------|--------|
| `tests/referee-v5/referee-v5-persistence.test.js` | **50/50 PASS** |
| Supabase integration | NOT RUN |
| RLS on staging | NOT RUN |

---

## 4. SQL

| File | Status |
|------|--------|
| `PHASE_V5D_REFEREE_PERSISTENCE.sql` | DRAFT — NOT APPLIED |

Builds on `PHASE_V5A_REFEREE_FOUNDATION.sql`. Adds columns, RLS policies, RPC shells.

---

## 5. Feature flag

```text
VITE_REFEREE_V5_ENABLED=false
```

Prototype UI continues on `LocalPrototypeAdapter`. Remote adapter available for staging wiring.

---

## 6. Known gaps (by design)

| Item | Status |
|------|--------|
| Edge Function commit path | Spec + SQL shell only |
| Token access for V5 | Not enabled |
| HEAD_REFEREE extra grants | Design only |
| Rating V5 hook | Design only |
| Bracket integration | Hook stub, not invoked |
| MLP rally scoring | Rejected |

---

## 7. Owner review checklist

- [ ] Schema patches vs V5-A overlap
- [ ] Idempotency via `match_sync_mutations`
- [ ] RPC transaction boundaries
- [ ] RLS SELECT / deny-write policies
- [ ] Grants (authenticated execute, no anon write)
- [ ] Rollback plan
- [ ] Edge Function ownership for engine commit

---

## 8. Recommended next action

**OWNER REVIEW BEFORE STAGING APPLY**

After GO: apply V5-A + V5-D on staging, deploy Edge Function, run integration + RLS suite.
