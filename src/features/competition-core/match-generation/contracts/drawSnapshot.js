/**
 * CORE-09 — frozen DrawSnapshot consumed via DrawResultPort.
 *
 * Defaults (documented):
 * - schemaVersion → MATCH_GENERATION_SCHEMA_VERSION
 * - categoryId omitted → null
 * - completionStatus omitted / unknown → INCOMPLETE (fail-closed toward rejection)
 * - empty arrays for placement catalogs when omitted
 * - metadata / deterministicOrderingMetadata → {}
 *
 * Unknown completionStatus does NOT become COMPLETE.
 */

import { MATCH_GENERATION_SCHEMA_VERSION } from "../constants.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";
import {
  deepFreezeCanonical,
  freezeMetadata,
} from "../services/canonicalFreeze.js";

export const DRAW_COMPLETION_STATUS = Object.freeze({
  COMPLETE: "COMPLETE",
  INCOMPLETE: "INCOMPLETE",
  FAILED: "FAILED",
});

/** @type {ReadonlySet<string>} */
export const DRAW_COMPLETION_STATUS_VALUES = new Set(
  Object.values(DRAW_COMPLETION_STATUS)
);

/**
 * @typedef {Object} DrawPlacementRef
 * @property {string} placementRef
 * @property {string|null} participantId
 * @property {string|null} seedRef
 * @property {string|null} groupId
 * @property {string|null} bracketId
 * @property {number|null} position
 * @property {boolean} isBye
 */

/**
 * @typedef {Object} DrawSnapshot
 * @property {string} schemaVersion
 * @property {string} drawId
 * @property {string} drawVersion
 * @property {string} drawFingerprint
 * @property {string} competitionId
 * @property {string} divisionId
 * @property {string|null} categoryId
 * @property {string} completionStatus
 * @property {ReadonlyArray<object>} stageDefinitions
 * @property {ReadonlyArray<object>} groupPlacements
 * @property {ReadonlyArray<object>} bracketPlacements
 * @property {ReadonlyArray<DrawPlacementRef>} participantPlacements
 * @property {ReadonlyArray<object>} seedReferences
 * @property {ReadonlyArray<object>} byePlacements
 * @property {Readonly<Record<string, unknown>>} deterministicOrderingMetadata
 * @property {Readonly<Record<string, unknown>>} metadata
 */

/**
 * @param {Partial<DrawPlacementRef>} [partial]
 * @returns {DrawPlacementRef}
 */
export function createDrawPlacementRef(partial = {}) {
  return Object.freeze({
    placementRef: String(partial.placementRef || "").trim(),
    participantId:
      typeof partial.participantId === "string" && partial.participantId.trim()
        ? partial.participantId.trim()
        : null,
    seedRef:
      typeof partial.seedRef === "string" && partial.seedRef.trim()
        ? partial.seedRef.trim()
        : null,
    groupId:
      typeof partial.groupId === "string" && partial.groupId.trim()
        ? partial.groupId.trim()
        : null,
    bracketId:
      typeof partial.bracketId === "string" && partial.bracketId.trim()
        ? partial.bracketId.trim()
        : null,
    position:
      typeof partial.position === "number" && Number.isInteger(partial.position)
        ? partial.position
        : null,
    isBye: partial.isBye === true,
  });
}

/**
 * @param {unknown} items
 * @param {string} path
 * @returns {ReadonlyArray<object>}
 */
function freezeObjectBag(items, path) {
  if (items == null) {
    return Object.freeze([]);
  }
  if (!Array.isArray(items)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
      `${path} must be an array`,
      { path }
    );
  }
  return Object.freeze(
    items.map((item, i) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new MatchGenerationContractError(
          MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
          `${path}[${i}] must be a plain object`,
          { path: `${path}[${i}]` }
        );
      }
      return deepFreezeCanonical(item, `${path}[${i}]`);
    })
  );
}

/**
 * @param {Partial<DrawSnapshot>} [partial]
 * @returns {DrawSnapshot}
 */
export function createDrawSnapshot(partial = {}) {
  let completionStatus = DRAW_COMPLETION_STATUS.INCOMPLETE;
  if (
    partial.completionStatus !== undefined &&
    partial.completionStatus !== null &&
    partial.completionStatus !== ""
  ) {
    if (!DRAW_COMPLETION_STATUS_VALUES.has(partial.completionStatus)) {
      throw new MatchGenerationContractError(
        MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE,
        "Unknown Draw completionStatus",
        { completionStatus: partial.completionStatus }
      );
    }
    completionStatus = partial.completionStatus;
  }

  const participantPlacements = Object.freeze(
    (Array.isArray(partial.participantPlacements)
      ? partial.participantPlacements
      : []
    ).map((p) => createDrawPlacementRef(p))
  );

  return Object.freeze({
    schemaVersion: String(
      partial.schemaVersion ?? MATCH_GENERATION_SCHEMA_VERSION
    ),
    drawId: String(partial.drawId || "").trim(),
    drawVersion: String(partial.drawVersion || "").trim(),
    drawFingerprint: String(partial.drawFingerprint || "").trim(),
    competitionId: String(partial.competitionId || "").trim(),
    divisionId: String(partial.divisionId || "").trim(),
    categoryId:
      typeof partial.categoryId === "string" && partial.categoryId.trim()
        ? partial.categoryId.trim()
        : null,
    completionStatus,
    stageDefinitions: freezeObjectBag(
      partial.stageDefinitions,
      "stageDefinitions"
    ),
    groupPlacements: freezeObjectBag(
      partial.groupPlacements,
      "groupPlacements"
    ),
    bracketPlacements: freezeObjectBag(
      partial.bracketPlacements,
      "bracketPlacements"
    ),
    participantPlacements,
    seedReferences: freezeObjectBag(partial.seedReferences, "seedReferences"),
    byePlacements: freezeObjectBag(partial.byePlacements, "byePlacements"),
    deterministicOrderingMetadata: freezeMetadata(
      partial.deterministicOrderingMetadata || {},
      "deterministicOrderingMetadata"
    ),
    metadata: freezeMetadata(partial.metadata || {}),
  });
}
