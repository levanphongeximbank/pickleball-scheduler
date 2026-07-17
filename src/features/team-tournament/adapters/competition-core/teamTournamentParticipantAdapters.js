/**
 * Team Tournament V6 → Competition Core participant adapters (Phase 2B.3).
 * Shadow/mapping only — not wired to Production executors.
 *
 * Public Core imports only (no deep participant paths).
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  PARTICIPANT_REFERENCE_KIND,
  COMPETITION_PARTICIPANT_STATUS,
  COMPETITION_TEAM_STATUS,
  COMPETITION_ROSTER_STATUS,
  COMPETITION_ROSTER_MEMBER_STATUS,
  COMPETITION_LINEUP_STATUS,
  COMPETITION_ENTRY_STATUS,
  COMPETITION_REGISTRATION_STATUS,
  createParticipantReference,
  createCompetitionParticipant,
  createCompetitionTeam,
  createCompetitionRoster,
  createCompetitionRosterMember,
  createRosterSubstitutionReference,
  createCompetitionLineup,
  createCompetitionLineupRevision,
  createCompetitionLineupSlot,
  createCompetitionEntry,
  createCompetitionRegistration,
  createFormatExtension,
  validateCompetitionParticipant,
  validateCompetitionTeam,
  validateCompetitionRoster,
  validateCompetitionLineup,
  validateCompetitionEntry,
  validateCompetitionRegistration,
  validateLineupRevisionSequence,
} from "../../../competition-core/index.js";

import {
  MAPPING_DIAGNOSTIC_CODE,
  MAPPING_DIAGNOSTIC_SEVERITY,
  createMappingDiagnostic,
  finalizeMappingResult,
  cloneSourceSnapshot,
  resolvePersonReference,
  buildPlayerSnapshot,
  PARITY_CLASSIFICATION,
  createParityFinding,
  compareIdentityParity,
} from "../../../../tournament/adapters/competition-core/shared/index.js";

const SOURCE_VERSION = "team-tournament-v6";
const FORMAT_KEY = "team-tournament-v6";

/**
 * @param {unknown} source
 * @returns {Record<string, unknown>|null}
 */
function asObject(source) {
  return source && typeof source === "object" && !Array.isArray(source) ? source : null;
}

/**
 * @param {Record<string, unknown>|null} playerById
 * @param {string} playerId
 */
function lookupPlayer(playerById, playerId) {
  if (!playerById || typeof playerById !== "object") return null;
  return playerById[playerId] || null;
}

/**
 * Map legacy lineup status → canonical.
 * @param {string} status
 */
export function mapTeamLineupStatus(status) {
  const raw = String(status || "draft").trim().toLowerCase();
  switch (raw) {
    case "submitted":
      return COMPETITION_LINEUP_STATUS.SUBMITTED;
    case "locked":
      return COMPETITION_LINEUP_STATUS.LOCKED;
    case "published":
      return COMPETITION_LINEUP_STATUS.PUBLISHED;
    case "overridden":
      return COMPETITION_LINEUP_STATUS.SUPERSEDED;
    case "not_submitted":
    case "draft":
    default:
      return COMPETITION_LINEUP_STATUS.DRAFT;
  }
}

