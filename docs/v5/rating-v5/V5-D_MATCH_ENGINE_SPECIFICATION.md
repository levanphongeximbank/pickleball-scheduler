# V5-D — Match Engine Specification (Design Only)

**Version:** `match-v5.0` | **Phase:** V5-A delivers design; implementation V5-D

## 1. Immutable rating events

Each valid match appends one `player_rating_events` row per affected player:

```
pre_rating_mean, post_rating_mean, pre_deviation, post_deviation,
expected_performance, actual_performance, rating_delta, engine_version
```

## 2. Expected performance

```
teamStrength = aggregate(playerMeans, playerDeviations, formation)
expectedPointShare = logistic(teamA - teamB)  // not win/loss only
actualPointShare = pointsWon / totalPoints
performanceDelta = actualPointShare - expectedPointShare
```

Upset: win with low point share → negative delta still possible.

## 3. Team strength

- Computed at match time (no fixed pair rating).
- Supports 1v1, 2v2, mixed formations.
- High-uncertainty players absorb larger adjustments.

## 4. Update rule (Glicko-inspired draft)

```
adjustment = K(sourceWeight, recency) * performanceDelta * uncertaintyFactor(player)
postMean = clamp(preMean + adjustment)
postDeviation = reduceDeviation(preDeviation, matchQuality, opponentReliability)
```

| Factor | Source |
|--------|--------|
| K | evidence level + match count tier |
| uncertaintyFactor | higher when deviation high |
| sourceWeight | level 1–3 → open track; 4–5 → verified track |

## 5. Track separation

| Evidence | Updates |
|----------|---------|
| 1–3 | `open_rating_mean` only |
| 4–5 | `verified_rating_mean` only |
| Assessment | `provisional_rating` prior only — never overwrites verified |

## 6. Reliability interaction

After match batch:
```
reliabilityScore = computeReliabilityScore({ verifiedMatchCount, recency, ... })
display_rating = resolveDisplayRating({ verified, open, provisional, reliability })
```

## 7. Versioning & replay

- `engine_version` on every event.
- Full history replay from events + calibration version.
- Recalculate RPC re-processes from snapshot (V5-D).

## 8. Reuse from CC-02

| CC-02 asset | V5 usage |
|-------------|----------|
| `isMatchRatingEligible` | eligibility gate |
| `kFactorConfig` | tier inspiration |
| `rating_applications` | idempotency pattern |
| `competitionEloEngine` | reference — V5 uses 1.5–6.0 mean/deviation not 1500 Elo |
