# 01 — Staging Backup / Recovery Audit (read-only)

**Audit time (UTC):** 2026-08-09T11:56:16Z (Staging SQL observe)  
**Staging project ref:** `qyewbxjsiiyufanzcjcq`  
**Production project ref (blocked):** `expuvcohlcjzvrrauvud`  
**Mutations:** 0  
**Config changes:** 0 (no enable/disable of backup/PITR services)

## Verdict

```text
BACKUP_BLOCKER_STATUS=CONTRACT_READY_OWNER_DASHBOARD_CONFIRMATION_REQUIRED
PITR_PROVABLE_VIA_SQL_OR_MCP=NO
CURRENT_WP6_RECOVERY_POINT_PROVABLE=NO
HISTORICAL_OWNER_BACKUP_REUSABLE_FOR_WP6=NO
```

## What Staging backup capability was checked

| Source | Result |
|--------|--------|
| Supabase Staging MCP `execute_sql` | Can observe DB identity (`postgres` / PG 17.6) — **cannot** list Dashboard backups or PITR windows |
| Supabase Management / Access Token in this worktree env | **Absent** — no API backup inventory possible |
| Repository historical Owner confirmation (`platform-hard-cutover-01` physical backup `2026-07-29T18:55:19Z`) | **Stale for WP6** — different operation window; not a WP6 recovery point |
| Doc 05 B1B recovery layers L1–L6 | Present as **plan** (migration rollback SQL + quarantine release + PITR last resort) — not a live WP6 recovery-point certificate |

## PITR

- **Provable enabled/disabled from this workstream:** NO
- Historical platform posture (other ops): Free/Nano often **PITR not enabled** — do **not** assume PITR for WP6
- WP6A did **not** enable or disable PITR

## Valid recovery mechanisms for WP6 (ordered)

1. **Owner Dashboard physical/daily backup** (preferred G1 evidence) — capture timestamp + restore-entry visibility for `qyewbxjsiiyufanzcjcq` immediately before Staging apply
2. **L1 migration rollback** — `sql/80_*.sql` + `sql/90_*.sql` (drop new quarantine objects only; preserves `profiles_status_check`)
3. **L3/L4 quarantine release + conditional Auth restore** — after rehearsal rows exist (runner path; requires Staging GO)
4. **L6 PITR** — last resort only if irreversible corruption **and** Owner confirms PITR available

## Sufficiency for WP6 rollback/recover

| Question | Answer |
|----------|--------|
| Enough to **plan** WP6 recoverability? | YES — mechanisms identified |
| Enough to **pass G1** without Owner Dashboard note? | NO |
| Can agent create backup evidence by mutating Supabase? | NO (forbidden in WP6A) |

## Owner action required (outside code)

1. Open Supabase Dashboard → project **`qyewbxjsiiyufanzcjcq`** only (never Production `expuvcohlcjzvrrauvud`)
2. Database → Backups (or Backups/PITR UI for the plan tier)
3. Confirm a usable recovery point **after** latest intentional Staging work and **before** WP6 apply
4. Fill `02_STAGING_BACKUP_OWNER_CONFIRMATION.json` (copy from template if needed):
   - `backup_id_or_filename`
   - `backup_completed_at`
   - `pitr_enabled` (true/false as observed — do not enable without separate GO)
   - `restore_entry_visible_in_dashboard`
   - `status=completed`
5. Keep secrets out of Git

Until step 4 is completed, G1 remains **Owner-gated** even though WP6A readiness contract exists.
