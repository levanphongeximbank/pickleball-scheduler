/**
 * Capability-local in-memory CompetitionVersion repository (CM-03).
 *
 * Serves tests and dormant capability exercises only.
 * Not production persistence. Clones on write/read. Fail-closed concurrency.
 */

import { COMPETITION_VERSION_ERROR_CODE } from "../errors/errorCodes.js";
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
import {
  isCompetitionVersion,
} from "../contracts/snapshot.js";
import {
  createIdempotencyStorageKey,
} from "../contracts/identity.js";
import { COMPETITION_VERSION_REPOSITORY_PORT_METHODS } from "../ports/repositoryPort.js";

/**
 * Scope key for tenant + competition.
 * @param {string} tenantId
 * @param {string} competitionId
 * @returns {string}
 */
export function competitionScopeKey(tenantId, competitionId) {
  return `${String(tenantId).trim()}::${String(competitionId).trim()}`;
}

/**
 * @typedef {Object} CompetitionVersionRepository
 * @property {(version: object) => import("../contracts/validation.js").CompetitionVersionValidationResult} saveVersion
 * @property {(query: { tenantId: string, competitionId: string, versionId: string }) => import("../contracts/validation.js").CompetitionVersionValidationResult} findVersionById
 * @property {(query: { tenantId: string, competitionId: string }) => import("../contracts/validation.js").CompetitionVersionValidationResult} listVersions
 * @property {(query: { tenantId: string, competitionId: string }) => import("../contracts/validation.js").CompetitionVersionValidationResult} findLatestVersion
 * @property {(query: { tenantId: string, competitionId: string, idempotencyKey: string }) => import("../contracts/validation.js").CompetitionVersionValidationResult} findByIdempotencyKey
 * @property {() => void} clear
 * @property {() => number} size
 */

/**
 * Create an empty in-memory version repository.
 * @returns {CompetitionVersionRepository & { __isCapabilityLocalInMemory: true }}
 */
