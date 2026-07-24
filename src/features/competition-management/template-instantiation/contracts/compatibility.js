/**
 * Template ↔ CompetitionDefinition compatibility evaluation (CM-02).
 * Fail-closed, deterministic issue ordering, no mutation, no silent repair.
 */

import {
  isDraftEditableStatus,
  isValidCompetitionDefinitionRevision,
} from "../../competition-definition/index.js";
import {
  COMPETITION_TEMPLATE_COMPATIBILITY_STATUS,
  COMPETITION_TEMPLATE_ISSUE_SEVERITY,
  COMPETITION_TEMPLATE_SCOPE,
  isTemplateSelectable,
} from "../constants/index.js";
import { COMPETITION_TEMPLATE_ERROR_CODE } from "../errors/errorCodes.js";
import { createFieldError, sortFieldErrors } from "./validation.js";
import { deepFreeze, isNonEmptyString, clonePlain } from "./shared.js";

/**
 * @typedef {Object} CompetitionTemplateCompatibilityIssue
 * @property {string} field
 * @property {string} code
 * @property {string} message
 * @property {string} severity
 * @property {Record<string, unknown>} [details]
 */

/**
 * @typedef {Object} CompetitionTemplateCompatibilityResult
 * @property {string} status
 * @property {boolean} ok
 * @property {readonly CompetitionTemplateCompatibilityIssue[]} issues
 * @property {{ summary: string, reasons: readonly string[] }} explanation
 * @property {object|null} template
 * @property {object|null} definitionSnapshot
 */

/**
 * @param {string} field
 * @param {string} code
 * @param {string} message
 * @param {string} severity
 * @param {Record<string, unknown>} [details]
 * @returns {Readonly<CompetitionTemplateCompatibilityIssue>}
 */
export function createCompatibilityIssue(
  field,
  code,
  message,
  severity = COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
  details = {}
) {
  return deepFreeze({
    field: String(field),
    code: String(code),
    message: String(message),
    severity: String(severity),
    details: details && typeof details === "object" ? { ...details } : {},
  });
}

/**
 * @param {CompetitionTemplateCompatibilityIssue[]} issues
 * @returns {CompetitionTemplateCompatibilityIssue[]}
 */
export function sortCompatibilityIssues(issues) {
  return [...issues].sort((a, b) => {
    const byField = String(a.field).localeCompare(String(b.field), "en");
    if (byField !== 0) return byField;
    const byCode = String(a.code).localeCompare(String(b.code), "en");
    if (byCode !== 0) return byCode;
    const bySeverity = String(a.severity).localeCompare(String(b.severity), "en");
    if (bySeverity !== 0) return bySeverity;
    return String(a.message).localeCompare(String(b.message), "en");
  });
}

/**
 * Evaluate template compatibility against an explicit CompetitionDefinition.
 *
 * @param {object} template
 * @param {object} definition
 * @param {{
 *   tenantId: string,
 *   replaceIntent?: boolean,
 *   expectedRevision?: number,
 *   competitionId?: string,
 * }} options
 * @returns {Readonly<CompetitionTemplateCompatibilityResult>}
 */
