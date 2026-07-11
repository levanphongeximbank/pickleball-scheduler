# CC-04B — Seed Source Inventory

**Phase:** CC-04B audit (read-only)

## Required sources

| Source | Legacy keys / paths |
|--------|---------------------|
| Average level | `level`, `rating`, `playerRating()`, team `avgLevel` |
| Competition Elo | `elo`, CC-02 `competitionElo` (future) |
| Internal rating | `ratingInternal`, `getPlayerRatingInternal` |
| Manual seed | `manualSeedOverride`, preset `seed` |
| Ranking | Season/standings rank (post-draw context) |
| Performance | `recentPerformance` (TE 4.0) |
| Provisional | `provisional_rating`, `rating_status=provisional` |
| New player | `unseeded`, `<3 matches` gate |
| Manual adjustment | `manualPriority` |
| Win rate | `winRate` from stats |
| Legacy blob | `entry.rating`, `team.avgLevel` stored fields |
| Tournament override | `stripOpenEntryMetadata`, open mode strip |

## Additional sources found

| Source | Notes |
|--------|-------|
| Club Elo | `clubRating.elo` (1500 scale) |
| Composite | TE 4.0 blended `seedScore` |
| Random | Open draw / team shuffle |

Mapper: `mapLegacySeedSourceToCanonical()` in `legacySeedMapping.js`.

## Runtime engines (not modified)

- `features/tournament-engine/engines/seedEngine.js`
- `tournament/engines/teamPairingEngine.js` → `assignSeedsToEntries`
- `features/team-tournament/engines/teamGroupSeedEngine.js`
- `pages/tournament.seeding.logic.js`
