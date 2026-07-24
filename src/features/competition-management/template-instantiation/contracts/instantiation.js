/**
 * Deterministic template instantiation plan + result projector (CM-02).
 *
 * Produces patch/proposal only. Does not mutate CompetitionDefinition,
 * does not write DB, does not publish, does not execute Competition Core.
 */

import { nextCompetitionDefinitionRevision } from "../../competition-definition/index.js";
import {
  COMPETITION_TEMPLATE_INSTANTIATION_STATUS,
  COMPETITION_TEMPLATE_OWNERSHIP_TARGET,
  COMPETITION_TEMPLATE_ISSUE_SEVERITY,
} from "../constants/index.js";
import { COMPETITION_TEMPLATE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  evaluateTemplateCompatibility,
  compatibilityErrorsAsFieldErrors,
} from "./compatibility.js";
import { toCm01TemplateReference } from "./references.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  buildExplanation,
} from "./validation.js";
import { deepFreeze, clonePlain, stableChecksum, isNonEmptyString } from "./shared.js";

/**
 * @typedef {Object} CompetitionTemplateFieldPatch
 * @property {string} path
 * @property {*} value
 * @property {string} ownershipTarget
 * @property {string} [explanation]
 */

/**
 * @typedef {Object} CompetitionTemplateInstantiationPlan
 * @property {string} planId
 * @property {string} competitionId
 * @property {string} tenantId
 * @property {{ templateId: string, templateVersion: number }} selectedTemplate
 * @property {number} sourceDefinitionRevision
 * @property {number} expectedOutputRevision
 * @property {readonly CompetitionTemplateFieldPatch[]} patches
 * @property {object|null} proposedRuleSet
 * @property {object|null} proposedRegistrationDefaults
 * @property {readonly string[]} requiredCapabilities
 * @property {readonly object[]} warnings
 * @property {readonly object[]} blockedRequirements
 * @property {object} compatibilityProof
 */

/**
 * @typedef {Object} CompetitionTemplateInstantiationResult
 * @property {boolean} ok
 * @property {string} status
 * @property {CompetitionTemplateInstantiationPlan|null} plan
 * @property {object|null} definitionPatch
 * @property {readonly CompetitionTemplateFieldPatch[]} proposedFragments
 * @property {{ summary: string, reasons: readonly string[] }} explanation
 * @property {readonly object[]} [errors]
 */

/**
 * Build a deterministic instantiation plan after compatibility PASS.
 *
 * @param {object} template
 * @param {object} definition
 * @param {import("./compatibility.js").CompetitionTemplateCompatibilityResult} compatibility
 * @param {{ tenantId: string, replaceIntent?: boolean }} options
 * @returns {Readonly<CompetitionTemplateInstantiationPlan>}
 */
