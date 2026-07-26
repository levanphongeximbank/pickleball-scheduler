# COACHING-04 — Failure Classification

**CODEX_DELETE_ALLOWED:** `NO`

| Verdict | When |
|---------|------|
| `COACHING_04_APPLY_REFUSED_OWNER_GO_NOT_GRANTED` | Missing/wrong Owner GO |
| `COACHING_04_EXECUTION_COMMIT_MISMATCH_REFUSED` | Commit pin mismatch / short SHA / branch / ancestor-only |
| `COACHING_04_MANIFEST_HASH_MISMATCH_REFUSED` | combinedManifestHash pin mismatch |
| `COACHING_04_SQL_HASH_MISMATCH_REFUSED` | aggregateSha256Forward / per-file SHA mismatch |
| `COACHING_04_SQL_ORDER_MISMATCH_REFUSED` | Forward order not 10→11→20→21→30→40 |
| `COACHING_04_WRONG_TARGET_REFUSED` | Non-staging / wrong project ref |
| `COACHING_04_PRODUCTION_TARGET_REFUSED` | Production ref detected |
| `COACHING_04_DIRTY_WORKTREE_REFUSED` | Dirty working tree |
| `COACHING_04_MISSING_CREDENTIALS_REFUSED` | Live path missing `SUPABASE_ACCESS_TOKEN` |
| `COACHING_04_STAGING_APPLY_BLOCKED` | Live apply stopped on first error |

All refusal classes keep:

- `databaseWrites=0` when refused before connection
- `sqlApplied=false` during preparation / no-GO
- `mappingRowsCreated=0`
- `backfillExecuted=false`
- `runtimeActivated=false`
- `localStorageRetired=false`
- `productionTouched=false`
- `automaticRetry=false`
- `automaticRollback=false`
