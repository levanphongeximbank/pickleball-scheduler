# 13 — Staging Backup / Restore Readiness Audit

**Phase:** CRM Phase 1H-B
**Branch:** `feature/crm-phase-1h-b-staging-apply`
**Staging project ref (expected):** `qyewbxjsiiyufanzcjcq`
**Audit mode:** Static / documentation only
**Database connection:** NONE
**SQL applied:** NONE
**Secrets printed:** NONE
**Backup existence claimed:** **NO**

## Verdict

**`CRM_PHASE_1H_B_BACKUP_METHOD_IDENTIFIED_OWNER_ACTION_REQUIRED`**

A valid recovery method for this Staging wave is identifiable from repository artifacts, but **Owner action is still required** before the backup/restore gate can pass. This document does **not** certify that a backup or restore point exists.

---

## Current hard stop context

- Apply approvals (Phase 1G + permission seed): granted (limited Staging)
- Role matrix: deferred
- Durable runtime / deploy / workers: not approved
- Backup gate: still blocking (`CRM_PHASE_1H_B_BLOCKED_BACKUP_REQUIRED`)

---

## 1. Existing approved backup / restore / rollback procedures in repo?

| Artifact | Status |
|----------|--------|
| Executable Staging backup dump / restore point file | **ABSENT** |
| Approved restore runbook with completed evidence | **ABSENT** |
| Phase 1G rollback sketch | Present: `docs/crm/phase-1g/06_MIGRATION_ROLLOUT_AND_ROLLBACK_PLAN.md` (plan only) |
| Phase 1H rollback sketch | Present: `docs/crm/phase-1h/08_STAGING_PREFLIGHT_AND_ROLLOUT_PLAN.md` (sketch table only) |
| Executable reverse SQL for orders 1–7 | **ABSENT** (no `*ROLLBACK*.sql` under `docs/crm/phase-1g` or `phase-1h`) |
| Manifest rollback classifications | Present in `docs/crm/phase-1h/staging-migration-manifest.json` |
| Apply script automatic recovery point | **NO** (see §13) |

**Conclusion:** Repository has **plans and classifications**, not an Owner-approved completed Staging recovery point and not executable rollback SQL.

---

## 2. Are Phase 1G / 1H migrations (orders 1–7) transaction-safe and reversible?

| Question | Finding |
|----------|---------|
| Manifest `transactionSafe` for orders 1–7 | All `true` |
| Manifest `automaticRollback` | `false` (stop-on-first-error; no auto undo) |
| Forward SQL nature | Primarily **additive / idempotent** |
| Fully reversible without data loss if CRM tables already hold rows | **No** — table DROP is destructive if data exists |
| Reversible via documented reverse DDL when objects are empty / first apply | **Yes** (manual rollback sketch) |

**Summary:** Safe for controlled Staging first-apply when CRM Phase 1G objects are absent. Not “free restore” for populated CRM tables without a logical backup or accepted data loss.

---

## 3. Per approved migration (orders 1–7)

### Order 1 — `docs/crm/phase-1g/10_CRM_PHASE_1G_TABLES.sql`

| Field | Detail |
|-------|--------|
| Objects created | Tables: `crm_tags`, `crm_tag_assignments`, `crm_consent_records`, `crm_pending_events`; unique constraints via `ALTER TABLE ... ADD CONSTRAINT` DO blocks |
| Objects altered | Constraint add-if-missing only |
| Data inserted | None |
| Idempotent | Yes (`CREATE TABLE IF NOT EXISTS`, constraint DO guards) |
| Rollback SQL exists | No executable file; classification `DROP_TABLES_DESTRUCTIVE` |
| Rollback risk | **High if rows exist**; low if tables empty / never used |

### Order 2 — `docs/crm/phase-1g/20_CRM_PHASE_1G_INDEXES.sql`

| Field | Detail |
|-------|--------|
| Objects created | Indexes on tags / assignments / consent / pending_events (claim + list paths) |
| Objects altered | None |
| Data inserted | None |
| Idempotent | Yes (`CREATE INDEX IF NOT EXISTS`) |
| Rollback SQL exists | No; classification `DROP_INDEXES` |
| Rollback risk | Low (DROP INDEX; no row loss) |

