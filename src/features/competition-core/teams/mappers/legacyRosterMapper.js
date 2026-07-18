/**
 * Phase 3D — Legacy TT roster (team.playerIds + lock meta) → CompetitionRoster.
 * Map-only. Does not implement substitution workflow (representation empty by default).
 */

import {
  createCompetitionRoster,
  createCompetitionRosterMember,
} from "../../participants/contracts/teamRosterLineup.js";
import {
  createFormatExtension,
  cloneJsonSafe,
} from "../../participants/contracts/shared.js";
import { createParticipantReference } from "../../participants/contracts/identity.js";
import { TEAM_SOURCE_TYPE } from "../enums/teamSourceTypes.js";
import { buildRosterIdentityKey } from "../contracts/rosterIdentity.js";
import {
  buildRosterMemberIdentityKey,
  formatParticipantReferenceToken,
} from "../contracts/rosterMemberIdentity.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";
import {
  mapLegacyRosterStatus,
  mapLegacyRosterMemberStatus,
} from "./statusMapper.js";
import {
  buildMemberRefsFromContext,
  resolvePersonReferenceFromPlayer,
} from "./memberRefs.js";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export function isLegacyRosterSource(source, context = {}) {
  if (!source || typeof source !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (source);
  const explicit =
    s.__sourceType || context.sourceType || context.__sourceType || null;
  if (
    explicit === TEAM_SOURCE_TYPE.LEGACY_ROSTER ||
    explicit === "LEGACY_ROSTER" ||
    explicit === "ROSTER"
  ) {
    return s.teamId != null || s.id != null;
  }
  if (
    explicit === TEAM_SOURCE_TYPE.LEGACY_TEAM ||
    explicit === "LEGACY_TEAM"
  ) {
    // Team records can also be roster sources when preferRoster
    return context.preferRoster === true && (s.id != null || s.teamId != null);
  }
  if (context.preferRoster === true && (s.teamId != null || s.id != null)) {
    return true;
  }
  // Explicit roster-shaped: teamId + members/playerIds without requiring name
  if (s.teamId != null && (Array.isArray(s.playerIds) || Array.isArray(s.members))) {
    return true;
  }
  return false;
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster}
 */
export function mapLegacyRosterToCompetitionRoster(source, context = {}) {
  if (!source || typeof source !== "object") {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER_SOURCE,
      "Legacy roster source must be an object",
      {}
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (source);
  const teamId = String(raw.teamId || raw.id || "").trim();
  if (!teamId) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER_SOURCE,
      "teamId is required for CompetitionRoster",
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
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER_MAPPING,
      "competitionId is required for CompetitionRoster",
      { teamId }
    );
  }

  const playerById =
    context.playerById && typeof context.playerById === "object"
      ? context.playerById
      : {};

  const absentSet = new Set(
    (Array.isArray(raw.absentPlayerIds) ? raw.absentPlayerIds : []).map((id) =>
      String(id)
    )
  );
  const captainId = raw.captainPlayerId
    ? String(raw.captainPlayerId).trim()
    : "";

  const locked =
    raw.locked === true ||
    context.rosterLocked === true ||
    String(raw.rosterStatus || "").toUpperCase() === "ROSTER_LOCKED" ||
    (Array.isArray(raw.lockedPlayerIds) &&
      raw.lockedPlayerIds.length > 0 &&
      context.treatLockedPlayerIdsAsRosterLock === true);

  const rosterId = `roster:${teamId}`;
  const identityKey = buildRosterIdentityKey({ competitionId, teamId });

  /** @type {import('../../participants/contracts/identity.js').ParticipantReference[]} */
  let memberRefs;
  if (Array.isArray(context.memberRefs) && context.memberRefs.length > 0) {
    memberRefs = context.memberRefs.map((r) => createParticipantReference(r || {}));
  } else if (Array.isArray(raw.members) && raw.members.length > 0) {
    memberRefs = raw.members.map((m) => {
      if (m?.person) return createParticipantReference(m.person);
      const id = String(m?.id || m?.playerId || "").trim();
      return resolvePersonReferenceFromPlayer(playerById[id] || { id }, id);
    });
  } else {
    memberRefs = buildMemberRefsFromContext(raw, context);
  }

  /** @type {Set<string>} */
  const seenMemberKeys = new Set();
  const members = memberRefs.map((person) => {
    if (!person?.kind || !String(person.id || "").trim()) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
        "Roster member requires participant reference",
        { teamId }
      );
    }
    const personToken = formatParticipantReferenceToken(person);
    const memberKey = buildRosterMemberIdentityKey({
      competitionId,
      teamId,
      participantReference: personToken,
    });
    if (seenMemberKeys.has(memberKey)) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODE.ROSTER_MEMBER_IDENTITY_COLLISION,
        "Duplicate roster member identity",
        { identityKey: memberKey, teamId }
      );
    }
    seenMemberKeys.add(memberKey);

    const role =
      captainId && String(person.id) === captainId ? "captain" : "player";

    return createCompetitionRosterMember({
      id: `rm:${teamId}:${person.kind}:${person.id}`,
      rosterId,
      person,
      status: mapLegacyRosterMemberStatus(null, {
        absent: absentSet.has(String(person.id)),
      }),
      role,
      extensions: createFormatExtension({
        formatKey: String(context.formatKey || "team-tournament-v6"),
        payload: {
          memberIdentityKey: memberKey,
        },
      }),
    });
  });

  const snapshot = /** @type {Record<string, unknown>} */ (
    cloneJsonSafe({
      id: raw.id,
      teamId,
      playerIds: raw.playerIds,
      captainPlayerId: raw.captainPlayerId,
      absentPlayerIds: raw.absentPlayerIds,
      lockedPlayerIds: raw.lockedPlayerIds,
      locked: raw.locked,
      rosterStatus: raw.rosterStatus,
      lockedAt: raw.lockedAt,
    })
  );

  return createCompetitionRoster({
    id: rosterId,
    competitionId,
    teamId,
    members,
    status: mapLegacyRosterStatus(raw.rosterStatus || raw.status, {
      locked,
      defaultStatus: "DRAFT",
    }),
    lockedAt:
      locked && typeof raw.lockedAt === "string" ? raw.lockedAt : locked ? null : null,
    lockReason: locked
      ? typeof raw.lockReason === "string"
        ? raw.lockReason
        : null
      : null,
    maxSize: typeof raw.maxSize === "number" ? raw.maxSize : null,
    amendments: [],
    identityKey,
    extensions: createFormatExtension({
      formatKey: String(context.formatKey || "team-tournament-v6"),
      payload: {
        sourceType: TEAM_SOURCE_TYPE.LEGACY_ROSTER,
        sourceSnapshot: snapshot,
      },
    }),
  });
}
