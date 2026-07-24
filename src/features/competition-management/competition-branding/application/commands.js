/**
 * Application commands for Competition Branding (CM-05).
 *
 * Pure / capability-local: no CM-01 mutation, no CM-03 version creation,
 * no CM-04 configuration mutation, no upload/storage/CDN, no publish,
 * no production DB writes. Fail-closed.
 */

import {
  COMPETITION_BRANDING_STATUS,
  COMPETITION_BRANDING_INITIAL_REVISION,
  nextCompetitionBrandingRevision,
  isBrandingEditableStatus,
} from "../constants/index.js";
import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
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
} from "../contracts/shared.js";
import {
  collectDefinitionScopeErrors,
  validateCompetitionBrandingInput,
  isCompetitionBranding,
  semanticBrandingPayload,
} from "../contracts/branding.js";
import { createInMemoryCompetitionBrandingRepository } from "../repository/index.js";
import { compareCompetitionBrandings } from "../comparison/index.js";
import { projectCompetitionBrandingSnapshot } from "../snapshot/index.js";
import { evaluateCompetitionBrandingReadiness } from "../readiness/index.js";

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
        COMPETITION_BRANDING_ERROR_CODE.INVALID_CONTRACT,
        "explicit capability-local repository is required (no implicit global store)",
        {}
      ),
    ]),
  };
}

/**
 * Create a draft CompetitionBranding for an editable CM-01 definition.
 *
 * Empty branding draft is allowed (no assets, no palette).
 * Does not mutate definition, bump CM-01/CM-04 revisions, publish, upload, or write production DB.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   assets?: object[],
 *   palette?: object | null,
 *   typography?: object | string | null,
 *   presentation?: object,
 *   metadata?: object,
 *   repository?: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionBrandingValidationResult}
 */
export function createDraftCompetitionBranding(command = {}) {
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
        COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_BRANDING_ERROR_CODE.MISSING_COMPETITION,
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
    revision: COMPETITION_BRANDING_INITIAL_REVISION,
    status: COMPETITION_BRANDING_STATUS.DRAFT,
    sourceDefinitionRevision: definition.revision,
    assets: cmd.assets ?? [],
    palette: cmd.palette ?? null,
    typography: cmd.typography ?? null,
    presentation: cmd.presentation ?? {},
    metadata: cmd.metadata ?? {},
  };

  const validated = validateCompetitionBrandingInput(candidate, {
    requireEditableStatus: true,
    enforceContrast: true,
  });
  if (!validated.ok) {
    void definitionSnap;
    return validated;
  }

  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;
  const repository = repoGate.repository;

  const saved = repository.createBranding(validated.value);
  void definitionSnap;
  if (!saved.ok) return saved;

  return validationOk(saved.value, {
    summary: "Draft competition branding created.",
    reasons: Object.freeze([
      `revision=${COMPETITION_BRANDING_INITIAL_REVISION}`,
      "status=draft",
      "definitionNotMutated",
      "configurationNotMutated",
      "notCompetitionVersion",
      "notPublished",
      "noUpload",
      "noDefaultColorsInferred",
      "noPlatformBrandInferred",
    ]),
  });
}

/**
 * Update an existing draft branding with optimistic concurrency.
 *
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   expectedBrandingRevision: number,
 *   assets?: object[],
 *   replaceAssets?: boolean,
 *   palette?: object | null,
 *   typography?: object | string | null,
 *   presentation?: object,
 *   metadata?: object,
 *   status?: string,
 *   repository?: object,
 * }} command
 * @returns {import("../contracts/validation.js").CompetitionBrandingValidationResult}
 */