### Order 3 — `docs/crm/phase-1g/30_CRM_PHASE_1G_RLS.sql`

| Field | Detail |
|-------|--------|
| Objects created | Function `crm_phase1g_scope_allows`; RLS policies on four tables |
| Objects altered | `ENABLE` + `FORCE ROW LEVEL SECURITY` on four tables; `DROP POLICY IF EXISTS` then recreate |
| Data inserted | None |
| Idempotent | Largely yes (recreate policies; `CREATE OR REPLACE FUNCTION`) |
| Rollback SQL exists | No; classification `DROP_POLICIES_DISABLE_RLS` |
| Rollback risk | Medium — wrong rollback can weaken security if RLS disabled carelessly; prefer drop policies but keep RLS enabled |

### Order 4 — `docs/crm/phase-1g/40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql`

| Field | Detail |
|-------|--------|
| Objects created | Functions `crm_claim_pending_events`, `crm_release_expired_pending_event_claims` |
| Objects altered | `CREATE OR REPLACE` overwrites prior definitions |
| Data inserted | None (runtime claim updates occur only when RPCs invoked later) |
| Idempotent | Yes for re-apply (`CREATE OR REPLACE`) |
| Rollback SQL exists | No; classification `DROP_FUNCTIONS` |
| Rollback risk | Low–medium (DROP FUNCTION; no table data loss) |

### Order 5 — `docs/crm/phase-1g/50_CRM_PHASE_1G_GRANTS.sql`

| Field | Detail |
|-------|--------|
| Objects created | None |
| Objects altered | `REVOKE` PUBLIC/anon; `GRANT` authenticated table/RPC privileges |
| Data inserted | None |
| Idempotent | Effectively re-runnable (REVOKE/GRANT) |
| Rollback SQL exists | No; classification `REVOKE_GRANTS` |
| Rollback risk | Low–medium (must not GRANT PUBLIC while rolling back) |

### Order 6 — `docs/crm/phase-1g/60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql`

| Field | Detail |
|-------|--------|
| Objects created | Function `crm_consent_records_immutable_guard`; trigger `crm_consent_records_immutable_trg` |
| Objects altered | `DROP TRIGGER IF EXISTS` then recreate |
| Data inserted | None |
| Idempotent | Yes |
| Rollback SQL exists | No; classification `DROP_TRIGGER` |
| Rollback risk | Low for DROP TRIGGER; **operational risk** if trigger dropped without recreating (consent mutability returns) |

### Order 7 — `docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql`

| Field | Detail |
|-------|--------|
| Objects created | None (uses existing `public.permissions`) |
| Objects altered | None |
| Data inserted | CRM permission catalog rows (`crm.*`) via `INSERT ... WHERE NOT EXISTS` |
| Idempotent | Yes |
| Rollback SQL exists | No; classification `DELETE_PERMISSION_ROWS_CAREFUL` |
| Rollback risk | Medium — DELETE only `module = 'crm'` unused rows; must not delete shared Identity permissions |

**Deferred (out of this wave):** order 8 role matrix — not audited for apply.

---

## 4. Is an exact pre-apply schema snapshot required?

**Recommended: yes (lightweight catalog probe), not a full physical dump.**

Minimum pre-apply evidence for this additive wave:

- Confirm expected Staging project `qyewbxjsiiyufanzcjcq`
- Confirm CRM Phase 1G tables **absent** (or empty + Owner-accepted)
- Confirm `crm_phase1g_scope_allows` / claim RPCs / consent trigger absent or known
- Confirm `public.permissions` exists (Identity precondition for order 7)

A full `pg_dump` schema snapshot is **optional** if the lightweight probe + rollback SQL are Owner-approved.

---

## 5. Is a logical database backup required?

| Scenario | Logical backup required? |
|----------|--------------------------|
| First apply; CRM tables confirmed absent; rollback SQL ready | **Not strictly required** for data recovery (nothing CRM to restore) |
| Any uncertainty about existing CRM objects / shared Identity impact | **Yes — recommended** |
| Production (not this wave) | Always required (out of scope) |

For Staging CRM 1H-B limited apply, safest practical stance:

1. Prefer **documented rollback-only method** when first-apply + empty CRM objects are proven.
2. Optionally add a Supabase dashboard backup / PITR note for belt-and-suspenders.

