/**
 * CORE-06 Phase 1C — MissingLineupResolution contract.
 * Outcome envelope for missing-lineup policy; algorithm remains Format-owned.
 */

import { PARTICIPANT_SCHEMA_VERSION } from "../../participants/contracts/shared.js";

export const MISSING_LINEUP_POLICY = Object.freeze({
  RANDOM: "random",
  FORFEIT_PENDING: "forfeit_pending",
  MANUAL_PENDING: "manual_pending",
});

/** @type {ReadonlySet<string>} */
export const MISSING_LINEUP_POLICY_VALUES = new Set(
  Object.values(MISSING_LINEUP_POLICY)
);

/**
 * @typedef {Object} MissingLineupResolution
 * @property {string} schemaVersion
 * @property {string} policy
 * @property {string|null} seed
 * @property {string|null} outcomeLineupId
 * @property {string|null} outcomeRevisionId
 * @property {string|null} outcomeStatus
 * @property {string|null} reason
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
  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    policy,
    seed:
      partial.seed != null && String(partial.seed).trim() !== ""
        ? String(partial.seed).trim()
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
    details:
      partial.details && typeof partial.details === "object"
        ? Object.freeze({ ...partial.details })
        : Object.freeze({}),
  });
}
