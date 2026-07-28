# Reseed package — deterministic post-wipe initialization
# NOT executed in Phase 4. Owner GO required for Staging/Production.

## Order

1. Owner tenant preserved (`venues`, `tenant_members`, Auth, profiles)
2. Club — create via club RPC (`club_create` / phase42)
3. Venue clusters — recreate `court_clusters`
4. Courts — inventory under cluster
5. Player — athletes + `player_id` mapping
6. Rating profile — foundation/V5 durable (flag ON)
7. Competition — `competition_ssot_competitions` insert + command log
8. Participants — `competition_ssot_participants`
9. Schedule/matches — `competition_ssot_matches`
10. Finalized result — **only** `competition_ssot_finalize_match_result`
11. Rating update — only if MatchResultRatingPort explicitly implemented (default: skip)
12. Public Catalog projections — republish clubs/courts

## Rules

- Idempotent keys: `hard-cutover-seed::{tenant}::{entity}`
- Do **not** create Auth users
- Do **not** change Owner UUID
- Verify with `sql/reseed/99_VERIFY_RESEED.sql`