export function updateDraftCompetitionBranding(command = {}) {
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
        COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_BRANDING_ERROR_CODE.MISSING_COMPETITION,
        "explicit competitionId is required",
        {}
      )
    );
  }
  if (!Number.isInteger(cmd.expectedBrandingRevision)) {
    errors.push(
      createFieldError(
        "expectedBrandingRevision",
        COMPETITION_BRANDING_ERROR_CODE.STALE_BRANDING_REVISION,
        "expectedBrandingRevision must be an integer",
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
    cmd.brandingId != null ||
    (cmd.newTenantId != null && cmd.newTenantId !== tenantId) ||
    (cmd.newCompetitionId != null && cmd.newCompetitionId !== competitionId)
  ) {
    errors.push(
      createFieldError(
        "brandingId",
        COMPETITION_BRANDING_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE,
        "branding identity (tenantId/competitionId/brandingId) is immutable",
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

  const found = repository.findBranding({ tenantId, competitionId });
  if (!found.ok) return found;

  const existing = /** @type {any} */ (found.value);
  if (!isBrandingEditableStatus(existing.status)) {
    void definitionSnap;
    return validationFail([
      createFieldError(
        "status",
        COMPETITION_BRANDING_ERROR_CODE.NON_EDITABLE_BRANDING,
        "only draft brandings may be updated",
        { status: existing.status }
      ),
    ]);
  }

  if (existing.revision !== cmd.expectedBrandingRevision) {
    void definitionSnap;
    return validationFail([
      createFieldError(
        "expectedBrandingRevision",
        COMPETITION_BRANDING_ERROR_CODE.STALE_BRANDING_REVISION,
        "expectedBrandingRevision does not match current branding revision",
        {
          expected: cmd.expectedBrandingRevision,
          actual: existing.revision,
        }
      ),
    ]);
  }

  const definition = /** @type {any} */ (cmd.definition);

  const nextAssets =
    cmd.replaceAssets === true
      ? (cmd.assets ?? [])
      : cmd.assets != null
        ? cmd.assets
        : clonePlain(existing.assets);

  const nextPalette =
    cmd.palette !== undefined ? cmd.palette : clonePlain(existing.palette);

  const nextTypography =
    cmd.typography !== undefined
      ? cmd.typography
      : clonePlain(existing.typography);

  const nextPresentation =
    cmd.presentation != null
      ? { ...clonePlain(existing.presentation), ...clonePlain(cmd.presentation) }
      : clonePlain(existing.presentation);

  const nextStatus =
    cmd.status != null ? cmd.status : COMPETITION_BRANDING_STATUS.DRAFT;

  const candidate = {
    brandingId: existing.brandingId,
    tenantId,
    competitionId,
    revision: nextCompetitionBrandingRevision(existing.revision),
    status: nextStatus,
    sourceDefinitionRevision: definition.revision,
    assets: nextAssets,
    palette: nextPalette,
    typography: nextTypography,
    presentation: nextPresentation,
    metadata:
      cmd.metadata != null
        ? { ...clonePlain(existing.metadata), ...clonePlain(cmd.metadata) }
        : clonePlain(existing.metadata),
  };

  const semanticBefore = semanticBrandingPayload({
    ...existing,
    sourceDefinitionRevision: definition.revision,
  });
  const semanticAfterProbe = {
    competitionId,
    tenantId,
    status: nextStatus,
    sourceDefinitionRevision: definition.revision,
    assets: nextAssets,
    palette: nextPalette,
    typography: nextTypography,
    presentation: nextPresentation,
    metadata: candidate.metadata,
  };

  if (
    canonicalizeJson(semanticBefore) === canonicalizeJson(semanticAfterProbe)
  ) {
    void definitionSnap;
    return validationOk(clonePlain(existing), {
      summary: "Competition branding update is a no-op.",
      reasons: Object.freeze([
        `revision=${existing.revision}`,
        "unchanged",
        COMPETITION_BRANDING_ERROR_CODE.NO_OP,
      ]),
    });
  }

  const validated = validateCompetitionBrandingInput(candidate, {
    requireEditableStatus: true,
    enforceContrast: true,
  });
  if (!validated.ok) {
    void definitionSnap;
    return validated;
  }

  const saved = repository.saveBrandingWithExpectedRevision({
    tenantId,
    competitionId,
    expectedBrandingRevision: cmd.expectedBrandingRevision,
    branding: validated.value,
  });
  void definitionSnap;
  if (!saved.ok) return saved;

  return validationOk(saved.value, {
    summary: "Draft competition branding updated.",
    reasons: Object.freeze([
      `revision=${saved.value.revision}`,
      "definitionNotMutated",
      "configurationNotMutated",
      "notCompetitionVersion",
      "notPublished",
      "noUpload",
    ]),
  });
}

/**
 * Validate branding without persistence.
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   definition: object,
 *   expectedDefinitionRevision: number,
 *   branding: object,
 * }} command
 */
export function validateCompetitionBrandingCommand(command = {}) {
  const snap = snapshotInput(command);
  void snap;
  const cmd = command && typeof command === "object" ? command : {};

  /** @type {object[]} */
  const errors = [];
  if (!isNonEmptyString(cmd.tenantId)) {
    errors.push(
      createFieldError(
        "tenantId",
        COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT,
        "explicit tenantId is required",
        {}
      )
    );
  }
  if (!isNonEmptyString(cmd.competitionId)) {
    errors.push(
      createFieldError(
        "competitionId",
        COMPETITION_BRANDING_ERROR_CODE.MISSING_COMPETITION,
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

  const brandingInput =
    cmd.branding && typeof cmd.branding === "object"
      ? {
          ...cmd.branding,
          tenantId,
          competitionId,
        }
      : cmd.branding;

  return validateCompetitionBrandingInput(brandingInput, {
    enforceContrast: true,
  });
}

/**
 * @param {object} command
 */
export function compareCompetitionBrandingsCommand(command = {}) {
  return compareCompetitionBrandings(command);
}

/**
 * @param {object} command
 */
export function projectCompetitionBrandingSnapshotCommand(command = {}) {
  return projectCompetitionBrandingSnapshot(command);
}

/**
 * @param {object} command
 */
export function evaluateCompetitionBrandingReadinessCommand(command = {}) {
  return evaluateCompetitionBrandingReadiness(command);
}

/**
 * @param {{ tenantId: string, competitionId: string, repository: object }} command
 */
export function getCompetitionBranding(command = {}) {
  const cmd = command && typeof command === "object" ? command : {};
  const repoGate = requireRepository(cmd);
  if (!repoGate.ok) return repoGate.result;
  return repoGate.repository.findBranding({
    tenantId: cmd.tenantId,
    competitionId: cmd.competitionId,
  });
}

/**
 * @returns {object}
 */
export function createCapabilityLocalBrandingRepository() {
  return createInMemoryCompetitionBrandingRepository();
}

export { isCompetitionBranding };
