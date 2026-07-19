# 03 — Production Hold Gate (Phase 1D)

**Production SQL apply: FORBIDDEN in this wave.**

## Hold conditions (all must remain true until Owner lifts)

1. Staging verify SQL green (`PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql`)
2. Staging JWT smoke: self verification DENIED; self demographics ALLOWED
3. Guard confirms **no** `current_user = 'postgres'` bypass
4. Player Management unit + Phase 1B/1C/1D static tests green on the merge SHA
5. Explicit Owner written approval for Production apply (separate task)
6. Production backup / rollback window scheduled

## Explicitly out of scope here

- Production apply
- Production deploy
- Phase 1E
- Competition Engine / Venue / Club / Notification / Finance / Ranking changes