---

## 6. Would a documented rollback-only plan be sufficient?

**Yes — conditionally sufficient** for this Staging wave if Owner accepts all of:

1. Migrations 1–7 remain additive / idempotent as audited.
2. Pre-apply probe shows CRM Phase 1G objects absent (or empty with accepted DROP risk).
3. Executable reverse-order rollback SQL is authored and Owner-approved.
4. Rollback never weakens RLS (keep RLS enabled; drop CRM policies/functions carefully).
5. Permission seed rollback deletes only unused `crm.*` permission rows.
6. Role matrix remains deferred (no `role_permissions` CRM grants to unwind).
7. Evidence is recorded at the path in §9; gate tokens updated.

If Owner rejects rollback-only, require a dashboard/logical backup instead (or both).

---

## 7. Evidence required before Owner can approve recovery readiness

Do **not** approve until all of the following exist (non-secret):

1. Chosen recovery method recorded (rollback-only and/or dashboard backup).
2. For rollback-only: executable rollback SQL path + review checklist completed.
3. For dashboard backup: timestamp, project ref `qyewbxjsiiyufanzcjcq`, scope note, how to restore (no secrets).
4. Pre-apply object-status statement (absent/empty/unknown) for CRM Phase 1G objects.
5. Explicit statement that Production restore is out of scope.
6. Owner sets `backupRestoreApproved: true` in a new decision record (or updates Owner decision) **only after** evidence exists.
7. Env markers (values never committed/chatted):
   - `CRM_STAGING_BACKUP_EVIDENCE`
   - `CRM_STAGING_BACKUP_EVIDENCE_PATH` → path in §9

---

## 8. Exact non-secret Owner actions (commands / dashboard)

### Option A — Recommended for this wave: Rollback-only readiness

1. Review this audit (`13_BACKUP_RESTORE_READINESS_AUDIT.md`).
2. Author (or commission) executable reverse SQL at:
   `docs/crm/phase-1h-b/14_CRM_PHASE_1H_B_STAGING_ROLLBACK.sql`
   Reverse order sketch: seed DELETE (crm only) → drop consent trigger/function → revoke CRM grants carefully → drop claim/release RPCs → drop CRM policies (keep RLS on) → drop `crm_phase1g_scope_allows` → drop indexes → drop tables **only if empty/approved**.
3. In Supabase Dashboard for project **`qyewbxjsiiyufanzcjcq`** (read-only checks; no apply):
   - Confirm project ref matches Staging.
   - Table editor / SQL editor: verify CRM Phase 1G tables absent (or empty).
4. Fill evidence file at §9 path (no keys/passwords/JWTs).
5. Issue Owner recovery approval (update decision JSON / set backup evidence env markers locally, gitignored).
6. Re-run: `node scripts/crm/phase-1h-b-gate-rerun.mjs` (expect backup gate to clear only after approval + evidence path).

### Option B — Dashboard backup / PITR note (optional add-on)

1. Supabase Dashboard → project `qyewbxjsiiyufanzcjcq` → Database → Backups (or PITR / restore UI for plan tier).
2. Create or note a restore point; record **timestamp + project ref + method** only.
3. Document restore steps at high level (no connection strings).
4. Attach notes into §9 evidence file.

**Do not** paste access tokens, DB passwords, or URLs with credentials into git or chat.

---

## 9. Proposed evidence document path

```
docs/crm/phase-1h-b/14_STAGING_RECOVERY_EVIDENCE.md
```

Suggested companion (when authored):

```
docs/crm/phase-1h-b/14_CRM_PHASE_1H_B_STAGING_ROLLBACK.sql
```

`CRM_STAGING_BACKUP_EVIDENCE_PATH` should point at `docs/crm/phase-1h-b/14_STAGING_RECOVERY_EVIDENCE.md` once Owner completes it.

**Not created in this audit** — creating it now would risk implying readiness.

---

## 10. Can backup/recovery be certified without a database connection?

| Certification type | Without DB connection? |
|--------------------|------------------------|
| Identify valid recovery **method** | **Yes** (this audit) |
| Certify rollback SQL correctness statically | Partially (requires authored SQL review) |
| Certify restore point **exists** | **No** — needs Owner dashboard note or live verification |
| Certify CRM objects absent on Staging | **No** without Dashboard/SQL probe (Owner action) |
| Pass Phase 1H-B backup gate | **No** until evidence + Owner approval recorded |

