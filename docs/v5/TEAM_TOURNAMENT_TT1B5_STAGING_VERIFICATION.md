# Team Tournament — TT-1B.5 Staging Verification

**Generated:** 2026-07-11T22:25:39.446Z
**Commit:** 15b5efb78839e92725177314682e16d53cc3eaca
**Verdict:** READY FOR TT-1C
**Production impact:** NONE

## 1. Staging environment

| Field | Value |
|-------|-------|
| Project ref | qyewbxjsiiyufanzcjcq |
| URL | https://qyewbxjsiiyufanzcjcq.supabase.co |
| Branch | feature/competition-core-standardization |

## 2. SQL review

- `no_drop_table`: **PASS**
- `no_truncate`: **PASS**
- `idempotent_ddl`: **PASS**
- `pgcrypto`: **PASS**
- `version_columns`: **PASS**
- `command_log_unique`: **PASS**
- `lineup_select_revoked`: **PASS**
- `payload_hash_extensions_digest`: **PASS**
- `search_path_set`: **PASS**
- `security_definer`: **PASS**
- `overall`: **PASS**

## 3. Pre-migration state

See `docs/v5/qa-evidence/phase-tt1b5-staging/REPORT.json` for full table counts.

## 4. Migration apply

{
  "status": "SKIPPED",
  "reason": "No --apply-sql flag; thiếu STAGING_SUPABASE_DB_URL / SUPABASE_ACCESS_TOKEN",
  "manual": "docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql → SQL Editor staging qyewbxjsiiyufanzcjcq"
}

## 5. Verification queries

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| V2_command_log_table | Có | PASS | PASS |
| V2_lineup_revisions_table | Có | PASS | PASS |
| V4_rpc_get_visible_lineups | Có | PASS | PASS |
| V4_rpc_apply_forfeit | Có | PASS | PASS |
| V6_version_column_readable | Có | PASS | PASS |

## 6. RLS security matrix

| Probe | Expected | Actual | Result |
|-------|----------|--------|--------|
| CaptainA-direct-select-opponent | Blocked/0 rows | 0 rows | PASS |

## 7. RPC visibility matrix

| Role probe | Result | Detail |
|------------|--------|--------|
| BTC-visible-lineups | PASS | {"ownSelections":"null","opponentSelections":"present","matchupStatus":"locked"} |
| CaptainA-visible-lineups | PASS | {"ownSelections":"present","opponentSelections":"present","matchupStatus":"locked"} |
| CaptainB-visible-lineups | PASS | access_denied: cross-tenant |
| Referee-visible-lineups | PASS | {"ownSelections":"null","opponentSelections":"present","matchupStatus":"locked"} |
| Viewer-visible-lineups | PASS | {"ownSelections":"null","opponentSelections":"present","matchupStatus":"locked"} |
| CrossTenant-visible-lineups | PASS | access_denied: cross-tenant |

## 8–10. Locking / Idempotency / Repository

See REPORT.json sections `lockingScenarios`, `idempotencyScenarios`, `repositoryIntegration`.

## 11. Dry-run migration

```json
{
  "phase": "TT-1B",
  "dryRun": true,
  "stats": {
    "read": 1,
    "valid": 1,
    "migrated": 1,
    "skippedDuplicate": 0,
    "conflicts": 0,
    "errors": 0,
    "conflictReports": [],
    "errorReports": []
  },
  "seedStats": "tournaments: insert=0 update=0 skip=0\nteams: insert=0 update=0 skip=0\nmembers: insert=0 update=0 skip=0\ndisciplines: insert=0 update=0 skip=0\nmatchups: insert=0 update=0 skip=0\nlineups: insert=0 update=0 skip=0\nlineupEntries: insert=0 update=0 skip=0\nsubMatches: insert=0 update=0 skip=0\nstandings: insert=0 update=0 skip=0",
  "generatedAt": "2026-07-11T22:25:54.464Z"
}
```

## 12. Shadow comparison (synthetic probe)

{
  "syntheticMismatchDetected": true,
  "mismatchCount": 1,
  "sample": [
    {
      "entityType": "lineup",
      "entityKey": "phase23d-matchup-1::phase23d-team-b",
      "mismatchType": "value_mismatch",
      "blobHash": "63e3f79ecdd904e89ed7c0783a53b2a2bdd7ed0d99dcc44658bdc72777411558",
      "cloudHash": "fe69b7a49658b6c4764645bfec3afb8d5652311218f7ce68b884fb445dad72de"
    }
  ]
}

## 13. Regression tests

{
  "tt1b": {
    "exitCode": 0,
    "passed": 17,
    "failed": 0
  },
  "allTeamTournament": {
    "exitCode": 0,
    "passed": 128,
    "failed": 0
  }
}

## 14. Known conditions

- TT-1C UI wire NOT started
- Production expuvcohlcjzvrrauvud untouched
- Legacy callers with null idempotency_key delegate to *_legacy RPC body

## 15. TT-1B SQL §11 RPC guards (staging MCP)

| Check | Result |
|-------|--------|
| §11 applied (qyewbxjsiiyufanzcjcq) | **APPLIED** |
| Database smoke | **PASS** |
| Guard flag `VITE_TEAM_TOURNAMENT_TT1B_RPC_GUARDS=deployed` | **documented** |

Migrations: `phase_tt1b_section11_rpc_guards`, `phase_tt1b_section11_revoke_anon_rpc`

Evidence: `docs/v5/qa-evidence/phase-tt1b5-staging/SECTION11_SMOKE_REPORT.json`

TT-1B wrapper signatures:

- `team_tournament_save_lineup_draft` — **6 params**
- `team_tournament_upsert_standings` — **4 params**

Legacy preserved: `team_tournament_save_lineup_draft_legacy` (4), `team_tournament_upsert_standings_legacy` (2)

**STOP — TT-1B.5 complete. Do not proceed to TT-1C without owner GO.**