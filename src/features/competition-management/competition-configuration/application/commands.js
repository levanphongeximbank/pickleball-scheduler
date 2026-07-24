/**
 * Application commands for Competition Configuration (CM-04).
 *
 * Pure / capability-local: no CM-01 mutation, no CM-03 version creation,
 * no Competition Core execution, no production DB writes. Fail-closed.
 */

import {
  COMPETITION_CONFIGURATION_STATUS,
  COMPETITION_CONFIGURATION_INITIAL_REVISION,
  nextCompetitionConfigurationRevision,
  isConfigurationEditableStatus,
} from "../constants/index.js";
import { COMPETITION_CONFIGURATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
  snapshotInput,
} from "../contracts/validation.js";
import {
  clonePlain,
  isNonEmptyString,
  canonicalizeJson,
  deepFreeze,
} from "../contracts/shared.js";
import {
  collectDefinitionScopeErrors,
  validateCompetitionConfigurationInput,
  isCompetitionConfiguration,
  semanticConfigurationPayload,
} from "../contracts/configuration.js";
import { createInMemoryCompetitionConfigurationRepository } from "../repository/index.js";
import { compareCompetitionConfigurations } from "../comparison/index.js";
import { projectCompetitionConfigurationSnapshot } from "../snapshot/index.js";
import { extractCm04ProposalFragments } from "../template-proposal/index.js";

/**
 * @param {object} [options]
 * @returns {{ ok: true, repository: object } | { ok: false, result: object }}
 */
function requireRepository(options = {}) {
  if (options.repository) {
    return { ok: true, repository: options.repository };
  }
  return {
    ok: false,
    result: validationFail([
      createFieldError(
        "repository",
        COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT,
        "explicit capability-local repository is required (no implicit global store)",
        {}
      ),
    ]),
  };
}

/**
 * Create a draft CompetitionConfiguration for an editable CM-01 definition.
 *
 * Empty sections are allowed (explicit empty draft).
 * Does not mutate definition, bump CM-01 revision, publish, or write production DB.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   sections?: object,
 *   metadata?: object,
 *   repository?: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionConfigurationValidationResult}
 */
export function createDraftCompetitionConfiguration(command = {}) {
  const commandSnap = snapshotInput(command);
  const definitionSnap = snapshotInput(command.definition);
  void commandSnap;

  /** @type {object[]} */
  const errors = [];
  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }

  const tenantId = isNonEmptyString(cmd.tenantId)
    ? String(cmd.tenantId).trim()
    : "";
  const competitionId = isNonEmptyString(cmd.competitionId)
    ? String(cmd.competitionId).trim()
    : "";

  if (tenantId && competitionId) {
    errors.push(
      ...collectDefinitionScopeErrors(cmd.definition, {
        tenantId,
        competitionId,
        expectedDefinitionRevision: cmd.expectedDefinitionRevision,
        requireEditable: true,
      })
    );
  }

  if (errors.length > 0) {
    void definitionSnap;
    return validationFail(errors);
  }

  const definition = /** @type {any} */ (cmd.definition);
  const candidate = {
    tenantId,
    competitionId,
    revision: COMPETITION_CONFIGURATION_INITIAL_REVISION,
    status: COMPETITION_CONFIGURATION_STATUS.DRAFT,
    sourceDefinitionRevision: definition.revision,
    competitionType: definition.competitionType,
    scope: definition.scope,
    sections: cmd.sections ?? {},
    metadata: cmd.metadata ?? {},
  };

  const validated = validateCompetitionConfigurationInput(candidate, {
    requireEditableStatus: true,
    definition,
  });
  if (!validated.ok) {
    void definitionSnap;
    return validated;
  }

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;

  const saved = repository.createConfiguration(validated.value);
  void definitionSnap;
  if (!saved.ok) return saved;

  return validationOk(saved.value, {
    summary: "Draft competition configuration created.",
    reasons: Object.freeze([
      `revision=${COMPETITION_CONFIGURATION_INITIAL_REVISION}`,
      "status=draft",
      "definitionNotMutated",
      "notPublished",
      "notCompetitionVersion",
    ]),
  });
}

/**
 * Update an existing draft configuration with optimistic concurrency.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   expectedConfigurationRevision: number,
 *   sections?: object,
 *   replaceSections?: boolean,
 *   metadata?: object,
 *   status?: string,
 *   repository?: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionConfigurationValidationResult}
 */
export function updateDraftCompetitionConfiguration(command = {}) {
  const commandSnap = snapshotInput(command);
  const definitionSnap = snapshotInput(command.definition);
  void commandSnap;

  /** @type {object[]} */
  const errors = [];
  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (!Number.isInteger(cmd.expectedConfigurationRevision)) {
    errors.push(
      createFieldError(
        "expectedConfigurationRevision",
        COMPETITION_CONFIGURATION_ERROR_CODE.STALE_CONFIGURATION_REVISION,
        "expectedConfigurationRevision must be an integer",
        {}
      )
    );
  }

  const tenantId = isNonEmptyString(cmd.tenantId)
    ? String(cmd.tenantId).trim()
    : "";
  const competitionId = isNonEmptyString(cmd.competitionId)
    ? String(cmd.competitionId).trim()
    : "";

  if (tenantId && competitionId) {
    errors.push(
      ...collectDefinitionScopeErrors(cmd.definition, {
        tenantId,
        competitionId,
        expectedDefinitionRevision: cmd.expectedDefinitionRevision,
        requireEditable: true,
      })
    );
  }

  // Reject attempts to change immutable identity via command fields.
  if (
    cmd.configurationId != null ||
    (cmd.newTenantId != null && cmd.newTenantId !== tenantId) ||
    (cmd.newCompetitionId != null && cmd.newCompetitionId !== competitionId)
  ) {
    errors.push(
      createFieldError(
        "configurationId",
        COMPETITION_CONFIGURATION_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE,
        "configuration identity (tenantId/competitionId/configurationId) is immutable",
        {}
      )
    );
  }

  if (errors.length > 0) {
    void definitionSnap;
    return validationFail(errors);
  }

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;

  const found = repository.findConfiguration({ tenantId, competitionId });
  if (!found.ok) return found;

  const existing = /** @type {any} */ (found.value);
  if (!isConfigurationEditableStatus(existing.status)) {
    void definitionSnap;
    return validationFail([
      createFieldError(
        "status",
        COMPETITION_CONFIGURATION_ERROR_CODE.NON_EDITABLE_CONFIGURATION,
        "only draft configurations may be updated",
        { status: existing.status }
      ),
    ]);
  }

  if (existing.revision !== cmd.expectedConfigurationRevision) {
    void definitionSnap;
    return validationFail([
      createFieldError(
        "expectedConfigurationRevision",
        COMPETITION_CONFIGURATION_ERROR_CODE.STALE_CONFIGURATION_REVISION,
        "expectedConfigurationRevision does not match current configuration revision",
        {
          expected: cmd.expectedConfigurationRevision,
          actual: existing.revision,
        }
      ),
    ]);
  }

  const definition = /** @type {any} */ (cmd.definition);
  const nextSections =
    cmd.replaceSections === true
      ? (cmd.sections ?? {})
      : {
          ...clonePlain(existing.sections),
          ...(cmd.sections && typeof cmd.sections === "object"
            ? cmd.sections
            : {}),
        };

  // Reject unknown section keys silently? No — validation will catch unknown.
  const nextStatus =
    cmd.status != null ? cmd.status : COMPETITION_CONFIGURATION_STATUS.DRAFT;

  const candidate = {
    configurationId: existing.configurationId,
    tenantId,
    competitionId,
    revision: nextCompetitionConfigurationRevision(existing.revision),
    status: nextStatus,
    sourceDefinitionRevision: definition.revision,
    competitionType: definition.competitionType,
    scope: definition.scope,
    sections: nextSections,
    metadata:
      cmd.metadata != null
        ? { ...clonePlain(existing.metadata), ...clonePlain(cmd.metadata) }
        : clonePlain(existing.metadata),
  };

  // No-op detection on semantic payload (excluding revision).
  const semanticBefore = semanticConfigurationPayload({
    ...existing,
    sourceDefinitionRevision: definition.revision,
    competitionType: definition.competitionType,
    scope: definition.scope,
  });
  const semanticAfterProbe = {
    competitionId,
    tenantId,
    status: nextStatus,
    sourceDefinitionRevision: definition.revision,
    competitionType: definition.competitionType,
    scope: definition.scope,
    sections: nextSections,
    metadata: candidate.metadata,
  };

  if (
    canonicalizeJson(semanticBefore) === canonicalizeJson(semanticAfterProbe)
  ) {
    void definitionSnap;
    return validationOk(clonePlain(existing), {
      summary: "Competition configuration update is a no-op.",
      reasons: Object.freeze([
        `revision=${existing.revision}`,
        "unchanged",
        COMPETITION_CONFIGURATION_ERROR_CODE.NO_OP,
      ]),
    });
  }

  const validated = validateCompetitionConfigurationInput(candidate, {
    requireEditableStatus: true,
    definition,
  });
  if (!validated.ok) {
    void definitionSnap;
    return validated;
  }

  const saved = repository.saveConfigurationWithExpectedRevision({
    tenantId,
    competitionId,
    expectedConfigurationRevision: cmd.expectedConfigurationRevision,
    configuration: validated.value,
  });
  void definitionSnap;
  if (!saved.ok) return saved;

  return validationOk(saved.value, {
    summary: "Draft competition configuration updated.",
    reasons: Object.freeze([
      `revision=${saved.value.revision}`,
      "definitionNotMutated",
      "notPublished",
      "notCompetitionVersion",
    ]),
  });
}

