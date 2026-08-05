# CUTOVER-02 — Rollback Plan

## Dual-read compare

| Trigger | Action |
|---------|--------|
| Compare errors / noise | Set `VITE_RATING_V5_DUAL_READ_COMPARE_ENABLED=false` |
| Unexpected published change | Disable compare; verify `getPlayerCurrentRating` still V2 |
| Evidence leak | Rotate sinks; confirm sanitizer |

Published response remains V2 even when compare ON — rollback is flag-off only.

## Writer freeze

| Mode transition | Action |
|-----------------|--------|
| ENFORCE → OFF | Set `VITE_RATING_V5_WRITER_FREEZE_MODE=OFF` |
| OBSERVE → OFF | Same |
| DB setting | `UPDATE rating_v5_cutover_02_freeze_settings SET writer_freeze_mode='off'` |
| Full SQL teardown | See down section in `sql/RATING_V5_CUTOVER_02_STAGING_WRITER_FREEZE_GUARD.sql` |

## Production

Production deny guard forces OFF. If Production flags were ever set incorrectly: clear flags, redeploy with defaults, verify deny guard tests.

## Authority rollback SSOT

Until a future cutover state machine advances past dual-read, **V2 remains rollback published SSOT**.
