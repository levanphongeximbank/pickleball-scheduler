/**
 * Phase 3D — Legacy TT team → CompetitionTeam (map-only).
 */

import {
  createCompetitionTeam,
} from "../../participants/contracts/teamRosterLineup.js";
import {
  createFormatExtension,
  cloneJsonSafe,
} from "../../participants/contracts/shared.js";
import { createParticipantReference } from "../../participants/contracts/identity.js";
import { TEAM_SOURCE_TYPE } from "../enums/teamSourceTypes.js";
import { buildTeamIdentityKey } from "../contracts/teamIdentity.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";
import { mapLegacyTeamStatus } from "./statusMapper.js";
import { resolvePersonReferenceFromPlayer } from "./memberRefs.js";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export function isLegacyTeamSource(source, context = {}) {
  if (!source || typeof source !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (source);
  const explicit =
    s.__sourceType || context.sourceType || context.__sourceType || null;
  if (
    explicit === TEAM_SOURCE_TYPE.LEGACY_ROSTER ||
    explicit === "LEGACY_ROSTER"
  ) {
    return false;
  }
  if (
    explicit === TEAM_SOURCE_TYPE.LEGACY_TEAM ||
    explicit === "LEGACY_TEAM" ||
    explicit === "TEAM"
  ) {
    return s.id != null;
  }
  // Shape: TT team record
  if (s.id != null && (Array.isArray(s.playerIds) || s.name != null || s.captainPlayerId != null)) {
    return true;
  }
  if (s.id != null && context.preferTeam === true) return true;
  return false;
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam}
 */
export function mapLegacyTeamToCompetitionTeam(source, context = {}) {
  if (!source || typeof source !== "object") {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM_SOURCE,
      "Legacy team source must be an object",
      {}
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (source);
  const teamId = String(raw.id || "").trim();
  if (!teamId) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM_SOURCE,
      "Legacy team id is required",
      {}
    );
  }

  const competitionId = String(
    context.competitionId ||
      raw.competitionId ||
      raw.tournamentId ||
      ""
  ).trim();
  if (!competitionId) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM_MAPPING,
      "competitionId is required for CompetitionTeam",
      { teamId }
    );
  }

  const playerById =
    context.playerById && typeof context.playerById === "object"
      ? context.playerById
      : {};

  const captainId = raw.captainPlayerId
    ? String(raw.captainPlayerId).trim()
    : "";
  let captainRef = null;
  if (captainId) {
    if (context.captainRef && typeof context.captainRef === "object") {
      captainRef = createParticipantReference(context.captainRef);
    } else {
      captainRef = resolvePersonReferenceFromPlayer(
        playerById[captainId] || { id: captainId },
        captainId
      );
    }
  }

  const deputyIds = Array.isArray(raw.deputyPlayerIds)
    ? raw.deputyPlayerIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const deputyRefs = Array.isArray(context.deputyRefs)
    ? context.deputyRefs.map((r) => createParticipantReference(r || {}))
    : deputyIds.map((id) =>
        resolvePersonReferenceFromPlayer(playerById[id] || { id }, id)
      );

  const identityKey = buildTeamIdentityKey({
    competitionId,
    stableTeamId: teamId,
  });

  const snapshot = /** @type {Record<string, unknown>} */ (
    cloneJsonSafe({
      id: raw.id,
      name: raw.name,
      color: raw.color,
      logoUrl: raw.logoUrl,
      playerIds: raw.playerIds,
      captainPlayerId: raw.captainPlayerId,
      deputyPlayerIds: raw.deputyPlayerIds,
      seed: raw.seed,
      avgLevel: raw.avgLevel,
      topPlayerRating: raw.topPlayerRating,
      totalRating: raw.totalRating,
      clonedFrom: raw.clonedFrom,
      status: raw.status,
    })
  );

  return createCompetitionTeam({
    id: teamId,
    competitionId,
    name: String(raw.name || ""),
    status: mapLegacyTeamStatus(raw.status, {
      defaultStatus: "ACTIVE",
    }),
    seed:
      typeof raw.seed === "number" && raw.seed > 0
        ? raw.seed
        : Number(raw.seed) > 0
          ? Number(raw.seed)
          : null,
    captainRef,
    deputyRefs,
    identityKey,
    extensions: createFormatExtension({
      formatKey: String(context.formatKey || "team-tournament-v6"),
      payload: {
        sourceType: TEAM_SOURCE_TYPE.LEGACY_TEAM,
        sourceSnapshot: snapshot,
        color: raw.color || null,
        logoUrl: raw.logoUrl || null,
        avgLevel: raw.avgLevel ?? null,
        topPlayerRating: raw.topPlayerRating ?? null,
        totalRating: raw.totalRating ?? null,
        clonedFrom: raw.clonedFrom || null,
        playerIds: Array.isArray(raw.playerIds)
          ? raw.playerIds.map((id) => String(id))
          : [],
      },
    }),
    audit: {
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    },
  });
}
