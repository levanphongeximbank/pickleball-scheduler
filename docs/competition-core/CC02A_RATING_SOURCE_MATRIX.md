# CC-02A — Rating Source Matrix

**Phase:** CC-02A | **Date:** 2026-07-11

| Legacy field / source | Scale | Maps to (V2) | Read priority | Write in CC-02A |
|----------------------|-------|--------------|---------------|-----------------|
| `current_rating` | 1.0–8.0 skill | `publicSkillLevel` | 1 (public) | No |
| `skillLevel` / `level` / `rating` | skill mirrors | `publicSkillLevel` | 2 (fallback) | No |
| `ratingInternal` | skill (legacy) | `competitionElo` via `mapLegacySkillToInitialElo` | 3 (inferred) | No |
| `competitionElo` (new blob) | Elo 1500+ | `competitionElo` | 1 (competition) | No |
| `rating_confidence` | 0–1 or 0–100 | `ratingConfidence` 0–100 | normalize on read | No |
| `rating_status` (Pick_VN 8 values) | enum | `COMPETITION_RATING_STATUS` (future map) | passthrough | No |
| `rating_match_count` | integer | `competitionMatchCount` fallback | copy on read | No |
| `dailyPlayRating` | TBD | `dailyPlayRating` | null until CC-02B+ | No |
| Club extension `elo` | 1500 scale | separate store | not merged in CC-02A | No |
| `pick_vn_player_ratings.current_rating` | cloud public | sync via Pick_VN module | out of CC-02A scope | No |

**Migration source tag:** `ratingV2BackfillSource` = `migration` | `cc02-backfill` | `questionnaire` | etc.
