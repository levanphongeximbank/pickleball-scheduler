/**
 * Phase 3C — Legacy team registration → CompetitionRegistration.
 * Map-only. Team belongs to Phase 3C (Owner). Captain is metadata role.
 */

import { createCompetitionRegistration } from "../../participants/contracts/entryRegistration.js";
import { createFormatExtension, cloneJsonSafe } from "../../participants/contracts/shared.js";
import { COMPETITION_REGISTRATION_STATUS } from "../../participants/enums/statuses.js";
import { REGISTRATION_KIND } from "../enums/registrationKinds.js";
import { REGISTRATION_SOURCE_TYPE } from "../enums/registrationSourceTypes.js";
import { createRegistrationIdentity } from "../contracts/registrationIdentity.js";
import { REGISTRATION_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { RegistrationRuntimeError } from "../errors/RegistrationRuntimeError.js";
import { mapLegacyRegistrationStatus } from "./statusMapper.js";
import { buildMemberRefsFromContext } from "./memberRefs.js";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export function isLegacyTeamRegistrationSource(source, context = {}) {
  if (!source || typeof source !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (source);
  const explicit =
    s.__sourceType || context.sourceType || context.__sourceType || null;
  if (
    explicit === REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION ||
    explicit === "TEAM" ||
    s.registrationKind === REGISTRATION_KIND.TEAM
  ) {
    return s.id != null || s.teamId != null;
  }
  if (
    explicit === REGISTRATION_SOURCE_TYPE.LEGACY_INDIVIDUAL_ENTRY ||
    explicit === REGISTRATION_SOURCE_TYPE.OFFICIAL_BTC
  ) {
    return false;
  }
  // Shape: team registration / team create
  if (s.teamId != null && (s.id != null || context.preferTeam === true)) return true;
  if (s.entryRole === "team" && s.id != null) return true;
  if (s.__teamRegistration === true && s.id != null) return true;
  return false;
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration}
 */
export function mapLegacyTeamRegistrationToRegistration(source, context = {}) {
  if (!source || typeof source !== "object") {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION_MAPPING,
      "Legacy team registration source must be an object",
      {}
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (source);
  const snapshot = /** @type {Record<string, unknown>} */ (
    cloneJsonSafe({
      id: raw.id,
      teamId: raw.teamId,
      tournamentId: raw.tournamentId,
      competitionId: raw.competitionId,
      status: raw.status,
      playerIds: raw.playerIds,
      waitlistPosition: raw.waitlistPosition,
      registeredAt: raw.registeredAt,
      submittedAt: raw.submittedAt,
      decidedAt: raw.decidedAt,
      decidedBy: raw.decidedBy,
      rejectionReason: raw.rejectionReason,
      name: raw.name,
      groupId: raw.groupId,
      divisionId: raw.divisionId,
      categoryId: raw.categoryId,
      captainPlayerId: raw.captainPlayerId,
      __sourceType: raw.__sourceType,
    })
  );

  const teamId = String(snapshot.teamId || snapshot.id || "").trim();
  const sourceId = String(snapshot.id || teamId).trim();
  if (!sourceId || !teamId) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION_MAPPING,
      "Team registration id / teamId required",
      { sourceType: REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION }
    );
  }

  const competitionId = String(
    context.competitionId || snapshot.competitionId || snapshot.tournamentId || ""
  ).trim();
  if (!competitionId) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
      "competitionId required",
      { sourceId }
    );
  }

  if (
    context.registrationKind != null &&
    context.registrationKind !== "" &&
    context.registrationKind !== REGISTRATION_KIND.TEAM
  ) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_KIND,
      "Legacy team registration maps only to TEAM",
      { registrationKind: context.registrationKind }
    );
  }

  const status = mapLegacyRegistrationStatus(snapshot.status || "approved", {
    sourceId,
  });
  const isWaitlisted = status === COMPETITION_REGISTRATION_STATUS.WAITLISTED;

  const playerIds = Array.isArray(snapshot.playerIds)
    ? snapshot.playerIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  const memberRefs = buildMemberRefsFromContext(playerIds, {
    ...context,
    competitionId,
  });

  const identity = createRegistrationIdentity({
    competitionId,
    registrationKind: REGISTRATION_KIND.TEAM,
    stableSourceIdentity: teamId,
  });

  return createCompetitionRegistration({
    id: String(sourceId),
    competitionId,
    status,
    registrationKind: REGISTRATION_KIND.TEAM,
    sourceType: REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION,
    sourceId: teamId,
    identityKey: identity.key,
    memberRefs,
    entryId: isWaitlisted ? null : `entry:tt:${teamId}`,
    waitlistPosition: isWaitlisted
      ? typeof snapshot.waitlistPosition === "number"
        ? snapshot.waitlistPosition
        : null
      : null,
    participantId: null,
    submittedAt: snapshot.registeredAt || snapshot.submittedAt || null,
    decidedAt: snapshot.decidedAt || null,
    decidedBy: snapshot.decidedBy || null,
    rejectionReason: snapshot.rejectionReason || null,
    metadata: {
      teamId,
      entryRole: "team",
      name: snapshot.name || null,
      groupId: snapshot.groupId || null,
      divisionId: snapshot.divisionId || null,
      categoryId: snapshot.categoryId || null,
      captainPlayerId: snapshot.captainPlayerId || null,
      captainRole: snapshot.captainPlayerId ? "captain" : null,
    },
    extensions: createFormatExtension({
      formatKey: String(context.formatKey || "team_tournament"),
      payload: {
        teamId,
        sourceStatus: snapshot.status || null,
        identityKey: identity.key,
      },
    }),
    audit: {
      createdAt: snapshot.registeredAt || null,
      decidedAt: snapshot.decidedAt || null,
      decidedBy: snapshot.decidedBy || null,
    },
  });
}