export function evaluateTemplateCompatibility(template, definition, options = {}) {
  const templateSnapshot = clonePlain(template);
  const definitionSnapshot = clonePlain(definition);
  void templateSnapshot;

  /** @type {CompetitionTemplateCompatibilityIssue[]} */
  const issues = [];

  if (!template || typeof template !== "object") {
    issues.push(
      createCompatibilityIssue(
        "template",
        COMPETITION_TEMPLATE_ERROR_CODE.TEMPLATE_NOT_FOUND,
        "template is required",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
      )
    );
  }

  if (!definition || typeof definition !== "object") {
    issues.push(
      createCompatibilityIssue(
        "definition",
        COMPETITION_TEMPLATE_ERROR_CODE.DEFINITION_REQUIRED,
        "CompetitionDefinition is required",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
      )
    );
  }

  if (!isNonEmptyString(options.tenantId)) {
    issues.push(
      createCompatibilityIssue(
        "tenantId",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
        "explicit tenantId is required",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
      )
    );
  }

  if (issues.length > 0) {
    return finalizeCompatibility(issues, null, null);
  }

  const tmpl = /** @type {Record<string, unknown>} */ (template);
  const def = /** @type {Record<string, unknown>} */ (definition);
  const tenantId = String(options.tenantId).trim();

  // Tenant ownership / scope
  if (String(def.tenantId) !== tenantId) {
    issues.push(
      createCompatibilityIssue(
        "tenantId",
        COMPETITION_TEMPLATE_ERROR_CODE.CROSS_TENANT_DENIED,
        "definition tenantId does not match explicit tenantId",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
        { definitionTenantId: def.tenantId, requestedTenantId: tenantId }
      )
    );
  }

  if (tmpl.templateScope === COMPETITION_TEMPLATE_SCOPE.TENANT) {
    if (String(tmpl.tenantId) !== tenantId) {
      issues.push(
        createCompatibilityIssue(
          "template.tenantId",
          COMPETITION_TEMPLATE_ERROR_CODE.TENANT_TEMPLATE_DENIED,
          "tenant template is not available for this tenant",
          COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
          { templateTenantId: tmpl.tenantId, requestedTenantId: tenantId }
        )
      );
    }
  } else if (tmpl.templateScope !== COMPETITION_TEMPLATE_SCOPE.GLOBAL) {
    issues.push(
      createCompatibilityIssue(
        "template.templateScope",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_SCOPE,
        "template scope is invalid",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
        { value: tmpl.templateScope }
      )
    );
  }

  // Availability
  if (!isTemplateSelectable(tmpl.availability)) {
    issues.push(
      createCompatibilityIssue(
        "template.availability",
        COMPETITION_TEMPLATE_ERROR_CODE.TEMPLATE_UNAVAILABLE,
        "template is not available for selection",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
        { availability: tmpl.availability }
      )
    );
  }

  // Draft status
  if (!isDraftEditableStatus(def.status)) {
    issues.push(
      createCompatibilityIssue(
        "definition.status",
        COMPETITION_TEMPLATE_ERROR_CODE.NOT_DRAFT,
        "template operations require an editable draft CompetitionDefinition",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
        { status: def.status }
      )
    );
  }

  // Explicit competitionId match when provided
  if (options.competitionId != null) {
    if (!isNonEmptyString(options.competitionId)) {
      issues.push(
        createCompatibilityIssue(
          "competitionId",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
          "competitionId must be a non-empty string when provided",
          COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
        )
      );
    } else if (String(options.competitionId).trim() !== String(def.competitionId)) {
      issues.push(
        createCompatibilityIssue(
          "competitionId",
          COMPETITION_TEMPLATE_ERROR_CODE.COMPETITION_ID_MISMATCH,
          "competitionId does not match CompetitionDefinition",
          COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
          {
            definitionCompetitionId: def.competitionId,
            requestedCompetitionId: options.competitionId,
          }
        )
      );
    }
  }

  // Expected revision (optimistic concurrency baseline — not CM-03 history)
  if (Object.prototype.hasOwnProperty.call(options, "expectedRevision")) {
    if (!isValidCompetitionDefinitionRevision(options.expectedRevision)) {
      issues.push(
        createCompatibilityIssue(
          "expectedRevision",
          COMPETITION_TEMPLATE_ERROR_CODE.STALE_REVISION,
          "expectedRevision must be a valid revision integer >= 1",
          COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
          { value: options.expectedRevision }
        )
      );
    } else if (options.expectedRevision !== def.revision) {
      issues.push(
        createCompatibilityIssue(
          "expectedRevision",
          COMPETITION_TEMPLATE_ERROR_CODE.STALE_REVISION,
          "expectedRevision does not match definition revision",
          COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
          {
            expectedRevision: options.expectedRevision,
            actualRevision: def.revision,
          }
        )
      );
    }
  }

  // Competition type
  const supportedTypes = Array.isArray(tmpl.supportedCompetitionTypes)
    ? tmpl.supportedCompetitionTypes
    : [];
  if (!supportedTypes.includes(def.competitionType)) {
    issues.push(
      createCompatibilityIssue(
        "definition.competitionType",
        COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_COMPETITION_TYPE,
        "competition type is not supported by the template",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
        {
          competitionType: def.competitionType,
          supportedCompetitionTypes: supportedTypes,
        }
      )
    );
  }

  // Competition scope
  const supportedScopes = Array.isArray(tmpl.supportedScopes)
    ? tmpl.supportedScopes
    : [];
  if (!supportedScopes.includes(def.scope)) {
    issues.push(
      createCompatibilityIssue(
        "definition.scope",
        COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_COMPETITION_SCOPE,
        "competition scope is not supported by the template",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
        { scope: def.scope, supportedScopes }
      )
    );
  }

  const requirements =
    tmpl.requirements && typeof tmpl.requirements === "object"
      ? /** @type {Record<string, unknown>} */ (tmpl.requirements)
      : {};

  // Venue / club requirements
  const venues = Array.isArray(def.venues) ? def.venues : [];
  const clubs = Array.isArray(def.clubs) ? def.clubs : [];
  if (requirements.requiresVenue === true && venues.length === 0) {
    issues.push(
      createCompatibilityIssue(
        "definition.venues",
        COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_VENUE_REQUIREMENT,
        "template requires at least one venue association",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
      )
    );
  }
  if (requirements.requiresClub === true && clubs.length === 0) {
    issues.push(
      createCompatibilityIssue(
        "definition.clubs",
        COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_CLUB_REQUIREMENT,
        "template requires at least one club association",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
      )
    );
  }

  // Owner class
  const allowedOwnerTypes = Array.isArray(requirements.allowedOwnerTypes)
    ? requirements.allowedOwnerTypes
    : [];
  if (
    allowedOwnerTypes.length > 0 &&
    def.owner &&
    typeof def.owner === "object" &&
    !allowedOwnerTypes.includes(
      /** @type {{ ownerType?: string }} */ (def.owner).ownerType
    )
  ) {
    issues.push(
      createCompatibilityIssue(
        "definition.owner.ownerType",
        COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_OWNER_CLASS,
        "owner type is not allowed by the template",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
        {
          ownerType: /** @type {{ ownerType?: string }} */ (def.owner).ownerType,
          allowedOwnerTypes,
        }
      )
    );
  }

  // Registration window / planned period
  if (
    requirements.requiresRegistrationWindow === true &&
    def.registrationWindow == null
  ) {
    issues.push(
      createCompatibilityIssue(
        "definition.registrationWindow",
        COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_REGISTRATION_WINDOW,
        "template requires a registration window",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
      )
    );
  }
  if (requirements.requiresPlannedPeriod === true && def.plannedPeriod == null) {
    issues.push(
      createCompatibilityIssue(
        "definition.plannedPeriod",
        COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_PLANNED_PERIOD,
        "template requires a planned competition period",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
      )
    );
  }

  // Visibility
  const allowedVisibilities = Array.isArray(requirements.allowedVisibilities)
    ? requirements.allowedVisibilities
    : [];
  if (
    allowedVisibilities.length > 0 &&
    !allowedVisibilities.includes(def.visibility)
  ) {
    issues.push(
      createCompatibilityIssue(
        "definition.visibility",
        COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_VISIBILITY,
        "visibility is not allowed by the template",
        COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
        { visibility: def.visibility, allowedVisibilities }
      )
    );
  }

  // Existing template reference conflict
  const existingTemplate =
    def.template && typeof def.template === "object"
      ? /** @type {{ templateId?: string }} */ (def.template)
      : null;
  if (
    existingTemplate &&
    isNonEmptyString(existingTemplate.templateId) &&
    String(existingTemplate.templateId) !== String(tmpl.templateId)
  ) {
    if (options.replaceIntent !== true) {
      issues.push(
        createCompatibilityIssue(
          "definition.template",
          COMPETITION_TEMPLATE_ERROR_CODE.REPLACE_INTENT_REQUIRED,
          "existing template reference differs; explicit replaceIntent is required",
          COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR,
          {
            existingTemplateId: existingTemplate.templateId,
            requestedTemplateId: tmpl.templateId,
          }
        )
      );
    } else {
      issues.push(
        createCompatibilityIssue(
          "definition.template",
          COMPETITION_TEMPLATE_ERROR_CODE.EXISTING_TEMPLATE_CONFLICT,
          "existing template reference will be replaced (explicit replaceIntent)",
          COMPETITION_TEMPLATE_ISSUE_SEVERITY.WARNING,
          {
            existingTemplateId: existingTemplate.templateId,
            requestedTemplateId: tmpl.templateId,
          }
        )
      );
    }
  }

  // Existing rule-set conflict warning (do not silently overwrite without proposal)
  const defaults =
    tmpl.defaults && typeof tmpl.defaults === "object"
      ? /** @type {Record<string, unknown>} */ (tmpl.defaults)
      : {};
  if (
    def.ruleSet &&
    typeof def.ruleSet === "object" &&
    defaults.ruleSet &&
    typeof defaults.ruleSet === "object"
  ) {
    const existingRuleSetId = /** @type {{ ruleSetId?: string }} */ (def.ruleSet)
      .ruleSetId;
    const proposedRuleSetId = /** @type {{ ruleSetId?: string }} */ (defaults.ruleSet)
      .ruleSetId;
    if (
      isNonEmptyString(existingRuleSetId) &&
      isNonEmptyString(proposedRuleSetId) &&
      String(existingRuleSetId) !== String(proposedRuleSetId)
    ) {
      issues.push(
        createCompatibilityIssue(
          "definition.ruleSet",
          COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_RULE_SET_REFERENCE,
          "existing rule-set reference differs from template proposal (warning only; patch will propose replacement)",
          COMPETITION_TEMPLATE_ISSUE_SEVERITY.WARNING,
          { existingRuleSetId, proposedRuleSetId }
        )
      );
    }
  }

  // Required Competition Core capabilities are reference-level tags only.
  // CM-02 does not execute CORE and does not fail closed on missing runtime wiring;
  // capability tags are carried into the instantiation plan as proposals.

  return finalizeCompatibility(issues, tmpl, definitionSnapshot);
}

