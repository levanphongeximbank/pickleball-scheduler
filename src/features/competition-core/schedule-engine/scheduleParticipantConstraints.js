/**
 * CORE-11 Phase 1F — participant / team / shared-resource identity helpers
 * and overlap / rest checks (pure).
 *
 * Conservative placeholder lineage derives possible resource sets from
 * WINNER_OF / LOSER_OF / PREVIOUS_ROUND dependencies without inferring
 * which identity actually advances.
 *
 * Does not reschedule, read scores, or mutate lifecycle state.
 */

import {
  PARTICIPANT_REFERENCE_KIND,
  SCHEDULE_DEPENDENCY_TYPE,
  isParticipantReferenceKind,
} from "./scheduleConstants.js";
import {
  SCHEDULE_DIAGNOSTIC_CODE,
  createScheduleDiagnostic,
  sortScheduleDiagnostics,
} from "./scheduleDiagnostics.js";
import {
  asciiCompare,
  isValidIdentifier,
  normalizeIdentifier,
  stableSortByKeys,
} from "./scheduleTypes.js";

/** Dependency types that contribute structural participant lineage. */
export const LINEAGE_DEPENDENCY_TYPES = Object.freeze([
  SCHEDULE_DEPENDENCY_TYPE.WINNER_OF,
  SCHEDULE_DEPENDENCY_TYPE.LOSER_OF,
  SCHEDULE_DEPENDENCY_TYPE.PREVIOUS_ROUND,
]);

/** External barriers — no direct source participant lineage. */
export const EXTERNAL_BARRIER_DEPENDENCY_TYPES = Object.freeze([
  SCHEDULE_DEPENDENCY_TYPE.GROUP_STAGE_COMPLETE,
  SCHEDULE_DEPENDENCY_TYPE.QUALIFICATION,
]);

/**
 * @typedef {Object} ConstraintResource
 * @property {string} resourceId
 * @property {"PARTICIPANT"|"TEAM"|"SHARED_PLAYER"} kind
 * @property {string} matchId
 * @property {string} [sourceParticipantId]
 */

/**
 * @typedef {Object} MatchInterval
 * @property {string} matchId
 * @property {number} startUtcMs
 * @property {number} endUtcMs
 */

/**
 * Half-open interval overlap: [aStart, aEnd) overlaps [bStart, bEnd).
 * @param {number} aStart
 * @param {number} aEnd
 * @param {number} bStart
 * @param {number} bEnd
 */
export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Rest gap in milliseconds between earlier.end and later.start.
 * Negative means overlap.
 * @param {number} earlierEndUtcMs
 * @param {number} laterStartUtcMs
 */
export function restGapUtcMs(earlierEndUtcMs, laterStartUtcMs) {
  return laterStartUtcMs - earlierEndUtcMs;
}

/**
 * Detect placeholder / unresolved participant identity markers.
 * @param {unknown} participant
 * @returns {boolean}
 */
export function isUnresolvedParticipantIdentity(participant) {
  if (participant == null || typeof participant !== "object") return true;
  const p = /** @type {Record<string, unknown>} */ (participant);
  const kind = normalizeIdentifier(p.kind);
  if (kind === PARTICIPANT_REFERENCE_KIND.PLACEHOLDER) return true;
  const id = normalizeIdentifier(p.participantId);
  if (!id) return true;
  const upper = id.toUpperCase();
  if (
    upper.startsWith("__PENDING") ||
    upper === "TBD" ||
    upper === "PLACEHOLDER" ||
    upper.startsWith("WINNER_OF:") ||
    upper.startsWith("LOSER_OF:") ||
    upper.startsWith("PREVIOUS_ROUND:")
  ) {
    return true;
  }
  return false;
}

/**
 * Parse explicit lineage token from participantId (WINNER_OF:matchId, …).
 * @param {unknown} participantId
 * @returns {{ type: string, sourceMatchId: string }|null}
 */
export function parseLineageParticipantToken(participantId) {
  const id = normalizeIdentifier(participantId);
  if (!id) return null;
  const upper = id.toUpperCase();
  for (const type of LINEAGE_DEPENDENCY_TYPES) {
    const prefix = `${type}:`;
    if (upper.startsWith(prefix)) {
      const sourceMatchId = normalizeIdentifier(id.slice(prefix.length));
      if (!isValidIdentifier(sourceMatchId)) return null;
      return { type, sourceMatchId };
    }
  }
  return null;
}

