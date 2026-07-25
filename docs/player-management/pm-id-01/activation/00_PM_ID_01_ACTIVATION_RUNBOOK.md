# PM-ID-01 — Guarded Staging Activation Runbook

**Workstream:** PM-ID-01 — Guarded Staging Activation Package  
**Target Staging project ref:** `qyewbxjsiiyufanzcjcq`  
**Owner GO token:** `PM_ID_01_OWNER_GO_APPLY_STAGING` (**not granted** in this step)  
**CODEX_DELETE_ALLOWED:** `NO`

---

## Purpose

Author and certify a **guarded activation package** for the already-merged PM-ID-01 SQL/contract. This step does **not** apply SQL, does **not** create mapping rows, does **not** run backfill, and does **not** touch Production.

Local tests PASS / preflight PASS / CI green / PR merge **do not** grant apply permission.

---

## Default behaviour (current authorization)

```bash
node scripts/player-management/pm-id-01-staging-apply.mjs
```

Must print `APPLY_MODE=REFUSED` and write:

`docs/player-management/pm-id-01/activation/evidence/APPLY_REFUSED_NO_GO.json`

Classification:

`PM_ID_01_APPLY_REFUSED_OWNER_GO_NOT_GRANTED`

Evidence markers:

| Marker | Required value |
|--------|----------------|
| `ownerGoGranted` | `false` |
| `databaseConnectionOpened` | `false` |
| `databaseWrites` | `0` |
| `sqlApplied` | `false` |
| `mappingRowsCreated` | `0` |
| `backfillExecuted` | `false` |
| `roleGrantsApplied` | `false` |
| `productionTouched` | `false` |
| `filesDeleted` | `false` |

---

## Read-only Staging preflight (allowed now)

```bash
node scripts/player-management/pm-id-01-activation-preflight.mjs
node scripts/player-management/pm-id-01-activation-preflight.mjs --live-readonly
```

Uses `BEGIN TRANSACTION READ ONLY` … `ROLLBACK` only. Evidence:

`docs/player-management/pm-id-01/activation/evidence/PREFLIGHT_LIVE_READONLY.json`

---

## Live execute (future only — requires Owner GO)

All required **simultaneously**:

```bash
# Illustrative — DO NOT RUN until Owner grants GO for an exact commit
node scripts/player-management/pm-id-01-staging-apply.mjs \
  --execute \
  --environment=staging \
  --project-ref=qyewbxjsiiyufanzcjcq \
  --expected-commit=<exact-40-char-HEAD-sha> \
  --owner-approved-commit=<exact-40-char-HEAD-sha> \
  --owner-go=PM_ID_01_OWNER_GO_APPLY_STAGING \
  --preflight-pass
```

Missing any condition → refuse **before** database connection.

---

## Exact SQL execution order

1. `10_PM_ID_01_MAPPING_TABLE.sql`
2. `20_PM_ID_01_CONSTRAINTS_AND_INDEXES.sql`
3. `30_PM_ID_01_RESOLUTION_HELPERS.sql`
4. `40_PM_ID_01_MAPPING_MANAGEMENT_RPCS.sql`
5. `50_PM_ID_01_RLS_AND_GRANTS.sql`
6. `99_PM_ID_01_VERIFICATION.sql` (post-apply verification)

`90_PM_ID_01_ROLLBACK.sql` is **not** in forward apply order and is **never** auto-executed.

Manifest pin: [`sql-migration-manifest.json`](./sql-migration-manifest.json)

---

## Package contents

| Artifact | Role |
|----------|------|
| `00_PM_ID_01_ACTIVATION_RUNBOOK.md` | This runbook |
| `01_PM_ID_01_EXACT_COMMIT_GUARD.md` | Exact-commit equality rules |
| `02_PM_ID_01_APPLY_AND_ROLLBACK_PLAN.md` | Future apply + rollback boundary |
| `03_PM_ID_01_FAILURE_CLASSIFICATION.md` | Stop / failure classes |
| `sql-migration-manifest.json` | Paths, order, SHA256, combined hash |
| `OWNER_STAGING_APPLY_APPROVAL.template.json` | Default-deny approval template |
| `evidence/` | No-GO + preflight evidence |

Runners:

- `scripts/player-management/pm-id-01-activation-lib.mjs`
- `scripts/player-management/pm-id-01-staging-apply.mjs`
- `scripts/player-management/pm-id-01-activation-preflight.mjs`

---

## Out of scope (must remain false)

- Coaching PLAYER RLS authoring
- `coaching.self.read` grant
- Coaching durable runtime enablement
- Coaching localStorage retirement
- Production target / Production apply
- Mapping row creation / backfill
- Automatic rollback
- File deletion
