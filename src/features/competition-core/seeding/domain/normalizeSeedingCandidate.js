import { deepFreeze } from "./deepFreeze.js";
import {
  ELIGIBILITY_STATUS,
  ELIGIBILITY_STATUS_VALUES,
  ENTRY_TYPE_VALUES,
} from "./constants.js";
import {
  normalizeExplicitTimestamp,
  normalizeOpaqueId,
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";

/**
 * @typedef {Object} SubjectRef
 * @property {string} kind
 * @property {string} id
 */

/**
 * @typedef {Object} SeedingCandidate
 * @property {string} entryId
 * @property {SubjectRef} subjectRef
 * @property {string} entryType
 * @property {string|null} divisionId
 * @property {string|null} categoryId
 * @property {string} eligibilityStatus
 * @property {ReadonlyArray<string>} eligibilityReasonCodes
 * @property {number|null} rankingPosition
 * @property {number|null} rankingScore
 * @property {number|null} ratingValue
 * @property {import('./normalizeHelpers.js').NormalizedTimestamp|null} registrationTimestamp
 * @property {Readonly<Record<string, unknown>>|null} sourceMetadata
 * @property {string} stableCanonicalId
 * @property {string|null} [eligibilityDecisionRef]
 */

/**
 * @param {unknown} raw
 * @param {string} [entryHint]
 * @returns {Readonly<SubjectRef>}
 */
function normalizeSubjectRef(raw, entryHint) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "subjectRef is required as { kind, id }",
      { entryId: entryHint, field: "subjectRef" }
    );
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const kind = normalizeOpaqueId(obj.kind);
  const id = normalizeOpaqueId(obj.id);
  if (!kind || !id) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "subjectRef.kind and subjectRef.id are required",
      { entryId: entryHint, field: "subjectRef" }
    );
  }
  return deepFreeze({ kind, id });
}

/**
 * Optional ranking/rating numeric fields (Owner Phase 1C remediation):
 * - absent / null / "" → missing (null)
 * - finite number including 0 → preserved
 * - NaN / ±Infinity → INVALID_CANDIDATE (never coerced to missing)
 * - unsupported present types → INVALID_CANDIDATE
 *
 * @param {unknown} value
 * @param {string} field
 * @param {string|undefined} entryId
 * @returns {number|null}
 */
function normalizeOptionalNumericField(value, field, entryId) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "number") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      `${field} must be a finite number when provided`,
      { entryId, field, value }
    );
  }
  if (!Number.isFinite(value)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      `${field} must be a finite number when provided (NaN/Infinity rejected)`,
      { entryId, field, value }
    );
  }
  return value;
}

/**
 * Validate and normalize a single SeedingCandidate. Does not mutate caller input.
 *
 * @param {unknown} raw
 * @param {{ scopeEntryType?: string, scopeDivisionId?: string|null, scopeCategoryId?: string|null }} [context]
 * @returns {Readonly<SeedingCandidate>}
 */
