# CC-08 — Forfeit / BYE / Walkover Policy

Module: `matchResultPolicy.js`

Normalized result types: COMPLETED, BYE, WALKOVER, FORFEIT_BEFORE_START, FORFEIT_AFTER_START, ADMINISTRATIVE_FORFEIT, CANCELLED, VOID, UNVERIFIED, LEGACY_FORFEIT.

Policy defines per type:
- includeInStandings
- countsAsPlayed
- headToHeadEligible
- includeScoreDiff
- forfeit/walkover/bye counters

Legacy ambiguous `FORFEIT` maps to LEGACY_FORFEIT with canonical warning. Cancelled/void excluded. BYE excluded from head-to-head. Unverified excluded when `verifiedResultRequired=true`.

Scores are not inferred as “played” without explicit result type policy.
