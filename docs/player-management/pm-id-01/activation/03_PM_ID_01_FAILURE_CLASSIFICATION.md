# PM-ID-01 — Failure / Stop Classification

| Code | Meaning | DB connection | Writes |
|------|---------|---------------|--------|
| `PM_ID_01_APPLY_REFUSED_OWNER_GO_NOT_GRANTED` | Owner GO token missing/wrong; default refuse | no | 0 |
| `PM_ID_01_EXECUTION_COMMIT_MISMATCH_REFUSED` | Short SHA / branch / HEAD mismatch / ancestor-only approval | no | 0 |
| `PM_ID_01_APPLY_REFUSED` | Generic guard refuse | no | 0 |
| `PM_ID_01_STAGING_APPLY_BLOCKED` | Live path blocked (e.g. missing token after GO) or mid-apply failure | maybe | checkpoint-scoped |
| `PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_PASS` | Live read-only preflight ok | read-only | 0 |
| `PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_BLOCKED` | Offline fail or Production detected before/at probe | no or read-only fail-closed | 0 |
| `PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_FAIL` | Live probe HTTP/query failure | read-only attempt | 0 |
| `PM_ID_01_ACTIVATION_BASE_ALIGNMENT_BLOCKED` | Cannot fast-forward to origin/main | n/a | 0 |
| `PM_ID_01_ACTIVATION_SCOPE_BLOCKED` | Requested change outside allowed file scope | n/a | 0 |

## Evidence schemas

See `evidence/schemas/`.

Required safety markers on refuse / preflight paths:

```json
{
  "databaseWrites": 0,
  "sqlApplied": false,
  "mappingRowsCreated": 0,
  "backfillExecuted": false,
  "roleGrantsApplied": false,
  "productionTouched": false,
  "filesDeleted": false,
  "CODEX_DELETE_ALLOWED": "NO"
}
```
