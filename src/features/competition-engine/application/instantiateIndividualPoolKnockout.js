/**
 * E2E-02 template instantiation — CM-02 public commands + composition fingerprint.
 */

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
  createDraftCompetitionDefinition,
} from "../../competition-management/competition-definition/index.js";
import {
  registerCompetitionTemplate,
  getCompetitionTemplate,
  instantiateCompetitionTemplateCommand,
  createInMemoryTemplateCatalog,
  COMPETITION_TEMPLATE_ERROR_CODE,
} from "../../competition-management/template-instantiation/index.js";
import { createPoolKnockoutFormatDefinition } from "../formats/poolKnockoutFormat.js";
import {
  createIndividualPoolKnockoutTemplateDefinition,
  getIndividualPoolKnockoutTemplateSeed,
} from "../templates/individualPoolKnockoutTemplate.js";
import {
  E2E02_FORMAT_VERSION,
  E2E02_RULE_REFERENCES,
  E2E02_TEMPLATE_ID,
  E2E02_TEMPLATE_VERSION,
} from "../composition/constants.js";
import { E2E02_ERROR_CODE, failE2E02 } from "../composition/errors.js";
import {
  clonePlain,
  computeDeterministicFingerprint,
  deepFreeze,
  isNonEmptyString,
} from "../composition/fingerprint.js";

/**
 * Ensure the Individual Pool+KO template is registered in a CM catalog.
 * Does not mutate the frozen seed source.
 *
 * @param {{ catalog?: object }} [options]
 */
export function ensureIndividualPoolKnockoutTemplateRegistered(options = {}) {
  const catalog = options.catalog || createInMemoryTemplateCatalog();
  const seed = getIndividualPoolKnockoutTemplateSeed();
  const existing = getCompetitionTemplate({
    tenantId: "system",
    templateId: E2E02_TEMPLATE_ID,
    templateVersion: E2E02_TEMPLATE_VERSION,
    catalog,
  });
  if (existing.ok) {
    return { catalog, template: existing.value, registered: false };
  }

  const registered = registerCompetitionTemplate(clonePlain(seed), { catalog });
  if (!registered.ok) {
    // Retry get in case of race/duplicate from parallel register.
    const again = getCompetitionTemplate({
      tenantId: "system",
      templateId: E2E02_TEMPLATE_ID,
      templateVersion: E2E02_TEMPLATE_VERSION,
      catalog,
    });
    if (again.ok) {
      return { catalog, template: again.value, registered: false };
    }
    failE2E02(
      E2E02_ERROR_CODE.CM_INSTANTIATION_FAILED,
      "failed to register Individual Pool+KO template into CM catalog",
      { errors: registered.errors, code: COMPETITION_TEMPLATE_ERROR_CODE }
    );
  }
  return { catalog, template: registered.value, registered: true };
}

/**
 * Instantiate Individual Pool+KO template against a CM-01 definition draft.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId?: string,
 *   definition?: object,
 *   expectedRevision?: number,
 *   formatOverrides?: object,
 *   catalog?: object,
 *   deterministicSeed: string,
 *   createdAt?: string,
 * }} input
 */
