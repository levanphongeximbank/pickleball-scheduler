import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import { classificationError } from "../errors/classificationError.js";
import { isNonEmptyString } from "../contracts/shared.js";
import { DEFINITION_STATUS, isDefinitionStatus } from "../enums/definitionStatus.js";
import {
  DIVISION_CATEGORY_LIFECYCLE,
  isDivisionCategoryLifecycle,
} from "../enums/divisionCategoryLifecycle.js";
import { isGenderClass } from "../enums/genderClass.js";
import { isAccessMode } from "../enums/accessMode.js";
import { CLASSIFICATION_ENTITY_KIND } from "../enums/entityKind.js";
import { buildCategoryKey } from "../keys/buildCategoryKey.js";
import { buildDivisionKey } from "../keys/buildDivisionKey.js";
import { buildDivisionCategoryKey } from "../keys/buildDivisionCategoryKey.js";
import { normalizeClassificationCode } from "../keys/normalizeCode.js";

/**
 * @param {unknown} input
 * @param {import('../errors/classificationError.js').ClassificationIssue[]} errors
 */
export function requireTenantAndCompetition(input, errors) {
  if (!input || typeof input !== "object") {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_TYPE,
        "",
        "Classification entity must be an object"
      )
    );
    return;
  }
  if (!isNonEmptyString(/** @type {any} */ (input).tenantId)) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.TENANT_ID_REQUIRED,
        "tenantId",
        "tenantId is required"
      )
    );
  }
  if (!isNonEmptyString(/** @type {any} */ (input).competitionId)) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.COMPETITION_ID_REQUIRED,
        "competitionId",
        "competitionId is required"
      )
    );
  }
}

/**
 * @param {unknown} input
 * @returns {import('../errors/classificationError.js').ClassificationIssue[]}
 */
export function validateCompetitionCategoryShape(input) {
  const errors = [];
  requireTenantAndCompetition(input, errors);
  if (!input || typeof input !== "object") {
    return errors;
  }
  const entity = /** @type {Record<string, unknown>} */ (input);

  if (entity.entityKind != null && entity.entityKind !== CLASSIFICATION_ENTITY_KIND.CATEGORY) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.ENTITY_KIND_COLLISION,
        "entityKind",
        "CompetitionCategory entityKind must be competition_category"
      )
    );
  }
  if (!isNonEmptyString(entity.id)) {
    errors.push(
      classificationError(CLASSIFICATION_ERROR_CODE.REQUIRED, "id", "id is required")
    );
  }
  const codeResult = normalizeClassificationCode(entity.code);
  if (!codeResult.ok) {
    errors.push(...codeResult.errors);
  }
  if (!isNonEmptyString(entity.name) && !isNonEmptyString(entity.label)) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.REQUIRED,
        "name",
        "name or label is required"
      )
    );
  }
  if (entity.status != null && !isDefinitionStatus(entity.status)) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_STATUS,
        "status",
        "Invalid definition status"
      )
    );
  }
  if (entity.genderClass != null && !isGenderClass(entity.genderClass)) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_TYPE,
        "genderClass",
        "Invalid genderClass"
      )
    );
  }
  if (entity.access != null && !isAccessMode(entity.access)) {
    errors.push(
      classificationError(CLASSIFICATION_ERROR_CODE.INVALID_TYPE, "access", "Invalid access mode")
    );
  }

  if (codeResult.ok && isNonEmptyString(entity.competitionId)) {
    const expected = buildCategoryKey(
      /** @type {string} */ (entity.competitionId),
      /** @type {string} */ (codeResult.value)
    );
    if (expected.ok && entity.key && entity.key !== expected.value) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.INVALID_KEY,
          "key",
          "category key does not match deterministic formula",
          { expected: expected.value, actual: entity.key }
        )
      );
    }
  }

  return errors;
}

/**
 * @param {unknown} input
 * @returns {import('../errors/classificationError.js').ClassificationIssue[]}
 */
