# 07 — CUSTOMER-05 Entry Criteria

CUSTOMER-05 may open when **all** of the following are true:

1. CUSTOMER-04 consent/preference pack merged (or Owner-approved on branch).
2. Owner decides whether Staging apply covers CUSTOMER-03 + CUSTOMER-04 together.
3. Governance integration approach chosen for `REQUIRES_POLICY_DECISION`
   (policy port, deferred, or explicit Marketing hard-block).
4. Notification consumption plan confirmed (read adapter only; no delivery enablement
   in the same change set unless separately scoped).
5. CRM continues to consume Customer facts via boundary adapters (no CRM ownership
   of canonical Customer consent rows).
6. No requirement to ship UI preference center or Production Customer runtime
   enablement in the same change set.

## Suggested CUSTOMER-05 themes

- Staging apply + post-apply QA (Owner-gated)
- Legacy club-blob compatibility / adoption design
- Optional authenticated write policies after permission seed
- Preference center UI (only if separately scoped)
- Merge execution remains out of scope unless Owner expands charter
