/**
 * Snapshot content + CompetitionVersion aggregate contracts (CM-03).
 *
 * Snapshot captures management-owned CompetitionDefinition fields at a point
 * in time. It does NOT own CM-01 mutable revision increments, CM-02 template
 * selection, or Competition Core runtime state.
 */

import {
  isCompetitionDefinition,
  isValidCompetitionDefinitionRevision,
} from "../../competition-definition/index.js";
import {
  COMPETITION_VERSION_STATE,
  COMPETITION_VERSION_FINGERPRINT_ALGORITHM,
  COMPETITION_VERSION_INITIAL_NUMBER,
  isValidCompetitionVersionNumber,
} from "../constants/versioning.js";
import { COMPETITION_VERSION_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError } from "./validation.js";
import {
  deepFreeze,
  clonePlain,
  isNonEmptyString,
  isPositiveInteger,
  isValidTimestamp,
  stableContentFingerprint,
} from "./shared.js";
import { createCompetitionVersionId } from "./identity.js";

/**
 * @typedef {Object} CompetitionVersionContent
 * @property {string} competitionId
 * @property {string} tenantId
 * @property {object} owner
 * @property {string} name
 * @property {string} description
 * @property {string} competitionType
 * @property {string} scope
 * @property {string} visibility
 * @property {string} status
 * @property {readonly object[]} venues
 * @property {readonly object[]} clubs
 * @property {object|null} registrationWindow
 * @property {object|null} plannedPeriod
 * @property {{ templateId: string }|null} template
 * @property {{ ruleSetId: string }|null} ruleSet
 * @property {{ templateId: string, templateVersion: number }|null} templateVersioned
 * @property {string|null} instantiationPlanChecksum
 */

/**
 * @typedef {Object} CompetitionVersionMetadata
 * @property {string|number} createdAt
 * @property {string|null} createdBy
 * @property {string|null} reason
 * @property {string|null} idempotencyKey
 * @property {number} sourceDefinitionRevision
 * @property {string} fingerprintAlgorithm
 */

/**
 * @typedef {Object} CompetitionVersionLineage
 * @property {string|null} parentVersionId
 * @property {number} versionNumber
 * @property {boolean} isRoot
 */

/**
 * @typedef {Object} CompetitionVersion
 * @property {string} versionId
 * @property {number} versionNumber
 * @property {string} state
 * @property {string} tenantId
 * @property {string} competitionId
 * @property {string|null} parentVersionId
 * @property {number} sourceDefinitionRevision
 * @property {string} contentFingerprint
 * @property {CompetitionVersionContent} content
 * @property {CompetitionVersionMetadata} metadata
 * @property {CompetitionVersionLineage} lineage
 */

/**
 * Sort set-like reference arrays by stable id for canonicalization.
 * Club/venue reference order is set-like (ids unique); sort by id.
 * @param {readonly object[]} refs
 * @param {string} idKey
 * @returns {object[]}
 */
function sortRefsById(refs, idKey) {
  return [...refs].sort((a, b) =>
    String(a[idKey]).localeCompare(String(b[idKey]), "en")
  );
}

/**
 * Extract management-owned snapshot content from a validated CompetitionDefinition.
 * Does not mutate input. Does not include UI/runtime/payment/notification/audit state.
 *
 * @param {object} definition
 * @param {{
 *   templateVersioned?: { templateId: string, templateVersion: number } | null,
 *   instantiationPlanChecksum?: string | null,
 * }} [extras]
 * @returns {Readonly<CompetitionVersionContent>}
 */
