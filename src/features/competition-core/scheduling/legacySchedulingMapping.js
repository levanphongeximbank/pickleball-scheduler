import {
  ASSIGNMENT_STATUS,
  SCHEDULING_SCOPE,
  SCHEDULING_STRATEGY,
} from "./schedulingConstants.js";
import {
  createSchedulingAssignment,
  createSchedulingConfiguration,
  createSchedulingCourt,
  createSchedulingMatch,
  createSchedulingParticipant,
  createSchedulingRequest,
  createSchedulingResult,
} from "./schedulingContracts.js";
import { isByeParticipant, isPendingDependencyParticipant } from "./validateSchedulingConflicts.js";

const KNOWN_LEGACY_KEYS = new Set([
  "groups",
  "group",
  "matches",
  "matchups",
  "teams",
  "courts",
  "scheduleConfig",
  "tournamentId",
  "eventId",
  "players",
  "options",
  "consumer",
  "participants",
  "venues",
  "manualOverrides",
  "randomFn",
  "randomSeed",
  "timezone",
  "settings",
  "regenerate",
]);

/**
 * @param {Record<string, unknown>} payload
 */
export function detectSchedulingScope(payload = {}) {
  if (payload.matchups || payload.teams || payload.consumer === "team_tournament") {
    return SCHEDULING_SCOPE.TEAM_TOURNAMENT;
  }
  if (payload.scheduleConfig || payload.consumer === "tournament_engine") {
    return SCHEDULING_SCOPE.TOURNAMENT_ENGINE;
  }
  return SCHEDULING_SCOPE.GROUP_STAGE;
}

/**
 * @param {Record<string, unknown>} payload
 */
export function mapLegacySchedulingPayloadToRequest(payload = {}) {
  const warnings = [];
  const scope = detectSchedulingScope(payload);
  const groups = payload.groups || (payload.group ? [payload.group] : []);
  const courts = payload.courts || payload.options?.courts || [];
  const scheduleConfig = payload.scheduleConfig || payload.options?.scheduleConfig || {};

  const participants = [];
  const matches = [];

  if (scope === SCHEDULING_SCOPE.TEAM_TOURNAMENT) {
    (payload.teams || []).forEach((team) => {
      participants.push(
        createSchedulingParticipant({
          participantId: team.id,
          teamId: team.id,
          name: team.name,
          seed: team.seed,
          withdrawn: team.withdrawn === true,
        })
      );
    });
    (payload.matchups || []).forEach((matchup) => {
      matches.push(
        createSchedulingMatch({
          matchId: matchup.id,
          roundNumber: matchup.roundNumber,
          entryAId: matchup.teamAId,
          entryBId: matchup.teamBId,
          groupId: matchup.groupId,
          status: matchup.status,
          pendingDependency: isPendingDependencyParticipant(matchup.teamAId) || isPendingDependencyParticipant(matchup.teamBId),
          metadata: {
            scheduledAt: matchup.scheduledAt,
            lineupLockAt: matchup.lineupLockAt,
            courtLabel: matchup.courtLabel,
          },
        })
      );
    });
  } else {
    groups.forEach((group) => {
      (group.entries || group.entryIds?.map((id) => ({ id })) || []).forEach((entry) => {
        participants.push(
          createSchedulingParticipant({
            participantId: entry.id || entry.entryId,
            name: entry.name,
            seed: entry.seed,
          })
        );
      });
      (group.matches || payload.matches || []).forEach((match) => {
        if (String(match.groupId || group.id) !== String(group.id) && groups.length > 1) {
          return;
        }
        matches.push(
          createSchedulingMatch({
            matchId: match.id,
            roundNumber: match.round,
            entryAId: match.entryAId,
            entryBId: match.entryBId,
            groupId: match.groupId || group.id,
            status: match.status,
            isBye: isByeParticipant(match.entryAId) || isByeParticipant(match.entryBId),
            pendingDependency:
              isPendingDependencyParticipant(match.entryAId) ||
              isPendingDependencyParticipant(match.entryBId),
          })
        );
      });
    });
    if (matches.length === 0 && Array.isArray(payload.matches)) {
      payload.matches.forEach((match) => {
        matches.push(
          createSchedulingMatch({
            matchId: match.id,
            roundNumber: match.round,
            entryAId: match.entryAId,
            entryBId: match.entryBId,
            groupId: match.groupId,
            status: match.status,
            isBye: isByeParticipant(match.entryAId) || isByeParticipant(match.entryBId),
          })
        );
      });
    }
  }

  Object.keys(payload).forEach((key) => {
    if (!KNOWN_LEGACY_KEYS.has(key) && payload[key] !== undefined) {
      warnings.push(`UNMAPPED_LEGACY_FIELD:${key}`);
    }
  });

  const strategy =
    scope === SCHEDULING_SCOPE.TEAM_TOURNAMENT
      ? SCHEDULING_STRATEGY.TEAM_TOURNAMENT
      : scope === SCHEDULING_SCOPE.TOURNAMENT_ENGINE
        ? SCHEDULING_STRATEGY.BALANCED
        : SCHEDULING_STRATEGY.GROUP_STAGE;

  return {
    request: createSchedulingRequest({
      tournamentId: payload.tournamentId,
      eventId: payload.eventId,
      strategy,
      participants,
      matches,
      courts: courts.map((court) =>
        createSchedulingCourt({
          courtId: court.id,
          name: court.name,
          locked: court.locked === true,
          available: court.active !== false,
        })
      ),
      configuration: createSchedulingConfiguration({
        strategy,
        timezone: payload.timezone || scheduleConfig.timezone,
        matchDurationMinutes: scheduleConfig.averageMatchMinutes,
        bufferMinutes: scheduleConfig.bufferMinutes,
        startTime: scheduleConfig.startTime,
        endTime: scheduleConfig.endTime,
        extensions: { randomFn: typeof payload.randomFn === "function" ? "present" : undefined },
      }),
      manualOverrides: payload.manualOverrides || [],
      legacyExtensions: {
        randomSeed: payload.randomSeed,
        regenerate: payload.regenerate,
        settings: payload.settings,
      },
      metadata: { scope, legacyConsumer: payload.consumer || scope },
    }),
    warnings,
  };
}

