import { deepFreeze } from "../domain/deepFreeze.js";
import {
  MISSING_VALUE_BEHAVIOUR,
  MISSING_VALUE_BEHAVIOUR_VALUES,
  PRIMARY_ORDERING_SOURCE_VALUES,
  SORT_DIRECTION,
  SORT_DIRECTION_VALUES,
  DEFAULT_FIELD_SORT_DIRECTION,
} from "../domain/constants.js";
import {
  normalizeOpaqueId,
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";
import { normalizeTieBreakSequence } from "./normalizeTieBreakSequence.js";

/**
 * @typedef {Object} NormalizedSeedingPolicy
 * @property {string} policyId
 * @property {string} policyVersion
 * @property {string} primaryOrderingSource
 * @property {string} sortDirection
 * @property {string} missingValueBehaviour
 * @property {ReadonlyArray<import('./normalizeTieBreakSequence.js').NormalizedTieBreakStep>} tieBreakSequence
 * @property {number} seedNumberStart
 * @property {number|null} maximumSeededEntries
 * @property {string} manualOverrideMode
 */

/**
 * Normalize SeedingPolicy ordering + Phase 1D allocation fields (docs 08 / 09 / 10).
 *
 * @param {unknown} raw
 * @returns {Readonly<NormalizedSeedingPolicy>}
 */
export function normalizeSeedingPolicy(raw) {
  if (raw == null) {
    throwSeedingError(
      SEEDING_ERROR_CODE.POLICY_REQUIRED,
      "SeedingPolicy is required"
    );
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.POLICY_REQUIRED,
      "SeedingPolicy must be a non-null object"
    );
  }

  const input = /** @type {Record<string, unknown>} */ (raw);

  const policyId = normalizeOpaqueId(input.policyId ?? input.id);
  if (!policyId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.POLICY_REQUIRED,
      "policyId is required",
      { field: "policyId" }
    );
  }

  const policyVersionPrimary = normalizeOpaqueId(input.policyVersion);
  const policyVersionAlias =
    input.version == null || input.version === ""
      ? null
      : normalizeOpaqueId(input.version);

  if (policyVersionPrimary && policyVersionAlias && policyVersionPrimary !== policyVersionAlias) {
    throwSeedingError(
      SEEDING_ERROR_CODE.POLICY_VERSION_MISMATCH,
      "Conflicting policy version declarations on the same policy object",
      {
        policyVersion: policyVersionPrimary,
        version: policyVersionAlias,
      }
    );
  }

  const policyVersion = policyVersionPrimary || policyVersionAlias;
  if (!policyVersion) {
    throwSeedingError(
      SEEDING_ERROR_CODE.POLICY_REQUIRED,
      "policyVersion is required",
      { field: "policyVersion" }
    );
  }

  const primaryOrderingSource = normalizeOpaqueId(
    input.primaryOrderingSource ?? input.primarySource
  );
  if (
    !primaryOrderingSource ||
    !PRIMARY_ORDERING_SOURCE_VALUES.has(primaryOrderingSource)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
      "Unknown or unsupported primaryOrderingSource",
      { field: "primaryOrderingSource", value: input.primaryOrderingSource }
    );
  }

  let sortDirection = normalizeOpaqueId(input.sortDirection);
  if (sortDirection == null) {
    sortDirection =
      DEFAULT_FIELD_SORT_DIRECTION[primaryOrderingSource] || SORT_DIRECTION.ASC;
  }
  if (!SORT_DIRECTION_VALUES.has(sortDirection)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
      "sortDirection must be ASC or DESC",
      { field: "sortDirection", value: input.sortDirection }
    );
  }

  let missingValueBehaviour = normalizeOpaqueId(input.missingValueBehaviour);
  if (missingValueBehaviour == null) {
    missingValueBehaviour = MISSING_VALUE_BEHAVIOUR.SORT_LAST;
  }
  if (!MISSING_VALUE_BEHAVIOUR_VALUES.has(missingValueBehaviour)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
      "Invalid missingValueBehaviour",
      { field: "missingValueBehaviour", value: input.missingValueBehaviour }
    );
  }

  const tieBreakSequence = normalizeTieBreakSequence(input.tieBreakSequence);

  let seedNumberStart = 1;
  if (input.seedNumberStart != null && input.seedNumberStart !== "") {
    if (
      typeof input.seedNumberStart !== "number" ||
      !Number.isInteger(input.seedNumberStart) ||
      input.seedNumberStart < 1
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "seedNumberStart must be a positive integer",
        { field: "seedNumberStart", value: input.seedNumberStart }
      );
    }
    seedNumberStart = input.seedNumberStart;
  }

  let maximumSeededEntries = null;
  if (input.maximumSeededEntries != null && input.maximumSeededEntries !== "") {
    if (
      typeof input.maximumSeededEntries !== "number" ||
      !Number.isInteger(input.maximumSeededEntries) ||
      input.maximumSeededEntries < 1
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "maximumSeededEntries must be a positive integer when provided",
        { field: "maximumSeededEntries", value: input.maximumSeededEntries }
      );
    }
    maximumSeededEntries = input.maximumSeededEntries;
  }

  let manualOverrideMode = normalizeOpaqueId(input.manualOverrideMode);
  if (manualOverrideMode == null) {
    manualOverrideMode = "ALLOW_PARTIAL";
  }
  if (
    manualOverrideMode !== "DISALLOW" &&
    manualOverrideMode !== "ALLOW_PARTIAL" &&
    manualOverrideMode !== "REQUIRE_AUTHORIZED"
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "Invalid manualOverrideMode",
      { field: "manualOverrideMode", value: input.manualOverrideMode }
    );
  }

  /** @type {NormalizedSeedingPolicy} */
  const policy = {
    policyId,
    policyVersion,
    primaryOrderingSource,
    sortDirection,
    missingValueBehaviour,
    tieBreakSequence,
    seedNumberStart,
    maximumSeededEntries,
    manualOverrideMode,
  };

  return deepFreeze(policy);
}
