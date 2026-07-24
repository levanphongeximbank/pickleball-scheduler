/**
 * Application commands for Template Selection & Instantiation (CM-02).
 *
 * Pure / capability-local: no persistence, audit, notification, payment, or workflow writes.
 * Fail-closed: no first-template fallback, no tenant inference, no silent replace.
 */

import { COMPETITION_TEMPLATE_INITIAL_VERSION } from "../constants/index.js";
import { COMPETITION_TEMPLATE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
  parseTemplateVersionedReference,
  evaluateTemplateCompatibility,
  instantiateCompetitionTemplate,
  validateCompetitionTemplateDefinition,
  isNonEmptyString,
  deepFreeze,
} from "../contracts/index.js";
import {
  getDefaultCapabilityLocalCatalog,
  createInMemoryTemplateCatalog,
} from "../catalog/index.js";

/**
 * @param {object} [options]
 * @returns {import("../catalog/index.js").CompetitionTemplateCatalog}
 */
function resolveCatalog(options = {}) {
  if (options.catalog) return options.catalog;
  return getDefaultCapabilityLocalCatalog();
}

/**
 * Register / validate a template into an explicit catalog (capability-local).
 * @param {object} templateInput
 * @param {{ catalog?: object }} [options]
 */
export function registerCompetitionTemplate(templateInput, options = {}) {
  const snap = snapshotInput(templateInput);
  void snap;
  const catalog = resolveCatalog(options);
  return catalog.register(templateInput);
}

/**
 * List available templates for an explicit tenant (global + matching tenant).
 * Does NOT auto-select.
 *
 * @param {{ tenantId: string, catalog?: object }} command
 */
export function listAvailableCompetitionTemplates(command = {}) {
  const snap = snapshotInput(command);
  void snap;
  const catalog = resolveCatalog(command);
  return catalog.listAvailableForTenant(command.tenantId);
}

/**
 * Explicit template lookup by identity/version for a tenant.
 * @param {{
 *   tenantId: string,
 *   templateId: string,
 *   templateVersion?: number,
 *   catalog?: object,
 * }} command
 */
export function getCompetitionTemplate(command = {}) {
  const snap = snapshotInput(command);
  void snap;
  const catalog = resolveCatalog(command);
  const version =
    command.templateVersion == null
      ? COMPETITION_TEMPLATE_INITIAL_VERSION
      : command.templateVersion;
  return catalog.getByIdentity(command.templateId, version, command.tenantId);
}

/**
 * Explicit selection — never infers template or tenant.
 * Returns selected template + compatibility evaluation against definition.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId?: string,
 *   definition: object,
 *   templateId: string,
 *   templateVersion?: number,
 *   replaceIntent?: boolean,
 *   expectedRevision?: number,
 *   catalog?: object,
 * }} command
 */
export function selectCompetitionTemplate(command = {}) {
  const commandSnap = snapshotInput(command);
  const definitionSnap = snapshotInput(command.definition);
  void commandSnap;
  void definitionSnap;

  if (!isNonEmptyString(command.tenantId)) {
    return validationFail([
      createFieldError(
        "tenantId",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
        "explicit tenantId is required for selection",
        {}
      ),
    ]);
  }
  if (!isNonEmptyString(command.templateId)) {
    return validationFail([
      createFieldError(
        "templateId",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_ID,
        "explicit templateId is required — no first-template fallback",
        {}
      ),
    ]);
  }
  if (!command.definition || typeof command.definition !== "object") {
    return validationFail([
      createFieldError(
        "definition",
        COMPETITION_TEMPLATE_ERROR_CODE.DEFINITION_REQUIRED,
        "CompetitionDefinition is required for selection",
        {}
      ),
    ]);
  }

  const lookup = getCompetitionTemplate({
    tenantId: command.tenantId,
    templateId: command.templateId,
    templateVersion: command.templateVersion,
    catalog: command.catalog,
  });
  if (!lookup.ok) return lookup;

  const compatibility = evaluateTemplateCompatibility(
    lookup.value,
    command.definition,
    {
      tenantId: command.tenantId,
      competitionId: command.competitionId ?? command.definition.competitionId,
      replaceIntent: command.replaceIntent === true,
      expectedRevision: command.expectedRevision,
    }
  );

  if (!compatibility.ok) {
    return validationFail(
      compatibility.issues
        .filter((i) => i.severity === "error")
        .map((i) =>
          createFieldError(i.field, i.code, i.message, {
            ...i.details,
            severity: i.severity,
          })
        )
    );
  }

  return validationOk(
    deepFreeze({
      template: lookup.value,
      reference: {
        templateId: lookup.value.templateId,
        templateVersion: lookup.value.templateVersion,
      },
      compatibility,
      definitionUnchanged: true,
    }),
    {
      summary: "Template selected explicitly; CompetitionDefinition not mutated.",
      reasons: Object.freeze([
        `templateId=${lookup.value.templateId}`,
        `templateVersion=${lookup.value.templateVersion}`,
        `compatibility=${compatibility.status}`,
        "no silent attach — use instantiateCompetitionTemplateCommand",
      ]),
    }
  );
}

