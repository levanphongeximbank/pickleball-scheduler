# 06 — CUSTOMER-03 Entry Criteria

> Note: The workstream label **CUSTOMER-02** was used for Profile & Contact Fast Track
> (`docs/customer-management/phase-2/`). Persistence / adoption is therefore **CUSTOMER-03**.

CUSTOMER-03 (persistence / adoption) may open when **all** of the following are true:

1. CUSTOMER-02 profile/contact foundation merged (or explicitly Owner-approved on branch).
2. Owner confirms persistence approach (dedicated tables vs staged dual-write with club blob).
3. Compatibility plan for legacy `customer-*` ids and booking name/phone matching is approved.
4. CRM `VenueCustomerDirectoryPort` wiring plan approved (consume Customer adapter; no CRM ownership change).
5. Finance external CUSTOMER reference mapping reviewed.
6. No requirement to activate Production/Staging in the same change set as schema authoring (follow Finance/Player phased gates).

## Suggested CUSTOMER-03 scope (preview)

- Durable repository adapter + schema design docs
- Legacy club-blob read/write compatibility adapter
- Optional dual-write / backfill design
- Expanded certification against durable harness
- Still no Production deploy unless separately authorized
