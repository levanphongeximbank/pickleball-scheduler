/**
 * E2E-02 — Canonical Individual Tournament Template (Pool + Knockout).
 *
 * CM-02-compatible definition owned by Competition Engine composition layer.
 * Registered into CM catalog via public registerCompetitionTemplate — does not
 * reopen CM closed static catalog unless Owner later promotes the seed.
 */

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
} from "../../competition-management/competition-definition/index.js";
import {
  COMPETITION_TEMPLATE_SCOPE,
  COMPETITION_TEMPLATE_AVAILABILITY,
  COMPETITION_TEMPLATE_PARTICIPANT_MODE,
  validateCompetitionTemplateDefinition,
  deepFreeze as cmDeepFreeze,
} from "../../competition-management/template-instantiation/index.js";
import {
  E2E02_FORMAT_BLUEPRINT_ID,
  E2E02_FORMAT_ID,
  E2E02_FORMAT_VERSION,
  E2E02_RULE_REFERENCES,
  E2E02_TEMPLATE_ID,
  E2E02_TEMPLATE_VERSION,
  E2E02_PARTICIPANT_STRUCTURE,
} from "../composition/constants.js";
import { E2E02_ERROR_CODE, failE2E02 } from "../composition/errors.js";
import {
  computeDeterministicFingerprint,
  deepFreeze,
  clonePlain,
} from "../composition/fingerprint.js";

/**
 * Build the canonical Individual Tournament Pool+KO template definition.
 * Returns a frozen CM-02 CompetitionTemplateDefinition.
 *
 * @param {{
 *   participantStructure?: string,
 *   singlesOrDoubles?: string,
 * }} [options]
 */
export function createIndividualPoolKnockoutTemplateDefinition(options = {}) {
  const participantStructure =
    options.participantStructure ||
    options.singlesOrDoubles ||
    E2E02_PARTICIPANT_STRUCTURE.SINGLES;

  if (
    participantStructure !== E2E02_PARTICIPANT_STRUCTURE.SINGLES &&
    participantStructure !== E2E02_PARTICIPANT_STRUCTURE.DOUBLES
  ) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "participantStructure must be singles or doubles",
      { participantStructure }
    );
  }

  const candidate = {
    templateId: E2E02_TEMPLATE_ID,
    templateVersion: E2E02_TEMPLATE_VERSION,
    templateScope: COMPETITION_TEMPLATE_SCOPE.GLOBAL,
    tenantId: null,
    name: "Individual Tournament — Pool + Knockout",
    description:
      "Canonical Individual Tournament template composing pool round-robin, qualification, and single-elimination knockout via Competition Core executors.",
    supportedCompetitionTypes: [
      COMPETITION_TYPE.INTERNAL_TOURNAMENT,
      COMPETITION_TYPE.OFFICIAL_TOURNAMENT,
    ],
    supportedScopes: [
      COMPETITION_SCOPE.CLUB,
      COMPETITION_SCOPE.MULTI_CLUB,
      COMPETITION_SCOPE.TENANT,
      COMPETITION_SCOPE.OPEN,
    ],
    participantMode: COMPETITION_TEMPLATE_PARTICIPANT_MODE.INDIVIDUAL,
    availability: COMPETITION_TEMPLATE_AVAILABILITY.AVAILABLE,
    requirements: {
      requiresVenue: true,
      requiresClub: false,
      allowedOwnerTypes: [
        COMPETITION_OWNER_TYPE.USER,
        COMPETITION_OWNER_TYPE.CLUB,
        COMPETITION_OWNER_TYPE.ORGANIZATION,
      ],
      requiresRegistrationWindow: true,
      requiresPlannedPeriod: true,
      allowedVisibilities: [
        COMPETITION_VISIBILITY.PRIVATE,
        COMPETITION_VISIBILITY.CLUB,
        COMPETITION_VISIBILITY.TENANT,
        COMPETITION_VISIBILITY.PUBLIC,
      ],
      requiredCapabilities: [
        "registration",
        "eligibility",
        "division",
        "seeding",
        "draw",
        "match_generation",
        "standings",
        "scoring",
        "result_validation",
        "workflow",
        "publication",
        "archive",
      ],
    },
    defaults: {
      visibility: COMPETITION_VISIBILITY.TENANT,
      ruleSet: { ruleSetId: E2E02_RULE_REFERENCES.scoringPolicyId },
      divisionBlueprintId: E2E02_RULE_REFERENCES.divisionCategoryPolicyId,
      formatBlueprintId: E2E02_FORMAT_BLUEPRINT_ID,
      scheduleBlueprintId: E2E02_RULE_REFERENCES.schedulingPolicyId,
      scoringBlueprintId: E2E02_RULE_REFERENCES.scoringPolicyId,
      standingsBlueprintId: E2E02_RULE_REFERENCES.standingsStrategyId,
      registrationDefaults: {
        mode: "entry_approval",
        eligibilityPolicyId: E2E02_RULE_REFERENCES.eligibilityPolicyId,
        registrationPolicyId: E2E02_RULE_REFERENCES.registrationPolicyId,
      },
    },
    capabilityTags: [
      "individual_tournament",
      "pool_knockout",
      "group_round_robin",
      "single_elimination",
      "e2e-02",
    ],
    metadata: {
      e2eWorkstream: "E2E-02",
      formatId: E2E02_FORMAT_ID,
      formatVersion: E2E02_FORMAT_VERSION,
      participantStructure,
      seedingStrategyId: E2E02_RULE_REFERENCES.seedingStrategyId,
      courtAssignmentPolicyId: E2E02_RULE_REFERENCES.courtAssignmentPolicyId,
      resultValidationPolicyId: E2E02_RULE_REFERENCES.resultValidationPolicyId,
      workflowId: E2E02_RULE_REFERENCES.workflowId,
      publicationArchiveCompatible: true,
      deterministicSeedReplayCompatible: true,
      tenantRequired: true,
      permissionRequired: true,
      ownership: "competition-engine/e2e-02",
      doesNotContainRuntimeServices: true,
    },
  };

  const validated = validateCompetitionTemplateDefinition(candidate);
  if (!validated.ok) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_TEMPLATE,
      "Individual Pool+KO template failed CM-02 validation",
      { errors: validated.errors }
    );
  }

  return validated.value;
}

