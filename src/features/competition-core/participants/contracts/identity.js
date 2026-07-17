import { PARTICIPANT_REFERENCE_KIND } from "../enums/identityKinds.js";
import { PARTICIPANT_SCHEMA_VERSION, createAuditMetadata } from "./shared.js";

/**
 * Discriminated person reference — kinds are distinct ID spaces (OD-01).
 *
 * @typedef {Object} ParticipantReference
 * @property {string} schemaVersion
 * @property {string} kind
 * @property {string} id
 * @property {string[]} [aliases]
 * @property {string|null} [displayNameSnapshot]
 * @property {string|null} [sourceSystem]
 * @property {string|null} [externalSystem]
 * @property {string|null} [externalKey]
 * @property {Record<string, unknown>|null} [snapshotMetadata]
 */

/**
 * @param {Partial<ParticipantReference>} partial
 * @returns {ParticipantReference}
 */
export function createParticipantReference(partial = {}) {
  const aliases = Array.isArray(partial.aliases)
    ? partial.aliases.map((a) => String(a)).filter(Boolean)
    : [];
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    kind: String(partial.kind || PARTICIPANT_REFERENCE_KIND.GUEST),
    id: String(partial.id || ""),
    aliases: [...aliases],
    displayNameSnapshot: partial.displayNameSnapshot ?? null,
    sourceSystem: partial.sourceSystem ?? null,
    externalSystem: partial.externalSystem ?? null,
    externalKey: partial.externalKey ?? null,
    snapshotMetadata:
      partial.snapshotMetadata && typeof partial.snapshotMetadata === "object"
        ? { ...partial.snapshotMetadata }
        : null,
  };
}

/**
 * Link guest/external to an official profile via aliases only.
 * Does NOT change primary kind/id (OD-01).
 *
 * @param {ParticipantReference} reference
 * @param {{ kind: string, id: string }} link
 * @returns {ParticipantReference}
 */
export function linkParticipantReferenceAlias(reference, link) {
  if (!reference || typeof reference !== "object") {
    throw new TypeError("linkParticipantReferenceAlias requires a ParticipantReference");
  }
  if (!link || !link.kind || !link.id) {
    throw new TypeError("linkParticipantReferenceAlias requires link.kind and link.id");
  }
  const token = `${link.kind}:${link.id}`;
  const aliases = Array.isArray(reference.aliases) ? [...reference.aliases] : [];
  if (!aliases.includes(token) && token !== `${reference.kind}:${reference.id}`) {
    aliases.push(token);
  }
  return createParticipantReference({
    ...reference,
    aliases,
  });
}

/**
 * Snapshot of registration/lock-time attributes (OD-08). Does not replace source profile.
 *
 * @typedef {Object} ParticipantSnapshot
 * @property {string} schemaVersion
 * @property {string|null} displayName
 * @property {number|null} rating
 * @property {Record<string, unknown>} eligibilityAttributes
 * @property {Record<string, unknown>|null} affiliation
 * @property {ParticipantReference|null} identityReference
 * @property {string|null} snapshotAt
 * @property {string|null} [seedLockedRating]
 * @property {boolean} [seedLocked]
 */

/**
 * @param {Partial<ParticipantSnapshot>} partial
 * @returns {ParticipantSnapshot}
 */
export function createParticipantSnapshot(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    displayName: partial.displayName ?? null,
    rating: typeof partial.rating === "number" ? partial.rating : partial.rating ?? null,
    eligibilityAttributes:
      partial.eligibilityAttributes && typeof partial.eligibilityAttributes === "object"
        ? { ...partial.eligibilityAttributes }
        : {},
    affiliation:
      partial.affiliation && typeof partial.affiliation === "object"
        ? { ...partial.affiliation }
        : null,
    identityReference: partial.identityReference
      ? createParticipantReference(partial.identityReference)
      : null,
    snapshotAt: partial.snapshotAt ?? null,
    seedLockedRating:
      partial.seedLockedRating !== undefined ? partial.seedLockedRating : null,
    seedLocked: partial.seedLocked === true,
  };
}

/**
 * Rating input captured at SEED_LOCKED (OD-09) — representation only, no seed engine.
 *
 * @typedef {Object} SeedLockedRatingSnapshot
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} subjectKind
 * @property {string} subjectId
 * @property {number|null} rating
 * @property {string} lockedAt
 * @property {string} marker
 */

/**
 * @param {Partial<SeedLockedRatingSnapshot>} partial
 * @returns {SeedLockedRatingSnapshot}
 */
export function createSeedLockedRatingSnapshot(partial = {}) {
  return {
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId: String(partial.competitionId || ""),
    subjectKind: String(partial.subjectKind || ""),
    subjectId: String(partial.subjectId || ""),
    rating: typeof partial.rating === "number" ? partial.rating : null,
    lockedAt: String(partial.lockedAt || ""),
    marker: String(partial.marker || "SEED_LOCKED"),
  };
}

export { createAuditMetadata };
