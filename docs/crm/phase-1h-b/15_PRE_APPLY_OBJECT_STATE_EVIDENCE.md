# 15 — Pre-Apply Object-State Evidence

**Phase:** CRM Phase 1H-B
**Expected Staging project ref:** `qyewbxjsiiyufanzcjcq`
**Production ref (must not be used):** `expuvcohlcjzvrrauvud`
**Probe SQL:** `docs/crm/phase-1h-b/15_PRE_APPLY_OBJECT_STATE_CHECK.sql`
**Probe mode:** READ-ONLY (`BEGIN READ ONLY` … `ROLLBACK`)
**Execution channel:** Supabase MCP `project-0-crm-supabase-staging` only
**Live Staging probe executed:** **YES** (2026-07-22)
**Secrets / connection strings printed:** NONE

## Identity proof (before execute)

| Check | Result |
|-------|--------|
| MCP server used | `supabase-staging` / `project-0-crm-supabase-staging` |
| MCP config project ref | `qyewbxjsiiyufanzcjcq` (present) |
| Production MCP used | **NO** |
| Production ref in staging MCP config | **NO** |
| Production server `supabase-production` | Not called |

## SQL safety gate

| Check | Result |
|-------|--------|
| Forbidden write/DDL verbs in executable body | None (`SELECT` + session `SET search_path` only) |
| Forward migrations executed | NO |
| Rollback SQL executed | NO |
| Role matrix applied | NO |
| Database objects/rows modified | NO (read-only tx + ROLLBACK) |

Note: Section A was corrected to catalog-safe probes so absent tables do not fail PostgreSQL parse/analyze of `COUNT(*)` branches.

## Results (sanitized)

| Object / check | Exists | Row count / notes | Status |
|----------------|--------|-------------------|--------|
| Staging project ref confirmed `qyewbxjsiiyufanzcjcq` | YES | MCP staging URL ref | **PASS** |
| `crm_tags` | **false** | null | **ABSENT** |
| `crm_tag_assignments` | **false** | null | **ABSENT** |
| `crm_consent_records` | **false** | null | **ABSENT** |
| `crm_pending_events` | **false** | null | **ABSENT** |
| Related Phase 1G indexes (11 named) | **none** | empty result | **ABSENT** |
| RLS rows for CRM tables | **none** | empty result | **N/A (no tables)** |
| Related CRM RLS policies | **none** | empty result | **ABSENT** |
| `crm_phase1g_scope_allows` | **none** | empty result | **ABSENT** |
| `crm_claim_pending_events` | **none** | empty result | **ABSENT** |
| `crm_release_expired_pending_event_claims` | **none** | empty result | **ABSENT** |
| `crm_consent_records_immutable_*` | **none** | empty result | **ABSENT** |
| CRM permission seed rows (`module=crm` / `crm.%`) | **none** | empty result | **ABSENT** |
| Expected 24 CRM permission ids present | **all false** | 0/24 | **ABSENT** |
| Duplicate CRM permission ids | **none** | empty result | **PASS** |
| Unexpected CRM role-matrix rows | **0** | `crm_role_permission_rows = 0` | **PASS** |

### Overall pre-apply object verdict

**`OBJECTS_ABSENT_FIRST_APPLY_READY`**

- CRM Phase 1G durable objects are **absent** (not merely empty).
- Migrations 1–7 are **collision-free** on Staging.
- Rollback-only recovery remains **valid** for this first-apply wave.

## Backup / recovery gate readiness

| Item | Status |
|------|--------|
| Rollback SQL authored | YES |
| Recovery evidence | YES |
| Pre-apply check SQL | YES |
| Live object-state evidence complete | **YES** |
| Backup/PITR claimed | **NO** |
| Owner recovery gate approved | **YES** (`backupRestoreApproved = true`) |
| Ready for credentials / controlled apply prep | **YES** — next gate is credentials |

See `16_OWNER_RECOVERY_GATE_APPROVAL.md`.
