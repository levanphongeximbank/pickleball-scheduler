/**
 * CORE-11 Phase 1D — dependency readiness and earliest-start lower bounds (pure).
 *
 * Distinguishes:
 * - schedule-planning readiness (SCHEDULED predecessors OK when structural);
 * - participant-resolution readiness (COMPLETED / BYE only for WINNER_OF / LOSER_OF);
 * - timing readiness via deriveDependencyEarliestStartAbsolute (known planned ends).
 *
 * Does not infer winners/losers, mutate lifecycle, allocate slots/sessions,
 * or enforce participant rest.
 */

import {
  SCHEDULE_PREDECESSOR_STATE,
  isSchedulePredecessorState,
} from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import { convertCivilScheduleTimeToAbsolute } from "./scheduleCivilTime.js";
import {
  asciiCompare,
  isNonNegativeInteger,
  isValidIdentifier,
  normalizeIdentifier,
  stableSortByKeys,
} from "./scheduleTypes.js";

/**
 * @typedef {Object} DependencyBlocker
 * @property {string} sourceMatchId
 * @property {string} type
 * @property {string} state
 * @property {string} reason
 */

/**
 * @typedef {Object} SchedulePlanningReadinessResult
 * @property {boolean} planningReady
 * @property {string} matchId
 * @property {DependencyBlocker[]} blockers
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */

/**
 * @typedef {Object} ParticipantResolutionReadinessResult
 * @property {boolean} participantResolutionReady
 * @property {string} matchId
 * @property {DependencyBlocker[]} unresolvedParticipantDependencies
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */

/**
 * @typedef {Object} DependencyEarliestStartResult
 * @property {boolean} ok
 * @property {boolean} timingReady
 * @property {number|null} utcMs
 * @property {string|null} utcIso
 * @property {string[]} contributingPredecessorIds
 * @property {string[]} missingTimingDependencies
 * @property {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 */

/**
 * Resolve the effective predecessor state for one edge.
 *
 * @param {string} sourceMatchId
 * @param {unknown} rawState
 * @param {import('./scheduleDependencyGraph.js').ScheduleDependencyGraph} graph
 * @param {string} dependentMatchId
 * @param {string} type
 * @param {(partial: Partial<import('./scheduleDiagnostics.js').ScheduleDiagnostic> & { code: string }) => void} push
 * @returns {string}
 */
function resolvePredecessorState(
  sourceMatchId,
  rawState,
  graph,
  dependentMatchId,
  type,
  push
) {
  let state = SCHEDULE_PREDECESSOR_STATE.UNRESOLVED;
  if (rawState != null) {
    if (!isSchedulePredecessorState(rawState)) {
      state = SCHEDULE_PREDECESSOR_STATE.INVALID;
      push({
        code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_NOT_READY,
        path: `predecessorState[${sourceMatchId}]`,
        message: `invalid predecessor state: ${String(rawState)}`,
        relatedMatchIds: [dependentMatchId, sourceMatchId],
        details: { state: rawState, type },
      });
    } else {
      state = /** @type {string} */ (rawState);
    }
  }

  const predNode = graph.nodes.find((n) => n.matchId === sourceMatchId);
  if (
    state === SCHEDULE_PREDECESSOR_STATE.UNRESOLVED &&
    predNode?.isBye === true &&
    rawState == null
  ) {
    state = SCHEDULE_PREDECESSOR_STATE.BYE;
  }
  return state;
}

/**
 * Shared graph/match lookup preamble.
 *
 * @param {unknown} matchId
 * @param {import('./scheduleDependencyGraph.js').ScheduleDependencyGraph|null|undefined} graph
 * @returns {{
 *   ok: boolean,
 *   id: string,
 *   node: import('./scheduleDependencyGraph.js').ScheduleDependencyNode|null,
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 * }}
 */
function resolveMatchNode(matchId, graph) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const id = normalizeIdentifier(matchId);

  if (!isValidIdentifier(id)) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
        path: "matchId",
        message: "matchId must be a non-empty trimmed string",
      })
    );
    return { ok: false, id, node: null, diagnostics };
  }

  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
        message: "dependency graph is required",
        relatedMatchIds: [id],
      })
    );
    return { ok: false, id, node: null, diagnostics };
  }

  if (!graph.ok) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_NOT_READY,
        message: "dependency graph is invalid — planning readiness unavailable",
        relatedMatchIds: [id],
      })
    );
    return { ok: false, id, node: null, diagnostics };
  }

  const node = graph.nodes.find((n) => n.matchId === id) || null;
  if (!node) {
    diagnostics.push(
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
        path: "matchId",
        message: `matchId not present in dependency graph: ${id}`,
        relatedMatchIds: [id],
      })
    );
    return { ok: false, id, node: null, diagnostics };
  }

  return { ok: true, id, node, diagnostics };
}

