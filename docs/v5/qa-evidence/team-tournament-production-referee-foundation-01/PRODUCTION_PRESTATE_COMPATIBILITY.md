# Production prestate compatibility

Production project: `expuvcohlcjzvrrauvud` (not mutated by this workstream).

Expected Production prestate:

- 82 Team Tournaments already exist and must remain unchanged.
- Referee foundation tables/functions listed in the Owner GO brief are absent.
- Base Team Tournament objects (`team_tournaments`, matchups, sub-matches,
  dreambreaker states, `can_manage`, `start_dreambreaker` 4-arg,
  `confirm_sub_match` 7-arg) already exist.

This package:

- Creates empty foundation tables.
- Does not backfill 82 tournaments.
- Does not replace `confirm_sub_match` / `save_sub_match_draft` / `start_dreambreaker`.
- Extra Production overloads (historical 5-arg confirm, 4-arg save) are ignored.

EXISTING_TOURNAMENT_BACKFILL_REQUIRED=NO  
EXISTING_BUSINESS_DATA_MUTATION=NO  
FUTURE_WRITES_ONLY=YES  
STAGING_ROWS_COPIED=0