/**
 * Validate an external template candidate against E2E-02 Individual Pool+KO expectations.
 *
 * @param {unknown} templateInput
 */
export function validateIndividualPoolKnockoutTemplate(templateInput) {
  const cm = validateCompetitionTemplateDefinition(templateInput);
  if (!cm.ok) {
    return {
      ok: false,
      code: E2E02_ERROR_CODE.INVALID_TEMPLATE,
      errors: cm.errors,
    };
  }

  const t = cm.value;
  const errors = [];

  if (t.templateId !== E2E02_TEMPLATE_ID) {
    errors.push({
      field: "templateId",
      code: E2E02_ERROR_CODE.INVALID_TEMPLATE,
      message: `expected templateId ${E2E02_TEMPLATE_ID}`,
    });
  }
  if (t.templateVersion !== E2E02_TEMPLATE_VERSION) {
    errors.push({
      field: "templateVersion",
      code: E2E02_ERROR_CODE.INVALID_TEMPLATE,
      message: `expected templateVersion ${E2E02_TEMPLATE_VERSION}`,
    });
  }
  if (t.participantMode !== COMPETITION_TEMPLATE_PARTICIPANT_MODE.INDIVIDUAL) {
    errors.push({
      field: "participantMode",
      code: E2E02_ERROR_CODE.INVALID_PARTICIPANT_MODE,
      message: "participantMode must be individual",
    });
  }

  const types = t.supportedCompetitionTypes || [];
  const allowed = new Set([
    COMPETITION_TYPE.INTERNAL_TOURNAMENT,
    COMPETITION_TYPE.OFFICIAL_TOURNAMENT,
  ]);
  for (const type of types) {
    if (!allowed.has(type)) {
      errors.push({
        field: "supportedCompetitionTypes",
        code: E2E02_ERROR_CODE.INVALID_COMPETITION_TYPE,
        message: `unsupported competition type for IND Pool+KO: ${type}`,
      });
    }
  }

  if (t.defaults?.formatBlueprintId !== E2E02_FORMAT_BLUEPRINT_ID) {
    errors.push({
      field: "defaults.formatBlueprintId",
      code: E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      message: `formatBlueprintId must be ${E2E02_FORMAT_BLUEPRINT_ID}`,
    });
  }

  const meta = t.metadata || {};
  const requiredMeta = [
    "seedingStrategyId",
    "workflowId",
    "resultValidationPolicyId",
    "courtAssignmentPolicyId",
  ];
  for (const key of requiredMeta) {
    if (!meta[key] || typeof meta[key] !== "string" || !String(meta[key]).trim()) {
      errors.push({
        field: `metadata.${key}`,
        code: E2E02_ERROR_CODE.MISSING_RULE_REFERENCE,
        message: `${key} rule/workflow reference is required`,
      });
    }
  }
  if (!meta.workflowId) {
    errors.push({
      field: "metadata.workflowId",
      code: E2E02_ERROR_CODE.MISSING_WORKFLOW_REFERENCE,
      message: "workflow reference is required",
    });
  }

  if (errors.length > 0) {
    return { ok: false, code: E2E02_ERROR_CODE.INVALID_TEMPLATE, errors };
  }

  const fingerprint = computeDeterministicFingerprint(
    {
      templateId: t.templateId,
      templateVersion: t.templateVersion,
      formatBlueprintId: t.defaults.formatBlueprintId,
      metadata: meta,
      participantMode: t.participantMode,
      supportedCompetitionTypes: t.supportedCompetitionTypes,
    },
    "tpl"
  );

  return {
    ok: true,
    value: t,
    fingerprint,
  };
}

/**
 * Immutable catalog seed object (clone + freeze). Mutating the returned object
 * does not affect the source factory.
 */
export function getIndividualPoolKnockoutTemplateSeed() {
  const definition = createIndividualPoolKnockoutTemplateDefinition();
  return deepFreeze(clonePlain(definition));
}

/**
 * Assert callers cannot mutate the canonical seed source through returned refs.
 * @returns {{ seed: Readonly<object>, fingerprint: string }}
 */
export function getImmutableIndividualPoolKnockoutTemplate() {
  const seed = getIndividualPoolKnockoutTemplateSeed();
  const validated = validateIndividualPoolKnockoutTemplate(seed);
  if (!validated.ok) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_TEMPLATE,
      "canonical template seed invalid",
      { errors: validated.errors }
    );
  }
  return {
    seed: cmDeepFreeze(clonePlain(seed)),
    fingerprint: validated.fingerprint,
  };
}

export {
  E2E02_TEMPLATE_ID,
  E2E02_TEMPLATE_VERSION,
};
