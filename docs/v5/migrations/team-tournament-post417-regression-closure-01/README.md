# team-tournament-post417-regression-closure-01

LOCAL PACKAGE ONLY. Do not apply to Staging or Production without Owner GO.

## Why

PR #417 shipped canonical `team_tournament_create` as header+settings only.
`get_setup` v7 no longer hydrates a blob. Setup writers stayed behind
`VITE_TEAM_TOURNAMENT_SETUP_MUTATION_V7` default OFF. Combined:

- Format & Venue dirty courts were wiped by polling rehydrate
- Captain confirm preflight failed (gate OFF) → UI stuck until F5
- F5 showed empty teams/groups ("Nháp — chưa có đội")
- MLP Nội dung was empty (JS-only `createMlpDisciplines` never persisted)

## This package

1. `team_tournament_create` merges MLP settings and seeds four normal
   disciplines plus Dreambreaker catalog (`mlp-wd`, `mlp-md`, `mlp-xd1`,
   `mlp-xd2`, `dreambreaker`). Returns `tournament.teamData` matching
   subsequent get_setup domain collections.
2. `team_tournament_commit_pairing` writes teams + captains + members +
   groups in one transaction.

## Apply order

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` (restores #417 header-only create; does not
delete already-seeded discipline rows).

## Safety

- No fixture mutation
- No Production apply
- Idempotent seed (`ON CONFLICT DO NOTHING`, skip if any discipline exists)
