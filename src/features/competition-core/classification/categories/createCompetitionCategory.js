import {
  CLASSIFICATION_SCHEMA_VERSION,
  createAuditMetadata,
  createFormatExtension,
  toFiniteNumber,
} from "../contracts/shared.js";
import { DEFINITION_STATUS } from "../enums/definitionStatus.js";
import { GENDER_CLASS } from "../enums/genderClass.js";
import { ACCESS_MODE } from "../enums/accessMode.js";
import { CLASSIFICATION_ENTITY_KIND } from "../enums/entityKind.js";
import { createApplicability } from "../enums/applicability.js";
import { createEligibilityDescriptor } from "../contracts/eligibility.js";
import { createRecommendedCapacity } from "../contracts/capacity.js";
import { buildCategoryKey } from "../keys/buildCategoryKey.js";
import { normalizeClassificationCode } from "../keys/normalizeCode.js";

/**
 * @typedef {Object} CompetitionCategory
 * @property {string} entityKind
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} key
 * @property {string} code
 * @property {string} name
 * @property {string|null} [label]
 * @property {string|null} [description]
 * @property {import('../enums/applicability.js').CategoryApplicability} applicability
 * @property {string} genderClass
 * @property {string} access
 * @property {import('./eligibility.js').EligibilityDescriptor} eligibilityDescriptor
 * @property {import('./capacity.js').RecommendedCapacity|null} [recommendedCapacity]
 * @property {number} displayOrder
 * @property {string} status
 * @property {number} revision
 * @property {import('./shared.js').ClassificationFormatExtension|null} [extensions]
 * @property {import('./shared.js').ClassificationAuditMetadata} [audit]
 */

/**
 * Pure factory. Does not evaluate eligibility.
 *
 * @param {Partial<CompetitionCategory> & { tenantId?: string, competitionId?: string, code?: string }} partial
 * @returns {CompetitionCategory}
 */
export function createCompetitionCategory(partial = {}) {
  const tenantId = String(partial.tenantId || "").trim();
  const competitionId = String(partial.competitionId || "").trim();
  const codeResult = normalizeClassificationCode(partial.code || "");
  const code = codeResult.ok ? /** @type {string} */ (codeResult.value) : "";
  const keyResult =
    competitionId && code ? buildCategoryKey(competitionId, code) : { ok: false, value: "" };
  const key =
    typeof partial.key === "string" && partial.key.trim()
      ? String(partial.key).trim()
      : keyResult.ok
        ? /** @type {string} */ (keyResult.value)
        : "";

  const name = String(partial.name || partial.label || code || "").trim();
  const status = Object.values(DEFINITION_STATUS).includes(/** @type {any} */ (partial.status))
    ? partial.status
    : DEFINITION_STATUS.DRAFT;

  return {
    entityKind: CLASSIFICATION_ENTITY_KIND.CATEGORY,
    schemaVersion: String(partial.schemaVersion ?? CLASSIFICATION_SCHEMA_VERSION),
    id: String(partial.id || ""),
    tenantId,
    competitionId,
    key,
    code,
    name,
    label: partial.label != null ? String(partial.label) : name || null,
    description: partial.description != null ? String(partial.description) : null,
    applicability: createApplicability(partial.applicability),
    genderClass: Object.values(GENDER_CLASS).includes(/** @type {any} */ (partial.genderClass))
      ? partial.genderClass
      : GENDER_CLASS.UNSPECIFIED,
    access: Object.values(ACCESS_MODE).includes(/** @type {any} */ (partial.access))
      ? partial.access
      : ACCESS_MODE.OPEN,
    eligibilityDescriptor: createEligibilityDescriptor(partial.eligibilityDescriptor),
    recommendedCapacity: createRecommendedCapacity(partial.recommendedCapacity),
    displayOrder: toFiniteNumber(partial.displayOrder, 0),
    status,
    revision: toFiniteNumber(partial.revision, 1),
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}
