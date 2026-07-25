/**
 * Data classification contracts and most-restrictive resolver (I&A-11).
 * Unknown classification fails closed — never defaults to PUBLIC.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";
import {
  ANALYTICS_DATA_CLASSIFICATION,
  ANALYTICS_DATA_CLASSIFICATION_RANK,
  isPrivacyEnumValue,
} from "./enums.js";

/**
 * @param {unknown} classification
 * @returns {import("../contracts/result.js").Result}
 */
export function validateDataClassification(classification) {
  if (!isPrivacyEnumValue(classification, ANALYTICS_DATA_CLASSIFICATION)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_UNKNOWN,
        "Unknown or missing data classification fails closed",
        "classification",
        { provided: typeof classification === "string" ? classification : null }
      )
    );
  }
  return ok(classification);
}

/**
 * Deterministic most-restrictive classification across a set.
 * @param {unknown} classifications
 * @returns {import("../contracts/result.js").Result}
 */
export function resolveMostRestrictiveClassification(classifications) {
  if (!Array.isArray(classifications) || classifications.length === 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_INVALID,
        "Classification set must be a non-empty array",
        "classifications"
      )
    );
  }

  let mostRestrictive = null;
  let highestRank = -1;

  for (const item of classifications) {
    const validated = validateDataClassification(item);
    if (!validated.ok) return validated;
    const rank = ANALYTICS_DATA_CLASSIFICATION_RANK[validated.value];
    if (rank > highestRank) {
      highestRank = rank;
      mostRestrictive = validated.value;
    }
  }

  return ok(mostRestrictive);
}

/**
 * Classification inheritance: child inherits parent when child omitted;
 * when both present, most-restrictive wins.
 * @param {unknown} parent
 * @param {unknown} child
 * @returns {import("../contracts/result.js").Result}
 */
export function resolveClassificationInheritance(parent, child) {
  if (child === undefined || child === null) {
    return validateDataClassification(parent);
  }
  if (parent === undefined || parent === null) {
    return validateDataClassification(child);
  }
  return resolveMostRestrictiveClassification([parent, child]);
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsDataClassificationRef(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_INVALID,
        "DataClassificationRef must be a plain object",
        "classificationRef"
      )
    );
  }

  const classificationResult = validateDataClassification(input.classification);
  if (!classificationResult.ok) return classificationResult;

  if (!isNonEmptyString(input.subjectKind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_INVALID,
        "subjectKind is required",
        "classificationRef.subjectKind"
      )
    );
  }

  if (!isNonEmptyString(input.subjectId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_INVALID,
        "subjectId is required",
        "classificationRef.subjectId"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const ref = {
    subjectKind: String(input.subjectKind).trim(),
    subjectId: String(input.subjectId).trim(),
    classification: classificationResult.value,
  };

  if (input.subjectVersion !== undefined) {
    if (!isNonEmptyString(input.subjectVersion)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_INVALID,
          "subjectVersion must be a non-empty string when provided",
          "classificationRef.subjectVersion"
        )
      );
    }
    ref.subjectVersion = String(input.subjectVersion).trim();
  }

  if (input.inheritedFrom !== undefined) {
    if (!isNonEmptyString(input.inheritedFrom)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_CLASSIFICATION_INVALID,
          "inheritedFrom must be a non-empty string when provided",
          "classificationRef.inheritedFrom"
        )
      );
    }
    ref.inheritedFrom = String(input.inheritedFrom).trim();
  }

  return ok(deepFreeze(ref));
}
