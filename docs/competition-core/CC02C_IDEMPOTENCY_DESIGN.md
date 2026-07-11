# CC-02C — Idempotency Design

Phase: **CC-02C** | Owner conditional GO | **NOT APPLIED** to staging/production

## Problem

CC-02B used `ratingV2AppliedMatchIds` (match-level array on club blob). That is:

- Not per-player durable
- Lost on cross-device sync races
- Not enforceable under concurrent requests
- **Not production idempotency**

## Decision — Option A: `rating_applications`

| Column | Type | Notes |
|--------|------|-------|
| `match_id` | text | Tournament match identifier |
| `player_id` | text | Player receiving delta |
| `rating_type` | text | `competition_elo` |
| `applied_at` | timestamptz | Audit |
| `engine_version` | text | `competition-core-rating-v2-cc02c` |
| `before_rating` | numeric | Snapshot before apply |
| `after_rating` | numeric | Snapshot after apply |

**Unique constraint:** `(match_id, player_id, rating_type)`

SQL file: `docs/competition-core/supabase-cc02c-rating-durability.sql`

## Local blob mirror (optimization only)

Until Supabase RPC is wired at runtime, club blob stores parallel structure:

```javascript
data.ratingV2Applications = [
  { matchId, playerId, ratingType, appliedAt, engineVersion, beforeRating, afterRating }
]
```

Enforced in `ratingIdempotencyStore.js` with the same unique key semantics.

Legacy `ratingV2AppliedMatchIds` is read-only compatibility: if present, apply is skipped idempotently. New writes use `ratingV2Applications` only.

## Idempotent duplicate behavior

| Layer | Behavior on duplicate |
|-------|----------------------|
| Blob store | `{ ok: true, skipped: true, reason: 'already-applied' }` |
| SQL RPC | `{ ok: true, skipped: true, idempotent: true }` via unique constraint |
| In-memory test store | Second concurrent register rejected |

## Module map

| File | Role |
|------|------|
| `ratingIdempotencyStore.js` | Key builder, blob append, in-memory DB simulator |
| `ratingAtomicApply.js` | Pre-check all players before any mutation |
| `ratingServiceV2.js` | Delegates to atomic apply |

## Remaining gap (CC-03)

Frontend blob idempotency does not survive true multi-writer concurrency. **Production SSOT = SQL `rating_applications` + RPC.**

Preview deployment: **NOT DEPLOYED**  
Staging migration: **NOT APPLIED**  
Production migration: **NOT APPLIED**
