/**
 * Phase 3C — Legacy individual / Official BTC entry → CompetitionRegistration.
 * Map-only. Does not mutate source. No DB writes.
 */

import { createCompetitionRegistration } from "../../participants/contracts/entryRegistration.js";
import { createFormatExtension, cloneJsonSafe } from "../../participants/contracts/shared.js";
import { COMPETITION_REGISTRATION_STATUS } from "../../participants/enums/statuses.js";
import { REGISTRATION_KIND } from "../enums/registrationKinds.js";
import { REGISTRATION_SOURCE_TYPE } from "../enums/registrationSourceTypes.js";
import {
  buildRegistrationIdentityKey,
  createRegistrationIdentity,
} from "../contracts/registrationIdentity.js";
import { REGISTRATION_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { RegistrationRuntimeError } from "../errors/RegistrationRuntimeError.js";
import { mapLegacyRegistrationStatus } from "./statusMapper.js";
import { buildMemberRefsFromContext } from "./memberRefs.js";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export function isLegacyIndividualEntrySource(source, context = {}) {
  if (!source || typeof source !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (source);
  const explicit =
    s.__sourceType || context.sourceType || context.__sourceType || null;
  if (
    explicit === REGISTRATION_SOURCE_TYPE.LEGACY_TEAM_REGISTRATION ||
    explicit === "TEAM" ||
    s.registrationKind === REGISTRATION_KIND.TEAM
  ) {
    return false;
  }
  if (
    explicit === REGISTRATION_SOURCE_TYPE.LEGACY_INDIVIDUAL_ENTRY ||
    explicit === REGISTRATION_SOURCE_TYPE.OFFICIAL_BTC ||
    explicit === "INDIVIDUAL"
  ) {
    return s.id != null;
  }
  // Shape: entry-like (id + playerIds or entry status fields)
  if (s.id == null) return false;
  if (s.teamId != null && !Array.isArray(s.playerIds) && s.entryRole === "team") {
    return false;
  }
  return (
    Array.isArray(s.playerIds) ||
    s.status != null ||
    s.eventId != null ||
    s.pairType != null ||
    s.partnerInviteToken != null ||
    s.btcDirect === true ||
    s.btcDirectActive === true
  );
}

/**
 * @param {Record<string, unknown>} source
 * @param {Record<string, unknown>} context
 * @returns {string}
 */
function resolveSourceType(source, context) {
  const explicit = String(
    context.sourceType || source.__sourceType || context.__sourceType || ""
  ).trim();
  if (explicit === REGISTRATION_SOURCE_TYPE.OFFICIAL_BTC || explicit === "OFFICIAL_BTC") {
    return REGISTRATION_SOURCE_TYPE.OFFICIAL_BTC;
  }
  if (
    source.btcDirect === true ||
    source.btcDirectActive === true ||
    context.btcDirect === true ||
    context.officialBtc === true
  ) {
    return REGISTRATION_SOURCE_TYPE.OFFICIAL_BTC;
  }
  if (explicit === REGISTRATION_SOURCE_TYPE.LEGACY_INDIVIDUAL_ENTRY) {
    return REGISTRATION_SOURCE_TYPE.LEGACY_INDIVIDUAL_ENTRY;
  }
  return REGISTRATION_SOURCE_TYPE.LEGACY_INDIVIDUAL_ENTRY;
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration}
 */
export function mapLegacyIndividualEntryToRegistration(source, context = {}) {
  if (!source || typeof source !== "object") {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION_MAPPING,
      "Legacy individual entry source must be an object",
      {}
    );
  }

  const raw = /** @type {Record<string, unknown>} */ (source);
  const snapshot = /** @type {Record<string, unknown>} */ (
    cloneJsonSafe({
      id: raw.id,
      tournamentId: raw.tournamentId,
      competitionId: raw.competitionId,
      eventId: raw.eventId,
      status: raw.status,
      playerIds: raw.playerIds,
      pairType: raw.pairType,
      partnerInviteToken: raw.partnerInviteToken,
      waitlistPosition: raw.waitlistPosition,
      registeredAt: raw.registeredAt,
      decidedAt: raw.decidedAt,
      decidedBy: raw.decidedBy,
      rejectionReason: raw.rejectionReason,
      name: raw.name,
      representativeClubName: raw.representativeClubName,
      clubName: raw.clubName,
      unitName: raw.unitName,
      groupId: raw.groupId,
      btcDirect: raw.btcDirect,
      btcDirectActive: raw.btcDirectActive,
      __sourceType: raw.__sourceType,
      registeredByPlatformUserId: raw.registeredByPlatformUserId,
    })
  );

  const sourceId = String(snapshot.id || "").trim();
  if (!sourceId) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION_MAPPING,
      "Entry id required",
      { sourceType: REGISTRATION_SOURCE_TYPE.LEGACY_INDIVIDUAL_ENTRY }
    );
  }

  const competitionId = String(
    context.competitionId ||
      snapshot.competitionId ||
      snapshot.tournamentId ||
      ""
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
    context.registrationKind !== REGISTRATION_KIND.INDIVIDUAL
  ) {
    throw new RegistrationRuntimeError(
      REGISTRATION_RUNTIME_ERROR_CODE.UNSUPPORTED_REGISTRATION_KIND,
      "Legacy individual entry maps only to INDIVIDUAL",
      { registrationKind: context.registrationKind }
    );
  }

  const sourceType = resolveSourceType(snapshot, context);
  const status = mapLegacyRegistrationStatus(snapshot.status, { sourceId });
  const isWaitlisted = status === COMPETITION_REGISTRATION_STATUS.WAITLISTED;

  const rawPlayerIds = Array.isArray(snapshot.playerIds) ? snapshot.playerIds : [];
  for (const rawId of rawPlayerIds) {
    if (rawId != null && String(rawId).trim() === "") {
      throw new RegistrationRuntimeError(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
        "Participant reference id is required",
        { sourceId }
      );
    }
  }
  const playerIds = rawPlayerIds.map((id) => String(id).trim()).filter(Boolean);

  const memberRefs = buildMemberRefsFromContext(playerIds, {
    ...context,
    competitionId,
  });

  const identity = createRegistrationIdentity({
    competitionId,
    registrationKind: REGISTRATION_KIND.INDIVIDUAL,
    stableSourceIdentity: sourceId,
  });

  const entryRole =
    playerIds.length >= 2 || snapshot.pairType
      ? "doubles"
      : playerIds.length === 1
        ? "singles"
        : null;

  return createCompetitionRegistration({
    id: `reg:ind:${sourceId}`,
    competitionId,
    status,
    registrationKind: REGISTRATION_KIND.INDIVIDUAL,
    sourceType,
    sourceId,
    identityKey: identity.key,
    memberRefs,
    entryId: isWaitlisted ? null : sourceId,
    waitlistPosition: isWaitlisted
      ? typeof snapshot.waitlistPosition === "number"
        ? snapshot.waitlistPosition
        : null
      : null,
    participantId: context.participantId ?? null,
    submittedAt: snapshot.registeredAt || null,
    decidedAt: snapshot.decidedAt || null,
    decidedBy: snapshot.decidedBy || null,
    rejectionReason: snapshot.rejectionReason || null,
    registeredByPlatformUserId: snapshot.registeredByPlatformUserId || null,
    metadata: {
      entryRole,
      pairType: snapshot.pairType || null,
      partnerInviteToken: snapshot.partnerInviteToken || null,
      eventId: snapshot.eventId || null,
      groupId: snapshot.groupId || null,
      name: snapshot.name || null,
      representativeClubName: snapshot.representativeClubName || null,
      clubName: snapshot.clubName || null,
      unitName: snapshot.unitName || null,
      guestPreserved: memberRefs.some(
        (r) => r.kind === "GUEST" || r.snapshotMetadata?.guest === true
      ),
    },
    extensions: createFormatExtension({
      formatKey: String(context.formatKey || "individual"),
      payload: {
        sourceEntryId: sourceId,
        sourceStatus: snapshot.status || null,
        sourceType,
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

export { buildRegistrationIdentityKey };
