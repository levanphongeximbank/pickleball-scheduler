/**
 * Core-02 — deterministic CompetitionEntry identity.
 * Key = competitionId::ENTRY::entryType::stableSourceIdentity
 *
 * No displayName, timestamps, random UUIDs, or mutable metadata.
 * PAIR members are canonicalized (sorted) before identity material is built.
 */

import { PARTICIPANT_SCHEMA_VERSION, isNonEmptyString } from "./shared.js";
import { isCompetitionEntryType, COMPETITION_ENTRY_TYPE } from "../enums/entryTypes.js";
import { PARTICIPANT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  validationError,
  validationFail,
  validationOk,
} from "../results/validationResult.js";
import { isValidCompetitionTeamReference } from "./teamReference.js";

export const ENTRY_IDENTITY_KIND = "ENTRY";

/**
 * @typedef {Object} CompetitionEntryIdentity
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} entryType
 * @property {string} stableSourceIdentity
 * @property {string} key
 */

/**
 * Canonical member token: kind::id (trimmed). Used for PAIR ordering.
 * @param {{ kind?: string, id?: string }|null|undefined} ref
 * @returns {string}
 */
export function memberReferenceToken(ref) {
  if (!ref || typeof ref !== "object") return "";
  const kind = String(ref.kind || "").trim();
  const id = String(ref.id || "").trim();
  if (!kind || !id) return "";
  return `${kind}::${id}`;
}

/**
 * Sort PAIR (or multi-member) tokens lexicographically for deterministic identity.
 * @param {Array<{ kind?: string, id?: string }|null|undefined>} memberRefs
 * @returns {string[]}
 */
export function canonicalizeMemberReferenceTokens(memberRefs = []) {
  if (!Array.isArray(memberRefs)) return [];
  return memberRefs
    .map((ref) => memberReferenceToken(ref))
    .filter(Boolean)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Build stable source identity material for an entry type.
 * @param {{
 *   entryType?: string,
 *   memberRefs?: Array<{ kind?: string, id?: string }>,
 *   teamRef?: { id?: string, identityKey?: string|null }|null,
 *   stableSourceIdentity?: string|null,
 * }} parts
 * @returns {string}
 */
export function buildStableEntrySourceIdentity(parts = {}) {
  if (isNonEmptyString(parts.stableSourceIdentity)) {
    return String(parts.stableSourceIdentity).trim();
  }

  const entryType = String(parts.entryType || "").trim();

  if (entryType === COMPETITION_ENTRY_TYPE.TEAM) {
    const teamRef = parts.teamRef;
    if (teamRef && isNonEmptyString(teamRef.identityKey)) {
      return String(teamRef.identityKey).trim();
    }
    if (teamRef && isNonEmptyString(teamRef.id)) {
      return `TEAM::${String(teamRef.id).trim()}`;
    }
    return "";
  }

  const tokens = canonicalizeMemberReferenceTokens(parts.memberRefs || []);
  if (entryType === COMPETITION_ENTRY_TYPE.INDIVIDUAL) {
    return tokens[0] || "";
  }
  if (entryType === COMPETITION_ENTRY_TYPE.PAIR) {
    return tokens.length === 2 ? tokens.join("+") : "";
  }
  return tokens.join("+");
}

/**
 * @param {{
 *   competitionId?: string,
 *   entryType?: string,
 *   stableSourceIdentity?: string,
 *   memberRefs?: Array<{ kind?: string, id?: string }>,
 *   teamRef?: { id?: string, identityKey?: string|null }|null,
 * }} parts
 * @returns {string}
 */
export function buildEntryIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const entryType = String(parts.entryType || "").trim();
  const stableSourceIdentity = buildStableEntrySourceIdentity(parts);
  return `${competitionId}::${ENTRY_IDENTITY_KIND}::${entryType}::${stableSourceIdentity}`;
}

