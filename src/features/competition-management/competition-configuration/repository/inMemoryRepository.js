/**
 * Capability-local in-memory CompetitionConfiguration repository (CM-04).
 * Tests / dormant exercises only. Not production persistence.
 */

import { COMPETITION_CONFIGURATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
} from "../contracts/validation.js";
import {
  deepFreeze,
  clonePlain,
  isNonEmptyString,
} from "../contracts/shared.js";
import { isCompetitionConfiguration } from "../contracts/configuration.js";
import { configurationScopeKey } from "../contracts/identity.js";
import { COMPETITION_CONFIGURATION_REPOSITORY_PORT_METHODS } from "../ports/repositoryPort.js";

export { configurationScopeKey };

/**
 * @returns {object}
 */
export function createInMemoryCompetitionConfigurationRepository() {
  /** @type {Map<string, object>} scopeKey -> frozen clone */
  const byScope = new Map();

  /**
   * @param {object} configuration
   */
  function createConfiguration(configuration) {
    if (!isCompetitionConfiguration(configuration)) {
      return validationFail([
        createFieldError(
          "configuration",
          COMPETITION_CONFIGURATION_ERROR_CODE.MALFORMED_CONFIGURATION,
          "cannot create malformed CompetitionConfiguration",
          {}
        ),
      ]);
    }

    const stored = deepFreeze(clonePlain(configuration));
    const scope = configurationScopeKey(stored.tenantId, stored.competitionId);

    if (byScope.has(scope)) {
      return validationFail([
        createFieldError(
          "configurationId",
          COMPETITION_CONFIGURATION_ERROR_CODE.DUPLICATE_CONFIGURATION,
          "configuration already exists for tenant/competition scope",
          { configurationId: stored.configurationId }
        ),
      ]);
    }

    byScope.set(scope, stored);
    return validationOk(clonePlain(stored), {
      summary: "Competition configuration created in capability-local repository.",
      reasons: Object.freeze([
        `configurationId=${stored.configurationId}`,
        `revision=${stored.revision}`,
        "notProductionPersistence",
      ]),
    });
  }

  /**
   * @param {{ tenantId: string, competitionId: string }} query
   */
  function findConfiguration(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }

    const tenantId = String(query.tenantId).trim();
    const competitionId = String(query.competitionId).trim();
    const scope = configurationScopeKey(tenantId, competitionId);
    const found = byScope.get(scope);

    // Fail closed: do not leak cross-tenant existence.
    if (!found || found.tenantId !== tenantId || found.competitionId !== competitionId) {
      return validationFail([
        createFieldError(
          "configurationId",
          COMPETITION_CONFIGURATION_ERROR_CODE.CONFIGURATION_NOT_FOUND,
          "configuration not found for tenant/competition scope",
          { tenantId, competitionId }
        ),
      ]);
    }

    return validationOk(clonePlain(found), {
      summary: "Competition configuration found.",
      reasons: Object.freeze([`configurationId=${found.configurationId}`]),
    });
  }

  /**
   * Optimistic concurrency save.
   * @param {{
   *   tenantId: string,
   *   competitionId: string,
   *   expectedConfigurationRevision: number,
   *   configuration: object,
   * }} command
   */
  function saveConfigurationWithExpectedRevision(command = {}) {
    if (!isNonEmptyString(command.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(command.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }
    if (!Number.isInteger(command.expectedConfigurationRevision)) {
      return validationFail([
        createFieldError(
          "expectedConfigurationRevision",
          COMPETITION_CONFIGURATION_ERROR_CODE.STALE_CONFIGURATION_REVISION,
          "expectedConfigurationRevision must be an integer",
          {}
        ),
      ]);
    }
    if (!isCompetitionConfiguration(command.configuration)) {
      return validationFail([
        createFieldError(
          "configuration",
          COMPETITION_CONFIGURATION_ERROR_CODE.MALFORMED_CONFIGURATION,
          "cannot save malformed CompetitionConfiguration",
          {}
        ),
      ]);
    }

    const tenantId = String(command.tenantId).trim();
    const competitionId = String(command.competitionId).trim();
    const configuration = /** @type {any} */ (command.configuration);

    if (
      configuration.tenantId !== tenantId ||
      configuration.competitionId !== competitionId
    ) {
      return validationFail([
        createFieldError(
          "configuration",
          COMPETITION_CONFIGURATION_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE,
          "configuration tenant/competition must match save scope",
          {}
        ),
      ]);
    }

    const scope = configurationScopeKey(tenantId, competitionId);
    const existing = byScope.get(scope);

    if (!existing) {
      return validationFail([
        createFieldError(
          "configurationId",
          COMPETITION_CONFIGURATION_ERROR_CODE.CONFIGURATION_NOT_FOUND,
          "configuration not found for tenant/competition scope",
          { tenantId, competitionId }
        ),
      ]);
    }

    if (existing.revision !== command.expectedConfigurationRevision) {
      return validationFail([
        createFieldError(
          "expectedConfigurationRevision",
          COMPETITION_CONFIGURATION_ERROR_CODE.STALE_CONFIGURATION_REVISION,
          "expectedConfigurationRevision does not match stored revision",
          {
            expected: command.expectedConfigurationRevision,
            actual: existing.revision,
          }
        ),
      ]);
    }

    if (configuration.revision !== existing.revision + 1) {
      return validationFail([
        createFieldError(
          "revision",
          COMPETITION_CONFIGURATION_ERROR_CODE.REPOSITORY_CONFLICT,
          "saved configuration revision must be expected+1",
          {
            expected: existing.revision + 1,
            actual: configuration.revision,
          }
        ),
      ]);
    }

    const stored = deepFreeze(clonePlain(configuration));
    byScope.set(scope, stored);
    return validationOk(clonePlain(stored), {
      summary: "Competition configuration saved with optimistic concurrency.",
      reasons: Object.freeze([
        `configurationId=${stored.configurationId}`,
        `revision=${stored.revision}`,
        "notProductionPersistence",
      ]),
    });
  }

  return Object.freeze({
    __isCapabilityLocalInMemory: true,
    createConfiguration,
    findConfiguration,
    saveConfigurationWithExpectedRevision,
    clear() {
      byScope.clear();
    },
    size() {
      return byScope.size;
    },
    get portMethods() {
      return COMPETITION_CONFIGURATION_REPOSITORY_PORT_METHODS;
    },
  });
}