/**
 * @param {unknown} legacyResult
 * @param {import('./schedulingTypes.js').SchedulingRequest} request
 */
export function mapLegacySchedulingResultToCanonical(legacyResult, request = {}) {
  const warnings = [];
  const matches = [];
  const assignments = [];
  const rounds = [];
  const byes = [];
  const unassigned = [];

  if (!legacyResult || typeof legacyResult !== "object") {
    return createSchedulingResult({ ok: false, errors: ["Invalid legacy scheduling result"], warnings });
  }

  const obj = /** @type {Record<string, unknown>} */ (legacyResult);

  if (Array.isArray(obj.matchups)) {
    obj.matchups.forEach((matchup) => {
      const matchId = String(matchup.id || "");
      matches.push(
        createSchedulingMatch({
          matchId,
          roundNumber: matchup.roundNumber,
          entryAId: matchup.teamAId,
          entryBId: matchup.teamBId,
          groupId: matchup.groupId,
          status: matchup.status,
        })
      );
      assignments.push(
        createSchedulingAssignment({
          matchId,
          courtId: matchup.courtLabel ? String(matchup.courtLabel) : undefined,
          startTime: matchup.scheduledAt,
          endTime: matchup.lineupLockAt,
          slotId: matchup.scheduledAt,
          refereeId: matchup.refereeId,
          status: matchup.status,
          manualOverride: matchup.manualScheduleLock === true,
          source: "team_tournament",
        })
      );
    });
  }

  const legacyMatches = Array.isArray(obj.matches)
    ? obj.matches
    : Array.isArray(obj.data?.matches)
      ? obj.data.matches
      : [];
  const explicitAssignments = Array.isArray(obj.assignments) ? obj.assignments : [];

  explicitAssignments.forEach((assignment) => {
    assignments.push(createSchedulingAssignment(assignment));
  });

  legacyMatches.forEach((match) => {
    const matchId = String(match.id || "");
    const isBye = isByeParticipant(match.entryAId) || isByeParticipant(match.entryBId);
    if (isBye) {
      byes.push(matchId);
    }
    matches.push(
      createSchedulingMatch({
        matchId,
        roundNumber: match.round,
        entryAId: match.entryAId,
        entryBId: match.entryBId,
        groupId: match.groupId,
        status: match.status,
        isBye,
        pendingDependency:
          isPendingDependencyParticipant(match.entryAId) ||
          isPendingDependencyParticipant(match.entryBId),
      })
    );
    if (match.courtId || match.slot || match.scheduledStart) {
      if (!assignments.some((item) => item.matchId === matchId)) {
        assignments.push(
          createSchedulingAssignment({
            matchId,
            courtId: match.courtId,
            startTime: match.scheduledStart,
            endTime: match.scheduledEnd,
            slotId: match.slot !== undefined ? String(match.slot) : undefined,
            refereeId: match.refereeId,
            status: isBye ? ASSIGNMENT_STATUS.BYE : match.status,
            manualOverride: match.manualScheduleLock === true,
            source: "legacy_match",
          })
        );
      }
    } else if (!assignments.some((item) => item.matchId === matchId)) {
      assignments.push(
        createSchedulingAssignment({
          matchId,
          status: isBye ? ASSIGNMENT_STATUS.BYE : match.status || ASSIGNMENT_STATUS.UNASSIGNED,
          source: "legacy_match_stub",
        })
      );
    } else if (!isBye && match.status !== "cancelled") {
      unassigned.push(matchId);
    }
  });

  if (Array.isArray(obj.groups)) {
    obj.groups.forEach((group) => {
      const groupMatches = group.matches || [];
      rounds.push({
        roundId: String(group.id || group.label || ""),
        groupId: String(group.id || ""),
        matchIds: groupMatches.map((match) => String(match.id)),
      });
      groupMatches.forEach((match) => {
        if (matches.some((item) => item.matchId === String(match.id))) {
          return;
        }
        const matchId = String(match.id || "");
        matches.push(
          createSchedulingMatch({
            matchId,
            roundNumber: match.round,
            entryAId: match.entryAId,
            entryBId: match.entryBId,
            groupId: group.id,
            status: match.status,
            isBye: isByeParticipant(match.entryAId) || isByeParticipant(match.entryBId),
          })
        );
      });
    });
  }

  if (Array.isArray(obj.rounds)) {
    obj.rounds.forEach((round) => {
      rounds.push({
        roundId: `round-${round.roundNumber}`,
        roundNumber: round.roundNumber,
        matchIds: (round.matches || []).map((match) => String(match.matchId || match.id || "")),
      });
    });
  }

  return createSchedulingResult({
    ok: obj.ok !== false,
    rounds,
    matches,
    assignments,
    unassignedMatches: unassigned,
    byes,
    warnings: [...warnings, ...(Array.isArray(obj.warnings) ? obj.warnings : [])],
    errors: Array.isArray(obj.errors) ? obj.errors.map(String) : [],
    manualOverrides: request.manualOverrides || [],
    metadata: { roundCount: obj.roundCount, scope: request.metadata?.scope },
  });
}

