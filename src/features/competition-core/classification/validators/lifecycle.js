import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  classificationError,
  classificationFail,
  classificationOk,
} from "../errors/classificationError.js";
import {
  DIVISION_CATEGORY_ALLOWED_TRANSITIONS,
  DIVISION_CATEGORY_LIFECYCLE,
  isDivisionCategoryLifecycle,
} from "../enums/divisionCategoryLifecycle.js";
import { DEFINITION_STATUS, isDefinitionStatus } from "../enums/definitionStatus.js";
import { createAuditMetadata, isNonEmptyString } from "../contracts/shared.js";

/**
 * Definition lifecycle: DRAFT → ACTIVE → ARCHIVED (no reopen from ARCHIVED).
 */
export const DEFINITION_ALLOWED_TRANSITIONS = Object.freeze({
  [DEFINITION_STATUS.DRAFT]: Object.freeze([DEFINITION_STATUS.ACTIVE]),
  [DEFINITION_STATUS.ACTIVE]: Object.freeze([DEFINITION_STATUS.ARCHIVED]),
  [DEFINITION_STATUS.ARCHIVED]: Object.freeze([]),
});

const REFERENCE_SNAPSHOT_FIELDS = Object.freeze([
  "entryCount",
  "reservationCount",
  "drawCount",
  "matchCount",
]);

/**
 * @param {string} from
 * @param {string} to
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function validateDefinitionTransition(from, to) {
  if (!isDefinitionStatus(from) || !isDefinitionStatus(to)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_STATUS,
        "status",
        "Invalid definition status for transition"
      ),
    ]);
  }
  if (from === to) {
    return classificationOk();
  }
  const allowed = DEFINITION_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_TRANSITION,
        "status",
        `Invalid definition transition ${from} → ${to}`,
        { from, to }
      ),
    ]);
  }
  return classificationOk();
}

/**
 * Fail-closed evaluation of OPEN → DRAFT reference snapshot.
 * Missing checker, throw, undefined/incomplete result, or any count > 0 rejects.
 *
 * @param {unknown} referenceChecker
 * @returns {Promise<import('../errors/classificationError.js').ClassificationResult>}
 */
export async function evaluateOpenToDraftReferenceCheck(referenceChecker) {
  if (
    !referenceChecker ||
    typeof referenceChecker !== "object" ||
    typeof /** @type {any} */ (referenceChecker).getReferenceSnapshot !== "function"
  ) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_REQUIRED,
        "lifecycleStatus",
        "OPEN → DRAFT requires referenceChecker.getReferenceSnapshot"
      ),
    ]);
  }

  let snapshot;
  try {
    snapshot = await /** @type {any} */ (referenceChecker).getReferenceSnapshot();
  } catch (error) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_FAILED,
        "lifecycleStatus",
        "OPEN → DRAFT reference checker threw; transition rejected fail-closed",
        {
          message: error instanceof Error ? error.message : String(error),
        }
      ),
    ]);
  }

  if (snapshot == null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_INCOMPLETE,
        "lifecycleStatus",
        "OPEN → DRAFT reference snapshot missing or invalid; unavailable checker is not zero references"
      ),
    ]);
  }

  /** @type {Record<string, number>} */
  const counts = {};
  for (const field of REFERENCE_SNAPSHOT_FIELDS) {
    const value = /** @type {Record<string, unknown>} */ (snapshot)[field];
    if (value === undefined) {
      return classificationFail([
        classificationError(
          CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_INCOMPLETE,
          `referenceSnapshot.${field}`,
          `OPEN → DRAFT reference snapshot missing required field ${field}`
        ),
      ]);
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return classificationFail([
        classificationError(
          CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_INCOMPLETE,
          `referenceSnapshot.${field}`,
          `OPEN → DRAFT reference snapshot field ${field} must be a non-negative integer`,
          { value }
        ),
      ]);
    }
    counts[field] = value;
  }

  const blocking = REFERENCE_SNAPSHOT_FIELDS.filter((field) => counts[field] > 0);
  if (blocking.length > 0) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.REFERENCED_ENTITY,
        "lifecycleStatus",
        "OPEN → DRAFT rejected because entries, registration reservations, draws or matches exist",
        { counts, blockingFields: blocking }
      ),
    ]);
  }

  return classificationOk({ counts });
}

/**
 * @param {string} from
 * @param {string} to
 * @param {{
 *   referenceChecker?: {
 *     getReferenceSnapshot: () =>
 *       | {
 *           entryCount: number,
 *           reservationCount: number,
 *           drawCount: number,
 *           matchCount: number,
 *         }
 *       | Promise<{
 *           entryCount: number,
 *           reservationCount: number,
 *           drawCount: number,
 *           matchCount: number,
 *         }>
 *   }|null,
 *   auditReason?: string|null,
 * }} [options]
 * @returns {Promise<import('../errors/classificationError.js').ClassificationResult>}
 */
