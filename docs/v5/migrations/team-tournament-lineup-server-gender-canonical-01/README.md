# team-tournament-lineup-server-gender-canonical-01

LOCAL PACKAGE ONLY. Do **not** apply to Staging or Production without Owner GO.

## Why

Owner real-browser Save Draft proved:

| Boundary | Result |
|----------|--------|
| Client validation | PASS (`F04_FINAL_GENDER_KEY=female`) |
| Server `saveDraftLineup` | FAIL `invalid_gender` |

Staging forensic for `c412a101-…000c` (F04):

| Path | Gender |
|------|--------|
| `athletes` → `profiles` via `athletes.user_id` | `female` |
| `team_tournament_resolve_player_gender_key` (pre-apply) | `unknown` |

Root cause: server gender resolver still joined **`profiles.player_id`** (+ optional `club_data_v3` blob). Team membership stores **`athletes.id`**. Captain portal already uses the canonical athletes→profiles join.

## This package

1. `team_tournament_resolve_player_gender_key` → `athletes.id` + `profiles` via `user_id` (fail closed → `unknown`). No `profiles.player_id`. No club blob.
2. `team_tournament_resolve_player_status` → `athletes.status` (same-family stale join).
3. `team_tournament_effective_lineup_gender_requirement` + validate wiring so MLP `gender_requirement=any` rows still enforce male/female/mixed (parity with client `applyCanonicalMlpDisciplineMetadata`).
4. Keeps Dreambreaker skip, CAS writers unchanged (save/submit already share validate).

## Apply order

1. `01_PRECHECK.sql` (fingerprints must match)
2. `02_APPLY.sql`
3. `03_VERIFY.sql` (functional F04 + full MLP + wrong-team)

Rollback: `04_ROLLBACK.sql` restores exact pre-apply bodies.

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `1edd329a9dc213155713ce18e718e334666c85c13406472091be7e19b78aaa67` |
| `02_APPLY.sql` | `3281a1a9994557ddc73a8b45d90ab883bb8e4a9e63973f41ed1d2f5e26ec53fe` |
| `03_VERIFY.sql` | `bc8fec21fb52b81d0e824523077188526777d85bf0a6f104c5ab74f47b9c81cf` |
| `04_ROLLBACK.sql` | `874946b2c1ada28c4182f60285c53dc33bc189df30f9a582c8e65249bae40d92` |

## Pre-apply Staging fingerprints

| Function | md5(pg_get_functiondef) |
|----------|-------------------------|
| `resolve_player_gender_key(text,text,text)` | `820634f96175f548fb2ed3d110d527fa` |
| `resolve_player_status(text)` | `f628846265b3265affe1de639b9b9d3c` |
| `validate_lineup_selections(...)` | `8de77cf4a4ea8031744c592815d548ae` |

## Safety

- No fixture mutation in APPLY
- No Production apply
- No captain portal / client roster changes
- Temporary `?ttLineupDebug=1` Save/Submit boundary panel removed pre-merge (PR #418 hygiene)
