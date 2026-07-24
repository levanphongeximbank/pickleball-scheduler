# 00 — CUSTOMER-06 Search, Deduplication & Merge

**Status:** Implemented in module + authored SQL/RLS (not applied).  
**Branch:** `feature/customer-management-phase-6-search-dedup-merge`  
**Depends on:** CUSTOMER-03 → CUSTOMER-04 → CUSTOMER-05 → CUSTOMER-06

## Purpose

CUSTOMER-06 adds canonical **search**, **duplicate candidate detection**, **merge proposals**, and **explicit merge execution** for Customer Management.

> Matching email, phone or name is candidate evidence only — never auto-merge.  
> Merge requires explicit `approvalReference` or `MergeApprovalPort.authorize()`.  
> Identity/Player conflicts default to `BLOCK_MERGE`.  
> Consent/preference merge is restrictive (never widens eligibility).

## Ownership boundary

| Concern | Owner |
|---------|--------|
| Search query, duplicate signals, candidates, proposals, merge history, redirect projection | **Customer Management** |
| Auth credentials / Identity entity SoT | Identity |
| Player sports profile SoT | Player Management |
| CRM workflow SoT | CRM |
| Cross-module merge policy authorization | Platform Governance / Owner |

## Customer status

- Additive terminal status: `MERGED`
- Allowed transitions **into** MERGED from `ACTIVE` / `INACTIVE` / `SUSPENDED` (not from `ARCHIVED`)
- `ARCHIVED` remains terminal
- Absorbed fields: `mergedIntoCustomerId`, `mergedAt`, `mergeHistoryId`, `mergeProposalId`

## Search

Canonical `CustomerSearchQuery`:

- `text`, `customerId`, `customerNumber`, `email`, `phone`
- `externalReference` `{ type, id }` (via optional linkage repository)
- `customerType`, `status`, `limit`, `offset`
- `includeMerged` (default `false`)

Exact + normalized match; scope-safe; deterministic sort  
(`displayName` asc, `customerNumber` asc, `customerId` asc).  
Default excludes `MERGED`.

## Duplicate signals / classification

**Strong:** SAME_ACTIVE_IDENTITY, SAME_ACTIVE_PLAYER, SAME_TRUSTED_CRM_REF, EMAIL_PLUS_CORROBORATION, PHONE_PLUS_CORROBORATION  

**Moderate:** SAME_NORMALIZED_EMAIL/PHONE, SAME_LEGAL_NAME, SAME_DISPLAY_NAME, SAME_ORG_NAME, SAME_ADDRESS_KEY  

**Weak:** PARTIAL_NAME, SAME_LOCALE (never auto-approve)

Classifications: EXACT_REFERENCE_MATCH, STRONG_DUPLICATE_CANDIDATE, POSSIBLE_DUPLICATE, INSUFFICIENT_EVIDENCE, CONFLICTING_IDENTITIES, NOT_DUPLICATE, REQUIRES_MANUAL_REVIEW

## Candidate / proposal / merge

- Canonical ordered pair (lexicographic `customerId`) prevents A-B / B-A duplicates
- Candidate statuses: OPEN, REVIEW_REQUIRED, APPROVED_FOR_MERGE, REJECTED, RESOLVED
- Proposal statuses keep CANDIDATE/APPROVED/REJECTED/COMPLETED and add DRAFT
- Resolution actions: KEEP_SURVIVOR, TAKE_ABSORBED, KEEP_BOTH, DROP_DUPLICATE, REQUIRE_MANUAL_RESOLUTION, BLOCK_MERGE
- MergeApprovalPort fail-closed
- In-memory merge uses snapshot rollback; durable uses `customer_execute_merge` RPC

## Redirect

- `getById` on absorbed returns the MERGED record (no silent survivor swap)
- `resolveMergedCustomer` / `resolveCanonicalCustomerId` with loop protection
- `CustomerRedirectView` for Notification/Finance consumers

## Application commands

`searchCustomers`, `findExactCustomerMatches`, `resolveCanonicalCustomerId`, `resolveMergedCustomer`, `detectDuplicateCandidates`, `evaluateCustomerPair`, `createOrRefreshDuplicateCandidate`, `listDuplicateCandidates`, `rejectDuplicateCandidate`, `createMergeProposal`, `validateMergeProposal`, `approveMergeProposal`, `rejectMergeProposal`, `readMergeProposal`, `mergeCustomers`, `getMergeHistory`

## Persistence

Tables: `customer_duplicate_candidates`, `customer_merge_proposals`, `customer_merge_history`  
ALTER `customers`: merge redirect columns + status chk includes MERGED  

RPCs (service_role only):

- `customer_save_duplicate_candidate`
- `customer_save_merge_proposal`
- `customer_execute_merge`

SQL pack: `docs/customer-management/phase-6/` — **AUTHORED ONLY**, not applied.

## RLS

- RLS + FORCE enabled
- Authenticated SELECT only with `customer_phase3_scope_allows` + `customer.view|edit|super_admin`
- No authenticated writes; no anon; no `USING (true)`
- Merge history append-only trigger

## Runtime

`createCustomerRuntime` wires merge repository + optional `mergeApprovalPort` + `mergeApplication`.  
Production memory mode rejected. Merge approve/execute fail-closed without approval.

## Staging checklist (Owner-gated)

1. Confirm CUSTOMER-03→05 applied first.
2. Apply phase-6 SQL in numeric order.
3. Run `99_CUSTOMER_PHASE_6_VERIFICATION.sql`.
4. Smoke search / candidate / approved merge via service-role path only.
5. Confirm JWT cannot INSERT/UPDATE merge tables.

## Production blockers

- CUSTOMER-03..06 not applied
- Authenticated write policies not Owner-authorized
- Live MergeApprovalPort / governance wiring not ready
- No Production auto-merge

## CUSTOMER-07 entry criteria

See `07_CUSTOMER_07_ENTRY_CRITERIA.md`.
