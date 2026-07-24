# 06 — Staging Readiness And Production Blockers

## Staging checklist (not executed in CUSTOMER-03)

- [ ] Owner approval token / decision record
- [ ] Staging project allowlist verified
- [ ] Backup evidence path confirmed
- [ ] SQL checksum / manifest pin (optional follow CRM 1H)
- [ ] Apply `10`→`50` on Staging only
- [ ] Run verification SQL
- [ ] Confirm RLS SELECT works for QA identity with `customer.view`
- [ ] Confirm authenticated writes still fail
- [ ] Confirm service-role save RPC works from trusted harness
- [ ] Keep app durable runtime **OFF**

## Production blockers

1. No Owner authorization for Production apply.
2. Client write policies not authorized / permission matrix not seeded.
3. Identity lacks verified distinct `user_tenant_id()` (tenant_id must equal venue_id for JWT).
4. No Production durable runtime switch approved.
5. Legacy club-blob / booking adoption not completed.
6. Local live Supabase CLI certification may be unavailable in CI — static pack only until Staging apply.

## Runtime verification note

If local Supabase CLI / database is unavailable, CUSTOMER-03 certifies:

- static migration presence and SQL contracts;
- durable adapter against in-process fake DB client;

and **does not** claim live database-ready absolute certification.