---

## 11. Is `SUPABASE_ACCESS_TOKEN` needed to create/verify recovery point?

| Activity | Token needed? |
|----------|---------------|
| Owner Dashboard backup / PITR note | **No** (browser session) |
| Management API backup APIs / automated verify | **Yes** |
| Gate re-run / static audit | **No** |
| Controlled SQL apply (later phase step) | **Yes** (separate credentials gate) |

---

## 12. Are database credentials also required?

| Activity | DB password / direct Postgres URL |
|----------|-----------------------------------|
| Dashboard backup/PITR | **No** |
| Documented rollback-only method approval | **No** |
| `pg_dump` / `psql` restore | **Yes** (avoid unless Owner chooses; prefer Dashboard) |
| Phase 1H-B apply script path | Uses Management API token, not DB password |

---

## 13. Does the current apply script create a recovery point?

**No.**

`scripts/crm/phase-1h-staging-apply.mjs`:

- Requires backup evidence gate before write
- Sets `automaticRollback: false`
- Does not snapshot schema
- Does not create Supabase backups
- Stops on first migration error without auto-undo

---

## 14. Must the apply script fail closed unless recovery evidence is verified?

**Yes — and it already does (keep this behavior).**

Current gates require:

- Owner backup approval not denied
- Matching `--backup-evidence` ↔ `CRM_STAGING_BACKUP_EVIDENCE`
- `CRM_STAGING_BACKUP_EVIDENCE_PATH` set

**Do not weaken** these checks. Optional future hardening (out of this audit’s write scope unless Owner asks): verify evidence file exists on disk and contains required non-secret fields before apply.

---

## 15. Destructive or irreversible statements in migrations 1–7?

| Pattern | Present in 1–7? | Notes |
|---------|-----------------|-------|
| `DROP TABLE` / `TRUNCATE` / `DELETE FROM` | **No** | |
| `DROP POLICY IF EXISTS` | Yes (order 3) | Re-apply hygiene; not data loss |
| `DROP TRIGGER IF EXISTS` | Yes (order 6) | Recreated immediately |
| `CREATE OR REPLACE FUNCTION` | Yes (orders 3, 4, 6) | Overwrites prior CRM function bodies |
| `REVOKE` / `GRANT` | Yes (orders 3, 5, 6) | Privilege changes only |
| `ENABLE` / `FORCE ROW LEVEL SECURITY` | Yes (order 3) | Security hardening |
| Inserts into shared `public.permissions` | Yes (order 7) | Additive; reversible carefully |

**No irreversible data wipes in forward SQL.** Highest irreversible risk appears only if rollback uses `DROP TABLE` after CRM rows exist.

---

## Recommended recovery option

**Primary recommendation for this Staging CRM wave:**

> **Owner-approved documented rollback-only recovery** for additive first apply of migrations 1–7, with executable reverse SQL + pre-apply object-absence confirmation on Staging project `qyewbxjsiiyufanzcjcq`.

**Optional add-on:** Supabase Dashboard backup/PITR timestamp recorded in evidence.

**Not recommended as sole method without probe:** assuming empty Staging without checking.

---

## Exact next Owner action

1. Choose recovery option (rollback-only recommended; optional Dashboard backup add-on).
2. Complete evidence at `docs/crm/phase-1h-b/14_STAGING_RECOVERY_EVIDENCE.md` (create when ready — **not** claimed present now).
3. Author/approve `14_CRM_PHASE_1H_B_STAGING_ROLLBACK.sql` if choosing rollback-only.
4. Confirm Staging project ref and CRM object absence via Dashboard (no secrets in git).
5. Only then approve backup/restore (`backupRestoreApproved`) and set local gitignored evidence env markers.
6. Re-run gate script; proceed to credentials/QA gates only after backup gate clears.

---

## Explicit non-claims

- No Staging backup is asserted to exist.
- No restore point is certified.
- No SQL was applied.
- No database was contacted during this audit.
- No `.env` files were modified.
- No commit / push / deploy / durable runtime enablement.