export function instantiateIndividualPoolKnockoutTemplate(input) {
  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) {
    failE2E02(E2E02_ERROR_CODE.MISSING_TENANT, "tenantId is required", {});
  }
  if (!isNonEmptyString(input.deterministicSeed)) {
    failE2E02(
      E2E02_ERROR_CODE.MISSING_DETERMINISTIC_SEED,
      "deterministicSeed is required for instantiation",
      {}
    );
  }

  const { catalog, template } = ensureIndividualPoolKnockoutTemplateRegistered({
    catalog: input.catalog,
  });

  // Guard: callers must not mutate catalog template source.
  const seedProbe = getIndividualPoolKnockoutTemplateSeed();
  if (seedProbe.templateId !== E2E02_TEMPLATE_ID) {
    failE2E02(
      E2E02_ERROR_CODE.TEMPLATE_MUTATION_REJECTED,
      "template seed source corrupted",
      {}
    );
  }

  let definition = input.definition;
  if (!definition) {
    const competitionId =
      String(input.competitionId || "").trim() ||
      `comp-${tenantId}-ind-pk`;
    const created = createDraftCompetitionDefinition({
      competitionId,
      tenantId,
      owner: {
        ownerType: COMPETITION_OWNER_TYPE.ORGANIZATION,
        ownerId: `org-${tenantId}`,
      },
      name: "Individual Pool + Knockout",
      competitionType: COMPETITION_TYPE.INTERNAL_TOURNAMENT,
      scope: COMPETITION_SCOPE.TENANT,
      visibility: COMPETITION_VISIBILITY.TENANT,
      venues: [{ venueId: `venue-${tenantId}` }],
      clubs: [],
      registrationWindow: {
        opensAt: "2026-01-01T00:00:00.000Z",
        closesAt: "2026-01-31T00:00:00.000Z",
      },
      plannedPeriod: {
        startsAt: "2026-02-01T00:00:00.000Z",
        endsAt: "2026-02-28T00:00:00.000Z",
      },
      createdAt: input.createdAt || "2026-01-01T00:00:00.000Z",
    });
    if (!created.ok) {
      failE2E02(
        E2E02_ERROR_CODE.CM_INSTANTIATION_FAILED,
        "failed to create draft competition definition",
        { errors: created.errors }
      );
    }
    definition = created.value;
  }

  if (definition.competitionType === COMPETITION_TYPE.TEAM_TOURNAMENT) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_COMPETITION_TYPE,
      "Individual Pool+KO template does not support team_tournament",
      { competitionType: definition.competitionType }
    );
  }
  if (
    definition.competitionType !== COMPETITION_TYPE.INTERNAL_TOURNAMENT &&
    definition.competitionType !== COMPETITION_TYPE.OFFICIAL_TOURNAMENT
  ) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_COMPETITION_TYPE,
      "competition type incompatible with Individual Pool+KO template",
      { competitionType: definition.competitionType }
    );
  }

  const expectedRevision =
    input.expectedRevision != null
      ? input.expectedRevision
      : definition.revision;

  const instantiation = instantiateCompetitionTemplateCommand({
    tenantId,
    templateId: E2E02_TEMPLATE_ID,
    templateVersion: E2E02_TEMPLATE_VERSION,
    definition,
    expectedRevision,
    catalog,
  });

  if (!instantiation.ok) {
    failE2E02(
      E2E02_ERROR_CODE.CM_INSTANTIATION_FAILED,
      "CM-02 template instantiation failed",
      { errors: instantiation.errors, explanation: instantiation.explanation }
    );
  }

  const format = createPoolKnockoutFormatDefinition(input.formatOverrides || {});
  const compositionFingerprint = computeDeterministicFingerprint(
    {
      templateId: E2E02_TEMPLATE_ID,
      templateVersion: E2E02_TEMPLATE_VERSION,
      formatId: format.formatId,
      formatVersion: format.formatVersion,
      formatFingerprint: format.configurationFingerprint,
      planId: instantiation.plan?.planId,
      competitionId: definition.competitionId,
      tenantId,
      deterministicSeed: input.deterministicSeed,
      workflowId: E2E02_RULE_REFERENCES.workflowId,
    },
    "instantiation"
  );

  return deepFreeze({
    ok: true,
    templateId: E2E02_TEMPLATE_ID,
    templateVersion: E2E02_TEMPLATE_VERSION,
    formatId: format.formatId,
    formatVersion: format.formatVersion || E2E02_FORMAT_VERSION,
    format,
    template,
    definition,
    instantiation,
    ruleReferences: E2E02_RULE_REFERENCES,
    workflowReference: E2E02_RULE_REFERENCES.workflowId,
    compositionFingerprint,
    catalog,
    immutable: true,
  });
}

export { createIndividualPoolKnockoutTemplateDefinition };
