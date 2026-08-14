# Daily Play canonical session close + Singles/Open final lifecycle

**DO NOT APPLY WITHOUT OWNER GO STAGING.**

This additive package installs:

- `public.daily_play_close_session`
- match-type authority (`daily_play_canonical_match_type`) — no unknown→mixed fallback
- match-shape helpers (`daily_play_match_shape`, `daily_play_validate_match_shape`)
- gender authority (`daily_play_athlete_gender_key`, `daily_play_validate_match_gender`)
  from `athletes` → `profiles.gender` (not names, not client payload)
- post-close write guards (`daily_play_session_write_denied`)
- snapshot `tournamentStatus` (occupancy `occupiedCourtIds` preserved)

The implementation run that produced it used `STAGING_MUTATIONS=0`. Nothing here was
applied to Staging or Production. Canonical Court Time Allocation is **not** in this
package.

## Why this exists

Daily Play needed one consolidated final-lifecycle authority:

1. Singles (`men_single` / `women_single`) and Open Doubles (`open_double`) as first-class
   match types. `auto` stays a separate pairing strategy and is **not** mapped to
   `open_double`.
2. Server-authoritative session close: cancel waiting, clear check-ins, release **own**
   active leases, mark `canonical_tournaments.status = completed`.
3. Post-close: `get_state` allowed; operational writes denied; `correct_score` still
   allowed on completed matches without reopening the session.

## Run order after Owner GO

1. `01_PRECHECK.sql` — prove e2e + occupancy + score-correction + athlete/profile gender dependencies exist.
2. `02_APPLY.sql` — replace write RPCs/snapshot and install close/match-shape helpers.
   Second APPLY is `CREATE OR REPLACE` (idempotent function replace).
3. `03_VERIFY.sql` — signatures, SECURITY DEFINER/search_path, grants, close/post-close
   contract, occupancy unique index still present. `closeSummary` is verified from the
   bounded `jsonb_build_object` construction only (keys `completedMatchCount`,
   `cancelledWaitingCount`, `checkedInCountAtClose`); it does not scan unrelated
   `playerIds` / `jsonb_agg` text elsewhere in `close_session`.
4. Browser/staging QA only after a later Owner GO.
5. `04_ROLLBACK.sql` **only after confirmed APPLY of this exact package** and when
   rollback preconditions match. Accidental rollback-before-apply is refused
   (`ROLLBACK_REFUSED`) and does not rewrite RPC bodies.

## Security

`daily_play_close_session` is `SECURITY DEFINER`, pins `search_path = public`, asserts
tenant and `tournament.update`, and is executable by `authenticated` only. `anon` EXECUTE
is denied. Helpers are not client-executable. Leases/ledger remain without direct table
grants.

Close under row lock:

- Closable tournament statuses: `draft` / `registration` / `ready` / `active`
- `completed` → `SESSION_ALREADY_COMPLETED`
- `cancelled` or any other tournament status → `SESSION_NOT_ACTIVE` (never cancelled→completed)
- BLOCK if any match is `assigned`, `playing`, or an unrecognized status → `SESSION_CLOSE_BLOCKED`
- ALLOW when remaining matches are `waiting` / `completed` / `cancelled` / `forfeit`
- waiting → cancelled with `reason=session_closed`
- own active leases only (`tenant_id` + `club_id` + `tournament_id`)
- `closedBy` is `auth.uid()` only — no placeholder actor
- write_state runs before lease release; CAS failure RAISES so the close block rolls back
- `correct_score` is intentionally **not** guarded by session-completed denial
- `auto` is a pairing strategy and is **rejected** at `create_matches` (fail closed; no persisted auto matches in Staging/Production at authoring time)
- create_matches normalizes legacy AI aliases to canonical Daily types and enforces gender from `profiles` via `athletes.user_id`

## Acceptance matrix (local)

| Item | Local |
|---|---|
| CREATE_SESSION | PASS (existing launcher) |
| CHECK_IN_OUT | PASS |
| MATCH_TYPE_MEN_SINGLE | PASS |
| MATCH_TYPE_WOMEN_SINGLE | PASS |
| MATCH_TYPE_MEN_DOUBLE | PASS |
| MATCH_TYPE_WOMEN_DOUBLE | PASS |
| MATCH_TYPE_MIXED_DOUBLE | PASS |
| MATCH_TYPE_OPEN_DOUBLE | PASS |
| PLAYER_POOL_FILTERING | PASS |
| FAIR_MATCH | PASS |
| QUEUE_FIRST | PASS |
| ASSIGN | PASS |
| START | PASS |
| SUBMIT_SCORE | PASS |
| CORRECT_SCORE | PASS (including after close) |
| CANCEL | PASS |
| CHANGE_COURT | PASS (canonical RPC UI wired) |
| GLOBAL_COURT_OCCUPANCY | PASS (occupancy unique index untouched) |
| PLAYER_RELEASE | PASS |
| COURT_RELEASE | PASS |
| CLOSE_SESSION | PASS (in-memory + SQL package) |
| WAITING_CANCEL_ON_CLOSE | PASS |
| CLOSE_BLOCKED_ASSIGNED | PASS |
| CLOSE_BLOCKED_PLAYING | PASS |
| POST_CLOSE_READ_ONLY | PASS |
| POST_CLOSE_MUTATION_GUARDS | PASS |
| F5_REOPEN_COMPLETED_STATE | PASS (same route, no launcher redirect) |
| NEXT_SESSION_AFTER_CLOSE | PASS (`findOpenDailyPlayTournament` ignores completed) |
| TENANT_RLS | PASS (in-memory tenant assertion) |
| CAS | PASS |
| IDEMPOTENCY | PASS |
| DIRECTOR | PASS (Singles + completed read-only + no Daily legacy unlock) |
| MOBILE | PASS (source: wrap/fullWidth/xs grid; no new mobile module) |
| TAB_RESUME | PASS (DP13B spinner contract) |
| REAL_BROWSER_STAGING | PENDING |
| PRODUCTION_SMOKE | PENDING |
| DAILY_PLAY_END_TO_END_CLOSED | NO |

## Local SQL execution

This worktree has no disposable PostgreSQL (`psql` / Docker not available).
`SQL_PRECHECK_LOCAL`, `SQL_APPLY_LOCAL`, `SQL_VERIFY_LOCAL`, and `SQL_ROLLBACK_LOCAL`
are **NOT_AVAILABLE**. Package files were authored and contract-tested from source
only. Do not use Staging as a substitute.

