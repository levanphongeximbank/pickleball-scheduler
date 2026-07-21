/**
 * CORE-09 — MatchDependency contract.
 *
 * Defaults (documented):
 * - schemaVersion omitted → MATCH_GENERATION_SCHEMA_VERSION
 * - logicalMatchKey / participantId / placementRef / drawId omitted → null
 * - metadata omitted → {}
 *
 * type is REQUIRED. Unknown type → throws (never defaults to DIRECT_PARTICIPANT).
 */

import { isMatchDependencyType } from "../enums/dependencyType.js";
import { MATCH_GENERATION_SCHEMA_VERSION } from "../constants.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";

/**
 * @typedef {Object} MatchDependency
 * @property {string} schemaVersion
 * @property {string} type
 * @property {string|null} logicalMatchKey
 * @property {string|null} participantId
 * @property {string|null} placementRef
 * @property {string|null} drawId
 * @property {Readonly<Record<string, unknown>>} metadata
 */

/**
 * @param {Partial<MatchDependency>} [partial]
 * @returns {MatchDependency}
 */
export function createMatchDependency(partial = {}) {
  if (!isMatchDependencyType(partial?.type)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE,
      "MatchDependency.type must be a known MATCH_DEPENDENCY_TYPE",
      { type: partial?.type ?? null }
    );
  }

  return Object.freeze({
    schemaVersion: String(
      partial.schemaVersion ?? MATCH_GENERATION_SCHEMA_VERSION
    ),
    type: partial.type,
    logicalMatchKey:
      typeof partial.logicalMatchKey === "string" && partial.logicalMatchKey.trim()
        ? partial.logicalMatchKey.trim()
        : null,
    participantId:
      typeof partial.participantId === "string" && partial.participantId.trim()
        ? partial.participantId.trim()
        : null,
    placementRef:
      typeof partial.placementRef === "string" && partial.placementRef.trim()
        ? partial.placementRef.trim()
        : null,
    drawId:
      typeof partial.drawId === "string" && partial.drawId.trim()
        ? partial.drawId.trim()
        : null,
    metadata: freezeMetadata(partial.metadata || {}),
  });
}
