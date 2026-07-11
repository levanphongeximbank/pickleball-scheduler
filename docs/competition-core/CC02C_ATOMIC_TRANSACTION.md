# CC-02C — Atomic Transaction Design

Phase: **CC-02C** | **NOT APPLIED** to staging/production

## Required steps (single transaction)

1. Lock/check match
2. Check eligibility (application layer)
3. Check idempotency (`rating_applications`)
4. Read all player ratings (`FOR UPDATE` in SQL)
5. Compute all deltas (application layer)
6. Update all player ratings
7. Insert `rating_history` rows
8. Insert `rating_applications` markers
9. Commit

Any failure → full rollback; no partial player updates, history, or markers.

## SQL RPC

Function: `public.competition_core_apply_match_rating_v2`

- `SECURITY DEFINER`, granted to `service_role` only
- Loops `p_updates` jsonb array inside one PL/pgSQL transaction
- Catches `unique_violation` → idempotent skip
- Raises on missing player → transaction rolls back

File: `docs/competition-core/supabase-cc02c-rating-durability.sql`

## Frontend atomic apply (blob path)

`applyCompetitionEloAtomically` in `ratingAtomicApply.js`:

- Eligibility + idempotency checks before mutation
- Applies updates in memory on player snapshot
- Single `saveClubData` at end
- Test hooks: `simulateFailAfterPlayerIndex`, `simulateHistoryFailure`
- On simulated failure: **no save** → disk unchanged

**Verdict:** Blob path is atomic within single JS thread / single save. **PARTIAL** for multi-tab/multi-device until RPC wired.

## Rollback verification

| Test | Expected |
|------|----------|
| Fail after player 2 | Player 1 on disk unchanged |
| Fail before history write | No `ratingV2History`, no applications |
| SQL missing player | Entire RPC transaction rolls back |

## RLS

- `player_ratings` update policy: `using (false)` — players cannot self-update `competition_elo`
- `rating_applications`: service-only policy (no direct client writes)

Live RLS role matrix verification deferred to staging QA (CC-03).

Preview deployment: **NOT DEPLOYED**  
Staging migration: **NOT APPLIED**
