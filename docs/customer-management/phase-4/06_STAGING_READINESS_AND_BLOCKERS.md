# CUSTOMER-04 Staging readiness & blockers

## Apply status

**Not applied.** SQL pack is authored under `docs/customer-management/phase-4/`.

## Prerequisites

1. CUSTOMER-03 tables/RLS/RPC applied (or applied in same Owner-gated window
   before CUSTOMER-04 scripts).
2. Owner authorization for Staging.
3. No Production apply in the same unreviewed change set.

## Blockers (Production)

- CUSTOMER-03/04 not live
- Authenticated client write path still blocked (by design until permission seed)
- Platform Governance policy input not wired
- Live Notification delivery must remain off for this workstream

## Soft disable

Use the soft-disable section of `90_CUSTOMER_PHASE_4_ROLLBACK.sql` before hard DROP.
