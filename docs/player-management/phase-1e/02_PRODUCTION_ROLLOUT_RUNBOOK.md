# 02 — Production Rollout Runbook (Owner-operated)

**Environment:** Production Supabase only  
**Expected project ref:** `expuvcohlcjzvrrauvud`  
**Forbidden:** Staging (`qyewbxjsiiyufanzcjcq`), Preview, local DB  

**This runbook does not auto-apply.** Every mutating step requires explicit Owner approval.

---

## Gate A — Preflight (read-only)

**Mutates Production?** No  

1. Confirm dashboard project name/ref = Production `expuvcohlcjzvrrauvud`.
2. Prepare gitignored credentials (never commit):
   - `CONFIRM_PRODUCTION_PLAYER_PROFILE_PREFLIGHT=YES`
   - `PRODUCTION_SUPABASE_PROJECT_REF=expuvcohlcjzvrrauvud`
   - `SUPABASE_DB_URL=<production>`
3. Run the **official** Gate A command only:
   - `node scripts/verify-phase-1e-player-profile-production-preflight.mjs`
   - Optional supplement (inventory SQL only): `docs/v5/PHASE_1E_PLAYER_PROFILE_PRODUCTION_PREFLIGHT.sql`
4. Do **not** use manual workarounds or ad-hoc SELECT scripts for Gate A classification.
5. The official script is column-aware: it inventories columns first and never queries missing Phase 1D columns (e.g. `privacy_settings`) by name.
6. Record classification: `NOT_APPLIED` | `PARTIALLY_APPLIED` | `ALREADY_READY` | `BLOCKED_UNSAFE`
7. Missing-column dependent counts are reported as `NOT_APPLICABLE_COLUMN_MISSING` (not crashes).

**Stop if:** `BLOCKED_UNSAFE`, wrong project, credentials missing/ambiguous, or the official script fails.

If `ALREADY_READY`: skip Gate E apply; still complete evidence + Gate G smoke as needed.

**Note:** An unmigrated Production with a legacy unsafe guard (`current_user = 'postgres'`) classifies as `BLOCKED_UNSAFE` even when Phase 1D columns are absent. Owner-approved Gate E apply of `PHASE_1D_PLAYER_PROFILE_MIGRATION.sql` both adds columns and replaces the guard with the hotfixed body.

---

## Gate B — Backup / readiness confirmation

**Mutates Production?** No (backup tooling may snapshot outside SQL apply)

- [ ] Export/snapshot `public.profiles` (at least Phase 1D columns + `id`, `player_id`, `birth_year`)
- [ ] Confirm rollback SQL reviewed: `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql`
- [ ] Confirm maintenance window / Owner on-call
- [ ] Confirm Staging remains green as reference

**Stop if:** backup not confirmed.

---

## Gate C — Forward SQL review

**Mutates Production?** No  

Review checksum/SHA of:

1. `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql` (apply source)
2. `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql` (post-apply)
3. `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql` (emergency only)

Confirm:

- additive only;
- no invent of `birth_date` from `birth_year`;
- guard has **no** `current_user = 'postgres'` bypass;
- self cannot modify `identity_verification_status`.

---

## Gate D — Owner approval

**Mutates Production?** No  

Owner records written approval including:

- date/time;
- Production project ref;
- approved git SHA / migration checksum;
- preflight classification;
- backup confirmation.

**Stop if:** approval missing.

---

## Gate E — Production SQL apply

**Mutates Production?** **YES**  

**Execution order (only after Gates A–D):**

1. Confirm SQL Editor is Production `expuvcohlcjzvrrauvud` (re-check).
2. Run **only** `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql` in one session.
3. Do **not** run rollback.
4. Do **not** run Staging scripts against Production.

**Expected success:** transaction commits; no error; columns/constraints/index/guard present.

**Stop conditions:** any error, wrong project, unexpected object conflict → do not continue; escalate; do not improvise.

---

## Gate F — Immediate verification (read-only)

**Mutates Production?** No  

1. Run `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql`
2. Optionally re-run Phase 1E preflight script/SQL
3. Expect:
   - required columns present
   - `privacy_null = 0`
   - `verification_null = 0`
   - `no_current_user_postgres_bypass = true`
   - self verification block present

**Stop if:** verification fails → Gate I decision (do not auto-rollback).

---

## Gate G — Runtime smoke test

**Mutates Production?** Minimal self demographics only (non-destructive restore required)

With a real authenticated Production session (not service_role browser key):

1. Self may update an allowed field (e.g. `handedness`) then restore original.
2. Self **cannot** set `identity_verification_status`.
3. Athlete/My Profile save path still succeeds for owned fields.
4. No false success on failure.

Record results in evidence template.

---

## Gate H — Observation window

**Mutates Production?** No  

Monitor for agreed window:

- error rates on profile update;
- guard exceptions;
- support tickets for profile save.

Escalate if regressions appear.

---

## Gate I — Rollback decision (only if necessary)

**Mutates Production?** **YES** (destructive column drops)  

**Rollback is NOT part of normal execution.**

Criteria (examples):

- verify fails after apply and cannot be remediated forward;
- critical production outage traced to this migration;
- Owner explicit written rollback approval.

Warnings:

- Rollback **drops** `birth_date`, `handedness`, `activity_region`, `privacy_settings`, `identity_verification_status` → **data loss**.
- Export those columns before rollback.
- Rollback does **not** drop `birth_year` / `gender` / `player_id`.
- Never rollback without Owner approval.

File: `docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql`

---

## Command cheat-sheet

| Action | Command / file | Mutates? |
|--------|----------------|----------|
| Preflight SQL | `PHASE_1E_PLAYER_PROFILE_PRODUCTION_PREFLIGHT.sql` | No |
| Preflight CLI | `node scripts/verify-phase-1e-player-profile-production-preflight.mjs` | No |
| Forward apply | `PHASE_1D_PLAYER_PROFILE_MIGRATION.sql` | **Yes** |
| Verify | `PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql` | No |
| Rollback | `PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql` | **Yes** (destructive) |

## Staging vs Production

| | Staging | Production |
|--|---------|------------|
| Ref | `qyewbxjsiiyufanzcjcq` | `expuvcohlcjzvrrauvud` |
| Phase 1D Staging verify script | Allowed | **Forbidden** |
| Phase 1E Production preflight | Forbidden | Allowed with confirmation vars |
| Apply in this Phase 1E package | No | Owner Gate E only (future execution) |
