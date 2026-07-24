# 07 — CUSTOMER-07 Entry Criteria

CUSTOMER-07 may open when **all** of the following are true:

1. CUSTOMER-06 search/dedup/merge pack merged (or Owner-approved on branch).
2. Owner confirms no auto-merge policy remains in force.
3. Staging apply plan for CUSTOMER-03→06 exists (even if not yet executed).
4. Redirect adapter contract accepted by Notification/Finance consumers.
5. Merge history immutability and RLS verification pass on Staging.
6. No requirement to ship UI merge console or Production enablement unless separately scoped.

## Suggested CUSTOMER-07 themes

- Operator merge console (UI)
- Batch candidate review workflows
- Cross-module adoption of redirect adapter
- Governance-backed MergeApprovalPort
- Legacy venue/club/booking customer adoption (still gated)