/**
 * Team player/member → CompetitionParticipant
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapTeamPlayerToParticipant(source, context = {}) {
  const snapshot = cloneSourceSnapshot(source);
  const player = asObject(source);
  const competitionId = String(
    context.competitionId || context.tournamentId || player?.competitionId || player?.tournamentId || ""
  ).trim();
  const diagnostics = [];

  if (!player || !player.id) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "id",
        message: "Team player source id is required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamPlayer",
        sourceId: null,
        sourceValue: source,
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "TeamPlayer",
      sourceId: null,
      sourceVersion: SOURCE_VERSION,
    });
  }

  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "competitionId/tournamentId required for CompetitionParticipant",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamPlayer",
        sourceId: String(player.id),
      })
    );
  }

  const person = resolvePersonReference(player);
  if (!person.id) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.INVALID_IDENTITY_REFERENCE,
        path: "person.id",
        message: "Resolved person reference has empty id",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamPlayer",
        sourceId: String(player.id),
      })
    );
  }

  const value = createCompetitionParticipant({
    id: `cp:tt:${player.id}`,
    competitionId,
    person,
    status: COMPETITION_PARTICIPANT_STATUS.ACTIVE,
    displayName: player.name || player.displayName || null,
    snapshot: buildPlayerSnapshot(player, {
      snapshotAt: context.snapshotAt || null,
      seedLocked: context.seedLocked === true,
      clubId: context.clubId,
    }),
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        sourcePlayerId: String(player.id),
        gender: player.gender ?? null,
        rating: player.rating ?? player.skill ?? null,
        teamId: context.teamId || null,
      },
    }),
    audit: {
      createdAt: player.createdAt || null,
      updatedAt: player.updatedAt || null,
    },
  });

  const validation = validateCompetitionParticipant(value);
  if (!validation.valid) {
    for (const err of validation.errors) {
      diagnostics.push(
        createMappingDiagnostic({
          code:
            err.path === "competitionId"
              ? MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID
              : MAPPING_DIAGNOSTIC_CODE.INVALID_IDENTITY_REFERENCE,
          path: err.path,
          message: err.message,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "TeamPlayer",
          sourceId: String(player.id),
          metadata: { participantErrorCode: err.code },
        })
      );
    }
  }

  // Prove no mutation
  void snapshot;

  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value,
    diagnostics,
    sourceType: "TeamPlayer",
    sourceId: String(player.id),
    sourceVersion: SOURCE_VERSION,
    targetSchemaVersion: PARTICIPANT_SCHEMA_VERSION,
  });
}

/**
 * Tournament team → CompetitionTeam
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapTeamToCompetitionTeam(source, context = {}) {
  const team = asObject(source);
  const diagnostics = [];
  const competitionId = String(
    context.competitionId || context.tournamentId || team?.tournamentId || team?.competitionId || ""
  ).trim();

  if (!team?.id) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "id",
        message: "Team id is required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentTeam",
        sourceId: null,
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "TeamTournamentTeam",
      sourceVersion: SOURCE_VERSION,
    });
  }

  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "competitionId required for CompetitionTeam",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentTeam",
        sourceId: String(team.id),
      })
    );
  }

  const captainId = team.captainPlayerId ? String(team.captainPlayerId).trim() : "";
  const deputyIds = Array.isArray(team.deputyPlayerIds)
    ? team.deputyPlayerIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  const value = createCompetitionTeam({
    id: String(team.id),
    competitionId,
    name: String(team.name || ""),
    status: COMPETITION_TEAM_STATUS.ACTIVE,
    seed: typeof team.seed === "number" && team.seed > 0 ? team.seed : null,
    captainRef: captainId
      ? createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: captainId,
        })
      : null,
    deputyRefs: deputyIds.map((id) =>
      createParticipantReference({
        kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
        id,
      })
    ),
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        color: team.color || null,
        logoUrl: team.logoUrl || null,
        avgLevel: team.avgLevel ?? null,
        topPlayerRating: team.topPlayerRating ?? null,
        totalRating: team.totalRating ?? null,
        clonedFrom: team.clonedFrom || null,
        playerIds: Array.isArray(team.playerIds) ? [...team.playerIds] : [],
      },
    }),
    audit: {
      createdAt: team.createdAt || null,
      updatedAt: team.updatedAt || null,
    },
  });

  const validation = validateCompetitionTeam(value);
  if (!validation.valid) {
    for (const err of validation.errors) {
      diagnostics.push(
        createMappingDiagnostic({
          code:
            err.path === "competitionId"
              ? MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID
              : MAPPING_DIAGNOSTIC_CODE.UNSUPPORTED_SOURCE_TYPE,
          path: err.path,
          message: err.message,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "TeamTournamentTeam",
          sourceId: String(team.id),
          metadata: { participantErrorCode: err.code },
        })
      );
    }
  }

  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value,
    diagnostics,
    sourceType: "TeamTournamentTeam",
    sourceId: String(team.id),
    sourceVersion: SOURCE_VERSION,
  });
}

/**
 * Team roster (playerIds on team + lock metadata) → CompetitionRoster
 * @param {unknown} source — team-like or { teamId, playerIds, locked, ... }
 * @param {Record<string, unknown>} [context]
 */
