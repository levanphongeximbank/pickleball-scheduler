# COACHING-04 — Guarded Staging Activation Runbook

**Workstream:** COACHING-04 — Guarded Staging Activation Package  
**Target Staging project ref:** `qyewbxjsiiyufanzcjcq`  
**Owner GO token:** `COACHING_04_OWNER_GO_APPLY_STAGING` (**not granted** in this step)  
**CODEX_DELETE_ALLOWED:** `NO`

---

## Purpose

Author and certify a **guarded activation package** for the already-merged COACHING-04 SQL/contract. This step does **not** apply SQL, does **not** create mapping rows, does **not** run backfill, does **not** activate durable runtime, does **not** retire localStorage, and does **not** touch Production.

Local tests PASS / preflight PASS / CI green / PR merge **do not** grant apply permission.

---

## Default behaviour (current authorization)

```bash
node scripts/coaching/coaching-04-staging-apply.mjs
```

Must print `APPLY_MODE=REFUSED` and write:

`docs/coaching-training/coaching-04/evidence/APPLY_REFUSED_NO_GO.json`

Classification:

`COACHING_04_APPLY_REFUSED_OWNER_GO_NOT_GRANTED`

Evidence markers:

| Marker | Required value |
|--------|----------------|
| `ownerGoGranted` | `false` |
| `databaseConnectionOpened` | `false` |
| `databaseWrites` | `0` |
| `sqlApplied` | `false` |
| `mappingRowsCreated` | `0` |
| `backfillExecuted` | `false` |
| `runtimeActivated` | `false` |
| `localStorageRetired` | `false` |
| `productionTouched` | `false` |
| `filesDeleted` | `false` |
| `automaticRetry` | `false` |
| `automaticRollback` | `false` |

---

## Read-only Staging preflight (allowed now)

```bash
node scripts/coaching/coaching-04-activation-preflight.mjs
node scripts/coaching/coaching-04-activation-preflight.mjs --live-readonly
```

Uses `BEGIN TRANSACTION READ ONLY` … `ROLLBACK` only.

---

## Exact SQL execution order

1. `10_COACHING_04_ASSIGNMENT_HELPERS.sql`
2. `11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql`
3. `20_COACHING_04_ASSIGNMENT_RLS.sql`
4. `21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql`
5. `30_COACHING_04_SCOPED_RPCS.sql`
6. `40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql`
7. `99_COACHING_04_VERIFICATION.sql` (post-apply verification only)

`90_COACHING_04_ROLLBACK.sql` is **not** in forward apply order and is **never** auto-executed.

Manifest pin: [`../sql-migration-manifest.json`](../sql-migration-manifest.json)

---

## Live execute (future only — requires Owner GO)

All required **simultaneously**:

```bash
# Illustrative — DO NOT RUN until Owner grants GO for an exact commit + hashes
node scripts/coaching/coaching-04-staging-apply.mjs \
  --execute \
  --environment=staging \
  --project-ref=qyewbxjsiiyufanzcjcq \
  --expected-commit=<exact-40-char-HEAD-sha> \
  --owner-approved-commit=<exact-40-char-HEAD-sha> \
  --expected-manifest-hash=16cdb19ff57b0e0460610e8a341ca8f2786ff19a067839a80996866f61111eaa \
  --expected-aggregate-sql-hash=662e70fbb3c76785d7910492284224df6bd04fa6a0ef358231f2ddccbc3386d4 \
  --owner-go=COACHING_04_OWNER_GO_APPLY_STAGING \
  --preflight-pass
```

Missing any condition → refuse **before** database connection.

---

## Refusal conditions (deterministic)

| Condition | Effect |
|-----------|--------|
| No Owner GO | Refuse before DB |
| Wrong GO token | Refuse before DB |
| Wrong Staging project ref | Refuse before DB |
| Production target | Refuse before DB |
| Wrong execution commit | Refuse before DB |
| Dirty worktree | Refuse before DB |
| Manifest hash mismatch | Refuse before DB |
| Aggregate SQL hash mismatch | Refuse before DB |
| Unexpected SQL order | Refuse before DB |
| Missing credentials (live path) | Refuse before SQL |
| Missing preflight PASS | Refuse before DB |

No automatic retry. No automatic rollback. No partial continuation from mid-file.

---

## Out of scope (must remain false)

- Mapping-row creation
- Backfill
- Durable runtime activation
- localStorage retirement
- Production apply
- Automatic rollback / retry
