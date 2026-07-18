/**
 * Daily Play → Competition Core adapters (Phase 2B.3).
 * Lives under features/daily-play for inventory clarity; Daily engine remains in src/tournament.
 * Shadow/mapping only — no queue/rotation policy in Core contracts.
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  PARTICIPANT_REFERENCE_KIND,
  COMPETITION_PARTICIPANT_STATUS,
  createCompetitionParticipant,
  createParticipantReference,
  createFormatExtension,
  validateCompetitionParticipant,
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

const SOURCE_VERSION = "daily-play-v1";
const FORMAT_KEY = "daily-play";

/**
 * @param {unknown} source
 * @returns {Record<string, unknown>|null}
 */
function asObject(source) {
  return source && typeof source === "object" && !Array.isArray(source) ? source : null;
}

/**
 * Player / member / walk-in guest → CompetitionParticipant (session-scoped).
 * Daily does not create CompetitionEntry (Phase 2B.1 design).
 *
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 */
export function mapDailyPlayerToParticipant(source, context = {}) {
  const before = cloneSourceSnapshot(source);
  const player = asObject(source);
  const diagnostics = [];
  const competitionId = String(
    context.competitionId ||
      context.tournamentId ||
      context.sessionId ||
      player?.tournamentId ||
      player?.competitionId ||
      player?.sessionId ||
      ""
  ).trim();

  if (!player?.id) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "id",
        message: "Daily player id required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "DailyPlayer",
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "DailyPlayer",
      sourceVersion: SOURCE_VERSION,
    });
  }

  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "session/tournament competitionId required for Daily participant",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "DailyPlayer",
        sourceId: String(player.id),
      })
    );
  }

  const person = resolvePersonReference(player);
  const isWalkIn =
    player.isWalkIn === true ||
    player.walkIn === true ||
    String(player.source || "").toLowerCase() === "walk_in";

  const value = createCompetitionParticipant({
    id: `cp:daily:${competitionId}:${player.id}`,
    competitionId,
    person,
    status: COMPETITION_PARTICIPANT_STATUS.ACTIVE,
    displayName: player.name || player.displayName || null,
    snapshot: buildPlayerSnapshot(player, {
      snapshotAt: context.snapshotAt || player.checkedInAt || null,
      clubId: context.clubId,
    }),
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        checkedIn: context.checkedIn === true || player.checkedIn === true,
        queueRef: context.queueParticipant === true ? `queue:${player.id}` : null,
        walkIn: isWalkIn,
        // Rotation/queue policy stays Format-owned — reference only
        queuePolicyRef: "daily-play:checkedInPlayerIds",
        playerType: player.playerType || null,
      },
    }),
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
          sourceType: "DailyPlayer",
          sourceId: String(player.id),
          metadata: { participantErrorCode: err.code },
        })
      );
    }
  }

  void before;
  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value,
    diagnostics,
    sourceType: "DailyPlayer",
    sourceId: String(player.id),
    sourceVersion: SOURCE_VERSION,
    targetSchemaVersion: PARTICIPANT_SCHEMA_VERSION,
  });
}

/**
 * checkedInPlayerIds + player map → CompetitionParticipant[]
 * @param {unknown} source — { checkedInPlayerIds, tournamentId } or settings-like
 * @param {Record<string, unknown>} [context]
 */
export function mapDailySessionParticipants(source, context = {}) {
  const session = asObject(source) || {};
  const diagnostics = [];
  const competitionId = String(
    context.competitionId || context.tournamentId || session.tournamentId || session.competitionId || ""
  ).trim();
  const ids = Array.isArray(session.checkedInPlayerIds)
    ? session.checkedInPlayerIds.map(String)
    : Array.isArray(context.checkedInPlayerIds)
      ? context.checkedInPlayerIds.map(String)
      : [];
  const playerById = context.playerById || session.playerById || {};

  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "Daily session competitionId required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "DailySession",
        sourceId: session.id ? String(session.id) : null,
      })
    );
  }

  /** @type {ReturnType<typeof createCompetitionParticipant>[]} */
  const participants = [];
  for (const id of ids) {
    const player = playerById[id] || { id };
    const result = mapDailyPlayerToParticipant(player, {
      competitionId,
      checkedIn: true,
      queueParticipant: true,
      clubId: context.clubId,
      snapshotAt: context.snapshotAt,
    });
    diagnostics.push(...result.diagnostics);
    if (result.success && result.value) participants.push(result.value);
  }

  return finalizeMappingResult({
    success: diagnostics.every((d) => d.severity !== MAPPING_DIAGNOSTIC_SEVERITY.ERROR),
    value: { participants, entry: null },
    diagnostics,
    sourceType: "DailySession",
    sourceId: session.id ? String(session.id) : competitionId || null,
    sourceVersion: SOURCE_VERSION,
  });
}