export function validateCompetitionDivisionShape(input) {
  const errors = [];
  requireTenantAndCompetition(input, errors);
  if (!input || typeof input !== "object") {
    return errors;
  }
  const entity = /** @type {Record<string, unknown>} */ (input);

  if (entity.entityKind != null && entity.entityKind !== CLASSIFICATION_ENTITY_KIND.DIVISION) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.ENTITY_KIND_COLLISION,
        "entityKind",
        "CompetitionDivision entityKind must be competition_division"
      )
    );
  }
  if (!isNonEmptyString(entity.id)) {
    errors.push(
      classificationError(CLASSIFICATION_ERROR_CODE.REQUIRED, "id", "id is required")
    );
  }
  const codeResult = normalizeClassificationCode(entity.code);
  if (!codeResult.ok) {
    errors.push(...codeResult.errors);
  }
  if (!isNonEmptyString(entity.name)) {
    errors.push(
      classificationError(CLASSIFICATION_ERROR_CODE.REQUIRED, "name", "name is required")
    );
  }
  if (entity.status != null && !isDefinitionStatus(entity.status)) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_STATUS,
        "status",
        "Invalid definition status"
      )
    );
  }

  if (codeResult.ok && isNonEmptyString(entity.competitionId)) {
    const expected = buildDivisionKey(
      /** @type {string} */ (entity.competitionId),
      /** @type {string} */ (codeResult.value)
    );
    if (expected.ok && entity.key && entity.key !== expected.value) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.INVALID_KEY,
          "key",
          "division key does not match deterministic formula",
          { expected: expected.value, actual: entity.key }
        )
      );
    }
  }

  return errors;
}

/**
 * @param {unknown} input
 * @returns {import('../errors/classificationError.js').ClassificationIssue[]}
 */
export function validateCompetitionDivisionCategoryShape(input) {
  const errors = [];
  requireTenantAndCompetition(input, errors);
  if (!input || typeof input !== "object") {
    return errors;
  }
  const entity = /** @type {Record<string, unknown>} */ (input);

  if (
    entity.entityKind != null &&
    entity.entityKind !== CLASSIFICATION_ENTITY_KIND.DIVISION_CATEGORY
  ) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.ENTITY_KIND_COLLISION,
        "entityKind",
        "CompetitionDivisionCategory entityKind must be competition_division_category"
      )
    );
  }
  if (!isNonEmptyString(entity.id)) {
    errors.push(
      classificationError(CLASSIFICATION_ERROR_CODE.REQUIRED, "id", "id is required")
    );
  }
  if (!isNonEmptyString(entity.divisionId)) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.REQUIRED,
        "divisionId",
        "divisionId is required"
      )
    );
  }
  if (!isNonEmptyString(entity.categoryId)) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.REQUIRED,
        "categoryId",
        "categoryId is required"
      )
    );
  }
  if (entity.divisionId && entity.categoryId && entity.divisionId === entity.categoryId) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.ENTITY_KIND_COLLISION,
        "divisionId",
        "divisionId and categoryId must reference different entities"
      )
    );
  }

  const divCode = normalizeClassificationCode(entity.divisionCode);
  const catCode = normalizeClassificationCode(entity.categoryCode);
  if (!divCode.ok) errors.push(...divCode.errors);
  if (!catCode.ok) errors.push(...catCode.errors);

  if (entity.lifecycleStatus != null && !isDivisionCategoryLifecycle(entity.lifecycleStatus)) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.INVALID_STATUS,
        "lifecycleStatus",
        "Invalid DivisionCategory lifecycle status"
      )
    );
  }

  if (divCode.ok && catCode.ok && isNonEmptyString(entity.competitionId)) {
    const expected = buildDivisionCategoryKey(
      /** @type {string} */ (entity.competitionId),
      /** @type {string} */ (divCode.value),
      /** @type {string} */ (catCode.value)
    );
    if (expected.ok && entity.key && entity.key !== expected.value) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.INVALID_KEY,
          "key",
          "divisionCategory key does not match deterministic formula",
          { expected: expected.value, actual: entity.key }
        )
      );
    }
  }

  return errors;
}

export { DEFINITION_STATUS, DIVISION_CATEGORY_LIFECYCLE };
