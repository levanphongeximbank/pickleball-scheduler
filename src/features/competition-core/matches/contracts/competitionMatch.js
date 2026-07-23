/**
 * Phase 3F — capability-local CompetitionMatch + MatchSide factories.
 * Does not calculate winners or scores.
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  createAuditMetadata,
  createFormatExtension,
  cloneJsonSafe,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import { MATCH_STATUS } from "../enums/matchStatuses.js";
import { MATCH_SIDE_KEY, isMatchSideKey } from "../enums/matchSideKeys.js";
import { MATCH_COMPLETION_REASON } from "../enums/completionReasons.js";
import { MATCH_SOURCE_TYPE } from "../enums/matchSourceTypes.js";
import {
  buildMatchIdentityKey,
  buildMatchSideId,
} from "./matchIdentity.js";

/**
 * Opaque result handoff — Match Runtime owns the reference only.
 * Scoring Runtime owns scores / winner computation.
 *
 * @typedef {Object} MatchResultReference
 * @property {string} schemaVersion
 * @property {string|null} resultId
 * @property {string|null} resultType
 * @property {string|null} sourceType
 * @property {Record<string, unknown>|null} metadata
 */

/**
 * @typedef {Object} MatchSide
 * @property {string} id
 * @property {string|null} identityKey
 * @property {string} sideKey
 * @property {number|null} seed
 * @property {string|null} teamReference
 * @property {Array<{ kind: string, id: string }>} participantReferences
 * @property {string|null} registrationReference
 * @property {string|null} lineupReference
 * @property {string|null} status
 * @property {string|null} sourceType
 * @property {Record<string, unknown>} metadata
 */

/**
 * @typedef {Object} CompetitionMatch
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string|null} identityKey
 * @property {string} competitionId
 * @property {string} contextId
 * @property {string|null} fixtureId
 * @property {string|null} stageId
 * @property {string|null} roundId
 * @property {string|null} groupId
 * @property {number|null} matchNumber
 * @property {string|null} formatType
 * @property {string} status
 * @property {string} completionReason
 * @property {MatchSide[]} sides
 * @property {string|null} courtAssignmentRef
 * @property {string|null} refereeAssignmentRef
 * @property {string|null} scheduledAt
 * @property {string|null} startedAt
 * @property {string|null} pausedAt
 * @property {string|null} resumedAt
 * @property {string|null} completedAt
 * @property {string|null} suspendedAt
 * @property {string|null} cancelledAt
 * @property {string|null} abandonedAt
 * @property {MatchResultReference|null} resultReference
 * @property {string} sourceType
 * @property {number} revision
 * @property {Record<string, unknown>} metadata
 * @property {import('../../participants/contracts/shared.js').AuditMetadata} audit
 * @property {import('../../participants/contracts/shared.js').FormatExtension|null} formatExtension
 */

/**
 * @param {Partial<MatchResultReference>|null|undefined} partial
 * @returns {MatchResultReference|null}
 */
export function createMatchResultReference(partial) {
  if (partial == null) return null;
  if (typeof partial !== "object" || Array.isArray(partial)) return null;
  const resultId =
    partial.resultId == null || partial.resultId === ""
      ? null
      : String(partial.resultId);
  const resultType =
    partial.resultType == null || partial.resultType === ""
      ? null
      : String(partial.resultType);
  const sourceType =
    partial.sourceType == null || partial.sourceType === ""
      ? null
      : String(partial.sourceType);
  if (resultId == null && resultType == null && sourceType == null) {
    if (!partial.metadata) return null;
  }
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    resultId,
    resultType,
    sourceType,
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? /** @type {Record<string, unknown>} */ (cloneJsonSafe(partial.metadata))
        : null,
  };
}

/**
 * @param {Partial<MatchSide>|null|undefined} partial
 * @param {{ matchIdentityKey?: string, competitionId?: string, contextId?: string }} [identityParts]
 * @returns {MatchSide}
 */
