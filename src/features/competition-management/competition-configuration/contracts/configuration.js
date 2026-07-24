/**
 * CompetitionConfiguration aggregate validation + cross-section rules (CM-04).
 */

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  isDraftEditableStatus,
  isValidCompetitionDefinitionRevision,
  isCompetitionDefinition,
} from "../../competition-definition/index.js";
import {
  isCompetitionConfigurationStatus,
  isConfigurationEditableStatus,
} from "../constants/status.js";
import {
  COMPETITION_CONFIGURATION_INITIAL_REVISION,
  isValidCompetitionConfigurationRevision,
} from "../constants/revision.js";
import {
  COMPETITION_CONFIGURATION_SECTION,
  COMPETITION_CONFIGURATION_TEAM_ONLY_SECTIONS,
} from "../constants/sectionTypes.js";
import {
  COMPETITION_CONFIGURATION_PARTICIPANT_MODE,
} from "../constants/participantMode.js";
import {
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER,
} from "../constants/capabilityOwners.js";
import { COMPETITION_CONFIGURATION_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError, validationOk, validationFail } from "./validation.js";
import { deepFreeze, clonePlain, isNonEmptyString, canonicalizeJson } from "./shared.js";
import { createCompetitionConfigurationId } from "./identity.js";
import { parseConfigurationSections } from "./sections.js";

/**
 * @typedef {Object} CompetitionConfiguration
 * @property {string} configurationId
 * @property {string} competitionId
 * @property {string} tenantId
 * @property {number} revision
 * @property {string} status
 * @property {number} sourceDefinitionRevision
 * @property {string} competitionType
 * @property {string} scope
 * @property {Readonly<Record<string, object>>} sections
 * @property {object} metadata
 */

/**
 * Collect CM-01 definition scope / editability / revision errors.
 * @param {unknown} definition
 * @param {{ tenantId: string, competitionId: string, expectedDefinitionRevision: number, requireEditable?: boolean }} scope
 * @returns {object[]}
 */
export function collectDefinitionScopeErrors(definition, scope) {
  /** @type {object[]} */
  const errors = [];

  if (!definition || typeof definition !== "object") {
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_DEFINITION,
        "explicit CompetitionDefinition is required",
        {}
      )
    );
    return errors;
  }

  const def = /** @type {any} */ (definition);

  if (!isCompetitionDefinition(def)) {
    // Soft fail: still check key fields if shape-like but report invalid.
    errors.push(
      createFieldError(
        "definition",
        COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_DEFINITION,
        "definition failed CM-01 CompetitionDefinition contract",
        {}
      )
    );
  }

  if (!isNonEmptyString(def.tenantId) || def.tenantId !== scope.tenantId) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.TENANT_MISMATCH,
        "definition.tenantId must match explicit tenantId",
        {
          expected: scope.tenantId,
          actual: def.tenantId,
        }
      )
    );
  }

  if (
    !isNonEmptyString(def.competitionId) ||
    def.competitionId !== scope.competitionId
  ) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_CONFIGURATION_ERROR_CODE.COMPETITION_MISMATCH,
        "definition.competitionId must match explicit competitionId",
        {
          expected: scope.competitionId,
          actual: def.competitionId,
        }
      )
    );
  }

  if (scope.requireEditable !== false) {
    if (!isDraftEditableStatus(def.status)) {
      errors.push(
        createFieldError(
          "definition.status",
          COMPETITION_CONFIGURATION_ERROR_CODE.NON_EDITABLE_DEFINITION,
          "definition must be in editable draft status",
          { status: def.status }
        )
      );
    }
  }

  if (!isValidCompetitionDefinitionRevision(scope.expectedDefinitionRevision)) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_CONFIGURATION_ERROR_CODE.STALE_DEFINITION_REVISION,
        "expectedDefinitionRevision must be an integer >= 1",
        { value: scope.expectedDefinitionRevision }
      )
    );
  } else if (def.revision !== scope.expectedDefinitionRevision) {
    errors.push(
      createFieldError(
        "expectedDefinitionRevision",
        COMPETITION_CONFIGURATION_ERROR_CODE.STALE_DEFINITION_REVISION,
        "expectedDefinitionRevision does not match definition.revision",
        {
          expected: scope.expectedDefinitionRevision,
          actual: def.revision,
        }
      )
    );
  }

  return errors;
}