export function buildVersionContentFromDefinition(definition, extras = {}) {
  const def = definition && typeof definition === "object" ? definition : {};
  const venues = Array.isArray(def.venues)
    ? sortRefsById(
        def.venues.map((v) => ({ venueId: String(v.venueId).trim() })),
        "venueId"
      )
    : [];
  const clubs = Array.isArray(def.clubs)
    ? sortRefsById(
        def.clubs.map((c) => ({ clubId: String(c.clubId).trim() })),
        "clubId"
      )
    : [];

  /** @type {CompetitionVersionContent} */
  const content = {
    competitionId: String(def.competitionId).trim(),
    tenantId: String(def.tenantId).trim(),
    owner: clonePlain(def.owner),
    name: String(def.name).trim(),
    description: def.description == null ? "" : String(def.description),
    competitionType: String(def.competitionType),
    scope: String(def.scope),
    visibility: String(def.visibility),
    status: String(def.status),
    venues: Object.freeze(venues),
    clubs: Object.freeze(clubs),
    registrationWindow:
      def.registrationWindow == null ? null : clonePlain(def.registrationWindow),
    plannedPeriod:
      def.plannedPeriod == null ? null : clonePlain(def.plannedPeriod),
    template: def.template == null ? null : clonePlain(def.template),
    ruleSet: def.ruleSet == null ? null : clonePlain(def.ruleSet),
    templateVersioned:
      extras.templateVersioned == null
        ? null
        : clonePlain(extras.templateVersioned),
    instantiationPlanChecksum:
      extras.instantiationPlanChecksum == null
        ? null
        : String(extras.instantiationPlanChecksum),
  };

  return deepFreeze(content);
}

/**
 * Semantic payload used for content fingerprint (excludes volatile version metadata).
 * @param {CompetitionVersionContent} content
 * @param {number} sourceDefinitionRevision
 * @returns {object}
 */
export function buildFingerprintPayload(content, sourceDefinitionRevision) {
  return deepFreeze({
    content: clonePlain(content),
    sourceDefinitionRevision,
  });
}

/**
 * @param {CompetitionVersionContent} content
 * @param {number} sourceDefinitionRevision
 * @returns {string}
 */
export function computeVersionContentFingerprint(
  content,
  sourceDefinitionRevision
) {
  return stableContentFingerprint(
    buildFingerprintPayload(content, sourceDefinitionRevision)
  );
}

/**
 * Parse optional CM-02 versioned template capture for the snapshot.
 * @param {unknown} input
 * @param {string} [field]
 * @returns {{ value?: Readonly<{ templateId: string, templateVersion: number }>|null, error?: import("./validation.js").CompetitionVersionFieldError }}
 */
export function parseOptionalTemplateVersioned(input, field = "templateVersioned") {
  if (input == null) {
    return { value: null };
  }
  if (!input || typeof input !== "object") {
    return {
      error: createFieldError(
        field,
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "templateVersioned must be an object with templateId and templateVersion when provided",
        {}
      ),
    };
  }
  const raw = /** @type {Record<string, unknown>} */ (input);
  if (!isNonEmptyString(raw.templateId)) {
    return {
      error: createFieldError(
        `${field}.templateId`,
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "templateId is required when templateVersioned is provided",
        {}
      ),
    };
  }
  if (!isPositiveInteger(raw.templateVersion)) {
    return {
      error: createFieldError(
        `${field}.templateVersion`,
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "templateVersion must be an integer >= 1 when templateVersioned is provided",
        { value: raw.templateVersion }
      ),
    };
  }
  return {
    value: deepFreeze({
      templateId: String(raw.templateId).trim(),
      templateVersion: /** @type {number} */ (raw.templateVersion),
    }),
  };
}

/**
 * Assemble a frozen CompetitionVersion aggregate (does not persist).
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   versionNumber: number,
 *   parentVersionId: string|null,
 *   sourceDefinitionRevision: number,
 *   content: CompetitionVersionContent,
 *   createdAt: string|number,
 *   createdBy?: string|null,
 *   reason?: string|null,
 *   idempotencyKey?: string|null,
 * }} params
 * @returns {Readonly<CompetitionVersion>}
 */
export function assembleCompetitionVersion(params) {
  const versionNumber = params.versionNumber;
  const versionId = createCompetitionVersionId(
    params.tenantId,
    params.competitionId,
    versionNumber
  );
  const contentFingerprint = computeVersionContentFingerprint(
    params.content,
    params.sourceDefinitionRevision
  );
  const isRoot =
    versionNumber === COMPETITION_VERSION_INITIAL_NUMBER &&
    params.parentVersionId == null;

  /** @type {CompetitionVersion} */
  const version = {
    versionId,
    versionNumber,
    state: COMPETITION_VERSION_STATE.FROZEN,
    tenantId: String(params.tenantId).trim(),
    competitionId: String(params.competitionId).trim(),
    parentVersionId: params.parentVersionId,
    sourceDefinitionRevision: params.sourceDefinitionRevision,
    contentFingerprint,
    content: params.content,
    metadata: deepFreeze({
      createdAt: params.createdAt,
      createdBy:
        params.createdBy == null || params.createdBy === ""
          ? null
          : String(params.createdBy).trim(),
      reason:
        params.reason == null || params.reason === ""
          ? null
          : String(params.reason),
      idempotencyKey:
        params.idempotencyKey == null || params.idempotencyKey === ""
          ? null
          : String(params.idempotencyKey).trim(),
      sourceDefinitionRevision: params.sourceDefinitionRevision,
      fingerprintAlgorithm: COMPETITION_VERSION_FINGERPRINT_ALGORITHM.id,
    }),
    lineage: deepFreeze({
      parentVersionId: params.parentVersionId,
      versionNumber,
      isRoot,
    }),
  };

  return deepFreeze(version);
}

