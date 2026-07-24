# CUSTOMER-07 — Final Certification

**Verdict:** `CUSTOMER_07_PASS_PR_OPEN`  
**Staging project ref:** `qyewbxjsiiyufanzcjcq`  
**Production touched:** NO  
**Secrets in evidence:** NO  

## Applied migrations (24)

CUSTOMER-03 (5) → CUSTOMER-04 (6) → CUSTOMER-05 (6) → CUSTOMER-06 (6) → CUSTOMER-07 collation fix (1).

Evidence: `docs/customer-management/phase-7/evidence/APPLY_RESULT.json`

## Live certification

Evidence: `docs/customer-management/phase-7/evidence/LIVE_CERTIFICATION.json`  
Result: **32 / 32 PASS** including schema, RLS anon deny, durable repository, optimistic concurrency, consent/preference, linkage (certified fake directories), search, dedup/merge, redirect, cleanup.

`LIVE_EXTERNAL_DIRECTORY_DEFERRED` — Identity/Player/CRM live connectors not wired; certified in-memory directories used.

## Notable fixes discovered during live cert

1. Duplicate-candidate ordered-pair CHECK must use `COLLATE "C"` to match JS `orderCustomerPair` (en_US.UTF-8 disagreed on `cust_id1_` vs `cust_id15_`).
2. `isDuplicateCandidateStale` must resolve versions by customerId, not by survivor/absorbed argument order.

## Non-goals confirmed

- No Production apply  
- No UI  
- No package.json / lockfile changes  
- CRM safety stash preserved  