export function buildInstantiationPlan(
  template,
  definition,
  compatibility,
  options
) {
  const defaults =
    template.defaults && typeof template.defaults === "object"
      ? template.defaults
      : {};
  const requirements =
    template.requirements && typeof template.requirements === "object"
      ? template.requirements
      : {};

  /** @type {CompetitionTemplateFieldPatch[]} */
  const patches = [];

  const cm01TemplateRef = toCm01TemplateReference({
    templateId: template.templateId,
    templateVersion: template.templateVersion,
  });

  patches.push({
    path: "template",
    value: cm01TemplateRef,
    ownershipTarget: COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CM01_DEFINITION,
    explanation:
      options.replaceIntent === true &&
      definition.template &&
      definition.template.templateId !== template.templateId
        ? `Replace template reference ${definition.template.templateId} → ${template.templateId}`
        : `Attach template reference ${template.templateId}`,
  });

  if (defaults.ruleSet) {
    patches.push({
      path: "ruleSet",
      value: defaults.ruleSet,
      ownershipTarget: COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CM01_DEFINITION,
      explanation: `Propose rule-set reference ${defaults.ruleSet.ruleSetId}`,
    });
  }

  if (defaults.visibility != null) {
    patches.push({
      path: "visibility",
      value: defaults.visibility,
      ownershipTarget: COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CM01_DEFINITION,
      explanation: `Propose default visibility ${defaults.visibility}`,
    });
  }

  if (defaults.formatBlueprintId) {
    patches.push({
      path: "configuration.formatBlueprintId",
      value: defaults.formatBlueprintId,
      ownershipTarget: COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CM04_CONFIGURATION,
      explanation: `Propose format blueprint ${defaults.formatBlueprintId}`,
    });
  }
  if (defaults.divisionBlueprintId) {
    patches.push({
      path: "configuration.divisionBlueprintId",
      value: defaults.divisionBlueprintId,
      ownershipTarget: COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CORE_DIVISION,
      explanation: `Propose division blueprint ${defaults.divisionBlueprintId}`,
    });
  }
  if (defaults.scheduleBlueprintId) {
    patches.push({
      path: "configuration.scheduleBlueprintId",
      value: defaults.scheduleBlueprintId,
      ownershipTarget: COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CORE_SCHEDULE,
      explanation: `Propose schedule blueprint ${defaults.scheduleBlueprintId}`,
    });
  }
  if (defaults.scoringBlueprintId) {
    patches.push({
      path: "configuration.scoringBlueprintId",
      value: defaults.scoringBlueprintId,
      ownershipTarget: COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CORE_SCORING,
      explanation: `Propose scoring blueprint ${defaults.scoringBlueprintId}`,
    });
  }
  if (defaults.standingsBlueprintId) {
    patches.push({
      path: "configuration.standingsBlueprintId",
      value: defaults.standingsBlueprintId,
      ownershipTarget: COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CORE_STANDINGS,
      explanation: `Propose standings blueprint ${defaults.standingsBlueprintId}`,
    });
  }
  if (defaults.registrationDefaults) {
    patches.push({
      path: "configuration.registrationDefaults",
      value: defaults.registrationDefaults,
      ownershipTarget: COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CM04_CONFIGURATION,
      explanation: "Propose registration defaults (CM-04 owns detailed config)",
    });
  }

  // Deterministic patch order
  patches.sort((a, b) => {
    const byPath = String(a.path).localeCompare(String(b.path), "en");
    if (byPath !== 0) return byPath;
    return String(a.ownershipTarget).localeCompare(String(b.ownershipTarget), "en");
  });

  const warnings = (compatibility.issues || []).filter(
    (i) => i.severity === COMPETITION_TEMPLATE_ISSUE_SEVERITY.WARNING
  );
  const blockedRequirements = (compatibility.issues || []).filter(
    (i) => i.severity === COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
  );

  const requiredCapabilities = Array.isArray(requirements.requiredCapabilities)
    ? [...requirements.requiredCapabilities].sort((a, b) =>
        String(a).localeCompare(String(b), "en")
      )
    : [];

  const sourceDefinitionRevision = /** @type {number} */ (definition.revision);
  const expectedOutputRevision =
    nextCompetitionDefinitionRevision(sourceDefinitionRevision);

  const planBody = {
    competitionId: definition.competitionId,
    tenantId: String(options.tenantId).trim(),
    selectedTemplate: {
      templateId: template.templateId,
      templateVersion: template.templateVersion,
    },
    sourceDefinitionRevision,
    expectedOutputRevision,
    patches,
    proposedRuleSet: defaults.ruleSet ?? null,
    proposedRegistrationDefaults: defaults.registrationDefaults ?? null,
    requiredCapabilities,
    warnings,
    blockedRequirements,
    compatibilityProof: {
      status: compatibility.status,
      ok: compatibility.ok,
      issueCodes: (compatibility.issues || []).map((i) => i.code),
    },
  };

  const planId = stableChecksum(planBody);

  return deepFreeze({
    planId,
    ...planBody,
  });
}

/**
 * Project plan → CM-01 definition patch (only CM01_DEFINITION ownership paths).
 * @param {CompetitionTemplateInstantiationPlan} plan
 * @returns {Readonly<object>}
 */
