# Gate 8 — Operational Controls Matrix

**Baseline SHA:** `1c595fc73ee405e626f46373fe465c8bed338314`  
**Production ref:** `expuvcohlcjzvrrauvud`  
**Mode:** Evidence audit only

## Controls

| Control | Evidence | Result | Notes |
|---------|----------|--------|-------|
| Authentication | Supabase Auth + route guards in source; auth tests PASS (sample suites available) | PASS (source/tests) | Live session smoke not Owner-credentialed in Gate 8 |
| RBAC | `isRbacEnabledFromEnv()` Prod default true if unset; unit suites 96 PASS | GAP | Effective Vercel `VITE_RBAC_ENABLED` value unreadable without env access |
| Tenant isolation | Clubs RLS post-apply negative matrix PASS; catalog allowlist retained | PASS | B-CLUBS-RLS-01 RESOLVED |
| Audit logging | `audit_logs` / identity Phase C present in product | PARTIAL | Platform IR retention SSOT incomplete (PGO-02) |
| Error handling | Foundation error-registry lock OK | PASS | |
| Fail-open / fail-closed | Public catalog RPC failure typed fail (tests); Clubs select fail-closed to membership helpers | PASS (tested paths) | Not universal claim for all modules |
| Secret boundaries | Browser bundles must not embed service_role; scan reviewed | PASS_WITH_REVIEW | Hits limited to tests/scripts/docs patterns |
| Service-role isolation | Service-role intended for Edge/worker/admin paths only | PASS (architecture) | Bundle-level service-role key presence: not proven absent via env read (unreadable) |
| Backup ownership | Owner + Supabase Pro org | PASS (Owner-supplied) | |
| Scheduled backups | Owner-verified active; retention 7 days | PASS (Owner-supplied) | |
| Recovery exception register | See `04_RECOVERY_EXCEPTION_REGISTER.md` | EXCEPTION preserved | |
| Incident response | PGO-02 model present; live roster not in-repo | GAP | |
| Monitoring / observability | ECO-05 structural; platform IR dashboards not PASS | GAP | |
| Release rollback | Vercel prior Production deploys exist (`df8a1dfb`, `adc43eb3`, …) | PASS (capability) | No Gate 8 rollback drill executed |
| Dependency / build reproducibility | `npm ci` + lock hashes recorded; build PASS | PASS | |
| Environment separation | Staging `qyewbxjsiiyufanzcjcq` vs Prod `expuvcohlcjzvrrauvud` documented | PASS | |
| Production change ledger | See `05_PRODUCTION_CHANGE_LEDGER.md` | PASS (recorded) | |

## Explicit preserved markers (must not be silently cleared)

```text
PITR=NOT_ENABLED
LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED
STORAGE_OBJECT_RECOVERY=NOT_COVERED
```

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_8_OPERATIONAL_CONTROLS_RECORDED`
