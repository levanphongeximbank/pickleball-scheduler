# CC-08 — Decision Trace

StandingsDecisionTrace fields include: traceId, engineVersion, scoring/tie-break rule ids/versions, tournament/event/group ids, inputMatchIds, excludedMatches, initialRows, tieGroups, tieBreakSteps, miniTableCalculations, headToHeadCalculations, drawLotSeed/tokens, finalRanks, qualificationDecisions, warnings, timestamp.

Runtime wrapper: `buildCompleteStandingsTraceRecord()` combines runtime adapter record + canonical trace.

JSON serializable via `isStandingsTraceJsonSerializable()`. Secrets redacted via `redactStandingsTraceSecrets()`.

Deterministic except traceId/timestamp generation.
