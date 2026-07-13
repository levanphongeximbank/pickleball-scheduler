import {
  SCHEDULING_ENGINE_VERSION,
  SCHEDULING_STRATEGY,
} from "./schedulingConstants.js";

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingParticipant>} [partial]
 */
export function createSchedulingParticipant(partial = {}) {
  return {
    participantId: String(partial.participantId || partial.id || ""),
    teamId: partial.teamId ? String(partial.teamId) : undefined,
    name: partial.name ? String(partial.name) : undefined,
    seed: partial.seed !== undefined ? Number(partial.seed) : undefined,
    withdrawn: partial.withdrawn === true,
    metadata: partial.metadata && typeof partial.metadata === "object" ? { ...partial.metadata } : undefined,
  };
}

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingCourt>} [partial]
 */
export function createSchedulingCourt(partial = {}) {
  return {
    courtId: String(partial.courtId || partial.id || ""),
    venueId: partial.venueId ? String(partial.venueId) : undefined,
    name: partial.name ? String(partial.name) : undefined,
    available: partial.available !== false,
    locked: partial.locked === true,
    metadata: partial.metadata && typeof partial.metadata === "object" ? { ...partial.metadata } : undefined,
  };
}

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingSlot>} [partial]
 */
export function createSchedulingSlot(partial = {}) {
  return {
    slotId: String(partial.slotId || partial.id || ""),
    startTime: partial.startTime ? String(partial.startTime) : undefined,
    endTime: partial.endTime ? String(partial.endTime) : undefined,
    slotIndex: partial.slotIndex !== undefined ? Number(partial.slotIndex) : undefined,
    timezone: partial.timezone ? String(partial.timezone) : undefined,
    metadata: partial.metadata && typeof partial.metadata === "object" ? { ...partial.metadata } : undefined,
  };
}

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingMatch>} [partial]
 */
export function createSchedulingMatch(partial = {}) {
  return {
    matchId: String(partial.matchId || partial.id || ""),
    roundId: partial.roundId ? String(partial.roundId) : undefined,
    roundNumber: partial.roundNumber !== undefined ? Number(partial.roundNumber) : undefined,
    entryAId: partial.entryAId ? String(partial.entryAId) : undefined,
    entryBId: partial.entryBId ? String(partial.entryBId) : undefined,
    groupId: partial.groupId ? String(partial.groupId) : undefined,
    status: partial.status ? String(partial.status) : undefined,
    isBye: partial.isBye === true,
    pendingDependency: partial.pendingDependency === true,
    metadata: partial.metadata && typeof partial.metadata === "object" ? { ...partial.metadata } : undefined,
  };
}

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingAssignment>} [partial]
 */
export function createSchedulingAssignment(partial = {}) {
  return {
    matchId: String(partial.matchId || ""),
    roundId: partial.roundId ? String(partial.roundId) : undefined,
    courtId: partial.courtId ? String(partial.courtId) : undefined,
    venueId: partial.venueId ? String(partial.venueId) : undefined,
    startTime: partial.startTime ? String(partial.startTime) : undefined,
    endTime: partial.endTime ? String(partial.endTime) : undefined,
    slotId: partial.slotId ? String(partial.slotId) : partial.slot !== undefined ? String(partial.slot) : undefined,
    refereeId: partial.refereeId ? String(partial.refereeId) : undefined,
    status: partial.status ? String(partial.status) : undefined,
    warnings: Array.isArray(partial.warnings) ? [...partial.warnings] : undefined,
    manualOverride: partial.manualOverride === true,
    source: partial.source ? String(partial.source) : "legacy",
  };
}

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingConfiguration>} [partial]
 */
export function createSchedulingConfiguration(partial = {}) {
  return {
    strategy: partial.strategy || SCHEDULING_STRATEGY.GROUP_STAGE,
    timezone: partial.timezone ? String(partial.timezone) : undefined,
    matchDurationMinutes:
      partial.matchDurationMinutes !== undefined
        ? Number(partial.matchDurationMinutes)
        : partial.averageMatchMinutes !== undefined
          ? Number(partial.averageMatchMinutes)
          : undefined,
    bufferMinutes: partial.bufferMinutes !== undefined ? Number(partial.bufferMinutes) : undefined,
    restMinutes: partial.restMinutes !== undefined ? Number(partial.restMinutes) : undefined,
    startTime: partial.startTime ? String(partial.startTime) : undefined,
    endTime: partial.endTime ? String(partial.endTime) : undefined,
    extensions: partial.extensions && typeof partial.extensions === "object" ? { ...partial.extensions } : undefined,
  };
}

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingRequest>} [partial]
 */
