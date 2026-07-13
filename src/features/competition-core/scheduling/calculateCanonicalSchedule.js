import { SCHEDULING_ENGINE_VERSION } from "./schedulingConstants.js";
import {
  createSchedulingDecisionTrace,
  createSchedulingResult,
} from "./schedulingContracts.js";
import { mapLegacySchedulingResultToCanonical } from "./legacySchedulingMapping.js";
import {
  partitionResolvedConflicts,
  validateSchedulingConflicts,
} from "./validateSchedulingConflicts.js";

let traceCounter = 0;

function nextTraceId() {
  traceCounter += 1;
  return `scheduling-trace-${Date.now()}-${traceCounter}`;
}

/**
 * Pure canonical scheduling envelope — validates and traces legacy-shaped output.
 * Does not rewrite scheduling algorithms.
 *
 * @param {import('./schedulingTypes.js').SchedulingRequest} request
 * @param {unknown} legacyResult
 */
export function calculateCanonicalSchedule(request, legacyResult) {
  const warnings = [];
  const canonical = mapLegacySchedulingResultToCanonical(legacyResult, request);
  const validation = validateSchedulingConflicts(canonical, request);
  const { resolved, unresolved } = partitionResolvedConflicts(validation.conflicts);

  warnings.push(...validation.warnings);
  warnings.push(...(canonical.warnings || []));

  const decisionTrace = createSchedulingDecisionTrace({
    traceId: nextTraceId(),
    engineVersion: SCHEDULING_ENGINE_VERSION,
    strategy: request.strategy || request.configuration?.strategy,
    tournamentId: request.tournamentId,
    eventId: request.eventId,
    inputMatchIds: (request.matches || []).map((match) => match.matchId),
    courtSet: (request.courts || []).map((court) => court.courtId),
    slotSet: (request.slots || []).map((slot) => slot.slotId),
    timezone: request.configuration?.timezone,
    manualOverrides: request.manualOverrides || [],
    assignmentSteps: [{ phase: "map", label: "Legacy result mapped to SchedulingResult" }],
    conflictsDetected: validation.conflicts,
    conflictsResolved: resolved,
    unresolvedConflicts: unresolved,
    byeHandling: (canonical.byes || []).map((matchId) => ({ matchId, policy: "no_court_slot" })),
    dependencyHandling: (canonical.matches || [])
      .filter((match) => match.pendingDependency)
      .map((match) => ({ matchId: match.matchId, policy: "pending_dependency" })),
    finalAssignments: canonical.assignments || [],
    unassignedMatches: canonical.unassignedMatches || [],
    warnings,
    timestamp: new Date().toISOString(),
  });

  return createSchedulingResult({
    ...canonical,
    ok: canonical.ok !== false && validation.ok,
    conflicts: validation.conflicts,
    warnings,
    decisionTrace,
    audit: {
      engineVersion: SCHEDULING_ENGINE_VERSION,
      consumer: request.metadata?.legacyConsumer,
      executionPath: "canonical-validation",
    },
  });
}

/**
 * @param {import('./schedulingTypes.js').SchedulingDecisionTrace} trace
 */
export function isSchedulingTraceJsonSerializable(trace) {
  try {
    const serialized = JSON.stringify(trace);
    return !/token|secret|password|apikey/i.test(serialized);
  } catch {
    return false;
  }
}

/**
 * @param {import('./schedulingTypes.js').SchedulingRequest} request
 */
export function cloneSchedulingRequest(request) {
  return JSON.parse(JSON.stringify(request));
}
