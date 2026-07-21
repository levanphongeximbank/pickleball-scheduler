/**
 * CORE-06 Phase 1C/1D — MissingLineupResolution contract.
 * Outcome envelope for missing-lineup policy; Format owns composition rules.
 */

import { PARTICIPANT_SCHEMA_VERSION } from "../../participants/contracts/shared.js";

/**
 * Injected strategy identifiers (policy decides which applies).
 * Do not assume every missing lineup is randomizable.
 */
export const MISSING_LINEUP_POLICY = Object.freeze({
  RANDOM: "random",
  FORFEIT_PENDING: "forfeit_pending",
  MANUAL_PENDING: "manual_pending",
  BLOCKED: "blocked",
});

/** @type {ReadonlySet<string>} */
export const MISSING_LINEUP_POLICY_VALUES = new Set(
  Object.values(MISSING_LINEUP_POLICY)
);

/**
 * Canonical resolution outcomes recorded by CORE-06.
 * RANDOMIZED does not auto-publish — caller must invoke Phase 1C lifecycle.
 */
export const MISSING_LINEUP_OUTCOME = Object.freeze({
  RANDOMIZED: "RANDOMIZED",
  MANUAL_PENDING: "MANUAL_PENDING",
  FORFEIT_PENDING: "FORFEIT_PENDING",
  BLOCKED: "BLOCKED",
});

/** @type {ReadonlySet<string>} */
export const MISSING_LINEUP_OUTCOME_VALUES = new Set(
  Object.values(MISSING_LINEUP_OUTCOME)
);

/**
 * @typedef {Object} MissingLineupResolution
 * @property {string} schemaVersion
 * @property {string} policy
 * @property {string|null} outcome
 * @property {string|null} seed
 * @property {string|null} seedFingerprint
 * @property {string|null} algorithmId
 * @property {string|null} algorithmVersion
 * @property {string|null} outcomeLineupId
 * @property {string|null} outcomeRevisionId
 * @property {string|null} outcomeStatus
 * @property {string|null} reason
 * @property {string[]} reasonCodes
 * @property {Record<string, unknown>} details
 */

/**
 * @param {Partial<MissingLineupResolution>} [partial]
 * @returns {MissingLineupResolution}
 */
export function createMissingLineupResolution(partial = {}) {
  const policyRaw = String(partial.policy || "").trim();
  const policy = MISSING_LINEUP_POLICY_VALUES.has(policyRaw)
    ? policyRaw
    : String(partial.policy || "");
  const outcomeRaw =
    partial.outcome != null ? String(partial.outcome).trim() : "";
  const outcome = MISSING_LINEUP_OUTCOME_VALUES.has(outcomeRaw)
    ? outcomeRaw
    : outcomeRaw || null;
  const reasonCodes = Array.isArray(partial.reasonCodes)
    ? Object.freeze(
        partial.reasonCodes
          .map((c) => String(c || "").trim())
          .filter(Boolean)
      )
    : Object.freeze([]);
  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    policy,
    outcome,
    seed:
      partial.seed != null && String(partial.seed).trim() !== ""
        ? String(partial.seed).trim()
        : null,
    seedFingerprint:
      partial.seedFingerprint != null &&
      String(partial.seedFingerprint).trim() !== ""
        ? String(partial.seedFingerprint).trim()
        : null,
    algorithmId:
      partial.algorithmId != null && String(partial.algorithmId).trim() !== ""
        ? String(partial.algorithmId).trim()
        : null,
    algorithmVersion:
      partial.algorithmVersion != null &&
      String(partial.algorithmVersion).trim() !== ""
        ? String(partial.algorithmVersion).trim()
        : null,
    outcomeLineupId:
      partial.outcomeLineupId != null &&
      String(partial.outcomeLineupId).trim() !== ""
        ? String(partial.outcomeLineupId).trim()
        : null,
    outcomeRevisionId:
      partial.outcomeRevisionId != null &&
      String(partial.outcomeRevisionId).trim() !== ""
        ? String(partial.outcomeRevisionId).trim()
        : null,
    outcomeStatus:
      partial.outcomeStatus != null &&
      String(partial.outcomeStatus).trim() !== ""
        ? String(partial.outcomeStatus).trim()
        : null,
    reason:
      partial.reason != null && String(partial.reason).trim() !== ""
        ? String(partial.reason).trim()
        : null,
    reasonCodes,
    details:
      partial.details && typeof partial.details === "object"
        ? Object.freeze({ ...partial.details })
        : Object.freeze({}),
  });
}
