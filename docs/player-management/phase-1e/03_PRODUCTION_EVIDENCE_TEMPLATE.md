# 03 — Production Evidence Template (fill during future execution)

> Copy this template into `docs/v5/qa-evidence/player-phase-1e-production/` when executing Production rollout.  
> Do **not** commit secrets, passwords, JWTs, or connection strings.

## Header

| Field | Value |
|-------|-------|
| Date / time (UTC+7) | |
| Executor | |
| Environment | Production |
| Supabase project ref | `expuvcohlcjzvrrauvud` |
| Confirmation re-checked | Yes / No |
| origin/main SHA | |
| Approved migration SHA | |
| Forward SQL checksum (sha256) | |
| Preflight SQL checksum (sha256) | |
| Verify SQL checksum (sha256) | |
| Rollback SQL checksum (sha256) | |

## Gate A — Preflight

| Field | Value |
|-------|-------|
| Method (SQL editor / CLI) | |
| Classification | NOT_APPLIED / PARTIALLY_APPLIED / ALREADY_READY / BLOCKED_UNSAFE |
| Reasons | |
| Blockers | |
| Columns present | |
| Constraints present | |
| Index present | Yes / No |
| Guard present | Yes / No |
| Trigger present | Yes / No |
| privacy_null | |
| verification_null | |
| invalid_handedness | |
| invalid_verification | |
| Guard `current_user=postgres` bypass | Absent / Present |
| Self verification block | Present / Absent |

## Gate B — Backup

| Field | Value |
|-------|-------|
| Backup confirmed | Yes / No |
| Backup location (non-secret) | |
| Export covers Phase 1D columns | Yes / No |

## Gate C — Forward SQL review

| Field | Value |
|-------|-------|
| Reviewer | |
| Additive confirmed | Yes / No |
| Hotfixed guard confirmed | Yes / No |

## Gate D — Owner approval

| Field | Value |
|-------|-------|
| Owner name | |
| Approval timestamp | |
| Approval note | |

## Gate E — Forward SQL execution

| Field | Value |
|-------|-------|
| Executed | Yes / No / Skipped (ALREADY_READY) |
| Result | Success / Failed |
| Error logs (redacted) | |

## Gate F — Verification

| Field | Value |
|-------|-------|
| Verify SQL result | Pass / Fail |
| Schema object inventory attached | Yes / No |
| Null-count checks | |
| RLS/grant confirmation | Match baseline / Drift noted |

## Gate G — Runtime smoke

| Field | Value |
|-------|-------|
| Self demographics allowed | Pass / Fail |
| Self verification denied | Pass / Fail |
| Values restored | Yes / No / N/A |
| False-success observed | No / Yes |

## Gate H — Observation

| Field | Value |
|-------|-------|
| Window start/end | |
| Incidents | None / … |

## Gate I — Rollback

| Field | Value |
|-------|-------|
| Rollback required | **No** / Yes |
| Owner rollback approval | N/A / … |
| Rollback executed | No / Yes |
| Data-loss acknowledged | N/A / Yes |

## Final verdict

- PASS — PRODUCTION READY / APPLIED AND VERIFIED  
- PASS — ALREADY_READY (no apply needed)  
- FAIL — STOPPED  
- FAIL — ROLLED BACK  

Notes:
