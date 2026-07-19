/**
 * Core-02 shadow mapper: legacy Individual tournament entry → CompetitionEntry.
 * Does not mutate Production SSOT. Waitlisted legacy status → no Entry (OD-10).
 */

import { COMPETITION_ENTRY_STATUS } from "../enums/statuses.js";
import { COMPETITION_ENTRY_TYPE } from "../enums/entryTypes.js";
import { PARTICIPANT_REFERENCE_KIND } from "../enums/identityKinds.js";
import { PARTICIPANT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createCompetitionEntry,
  createFormatExtension,
  createParticipantReference,
  createParticipantSnapshot,
} from "../contracts/index.js";
import { createEntryTenantScope } from "../contracts/tenantScope.js";
import { validateCompetitionEntry } from "../validators/index.js";
import {
  validationError,
  validationFail,
  validationOk,
} from "../results/validationResult.js";
import { inferCompetitionEntryType } from "./inferEntryType.js";

const SOURCE_SYSTEM = "legacy-individual-entry";
const SOURCE_TYPE = "IndividualEntry";

/**
 * Map legacy ENTRY_STATUS (lowercase) → canonical CompetitionEntry status.
 * WAITLISTED is Registration-owned — callers must not create an Entry for it.
 * @param {unknown} status
 * @returns {string|null} null when waitlisted (no Entry)
 */
export function mapLegacyIndividualStatusToEntryStatus(status) {
  const raw = String(status || "draft").trim().toLowerCase();
  switch (raw) {
    case "waitlisted":
      return null;
    case "pending":
      return COMPETITION_ENTRY_STATUS.PENDING;
    case "approved":
      return COMPETITION_ENTRY_STATUS.APPROVED;
    case "active":
      return COMPETITION_ENTRY_STATUS.ACTIVE;
    case "withdrawn":
    case "cancelled":
      return COMPETITION_ENTRY_STATUS.WITHDRAWN;
    case "rejected":
      return COMPETITION_ENTRY_STATUS.DISQUALIFIED;
    case "draft":
    default:
      return COMPETITION_ENTRY_STATUS.DRAFT;
  }
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {{
 *   success: boolean,
 *   entry: ReturnType<typeof createCompetitionEntry>|null,
 *   skippedBecauseWaitlisted?: boolean,
 *   validation: import('../results/validationResult.js').ParticipantValidationResult,
 * }}
 */
export function mapLegacyIndividualEntryToCompetitionEntry(source, context = {}) {
  if (!source || typeof source !== "object") {
    return {
      success: false,
      entry: null,
      validation: validationFail([
        validationError(
          PARTICIPANT_ERROR_CODE.INVALID_TYPE,
          "",
          "Legacy entry must be an object"
        ),
      ]),
    };
  }

  const entry = /** @type {Record<string, unknown>} */ (source);
  if (!entry.id) {
    return {
      success: false,
      entry: null,
      validation: validationFail([
        validationError(PARTICIPANT_ERROR_CODE.REQUIRED, "id", "Legacy entry id required"),
      ]),
    };
  }

  const mappedStatus = mapLegacyIndividualStatusToEntryStatus(entry.status);
  if (mappedStatus == null) {
    return {
      success: true,
      entry: null,
      skippedBecauseWaitlisted: true,
      validation: validationOk(),
    };
  }

  const competitionId = String(
    context.competitionId ||
      context.tournamentId ||
      entry.tournamentId ||
      entry.competitionId ||
      ""
  ).trim();

  const playerIds = Array.isArray(entry.playerIds)
    ? entry.playerIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  const playerById =
    context.playerById && typeof context.playerById === "object" ? context.playerById : {};

  const memberRefs = playerIds.map((id) => {
    const player = /** @type {Record<string, unknown>} */ (playerById[id] || { id });
    const kind =
      player.isGuest === true
        ? PARTICIPANT_REFERENCE_KIND.GUEST
        : PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE;
    return createParticipantReference({
      kind,
      id: String(id),
      displayNameSnapshot: player.name || player.displayName || null,
      sourceSystem: SOURCE_SYSTEM,
    });
  });

  const inferred = inferCompetitionEntryType({ memberRefs });
  if (!inferred.ok) {
    return {
      success: false,
      entry: null,
      validation: inferred.result,
    };
  }

  const tenantScope = createEntryTenantScope({
    tenantId: context.tenantId || entry.tenantId || null,
    clubId: context.clubId || entry.clubId || null,
    organizationId: context.organizationId || entry.organizationId || null,
  });

  const competitionEntry = createCompetitionEntry({
    id: String(entry.id),
    competitionId,
    status: mappedStatus,
    entryType: inferred.entryType,
    memberRefs,
    participantId:
      inferred.entryType === COMPETITION_ENTRY_TYPE.INDIVIDUAL ? playerIds[0] || null : null,
    divisionId: entry.groupId || entry.divisionId || null,
    categoryId: entry.eventId || entry.categoryId || null,
    entryRole:
      inferred.entryType === COMPETITION_ENTRY_TYPE.PAIR
        ? "doubles"
        : inferred.entryType === COMPETITION_ENTRY_TYPE.INDIVIDUAL
          ? "singles"
          : entry.entryRole || null,
    name: entry.name || null,
    seed: typeof entry.seed === "number" ? entry.seed : null,
    ratingSnapshot: createParticipantSnapshot({
      displayName: entry.name || null,
      rating: typeof entry.rating === "number" ? entry.rating : null,
      snapshotAt: entry.registeredAt || null,
      affiliation: {
        clubName: entry.clubName || entry.representativeClubName || null,
        unitName: entry.unitName || null,
      },
    }),
    participantSnapshot: null,
    representativeRef: null,
    tenantScope,
    sourceSystem: SOURCE_SYSTEM,
    sourceType: SOURCE_TYPE,
    sourceId: String(entry.id),
    groupId: entry.groupId ? String(entry.groupId) : null,
    metadata: {
      pairType: entry.pairType || null,
      partnerInviteToken: entry.partnerInviteToken || null,
      legacyStatus: entry.status || null,
    },
    extensions: createFormatExtension({
      formatKey: "individual-tournament",
      payload: {
        pairType: entry.pairType || null,
        partnerInviteToken: entry.partnerInviteToken || null,
        representativeClubName: entry.representativeClubName || null,
        clubName: entry.clubName || null,
        unitName: entry.unitName || null,
      },
    }),
    audit: {
      createdAt: entry.registeredAt || null,
      decidedAt: entry.decidedAt || null,
      decidedBy: entry.decidedBy || null,
    },
  });

  const validation = validateCompetitionEntry(competitionEntry, {
    expectedCompetitionId: context.expectedCompetitionId || competitionId || null,
    expectedTenantScope: context.expectedTenantScope || tenantScope,
    requireEntryType: true,
  });

  return {
    success: validation.valid,
    entry: validation.valid ? competitionEntry : null,
    validation,
  };
}