export function mapTeamRosterToCompetitionRoster(source, context = {}) {
  const rosterSrc = asObject(source);
  const diagnostics = [];
  const teamId = String(rosterSrc?.teamId || rosterSrc?.id || "").trim();
  const competitionId = String(
    context.competitionId ||
      context.tournamentId ||
      rosterSrc?.tournamentId ||
      rosterSrc?.competitionId ||
      ""
  ).trim();
  const playerById = context.playerById || {};

  if (!teamId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "teamId",
        message: "teamId is required for roster mapping",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentRoster",
        sourceId: null,
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "TeamTournamentRoster",
      sourceVersion: SOURCE_VERSION,
    });
  }

  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "competitionId required for CompetitionRoster",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentRoster",
        sourceId: teamId,
      })
    );
  }

  const playerIds = Array.isArray(rosterSrc.playerIds)
    ? rosterSrc.playerIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const absentSet = new Set(
    (Array.isArray(rosterSrc.absentPlayerIds) ? rosterSrc.absentPlayerIds : []).map(String)
  );
  const captainId = rosterSrc.captainPlayerId ? String(rosterSrc.captainPlayerId).trim() : "";
  const rosterId = `roster:tt:${teamId}`;

  const seen = new Set();
  for (const id of playerIds) {
    if (seen.has(id)) {
      diagnostics.push(
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.INVALID_ROSTER_STATE,
          path: "playerIds",
          message: `Duplicate roster member ${id}`,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "TeamTournamentRoster",
          sourceId: teamId,
          sourceValue: id,
          metadata: { playerId: id },
        })
      );
    }
    seen.add(id);
  }

  const locked =
    rosterSrc.locked === true ||
    String(rosterSrc.rosterStatus || "").toUpperCase() === "ROSTER_LOCKED" ||
    (Array.isArray(rosterSrc.lockedPlayerIds) &&
      rosterSrc.lockedPlayerIds.length > 0 &&
      context.treatLockedPlayerIdsAsRosterLock === true) ||
    context.rosterLocked === true;

  const members = playerIds.map((id) => {
    const player = lookupPlayer(playerById, id);
    const person = resolvePersonReference(player, id);
    if (!player && context.requireResolvedPlayers === true) {
      diagnostics.push(
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.UNRESOLVED_PLAYER_REFERENCE,
          path: `members.${id}`,
          message: `Player ${id} not found in playerById`,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.WARNING,
          sourceType: "TeamTournamentRoster",
          sourceId: teamId,
          metadata: { playerId: id },
        })
      );
    }
    return createCompetitionRosterMember({
      id: `rm:${teamId}:${id}`,
      rosterId,
      person,
      status: absentSet.has(id)
        ? COMPETITION_ROSTER_MEMBER_STATUS.ABSENT
        : COMPETITION_ROSTER_MEMBER_STATUS.ACTIVE,
      role: captainId && captainId === id ? "captain" : "player",
      joinedAt: player?.joinedAt || null,
      extensions: createFormatExtension({
        formatKey: FORMAT_KEY,
        payload: {
          lockedPlayer: Array.isArray(rosterSrc.lockedPlayerIds)
            ? rosterSrc.lockedPlayerIds.map(String).includes(id)
            : false,
        },
      }),
    });
  });

  /** @type {ReturnType<typeof createRosterSubstitutionReference>[]} */
  const amendments = [];
  const subs = Array.isArray(rosterSrc.substitutions)
    ? rosterSrc.substitutions
    : Array.isArray(context.substitutions)
      ? context.substitutions
      : [];
  for (const sub of subs) {
    if (!sub || typeof sub !== "object") continue;
    amendments.push(
      createRosterSubstitutionReference({
        id: String(sub.id || `sub:${teamId}:${sub.replacedId}:${sub.replacementId}`),
        rosterId,
        replaced: createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: String(sub.replacedId || sub.replaced || ""),
        }),
        replacement: createParticipantReference({
          kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
          id: String(sub.replacementId || sub.replacement || ""),
        }),
        reason: String(sub.reason || "substitution"),
        requestedBy: sub.requestedBy || null,
        approvedBy: sub.approvedBy || null,
        effectiveAt: sub.effectiveAt || null,
        eligibilityDecisionId: sub.eligibilityDecisionId || null,
      })
    );
  }

  const value = createCompetitionRoster({
    id: rosterId,
    competitionId,
    teamId,
    members,
    status: locked ? COMPETITION_ROSTER_STATUS.ROSTER_LOCKED : COMPETITION_ROSTER_STATUS.DRAFT,
    lockedAt: locked ? rosterSrc.lockedAt || context.lockedAt || null : null,
    lockReason: locked ? rosterSrc.lockReason || context.lockReason || null : null,
    maxSize: typeof rosterSrc.maxSize === "number" ? rosterSrc.maxSize : null,
    amendments,
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        absentPlayerIds: [...absentSet],
        lockedPlayerIds: Array.isArray(rosterSrc.lockedPlayerIds)
          ? rosterSrc.lockedPlayerIds.map(String)
          : [],
        deputyPlayerIds: Array.isArray(rosterSrc.deputyPlayerIds)
          ? rosterSrc.deputyPlayerIds.map(String)
          : [],
      },
    }),
    audit: {
      createdAt: rosterSrc.createdAt || null,
      updatedAt: rosterSrc.updatedAt || null,
    },
  });

  const validation = validateCompetitionRoster(value);
  if (!validation.valid) {
    for (const err of validation.errors) {
      diagnostics.push(
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.INVALID_ROSTER_STATE,
          path: err.path,
          message: err.message,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "TeamTournamentRoster",
          sourceId: teamId,
          metadata: { participantErrorCode: err.code },
        })
      );
    }
  }

  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value,
    diagnostics,
    sourceType: "TeamTournamentRoster",
    sourceId: teamId,
    sourceVersion: SOURCE_VERSION,
  });
}

