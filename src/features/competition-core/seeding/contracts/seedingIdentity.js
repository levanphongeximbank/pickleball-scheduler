/**
 * Phase 3G — deterministic seeding identities.
 *
 * Operation: competitionId::SEEDING::contextId
 * Candidate:  seedingIdentityKey::CANDIDATE::candidateReference
 * Assignment: seedingIdentityKey::SEED::{seedNumber}
 *
 * Excludes: display name, mutable rating/ranking, timestamps, random UUID,
 * court, referee, schedule, score, winner.
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import { SEEDING_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { SeedingRuntimeError } from "../errors/SeedingRuntimeError.js";

export const SEEDING_IDENTITY_KIND = "SEEDING";
export const SEEDING_CANDIDATE_IDENTITY_KIND = "CANDIDATE";
export const SEEDING_ASSIGNMENT_IDENTITY_KIND = "SEED";

/**
 * @typedef {Object} SeedingIdentity
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} kind
 * @property {string} contextId
 * @property {string} key
 */

/**
 * @param {{ competitionId?: string, contextId?: string }} parts
 * @returns {string}
 */
export function buildSeedingIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const contextId = String(parts.contextId || "").trim();
  return `${competitionId}::${SEEDING_IDENTITY_KIND}::${contextId}`;
}

/**
 * @param {{
 *   seedingIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   candidateReference?: string,
 * }} parts
 * @returns {string}
 */
export function buildCandidateIdentityKey(parts = {}) {
  const seedingKey =
    isNonEmptyString(parts.seedingIdentityKey)
      ? String(parts.seedingIdentityKey).trim()
      : buildSeedingIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
        });
  const candidateReference = String(parts.candidateReference || "").trim();
  return `${seedingKey}::${SEEDING_CANDIDATE_IDENTITY_KIND}::${candidateReference}`;
}

/**
 * @param {{
 *   seedingIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   seedNumber?: number|string,
 * }} parts
 * @returns {string}
 */
export function buildAssignmentIdentityKey(parts = {}) {
  const seedingKey =
    isNonEmptyString(parts.seedingIdentityKey)
      ? String(parts.seedingIdentityKey).trim()
      : buildSeedingIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
        });
  const seedNumber = Number(parts.seedNumber);
  return `${seedingKey}::${SEEDING_ASSIGNMENT_IDENTITY_KIND}::${seedNumber}`;
}

/**
 * @param {Partial<SeedingIdentity>} partial
 * @returns {SeedingIdentity}
 */
export function createSeedingIdentity(partial = {}) {
  const competitionId = String(partial.competitionId || "").trim();
  const contextId = String(partial.contextId || "").trim();

  if (!isNonEmptyString(competitionId)) {
    throw new SeedingRuntimeError(
      SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
      "SeedingIdentity requires competitionId",
      {}
    );
  }
  if (!isNonEmptyString(contextId)) {
    throw new SeedingRuntimeError(
      SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
      "SeedingIdentity requires contextId",
      { competitionId }
    );
  }

  const key =
    isNonEmptyString(partial.key) && String(partial.key).includes("::")
      ? String(partial.key)
      : buildSeedingIdentityKey({ competitionId, contextId });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId,
    kind: SEEDING_IDENTITY_KIND,
    contextId,
    key,
  });
}
