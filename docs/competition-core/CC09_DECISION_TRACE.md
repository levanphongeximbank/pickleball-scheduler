# CC-09 — Decision Trace

Source: `calculateCanonicalSchedule.js`, `schedulingDecisionTrace.js`

## `SchedulingDecisionTrace` fields

| Field | Source |
|---|---|
| traceId | generated (`scheduling-trace-{timestamp}-{n}`) |
| engineVersion | `cc09-v1` |
| strategy | request.strategy |
| tournamentId, eventId | request |
| inputMatchIds | request.matches |
| courtSet, slotSet | request courts/slots |
| timezone | configuration |
| manualOverrides | request |
| assignmentSteps | map/validate phases |
| conflictsDetected / conflictsResolved / unresolvedConflicts | validateSchedulingConflicts |
| byeHandling | canonical.byes |
| dependencyHandling | pendingDependency matches |
| finalAssignments | canonical.assignments |
| unassignedMatches | canonical.unassignedMatches |
| warnings | validation + mapping |
| parityStatus | set by runtime adapter after shadow compare |
| timestamp | ISO8601 |

## Properties

- JSON serializable (`isSchedulingTraceJsonSerializable` — rejects token/secret/password/apikey substrings)
- Deterministic except traceId/timestamp
- No auth tokens or secrets in payload

## Runtime trace records

`createSchedulingRuntimeDecisionTraceRecord` — consumer, executionPath, adapterVersion, comparisonOk, duplicateDecision guard.
