import {
  CLASSIFICATION_SCHEMA_VERSION,
  createAuditMetadata,
  createFormatExtension,
  toFiniteNumber,
} from "../contracts/shared.js";
import { DEFINITION_STATUS } from "../enums/definitionStatus.js";
import { CLASSIFICATION_ENTITY_KIND } from "../enums/entityKind.js";
import { createPoolSizeMetadata } from "../contracts/capacity.js";
import { buildDivisionKey } from "../keys/buildDivisionKey.js";
import { normalizeClassificationCode } from "../keys/normalizeCode.js";

/**
 * @typedef {Object} CompetitionDivision
 * @property {string} entityKind
 * @property {string} schemaVersion
 * @property {string} id
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string} key
 * @property {string} code
 * @property {string} name
 * @property {string|null} [description]
 * @property {number} displayOrder
 * @property {number} sortOrder
 * @property {string} status
 * @property {import('../contracts/capacity.js').PoolSizeMetadata|null} [poolSizeMetadata]
 * @property {number} revision
 * @property {import('../contracts/shared.js').ClassificationFormatExtension|null} [extensions]
 * @property {import('../contracts/shared.js').ClassificationAuditMetadata} [audit]
 */

/**
 * Pure factory for CompetitionDivision (OD-07 definition entity).
 *
 * @param {Partial<CompetitionDivision> & { tenantId?: string, competitionId?: string, code?: string }} partial
 * @returns {CompetitionDivision}
 */
export function createCompetitionDivision(partial = {}) {
  const tenantId = String(partial.tenantId || "").trim();
  const competitionId = String(partial.competitionId || "").trim();
  const codeResult = normalizeClassificationCode(partial.code || "");
  const code = codeResult.ok ? /** @type {string} */ (codeResult.value) : "";
  const keyResult =
    competitionId && code ? buildDivisionKey(competitionId, code) : { ok: false, value: "" };
  const key =
    typeof partial.key === "string" && partial.key.trim()
      ? String(partial.key).trim()
      : keyResult.ok
        ? /** @type {string} */ (keyResult.value)
        : "";

  const displayOrder = toFiniteNumber(
    partial.displayOrder ?? partial.sortOrder,
    0
  );
  const status = Object.values(DEFINITION_STATUS).includes(/** @type {any} */ (partial.status))
    ? partial.status
    : DEFINITION_STATUS.DRAFT;

  return {
    entityKind: CLASSIFICATION_ENTITY_KIND.DIVISION,
    schemaVersion: String(partial.schemaVersion ?? CLASSIFICATION_SCHEMA_VERSION),
    id: String(partial.id || ""),
    tenantId,
    competitionId,
    key,
    code,
    name: String(partial.name || code || "").trim(),
    description: partial.description != null ? String(partial.description) : null,
    displayOrder,
    sortOrder: displayOrder,
    status,
    poolSizeMetadata: createPoolSizeMetadata(partial.poolSizeMetadata),
    revision: toFiniteNumber(partial.revision, 1),
    extensions: createFormatExtension(partial.extensions),
    audit: createAuditMetadata(partial.audit),
  };
}