/**
 * Evaluate compatibility only (query — no mutation).
 * @param {{
 *   tenantId: string,
 *   competitionId?: string,
 *   definition: object,
 *   templateId: string,
 *   templateVersion?: number,
 *   replaceIntent?: boolean,
 *   expectedRevision?: number,
 *   catalog?: object,
 * }} command
 */
export function evaluateCompetitionTemplateCompatibilityCommand(command = {}) {
  const snap = snapshotInput(command);
  void snap;

  if (!isNonEmptyString(command.tenantId)) {
    return validationFail([
      createFieldError(
        "tenantId",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
        "explicit tenantId is required",
        {}
      ),
    ]);
  }
  if (!isNonEmptyString(command.templateId)) {
    return validationFail([
      createFieldError(
        "templateId",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_ID,
        "explicit templateId is required",
        {}
      ),
    ]);
  }
  if (!command.definition || typeof command.definition !== "object") {
    return validationFail([
      createFieldError(
        "definition",
        COMPETITION_TEMPLATE_ERROR_CODE.DEFINITION_REQUIRED,
        "CompetitionDefinition is required",
        {}
      ),
    ]);
  }

  const lookup = getCompetitionTemplate({
    tenantId: command.tenantId,
    templateId: command.templateId,
    templateVersion: command.templateVersion,
    catalog: command.catalog,
  });
  if (!lookup.ok) return lookup;

  const compatibility = evaluateTemplateCompatibility(
    lookup.value,
    command.definition,
    {
      tenantId: command.tenantId,
      competitionId: command.competitionId ?? command.definition.competitionId,
      replaceIntent: command.replaceIntent === true,
      ...(Object.prototype.hasOwnProperty.call(command, "expectedRevision")
        ? { expectedRevision: command.expectedRevision }
        : {}),
    }
  );

  return validationOk(compatibility, {
    summary: compatibility.explanation.summary,
    reasons: compatibility.explanation.reasons,
  });
}

/**
 * Build plan + instantiate to patch/proposal (no CM-01 mutation, no DB write).
 * Template reference is attached in the proposal only after compatibility PASS.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId?: string,
 *   definition: object,
 *   templateId: string,
 *   templateVersion?: number,
 *   replaceIntent?: boolean,
 *   expectedRevision?: number,
 *   catalog?: object,
 * }} command
 */
export function instantiateCompetitionTemplateCommand(command = {}) {
  const commandSnap = snapshotInput(command);
  const definitionSnap = snapshotInput(command.definition);
  void commandSnap;
  void definitionSnap;

  if (!isNonEmptyString(command.tenantId)) {
    return validationFail([
      createFieldError(
        "tenantId",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
        "explicit tenantId is required",
        {}
      ),
    ]);
  }
  if (!isNonEmptyString(command.templateId)) {
    return validationFail([
      createFieldError(
        "templateId",
        COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_ID,
        "explicit templateId is required — no inferred template",
        {}
      ),
    ]);
  }
  if (!command.definition || typeof command.definition !== "object") {
    return validationFail([
      createFieldError(
        "definition",
        COMPETITION_TEMPLATE_ERROR_CODE.DEFINITION_REQUIRED,
        "CompetitionDefinition is required",
        {}
      ),
    ]);
  }

  // Explicit expectedRevision is required for instantiation (optimistic concurrency baseline).
  if (!Object.prototype.hasOwnProperty.call(command, "expectedRevision")) {
    return validationFail([
      createFieldError(
        "expectedRevision",
        COMPETITION_TEMPLATE_ERROR_CODE.STALE_REVISION,
        "expectedRevision is required for instantiation",
        {}
      ),
    ]);
  }

  const lookup = getCompetitionTemplate({
    tenantId: command.tenantId,
    templateId: command.templateId,
    templateVersion: command.templateVersion,
    catalog: command.catalog,
  });
  if (!lookup.ok) return lookup;

  const result = instantiateCompetitionTemplate(
    lookup.value,
    command.definition,
    {
      tenantId: command.tenantId,
      competitionId: command.competitionId ?? command.definition.competitionId,
      replaceIntent: command.replaceIntent === true,
      expectedRevision: command.expectedRevision,
    }
  );

  if (!result.ok) {
    return validationFail(
      result.errors || [
        createFieldError(
          "instantiation",
          COMPETITION_TEMPLATE_ERROR_CODE.INSTANTIATION_BLOCKED,
          result.explanation?.summary || "instantiation failed",
          {}
        ),
      ]
    );
  }

  // Prove definition not mutated: caller still holds original; we return proposal only.
  return validationOk(result, {
    summary: result.explanation.summary,
    reasons: result.explanation.reasons,
  });
}

/**
 * Reject implicit selection attempts (guard for callers).
 */
export function rejectImplicitTemplateSelection(reason = "implicit selection") {
  return validationFail([
    createFieldError(
      "templateId",
      COMPETITION_TEMPLATE_ERROR_CODE.NO_IMPLICIT_TEMPLATE,
      `implicit template selection is not allowed: ${reason}`,
      {}
    ),
  ]);
}

export {
  createInMemoryTemplateCatalog,
  validateCompetitionTemplateDefinition,
  parseTemplateVersionedReference,
};
