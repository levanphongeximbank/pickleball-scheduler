# CUTOVER-02 — Staging Environment Proof Checklist

```text
STAGING_ENVIRONMENT_PROOF=BLOCKED  # until operator fills exact proof below
```

Do **not** guess Staging project ref. Do **not** use a project merely because the name contains “staging”.

## Known refs in repository (scripts)

| Role | Exact ref |
|------|-----------|
| Staging (canonical in rating scripts) | `qyewbxjsiiyufanzcjcq` |
| Production (denylist) | `expuvcohlcjzvrrauvud` |

Code helper: `evaluateStagingEnvironmentProof()` in `environmentGuards.js`.

## Checklist (all required before any Staging mutation)

| # | Proof item | Evidence field | Status |
|---|------------|----------------|--------|
| 1 | Exact Staging project ref | `stagingProjectRef` | ☐ |
| 2 | Exact Production project ref / denylist | `productionProjectRef` | ☐ |
| 3 | Two refs differ | `refsDiffer` | ☐ |
| 4 | Connected MCP/server target | `connectedTargetRef` | ☐ |
| 5 | Read-only vs write-capable mode | `mcpMode` | ☐ |
| 6 | Database identity | `databaseIdentity` | ☐ |
| 7 | Environment label | `environmentLabel` | ☐ |
| 8 | Deployment target | `deploymentTarget` | ☐ |
| 9 | Branch / SHA | `branch`, `sha` | ☐ |
| 10 | Rollback authority | `rollbackAuthority` | ☐ |

If any item unknown:

```text
STAGING_ENVIRONMENT_PROOF=BLOCKED
STAGING_EXECUTION_GO=NO
```