/**
 * Collect deterministic lineage source edges for a placeholder participant
 * on a dependent match (token + structural dependencies).
 *
 * @param {unknown} participant
 * @param {unknown} matchInput
 * @returns {{
 *   sources: Array<{ type: string, sourceMatchId: string }>,
 *   hasExternalBarrier: boolean,
 * }}
 */
export function collectPlaceholderLineageSources(participant, matchInput) {
  /** @type {Map<string, { type: string, sourceMatchId: string }>} */
  const byKey = new Map();
  let hasExternalBarrier = false;

  const add = (type, sourceMatchId) => {
    const t = normalizeIdentifier(type);
    const s = normalizeIdentifier(sourceMatchId);
    if (!t || !s) return;
    const key = `${t}\0${s}`;
    if (!byKey.has(key)) {
      byKey.set(key, { type: t, sourceMatchId: s });
    }
  };

  const token = parseLineageParticipantToken(
    participant && typeof participant === "object"
      ? /** @type {Record<string, unknown>} */ (participant).participantId
      : ""
  );
  if (token) add(token.type, token.sourceMatchId);

  const deps =
    matchInput &&
    typeof matchInput === "object" &&
    Array.isArray(/** @type {Record<string, unknown>} */ (matchInput).dependencies)
      ? /** @type {unknown[]} */ (
          /** @type {Record<string, unknown>} */ (matchInput).dependencies
        )
      : [];

  for (const dep of deps) {
    if (dep == null || typeof dep !== "object") continue;
    const d = /** @type {Record<string, unknown>} */ (dep);
    const type = normalizeIdentifier(d.type);
    const sourceMatchId = normalizeIdentifier(d.sourceMatchId);
    if (EXTERNAL_BARRIER_DEPENDENCY_TYPES.includes(type)) {
      hasExternalBarrier = true;
      continue;
    }
    if (LINEAGE_DEPENDENCY_TYPES.includes(type) && sourceMatchId) {
      add(type, sourceMatchId);
    }
  }

  const sources = [...byKey.values()].sort((a, b) => {
    const c = asciiCompare(a.type, b.type);
    return c !== 0 ? c : asciiCompare(a.sourceMatchId, b.sourceMatchId);
  });

  return { sources, hasExternalBarrier };
}

/**
 * Flatten deterministic constraint resources from one concrete participant.
 *
 * @param {unknown} participant
 * @param {string} matchId
 * @returns {{
 *   resources: ConstraintResource[],
 *   unresolved: boolean,
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 * }}
 */
export function extractConstraintResources(participant, matchId) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  /** @type {ConstraintResource[]} */
  const resources = [];
  const mid = normalizeIdentifier(matchId);

  if (participant == null || typeof participant !== "object") {
    return { resources, unresolved: true, diagnostics };
  }
  const p = /** @type {Record<string, unknown>} */ (participant);
  const participantId = normalizeIdentifier(p.participantId);
  const kindRaw = normalizeIdentifier(p.kind);
  const kind = isParticipantReferenceKind(kindRaw) ? kindRaw : "";

  if (isUnresolvedParticipantIdentity(p)) {
    return { resources, unresolved: true, diagnostics };
  }
  if (!isValidIdentifier(participantId)) {
    return { resources, unresolved: true, diagnostics };
  }

  /** @type {Set<string>} */
  const seen = new Set();

  const add = (resourceId, resourceKind) => {
    const id = normalizeIdentifier(resourceId);
    if (!id || seen.has(id)) return;
    seen.add(id);
    resources.push({
      resourceId: id,
      kind: resourceKind,
      matchId: mid,
      sourceParticipantId: participantId,
    });
  };

  if (kind === PARTICIPANT_REFERENCE_KIND.PLAYER || (!kind && !p.teamId)) {
    if (kind === PARTICIPANT_REFERENCE_KIND.PLAYER || !kind) {
      add(participantId, "PARTICIPANT");
    }
  }
  if (
    kind === PARTICIPANT_REFERENCE_KIND.TEAM ||
    kind === PARTICIPANT_REFERENCE_KIND.ENTRY
  ) {
    add(participantId, "TEAM");
  }
  if (!kind && p.teamId) {
    add(participantId, "PARTICIPANT");
    add(normalizeIdentifier(p.teamId), "TEAM");
  }

  if (Array.isArray(p.constraintResourceIds)) {
    const sorted = [
      ...new Set(
        p.constraintResourceIds
          .map((id) => normalizeIdentifier(id))
          .filter((id) => id.length > 0)
      ),
    ].sort(asciiCompare);
    for (const id of sorted) {
      add(id, "SHARED_PLAYER");
    }
  }

  if (
    (kind === PARTICIPANT_REFERENCE_KIND.TEAM ||
      kind === PARTICIPANT_REFERENCE_KIND.ENTRY) &&
    resources.length === 0
  ) {
    add(participantId, "TEAM");
  }
  if (kind === PARTICIPANT_REFERENCE_KIND.PLAYER && resources.length === 0) {
    add(participantId, "PARTICIPANT");
  }
  if (!kind && resources.length === 0) {
    add(participantId, "PARTICIPANT");
  }

  return {
    resources: stableSortByKeys(resources, (r) => [
      r.kind,
      r.resourceId,
      r.matchId,
    ]),
    unresolved: false,
    diagnostics,
  };
}

