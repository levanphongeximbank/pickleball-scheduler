# Production Player Data Audit Report

- Generated: 2026-08-05T07:06:58.336Z
- Production ref: `expuvcohlcjzvrrauvud`
- Verdict: **PRODUCTION_PLAYER_DATA_AUDIT_COMPLETE_READY_FOR_IMPLEMENTATION**
- Production GO: **NO**

## Safety

- Harness mode: READ_ONLY_MANAGEMENT_API_SELECT
- Credential variable used: `SUPABASE_ACCESS_TOKEN`
- Target validation variable: `SUPABASE_DB_URL`
- Credential validation: PASS
- Target project match: true
- Production read-only query count: 16
- Production mutations: 0
- SQL apply: 0
- Deployments: 0
- Traffic changes: 0
- Credentials cleared: YES

## Harness read-only proof

- All database calls go through selectSql() with assertReadOnlySql().
- assertReadOnlySql refuses non-SELECT and mutation keywords (insert/update/delete/ddl/etc).
- Management API endpoint used only for SELECT query bodies; no mutation RPC invoked.
- No PostgREST INSERT/UPDATE/DELETE; no auth admin delete; no Storage calls; no deploy.
- Local writes limited to audit report JSON/MD under docs/v5/qa-evidence/...

## Live gender inventory — public.profiles.gender

| value | count |
|---|---:|
| __NULL__ | 25 |
| female | 17 |
| male | 15 |
| Nam | 4 |

- Total rows: 61
- Rows requiring normalization: 4

## Operational club_data_v3 player gender

| value | count |
|---|---:|

- Club count: 1
- Player count: 0
- Blob rows requiring normalization: 0

## Female-zero proof (live)

```json
{
  "profilesExact": [
    {
      "value": "__NULL__",
      "count": 25
    },
    {
      "value": "female",
      "count": 17
    },
    {
      "value": "male",
      "count": 15
    },
    {
      "value": "Nam",
      "count": 4
    }
  ],
  "blobExact": [],
  "ifUiCountsOnlyNu_femaleVisibleButZero": true,
  "ifEngineCountsOnlyFemale_nuVisibleButZero": false,
  "strictEqualityNuCount": 0,
  "strictEqualityFemaleCount": 17,
  "strictEqualityNamCount": 4,
  "strictEqualityMaleCount": 15
}
```

## Strict Nam/Nữ reader dependencies

| file | symbol | pattern |
|---|---|---|
| src/utils/playerHelpers.js | computePlayerDashboardStats | gender === "Nam" / "Nữ" |
| src/components/players/PlayerCard.jsx | isFemale/isMale styling | gender === "Nữ" / "Nam" |
| src/engine/index.js | malePlayers filter | gender === "Nam" |
| src/legacy/engine-v1/index.js | malePlayers filter | gender === "Nam" |
| src/data/samplePlayers.js | seed name picker | gender === "Nữ" |

- Strict-reader dependency count: 5

## Test identity summary

```json
{
  "suspectedProfileCount": 11,
  "confirmedTestIdentityCount": 11,
  "safeToQuarantine": 9,
  "referencedCleanup": 2,
  "retainAsEvidence": 0,
  "notATestIdentity": 0,
  "unresolvedIdentityCount": 0,
  "automatedProdSmokeLikely": 11
}
```

## Classifications

- GENDER_MODEL: B. MULTIPLE_ACTIVE_GENDER_MODELS
- TEST_ACCOUNTS: B. REFERENCED_REQUIRES_CONTROLLED_CLEANUP

## Blockers / warnings

- Blocker count: 0
- Warning count: 0
- Blockers: none
- Warnings: none

## Plans prepared (NOT APPLIED)

- Canonical gender normalization plan
- Writer guard plan
- Read compatibility plan
- Test-account quarantine/cleanup plan
- Rollback plan
