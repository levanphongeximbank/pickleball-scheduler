# Local real PostgreSQL — team-tournament-production-alignment-01

Date: 2026-08-14  
Host: disposable embedded PostgreSQL 16.4 on `127.0.0.1` (`C:\PVN-WT\b1b-wp5-embed-work`).  
Never Staging `qyewbxjsiiyufanzcjcq`. Never Production `expuvcohlcjzvrrauvud`.

Harness: `tests/team-tournament-production-alignment-01-real-postgres.test.js`  
Opt-in: `OPERATION_B1B_WP5_ENABLE_REAL_POSTGRES=1` + `OPERATION_B1B_WP5_AUTO_PROVISION=1`

## Prestate model

1. Foundation bootstrap fixture
2. Extra Production-like prestate (82 dummy `team_tournaments` headers, legacy overloads, `profiles.player_id` identity)
3. PR #423 `team-tournament-production-referee-foundation-01/02_APPLY.sql`

Header count after model: **82**

## Sequence (PASS)

| Step | Result |
|------|--------|
| `01_PRECHECK` | PASS (`production_prestate_ready`) |
| `02_APPLY` | PASS |
| `03_VERIFY` | PASS (`CREATE_PATH_READY=YES`) |
| Existing 82 headers preserved | PASS |
| `captainAccessEnabled` backfill count | 0 |
| Second APPLY + VERIFY | PASS (idempotent ledger / no prestate overwrite) |
| `canonical-referee-lifecycle-01/01_PRECHECK` after alignment | PASS |
| Optional local continuation APPLY/VERIFY (disposable DB only; package files not altered) | PASS |
| ROLLBACK restores prestate (`create` absent, save 4-arg present, #423 foundation present) | PASS |
| ROLLBACK after post-alignment create | FAIL CLOSED (`ROLLBACK_COMPLETE=NO post_alignment_canonical_team_tournaments=1`) |
| Conflicting overload PRECHECK | FAIL CLOSED (`conflict=`) |
| Anon GRANT on `team_tournament_create` PRECHECK | FAIL CLOSED (`unexpected_grants`) |
| Partial alignment PRECHECK | FAIL CLOSED (`partial_alignment_state`) |

## Verdict

`REAL_POSTGRES=YES`  
`ALIGNMENT_TO_CANONICAL_REFEREE_COMPOSITION=PASS` (PRECHECK; continuation APPLY only on disposable local DB)

`STAGING_MUTATIONS=0`  
`PRODUCTION_SQL_MUTATIONS=0`  
`PRODUCTION_DATA_MUTATIONS=0`
