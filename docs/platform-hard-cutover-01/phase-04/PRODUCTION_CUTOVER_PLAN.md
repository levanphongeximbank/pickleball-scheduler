# Production Cutover Plan (Phase 5 — NOT executed now)

1. Confirm Staging rehearsal PASS
2. Backup Production + identity pack
3. Owner identity preservation test
4. Apply migrations M1→M8 (Owner GO each family or batched GO)
5. Wipe + DROP per destructive package
6. Redeploy Production SPA
7. Enable flags (Owner GO)
8. Reseed
9. Acceptance package PASS
10. Marker: `PLATFORM_HARD_CUTOVER_01_PHASE_05_COMPLETE` only after all criteria green

## Rollback limits

- No PITR → restore from backup only
- DROP club_ai_data irreversible without recreate SQL
- Flag OFF soft-rollback for SPA behavior only