/**
 * @param {CompetitionTemplateCompatibilityIssue[]} issues
 * @param {object|null} template
 * @param {object|null} definitionSnapshot
 * @returns {Readonly<CompetitionTemplateCompatibilityResult>}
 */
function finalizeCompatibility(issues, template, definitionSnapshot) {
  const sorted = sortCompatibilityIssues(issues);
  const hasError = sorted.some(
    (i) => i.severity === COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
  );
  const reasons = sorted.map(
    (i) => `${i.field}: [${i.code}/${i.severity}] ${i.message}`
  );
  const status = hasError
    ? COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.FAIL
    : COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.PASS;
  const summary =
    status === COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.PASS
      ? sorted.length === 0
        ? "Template is compatible with CompetitionDefinition."
        : `Template is compatible with warnings (${sorted.length}).`
      : `Template compatibility failed (${sorted.filter((i) => i.severity === COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR).length} errors).`;

  return deepFreeze({
    status,
    ok: !hasError,
    issues: sorted,
    explanation: { summary, reasons },
    template: template ? deepFreeze(clonePlain(template)) : null,
    definitionSnapshot: definitionSnapshot
      ? deepFreeze(definitionSnapshot)
      : null,
  });
}

/**
 * Convert compatibility errors to field errors for validation envelopes.
 * @param {CompetitionTemplateCompatibilityResult} compatibility
 * @returns {import("./validation.js").CompetitionTemplateFieldError[]}
 */
export function compatibilityErrorsAsFieldErrors(compatibility) {
  return sortFieldErrors(
    compatibility.issues
      .filter((i) => i.severity === COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR)
      .map((i) =>
        createFieldError(i.field, i.code, i.message, {
          ...i.details,
          severity: i.severity,
        })
      )
  );
}
