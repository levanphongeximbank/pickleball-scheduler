# team-tournament-scenario-b-ko-lineup-remediation-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

**Forward-only.** NEVER re-run:
- `team-tournament-post-lineup-complete-lifecycle-01`
- `team-tournament-owner-browser-acceptance-remediation-01`
- `team-tournament-close-uuid-type-remediation-01`

## Why

Owner Scenario B (`e3f37ef7-befe-4421-b694-8af57ba92a5d`):

| ID | Defect |
|----|--------|
| B3 | `matchups.replace` via `apply_domain` rejects empty Final `teamAId`/`teamBId` → `UNKNOWN_TEAM` when 2×2=4 creates SF+empty Final |
| B2 | delete-all matchups CASCADE wipes historical group lineups when KO is generated |

Client already derives `resolvedFirstEliminationStage=semifinal` for 4 qualifiers.

## Fix (APPLY)

Rewrite **only** `team_tournament_replace_matchups` to:

1. Allow empty team ids for KO placeholders (non-empty still must exist)
2. Upsert by `external_matchup_id` (preserve internal uuid → preserve lineups)
3. Delete only matchups absent from payload

`apply_domain_setup_mutation` other commands remain untouched.

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql` **once**
3. `03_VERIFY.sql`
4. `04_ROLLBACK.sql` emergency only

## Package LF SHA256 lock

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `491b5cd02fd6d673e97ca72110de007a26185e5b8ca66d8acdf3c3b597f7a43f` |
| `02_APPLY.sql` | `d4ce3718b664747484dbcfaf740f0d0c41a4f2bc020dfd28396e9f285fec64ed` |
| `03_VERIFY.sql` | `ca206cda0798d633b03fef21a18ebff03a34ccb602ffaaefa30bbcd5f0a22d49` |
| `04_ROLLBACK.sql` | `4b1846b9dc7a551daf9bd63782183ca8a6d45f2147fae4aae46732bc26272df0` |