export async function validateDivisionCategoryTransition(from, to, options = {}) {
  if (!isDivisionCategoryLifecycle(from) || !isDivisionCategoryLifecycle(to)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_STATUS,
        "lifecycleStatus",
        "Invalid DivisionCategory lifecycle status for transition"
      ),
    ]);
  }
  if (from === to) {
    return classificationOk();
  }

  const allowed = DIVISION_CATEGORY_ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_TRANSITION,
        "lifecycleStatus",
        `Invalid DivisionCategory transition ${from} → ${to}`,
        { from, to }
      ),
    ]);
  }

  if (from === DIVISION_CATEGORY_LIFECYCLE.OPEN && to === DIVISION_CATEGORY_LIFECYCLE.DRAFT) {
    if (!isNonEmptyString(options.auditReason)) {
      return classificationFail([
        classificationError(
          CLASSIFICATION_ERROR_CODE.AUDIT_REASON_REQUIRED,
          "audit.reason",
          "OPEN → DRAFT requires an audit reason"
        ),
      ]);
    }
    return evaluateOpenToDraftReferenceCheck(options.referenceChecker);
  }

  return classificationOk();
}

/**
 * Apply a validated lifecycle transition (pure; caller must validate first).
 *
 * @param {import('../division-categories/createCompetitionDivisionCategory.js').CompetitionDivisionCategory} lane
 * @param {string} to
 * @param {{ auditReason?: string|null, actorId?: string|null }} [meta]
 * @returns {import('../division-categories/createCompetitionDivisionCategory.js').CompetitionDivisionCategory}
 */
export function applyDivisionCategoryTransition(lane, to, meta = {}) {
  return {
    ...lane,
    lifecycleStatus: to,
    revision: Number(lane.revision || 1) + 1,
    audit: createAuditMetadata({
      ...lane.audit,
      updatedAt: new Date().toISOString(),
      updatedBy: meta.actorId ?? lane.audit?.updatedBy ?? null,
      decidedAt: new Date().toISOString(),
      decidedBy: meta.actorId ?? null,
      reason: meta.auditReason ?? lane.audit?.reason ?? null,
    }),
  };
}

/**
 * Registration acceptance gate — only OPEN accepts new registrations.
 *
 * @param {import('../division-categories/createCompetitionDivisionCategory.js').CompetitionDivisionCategory} lane
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertRegistrationAccepted(lane) {
  const status = lane?.lifecycleStatus;
  if (status === DIVISION_CATEGORY_LIFECYCLE.OPEN) {
    return classificationOk();
  }
  if (status === DIVISION_CATEGORY_LIFECYCLE.DRAFT) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.NOT_OPEN,
        "lifecycleStatus",
        "DivisionCategory is DRAFT; registrations are rejected"
      ),
    ]);
  }
  if (status === DIVISION_CATEGORY_LIFECYCLE.LOCKED) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.LOCKED,
        "lifecycleStatus",
        "DivisionCategory is LOCKED; new registrations are rejected"
      ),
    ]);
  }
  if (status === DIVISION_CATEGORY_LIFECYCLE.CLOSED) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.CLOSED,
        "lifecycleStatus",
        "DivisionCategory is CLOSED; new registrations are rejected"
      ),
    ]);
  }
  if (status === DIVISION_CATEGORY_LIFECYCLE.ARCHIVED) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.ARCHIVED,
        "lifecycleStatus",
        "DivisionCategory is ARCHIVED; fully read-only"
      ),
    ]);
  }
  return classificationFail([
    classificationError(
      CLASSIFICATION_ERROR_CODE.NOT_OPEN,
      "lifecycleStatus",
      "DivisionCategory is not OPEN for registration"
    ),
  ]);
}

/**
 * LOCKED rejects structural, capacity and eligibility configuration changes.
 * ARCHIVED / CLOSED also reject config mutations.
 *
 * @param {import('../division-categories/createCompetitionDivisionCategory.js').CompetitionDivisionCategory} lane
 * @param {'structural'|'capacity'|'eligibility'|'other'} changeKind
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertDivisionCategoryMutable(lane, changeKind = "other") {
  const status = lane?.lifecycleStatus;
  if (status === DIVISION_CATEGORY_LIFECYCLE.ARCHIVED) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.ARCHIVED,
        "lifecycleStatus",
        "ARCHIVED DivisionCategory is fully read-only"
      ),
    ]);
  }
  if (status === DIVISION_CATEGORY_LIFECYCLE.LOCKED) {
    if (
      changeKind === "structural" ||
      changeKind === "capacity" ||
      changeKind === "eligibility"
    ) {
      return classificationFail([
        classificationError(
          CLASSIFICATION_ERROR_CODE.LOCKED,
          "lifecycleStatus",
          "LOCKED DivisionCategory rejects structural, capacity and eligibility configuration changes"
        ),
      ]);
    }
  }
  if (status === DIVISION_CATEGORY_LIFECYCLE.CLOSED && changeKind !== "other") {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.CLOSED,
        "lifecycleStatus",
        "CLOSED DivisionCategory rejects configuration changes"
      ),
    ]);
  }
  return classificationOk();
}