/**
 * Cross-section + type/scope compatibility (fail-closed, no silent repair).
 * @param {Record<string, object>} sections
 * @param {{ competitionType: string, scope: string, venues?: object[], clubs?: object[] }} definitionContext
 * @returns {object[]}
 */
export function collectCrossSectionErrors(sections, definitionContext) {
  /** @type {object[]} */
  const errors = [];
  const type = definitionContext.competitionType;
  const scope = definitionContext.scope;
  const participantSection =
    sections[COMPETITION_CONFIGURATION_SECTION.PARTICIPANT_MODE];
  const participantMode = participantSection
    ? /** @type {any} */ (participantSection).participantMode
    : null;

  // Type ↔ participant mode
  if (participantMode) {
    if (
      type === COMPETITION_TYPE.TEAM_TOURNAMENT &&
      participantMode === COMPETITION_CONFIGURATION_PARTICIPANT_MODE.INDIVIDUAL
    ) {
      errors.push(
        createFieldError(
          "sections.participant_mode",
          COMPETITION_CONFIGURATION_ERROR_CODE.SECTION_COMPATIBILITY_FAILURE,
          "team_tournament cannot use individual participant mode",
          { competitionType: type, participantMode }
        )
      );
    }
    if (
      (type === COMPETITION_TYPE.DAILY_PLAY ||
        type === COMPETITION_TYPE.INTERNAL_TOURNAMENT ||
        type === COMPETITION_TYPE.OFFICIAL_TOURNAMENT) &&
      participantMode === COMPETITION_CONFIGURATION_PARTICIPANT_MODE.TEAM
    ) {
      // Individual-oriented competition types reject pure team mode.
      errors.push(
        createFieldError(
          "sections.participant_mode",
          COMPETITION_CONFIGURATION_ERROR_CODE.SECTION_COMPATIBILITY_FAILURE,
          "non-team competition type cannot use team participant mode",
          { competitionType: type, participantMode }
        )
      );
    }
  }

  // Team-only sections
  for (const sectionId of COMPETITION_CONFIGURATION_TEAM_ONLY_SECTIONS) {
    if (!sections[sectionId]) continue;
    const mode =
      participantMode ||
      (type === COMPETITION_TYPE.TEAM_TOURNAMENT
        ? COMPETITION_CONFIGURATION_PARTICIPANT_MODE.TEAM
        : COMPETITION_CONFIGURATION_PARTICIPANT_MODE.INDIVIDUAL);
    if (
      mode === COMPETITION_CONFIGURATION_PARTICIPANT_MODE.INDIVIDUAL
    ) {
      errors.push(
        createFieldError(
          `sections.${sectionId}`,
          COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT,
          "team-only section is not allowed for individual participant mode",
          { sectionId, participantMode: mode }
        )
      );
    }
  }

  // Individual competition with roster when type is not team
  if (
    sections[COMPETITION_CONFIGURATION_SECTION.ROSTER] &&
    type !== COMPETITION_TYPE.TEAM_TOURNAMENT &&
    participantMode !== COMPETITION_CONFIGURATION_PARTICIPANT_MODE.TEAM &&
    participantMode !== COMPETITION_CONFIGURATION_PARTICIPANT_MODE.MIXED
  ) {
    errors.push(
      createFieldError(
        "sections.roster",
        COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT,
        "roster section requires team or mixed participant mode",
        { competitionType: type, participantMode }
      )
    );
  }

  // Official mode only for official tournaments
  if (
    sections[COMPETITION_CONFIGURATION_SECTION.OFFICIAL_MODE] &&
    type !== COMPETITION_TYPE.OFFICIAL_TOURNAMENT
  ) {
    errors.push(
      createFieldError(
        "sections.official_mode",
        COMPETITION_CONFIGURATION_ERROR_CODE.SECTION_COMPATIBILITY_FAILURE,
        "official_mode section is only valid for official_tournament",
        { competitionType: type }
      )
    );
  }

  // Seeding ↔ draw relationship: seeding without draw is allowed; draw without
  // seeding when seeding is required by draw opaque flag is not hard-coded.
  // Require compatible resolution statuses when both present with conflicting versions.
  const seeding = sections[COMPETITION_CONFIGURATION_SECTION.SEEDING];
  const draw = sections[COMPETITION_CONFIGURATION_SECTION.DRAW];
  if (seeding && draw) {
    const sRef = /** @type {any} */ (seeding).seedingPolicyReference;
    const dRef = /** @type {any} */ (draw).drawPolicyReference;
    if (
      sRef?.resolutionStatus === "deferred_unsupported" &&
      dRef?.resolutionStatus === "resolved_identity"
    ) {
      errors.push(
        createFieldError(
          "sections.draw",
          COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT,
          "draw resolved_identity is incompatible with deferred seeding policy",
          {}
        )
      );
    }
  }

  // Match format ↔ scoring
  const matchFormat = sections[COMPETITION_CONFIGURATION_SECTION.MATCH_FORMAT];
  const scoring = sections[COMPETITION_CONFIGURATION_SECTION.SCORING];
  if (matchFormat && scoring) {
    const mRef = /** @type {any} */ (matchFormat).matchFormatReference;
    const sRef = /** @type {any} */ (scoring).scoringPolicyReference;
    if (
      mRef?.capabilityOwner === COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED &&
      sRef?.resolutionStatus === "resolved_identity"
    ) {
      errors.push(
        createFieldError(
          "sections.scoring",
          COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT,
          "scoring resolved_identity is incompatible with deferred match format",
          {}
        )
      );
    }
  }

  // Schedule ↔ court / venue scope
  const scheduling = sections[COMPETITION_CONFIGURATION_SECTION.SCHEDULING];
  const court = sections[COMPETITION_CONFIGURATION_SECTION.COURT_ASSIGNMENT];
  if (court) {
    const venueHint = /** @type {any} */ (court).venueScopeHint;
    if (venueHint) {
      const venues = Array.isArray(definitionContext.venues)
        ? definitionContext.venues
        : [];
      const venueIds = venues
        .map((v) => (v && typeof v === "object" ? v.venueId : null))
        .filter(Boolean);
      if (venueIds.length > 0 && !venueIds.includes(venueHint)) {
        errors.push(
          createFieldError(
            "sections.court_assignment.venueScopeHint",
            COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT,
            "court assignment venueScopeHint is not in definition venues",
            { venueScopeHint: venueHint, venueIds }
          )
        );
      }
      if (
        scope === COMPETITION_SCOPE.CLUB &&
        venueIds.length === 0 &&
        venueHint
      ) {
        // Club scope without venues but court hint → conflict
        errors.push(
          createFieldError(
            "sections.court_assignment.venueScopeHint",
            COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT,
            "venueScopeHint provided but definition has no venues for club scope",
            { venueScopeHint: venueHint }
          )
        );
      }
    }
    if (
      scheduling &&
      /** @type {any} */ (scheduling).schedulePolicyReference?.resolutionStatus ===
        "deferred_unsupported" &&
      /** @type {any} */ (court).courtAssignmentPolicyReference?.resolutionStatus ===
        "resolved_identity"
    ) {
      errors.push(
        createFieldError(
          "sections.court_assignment",
          COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT,
          "court assignment resolved_identity incompatible with deferred schedule policy",
          {}
        )
      );
    }
  }

  // Standings / tie-break: if tie-break present, standings must exist (already enforced by section)
  // Division ↔ participant mode
  const division = sections[COMPETITION_CONFIGURATION_SECTION.DIVISION];
  if (
    division &&
    participantMode === COMPETITION_CONFIGURATION_PARTICIPANT_MODE.TEAM
  ) {
    const dRef = /** @type {any} */ (division).divisionBlueprintReference;
    if (dRef?.capabilityOwner === COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED &&
        dRef?.resolutionStatus !== "deferred_unsupported" &&
        dRef?.resolutionStatus !== "opaque_proposal") {
      errors.push(
        createFieldError(
          "sections.division",
          COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT,
          "team-mode division reference resolution is unsupported",
          {}
        )
      );
    }
  }

  // Conflicting reference versions across duplicate capability owners in related sections
  // (seeding + draw same owner different versions when both have versions)
  if (seeding && draw) {
    const sRef = /** @type {any} */ (seeding).seedingPolicyReference;
    const dRef = /** @type {any} */ (draw).drawPolicyReference;
    if (
      sRef?.referenceId &&
      dRef?.referenceId &&
      sRef.referenceId === dRef.referenceId &&
      sRef.referenceVersion != null &&
      dRef.referenceVersion != null &&
      String(sRef.referenceVersion) !== String(dRef.referenceVersion)
    ) {
      errors.push(
        createFieldError(
          "sections.seeding",
          COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT,
          "conflicting reference versions for shared reference identity across seeding/draw",
          {
            referenceId: sRef.referenceId,
            seedingVersion: sRef.referenceVersion,
            drawVersion: dRef.referenceVersion,
          }
        )
      );
    }
  }

  return errors;
}