export function createInMemoryCompetitionVersionRepository() {
  /** @type {Map<string, object>} versionId -> frozen clone */
  const byId = new Map();
  /** @type {Map<string, string[]>} scopeKey -> versionIds sorted by number */
  const byScope = new Map();
  /** @type {Map<string, string>} idempotency storage key -> versionId */
  const byIdempotency = new Map();

  /**
   * @param {object} version
   */
  function saveVersion(version) {
    if (!isCompetitionVersion(version)) {
      return validationFail([
        createFieldError(
          "version",
          COMPETITION_VERSION_ERROR_CODE.MALFORMED_SNAPSHOT,
          "cannot save malformed CompetitionVersion",
          {}
        ),
      ]);
    }

    const stored = deepFreeze(clonePlain(version));
    const scope = competitionScopeKey(stored.tenantId, stored.competitionId);

    if (byId.has(stored.versionId)) {
      return validationFail([
        createFieldError(
          "versionId",
          COMPETITION_VERSION_ERROR_CODE.DUPLICATE_VERSION,
          "duplicate version identity in repository",
          { versionId: stored.versionId }
        ),
      ]);
    }

    const existingIds = byScope.get(scope) || [];
    const existingVersions = existingIds
      .map((id) => byId.get(id))
      .filter(Boolean);
    const latest = existingVersions.reduce(
      (acc, v) =>
        !acc || /** @type {any} */ (v).versionNumber > acc.versionNumber
          ? /** @type {any} */ (v)
          : acc,
      null
    );

    if (stored.versionNumber === 1) {
      if (latest) {
        return validationFail([
          createFieldError(
            "versionNumber",
            COMPETITION_VERSION_ERROR_CODE.REPOSITORY_CONFLICT,
            "root version rejected because versions already exist for competition",
            { latestVersionId: latest.versionId }
          ),
        ]);
      }
      if (stored.parentVersionId != null) {
        return validationFail([
          createFieldError(
            "parentVersionId",
            COMPETITION_VERSION_ERROR_CODE.INVALID_LINEAGE,
            "root version must have parentVersionId=null",
            {}
          ),
        ]);
      }
    } else {
      if (!latest) {
        return validationFail([
          createFieldError(
            "parentVersionId",
            COMPETITION_VERSION_ERROR_CODE.INVALID_LINEAGE,
            "non-root version requires an existing lineage",
            {}
          ),
        ]);
      }
      if (stored.parentVersionId !== latest.versionId) {
        return validationFail([
          createFieldError(
            "parentVersionId",
            COMPETITION_VERSION_ERROR_CODE.STALE_PARENT_VERSION,
            "parentVersionId must equal current latest version (linear lineage only)",
            {
              expected: latest.versionId,
              actual: stored.parentVersionId,
            }
          ),
        ]);
      }
      if (stored.versionNumber !== latest.versionNumber + 1) {
        return validationFail([
          createFieldError(
            "versionNumber",
            COMPETITION_VERSION_ERROR_CODE.REPOSITORY_CONFLICT,
            "versionNumber must be latest+1 (monotonic)",
            {
              expected: latest.versionNumber + 1,
              actual: stored.versionNumber,
            }
          ),
        ]);
      }
    }

    if (stored.metadata?.idempotencyKey) {
      const idemKey = createIdempotencyStorageKey(
        stored.tenantId,
        stored.competitionId,
        stored.metadata.idempotencyKey
      );
      if (byIdempotency.has(idemKey)) {
        return validationFail([
          createFieldError(
            "idempotencyKey",
            COMPETITION_VERSION_ERROR_CODE.IDEMPOTENCY_CONFLICT,
            "idempotency key already bound to another version",
            { idempotencyKey: stored.metadata.idempotencyKey }
          ),
        ]);
      }
      byIdempotency.set(idemKey, stored.versionId);
    }

    byId.set(stored.versionId, stored);
    const nextIds = [...existingIds, stored.versionId].sort((a, b) => {
      const va = /** @type {any} */ (byId.get(a));
      const vb = /** @type {any} */ (byId.get(b));
      return va.versionNumber - vb.versionNumber;
    });
    byScope.set(scope, nextIds);

    return validationOk(clonePlain(stored), {
      summary: "Competition version saved in capability-local repository.",
      reasons: Object.freeze([
        `versionId=${stored.versionId}`,
        `versionNumber=${stored.versionNumber}`,
        "notProductionPersistence",
      ]),
    });
  }

  /**
   * @param {{ tenantId: string, competitionId: string, versionId: string }} query
   */
  function findVersionById(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_VERSION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_VERSION_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.versionId)) {
      return validationFail([
        createFieldError(
          "versionId",
          COMPETITION_VERSION_ERROR_CODE.INVALID_IDENTIFIER,
          "explicit versionId is required",
          {}
        ),
      ]);
    }

    const tenantId = String(query.tenantId).trim();
    const competitionId = String(query.competitionId).trim();
    const versionId = String(query.versionId).trim();
    const found = byId.get(versionId);

    // Fail closed: do not leak cross-tenant existence.
    if (
      !found ||
      found.tenantId !== tenantId ||
      found.competitionId !== competitionId
    ) {
      return validationFail([
        createFieldError(
          "versionId",
          COMPETITION_VERSION_ERROR_CODE.VERSION_NOT_FOUND,
          "version not found for tenant/competition scope",
          { versionId }
        ),
      ]);
    }

    return validationOk(clonePlain(found), {
      summary: "Competition version found.",
      reasons: Object.freeze([`versionId=${versionId}`]),
    });
  }

  /**
   * @param {{ tenantId: string, competitionId: string }} query
   */
  function listVersions(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_VERSION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_VERSION_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }

    const tenantId = String(query.tenantId).trim();
    const competitionId = String(query.competitionId).trim();
    const scope = competitionScopeKey(tenantId, competitionId);
    const ids = byScope.get(scope) || [];
    const items = ids
      .map((id) => byId.get(id))
      .filter(
        (v) =>
          v && v.tenantId === tenantId && v.competitionId === competitionId
      )
      .map((v) => clonePlain(v))
      .sort((a, b) => a.versionNumber - b.versionNumber);

    return validationOk(Object.freeze(items), {
      summary: "Competition versions listed.",
      reasons: Object.freeze([
        `tenantId=${tenantId}`,
        `competitionId=${competitionId}`,
        `count=${items.length}`,
        "sortedByVersionNumber",
      ]),
    });
  }

  /**
   * @param {{ tenantId: string, competitionId: string }} query
   */
  function findLatestVersion(query = {}) {
    const listed = listVersions(query);
    if (!listed.ok) return listed;
    const items = /** @type {object[]} */ (listed.value);
    if (items.length === 0) {
      return validationOk(null, {
        summary: "No competition versions exist for scope.",
        reasons: Object.freeze(["latest=null"]),
      });
    }
    const latest = items[items.length - 1];
    return validationOk(clonePlain(latest), {
      summary: "Latest competition version found.",
      reasons: Object.freeze([
        `versionId=${latest.versionId}`,
        `versionNumber=${latest.versionNumber}`,
      ]),
    });
  }

  /**
   * @param {{ tenantId: string, competitionId: string, idempotencyKey: string }} query
   */
  function findByIdempotencyKey(query = {}) {
    if (!isNonEmptyString(query.tenantId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_VERSION_ERROR_CODE.MISSING_TENANT,
          "explicit tenantId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.competitionId)) {
      return validationFail([
        createFieldError(
          "competitionId",
          COMPETITION_VERSION_ERROR_CODE.MISSING_COMPETITION,
          "explicit competitionId is required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(query.idempotencyKey)) {
      return validationFail([
        createFieldError(
          "idempotencyKey",
          COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
          "explicit idempotencyKey is required",
          {}
        ),
      ]);
    }

    const key = createIdempotencyStorageKey(
      query.tenantId,
      query.competitionId,
      query.idempotencyKey
    );
    const versionId = byIdempotency.get(key);
    if (!versionId) {
      return validationOk(null, {
        summary: "No version bound to idempotency key.",
        reasons: Object.freeze(["found=null"]),
      });
    }
    return findVersionById({
      tenantId: query.tenantId,
      competitionId: query.competitionId,
      versionId,
    });
  }

  return Object.freeze({
    __isCapabilityLocalInMemory: true,
    saveVersion,
    findVersionById,
    listVersions,
    findLatestVersion,
    findByIdempotencyKey,
    clear() {
      byId.clear();
      byScope.clear();
      byIdempotency.clear();
    },
    size() {
      return byId.size;
    },
    // Prove port shape compatibility without claiming production readiness.
    get portMethods() {
      return COMPETITION_VERSION_REPOSITORY_PORT_METHODS;
    },
  });
}
