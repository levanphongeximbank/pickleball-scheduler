# 05 — Migration Rollout And Rollback Plan

## Status

**AUTHORED ONLY.** CUSTOMER-03 does **not** apply Staging or Production.

## Procedure (when Owner authorizes Staging)

1. Confirm backup evidence + project allowlist (CRM/Finance Staging pattern).
2. Apply SQL in numeric order `10` → `50`.
3. Run `99_CUSTOMER_PHASE_3_VERIFICATION.sql`.
4. Keep Customer runtime **disabled** / non-durable in app until separate switch.
5. Do **not** auto-migrate club blob, booking name/phone, or merge duplicates.

## Rollback

Manual: run `90_CUSTOMER_PHASE_3_ROLLBACK.sql` under Owner authorization after backup.  
Drops RPC, policies, helper, indexes, tables. Irreversible without restore.

## Risk register

| Risk | Mitigation |
|------|------------|
| JWT tenant ≠ venue for some rows | Fail-closed scope equality; document Identity gap |
| Client write before permission seed | No authenticated write policies/grants |
| Partial aggregate write | Single RPC transaction |
| Silent memory fallback in Production | Runtime config rejects memory in Production |
| Legacy data dual-write | Explicitly deferred — no auto migration |

## Deferred legacy-data adoption backlog

- Club blob `customers[]` read/compatibility adapter
- Booking denormalized name/phone adoption
- Dual-write / backfill design
- Cross-customer dedupe engine
- Merge execution runtime
