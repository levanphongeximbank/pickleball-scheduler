# CC-07 Decision Trace

## Fields

traceId, engineType, engineVersion, ruleSetId, ruleSetVersion, contextId, candidateOrActionId, decisionStatus, evaluatedConstraints, failedHardConstraints, softContributions, sourceMappings, warnings, suggestedResolution, timestamp

## Statuses

ACCEPTED | REJECTED | SCORED | SKIPPED | CONFLICT | REQUIRES_REVIEW

## Compatibility

Legacy CC-03B trace records (`action: reject|score|legacy_fallback`) preserved alongside CC-07 trace records.

## Source

`rulesDecisionTrace.js`
