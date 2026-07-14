# TT-11 — Rollback Runbook

**Production impact:** NONE until owner executes on target environment

---

## Decision authority

| Severity | Decision maker |
|----------|----------------|
| P0 — tournament cannot continue | Product owner + Tech lead |
| P1 — single role blocked | Tech lead |
| P2 — UX/reporting | QA lead — defer rollback |

---

## Scenario matrix

### R01 — Preview deployment error

| Field | Detail |
|-------|--------|
| Symptom | Preview build broken; pages 500 |
| Verify | Vercel deployment log; browser console |
| Workaround | Pin previous Preview deployment |
| Rollback | Redeploy last known-good Preview SHA |
| Data to preserve | None (no schema change) |
| Owner | Tech lead |

### R02 — Cloud RPC error

| Field | Detail |
|-------|--------|
| Symptom | All lineup/result RPCs fail |
| Verify | Supabase logs; `team_tournament_*` RPC response |
| Workaround | Switch to blob legacy mode if flag allows (owner only) |
| Rollback | Revert SQL migration / disable cloud_primary |
| Data | Export command log before switch |
| Owner | Tech lead |

### R03 — Data mismatch (blob vs cloud)

| Field | Detail |
|-------|--------|
| Symptom | Shadow compare diffs exceed threshold |
| Verify | Shadow compare script output |
| Workaround | Stop writes; read from blob |
| Rollback | Set data mode to `legacy` |
| Owner | Product owner |

### R04 — Captain portal failure

| Field | Detail |
|-------|--------|
| Symptom | Captains cannot submit lineup |
| Verify | TT-9 captain checklist failure |
| Workaround | BTC manual lineup entry (if available) |
| Rollback | Revert frontend deploy |
| Owner | Tech lead |

### R05 — Referee portal failure

| Field | Detail |
|-------|--------|
| Symptom | Referee cannot confirm scores |
| Verify | Token RPC; referee session |
| Workaround | Paper scoresheet + manual BTC entry |
| Rollback | Revert referee portal deploy |
| Owner | Tech lead |

### R06 — Realtime sync failure

| Field | Detail |
|-------|--------|
| Symptom | Stale scores on director view |
| Verify | Realtime channel subscription |
| Workaround | Manual refresh; polling fallback |
| Rollback | Disable realtime-dependent UI flag |
| Owner | Tech lead |

### R07 — Result conflict storm

| Field | Detail |
|-------|--------|
| Symptom | Many version_conflict errors |
| Verify | Command log; concurrent editors |
| Workaround | Single editor policy; lock UI |
| Rollback | Pause result entry; restore backup snapshot |
| Owner | Product owner |

### R08 — Network outage at venue

| Field | Detail |
|-------|--------|
| Symptom | All clients offline |
| Verify | External connectivity |
| Workaround | CSV fallback (`fallback/*.csv`) |
| Rollback | N/A — manual mode |
| Owner | BTC on-site |

### R09 — Emergency manual mode

| Field | Detail |
|-------|--------|
| Symptom | Multiple P0 simultaneously |
| Verify | Incident commander assessment |
| Workaround | Complete tournament on paper + CSV |
| Rollback | Post-event data import (planned separately) |
| Owner | Product owner |

---

## Post-rollback

- [ ] Incident logged (`TT11_INCIDENT_RUNBOOK.md`)
- [ ] Backup integrity confirmed
- [ ] Postmortem scheduled within 48h
- [ ] Feature flags restored to safe defaults
