# 07 — CUSTOMER-06 Entry Criteria

CUSTOMER-06 (merge / deduplication / candidate matching) may open when **all** of the following are true:

1. CUSTOMER-05 linkage pack merged (or Owner-approved on branch).
2. Cardinality rules for Identity / Player / CRM accepted as canonical.
3. Owner confirms that matching email/phone/name are **candidates only**, never auto-links.
4. Conflict/transfer policy for moving an external reference between Customers is decided (explicit command + authorization).
5. Staging apply plan for CUSTOMER-03→05 exists (even if not yet executed).
6. No requirement to ship UI merge console or Production enablement in the same change set unless separately scoped.

## Suggested CUSTOMER-06 themes

- Candidate match signals (email/phone/name) without auto-link
- Deduplication proposals using existing `createCustomerMergeProposal`
- Explicit transfer/unlink-then-link workflows with Owner authorization
- Merge execution engine (still gated)
- Legacy venue/club/booking adoption design