/**
 * Derive the conservative possible-resource set for a participant, including
 * transitive WINNER_OF / LOSER_OF / PREVIOUS_ROUND lineage.
 *
 * Does not infer which resource advances. Bye sources contribute no identity.
 *
 * @param {unknown} participant
 * @param {string} matchId
 * @param {Map<string, unknown>} matchInputById
 * @param {Set<string>} [visitingMatchIds]
 * @returns {{
 *   resources: ConstraintResource[],
 *   unresolved: boolean,
 *   lineageResolved: boolean,
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 * }}
 */
export function deriveConservativeConstraintResources(
  participant,
  matchId,
  matchInputById,
  visitingMatchIds = new Set()
) {
  const mid = normalizeIdentifier(matchId);
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];

  if (!isUnresolvedParticipantIdentity(participant)) {
    const concrete = extractConstraintResources(participant, mid);
    return {
      ...concrete,
      lineageResolved: !concrete.unresolved,
    };
  }

  const matchInput = matchInputById.get(mid);
  const { sources } = collectPlaceholderLineageSources(
    participant,
    matchInput
  );

  if (sources.length === 0) {
    return {
      resources: [],
      unresolved: true,
      lineageResolved: false,
      diagnostics,
    };
  }

  if (visitingMatchIds.has(mid)) {
    return {
      resources: [],
      unresolved: true,
      lineageResolved: false,
      diagnostics: [
        createScheduleDiagnostic({
          code: SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_IDENTITY_UNRESOLVED,
          path: `matches[matchId=${mid}].participants`,
          message: "placeholder lineage cycle — identity safety cannot be proven",
          relatedMatchIds: [mid],
          details: {
            matchId: mid,
            participantId: normalizeIdentifier(
              participant && typeof participant === "object"
                ? /** @type {any} */ (participant).participantId
                : ""
            ),
            reason: "LINEAGE_CYCLE",
          },
        }),
      ],
    };
  }

  const nextVisiting = new Set(visitingMatchIds);
  nextVisiting.add(mid);

  /** @type {Map<string, ConstraintResource>} */
  const byKey = new Map();
  let sawByeOnly = false;
  let anyUnresolvedBranch = false;

  for (const src of sources) {
    const sourceMatch = matchInputById.get(src.sourceMatchId);
    if (!sourceMatch || typeof sourceMatch !== "object") {
      anyUnresolvedBranch = true;
      continue;
    }
    const sm = /** @type {Record<string, unknown>} */ (sourceMatch);
    if (sm.isBye === true) {
      sawByeOnly = true;
      continue;
    }

    const sourceParticipants = Array.isArray(sm.participants)
      ? /** @type {unknown[]} */ (sm.participants)
      : [];

    if (sourceParticipants.length === 0) {
      // Empty non-bye source: expand the source match's own dependency lineage.
      const viaSourceMatch = deriveConservativeConstraintResources(
        {
          kind: PARTICIPANT_REFERENCE_KIND.PLACEHOLDER,
          participantId: `__PENDING__`,
        },
        src.sourceMatchId,
        matchInputById,
        nextVisiting
      );
      diagnostics.push(...viaSourceMatch.diagnostics);
      if (viaSourceMatch.unresolved && viaSourceMatch.resources.length === 0) {
        anyUnresolvedBranch = true;
        continue;
      }
      for (const res of viaSourceMatch.resources) {
        const key = `${res.kind}\0${res.resourceId}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            resourceId: res.resourceId,
            kind: res.kind,
            matchId: mid,
            sourceParticipantId: normalizeIdentifier(
              participant && typeof participant === "object"
                ? /** @type {any} */ (participant).participantId
                : ""
            ),
          });
        }
      }
      if (viaSourceMatch.unresolved) anyUnresolvedBranch = true;
      continue;
    }

    for (const part of sourceParticipants) {
      const nested = deriveConservativeConstraintResources(
        part,
        src.sourceMatchId,
        matchInputById,
        nextVisiting
      );
      diagnostics.push(...nested.diagnostics);
      if (nested.unresolved && nested.resources.length === 0) {
        anyUnresolvedBranch = true;
        continue;
      }
      for (const res of nested.resources) {
        const key = `${res.kind}\0${res.resourceId}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            resourceId: res.resourceId,
            kind: res.kind,
            matchId: mid,
            sourceParticipantId: normalizeIdentifier(
              participant && typeof participant === "object"
                ? /** @type {any} */ (participant).participantId
                : res.sourceParticipantId
            ),
          });
        }
      }
      if (nested.unresolved) anyUnresolvedBranch = true;
    }
  }

  const resources = stableSortByKeys([...byKey.values()], (r) => [
    r.kind,
    r.resourceId,
    r.matchId,
  ]);

  // Bye-only lineage: established structurally, no identity — not opaque unresolved.
  if (resources.length === 0 && sawByeOnly && !anyUnresolvedBranch) {
    return {
      resources: [],
      unresolved: false,
      lineageResolved: true,
      diagnostics,
    };
  }

  if (resources.length === 0) {
    return {
      resources: [],
      unresolved: true,
      lineageResolved: false,
      diagnostics,
    };
  }

  // Partial unresolved branches with some resources: still use known possible set,
  // but fail closed because safety cannot be fully proven.
  if (anyUnresolvedBranch) {
    return {
      resources,
      unresolved: true,
      lineageResolved: false,
      diagnostics,
    };
  }

  return {
    resources,
    unresolved: false,
    lineageResolved: true,
    diagnostics,
  };
}

