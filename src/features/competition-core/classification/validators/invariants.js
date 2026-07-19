import { CLASSIFICATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  classificationError,
  classificationFail,
  classificationOk,
} from "../errors/classificationError.js";
import { CLASSIFICATION_ENTITY_KIND } from "../enums/entityKind.js";
import { DEFINITION_STATUS } from "../enums/definitionStatus.js";
import { normalizeClassificationCode } from "../keys/normalizeCode.js";
import {
  validateCompetitionCategoryShape,
  validateCompetitionDivisionShape,
  validateCompetitionDivisionCategoryShape,
} from "./shapes.js";

/**
 * OD-07: Division and Category remain separate entity kinds.
 *
 * @param {unknown} division
 * @param {unknown} category
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertDivisionAndCategoryAreSeparate(division, category) {
  if (!division || !category) {
    return classificationOk();
  }
  if (division === category) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.ENTITY_KIND_COLLISION,
        "",
        "Division and Category must be separate entities (OD-07)"
      ),
    ]);
  }
  const d = /** @type {Record<string, unknown>} */ (division);
  const c = /** @type {Record<string, unknown>} */ (category);
  if (
    d.entityKind === CLASSIFICATION_ENTITY_KIND.CATEGORY ||
    c.entityKind === CLASSIFICATION_ENTITY_KIND.DIVISION
  ) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.ENTITY_KIND_COLLISION,
        "entityKind",
        "Division and Category entity kinds must not be swapped or merged (OD-07)"
      ),
    ]);
  }
  if (d.kind === "classification" && c.kind === "classification") {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.ENTITY_KIND_COLLISION,
        "kind",
        "Do not overload a shared classification kind for Division and Category (OD-07)"
      ),
    ]);
  }
  return classificationOk();
}

