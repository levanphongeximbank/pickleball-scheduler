import { deepFreeze } from "./deepFreeze.js";
import {
  ENTRY_TYPE_VALUES,
  SCOPE_PROVENANCE_EXCLUSIONS,
} from "./constants.js";
import {
  normalizeOpaqueId,
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";

/**
 * @typedef {Object} SeedingScope
 * @property {string} competitionId
 * @property {string|null} competitionVersionId
 * @property {string|null} divisionId
 * @property {string|null} categoryId
 * @property {string|null} stageId
 * @property {string} entryType
 */

/**
 * Build canonical scope identity key (competition boundary only).
 * Excludes policy / snapshot / result / request provenance (doc 08 §3).
 *
 * @param {SeedingScope} scope
 * @returns {string}
 */
export function buildSeedingScopeKey(scope) {
  const parts = [
    scope.competitionId,
    scope.competitionVersionId == null ? "" : scope.competitionVersionId,
    scope.divisionId == null ? "" : scope.divisionId,
    scope.categoryId == null ? "" : scope.categoryId,
    scope.stageId == null ? "" : scope.stageId,
    scope.entryType,
  ];
  return parts.join("|");
}

/**
 * Validate and normalize SeedingScope. Does not mutate caller input.
 * Provenance fields on the input are ignored (not part of scope identity).
 *
 * @param {unknown} raw
 * @returns {Readonly<SeedingScope>}
 */
export function normalizeSeedingScope(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "SeedingScope must be a non-null object"
    );
  }

  const input = /** @type {Record<string, unknown>} */ (raw);

  const competitionId = normalizeOpaqueId(input.competitionId);
  if (!competitionId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "competitionId is required",
      { field: "competitionId" }
    );
  }

  const entryTypeRaw = normalizeOpaqueId(input.entryType);
  if (!entryTypeRaw || !ENTRY_TYPE_VALUES.has(entryTypeRaw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "entryType must be PARTICIPANT | ENTRY | PAIR | TEAM",
      { field: "entryType", value: input.entryType }
    );
  }

  const competitionVersionId =
    input.competitionVersionId == null || input.competitionVersionId === ""
      ? null
      : normalizeOpaqueId(input.competitionVersionId);
  if (
    input.competitionVersionId != null &&
    input.competitionVersionId !== "" &&
    competitionVersionId == null
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "competitionVersionId is empty after normalization",
      { field: "competitionVersionId" }
    );
  }

  const divisionId =
    input.divisionId == null || input.divisionId === ""
      ? null
      : normalizeOpaqueId(input.divisionId);
  if (
    input.divisionId != null &&
    input.divisionId !== "" &&
    divisionId == null
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "divisionId is empty after normalization",
      { field: "divisionId" }
    );
  }

  const categoryId =
    input.categoryId == null || input.categoryId === ""
      ? null
      : normalizeOpaqueId(input.categoryId);
  if (
    input.categoryId != null &&
    input.categoryId !== "" &&
    categoryId == null
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "categoryId is empty after normalization",
      { field: "categoryId" }
    );
  }

  if (divisionId == null && categoryId == null) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "At least one of divisionId or categoryId must identify the seed pool",
      { field: "divisionId|categoryId" }
    );
  }

  const stageId =
    input.stageId == null || input.stageId === ""
      ? null
      : normalizeOpaqueId(input.stageId);
  if (input.stageId != null && input.stageId !== "" && stageId == null) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_SCOPE,
      "stageId is empty after normalization",
      { field: "stageId" }
    );
  }

  /** @type {SeedingScope} */
  const scope = {
    competitionId,
    competitionVersionId,
    divisionId,
    categoryId,
    stageId,
    entryType: entryTypeRaw,
  };

  // Ensure provenance keys are never attached to normalized scope.
  for (let i = 0; i < SCOPE_PROVENANCE_EXCLUSIONS.length; i += 1) {
    const key = SCOPE_PROVENANCE_EXCLUSIONS[i];
    if (Object.prototype.hasOwnProperty.call(scope, key)) {
      delete /** @type {Record<string, unknown>} */ (scope)[key];
    }
  }

  return deepFreeze(scope);
}
