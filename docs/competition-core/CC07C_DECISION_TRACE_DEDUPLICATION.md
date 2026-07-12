# CC-07C — Decision Trace Deduplication

`createRulesRuntimeTraceRecord()` extended fields:

- `evaluationOwner`
- `deduplicationKey` (via summary entries)
- `deduplicationStatus` (`ACTIVE` / `SKIPPED_DUPLICATE` / `RESOLVED`)
- `legacyContributionSuppressed`
- `canonicalContributionApplied`
- `fallbackReason`
- `deduplicationSummary.entries[]`

Duplicates appear only as `SKIPPED_DUPLICATE` in summary — not as second score contributions.
