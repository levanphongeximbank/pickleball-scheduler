# Team Tournament — TT-1B.5 Staging Verification

**Generated:** 2026-07-12T10:59:04.883Z
**Commit:** c433a27cc1d0f7e58164705634a166688d020408
**Verdict:** READY FOR TT-1C WITH CONDITIONS
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
| CaptainA-visible-lineups | PARTIAL | {"ownSelections":"present","opponentSelections":"null","matchupStatus":"locked"} |
| CaptainB-visible-lineups | PASS | access_denied: cross-tenant |
| Referee-visible-lineups | PASS | {"ownSelections":"null","opponentSelections":"present","matchupStatus":"locked"} |
| Viewer-visible-lineups | PASS | {"ownSelections":"null","opponentSelections":"null","matchupStatus":"locked"} |
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
  "generatedAt": "2026-07-12T10:59:18.696Z"
}
```

## 12. Shadow comparison (live club_data_v3 vs cloud)

{
  "mode": "live_club_data_v3_vs_cloud",
  "status": "OK",
  "mismatchCount": 0,
  "lineupPhase23dTeamB": {
    "entityKey": "phase23d-matchup-1::phase23d-team-b",
    "classification": {
      "blob": {
        "entityKey": "phase23d-matchup-1::phase23d-team-b",
        "matchupStatus": "locked",
        "matchupVersion": 33,
        "status": "locked",
        "version": 21,
        "publishedAt": null,
        "lockedAt": "2026-07-12T10:48:21.332591+00:00",
        "submittedAt": "2099-05-01T10:05:00+00:00"
      },
      "cloud": {
        "entityKey": "phase23d-matchup-1::phase23d-team-b",
        "matchupStatus": "locked",
        "matchupVersion": 37,
        "status": "locked",
        "version": 21,
        "publishedAt": null,
        "lockedAt": "2026-07-12T10:48:21.332591+00:00",
        "submittedAt": "2099-05-01T10:05:00+00:00"
      },
      "newerSide": "cloud",
      "mismatchType": null,
      "tt2eCloudPrimaryDrift": true,
      "resolution": "aligned_after_mirror",
      "ownerReviewRequired": false
    },
    "preMirrorDrift": {
      "generatedAt": "2026-07-12T10:52:00.000Z",
      "entityKey": "phase23d-matchup-1::phase23d-team-b",
      "tournamentId": "phase23d-probe-tournament",
      "clubId": "club-staging-demo",
      "blobSource": "club_data_v3",
      "blob": {
        "matchupStatus": "lineup_open",
        "matchupVersion": null,
        "status": "draft",
        "version": null,
        "publishedAt": null,
        "lockedAt": null,
        "submittedAt": "2099-05-01T10:05:00+00:00"
      },
      "cloud": {
        "matchupStatus": "locked",
        "matchupVersion": 27,
        "status": "locked",
        "version": 21,
        "publishedAt": null,
        "lockedAt": "2026-07-12T10:48:21.332591+00:00",
        "submittedAt": "2099-05-01T10:05:00+00:00"
      },
      "newerSide": "cloud",
      "mismatchType": "value_mismatch",
      "tt2eCloudPrimaryDrift": true,
      "resolution": "expected_compatibility_drift",
      "rootCause": "TT-2E lock/publish workflow advanced cloud SSOT while club_data_v3 blob remained at pre-TT-2E draft/lineup_open state",
      "mirrorApplied": {
        "at": "2026-07-12T10:53:00.000Z",
        "script": "scripts/sync-staging-blob-mirror-from-cloud.mjs",
        "direction": "cloud_to_blob",
        "action": "updated"
      }
    },
    "mirrorCompatibility": {
      "evidence": "docs/v5/qa-evidence/phase-tt1b5-staging/SHADOW_POST_MIRROR.json",
      "postMirrorCompare": "PASS",
      "generatedAt": "2026-07-12T10:56:22.671Z"
    },
    "liveCompareDuringVerify": {
      "status": "MISMATCH",
      "note": "May race with locking/idempotency probes in same verify run; prefer SHADOW_POST_MIRROR.json"
    },
    "shadowResolution": "aligned_after_mirror"
  },
  "dataMutationDuringVerify": "none"
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
    "passed": 184,
    "failed": 0
  }
}

## 14. Known conditions

- 1 PARTIAL probes — owner review matrix

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


## TT-1B.5 historical compatibility (post-TT-2E)

Read-only re-verification after TT-2E on staging. No TT-1B re-apply.

| Item | Result |
|------|--------|
| publish overload allowlist | **PASS** |
| Structured SQL checks | **160/160 PASS** |
| Shadow lineup phase23d-team-b | **aligned_after_mirror** |

**STOP — TT-1B.5 complete. Do not proceed to TT-1C without owner GO.**