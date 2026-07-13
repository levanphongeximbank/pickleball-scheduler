# TT-6D — Rollback

**Production:** UNTOUCHED

## Runtime

| Flag | Rollback action |
|------|-----------------|
| `VITE_TT_REALTIME_DEBUG` | Set `false` or unset — disables debug console logs |
| `VITE_TT_REALTIME_ENABLED` | Unchanged from TT-6C — keep `false` on Production |

No schema changes in TT-6D.

## Harness

Remove or skip:

- `scripts/verify-phase-tt6d-multi-device-preview.mjs`
- `scripts/verify-phase-tt6d-staging.mjs`

No impact on end-user runtime when not invoked.
