# PUBLIC-CATALOG-02 — Production Readiness

## Current Production state (read-only)

| Object | Present |
|--------|---------|
| `public_catalog_tournaments` | NO |
| `public_catalog_rankings` | NO |
| `public_catalog_list_tournaments` | NO |
| `public_catalog_list_rankings` | NO |
| `public_catalog_courts` | YES (4 rows) |
| `public_catalog_list_clubs` / `list_courts` | YES |
| `vpr_leaderboard` | YES (0 rows) |
| `vpr_list_public_leaderboard` | YES |

## Eligible public Tournament / Ranking records

- Eligible PC-02 projection rows: **0** (tables absent)
- No real Production tournament/ranking opt-in candidates in this package
- LIVE + EMPTY is an allowed Production outcome after SQL apply

## Exact Production plan (awaiting Owner GO)

1. Reverify target `expuvcohlcjzvrrauvud` (not Staging)
2. Reverify SQL checksum `29e072039015faf11caf33efddb2a82b21293357ee77b4c0d41ed0c9ffc2a5ba`
3. Apply `10_PUBLIC_CATALOG_02_PUBLIC_READ_RPC.sql` only
4. Do **not** seed synthetic Production data
5. Verify RPC security + empty LIVE responses
6. Verify Clubs/Courts unchanged
7. Do **not** change Vercel env / deploy portal in this workstream
8. Finalize evidence, commit, push, open PR — stop before merge

## Portal selector (FINAL workstream note)

Production portal remains on local Tournaments/Rankings until a separate Owner env cutover sets:

`VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE=remote`

Clubs/Courts remote publication markers must remain ACTIVE_VERIFIED.

## Privacy / security verdict

PASS. Production SQL applied 2026-07-27 under Owner message `GO PUBLIC CATALOG 02 PRODUCTION`.

Post-apply:

- Tournament RPC = LIVE + EMPTY (0 rows)
- Ranking RPC = LIVE + EMPTY (0 rows)
- synthetic/opt-in = 0
- Clubs/Courts + VPR unchanged
- Vercel env / deploy = 0
