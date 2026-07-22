# 14 — Staging Recovery Evidence (ROLLBACK-ONLY)

**Phase:** CRM Phase 1H-B
**Recovery method:** **ROLLBACK-ONLY RECOVERY** (Owner-approved for Staging first-apply)
**Staging project ref:** `qyewbxjsiiyufanzcjcq`
**Production ref (blocked):** `expuvcohlcjzvrrauvud`
**Backup/PITR claimed:** **NO** (not verified in Dashboard; not required for this method)
**Forward SQL applied:** **NO**
**Rollback SQL executed:** **NO**
**Live precheck:** **PASS** (see `15_PRE_APPLY_OBJECT_STATE_EVIDENCE.md`)
**Durable runtime:** OFF (must remain off)
**Secrets included:** NONE

## Owner decision summary

| Item | Status |
|------|--------|
| Recovery method | ROLLBACK-ONLY |
| Scope | Staging `qyewbxjsiiyufanzcjcq` |
| Forward subset | Orders 1–7 (Phase 1G + permission seed) |
| Deferred | `20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql` |
| Deploy / workers / delivery | NOT APPROVED |
| Production | NOT APPROVED |

## Package artifacts

| Path | Role |
|------|------|
| `docs/crm/phase-1h-b/14_CRM_PHASE_1H_B_STAGING_ROLLBACK.sql` | Executable reverse rollback (manual) |
| `docs/crm/phase-1h-b/15_PRE_APPLY_OBJECT_STATE_CHECK.sql` | Read-only pre-apply probe |
| `docs/crm/phase-1h-b/15_PRE_APPLY_OBJECT_STATE_EVIDENCE.md` | Sanitized live probe results |
| This file | Recovery method + coverage record |

## Exact rollback coverage (orders 7 → 1)

| Step | Undoes | Actions |
|-----:|--------|---------|
| R7 | Order 7 permission seed | DELETE exact 24 `crm.*` permission ids; refuse if referenced by `role_permissions` |
| R6 | Order 6 consent immutability | DROP trigger + guard function |
| R5 | Order 5 grants | REVOKE authenticated (and keep PUBLIC/anon revoked) on CRM tables/RPCs |
| R4 | Order 4 RPCs | DROP claim + release functions |
| R3 | Order 3 RLS | DROP CRM policies + `crm_phase1g_scope_allows`; **does not DISABLE RLS** |
| R2 | Order 2 indexes | DROP Phase 1G CRM indexes |
| R1 | Order 1 tables | DROP four CRM tables **only if empty** (refuse if any rows) |

## Exact rollback exclusions

- Production project / Production data
- Deferred role-matrix SQL apply or DELETE of arbitrary Identity roles
- `DELETE FROM role_permissions` (refuses if CRM seed ids are still granted)
- Non-CRM schemas/tables/functions/policies/grants
- Finance / Notification / Player / Competition objects
- `DISABLE ROW LEVEL SECURITY` (security-weakening path forbidden)
- Dashboard backup/PITR creation claims
- Durable runtime / workers / provider delivery enablement

## Fail-closed controls

1. Session guard: `app.crm_phase_1h_b_allow_rollback = staging-qyewbxjsiiyufanzcjcq`
2. Permission delete blocked when `role_permissions` still reference CRM seed ids
3. Table DROP blocked when any CRM Phase 1G table has rows
4. Staging-only documentation + Production blocklist in headers

## Transaction / data-loss notes

| Question | Answer |
|----------|--------|
| Transaction-safe as a single atomic unit? | **Not guaranteed** across the whole file (multiple statements; stop and inspect on error). Prefer run as one Owner-supervised session. |
| May cause data loss? | **Yes if tables contain rows and Owner later forces DROP** — current SQL **refuses** non-empty DROP. Empty-table DROP loses only empty relations. Permission DELETE removes catalog rows only. |

## Live precheck conclusion (MCP Staging)

| Question | Result |
|----------|--------|
| CRM Phase 1G tables | **ABSENT** |
| Related indexes / policies / RPCs / consent trigger | **ABSENT** |
| CRM permission seed rows | **ABSENT** (0/24 expected ids) |
| Duplicate CRM permissions | **NONE** |
| CRM role-permission rows | **0** |
| Migrations 1–7 collision-free? | **YES** |
| Rollback-only recovery still valid? | **YES** |

## Gate wiring (Owner final recovery approval)

**Status:** Owner recovery gate **APPROVED** (`backupRestoreApproved = true`).
Method: rollback-only. PITR/backup snapshot: **not claimed**.

Optional local gitignored markers (values never committed/chatted):

- `CRM_STAGING_BACKUP_EVIDENCE`
- `CRM_STAGING_BACKUP_EVIDENCE_PATH` = `docs/crm/phase-1h-b/14_STAGING_RECOVERY_EVIDENCE.md`

Decision source of truth: `OWNER_LIMITED_STAGING_APPROVAL.json` + this evidence pack.

Re-run: `node scripts/crm/phase-1h-b-gate-rerun.mjs` before any forward apply.