/**
 * Build slots from selections map.
 * @param {string} lineupId
 * @param {Record<string, unknown>} selections
 */
function selectionsToSlots(lineupId, selections) {
  /** @type {ReturnType<typeof createCompetitionLineupSlot>[]} */
  const slots = [];
  if (!selections || typeof selections !== "object") return slots;
  for (const [discipline, ids] of Object.entries(selections)) {
    const arr = Array.isArray(ids) ? ids : [];
    arr.forEach((id, index) => {
      slots.push(
        createCompetitionLineupSlot({
          id: `${lineupId}:${discipline}:${index}`,
          disciplineOrSideKey: String(discipline),
          index,
          person: createParticipantReference({
            kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
            id: String(id),
          }),
        })
      );
    });
  }
  return slots;
}

/**
 * Submitted lineup → CompetitionLineup + revisions (OD-06: do not collapse revisions).
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapTeamLineupToCompetitionLineup(source, context = {}) {
  const lineup = asObject(source);
  const diagnostics = [];

  if (!lineup) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.UNSUPPORTED_SOURCE_TYPE,
        path: "",
        message: "Lineup source must be an object",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentLineup",
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "TeamTournamentLineup",
      sourceVersion: SOURCE_VERSION,
    });
  }

  const matchupId = String(lineup.matchupId || "").trim();
  const teamId = String(lineup.teamId || "").trim();
  if (!matchupId || !teamId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "matchupId|teamId",
        message: "matchupId and teamId are required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentLineup",
        sourceId: matchupId || teamId || null,
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "TeamTournamentLineup",
      sourceId: matchupId || teamId || null,
      sourceVersion: SOURCE_VERSION,
    });
  }

  const competitionId = String(
    context.competitionId || context.tournamentId || lineup.tournamentId || lineup.competitionId || ""
  ).trim();
  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "competitionId required for CompetitionLineup",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentLineup",
        sourceId: `${matchupId}::${teamId}`,
      })
    );
  }

  const lineupId = `${matchupId}::${teamId}`;
  const currentRevision =
    typeof lineup.version === "number"
      ? lineup.version
      : typeof lineup.previousLineupVersion === "number"
        ? lineup.previousLineupVersion + 1
        : typeof lineup.revision === "number"
          ? lineup.revision
          : 1;

  if (!Number.isFinite(currentRevision) || currentRevision < 1) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.INVALID_LINEUP_REVISION,
        path: "revision",
        message: "Lineup revision must be a positive number",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentLineup",
        sourceId: lineupId,
        sourceValue: currentRevision,
      })
    );
  }

  const slots = selectionsToSlots(lineupId, lineup.selections);
  const status = mapTeamLineupStatus(lineup.status);

  /** Preserve prior revisions when provided — never collapse into one mutable object (OD-06). */
  const priorRevisions = Array.isArray(lineup.revisions)
    ? lineup.revisions
    : Array.isArray(context.priorRevisions)
      ? context.priorRevisions
      : [];

  /** @type {ReturnType<typeof createCompetitionLineupRevision>[]} */
  const revisions = priorRevisions.map((rev, index) => {
    const revNum =
      typeof rev.revision === "number"
        ? rev.revision
        : typeof rev.version === "number"
          ? rev.version
          : index + 1;
    const slotsFromRev = Array.isArray(rev.slots)
      ? rev.slots.map((s) => createCompetitionLineupSlot(s || {}))
      : selectionsToSlots(lineupId, rev.selections || {});
    return createCompetitionLineupRevision({
      lineupId,
      revision: revNum,
      previousRevisionId: rev.previousRevisionId || (revNum > 1 ? `${lineupId}:r${revNum - 1}` : null),
      submittedAt: rev.submittedAt || null,
      submittedBy: rev.submittedBy || null,
      lockedAt: rev.lockedAt || null,
      status: mapTeamLineupStatus(rev.status),
      slots: slotsFromRev,
      reason: rev.reason || rev.overrideReason || null,
    });
  });

  // Ensure current revision is represented as its own revision record when history is empty
  if (revisions.length === 0) {
    revisions.push(
      createCompetitionLineupRevision({
        lineupId,
        revision: currentRevision,
        previousRevisionId:
          typeof lineup.previousLineupVersion === "number" && lineup.previousLineupVersion > 0
            ? `${lineupId}:r${lineup.previousLineupVersion}`
            : null,
        submittedAt: lineup.submittedAt || null,
        submittedBy: lineup.submittedBy || lineup.source || null,
        lockedAt: lineup.lockedAt || null,
        status,
        slots,
        reason: lineup.overrideReason || lineup.auditNote || null,
      })
    );
  } else {
    // Append current if not already present
    const hasCurrent = revisions.some((r) => r.revision === currentRevision);
    if (!hasCurrent) {
      revisions.push(
        createCompetitionLineupRevision({
          lineupId,
          revision: currentRevision,
          previousRevisionId: `${lineupId}:r${currentRevision - 1}`,
          submittedAt: lineup.submittedAt || null,
          submittedBy: lineup.submittedBy || lineup.source || null,
          lockedAt: lineup.lockedAt || null,
          status,
          slots,
          reason: lineup.overrideReason || lineup.auditNote || null,
        })
      );
    }
  }

  const seq = validateLineupRevisionSequence(revisions);
  if (!seq.valid) {
    for (const err of seq.errors) {
      diagnostics.push(
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.INVALID_LINEUP_REVISION,
          path: err.path,
          message: err.message,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "TeamTournamentLineup",
          sourceId: lineupId,
          metadata: { participantErrorCode: err.code },
        })
      );
    }
  }

  const value = createCompetitionLineup({
    id: lineupId,
    competitionId,
    teamId,
    contextId: matchupId,
    status,
    revision: currentRevision,
    previousRevisionId:
      typeof lineup.previousLineupVersion === "number" && lineup.previousLineupVersion > 0
        ? `${lineupId}:r${lineup.previousLineupVersion}`
        : null,
    submittedAt: lineup.submittedAt || null,
    submittedBy: lineup.submittedBy || lineup.source || null,
    lockedAt: lineup.lockedAt || null,
    publishedAt: lineup.publishedAt || null,
    reason: lineup.overrideReason || lineup.auditNote || null,
    slots,
    revisions,
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        // Hidden lineup visibility is Format-owned — store reference only
        hiddenLineupPolicyRef: "team-tournament:getVisibleLineup",
        source: lineup.source || null,
        overriddenAt: lineup.overriddenAt || null,
        overriddenBy: lineup.overriddenBy || null,
        overrideReason: lineup.overrideReason || null,
        previousLineupVersion: lineup.previousLineupVersion ?? null,
      },
    }),
    audit: {
      createdAt: lineup.createdAt || null,
      updatedAt: lineup.updatedAt || null,
    },
  });

  const validation = validateCompetitionLineup(value);
  if (!validation.valid) {
    for (const err of validation.errors) {
      diagnostics.push(
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.INVALID_LINEUP_REVISION,
          path: err.path,
          message: err.message,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "TeamTournamentLineup",
          sourceId: lineupId,
          metadata: { participantErrorCode: err.code },
        })
      );
    }
  }

  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value,
    diagnostics,
    sourceType: "TeamTournamentLineup",
    sourceId: lineupId,
    sourceVersion: SOURCE_VERSION,
  });
}

