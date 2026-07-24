# 07 — CUSTOMER-04 Entry Criteria

CUSTOMER-04 may open when **all** of the following are true:

1. CUSTOMER-03 persistence pack merged (or Owner-approved on branch).
2. Owner decides Staging apply vs defer; if apply, verification SQL PASS and runtime still gated.
3. Authorization path for Customer writes agreed (permission seed + policies **or** remain service-role-only with documented boundary).
4. Legacy adoption approach chosen (read-compat adapter, dual-write, or explicit postpone).
5. CRM directory consumption plan confirmed (continue `createVenueCustomerDirectoryAdapter` over durable repo).
6. No requirement to enable Production Customer runtime in the same change set.

## Suggested CUSTOMER-04 themes

- Staging apply + post-apply QA (if authorized)
- Legacy club-blob compatibility / adoption design
- Optional authenticated write policies after permission seed
- UI / routes (only if separately scoped)
- Merge execution remains out of scope unless Owner expands charter