/**
 * Apply CM-02 instantiation proposal to create or update CM-04 configuration.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   instantiationResult: object,
 *   expectedConfigurationRevision?: number,
 *   replaceExistingConfiguration?: boolean,
 *   repository?: object,
 * }} command
 */
export function applyTemplateConfigurationProposal(command = {}) {
  const commandSnap = snapshotInput(command);
  const proposalSnap = snapshotInput(command.instantiationResult);
  const definitionSnap = snapshotInput(command.definition);
  void commandSnap;

  /** @type {object[]} */
  const errors = [];
  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }

  const tenantId = isNonEmptyString(cmd.tenantId)
    ? String(cmd.tenantId).trim()
    : "";
  const competitionId = isNonEmptyString(cmd.competitionId)
    ? String(cmd.competitionId).trim()
    : "";

  if (tenantId && competitionId) {
    errors.push(
      ...collectDefinitionScopeErrors(cmd.definition, {
        tenantId,
        competitionId,
        expectedDefinitionRevision: cmd.expectedDefinitionRevision,
        requireEditable: true,
      })
    );
  }

  if (errors.length > 0) {
    void proposalSnap;
    void definitionSnap;
    return validationFail(errors);
  }

  const extracted = extractCm04ProposalFragments(cmd.instantiationResult, {
    tenantId,
    competitionId,
    expectedSourceDefinitionRevision: cmd.expectedDefinitionRevision,
  });
  if (!extracted.ok) {
    void proposalSnap;
    void definitionSnap;
    return extracted;
  }

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;

  const existingLookup = repository.findConfiguration({ tenantId, competitionId });
  const hasExisting = existingLookup.ok === true;

  if (hasExisting) {
    const existing = /** @type {any} */ (existingLookup.value);
    const hasData = Object.keys(existing.sections || {}).length > 0;
    if (hasData && cmd.replaceExistingConfiguration !== true) {
      void proposalSnap;
      void definitionSnap;
      return validationFail([
        createFieldError(
          "replaceExistingConfiguration",
          COMPETITION_CONFIGURATION_ERROR_CODE.EXPLICIT_REPLACEMENT_REQUIRED,
          "existing configuration has sections; set replaceExistingConfiguration=true to overwrite",
          { configurationRevision: existing.revision }
        ),
      ]);
    }

    if (!Number.isInteger(cmd.expectedConfigurationRevision)) {
      void proposalSnap;
      void definitionSnap;
      return validationFail([
        createFieldError(
          "expectedConfigurationRevision",
          COMPETITION_CONFIGURATION_ERROR_CODE.STALE_CONFIGURATION_REVISION,
          "expectedConfigurationRevision is required when configuration already exists",
          {}
        ),
      ]);
    }

    const updated = updateDraftCompetitionConfiguration({
      tenantId,
      competitionId,
      definition: cmd.definition,
      expectedDefinitionRevision: cmd.expectedDefinitionRevision,
      expectedConfigurationRevision: cmd.expectedConfigurationRevision,
      sections: extracted.value.sectionUpdates,
      replaceSections: true,
      metadata: {
        createdFromTemplateProposal: true,
        templateIdentity: extracted.value.templateIdentity,
      },
      repository,
    });

    void proposalSnap;
    void definitionSnap;
    if (!updated.ok) return updated;

    return validationOk(
      deepFreeze({
        configuration: updated.value,
        appliedSections: extracted.value.appliedSections,
        skippedUnsupportedSections: extracted.value.skippedUnsupportedSections,
        definitionPatchProposals: extracted.value.definitionPatchProposals,
        coreOwnedProposals: extracted.value.coreOwnedProposals,
        conflicts: [],
        warnings: [],
      }),
      {
        summary: "Template configuration proposal applied to existing configuration.",
        reasons: Object.freeze([
          `revision=${updated.value.revision}`,
          "replacedExisting=true",
          "cm01TemplateReferenceNotUpdated",
          "cm03VersionNotCreated",
        ]),
      }
    );
  }

  const created = createDraftCompetitionConfiguration({
    tenantId,
    competitionId,
    definition: cmd.definition,
    expectedDefinitionRevision: cmd.expectedDefinitionRevision,
    sections: extracted.value.sectionUpdates,
    metadata: {
      createdFromTemplateProposal: true,
      templateIdentity: extracted.value.templateIdentity,
    },
    repository,
  });

  void proposalSnap;
  void definitionSnap;
  if (!created.ok) return created;

  return validationOk(
    deepFreeze({
      configuration: created.value,
      appliedSections: extracted.value.appliedSections,
      skippedUnsupportedSections: extracted.value.skippedUnsupportedSections,
      definitionPatchProposals: extracted.value.definitionPatchProposals,
      coreOwnedProposals: extracted.value.coreOwnedProposals,
      conflicts: [],
      warnings: [],
    }),
    {
      summary: "Template configuration proposal applied (created configuration).",
      reasons: Object.freeze([
        `revision=${created.value.revision}`,
        "cm01TemplateReferenceNotUpdated",
        "cm03VersionNotCreated",
      ]),
    }
  );
}