/**
 * @param {Partial<CompetitionEntryIdentity> & {
 *   memberRefs?: Array<{ kind?: string, id?: string }>,
 *   teamRef?: { id?: string, identityKey?: string|null }|null,
 * }} partial
 * @returns {CompetitionEntryIdentity}
 */
export function createEntryIdentity(partial = {}) {
  const competitionId = String(partial.competitionId || "").trim();
  const entryType = String(partial.entryType || "").trim();
  const stableSourceIdentity = buildStableEntrySourceIdentity(partial);

  if (!isNonEmptyString(competitionId)) {
    throw new TypeError("createEntryIdentity requires competitionId");
  }
  if (!isCompetitionEntryType(entryType)) {
    throw new TypeError("createEntryIdentity requires a valid COMPETITION_ENTRY_TYPE");
  }
  if (!isNonEmptyString(stableSourceIdentity)) {
    throw new TypeError("createEntryIdentity requires stableSourceIdentity");
  }

  const key =
    isNonEmptyString(partial.key) && String(partial.key).includes("::ENTRY::")
      ? String(partial.key).trim()
      : buildEntryIdentityKey({
          competitionId,
          entryType,
          stableSourceIdentity,
          memberRefs: partial.memberRefs,
          teamRef: partial.teamRef,
        });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId,
    entryType,
    stableSourceIdentity,
    key,
  });
}

/**
 * @param {unknown} input
 * @returns {import('../results/validationResult.js').ParticipantValidationResult}
 */
export function validateEntryIdentity(input) {
  if (!input || typeof input !== "object") {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_TYPE,
        "",
        "EntryIdentity must be an object"
      ),
    ]);
  }

  const errors = [];
  if (!isNonEmptyString(input.competitionId)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.MISSING_COMPETITION_ID,
        "competitionId",
        "EntryIdentity.competitionId is required"
      )
    );
  }
  if (!isCompetitionEntryType(input.entryType)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_ENTRY_TYPE,
        "entryType",
        "EntryIdentity.entryType must be a COMPETITION_ENTRY_TYPE"
      )
    );
  }
  if (!isNonEmptyString(input.stableSourceIdentity)) {
    errors.push(
      validationError(
        PARTICIPANT_ERROR_CODE.ENTRY_IDENTITY_INVALID,
        "stableSourceIdentity",
        "EntryIdentity.stableSourceIdentity is required"
      )
    );
  }

  if (errors.length) {
    return validationFail(errors);
  }

  const expected = buildEntryIdentityKey({
    competitionId: input.competitionId,
    entryType: input.entryType,
    stableSourceIdentity: input.stableSourceIdentity,
  });

  if (isNonEmptyString(input.key) && String(input.key).trim() !== expected) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.ENTRY_IDENTITY_MISMATCH,
        "key",
        "EntryIdentity.key does not match deterministic construction",
        { expected, actual: String(input.key) }
      ),
    ]);
  }

  if (
    input.entryType === COMPETITION_ENTRY_TYPE.TEAM &&
    input.teamRef != null &&
    !isValidCompetitionTeamReference(input.teamRef)
  ) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_TEAM_REF,
        "teamRef",
        "EntryIdentity.teamRef is invalid"
      ),
    ]);
  }

  return validationOk();
}

/**
 * Derive identity from a CompetitionEntry-like object when entryType is present.
 * @param {import('./entryRegistration.js').CompetitionEntry|null|undefined} entry
 * @returns {CompetitionEntryIdentity|null}
 */
export function identityFromCompetitionEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (!isNonEmptyString(entry.competitionId) || !isCompetitionEntryType(entry.entryType)) {
    return null;
  }
  try {
    return createEntryIdentity({
      competitionId: entry.competitionId,
      entryType: entry.entryType,
      memberRefs: entry.memberRefs,
      teamRef: entry.teamRef,
      stableSourceIdentity: null,
      key: entry.identityKey || undefined,
    });
  } catch {
    return null;
  }
}
