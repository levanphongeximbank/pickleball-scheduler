/**
 * Phase 3E — Legacy TT lineup → CompetitionLineup (map-only).
 * Accepts plain objects shaped like legacy lineup — no TT engine imports.
 */

import {
  createCompetitionLineup,
  createCompetitionLineupSlot,
} from "../../participants/contracts/teamRosterLineup.js";
import {
  createFormatExtension,
  cloneJsonSafe,
} from "../../participants/contracts/shared.js";
import { createParticipantReference } from "../../participants/contracts/identity.js";
import { PARTICIPANT_REFERENCE_KIND } from "../../participants/enums/identityKinds.js";
import { LINEUP_SOURCE_TYPE } from "../enums/lineupSourceTypes.js";
import {
  buildLineupIdentityKey,
  buildLineupSlotId,
} from "../contracts/lineupIdentity.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";
import { mapLegacyLineupStatus } from "./statusMapper.js";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export function isLegacyLineupSource(source, context = {}) {
  if (!source || typeof source !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (source);
  const explicit =
    s.__sourceType || context.sourceType || context.__sourceType || null;
  if (
    explicit === LINEUP_SOURCE_TYPE.LEGACY_LINEUP ||
    explicit === "LEGACY_LINEUP" ||
    explicit === "LINEUP"
  ) {
    return (
      (s.matchupId != null || s.contextId != null) && s.teamId != null
    );
  }
  // Shape: TT lineup record
  if (
    (s.matchupId != null || s.contextId != null) &&
    s.teamId != null &&
    (s.selections != null || Array.isArray(s.slots) || s.status != null)
  ) {
    return true;
  }
  return false;
}

/**
 * @param {unknown} playerId
 * @param {Record<string, unknown>} [playerById]
 * @returns {import('../../participants/contracts/identity.js').ParticipantReference}
 */
function personFromPlayerId(playerId, playerById = {}) {
  const id = String(playerId || "").trim();
  const player =
    playerById && typeof playerById === "object" ? playerById[id] : null;
  if (player && typeof player === "object") {
    const kind =
      player.isGuest === true
        ? PARTICIPANT_REFERENCE_KIND.GUEST
        : player.kind
          ? String(player.kind)
          : PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE;
    return createParticipantReference({
      kind,
      id: String(player.id || id),
    });
  }
  return createParticipantReference({
    kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
    id,
  });
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup}
 */
export function mapLegacyLineupToCompetitionLineup(source, context = {}) {
  if (!source || typeof source !== "object") {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP_SOURCE,
      "Legacy lineup source must be an object",
      {}
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (source);
  const teamId = String(raw.teamId || "").trim();
  const contextId = String(raw.contextId || raw.matchupId || "").trim();
  if (!teamId || !contextId) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP_SOURCE,
      "Legacy lineup requires matchupId/contextId and teamId",
      {}
    );
  }

  const competitionId = String(
    context.competitionId || raw.competitionId || raw.tournamentId || ""
  ).trim();
  if (!competitionId) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP_MAPPING,
      "competitionId is required for CompetitionLineup",
      { teamId, contextId }
    );
  }

  const identityKey = buildLineupIdentityKey({
    competitionId,
    contextId,
    teamId,
  });

  const playerById =
    context.playerById && typeof context.playerById === "object"
      ? /** @type {Record<string, unknown>} */ (context.playerById)
      : {};

  /** @type {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineupSlot[]} */
  let slots = [];

  if (Array.isArray(raw.slots) && raw.slots.length > 0) {
    slots = raw.slots.map((slot, fallbackIndex) => {
      const s = slot && typeof slot === "object" ? slot : {};
      const discipline = String(s.disciplineOrSideKey || s.disciplineId || "");
      const index =
        typeof s.index === "number" && Number.isInteger(s.index)
          ? s.index
          : fallbackIndex;
      const person =
        s.person && typeof s.person === "object"
          ? createParticipantReference(s.person)
          : personFromPlayerId(s.playerId || s.id, playerById);
      return createCompetitionLineupSlot({
        id:
          s.id ||
          buildLineupSlotId({
            lineupIdentityKey: identityKey,
            disciplineOrSideKey: discipline,
            index,
          }),
        disciplineOrSideKey: discipline,
        index,
        person,
      });
    });
  } else {
    const selections =
      raw.selections && typeof raw.selections === "object" ? raw.selections : {};
    for (const [discipline, ids] of Object.entries(selections)) {
      const arr = Array.isArray(ids) ? ids : [];
      arr.forEach((id, index) => {
        slots.push(
          createCompetitionLineupSlot({
            id: buildLineupSlotId({
              lineupIdentityKey: identityKey,
              disciplineOrSideKey: String(discipline),
              index,
            }),
            disciplineOrSideKey: String(discipline),
            index,
            person: personFromPlayerId(id, playerById),
          })
        );
      });
    }
  }

  const rosterId =
    context.rosterId != null && String(context.rosterId).trim()
      ? String(context.rosterId).trim()
      : raw.rosterId != null && String(raw.rosterId).trim()
        ? String(raw.rosterId).trim()
        : `roster:${teamId}`;

  const snapshot = /** @type {Record<string, unknown>} */ (
    cloneJsonSafe({
      matchupId: raw.matchupId || contextId,
      teamId: raw.teamId,
      status: raw.status,
      selections: raw.selections || null,
      source: raw.source || null,
      submittedAt: raw.submittedAt || null,
      lockedAt: raw.lockedAt || null,
      publishedAt: raw.publishedAt || null,
      overriddenAt: raw.overriddenAt || null,
      overriddenBy: raw.overriddenBy || null,
      overrideReason: raw.overrideReason || null,
      previousLineupVersion: raw.previousLineupVersion ?? null,
      auditNote: raw.auditNote || null,
    })
  );

  return createCompetitionLineup({
    id: identityKey,
    competitionId,
    teamId,
    contextId,
    rosterId,
    status: mapLegacyLineupStatus(raw.status),
    revision:
      typeof raw.revision === "number" && raw.revision >= 1
        ? raw.revision
        : typeof raw.previousLineupVersion === "number" &&
            raw.previousLineupVersion >= 1
          ? raw.previousLineupVersion
          : 1,
    previousRevisionId: raw.previousRevisionId ?? null,
    submittedAt: typeof raw.submittedAt === "string" ? raw.submittedAt : null,
    submittedBy:
      typeof raw.submittedBy === "string" ? raw.submittedBy : null,
    lockedAt: typeof raw.lockedAt === "string" ? raw.lockedAt : null,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : null,
    reason:
      (typeof raw.overrideReason === "string" && raw.overrideReason) ||
      (typeof raw.auditNote === "string" && raw.auditNote) ||
      (typeof raw.reason === "string" ? raw.reason : null),
    slots,
    identityKey,
    extensions: createFormatExtension({
      formatKey: String(context.formatKey || "team-tournament-v6"),
      payload: {
        sourceType: LINEUP_SOURCE_TYPE.LEGACY_LINEUP,
        sourceSnapshot: snapshot,
        legacySource: raw.source || null,
      },
    }),
    audit: {
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    },
  });
}