/**
 * @param {import('../categories/createCompetitionCategory.js').CompetitionCategory[]} categories
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertUniqueCategoryCodes(categories) {
  const seen = new Map();
  for (const cat of categories || []) {
    const codeResult = normalizeClassificationCode(cat?.code);
    if (!codeResult.ok) continue;
    const scope = `${cat.tenantId}|${cat.competitionId}|${codeResult.value}`;
    if (seen.has(scope) && seen.get(scope) !== cat.id) {
      return classificationFail([
        classificationError(
          CLASSIFICATION_ERROR_CODE.DUPLICATE_CATEGORY_CODE,
          "code",
          "Duplicate category code within competition",
          { code: codeResult.value, competitionId: cat.competitionId }
        ),
      ]);
    }
    seen.set(scope, cat.id);
  }
  return classificationOk();
}

/**
 * @param {import('../divisions/createCompetitionDivision.js').CompetitionDivision[]} divisions
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertUniqueDivisionCodes(divisions) {
  const seen = new Map();
  for (const div of divisions || []) {
    const codeResult = normalizeClassificationCode(div?.code);
    if (!codeResult.ok) continue;
    const scope = `${div.tenantId}|${div.competitionId}|${codeResult.value}`;
    if (seen.has(scope) && seen.get(scope) !== div.id) {
      return classificationFail([
        classificationError(
          CLASSIFICATION_ERROR_CODE.DUPLICATE_DIVISION_CODE,
          "code",
          "Duplicate division code within competition",
          { code: codeResult.value, competitionId: div.competitionId }
        ),
      ]);
    }
    seen.set(scope, div.id);
  }
  return classificationOk();
}

/**
 * @param {import('../division-categories/createCompetitionDivisionCategory.js').CompetitionDivisionCategory[]} lanes
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertUniqueDivisionCategoryPairs(lanes) {
  const seen = new Map();
  for (const lane of lanes || []) {
    const scope = `${lane.tenantId}|${lane.competitionId}|${lane.divisionId}|${lane.categoryId}`;
    if (seen.has(scope) && seen.get(scope) !== lane.id) {
      return classificationFail([
        classificationError(
          CLASSIFICATION_ERROR_CODE.DUPLICATE_DIVISION_CATEGORY,
          "",
          "Duplicate Division–Category combination within competition",
          {
            divisionId: lane.divisionId,
            categoryId: lane.categoryId,
            competitionId: lane.competitionId,
          }
        ),
      ]);
    }
    seen.set(scope, lane.id);
  }
  return classificationOk();
}

/**
 * Validate that DivisionCategory references existing Division + Category in same tenant/competition.
 *
 * @param {import('../division-categories/createCompetitionDivisionCategory.js').CompetitionDivisionCategory} lane
 * @param {import('../divisions/createCompetitionDivision.js').CompetitionDivision|null|undefined} division
 * @param {import('../categories/createCompetitionCategory.js').CompetitionCategory|null|undefined} category
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertDivisionCategoryReferences(lane, division, category) {
  const errors = [];
  if (!division) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.DIVISION_NOT_FOUND,
        "divisionId",
        "Referenced Division not found",
        { divisionId: lane?.divisionId }
      )
    );
  }
  if (!category) {
    errors.push(
      classificationError(
        CLASSIFICATION_ERROR_CODE.CATEGORY_NOT_FOUND,
        "categoryId",
        "Referenced Category not found",
        { categoryId: lane?.categoryId }
      )
    );
  }
  if (division && lane) {
    if (division.tenantId !== lane.tenantId) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.CROSS_TENANT_REFERENCE,
          "divisionId",
          "Division tenantId does not match DivisionCategory tenantId"
        )
      );
    }
    if (division.competitionId !== lane.competitionId) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.CROSS_COMPETITION_REFERENCE,
          "divisionId",
          "Division competitionId does not match DivisionCategory competitionId"
        )
      );
    }
  }
  if (category && lane) {
    if (category.tenantId !== lane.tenantId) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.CROSS_TENANT_REFERENCE,
          "categoryId",
          "Category tenantId does not match DivisionCategory tenantId"
        )
      );
    }
    if (category.competitionId !== lane.competitionId) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.CROSS_COMPETITION_REFERENCE,
          "categoryId",
          "Category competitionId does not match DivisionCategory competitionId"
        )
      );
    }
  }
  if (division && category) {
    if (division.tenantId !== category.tenantId) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.CROSS_TENANT_REFERENCE,
          "",
          "Division and Category belong to different tenants"
        )
      );
    }
    if (division.competitionId !== category.competitionId) {
      errors.push(
        classificationError(
          CLASSIFICATION_ERROR_CODE.CROSS_COMPETITION_REFERENCE,
          "",
          "Division and Category belong to different competitions"
        )
      );
    }
  }
  return errors.length ? classificationFail(errors) : classificationOk();
}

/**
 * Hard-delete forbidden when references exist.
 *
 * @param {{ hasReferences: boolean }} check
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertCanHardDelete(check) {
  if (check?.hasReferences === true) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.REFERENCED_ENTITY,
        "",
        "Hard delete forbidden while references exist; archive instead"
      ),
    ]);
  }
  return classificationOk();
}

/**
 * Archived definitions are read-only.
 *
 * @param {{ status?: string, lifecycleStatus?: string }} entity
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertNotArchivedReadOnly(entity) {
  if (
    entity?.status === DEFINITION_STATUS.ARCHIVED ||
    entity?.lifecycleStatus === "archived"
  ) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.ARCHIVED,
        "status",
        "Archived classification entities are read-only"
      ),
    ]);
  }
  return classificationOk();
}

/**
 * Silent entry migration is forbidden.
 *
 * @param {{ fromDivisionCategoryId?: string|null, toDivisionCategoryId?: string|null, explicitMigration?: boolean }} args
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function assertNoSilentEntryMigration(args = {}) {
  const fromId = args.fromDivisionCategoryId ?? null;
  const toId = args.toDivisionCategoryId ?? null;
  if (fromId && toId && fromId !== toId && args.explicitMigration !== true) {
    return classificationFail([
      classificationError(
        CLASSIFICATION_ERROR_CODE.SILENT_MIGRATION_FORBIDDEN,
        "divisionCategoryId",
        "Silent entry migration between DivisionCategory lanes is forbidden"
      ),
    ]);
  }
  return classificationOk();
}

/**
 * @param {unknown} input
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function validateCompetitionCategory(input) {
  const errors = validateCompetitionCategoryShape(input);
  return errors.length ? classificationFail(errors) : classificationOk(input);
}

/**
 * @param {unknown} input
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function validateCompetitionDivision(input) {
  const errors = validateCompetitionDivisionShape(input);
  return errors.length ? classificationFail(errors) : classificationOk(input);
}

/**
 * @param {unknown} input
 * @returns {import('../errors/classificationError.js').ClassificationResult}
 */
export function validateCompetitionDivisionCategory(input) {
  const errors = validateCompetitionDivisionCategoryShape(input);
  return errors.length ? classificationFail(errors) : classificationOk(input);
}