/**
 * Validate configuration without persistence.
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   configuration: object,
 * }} command
 */
export function validateCompetitionConfigurationCommand(command = {}) {
  const snap = snapshotInput(command);
  void snap;
  const cmd = command && typeof command === "object" ? command : {};
  /** @type {object[]} */
  const errors = [];

  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }

  const tenantId = isNonEmptyString(cmd.tenantId)
    ? String(cmd.tenantId).trim()
    : "";
  const competitionId = isNonEmptyString(cmd.competitionId)
    ? String(cmd.competitionId).trim()
    : "";

  if (tenantId && competitionId) {
    errors.push(
      ...collectDefinitionScopeErrors(cmd.definition, {
        tenantId,
        competitionId,
        expectedDefinitionRevision: cmd.expectedDefinitionRevision,
        requireEditable: false,
      })
    );
  }

  if (errors.length > 0) return validationFail(errors);

  const configuration = cmd.configuration;
  if (!configuration || typeof configuration !== "object") {
    return validationFail([
      createFieldError(
        "configuration",
        COMPETITION_CONFIGURATION_ERROR_CODE.MALFORMED_CONFIGURATION,
        "explicit configuration is required",
        {}
      ),
    ]);
  }

  return validateCompetitionConfigurationInput(configuration, {
    definition: cmd.definition,
  });
}

/**
 * @param {object} command
 */
export function compareCompetitionConfigurationsCommand(command = {}) {
  return compareCompetitionConfigurations(command);
}

/**
 * @param {object} command
 */
export function projectCompetitionConfigurationSnapshotCommand(command = {}) {
  return projectCompetitionConfigurationSnapshot(command);
}

/**
 * @param {{ tenantId: string, competitionId: string, repository?: object }} command
 */
export function getCompetitionConfiguration(command = {}) {
  const repoGate = requireRepository(command);
  if (!repoGate.ok) return repoGate.result;
  return repoGate.repository.findConfiguration({
    tenantId: command.tenantId,
    competitionId: command.competitionId,
  });
}

/**
 * Factory for capability-local repository (tests / dormant).
 */
export function createCapabilityLocalConfigurationRepository() {
  return createInMemoryCompetitionConfigurationRepository();
}

export { isCompetitionConfiguration };