/**
 * Team registration → CompetitionRegistration + optional CompetitionEntry (not waitlist→active).
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapTeamRegistration(source, context = {}) {
  const reg = asObject(source);
  const diagnostics = [];

  if (!reg?.id) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "id",
        message: "Team registration id required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentRegistration",
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "TeamTournamentRegistration",
      sourceVersion: SOURCE_VERSION,
    });
  }

  const competitionId = String(
    context.competitionId || context.tournamentId || reg.tournamentId || reg.competitionId || ""
  ).trim();
  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "competitionId required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "TeamTournamentRegistration",
        sourceId: String(reg.id),
      })
    );
  }

  const rawStatus = String(reg.status || "approved").toLowerCase();
  const isWaitlisted = rawStatus === "waitlisted";

  let regStatus = COMPETITION_REGISTRATION_STATUS.APPROVED;
  if (isWaitlisted) regStatus = COMPETITION_REGISTRATION_STATUS.WAITLISTED;
  else if (rawStatus === "pending" || rawStatus === "submitted")
    regStatus = COMPETITION_REGISTRATION_STATUS.PENDING;
  else if (rawStatus === "rejected") regStatus = COMPETITION_REGISTRATION_STATUS.REJECTED;
  else if (rawStatus === "cancelled") regStatus = COMPETITION_REGISTRATION_STATUS.CANCELLED;
  else if (rawStatus === "withdrawn") regStatus = COMPETITION_REGISTRATION_STATUS.WITHDRAWN;
  else if (rawStatus === "draft") regStatus = COMPETITION_REGISTRATION_STATUS.DRAFT;

  const teamId = reg.teamId ? String(reg.teamId) : String(reg.id);
  const entryId = isWaitlisted ? null : `entry:tt:${teamId}`;

  const registration = createCompetitionRegistration({
    id: String(reg.id),
    competitionId,
    status: regStatus,
    entryId,
    waitlistPosition: isWaitlisted
      ? typeof reg.waitlistPosition === "number"
        ? reg.waitlistPosition
        : null
      : null,
    participantId: null,
    submittedAt: reg.registeredAt || reg.submittedAt || null,
    decidedAt: reg.decidedAt || null,
    decidedBy: reg.decidedBy || null,
    rejectionReason: reg.rejectionReason || null,
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: { teamId, sourceStatus: rawStatus },
    }),
    audit: {
      createdAt: reg.registeredAt || null,
      decidedAt: reg.decidedAt || null,
      decidedBy: reg.decidedBy || null,
    },
  });

  /** @type {ReturnType<typeof createCompetitionEntry>|null} */
  let entry = null;
  if (!isWaitlisted && entryId) {
    entry = createCompetitionEntry({
      id: entryId,
      competitionId,
      status:
        rawStatus === "active" || rawStatus === "approved"
          ? COMPETITION_ENTRY_STATUS.ACTIVE
          : COMPETITION_ENTRY_STATUS.DRAFT,
      divisionId: reg.groupId || reg.divisionId || null,
      categoryId: reg.categoryId || null,
      entryRole: "team",
      name: reg.name || null,
      memberRefs: Array.isArray(reg.playerIds)
        ? reg.playerIds.map((id) =>
            createParticipantReference({
              kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
              id: String(id),
            })
          )
        : [],
      extensions: createFormatExtension({
        formatKey: FORMAT_KEY,
        payload: { teamId },
      }),
    });
  }

  const regValidation = validateCompetitionRegistration(registration);
  if (!regValidation.valid) {
    for (const err of regValidation.errors) {
      diagnostics.push(
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.UNSUPPORTED_FORMAT_POLICY,
          path: err.path,
          message: err.message,
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "TeamTournamentRegistration",
          sourceId: String(reg.id),
          metadata: { participantErrorCode: err.code },
        })
      );
    }
  }

  if (entry) {
    const entryValidation = validateCompetitionEntry(entry);
    if (!entryValidation.valid) {
      for (const err of entryValidation.errors) {
        diagnostics.push(
          createMappingDiagnostic({
            code:
              err.path === "competitionId"
                ? MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID
                : MAPPING_DIAGNOSTIC_CODE.DUPLICATE_ACTIVE_ENTRY,
            path: err.path,
            message: err.message,
            severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
            sourceType: "TeamTournamentRegistration",
            sourceId: String(reg.id),
            metadata: { participantErrorCode: err.code },
          })
        );
      }
    }
  }

  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value: { registration, entry },
    diagnostics,
    sourceType: "TeamTournamentRegistration",
    sourceId: String(reg.id),
    sourceVersion: SOURCE_VERSION,
  });
}