/**
 * @param {import('./schedulingTypes.js').SchedulingResult} canonical
 */
export function mapCanonicalScheduleToLegacyAssignments(canonical) {
  return (canonical.assignments || []).map((assignment) => ({
    matchId: assignment.matchId,
    id: assignment.matchId,
    courtId: assignment.courtId,
    courtLabel: assignment.courtId,
    scheduledStart: assignment.startTime,
    scheduledEnd: assignment.endTime,
    slot: assignment.slotId,
    refereeId: assignment.refereeId,
    status: assignment.status,
    manualScheduleLock: assignment.manualOverride === true,
  }));
}

/**
 * @param {Record<string, unknown>} payload
 */
export function cloneLegacySchedulingPayload(payload = {}) {
  const cloned = JSON.parse(JSON.stringify(payload));
  if (payload.randomFn && typeof payload.randomFn === "function") {
    cloned.randomFn = payload.randomFn;
  }
  if (payload.options?.randomFn && typeof payload.options.randomFn === "function") {
    cloned.options = { ...(cloned.options || {}), randomFn: payload.options.randomFn };
  }
  return cloned;
}

/**
 * @param {unknown} legacyResult
 */
export function extractLegacySchedulingRows(legacyResult) {
  if (!legacyResult || typeof legacyResult !== "object") {
    return [];
  }
  const obj = /** @type {Record<string, unknown>} */ (legacyResult);
  if (Array.isArray(obj.matchups)) {
    return obj.matchups;
  }
  if (Array.isArray(obj.matches)) {
    return obj.matches;
  }
  if (Array.isArray(obj.data?.matches)) {
    return obj.data.matches;
  }
  if (Array.isArray(obj.assignments)) {
    return obj.assignments;
  }
  return [];
}