/**
 * Schedule-planning readiness.
 *
 * A dependent match may be planned before sources complete. Predecessors in
 * SCHEDULED, COMPLETED, or BYE satisfy planning readiness. UNRESOLVED and
 * INVALID block. Does not require winner/loser identity.
 *
 * Timing of planned ends is evaluated separately via
 * deriveDependencyEarliestStartAbsolute (timingReady).
 *
 * @param {unknown} matchId
 * @param {import('./scheduleDependencyGraph.js').ScheduleDependencyGraph|null|undefined} graph
 * @param {Record<string, unknown>|Map<string, unknown>|null|undefined} predecessorState
 * @returns {SchedulePlanningReadinessResult}
 */
export function evaluateSchedulePlanningReadiness(
  matchId,
  graph,
  predecessorState
) {
  const preamble = resolveMatchNode(matchId, graph);
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [...preamble.diagnostics];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  if (!preamble.ok || !preamble.node) {
    return {
      planningReady: false,
      matchId: preamble.id,
      blockers: [],
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  const stateMap = normalizeStateMap(predecessorState);
  /** @type {DependencyBlocker[]} */
  const blockers = [];

  for (const edge of preamble.node.predecessors) {
    const state = resolvePredecessorState(
      edge.sourceMatchId,
      stateMap.get(edge.sourceMatchId),
      /** @type {import('./scheduleDependencyGraph.js').ScheduleDependencyGraph} */ (graph),
      preamble.id,
      edge.type,
      push
    );

    if (
      state === SCHEDULE_PREDECESSOR_STATE.SCHEDULED ||
      state === SCHEDULE_PREDECESSOR_STATE.COMPLETED ||
      state === SCHEDULE_PREDECESSOR_STATE.BYE
    ) {
      continue;
    }

    let reason = "UNRESOLVED";
    if (state === SCHEDULE_PREDECESSOR_STATE.INVALID) {
      reason = "INVALID_PREDECESSOR_STATE";
    }

    blockers.push({
      sourceMatchId: edge.sourceMatchId,
      type: edge.type,
      state,
      reason,
    });
  }

  const sortedBlockers = stableSortByKeys(blockers, (b) => [
    b.sourceMatchId,
    b.type,
    b.state,
    b.reason,
  ]);

  if (sortedBlockers.length > 0) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_NOT_READY,
      path: `matches[matchId=${preamble.id}]`,
      message: `match has ${sortedBlockers.length} planning blocker(s)`,
      relatedMatchIds: [
        preamble.id,
        ...sortedBlockers.map((b) => b.sourceMatchId),
      ],
      details: {
        readinessKind: "SCHEDULE_PLANNING",
        blockers: sortedBlockers,
      },
    });
  }

  return {
    planningReady: sortedBlockers.length === 0,
    matchId: preamble.id,
    blockers: sortedBlockers,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * Participant-resolution readiness.
 *
 * WINNER_OF / LOSER_OF participant identity is available only when the source
 * is COMPLETED or structurally BYE. SCHEDULED (incomplete) is not enough.
 * Never infers winners, losers, or match results.
 *
 * @param {unknown} matchId
 * @param {import('./scheduleDependencyGraph.js').ScheduleDependencyGraph|null|undefined} graph
 * @param {Record<string, unknown>|Map<string, unknown>|null|undefined} predecessorState
 * @returns {ParticipantResolutionReadinessResult}
 */
export function evaluateParticipantResolutionReadiness(
  matchId,
  graph,
  predecessorState
) {
  const preamble = resolveMatchNode(matchId, graph);
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [...preamble.diagnostics];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  if (!preamble.ok || !preamble.node) {
    return {
      participantResolutionReady: false,
      matchId: preamble.id,
      unresolvedParticipantDependencies: [],
      diagnostics: sortScheduleDiagnostics(diagnostics),
    };
  }

  const stateMap = normalizeStateMap(predecessorState);
  /** @type {DependencyBlocker[]} */
  const unresolved = [];

  for (const edge of preamble.node.predecessors) {
    const state = resolvePredecessorState(
      edge.sourceMatchId,
      stateMap.get(edge.sourceMatchId),
      /** @type {import('./scheduleDependencyGraph.js').ScheduleDependencyGraph} */ (graph),
      preamble.id,
      edge.type,
      push
    );

    if (
      state === SCHEDULE_PREDECESSOR_STATE.COMPLETED ||
      state === SCHEDULE_PREDECESSOR_STATE.BYE
    ) {
      continue;
    }

    let reason = "UNRESOLVED";
    if (state === SCHEDULE_PREDECESSOR_STATE.SCHEDULED) {
      reason = "SCHEDULED_NOT_COMPLETED";
    } else if (state === SCHEDULE_PREDECESSOR_STATE.INVALID) {
      reason = "INVALID_PREDECESSOR_STATE";
    }

    unresolved.push({
      sourceMatchId: edge.sourceMatchId,
      type: edge.type,
      state,
      reason,
    });
  }

  const sortedUnresolved = stableSortByKeys(unresolved, (b) => [
    b.sourceMatchId,
    b.type,
    b.state,
    b.reason,
  ]);

  if (sortedUnresolved.length > 0) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_NOT_READY,
      path: `matches[matchId=${preamble.id}]`,
      message: `match has ${sortedUnresolved.length} unresolved participant predecessor(s)`,
      relatedMatchIds: [
        preamble.id,
        ...sortedUnresolved.map((b) => b.sourceMatchId),
      ],
      details: {
        readinessKind: "PARTICIPANT_RESOLUTION",
        unresolvedParticipantDependencies: sortedUnresolved,
      },
    });
  }

  return {
    participantResolutionReady: sortedUnresolved.length === 0,
    matchId: preamble.id,
    unresolvedParticipantDependencies: sortedUnresolved,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * @deprecated Prefer evaluateSchedulePlanningReadiness and
 * evaluateParticipantResolutionReadiness. Retained only as a thin combined
 * surface that never exposes an ambiguous generic `ready` boolean.
 *
 * @param {unknown} matchId
 * @param {import('./scheduleDependencyGraph.js').ScheduleDependencyGraph|null|undefined} graph
 * @param {Record<string, unknown>|Map<string, unknown>|null|undefined} predecessorState
 * @returns {{
 *   matchId: string,
 *   planningReady: boolean,
 *   participantResolutionReady: boolean,
 *   blockers: DependencyBlocker[],
 *   unresolvedParticipantDependencies: DependencyBlocker[],
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 * }}
 */
export function evaluateMatchDependencyReadiness(
  matchId,
  graph,
  predecessorState
) {
  const planning = evaluateSchedulePlanningReadiness(
    matchId,
    graph,
    predecessorState
  );
  const participants = evaluateParticipantResolutionReadiness(
    matchId,
    graph,
    predecessorState
  );
  return {
    matchId: planning.matchId,
    planningReady: planning.planningReady,
    participantResolutionReady: participants.participantResolutionReady,
    blockers: planning.blockers,
    unresolvedParticipantDependencies:
      participants.unresolvedParticipantDependencies,
    diagnostics: sortScheduleDiagnostics([
      ...planning.diagnostics,
      ...participants.diagnostics,
    ]),
  };
}

/**
 * Derived absolute earliest-start lower bound from predecessor end times + buffer.
 * Timing readiness is independent of participant-resolution readiness:
 * a SCHEDULED predecessor with a known planned end may contribute.
 *
 * Bye predecessors never contribute fabricated end times.
 *
 * @param {{
 *   matchId?: unknown,
 *   graph?: import('./scheduleDependencyGraph.js').ScheduleDependencyGraph|null,
 *   predecessorSchedule?: Record<string, unknown>|Map<string, unknown>|null,
 *   bufferMinutes?: unknown,
 *   timezone?: unknown,
 * }} [input]
 * @returns {DependencyEarliestStartResult}
 */
export function deriveDependencyEarliestStartAbsolute(input = {}) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  const push = (partial) => {
    diagnostics.push(createScheduleDiagnostic(partial));
  };

  const matchId = normalizeIdentifier(input.matchId);
  const graph = input.graph;
  const bufferMinutes = input.bufferMinutes;
  const timezone = normalizeIdentifier(input.timezone);

  if (!isValidIdentifier(matchId)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
      path: "matchId",
      message: "matchId must be a non-empty trimmed string",
    });
    return failEarliest(diagnostics);
  }
  if (!graph || typeof graph !== "object" || !Array.isArray(graph.nodes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_SCHEDULE_REQUEST,
      message: "dependency graph is required",
      relatedMatchIds: [matchId],
    });
    return failEarliest(diagnostics);
  }
  if (bufferMinutes === undefined || bufferMinutes === null) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID,
      path: "bufferMinutes",
      message: "bufferMinutes is required (non-negative integer; 0 allowed)",
      relatedMatchIds: [matchId],
    });
    return failEarliest(diagnostics);
  }
  if (!isNonNegativeInteger(bufferMinutes)) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.BUFFER_DURATION_INVALID,
      path: "bufferMinutes",
      message: "bufferMinutes must be a non-negative integer",
      relatedMatchIds: [matchId],
      details: { bufferMinutes },
    });
    return failEarliest(diagnostics);
  }
  if (!timezone) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_TIMEZONE,
      path: "timezone",
      message: "timezone is required for absolute earliest-start derivation",
      relatedMatchIds: [matchId],
    });
    return failEarliest(diagnostics);
  }

  const node = graph.nodes.find((n) => n.matchId === matchId);
  if (!node) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.INVALID_IDENTIFIER,
      path: "matchId",
      message: `matchId not present in dependency graph: ${matchId}`,
      relatedMatchIds: [matchId],
    });
    return failEarliest(diagnostics);
  }

  const scheduleMap = normalizeScheduleMap(input.predecessorSchedule);
  /** @type {{ sourceMatchId: string, utcMs: number, utcIso: string }[]} */
  const ends = [];
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const byeOnly = [];

  for (const edge of node.predecessors) {
    const pred = graph.nodes.find((n) => n.matchId === edge.sourceMatchId);
    if (pred?.isBye === true) {
      byeOnly.push(edge.sourceMatchId);
      continue;
    }

    const entry = scheduleMap.get(edge.sourceMatchId);
    if (!entry) {
      missing.push(edge.sourceMatchId);
      continue;
    }

    const converted = resolvePredecessorEndAbsolute(
      entry,
      timezone,
      edge.sourceMatchId
    );
    diagnostics.push(...converted.diagnostics);
    if (!converted.ok || converted.utcMs == null) {
      missing.push(edge.sourceMatchId);
      continue;
    }
    ends.push({
      sourceMatchId: edge.sourceMatchId,
      utcMs: converted.utcMs,
      utcIso: /** @type {string} */ (converted.utcIso),
    });
  }

  if (missing.length > 0) {
    const sortedMissing = [...new Set(missing)].sort(asciiCompare);
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_TIMING_UNAVAILABLE,
      path: `matches[matchId=${matchId}]`,
      message: "required predecessor end timing is unavailable",
      relatedMatchIds: [matchId, ...sortedMissing],
      details: { missingPredecessorIds: sortedMissing },
    });
    return failEarliest(diagnostics, sortedMissing);
  }

  if (ends.length === 0) {
    push({
      code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_TIMING_UNAVAILABLE,
      path: `matches[matchId=${matchId}]`,
      message:
        node.predecessors.length === 0
          ? "no predecessor timing — earliest-start lower bound is undefined without an explicit schedule context"
          : "bye-only predecessors provide no end time — earliest-start lower bound cannot be fabricated",
      relatedMatchIds: [matchId, ...[...new Set(byeOnly)].sort(asciiCompare)],
      details: {
        byePredecessorIds: [...new Set(byeOnly)].sort(asciiCompare),
        reason:
          node.predecessors.length === 0
            ? "NO_PREDECESSORS"
            : "BYE_ONLY_PREDECESSORS",
      },
    });
    return failEarliest(diagnostics);
  }

  const sortedEnds = stableSortByKeys(ends, (e) => [-e.utcMs, e.sourceMatchId]);
  const latest = sortedEnds[0];
  const utcMs = latest.utcMs + /** @type {number} */ (bufferMinutes) * 60_000;
  const utcIso = new Date(utcMs).toISOString();

  return {
    ok: true,
    timingReady: true,
    utcMs,
    utcIso,
    contributingPredecessorIds: sortedEnds.map((e) => e.sourceMatchId),
    missingTimingDependencies: [],
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * @param {unknown} entry
 * @param {string} timezone
 * @param {string} sourceMatchId
 * @returns {{ ok: boolean, utcMs: number|null, utcIso: string|null, diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[] }}
 */
function resolvePredecessorEndAbsolute(entry, timezone, sourceMatchId) {
  if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
    return {
      ok: false,
      utcMs: null,
      utcIso: null,
      diagnostics: [
        createScheduleDiagnostic({
          code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_TIMING_UNAVAILABLE,
          path: `predecessorSchedule[${sourceMatchId}]`,
          message: "predecessor schedule entry must be an object",
          relatedMatchIds: [sourceMatchId],
        }),
      ],
    };
  }
  const record = /** @type {Record<string, unknown>} */ (entry);

  if (typeof record.utcMs === "number" && Number.isFinite(record.utcMs)) {
    return {
      ok: true,
      utcMs: record.utcMs,
      utcIso:
        typeof record.utcIso === "string" && record.utcIso
          ? record.utcIso
          : new Date(record.utcMs).toISOString(),
      diagnostics: [],
    };
  }

  const end = record.end;
  if (end && typeof end === "object" && !Array.isArray(end)) {
    const endRec = /** @type {Record<string, unknown>} */ (end);
    if (typeof endRec.utcMs === "number" && Number.isFinite(endRec.utcMs)) {
      return {
        ok: true,
        utcMs: endRec.utcMs,
        utcIso:
          typeof endRec.utcIso === "string" && endRec.utcIso
            ? endRec.utcIso
            : new Date(endRec.utcMs).toISOString(),
        diagnostics: [],
      };
    }
    const tz = normalizeIdentifier(record.timezone) || timezone;
    return convertCivilScheduleTimeToAbsolute(
      {
        date: endRec.date,
        minutesFromMidnight: endRec.minutesFromMidnight,
        timezone: tz,
      },
      tz,
      `predecessorSchedule[${sourceMatchId}].end`
    );
  }

  if (record.date != null && record.minutesFromMidnight != null) {
    const tz = normalizeIdentifier(record.timezone) || timezone;
    return convertCivilScheduleTimeToAbsolute(
      {
        date: record.date,
        minutesFromMidnight: record.minutesFromMidnight,
        timezone: tz,
      },
      tz,
      `predecessorSchedule[${sourceMatchId}]`
    );
  }

  return {
    ok: false,
    utcMs: null,
    utcIso: null,
    diagnostics: [
      createScheduleDiagnostic({
        code: SCHEDULE_DIAGNOSTIC_CODE.DEPENDENCY_TIMING_UNAVAILABLE,
        path: `predecessorSchedule[${sourceMatchId}]`,
        message:
          "predecessor schedule must provide end civil time or utcMs",
        relatedMatchIds: [sourceMatchId],
      }),
    ],
  };
}