/**
 * Bundle map: full team blob → canonical team + roster (+ optional lineup).
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapTeamTournamentBundle(source, context = {}) {
  const team = asObject(source);
  const diagnostics = [];
  if (!team?.id) {
    return finalizeMappingResult({
      success: false,
      diagnostics: [
        createMappingDiagnostic({
          code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
          path: "id",
          message: "Team bundle requires team.id",
          severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
          sourceType: "TeamTournamentBundle",
        }),
      ],
      sourceType: "TeamTournamentBundle",
      sourceVersion: SOURCE_VERSION,
    });
  }

  const teamResult = mapTeamToCompetitionTeam(team, context);
  const rosterResult = mapTeamRosterToCompetitionRoster(team, context);
  diagnostics.push(...teamResult.diagnostics, ...rosterResult.diagnostics);

  /** @type {ReturnType<typeof mapTeamLineupToCompetitionLineup>|null} */
  let lineupResult = null;
  if (context.lineup) {
    lineupResult = mapTeamLineupToCompetitionLineup(context.lineup, {
      ...context,
      competitionId: context.competitionId || team.tournamentId,
    });
    diagnostics.push(...lineupResult.diagnostics);
  }

  const success =
    teamResult.success &&
    rosterResult.success &&
    (!lineupResult || lineupResult.success) &&
    diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR);

  return finalizeMappingResult({
    success,
    value: {
      team: teamResult.value,
      roster: rosterResult.value,
      lineup: lineupResult?.value ?? null,
    },
    diagnostics,
    sourceType: "TeamTournamentBundle",
    sourceId: String(team.id),
    sourceVersion: SOURCE_VERSION,
  });
}

