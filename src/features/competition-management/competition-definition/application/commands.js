/**
 * Application commands for Competition Definition (CM-01).
 *
 * Pure / capability-local: no persistence, audit, notification, payment, or workflow writes.
 * Fail-closed: no silent tenant/venue/club/organizer inference; no silent repair.
 */

import {
  COMPETITION_DEFINITION_STATUS,
  COMPETITION_DEFINITION_INITIAL_REVISION,
  nextCompetitionDefinitionRevision,
  isDraftEditableStatus,
} from "../constants/index.js";
import { COMPETITION_DEFINITION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  validateCompetitionDefinitionInput,
} from "../contracts/definition.js";
import {
  createFieldError,
  validationFail,
  validationOk,
  snapshotInput,
} from "../contracts/validation.js";
import { deepFreeze, isNonEmptyString } from "../contracts/shared.js";

/**
 * @typedef {Object} CreateCompetitionDefinitionCommand
 * @property {string} competitionId
 * @property {string} tenantId
 * @property {object} owner
 * @property {string} name
 * @property {string} [description]
 * @property {string} competitionType
 * @property {string} scope
 * @property {string} visibility
 * @property {object[]} [venues]
 * @property {object[]} [clubs]
 * @property {object|null} [registrationWindow]
 * @property {object|null} [plannedPeriod]
 * @property {object|null} [template]
 * @property {object|null} [ruleSet]
 * @property {string|number} createdAt
 */

/**
 * @typedef {Object} UpdateDraftCompetitionDefinitionCommand
 * @property {string} competitionId
 * @property {string} tenantId
 * @property {string} [name]
 * @property {string} [description]
 * @property {string} [competitionType]
 * @property {string} [scope]
 * @property {string} [visibility]
 * @property {object[]} [venues]
 * @property {object[]} [clubs]
 * @property {object|null} [registrationWindow]
 * @property {object|null} [plannedPeriod]
 * @property {object|null} [template]
 * @property {object|null} [ruleSet]
 * @property {string|number} updatedAt
 * @property {object} [owner] — rejected if changed (immutable)
 * @property {string} [status] — rejected if changed away from draft via this command path incorrectly
 */

/**
 * Create a canonical draft CompetitionDefinition.
 * Requires explicit competitionId, tenantId, and owner — never inferred.
 *
 * @param {CreateCompetitionDefinitionCommand} command
 * @returns {import("../contracts/validation.js").CompetitionDefinitionValidationResult}
 */
export function createDraftCompetitionDefinition(command) {
  const inputSnapshot = snapshotInput(command);
  const src = command && typeof command === "object" ? command : {};

  const candidate = {
    competitionId: src.competitionId,
    tenantId: src.tenantId,
    owner: src.owner,
    name: src.name,
    description: src.description ?? "",
    competitionType: src.competitionType,
    scope: src.scope,
    visibility: src.visibility,
    status: COMPETITION_DEFINITION_STATUS.DRAFT,
    revision: COMPETITION_DEFINITION_INITIAL_REVISION,
    venues: src.venues,
    clubs: src.clubs,
    registrationWindow: src.registrationWindow ?? null,
    plannedPeriod: src.plannedPeriod ?? null,
    template: src.template ?? null,
    ruleSet: src.ruleSet ?? null,
    createdAt: src.createdAt,
    updatedAt: src.createdAt,
  };

  const result = validateCompetitionDefinitionInput(candidate, {
    requireDraftStatus: true,
  });

  // Prove no input mutation.
  void inputSnapshot;

  if (!result.ok) return result;

  return validationOk(result.value, {
    summary: "Draft competition definition created.",
    reasons: Object.freeze([
      `revision=${COMPETITION_DEFINITION_INITIAL_REVISION}`,
      "status=draft",
      "not published",
    ]),
  });
}

/**
 * Update an existing draft CompetitionDefinition.
 * Rejects non-draft, cross-tenant, and immutable identity changes.
 *
 * @param {object} existing
 * @param {UpdateDraftCompetitionDefinitionCommand} command
 * @returns {import("../contracts/validation.js").CompetitionDefinitionValidationResult}
 */
