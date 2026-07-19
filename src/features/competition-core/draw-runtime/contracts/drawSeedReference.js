/**
 * Phase 3H — opaque SeedAssignment reference (consumes Phase 3G contracts).
 * Does not import Seeding Runtime implementation.
 */

import { isNonEmptyString } from "../../participants/contracts/shared.js";

/**
 * @typedef {Object} DrawSeedReference
 * @property {string} assignmentIdentityKey
 * @property {string} candidateIdentityKey
 * @property {number} seedNumber
 * @property {string|null} [seedTier]
 * @property {string|null} [candidateReference]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<DrawSeedReference> & Record<string, unknown>} [partial]
 * @returns {DrawSeedReference}
 */
export function createDrawSeedReference(partial = {}) {
  const seedNumber = Number(partial.seedNumber);
  const candidateIdentityKey = String(partial.candidateIdentityKey || "").trim();
  const assignmentIdentityKey = isNonEmptyString(partial.assignmentIdentityKey)
    ? String(partial.assignmentIdentityKey).trim()
    : isNonEmptyString(partial.identityKey)
      ? String(partial.identityKey).trim()
      : `SEED::${seedNumber}::${candidateIdentityKey}`;

  return {
    assignmentIdentityKey,
    candidateIdentityKey,
    seedNumber: Number.isFinite(seedNumber) ? seedNumber : NaN,
    seedTier: partial.seedTier != null ? String(partial.seedTier) : null,
    candidateReference:
      partial.candidateReference != null
        ? String(partial.candidateReference)
        : partial.metadata &&
            typeof partial.metadata === "object" &&
            /** @type {Record<string, unknown>} */ (partial.metadata).candidateReference != null
          ? String(
              /** @type {Record<string, unknown>} */ (partial.metadata)
                .candidateReference
            )
          : null,
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : undefined,
  };
}

/**
 * Normalize a Phase 3G-shaped SeedAssignment or plain object into DrawSeedReference.
 * @param {unknown} assignment
 * @returns {DrawSeedReference}
 */
export function mapSeedAssignmentToReference(assignment) {
  const raw =
    assignment && typeof assignment === "object"
      ? /** @type {Record<string, unknown>} */ (assignment)
      : {};
  return createDrawSeedReference({
    assignmentIdentityKey: raw.identityKey || raw.assignmentIdentityKey || raw.assignmentId,
    candidateIdentityKey: raw.candidateIdentityKey,
    seedNumber: raw.seedNumber,
    seedTier: raw.seedTier,
    candidateReference:
      raw.candidateReference ||
      (raw.metadata && typeof raw.metadata === "object"
        ? /** @type {Record<string, unknown>} */ (raw.metadata).candidateReference
        : null),
    metadata: raw.metadata,
  });
}