/**
 * @param {Record<string, unknown>|Map<string, unknown>|null|undefined} predecessorState
 * @returns {Map<string, unknown>}
 */
function normalizeStateMap(predecessorState) {
  /** @type {Map<string, unknown>} */
  const map = new Map();
  if (!predecessorState) return map;
  if (predecessorState instanceof Map) {
    for (const [k, v] of predecessorState.entries()) {
      const id = normalizeIdentifier(k);
      if (id) map.set(id, v);
    }
    return map;
  }
  if (typeof predecessorState === "object") {
    for (const key of Object.keys(predecessorState).sort(asciiCompare)) {
      const id = normalizeIdentifier(key);
      if (id) {
        map.set(
          id,
          /** @type {Record<string, unknown>} */ (predecessorState)[key]
        );
      }
    }
  }
  return map;
}

/**
 * @param {Record<string, unknown>|Map<string, unknown>|null|undefined} predecessorSchedule
 * @returns {Map<string, unknown>}
 */
function normalizeScheduleMap(predecessorSchedule) {
  return normalizeStateMap(predecessorSchedule);
}

/**
 * @param {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} diagnostics
 * @param {string[]} [missingTimingDependencies]
 * @returns {DependencyEarliestStartResult}
 */
function failEarliest(diagnostics, missingTimingDependencies = []) {
  return {
    ok: false,
    timingReady: false,
    utcMs: null,
    utcIso: null,
    contributingPredecessorIds: [],
    missingTimingDependencies,
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}