/**
 * Temporary match pair/team — ephemeral mapping only (not CompetitionTeam).
 * @param {unknown} source — match with teamAPlayerIds/teamBPlayerIds
 * @param {Record<string, unknown>} [context]
 */
export function mapDailyTemporaryPair(source, context = {}) {
  const match = asObject(source);
  const diagnostics = [];

  if (!match?.id) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_SOURCE_ID,
        path: "id",
        message: "Daily match id required for temporary pair mapping",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "DailyTemporaryPair",
      })
    );
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "DailyTemporaryPair",
      sourceVersion: SOURCE_VERSION,
    });
  }

  const competitionId = String(
    context.competitionId || context.tournamentId || match.tournamentId || ""
  ).trim();

  if (!competitionId) {
    diagnostics.push(
      createMappingDiagnostic({
        code: MAPPING_DIAGNOSTIC_CODE.MISSING_COMPETITION_ID,
        path: "competitionId",
        message: "competitionId required",
        severity: MAPPING_DIAGNOSTIC_SEVERITY.ERROR,
        sourceType: "DailyTemporaryPair",
        sourceId: String(match.id),
      })
    );
  }

  const sideA = (Array.isArray(match.teamAPlayerIds) ? match.teamAPlayerIds : []).map(String);
  const sideB = (Array.isArray(match.teamBPlayerIds) ? match.teamBPlayerIds : []).map(String);

  // Temporary mapping representation — NOT a CompetitionTeam / CompetitionEntry
  const value = {
    kind: "daily_temporary_pair",
    schemaVersion: PARTICIPANT_SCHEMA_VERSION,
    competitionId,
    matchId: String(match.id),
    sideA: sideA.map((id) =>
      createParticipantReference({
        kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
        id,
      })
    ),
    sideB: sideB.map((id) =>
      createParticipantReference({
        kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
        id,
      })
    ),
    extensions: createFormatExtension({
      formatKey: FORMAT_KEY,
      payload: {
        temporary: true,
        teamALabel: match.teamALabel || null,
        teamBLabel: match.teamBLabel || null,
        // Explicit: not persisted as canonical team
        notCompetitionTeam: true,
        notCompetitionEntry: true,
      },
    }),
  };

  if (diagnostics.some((d) => d.severity === MAPPING_DIAGNOSTIC_SEVERITY.ERROR)) {
    return finalizeMappingResult({
      success: false,
      diagnostics,
      sourceType: "DailyTemporaryPair",
      sourceId: String(match.id),
      sourceVersion: SOURCE_VERSION,
    });
  }

  return finalizeMappingResult({
    success: true,
    value,
    diagnostics,
    sourceType: "DailyTemporaryPair",
    sourceId: String(match.id),
    sourceVersion: SOURCE_VERSION,
  });
}

export function compareDailyPlayerParity(legacyPlayer, mappingResult) {
  if (!mappingResult?.success) {
    return [
      createParityFinding({
        dimension: "identity",
        classification: PARITY_CLASSIFICATION.MAPPING_FAILURE,
        path: "",
        message: "Daily player mapping failed",
      }),
    ];
  }
  const player = asObject(legacyPlayer) || {};
  const findings = compareIdentityParity({
    legacyPersonId: player.id,
    canonicalPersonId: mappingResult.value?.person?.id,
    guestOrExternal:
      player.playerType === "guest" ||
      player.isGuest === true ||
      player.isWalkIn === true ||
      player.playerType === "external",
    canonicalKind: mappingResult.value?.person?.kind,
  });

  if (mappingResult.value?.extensions?.payload?.queuePolicyRef) {
    findings.push(
      createParityFinding({
        dimension: "entry",
        classification: PARITY_CLASSIFICATION.EXPECTED_FORMAT_EXTENSION,
        path: "extensions.queuePolicyRef",
        message: "Queue/rotation policy kept Format-owned; no CompetitionEntry for Daily",
      })
    );
  }

  return findings;
}
