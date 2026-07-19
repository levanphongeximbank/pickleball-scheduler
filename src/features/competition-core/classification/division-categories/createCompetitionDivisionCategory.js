import {
  CLASSIFICATION_SCHEMA_VERSION,
  createAuditMetadata,
  createFormatExtension,
  toFiniteNumber,
} from "../contracts/shared.js";
import { DIVISION_CATEGORY_LIFECYCLE } from "../enums/divisionCategoryLifecycle.js";
import { CLASSIFICATION_ENTITY_KIND } from "../enums/entityKind.js";
import { createEligibilityDescriptor } from "../contracts/eligibility.js";
import { createDivisionCategoryCapacity } from "../contracts/capacity.js";
import { buildDivisionCategoryKey } from "../keys/buildDivisionCategoryKey.js";
import { normalizeClassificationCode } from "../keys/normalizeCode.js";

/**
 * Runtime lane: exactly one Division + one Category (stable divisionCategoryId).
 *
 * @typedef {Object} CompetitionDivisionCategory
 * @property {string} entityKind
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} key
 * @property {string} divisionId
 * @property {string} categoryId
 * @property {string} divisionCode
 * @property {string} categoryCode
 * @property {string} code
 * @property {string} name
 * @property {string} lifecycleStatus
 * @property {import('../contracts/eligibility.js').EligibilityDescriptor|null} [eligibilityDescriptor]
 * @property {string|null} [eligibilityPolicyRef]
 * @property {import('../contracts/capacity.js').DivisionCategoryCapacity} capacity
 * @property {number} displayOrder
 * @property {number} sortOrder
 * @property {number} revision
 * @property {import('../contracts/shared.js').ClassificationFormatExtension|null} [extensions]
 * @property {import('../contracts/shared.js').ClassificationAuditMetadata} [audit]
 */

/**
 * @param {Partial<CompetitionDivisionCategory> & {
 *   tenantId?: string,
 *   competitionId?: string,
 *   divisionCode?: string,
 *   categoryCode?: string,
 * }} partial
 * @returns {CompetitionDivisionCategory}
 */
export function createCompetitionDivisionCategory(partial = {}) {
  const tenantId = String(partial.tenantId || "").trim();
  const competitionId = String(partial.competitionId || "").trim();
  const divisionCodeResult = normalizeClassificationCode(partial.divisionCode || "");
  const categoryCodeResult = normalizeClassificationCode(partial.categoryCode || "");
  const divisionCode = divisionCodeResult.ok
    ? /** @type {string} */ (divisionCodeResult.value)
    : "";
  const categoryCode = categoryCodeResult.ok
    ? /** @type {string} */ (categoryCodeResult.value)
    : "";

  const keyResult =
    competitionId && divisionCode && categoryCode
      ? buildDivisionCategoryKey(competitionId, divisionCode, categoryCode)
      : { ok: false, value: "" };
  const key =
    typeof partial.key === "string" && partial.key.trim()
      ? String(partial.key).trim()
      : keyResult.ok
        ? /** @type {string} */ (keyResult.value)
        : "";

  const combinedCode =
    typeof partial.code === "string" && partial.code.trim()
      ? String(partial.code).trim().toLowerCase()
      : divisionCode && categoryCode
        ? `${divisionCode}__${categoryCode}`
        : "";

  const lifecycleStatus = Object.values(DIVISION_CATEGORY_LIFECYCLE).includes(
    /** @type {any} */ (partial.lifecycleStatus)
  )
    ? partial.lifecycleStatus
    : DIVISION_CATEGORY_LIFECYCLE.DRAFT;

  const displayOrder = toFiniteNumber(partial.displayOrder ?? partial.sortOrder, 0);

  return {
    entityKind: CLASSIFICATION_ENTITY_KIND.DIVISION_CATEGORY,
    schemaVersion: String(partial.schemaVersion ?? CLASSIFICATION_SCHEMA_VERSION),
    id: String(partial.id || ""),
    tenantId,
    competitionId,
    key,
    divisionId: String(partial.divisionId || ""),
    categoryId: String(partial.categoryId || ""),
    divisionCode,
    categoryCode,
    code: combinedCode,
    name: String(partial.name || combinedCode || "").trim(),
    lifecycleStatus,
    eligibilityDescriptor:
      partial.eligibilityDescriptor != null
        ? createEligibilityDescriptor(partial.eligibilityDescriptor)
        : null,
    eligibilityPolicyRef:
      partial.eligibilityPolicyRef != null ? String(partial.eligibilityPolicyRef) : null,
    capacity: createDivisionCategoryCapacity(partial.capacity),
    displayOrder,
    sortOrder: displayOrder,
    revision: toFiniteNumber(partial.revision, 1),
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}