export function createSchedulingRequest(partial = {}) {
  return {
    tournamentId: partial.tournamentId ? String(partial.tournamentId) : undefined,
    eventId: partial.eventId ? String(partial.eventId) : undefined,
    groupId: partial.groupId ? String(partial.groupId) : undefined,
    strategy: partial.strategy || partial.configuration?.strategy || SCHEDULING_STRATEGY.GROUP_STAGE,
    participants: (partial.participants || []).map((item) => createSchedulingParticipant(item)),
    matches: (partial.matches || []).map((item) => createSchedulingMatch(item)),
    courts: (partial.courts || []).map((item) => createSchedulingCourt(item)),
    slots: (partial.slots || []).map((item) => createSchedulingSlot(item)),
    venues: partial.venues || [],
    configuration: createSchedulingConfiguration(partial.configuration || {}),
    manualOverrides: partial.manualOverrides || [],
    legacyExtensions: partial.legacyExtensions && typeof partial.legacyExtensions === "object"
      ? { ...partial.legacyExtensions }
      : {},
    metadata: partial.metadata && typeof partial.metadata === "object" ? { ...partial.metadata } : {},
  };
}

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingConflict>} [partial]
 */
export function createSchedulingConflict(partial = {}) {
  return {
    type: partial.type,
    severity: partial.severity || "SOFT",
    matchIds: partial.matchIds || [],
    participantIds: partial.participantIds || [],
    courtIds: partial.courtIds || [],
    slotIds: partial.slotIds || [],
    message: String(partial.message || ""),
    reasonCode: partial.reasonCode ? String(partial.reasonCode) : undefined,
    suggestedResolution: partial.suggestedResolution ? String(partial.suggestedResolution) : undefined,
    metadata: partial.metadata && typeof partial.metadata === "object" ? { ...partial.metadata } : undefined,
  };
}

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingDecisionTrace>} [partial]
 */
export function createSchedulingDecisionTrace(partial = {}) {
  return {
    traceId: partial.traceId || `scheduling-trace-${Date.now()}`,
    engineVersion: partial.engineVersion || SCHEDULING_ENGINE_VERSION,
    strategy: partial.strategy,
    tournamentId: partial.tournamentId,
    eventId: partial.eventId,
    inputMatchIds: partial.inputMatchIds || [],
    courtSet: partial.courtSet || [],
    slotSet: partial.slotSet || [],
    timezone: partial.timezone,
    manualOverrides: partial.manualOverrides || [],
    assignmentSteps: partial.assignmentSteps || [],
    conflictsDetected: partial.conflictsDetected || [],
    conflictsResolved: partial.conflictsResolved || [],
    unresolvedConflicts: partial.unresolvedConflicts || [],
    byeHandling: partial.byeHandling || [],
    dependencyHandling: partial.dependencyHandling || [],
    finalAssignments: partial.finalAssignments || [],
    unassignedMatches: partial.unassignedMatches || [],
    warnings: partial.warnings || [],
    parityStatus: partial.parityStatus,
    timestamp: partial.timestamp || new Date().toISOString(),
  };
}

/**
 * @param {Partial<import('./schedulingTypes.js').SchedulingResult>} [partial]
 */
export function createSchedulingResult(partial = {}) {
  return {
    ok: partial.ok !== false,
    rounds: partial.rounds || [],
    matches: partial.matches || [],
    assignments: partial.assignments || [],
    unassignedMatches: partial.unassignedMatches || [],
    byes: partial.byes || [],
    conflicts: partial.conflicts || [],
    explanations: partial.explanations || [],
    decisionTrace: partial.decisionTrace,
    audit: partial.audit,
    warnings: partial.warnings || [],
    errors: partial.errors || [],
    manualOverrides: partial.manualOverrides || [],
    metadata: partial.metadata && typeof partial.metadata === "object" ? { ...partial.metadata } : {},
  };
}

/**
 * @param {import('./schedulingTypes.js').SchedulingRequest} request
 */
export function cloneSchedulingRequest(request) {
  return JSON.parse(JSON.stringify(request));
}