/**
 * Structural guard for a stored CompetitionVersion (fail-closed).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionVersion(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {Record<string, unknown>} */ (value);
  if (!isNonEmptyString(v.versionId)) return false;
  if (!isValidCompetitionVersionNumber(v.versionNumber)) return false;
  if (v.state !== COMPETITION_VERSION_STATE.FROZEN) return false;
  if (!isNonEmptyString(v.tenantId)) return false;
  if (!isNonEmptyString(v.competitionId)) return false;
  if (!isValidCompetitionDefinitionRevision(v.sourceDefinitionRevision)) {
    return false;
  }
  if (!isNonEmptyString(v.contentFingerprint)) return false;
  if (!v.content || typeof v.content !== "object") return false;
  if (!v.metadata || typeof v.metadata !== "object") return false;
  if (!v.lineage || typeof v.lineage !== "object") return false;
  return true;
}

/**
 * Validate that an explicit CompetitionDefinition is usable for versioning.
 * Reuses CM-01 public validator; does not mutate definition; does not bump revision.
 *
 * @param {unknown} definition
 * @param {{ tenantId: string, competitionId: string, expectedDefinitionRevision: number }} scope
 * @returns {import("./validation.js").CompetitionVersionFieldError[]}
 */
export function collectDefinitionScopeErrors(definition, scope) {
  /** @type {import("./validation.js").CompetitionVersionFieldError[]} */
  const errors = [];

  if (!definition || typeof definition !== "object") {
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_VERSION_ERROR_CODE.INVALID_DEFINITION,
        "explicit CompetitionDefinition is required",
        {}
      )
    );
    return errors;
  }

  if (!isCompetitionDefinition(definition)) {
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_VERSION_ERROR_CODE.INVALID_DEFINITION,
        "CompetitionDefinition failed CM-01 validation",
        {}
      )
    );
    return errors;
  }

  const def = /** @type {Record<string, unknown>} */ (definition);

  if (String(def.tenantId).trim() !== String(scope.tenantId).trim()) {
    errors.push(
      createFieldError(
        "definition.tenantId",
        COMPETITION_VERSION_ERROR_CODE.TENANT_MISMATCH,
        "definition.tenantId must match explicit tenantId",
        {
          expected: scope.tenantId,
          actual: def.tenantId,
        }
      )
    );
  }

  if (String(def.competitionId).trim() !== String(scope.competitionId).trim()) {
    errors.push(
      createFieldError(
        "definition.competitionId",
        COMPETITION_VERSION_ERROR_CODE.COMPETITION_MISMATCH,
        "definition.competitionId must match explicit competitionId",
        {
          expected: scope.competitionId,
          actual: def.competitionId,
        }
      )
    );
  }

  if (!isValidCompetitionDefinitionRevision(scope.expectedDefinitionRevision)) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
        "expectedDefinitionRevision must be an integer >= 1",
        { value: scope.expectedDefinitionRevision }
      )
    );
  } else if (def.revision !== scope.expectedDefinitionRevision) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_VERSION_ERROR_CODE.STALE_DEFINITION_REVISION,
        "expectedDefinitionRevision does not match definition.revision",
        {
          expected: scope.expectedDefinitionRevision,
          actual: def.revision,
        }
      )
    );
  }

  if (!isValidTimestamp(/** @type {any} */ (def.createdAt))) {
    errors.push(
      createFieldError(
        "definition.createdAt",
        COMPETITION_VERSION_ERROR_CODE.INVALID_DEFINITION,
        "definition.createdAt must be a valid timestamp",
        {}
      )
    );
  }

  return errors;
}
