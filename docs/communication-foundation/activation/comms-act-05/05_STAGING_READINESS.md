# COMMS-ACT-05 — Staging Readiness

## Target

| Item | Value |
|------|-------|
| Staging ref | `qyewbxjsiiyufanzcjcq` |
| Production ref | `expuvcohlcjzvrrauvud` (**blocked**) |

## Gate A — Runtime readiness

- [x] Trusted backend host files under `api/communication/`
- [x] Environment binding helpers (Staging allowlist / Production block)
- [x] Server-only secret boundary
- [x] Canonical SQL/catalog assumptions from ACT-02/04 (14 tables; Club SELECT active)
- [x] Rollback/cleanup plan authored

## Gate B — Fresh backup

Remote Staging smoke **writes** → requires **new** ACT-05 backup.  
**Do not** use ACT-04 backup as primary.

Owner action: run out-of-repo backup script; set evidence env before live smoke.

## Gate C — Identity/data readiness (read-only)

Audit only — no new auth users, no membership mutations in readiness:

- Existing Staging auth identities
- Direct participant candidates
- Active / inactive Club members
- Club owner/manager via `club_governance_assignments`
- Tenant boundaries
- Existing Communication rows + collision risk vs `COMMS_ACT_05_SMOKE_FIXTURE_`

## Mutation policy

`remoteMutateAllowed = false` until Owner sends exactly:

`OWNER GO COMMS-ACT-05 STAGING TRUSTED_BACKEND_SMOKE_ONLY`

ACT-04 GO is **not** valid for ACT-05.
