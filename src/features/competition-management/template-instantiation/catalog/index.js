/**
 * In-memory capability-local template catalog registry (CM-02).
 * Fail-closed on duplicates. Deterministic list ordering. Not production DB.
 */

import { COMPETITION_TEMPLATE_SCOPE } from "../constants/index.js";
import { COMPETITION_TEMPLATE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  validateCompetitionTemplateDefinition,
  createFieldError,
  validationOk,
  validationFail,
  isNonEmptyString,
  clonePlain,
} from "../contracts/index.js";
import { createStaticCatalogSeeds } from "./staticCatalog.js";

/**
 * @typedef {Object} CompetitionTemplateCatalog
 * @property {() => readonly object[]} listAll
 * @property {(tenantId: string) => import("../contracts/validation.js").CompetitionTemplateValidationResult} listAvailableForTenant
 * @property {(templateId: string, templateVersion: number, tenantId: string) => import("../contracts/validation.js").CompetitionTemplateValidationResult} getByIdentity
 * @property {(input: object) => import("../contracts/validation.js").CompetitionTemplateValidationResult} register
 * @property {() => void} clear
 * @property {() => number} size
 */

/**
 * Identity key for templateId@version.
 * @param {string} templateId
 * @param {number} templateVersion
 * @returns {string}
 */
export function templateIdentityKey(templateId, templateVersion) {
  return `${String(templateId).trim()}@${templateVersion}`;
}

/**
 * Create an empty in-memory catalog.
 * @returns {CompetitionTemplateCatalog}
 */
export function createInMemoryTemplateCatalog() {
  /** @type {Map<string, object>} */
  const store = new Map();

  /**
   * @param {object} input
   * @returns {import("../contracts/validation.js").CompetitionTemplateValidationResult}
   */
  function register(input) {
    const validated = validateCompetitionTemplateDefinition(input);
    if (!validated.ok) return validated;
    const key = templateIdentityKey(
      validated.value.templateId,
      validated.value.templateVersion
    );
    if (store.has(key)) {
      return validationFail([
        createFieldError(
          "templateId",
          COMPETITION_TEMPLATE_ERROR_CODE.DUPLICATE_TEMPLATE_IDENTITY,
          "duplicate templateId/templateVersion in catalog",
          {
            templateId: validated.value.templateId,
            templateVersion: validated.value.templateVersion,
          }
        ),
      ]);
    }
    store.set(key, validated.value);
    return validationOk(validated.value, {
      summary: "Template registered in capability-local catalog.",
      reasons: Object.freeze([`identity=${key}`]),
    });
  }

  /**
   * @returns {readonly object[]}
   */
  function listAll() {
    return Object.freeze(
      [...store.values()].sort((a, b) => {
        const byId = String(a.templateId).localeCompare(String(b.templateId), "en");
        if (byId !== 0) return byId;
        return a.templateVersion - b.templateVersion;
      })
    );
  }

  /**
   * @param {string} tenantId
   * @returns {import("../contracts/validation.js").CompetitionTemplateValidationResult}
   */
  function listAvailableForTenant(tenantId) {
    if (!isNonEmptyString(tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
          "explicit tenantId is required to list templates",
          {}
        ),
      ]);
    }
    const tid = String(tenantId).trim();
    const items = listAll().filter((t) => {
      if (t.templateScope === COMPETITION_TEMPLATE_SCOPE.GLOBAL) return true;
      if (t.templateScope === COMPETITION_TEMPLATE_SCOPE.TENANT) {
        return String(t.tenantId) === tid;
      }
      return false;
    });
    return validationOk(Object.freeze(items), {
      summary: "Available templates listed for tenant.",
      reasons: Object.freeze([
        `tenantId=${tid}`,
        `count=${items.length}`,
        "no first-template fallback",
      ]),
    });
  }

  /**
   * @param {string} templateId
   * @param {number} templateVersion
   * @param {string} tenantId
   * @returns {import("../contracts/validation.js").CompetitionTemplateValidationResult}
   */
  function getByIdentity(templateId, templateVersion, tenantId) {
    if (!isNonEmptyString(tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER,
          "explicit tenantId is required for template lookup",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(templateId)) {
      return validationFail([
        createFieldError(
          "templateId",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_ID,
          "templateId is required",
          {}
        ),
      ]);
    }
    if (!Number.isInteger(templateVersion) || templateVersion < 1) {
      return validationFail([
        createFieldError(
          "templateVersion",
          COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_VERSION,
          "templateVersion must be an integer >= 1",
          { value: templateVersion }
        ),
      ]);
    }

    const key = templateIdentityKey(String(templateId).trim(), templateVersion);
    const found = store.get(key);
    if (!found) {
      return validationFail([
        createFieldError(
          "templateId",
          COMPETITION_TEMPLATE_ERROR_CODE.TEMPLATE_NOT_FOUND,
          "template identity/version not found in catalog",
          { templateId, templateVersion }
        ),
      ]);
    }

    const tid = String(tenantId).trim();
    if (found.templateScope === COMPETITION_TEMPLATE_SCOPE.TENANT) {
      if (String(found.tenantId) !== tid) {
        return validationFail([
          createFieldError(
            "tenantId",
            COMPETITION_TEMPLATE_ERROR_CODE.TENANT_TEMPLATE_DENIED,
            "tenant template is not available for this tenant",
            { templateTenantId: found.tenantId, requestedTenantId: tid }
          ),
        ]);
      }
    }

    return validationOk(found, {
      summary: "Template found.",
      reasons: Object.freeze([`identity=${key}`, `tenantId=${tid}`]),
    });
  }

  return Object.freeze({
    listAll,
    listAvailableForTenant,
    getByIdentity,
    register,
    clear() {
      store.clear();
    },
    size() {
      return store.size;
    },
    /** @internal test helper — returns clone of store keys */
    _keys() {
      return [...store.keys()].sort((a, b) => a.localeCompare(b, "en"));
    },
  });
}

/**
 * Create catalog preloaded with static capability-local seeds.
 * Rejects if any seed fails validation or duplicates.
 * @returns {CompetitionTemplateCatalog}
 */
export function createStaticCapabilityLocalCatalog() {
  const catalog = createInMemoryTemplateCatalog();
  for (const seed of createStaticCatalogSeeds()) {
    const result = catalog.register(clonePlain(seed));
    if (!result.ok) {
      throw new Error(
        `CM-02 static catalog seed failed: ${result.explanation.summary}`
      );
    }
  }
  return catalog;
}

/** Shared dormant default catalog instance (capability-local). */
let defaultCatalog = null;

/**
 * @returns {CompetitionTemplateCatalog}
 */
export function getDefaultCapabilityLocalCatalog() {
  if (!defaultCatalog) {
    defaultCatalog = createStaticCapabilityLocalCatalog();
  }
  return defaultCatalog;
}

/**
 * Reset default catalog (tests only).
 */
export function resetDefaultCapabilityLocalCatalog() {
  defaultCatalog = createStaticCapabilityLocalCatalog();
}
