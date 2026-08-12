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

1. `team_tournament_create` merges MLP settings and **calls**
   `team_tournament_seed_mlp_disciplines`, which seeds four normal
   disciplines plus Dreambreaker catalog (`mlp-wd`, `mlp-md`, `mlp-xd1`,
   `mlp-xd2`, `dreambreaker`). Create returns `tournament.teamData`
   matching subsequent get_setup domain collections. VERIFY inspects the
   seed helper for catalog literals — not the create caller.
2. `team_tournament_commit_pairing` writes teams + captains + members +
   groups in one transaction. Post-DML validation failures RAISE so the
   transaction rolls back (no partial teams). Optional `p_expected_version`
   CAS. Cloud client must fail closed if this RPC is missing — no
   save_team / groups.replace fallback.

## Apply order

1. `01_PRECHECK.sql`
2. `02_APPLY.sql`
3. `03_VERIFY.sql`

Rollback: `04_ROLLBACK.sql` (restores #417 header-only create; does not
delete already-seeded discipline rows).

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `23c246bf94cd9f2d52685ad73d127f3ae0ee594edb4c5e7cfa0468ead3e6cb02` |
| `02_APPLY.sql` | `ff4ee2ca92f99db5eadf0eb842f310578865ea9b7e7595f1c0bec5b79790ed9c` |
| `03_VERIFY.sql` | `d475427d7ffaced2662a2698801fe69e6d0a391d6335ee728641db6f615169c2` |
| `04_ROLLBACK.sql` | `0a2084f2054934450424b9a9cf57f5c0ebb7b1d23dcd055311fd4d20fdcf5f81` |

## Safety

- No fixture mutation
- No Production apply
- Idempotent seed (`ON CONFLICT DO NOTHING`, skip if any discipline exists)