export function normalizeSeedingCandidate(raw, context = {}) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "SeedingCandidate must be a non-null object"
    );
  }

  // Snapshot caller object identity checks happen in tests; we never write to raw.
  const input = /** @type {Record<string, unknown>} */ (raw);

  const entryId = normalizeOpaqueId(input.entryId);
  if (!entryId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "entryId is required",
      { field: "entryId" }
    );
  }

  const stableCanonicalId = normalizeOpaqueId(input.stableCanonicalId);
  if (!stableCanonicalId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.MISSING_STABLE_IDENTIFIER,
      "stableCanonicalId is required",
      { entryId, field: "stableCanonicalId" }
    );
  }

  const entryType = normalizeOpaqueId(input.entryType);
  if (!entryType || !ENTRY_TYPE_VALUES.has(entryType)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "entryType must be PARTICIPANT | ENTRY | PAIR | TEAM",
      { entryId, field: "entryType", value: input.entryType }
    );
  }
  if (
    context.scopeEntryType != null &&
    entryType !== context.scopeEntryType
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "candidate entryType must match scope entryType",
      {
        entryId,
        field: "entryType",
        scopeEntryType: context.scopeEntryType,
        entryType,
      }
    );
  }

  let divisionId = null;
  if (input.divisionId != null && input.divisionId !== "") {
    divisionId = normalizeOpaqueId(input.divisionId);
    if (!divisionId) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_CANDIDATE,
        "divisionId is empty after normalization",
        { entryId, field: "divisionId" }
      );
    }
  } else if (context.scopeDivisionId != null) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "divisionId is required when scope has divisionId",
      { entryId, field: "divisionId" }
    );
  } else if (
    !Object.prototype.hasOwnProperty.call(context, "scopeDivisionId")
  ) {
    // No scope context: divisionId is mandatory on the domain candidate (doc 08).
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "divisionId is required on candidate",
      { entryId, field: "divisionId" }
    );
  }
  if (
    context.scopeDivisionId != null &&
    divisionId !== context.scopeDivisionId
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "candidate divisionId must match scope",
      { entryId, field: "divisionId" }
    );
  }

  let categoryId = null;
  if (input.categoryId != null && input.categoryId !== "") {
    categoryId = normalizeOpaqueId(input.categoryId);
    if (!categoryId) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_CANDIDATE,
        "categoryId is empty after normalization",
        { entryId, field: "categoryId" }
      );
    }
  } else if (context.scopeCategoryId != null) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "categoryId is required when scope has categoryId",
      { entryId, field: "categoryId" }
    );
  }
  if (
    context.scopeCategoryId != null &&
    categoryId !== context.scopeCategoryId
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "candidate categoryId must match scope",
      { entryId, field: "categoryId" }
    );
  }

  const eligibilityStatusRaw = normalizeOpaqueId(input.eligibilityStatus);
  if (
    !eligibilityStatusRaw ||
    !ELIGIBILITY_STATUS_VALUES.has(eligibilityStatusRaw)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "eligibilityStatus must be ELIGIBLE | INELIGIBLE | UNKNOWN",
      { entryId, field: "eligibilityStatus", value: input.eligibilityStatus }
    );
  }

  let eligibilityReasonCodes = [];
  if (input.eligibilityReasonCodes == null) {
    eligibilityReasonCodes = [];
  } else if (!Array.isArray(input.eligibilityReasonCodes)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_CANDIDATE,
      "eligibilityReasonCodes must be an array",
      { entryId, field: "eligibilityReasonCodes" }
    );
  } else {
    eligibilityReasonCodes = input.eligibilityReasonCodes.map((code, index) => {
      const normalized = normalizeOpaqueId(code);
      if (!normalized) {
        throwSeedingError(
          SEEDING_ERROR_CODE.INVALID_CANDIDATE,
          "eligibilityReasonCodes entries must be non-empty strings",
          { entryId, field: `eligibilityReasonCodes[${index}]` }
        );
      }
      return normalized;
    });
  }

  const eligibilityDecisionRef =
    input.eligibilityDecisionRef == null ||
    input.eligibilityDecisionRef === ""
      ? null
      : normalizeOpaqueId(input.eligibilityDecisionRef);

  const rankingPosition = normalizeOptionalNumericField(
    input.rankingPosition,
    "rankingPosition",
    entryId
  );
  const rankingScore = normalizeOptionalNumericField(
    input.rankingScore,
    "rankingScore",
    entryId
  );
  const ratingValue = normalizeOptionalNumericField(
    input.ratingValue,
    "ratingValue",
    entryId
  );

  const registrationTimestamp = normalizeExplicitTimestamp(
    input.registrationTimestamp,
    "registrationTimestamp"
  );

  let sourceMetadata = null;
  if (input.sourceMetadata != null) {
    if (
      typeof input.sourceMetadata !== "object" ||
      Array.isArray(input.sourceMetadata)
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_CANDIDATE,
        "sourceMetadata must be a plain object when provided",
        { entryId, field: "sourceMetadata" }
      );
    }
    sourceMetadata = deepFreeze({
      .../** @type {Record<string, unknown>} */ (input.sourceMetadata),
    });
  }

  /** @type {SeedingCandidate} */
  const candidate = {
    entryId,
    subjectRef: normalizeSubjectRef(input.subjectRef, entryId),
    entryType,
    divisionId,
    categoryId,
    eligibilityStatus: eligibilityStatusRaw,
    eligibilityReasonCodes: deepFreeze(eligibilityReasonCodes.slice()),
    rankingPosition,
    rankingScore,
    ratingValue,
    registrationTimestamp,
    sourceMetadata,
    stableCanonicalId,
    eligibilityDecisionRef,
  };

  return deepFreeze(candidate);
}

export { ELIGIBILITY_STATUS };
