# CC-08 — Head-to-Head (Two Entries)

Module: `headToHead.js`

- Uses only head-to-head eligible matches (excludes BYE, cancelled, unverified when required)
- Counts wins from winnerEntryId or score comparison
- Returns matches considered, winsByEntry, winnerEntryId, unresolvedReason
- If unresolved, pipeline proceeds to next tie-break rule

Explanation included in StandingsDecisionTrace.headToHeadCalculations.
