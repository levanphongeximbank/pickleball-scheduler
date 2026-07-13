# TT-5D Rollback (Staging)

## Reverse order

1. Drop TT-5D RPCs (review, request, reopen, access_ops, assign, revoke, list).
2. Drop `referee_v5_apply_admin_result_revision`.
3. Drop `team_tournament_referee_correction_requests`.
4. Revert `referee_v5_current_user_has_assignment` to V5-D1 body if needed.
5. Remove TT-5D columns from `referee_assignments` only if no production data (staging).

## Client rollback

- Restore router `/referee/match/:matchId` → `RefereeSessionScoreboard`.
- Remove `TeamRefereeSafetyPanel` from BTC card.

## Production

**No TT-5D objects deployed to production.**