export function createMatchSide(partial = {}, identityParts = {}) {
  const sideKeyRaw = String(partial?.sideKey || MATCH_SIDE_KEY.A)
    .trim()
    .toUpperCase();
  const sideKey = isMatchSideKey(sideKeyRaw) ? sideKeyRaw : MATCH_SIDE_KEY.A;

  const matchIdentityKey =
    identityParts.matchIdentityKey ||
    (identityParts.competitionId && identityParts.contextId
      ? buildMatchIdentityKey({
          competitionId: identityParts.competitionId,
          contextId: identityParts.contextId,
        })
      : null);

  const identityKey =
    isNonEmptyString(partial?.identityKey)
      ? String(partial.identityKey).trim()
      : matchIdentityKey
        ? buildMatchSideId({ matchIdentityKey, sideKey })
        : null;

  const id =
    isNonEmptyString(partial?.id)
      ? String(partial.id).trim()
      : identityKey || `side:${sideKey}`;

  const participantReferences = Array.isArray(partial?.participantReferences)
    ? partial.participantReferences
        .filter((p) => p && typeof p === "object" && isNonEmptyString(p.id))
        .map((p) => ({
          kind: String(p.kind || "PLAYER_PROFILE"),
          id: String(p.id).trim(),
        }))
    : [];

  return {
    id,
    identityKey,
    sideKey,
    seed:
      typeof partial?.seed === "number" && Number.isFinite(partial.seed)
        ? partial.seed
        : null,
    teamReference:
      partial?.teamReference == null || partial.teamReference === ""
        ? null
        : String(partial.teamReference),
    participantReferences,
    registrationReference:
      partial?.registrationReference == null ||
      partial.registrationReference === ""
        ? null
        : String(partial.registrationReference),
    lineupReference:
      partial?.lineupReference == null || partial.lineupReference === ""
        ? null
        : String(partial.lineupReference),
    status:
      partial?.status == null || partial.status === ""
        ? null
        : String(partial.status),
    sourceType:
      partial?.sourceType == null || partial.sourceType === ""
        ? null
        : String(partial.sourceType),
    metadata:
      partial?.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? /** @type {Record<string, unknown>} */ (cloneJsonSafe(partial.metadata))
        : {},
  };
}

/**
 * @param {Partial<CompetitionMatch>|null|undefined} partial
 * @returns {CompetitionMatch}
 */
export function createCompetitionMatch(partial = {}) {
  const competitionId = String(partial?.competitionId || "").trim();
  const contextId = String(partial?.contextId || "").trim();
  const identityKey =
    isNonEmptyString(partial?.identityKey)
      ? String(partial.identityKey).trim()
      : competitionId && contextId
        ? buildMatchIdentityKey({ competitionId, contextId })
        : null;

  const sides = Array.isArray(partial?.sides)
    ? partial.sides.map((side) =>
        createMatchSide(side, {
          matchIdentityKey: identityKey || undefined,
          competitionId,
          contextId,
        })
      )
    : [];

  return {
    schemaVersion: String(partial?.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    id:
      isNonEmptyString(partial?.id)
        ? String(partial.id).trim()
        : identityKey || "",
    identityKey,
    competitionId,
    contextId,
    fixtureId:
      partial?.fixtureId == null || partial.fixtureId === ""
        ? null
        : String(partial.fixtureId),
    stageId:
      partial?.stageId == null || partial.stageId === ""
        ? null
        : String(partial.stageId),
    roundId:
      partial?.roundId == null || partial.roundId === ""
        ? null
        : String(partial.roundId),
    groupId:
      partial?.groupId == null || partial.groupId === ""
        ? null
        : String(partial.groupId),
    matchNumber:
      typeof partial?.matchNumber === "number" &&
      Number.isInteger(partial.matchNumber)
        ? partial.matchNumber
        : null,
    formatType:
      partial?.formatType == null || partial.formatType === ""
        ? null
        : String(partial.formatType),
    status: isNonEmptyString(partial?.status)
      ? String(partial.status).trim().toUpperCase()
      : MATCH_STATUS.DRAFT,
    completionReason: isNonEmptyString(partial?.completionReason)
      ? String(partial.completionReason).trim().toUpperCase()
      : MATCH_COMPLETION_REASON.NONE,
    sides,
    courtAssignmentRef:
      partial?.courtAssignmentRef == null || partial.courtAssignmentRef === ""
        ? null
        : String(partial.courtAssignmentRef),
    refereeAssignmentRef:
      partial?.refereeAssignmentRef == null ||
      partial.refereeAssignmentRef === ""
        ? null
        : String(partial.refereeAssignmentRef),
    scheduledAt: partial?.scheduledAt ?? null,
    startedAt: partial?.startedAt ?? null,
    pausedAt: partial?.pausedAt ?? null,
    resumedAt: partial?.resumedAt ?? null,
    completedAt: partial?.completedAt ?? null,
    suspendedAt: partial?.suspendedAt ?? null,
    cancelledAt: partial?.cancelledAt ?? null,
    abandonedAt: partial?.abandonedAt ?? null,
    resultReference: createMatchResultReference(partial?.resultReference),
    sourceType: isNonEmptyString(partial?.sourceType)
      ? String(partial.sourceType)
      : MATCH_SOURCE_TYPE.CANONICAL_MATCH,
    revision:
      typeof partial?.revision === "number" &&
      Number.isInteger(partial.revision) &&
      partial.revision >= 1
        ? partial.revision
        : 1,
    metadata:
      partial?.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? /** @type {Record<string, unknown>} */ (cloneJsonSafe(partial.metadata))
        : {},
    audit: createAuditMetadata(partial?.audit),
    formatExtension: createFormatExtension(partial?.formatExtension),
  };
}