/**
 * Collect all constraint resources for scheduled matches from request matches.
 *
 * @param {Array<{ matchId: string, startUtcMs: number, endUtcMs: number }>} scheduledIntervals
 * @param {Map<string, unknown>} matchInputById
 * @returns {{
 *   byResource: Map<string, Array<MatchInterval & { resourceKind: string, sourceParticipantId?: string }>>,
 *   unresolvedEntries: Array<{ matchId: string, participantId: string, participant: unknown }>,
 *   unresolvedMatchIds: string[],
 *   diagnostics: import('./scheduleDiagnostics.js').ScheduleDiagnostic[],
 * }}
 */
export function collectScheduledConstraintIndex(
  scheduledIntervals,
  matchInputById
) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const diagnostics = [];
  /** @type {Map<string, Array<MatchInterval & { resourceKind: string, sourceParticipantId?: string }>>} */
  const byResource = new Map();
  /** @type {string[]} */
  const unresolvedMatchIds = [];
  /** @type {Array<{ matchId: string, participantId: string, participant: unknown }>} */
  const unresolvedEntries = [];

  for (const interval of scheduledIntervals) {
    const matchId = normalizeIdentifier(interval.matchId);
    const input = matchInputById.get(matchId);
    if (!input || typeof input !== "object") continue;
    const participants = Array.isArray(
      /** @type {Record<string, unknown>} */ (input).participants
    )
      ? /** @type {unknown[]} */ (
          /** @type {Record<string, unknown>} */ (input).participants
        )
      : [];

    let matchUnresolved = false;
    for (const part of participants) {
      const extracted = deriveConservativeConstraintResources(
        part,
        matchId,
        matchInputById
      );
      diagnostics.push(...extracted.diagnostics);
      const participantId = normalizeIdentifier(
        part && typeof part === "object"
          ? /** @type {any} */ (part).participantId
          : ""
      );

      if (extracted.unresolved) {
        matchUnresolved = true;
        unresolvedEntries.push({
          matchId,
          participantId: participantId || "__MISSING__",
          participant: part,
        });
      }

      for (const res of extracted.resources) {
        const key = `${res.kind}\0${res.resourceId}`;
        let list = byResource.get(key);
        if (!list) {
          list = [];
          byResource.set(key, list);
        }
        list.push({
          matchId,
          startUtcMs: interval.startUtcMs,
          endUtcMs: interval.endUtcMs,
          resourceKind: res.kind,
          sourceParticipantId: res.sourceParticipantId,
        });
      }
    }

    if (participants.length === 0 || matchUnresolved) {
      unresolvedMatchIds.push(matchId);
    }
  }

  unresolvedEntries.sort((a, b) => {
    const c = asciiCompare(a.matchId, b.matchId);
    return c !== 0 ? c : asciiCompare(a.participantId, b.participantId);
  });

  return {
    byResource,
    unresolvedEntries,
    unresolvedMatchIds: [...new Set(unresolvedMatchIds)].sort(asciiCompare),
    diagnostics: sortScheduleDiagnostics(diagnostics),
  };
}

