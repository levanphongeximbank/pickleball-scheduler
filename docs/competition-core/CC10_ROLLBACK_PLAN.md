# CC-10 — Rollback Plan

## Primary mechanism: feature flags

| Action | Command / config |
|---|---|
| Master rollback | `VITE_COMPETITION_CORE_ENABLED=false` |
| Module rollback | set individual `*_V2_ENABLED=false` |
| Emergency full legacy | master OFF (instant) |

No code deploy required for flag rollback.

## Database / rating rollback

- Condition: duplicate rating application detected on staging/production
- Action: disable `RATING_V2`; use idempotency audit to identify affected matches
- Reconciliation: manual SQL review per `ratingIdempotencyStore` keys
- Production migration rollback: **not needed** (no CC-10 migration applied)

## Branch/commit checkpoint

| Item | SHA |
|---|---|
| CC-10 base | `00317e95058b5e195c3b89623cfe98925fffecad` |
| CC-10 branch tip | (after push) |

Revert code path (owner approval only):

```bash
git revert <cc10-merge-commit>
```

## Trace/audit retention

- Decision Traces: retain 30 days minimum during rollout
- Do not delete trace logs during rollback investigation

## Unknown commit state

- If deployed commit unknown: set all flags OFF first, then identify commit from Vercel deployment log
