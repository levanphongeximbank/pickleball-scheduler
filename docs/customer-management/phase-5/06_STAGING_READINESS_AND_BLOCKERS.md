# 06 — Staging readiness and blockers (CUSTOMER-05)

## Apply status

| Pack | Authored | Staging applied | Production applied |
|------|----------|-----------------|--------------------|
| CUSTOMER-03 | Yes | No | No |
| CUSTOMER-04 | Yes | No | No |
| CUSTOMER-05 | Yes | No | No |

## Dependency ordering

1. `docs/customer-management/phase-3/*`
2. `docs/customer-management/phase-4/*`
3. `docs/customer-management/phase-5/*` (10→60, then verify)

## Soft-disable / rollback

See `90_CUSTOMER_PHASE_5_ROLLBACK.sql` — revoke `customer_save_linkage` from `service_role` first.

## Blockers before Staging apply

- Owner gate for combined CUSTOMER-03/04/05 apply window
- Permission seed (`customer.view` / `customer.edit`) present in Identity
- Decision on Production directory adapter wiring (Identity/Player/CRM)
- No requirement to ship UI preference center or merge engine in the same change set

## Live database verification

Not performed in this workstream (static + fake DB certification only).