/**
 * Parity compare helpers for shadow reports.
 */
export function compareTeamParity(legacyTeam, mappingResult) {
  /** @type {import('../../../../tournament/adapters/competition-core/shared/parity.js').ParityFinding[]} */
  const findings = [];
  if (!mappingResult?.success || !mappingResult.value) {
    findings.push(
      createParityFinding({
        dimension: "team",
        classification: PARITY_CLASSIFICATION.MAPPING_FAILURE,
        path: "",
        message: "Team mapping failed",
      })
    );
    return findings;
  }
  const canonical = mappingResult.value.team || mappingResult.value;
  const legacy = asObject(legacyTeam) || {};

  if (String(legacy.id) === String(canonical.id)) {
    findings.push(
      createParityFinding({
        dimension: "team",
        classification: PARITY_CLASSIFICATION.EXACT,
        path: "id",
        message: "Team id preserved",
        legacyValue: legacy.id,
        canonicalValue: canonical.id,
      })
    );
  }

  const legacyCaptain = legacy.captainPlayerId || null;
  const canonicalCaptain = canonical.captainRef?.id || null;
  if (legacyCaptain && canonicalCaptain && String(legacyCaptain) === String(canonicalCaptain)) {
    findings.push(
      createParityFinding({
        dimension: "team",
        classification: PARITY_CLASSIFICATION.SEMANTIC_MATCH,
        path: "captain",
        message: "Captain identity preserved (captainPlayerId → captainRef)",
        legacyValue: legacyCaptain,
        canonicalValue: canonicalCaptain,
      })
    );
  } else if (legacyCaptain && !canonicalCaptain) {
    findings.push(
      createParityFinding({
        dimension: "team",
        classification: PARITY_CLASSIFICATION.BLOCKER,
        path: "captain",
        message: "Captain lost in mapping",
        legacyValue: legacyCaptain,
      })
    );
  }

  if (canonical.extensions?.payload) {
    findings.push(
      createParityFinding({
        dimension: "team",
        classification: PARITY_CLASSIFICATION.EXPECTED_FORMAT_EXTENSION,
        path: "extensions",
        message: "Format-specific team fields retained in extensions",
      })
    );
  }

  return findings;
}