/**
 * Validate and assemble a CompetitionConfiguration aggregate.
 *
 * @param {object} input
 * @param {{ requireEditableStatus?: boolean, definition?: object }} [options]
 * @returns {import("./validation.js").CompetitionConfigurationValidationResult}
 */
export function validateCompetitionConfigurationInput(input, options = {}) {
  /** @type {object[]} */
  const errors = [];
  const src = input && typeof input === "object" ? input : {};

  if (!isNonEmptyString(src.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(src.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }

  const tenantId = isNonEmptyString(src.tenantId)
    ? String(src.tenantId).trim()
    : "";
  const competitionId = isNonEmptyString(src.competitionId)
    ? String(src.competitionId).trim()
    : "";

  if (!isCompetitionConfigurationStatus(src.status)) {
    errors.push(
      createFieldError(
        "status",
        COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT,
        "status must be draft|locked",
        { value: src.status }
      )
    );
  } else if (
    options.requireEditableStatus === true &&
    !isConfigurationEditableStatus(src.status)
  ) {
    errors.push(
      createFieldError(
        "status",
        COMPETITION_CONFIGURATION_ERROR_CODE.NON_EDITABLE_CONFIGURATION,
        "configuration must be draft for this operation",
        { status: src.status }
      )
    );
  }

  if (!isValidCompetitionConfigurationRevision(src.revision)) {
    errors.push(
      createFieldError(
        "revision",
        COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT,
        "revision must be an integer >= 1",
        { value: src.revision }
      )
    );
  }

  if (!isValidCompetitionDefinitionRevision(src.sourceDefinitionRevision)) {
    errors.push(
      createFieldError(
        "sourceDefinitionRevision",
        COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT,
        "sourceDefinitionRevision must be an integer >= 1",
        { value: src.sourceDefinitionRevision }
      )
    );
  }

  if (!isNonEmptyString(src.competitionType)) {
    errors.push(
      createFieldError(
        "competitionType",
        COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT,
        "competitionType is required (derived from definition, not inferred)",
        {}
      )
    );
  }
  if (!isNonEmptyString(src.scope)) {
    errors.push(
      createFieldError(
        "scope",
        COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT,
        "scope is required (derived from definition, not inferred)",
        {}
      )
    );
  }

  const sectionsParsed = parseConfigurationSections(src.sections);
  errors.push(...sectionsParsed.errors);

  if (src.metadata != null) {
    if (typeof src.metadata !== "object" || Array.isArray(src.metadata)) {
      errors.push(
        createFieldError(
          "metadata",
          COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT,
          "metadata must be a plain object when provided",
          {}
        )
      );
    } else {
      // Reject UI / runtime state smuggling
      for (const forbidden of [
        "uiWizardState",
        "formState",
        "liveMatches",
        "scores",
        "standingsRuntime",
        "localStorage",
        "engineRuntime",
      ]) {
        if (Object.prototype.hasOwnProperty.call(src.metadata, forbidden)) {
          errors.push(
            createFieldError(
              `metadata.${forbidden}`,
              COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT,
              "metadata must not contain UI or runtime engine state",
              {}
            )
          );
        }
      }
    }
  }

  if (
    tenantId &&
    competitionId &&
    sectionsParsed.value &&
    isNonEmptyString(src.competitionType) &&
    isNonEmptyString(src.scope)
  ) {
    const definition = options.definition;
    errors.push(
      ...collectCrossSectionErrors(sectionsParsed.value, {
        competitionType: String(src.competitionType).trim(),
        scope: String(src.scope).trim(),
        venues: definition?.venues,
        clubs: definition?.clubs,
      })
    );
  }

  if (errors.length > 0) {
    return validationFail(errors);
  }

  const expectedId = createCompetitionConfigurationId(tenantId, competitionId);
  if (
    src.configurationId != null &&
    String(src.configurationId).trim() !== expectedId
  ) {
    return validationFail([
      createFieldError(
        "configurationId",
        COMPETITION_CONFIGURATION_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE,
        "configurationId must equal cc::{tenantId}::{competitionId}",
        {
          expected: expectedId,
          actual: src.configurationId,
        }
      ),
    ]);
  }

  const metadataSrc =
    src.metadata && typeof src.metadata === "object" ? src.metadata : {};

  /** @type {CompetitionConfiguration} */
  const value = {
    configurationId: expectedId,
    competitionId,
    tenantId,
    revision: /** @type {number} */ (src.revision),
    status: /** @type {string} */ (src.status),
    sourceDefinitionRevision: /** @type {number} */ (src.sourceDefinitionRevision),
    competitionType: String(src.competitionType).trim(),
    scope: String(src.scope).trim(),
    sections: sectionsParsed.value || deepFreeze({}),
    metadata: deepFreeze({
      createdFromTemplateProposal: Boolean(
        metadataSrc.createdFromTemplateProposal
      ),
      templateIdentity: metadataSrc.templateIdentity
        ? clonePlain(metadataSrc.templateIdentity)
        : null,
      externalEditabilityConstraint: metadataSrc.externalEditabilityConstraint
        ? clonePlain(metadataSrc.externalEditabilityConstraint)
        : null,
    }),
  };

  return validationOk(deepFreeze(value));
}

/**
 * @param {unknown} value
 * @returns {value is CompetitionConfiguration}
 */
export function isCompetitionConfiguration(value) {
  if (!value || typeof value !== "object") return false;
  const v = /** @type {any} */ (value);
  return (
    isNonEmptyString(v.configurationId) &&
    isNonEmptyString(v.competitionId) &&
    isNonEmptyString(v.tenantId) &&
    isValidCompetitionConfigurationRevision(v.revision) &&
    isCompetitionConfigurationStatus(v.status) &&
    isValidCompetitionDefinitionRevision(v.sourceDefinitionRevision) &&
    isNonEmptyString(v.competitionType) &&
    isNonEmptyString(v.scope) &&
    v.sections &&
    typeof v.sections === "object" &&
    !Array.isArray(v.sections) &&
    v.metadata &&
    typeof v.metadata === "object"
  );
}

/**
 * Semantic equality helper (excludes nothing volatile — no updatedAt on aggregate).
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function configurationsSemanticallyEqual(a, b) {
  return canonicalizeJson(semanticConfigurationPayload(a)) ===
    canonicalizeJson(semanticConfigurationPayload(b));
}

/**
 * @param {object} configuration
 * @returns {object}
 */
export function semanticConfigurationPayload(configuration) {
  return {
    competitionId: configuration.competitionId,
    tenantId: configuration.tenantId,
    status: configuration.status,
    sourceDefinitionRevision: configuration.sourceDefinitionRevision,
    competitionType: configuration.competitionType,
    scope: configuration.scope,
    sections: configuration.sections,
    metadata: {
      createdFromTemplateProposal:
        configuration.metadata?.createdFromTemplateProposal ?? false,
      templateIdentity: configuration.metadata?.templateIdentity ?? null,
      externalEditabilityConstraint:
        configuration.metadata?.externalEditabilityConstraint ?? null,
    },
  };
}

export { COMPETITION_CONFIGURATION_INITIAL_REVISION };
