# V5-D.2 — E2E Results

---

## Scenario coverage

| Scenario | Staging live | Unit / prototype |
|----------|-------------|------------------|
| 1 — Doubles side-out (10 steps) | ⏸ Pending Edge + UI flag | ✅ V5-B/V5-C tests |
| 2 — Singles even/odd court | ⏸ Pending Edge | ✅ V5-B tests |
| 3 — Multi-device conflict | ⏸ Pending Edge | ✅ Persistence concurrency tests |

---

## UI remote adapter

| Check | Expected | Actual | PASS |
|-------|----------|--------|------|
| `VITE_REFEREE_V5_ENABLED=true` staging only | Remote path | Not exercised on staging URL | ⏸ |
| No silent fallback to `LocalPrototypeAdapter` | Error surfaced | Code path exists | ✅ (code review) |
| Load / reload state | Persisted snapshot | Pending Edge | ⏸ |

---

## Build / lint

| Check | PASS |
|-------|------|
| `npm run build` | ✅ |
| Referee unit tests 123/123 | ✅ |
| Legacy referee RPC 9/9 | ✅ |

---

## Verdict

**E2E staging: P1** — requires Edge deploy + staging preview with `VITE_REFEREE_V5_ENABLED=true`

**Engine/UI prototype: PASS** (unit + local prototype route `/dev/referee-v5`)
