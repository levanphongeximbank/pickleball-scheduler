/**
 * Capability-local in-memory CompetitionBranding repository (CM-05).
 * Tests / dormant exercises only. Not production persistence.
 */

import { COMPETITION_BRANDING_ERROR_CODE } from "../errors/errorCodes.js";
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
import { isCompetitionBranding } from "../contracts/branding.js";
import { brandingScopeKey } from "../contracts/identity.js";
import { COMPETITION_BRANDING_REPOSITORY_PORT_METHODS } from "../ports/repositoryPort.js";

export { brandingScopeKey };

/**
 * @returns {object}
 */
export function createInMemoryCompetitionBrandingRepository() {
  /** @type {Map<string, object>} scopeKey -> frozen clone */
  const byScope = new Map();

  /**
   * @param {object} branding
   */
  function createBranding(branding) {
    if (!isCompetitionBranding(branding)) {
      return validationFail([
        createFieldError(
          "branding",
          COMPETITION_BRANDING_ERROR_CODE.MALFORMED_BRANDING,
          "cannot create malformed CompetitionBranding",
          {}
        ),
      ]);
    }

    const stored = deepFreeze(clonePlain(branding));
    const scope = brandingScopeKey(stored.tenantId, stored.competitionId);

    if (byScope.has(scope)) {
      return validationFail([
        createFieldError(
          "brandingId",
          COMPETITION_BRANDING_ERROR_CODE.DUPLICATE_BRANDING,
          "branding already exists for tenant/competition scope",
          { brandingId: stored.brandingId }
        ),
      ]);
    }

    byScope.set(scope, stored);
    return validationOk(clonePlain(stored), {
      summary: "Competition branding created in capability-local repository.",
      reasons: Object.freeze([
        `brandingId=${stored.brandingId}`,
        `revision=${stored.revision}`,
        "notProductionPersistence",
      ]),
    });
  }

  /**
   * @param {{ tenantId: string, competitionId: string }} query
   */
  function findBranding(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_BRANDING_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }

    const tenantId = String(query.tenantId).trim();
    const competitionId = String(query.competitionId).trim();
    const scope = brandingScopeKey(tenantId, competitionId);
    const found = byScope.get(scope);

    // Fail closed: do not leak cross-tenant existence.
    if (!found || found.tenantId !== tenantId || found.competitionId !== competitionId) {
      return validationFail([
        createFieldError(
          "brandingId",
          COMPETITION_BRANDING_ERROR_CODE.BRANDING_NOT_FOUND,
          "branding not found for tenant/competition scope",
          { tenantId, competitionId }
        ),
      ]);
    }

    return validationOk(clonePlain(found), {
      summary: "Competition branding found.",
      reasons: Object.freeze([`brandingId=${found.brandingId}`]),
    });
  }

  /**
   * Optimistic concurrency save.
   * @param {{
   *   tenantId: string,
   *   competitionId: string,
   *   expectedBrandingRevision: number,
   *   branding: object,
   * }} command
   */
  function saveBrandingWithExpectedRevision(command = {}) {
    if (!isNonEmptyString(command.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(command.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_BRANDING_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }
    if (!Number.isInteger(command.expectedBrandingRevision)) {
      return validationFail([
        createFieldError(
          "expectedBrandingRevision",
          COMPETITION_BRANDING_ERROR_CODE.STALE_BRANDING_REVISION,
          "expectedBrandingRevision must be an integer",
          {}
        ),
      ]);
    }
    if (!isCompetitionBranding(command.branding)) {
      return validationFail([
        createFieldError(
          "branding",
          COMPETITION_BRANDING_ERROR_CODE.MALFORMED_BRANDING,
          "cannot save malformed CompetitionBranding",
          {}
        ),
      ]);
    }

    const tenantId = String(command.tenantId).trim();
    const competitionId = String(command.competitionId).trim();
    const branding = /** @type {any} */ (command.branding);

    if (
      branding.tenantId !== tenantId ||
      branding.competitionId !== competitionId
    ) {
      return validationFail([
        createFieldError(
          "branding",
          COMPETITION_BRANDING_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE,
          "branding tenant/competition must match save scope",
          {}
        ),
      ]);
    }

    const scope = brandingScopeKey(tenantId, competitionId);
    const existing = byScope.get(scope);

    if (!existing) {
      return validationFail([
        createFieldError(
          "brandingId",
          COMPETITION_BRANDING_ERROR_CODE.BRANDING_NOT_FOUND,
          "branding not found for tenant/competition scope",
          { tenantId, competitionId }
        ),
      ]);
    }

    if (existing.revision !== command.expectedBrandingRevision) {
      return validationFail([
        createFieldError(
          "expectedBrandingRevision",
          COMPETITION_BRANDING_ERROR_CODE.STALE_BRANDING_REVISION,
          "expectedBrandingRevision does not match stored revision",
          {
            expected: command.expectedBrandingRevision,
            actual: existing.revision,
          }
        ),
      ]);
    }

    if (branding.revision !== existing.revision + 1) {
      return validationFail([
        createFieldError(
          "revision",
          COMPETITION_BRANDING_ERROR_CODE.REPOSITORY_CONFLICT,
          "saved branding revision must be expected+1",
          {
            expected: existing.revision + 1,
            actual: branding.revision,
          }
        ),
      ]);
    }

    const stored = deepFreeze(clonePlain(branding));
    byScope.set(scope, stored);
    return validationOk(clonePlain(stored), {
      summary: "Competition branding saved with optimistic concurrency.",
      reasons: Object.freeze([
        `brandingId=${stored.brandingId}`,
        `revision=${stored.revision}`,
        "notProductionPersistence",
      ]),
    });
  }

  return Object.freeze({
    __isCapabilityLocalInMemory: true,
    createBranding,
    findBranding,
    saveBrandingWithExpectedRevision,
    clear() {
      byScope.clear();
    },
    size() {
      return byScope.size;
    },
    get portMethods() {
      return COMPETITION_BRANDING_REPOSITORY_PORT_METHODS;
    },
  });
}