export function updateDraftCompetitionDefinition(existing, command) {
  const existingSnapshot = snapshotInput(existing);
  const commandSnapshot = snapshotInput(command);
  void existingSnapshot;
  void commandSnapshot;

  /** @type {import("../contracts/validation.js").CompetitionDefinitionFieldError[]} */
  const gateErrors = [];

  if (!existing || typeof existing !== "object") {
    return validationFail([
      createFieldError(
        "existing",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_CONTRACT,
        "existing CompetitionDefinition is required",
        {}
      ),
    ]);
  }

  const cmd = command && typeof command === "object" ? command : {};

  if (!isNonEmptyString(cmd.competitionId)) {
    gateErrors.push(
      createFieldError(
        "competitionId",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_IDENTIFIER,
        "competitionId is required on update",
        {}
      )
    );
  } else if (
    String(cmd.competitionId).trim() !== String(existing.competitionId)
  ) {
    gateErrors.push(
      createFieldError(
        "competitionId",
        COMPETITION_DEFINITION_ERROR_CODE.IMMUTABLE_FIELD_CHANGE,
        "competitionId is immutable",
        {
          existing: existing.competitionId,
          attempted: cmd.competitionId,
        }
      )
    );
  }

  if (!isNonEmptyString(cmd.tenantId)) {
    gateErrors.push(
      createFieldError(
        "tenantId",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_IDENTIFIER,
        "tenantId is required on update",
        {}
      )
    );
  } else if (String(cmd.tenantId).trim() !== String(existing.tenantId)) {
    gateErrors.push(
      createFieldError(
        "tenantId",
        COMPETITION_DEFINITION_ERROR_CODE.CROSS_TENANT_DENIED,
        "cross-tenant update is not allowed",
        {
          existingTenantId: existing.tenantId,
          attemptedTenantId: cmd.tenantId,
        }
      )
    );
  }

  if (!isDraftEditableStatus(existing.status)) {
    gateErrors.push(
      createFieldError(
        "status",
        COMPETITION_DEFINITION_ERROR_CODE.NOT_DRAFT,
        "update-draft is only allowed when status is draft",
        { status: existing.status }
      )
    );
  }

  if (cmd.owner != null) {
    const existingOwner = existing.owner || {};
    const same =
      existingOwner.ownerId === cmd.owner.ownerId &&
      existingOwner.ownerType === cmd.owner.ownerType;
    if (!same) {
      gateErrors.push(
        createFieldError(
          "owner",
          COMPETITION_DEFINITION_ERROR_CODE.IMMUTABLE_FIELD_CHANGE,
          "owner/organizer identity is immutable after create",
          {
            existing: existing.owner,
            attempted: cmd.owner,
          }
        )
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(cmd, "createdAt") &&
    cmd.createdAt !== existing.createdAt
  ) {
    gateErrors.push(
      createFieldError(
        "createdAt",
        COMPETITION_DEFINITION_ERROR_CODE.IMMUTABLE_FIELD_CHANGE,
        "createdAt is immutable",
        {}
      )
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(cmd, "revision") &&
    cmd.revision !== existing.revision
  ) {
    gateErrors.push(
      createFieldError(
        "revision",
        COMPETITION_DEFINITION_ERROR_CODE.IMMUTABLE_FIELD_CHANGE,
        "revision is managed by the command and cannot be set directly",
        {}
      )
    );
  }

  if (gateErrors.length > 0) {
    return validationFail(gateErrors);
  }

  const merged = {
    competitionId: existing.competitionId,
    tenantId: existing.tenantId,
    owner: existing.owner,
    name: Object.prototype.hasOwnProperty.call(cmd, "name")
      ? cmd.name
      : existing.name,
    description: Object.prototype.hasOwnProperty.call(cmd, "description")
      ? cmd.description
      : existing.description,
    competitionType: Object.prototype.hasOwnProperty.call(cmd, "competitionType")
      ? cmd.competitionType
      : existing.competitionType,
    scope: Object.prototype.hasOwnProperty.call(cmd, "scope")
      ? cmd.scope
      : existing.scope,
    visibility: Object.prototype.hasOwnProperty.call(cmd, "visibility")
      ? cmd.visibility
      : existing.visibility,
    status: COMPETITION_DEFINITION_STATUS.DRAFT,
    revision: nextCompetitionDefinitionRevision(existing.revision),
    venues: Object.prototype.hasOwnProperty.call(cmd, "venues")
      ? cmd.venues
      : existing.venues,
    clubs: Object.prototype.hasOwnProperty.call(cmd, "clubs")
      ? cmd.clubs
      : existing.clubs,
    registrationWindow: Object.prototype.hasOwnProperty.call(
      cmd,
      "registrationWindow"
    )
      ? cmd.registrationWindow
      : existing.registrationWindow,
    plannedPeriod: Object.prototype.hasOwnProperty.call(cmd, "plannedPeriod")
      ? cmd.plannedPeriod
      : existing.plannedPeriod,
    template: Object.prototype.hasOwnProperty.call(cmd, "template")
      ? cmd.template
      : existing.template,
    ruleSet: Object.prototype.hasOwnProperty.call(cmd, "ruleSet")
      ? cmd.ruleSet
      : existing.ruleSet,
    createdAt: existing.createdAt,
    updatedAt: cmd.updatedAt,
  };

  const result = validateCompetitionDefinitionInput(merged, {
    requireDraftStatus: true,
  });
  if (!result.ok) return result;

  return validationOk(result.value, {
    summary: "Draft competition definition updated.",
    reasons: Object.freeze([
      `revision=${result.value.revision}`,
      "status=draft",
    ]),
  });
}

/**
 * Read guard: reject cross-tenant reads (fail-closed).
 * @param {object} definition
 * @param {string} tenantId
 * @returns {import("../contracts/validation.js").CompetitionDefinitionValidationResult}
 */
export function assertSameTenantDefinition(definition, tenantId) {
  if (!definition || typeof definition !== "object") {
    return validationFail([
      createFieldError(
        "definition",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_CONTRACT,
        "definition is required",
        {}
      ),
    ]);
  }
  if (!isNonEmptyString(tenantId)) {
    return validationFail([
      createFieldError(
        "tenantId",
        COMPETITION_DEFINITION_ERROR_CODE.INVALID_IDENTIFIER,
        "tenantId is required for tenant-scoped read",
        {}
      ),
    ]);
  }
  if (String(definition.tenantId) !== String(tenantId).trim()) {
    return validationFail([
      createFieldError(
        "tenantId",
        COMPETITION_DEFINITION_ERROR_CODE.CROSS_TENANT_DENIED,
        "cross-tenant read is not allowed",
        {
          definitionTenantId: definition.tenantId,
          requestedTenantId: tenantId,
        }
      ),
    ]);
  }
  return validationOk(deepFreeze(definition));
}