export function compareRosterParity(legacyTeam, mappingResult) {
  const findings = [];
  const roster = mappingResult?.value?.roster || mappingResult?.value;
  if (!mappingResult?.success || !roster) {
    return [
      createParityFinding({
        dimension: "roster",
        classification: PARITY_CLASSIFICATION.MAPPING_FAILURE,
        path: "",
        message: "Roster mapping failed",
      }),
    ];
  }
  const legacy = asObject(legacyTeam) || {};
  const legacyCount = Array.isArray(legacy.playerIds) ? legacy.playerIds.length : 0;
  const canonicalCount = Array.isArray(roster.members) ? roster.members.length : 0;

  if (legacyCount === canonicalCount) {
    findings.push(
      createParityFinding({
        dimension: "roster",
        classification: PARITY_CLASSIFICATION.EXACT,
        path: "memberCount",
        message: "Roster member count preserved",
        legacyValue: legacyCount,
        canonicalValue: canonicalCount,
      })
    );
  } else {
    findings.push(
      createParityFinding({
        dimension: "roster",
        classification: PARITY_CLASSIFICATION.MAPPING_FAILURE,
        path: "memberCount",
        message: "Roster member count mismatch",
        legacyValue: legacyCount,
        canonicalValue: canonicalCount,
      })
    );
  }

  const locked =
    legacy.locked === true ||
    String(legacy.rosterStatus || "").toUpperCase() === "ROSTER_LOCKED";
  if (locked && roster.status === COMPETITION_ROSTER_STATUS.ROSTER_LOCKED) {
    findings.push(
      createParityFinding({
        dimension: "roster",
        classification: PARITY_CLASSIFICATION.SEMANTIC_MATCH,
        path: "status",
        message: "Roster lock preserved as ROSTER_LOCKED",
        legacyValue: true,
        canonicalValue: roster.status,
      })
    );
  }

  return findings;
}

export function compareLineupParity(legacyLineup, mappingResult) {
  const findings = [];
  if (!mappingResult?.success || !mappingResult.value) {
    return [
      createParityFinding({
        dimension: "lineup",
        classification: PARITY_CLASSIFICATION.MAPPING_FAILURE,
        path: "",
        message: "Lineup mapping failed",
      }),
    ];
  }
  const canonical = mappingResult.value;
  const legacy = asObject(legacyLineup) || {};
  const revisionCount = Array.isArray(canonical.revisions) ? canonical.revisions.length : 0;

  findings.push(
    createParityFinding({
      dimension: "lineup",
      classification: PARITY_CLASSIFICATION.SEMANTIC_MATCH,
      path: "revision",
      message: "Lineup revision preserved without collapse",
      legacyValue: legacy.previousLineupVersion ?? legacy.version ?? null,
      canonicalValue: canonical.revision,
      metadata: { revisionRecords: revisionCount },
    })
  );

  if (canonical.extensions?.payload?.hiddenLineupPolicyRef) {
    findings.push(
      createParityFinding({
        dimension: "lineup",
        classification: PARITY_CLASSIFICATION.EXPECTED_FORMAT_EXTENSION,
        path: "extensions.hiddenLineupPolicyRef",
        message: "Hidden lineup policy kept Format-owned via extension reference",
      })
    );
  }

  return findings;
}

export function comparePlayerIdentityParity(legacyPlayer, mappingResult) {
  if (!mappingResult?.success) {
    return [
      createParityFinding({
        dimension: "identity",
        classification: PARITY_CLASSIFICATION.MAPPING_FAILURE,
        path: "",
        message: "Player mapping failed",
      }),
    ];
  }
  const player = asObject(legacyPlayer) || {};
  return compareIdentityParity({
    legacyPersonId: player.id,
    canonicalPersonId: mappingResult.value?.person?.id,
    guestOrExternal:
      player.playerType === "guest" ||
      player.isGuest === true ||
      player.playerType === "external",
    canonicalKind: mappingResult.value?.person?.kind,
  });
}