/**
 * Emit overlap and rest diagnostics for one resource timeline.
 *
 * @param {string} resourceKey - "KIND\\0id"
 * @param {Array<MatchInterval & { resourceKind: string, sourceParticipantId?: string }>} appearances
 * @param {{ minParticipantRestMinutes: number, minTeamRestMinutes: number }} restPolicy
 * @returns {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]}
 */
export function certifyResourceTimeline(resourceKey, appearances, restPolicy) {
  /** @type {import('./scheduleDiagnostics.js').ScheduleDiagnostic[]} */
  const out = [];
  const sep = resourceKey.indexOf("\0");
  const resourceKind = sep >= 0 ? resourceKey.slice(0, sep) : "PARTICIPANT";
  const resourceId = sep >= 0 ? resourceKey.slice(sep + 1) : resourceKey;

  const ordered = stableSortByKeys([...appearances], (a) => [
    a.startUtcMs,
    a.endUtcMs,
    a.matchId,
  ]);

  /** @type {typeof ordered} */
  const unique = [];
  /** @type {Set<string>} */
  const seenMatch = new Set();
  for (const row of ordered) {
    if (seenMatch.has(row.matchId)) continue;
    seenMatch.add(row.matchId);
    unique.push(row);
  }

  const minParticipant = restPolicy.minParticipantRestMinutes;
  const minTeam = restPolicy.minTeamRestMinutes;
  const applyParticipantRest =
    (resourceKind === "PARTICIPANT" || resourceKind === "SHARED_PLAYER") &&
    minParticipant > 0;
  const applyTeamRest = resourceKind === "TEAM" && minTeam > 0;

  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const a = unique[i];
      const b = unique[j];
      const earlier = a.startUtcMs <= b.startUtcMs ? a : b;
      const later = earlier === a ? b : a;

      if (
        intervalsOverlap(
          earlier.startUtcMs,
          earlier.endUtcMs,
          later.startUtcMs,
          later.endUtcMs
        )
      ) {
        const code =
          resourceKind === "TEAM"
            ? SCHEDULE_DIAGNOSTIC_CODE.TEAM_OVERLAP
            : SCHEDULE_DIAGNOSTIC_CODE.PARTICIPANT_OVERLAP;
        out.push(
          createScheduleDiagnostic({
            code,
            path: `constraints[${resourceId}]`,
            message: `${resourceKind.toLowerCase()} overlap between matches`,
            relatedMatchIds: [earlier.matchId, later.matchId],
            details: {
              resourceId,
              resourceKind,
              earlierMatchId: earlier.matchId,
              laterMatchId: later.matchId,
              earlierStartUtcMs: earlier.startUtcMs,
              earlierEndUtcMs: earlier.endUtcMs,
              laterStartUtcMs: later.startUtcMs,
              laterEndUtcMs: later.endUtcMs,
            },
          })
        );
        continue;
      }

      const gapMs = restGapUtcMs(earlier.endUtcMs, later.startUtcMs);
      const gapMinutes = gapMs / 60_000;

      if (applyParticipantRest && gapMinutes < minParticipant) {
        out.push(
          createScheduleDiagnostic({
            code: SCHEDULE_DIAGNOSTIC_CODE.INSUFFICIENT_REST,
            path: `constraints[${resourceId}]`,
            message: "insufficient participant rest between matches",
            relatedMatchIds: [earlier.matchId, later.matchId],
            details: {
              resourceId,
              resourceKind,
              restKind: "PARTICIPANT",
              earlierMatchId: earlier.matchId,
              laterMatchId: later.matchId,
              actualRestMinutes: gapMinutes,
              requiredRestMinutes: minParticipant,
            },
          })
        );
      }
      if (applyTeamRest && gapMinutes < minTeam) {
        out.push(
          createScheduleDiagnostic({
            code: SCHEDULE_DIAGNOSTIC_CODE.INSUFFICIENT_REST,
            path: `constraints[${resourceId}]`,
            message: "insufficient team rest between matches",
            relatedMatchIds: [earlier.matchId, later.matchId],
            details: {
              resourceId,
              resourceKind,
              restKind: "TEAM",
              earlierMatchId: earlier.matchId,
              laterMatchId: later.matchId,
              actualRestMinutes: gapMinutes,
              requiredRestMinutes: minTeam,
            },
          })
        );
      }
    }
  }

  return sortScheduleDiagnostics(out);
}
