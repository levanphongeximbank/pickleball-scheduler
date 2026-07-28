# Staging Backup Owner Procedure (B-STG-01)

**Workstream:** PLATFORM-HARD-CUTOVER-01 M8 text-tenant hotfix  
**Purpose:** Confirm or create a **fresh** Staging backup **before** any Staging wipe/DROP.  
**This document does not create a backup.** Owner executes in Supabase Dashboard.

## Exact Staging identity

| Field | Value |
|-------|-------|
| Project ref | `qyewbxjsiiyufanzcjcq` |
| MCP server (agents) | `project-0-pickleball-scheduler-supabase-staging` |
| Production ref (DO NOT backup-target / DO NOT restore into) | `expuvcohlcjzvrrauvud` |

## Preconditions

1. Failed rehearsal M8 rollback already completed (`competition_ssot_*` absent).
2. Protected-object counts still intact (auth/profiles/venues/tenant_members/RBAC/plans/catalog).
3. Backup timestamp must be **after** that rollback (after `2026-07-28T01:10:00Z` UTC floor from rehearsal evidence). Prefer **now**.

## Procedure — create or confirm backup

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → select project whose **Reference ID** is exactly `qyewbxjsiiyufanzcjcq`.
2. Confirm the project name/URL host is Staging (not Production `expuvcohlcjzvrrauvud`).
3. Go to **Project Settings → Database** (or **Database → Backups** depending on plan UI).
4. Prefer one of:
   - **Physical / PITR / daily backup** slot with status **Completed** and restore-ready, **or**
   - **Logical dump** exported by Owner (pg_dump / Dashboard backup download) stored offline.
5. Record into the evidence file below (no secrets):

| Field | Owner fills |
|-------|-------------|
| `project_ref` | `qyewbxjsiiyufanzcjcq` |
| `backup_kind` | `dashboard_physical` \| `pitr` \| `logical_zip` |
| `backup_id_or_filename` | (id or filename only) |
| `backup_completed_at` | ISO-8601 UTC |
| `status` | `completed` / `readable` |
| `verified_by` | Owner name |
| `verified_at` | ISO-8601 UTC |
| `notes` | e.g. “after M8 rollback; pre-wipe” |

6. Evidence path to update after Owner confirms:  
   `docs/platform-hard-cutover-01/phase-04/staging-rehearsal/evidence/05_STAGING_BACKUP_OWNER_CONFIRMATION.json`  
   (create from template in this folder when Owner confirms).

## Hard stop rules

- If project_ref ≠ `qyewbxjsiiyufanzcjcq` → **STOP**.
- If backup timestamp ≤ failed-rehearsal rollback → **STOP** (not fresh).
- If status ≠ completed/readable → **STOP**.
- Never paste connection strings, service role keys, or dump contents into chat/PRs.

## After PASS

Owner may re-issue Staging rehearsal GO. Agents must refuse wipe until confirmation evidence exists with `status: completed`.