export function projectDefinitionPatch(plan) {
  /** @type {Record<string, unknown>} */
  const patch = {};
  for (const item of plan.patches) {
    if (item.ownershipTarget !== COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CM01_DEFINITION) {
      continue;
    }
    if (item.path === "template") patch.template = item.value;
    else if (item.path === "ruleSet") patch.ruleSet = item.value;
    else if (item.path === "visibility") patch.visibility = item.value;
  }
  return deepFreeze(patch);
}

/**
 * Instantiate template into a deterministic patch/proposal result.
 * Does not mutate inputs. Does not write. Does not call CM-01 update.
 *
 * @param {object} template
 * @param {object} definition
 * @param {{
 *   tenantId: string,
 *   competitionId?: string,
 *   replaceIntent?: boolean,
 *   expectedRevision?: number,
 * }} options
 * @returns {Readonly<CompetitionTemplateInstantiationResult>}
 */
export function instantiateCompetitionTemplate(template, definition, options = {}) {
  const templateSnap = clonePlain(template);
  const definitionSnap = clonePlain(definition);
  void templateSnap;
  void definitionSnap;

  if (!isNonEmptyString(options.tenantId)) {
    return deepFreeze({
      ok: false,
      status: COMPETITION_TEMPLATE_INSTANTIATION_STATUS.FAILURE,
      plan: null,
      definitionPatch: null,
      proposedFragments: Object.freeze([]),
      explanation: buildExplanation([
        createFieldError(
          "tenantId",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
          "explicit tenantId is required",
          {}
        ),
      ]),
      errors: [
        createFieldError(
          "tenantId",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
          "explicit tenantId is required",
          {}
        ),
      ],
    });
  }

  const compatibility = evaluateTemplateCompatibility(template, definition, options);
  if (!compatibility.ok) {
    const errors = compatibilityErrorsAsFieldErrors(compatibility);
    return deepFreeze({
      ok: false,
      status: COMPETITION_TEMPLATE_INSTANTIATION_STATUS.FAILURE,
      plan: null,
      definitionPatch: null,
      proposedFragments: Object.freeze([]),
      explanation: {
        summary: compatibility.explanation.summary,
        reasons: compatibility.explanation.reasons,
      },
      errors,
    });
  }

  const plan = buildInstantiationPlan(template, definition, compatibility, options);
  if (plan.blockedRequirements.length > 0) {
    return deepFreeze({
      ok: false,
      status: COMPETITION_TEMPLATE_INSTANTIATION_STATUS.FAILURE,
      plan,
      definitionPatch: null,
      proposedFragments: Object.freeze([...plan.patches]),
      explanation: buildExplanation([
        createFieldError(
          "compatibility",
          COMPETITION_TEMPLATE_ERROR_CODE.INSTANTIATION_BLOCKED,
          "instantiation blocked by compatibility requirements",
          {}
        ),
      ]),
      errors: [
        createFieldError(
          "compatibility",
          COMPETITION_TEMPLATE_ERROR_CODE.INSTANTIATION_BLOCKED,
          "instantiation blocked by compatibility requirements",
          {}
        ),
      ],
    });
  }

  const definitionPatch = projectDefinitionPatch(plan);
  const reasons = [
    `planId=${plan.planId}`,
    `template=${plan.selectedTemplate.templateId}@${plan.selectedTemplate.templateVersion}`,
    `sourceRevision=${plan.sourceDefinitionRevision}`,
    `expectedOutputRevision=${plan.expectedOutputRevision}`,
    "patch/proposal only — no persistence write",
    "CompetitionDefinition input not mutated",
  ];
  if (options.replaceIntent === true) {
    reasons.push("explicit replaceIntent acknowledged");
  }

  return deepFreeze({
    ok: true,
    status: COMPETITION_TEMPLATE_INSTANTIATION_STATUS.SUCCESS,
    plan,
    definitionPatch,
    proposedFragments: Object.freeze([...plan.patches]),
    explanation: {
      summary: "Template instantiated to deterministic patch/proposal.",
      reasons: Object.freeze(reasons),
    },
  });
}

/**
 * Envelope helpers for command layer.
 */
export { validationOk, validationFail };
