/**
 * Capability-local in-memory CompetitionLifecycle repository (CM-07).
 *
 * Serves tests and dormant capability exercises only. Not production
 * persistence. Clones on write/read. Fail-closed concurrency + idempotency.
 */

import { COMPETITION_LIFECYCLE_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
} from "../contracts/validation.js";
import { deepFreeze, clonePlain, isNonEmptyString } from "../contracts/shared.js";
import { isCompetitionLifecycleRecord } from "../contracts/lifecycle.js";
import {
  lifecycleScopeKey,
  createLifecycleIdempotencyStorageKey,
} from "../contracts/identity.js";
import { COMPETITION_LIFECYCLE_INITIAL_REVISION } from "../constants/revision.js";
import { COMPETITION_LIFECYCLE_REPOSITORY_PORT_METHODS } from "../ports/repositoryPort.js";

export { lifecycleScopeKey };

/**
 * @returns {object}
 */
export function createInMemoryCompetitionLifecycleRepository() {
  /** @type {Map<string, object>} recordId -> frozen clone */
  const byId = new Map();
  /** @type {Map<string, string>} scopeKey -> current recordId */
  const byScopeCurrent = new Map();
  /** @type {Map<string, string[]>} scopeKey -> ordered recordIds (linear history) */
  const byScopeHistory = new Map();
  /** @type {Map<string, string>} idempotency storage key -> recordId */
  const byIdempotency = new Map();

  /**
   * @param {{ record: object }} params
   */
  function appendLifecycleTransitionAtomically(params = {}) {
    const record = params && typeof params === "object" ? params.record : null;

    if (!isCompetitionLifecycleRecord(record)) {
      return validationFail([
        createFieldError(
          "record",
          COMPETITION_LIFECYCLE_ERROR_CODE.MALFORMED_LIFECYCLE_RECORD,
          "cannot append malformed CompetitionLifecycleRecord",
          {}
        ),
      ]);
    }

    const stored = deepFreeze(clonePlain(record));
    const scope = lifecycleScopeKey(stored.tenantId, stored.competitionId);

    if (byId.has(stored.recordId)) {
      return validationFail([
        createFieldError(
          "recordId",
          COMPETITION_LIFECYCLE_ERROR_CODE.DUPLICATE_LIFECYCLE_RECORD,
          "duplicate lifecycle record identity in repository",
          { recordId: stored.recordId }
        ),
      ]);
    }

    const currentId = byScopeCurrent.get(scope) ?? null;
    const history = byScopeHistory.get(scope) ?? [];

    if (currentId == null) {
      if (stored.revision !== COMPETITION_LIFECYCLE_INITIAL_REVISION) {
        return validationFail([
          createFieldError(
            "revision",
            COMPETITION_LIFECYCLE_ERROR_CODE.REPOSITORY_CONFLICT,
            `first lifecycle record requires revision=${COMPETITION_LIFECYCLE_INITIAL_REVISION}`,
            { actual: stored.revision }
          ),
        ]);
      }
      if (stored.previousRecordId !== null) {
        return validationFail([
          createFieldError(
            "previousRecordId",
            COMPETITION_LIFECYCLE_ERROR_CODE.REPOSITORY_CONFLICT,
            "first lifecycle record requires previousRecordId=null",
            {}
          ),
        ]);
      }
    } else {
      const prior = byId.get(currentId);
      if (!prior) {
        return validationFail([
          createFieldError(
            "previousRecordId",
            COMPETITION_LIFECYCLE_ERROR_CODE.REPOSITORY_CONFLICT,
            "current lifecycle pointer is broken",
            { currentId }
          ),
        ]);
      }
      if (stored.previousRecordId !== prior.recordId) {
        return validationFail([
          createFieldError(
            "previousRecordId",
            COMPETITION_LIFECYCLE_ERROR_CODE.REPOSITORY_CONFLICT,
            "new record.previousRecordId must equal current recordId",
            { expected: prior.recordId, actual: stored.previousRecordId }
          ),
        ]);
      }
      if (stored.revision !== prior.revision + 1) {
        return validationFail([
          createFieldError(
            "revision",
            COMPETITION_LIFECYCLE_ERROR_CODE.REPOSITORY_CONFLICT,
            "new record revision must equal prior revision + 1",
            { expected: prior.revision + 1, actual: stored.revision }
          ),
        ]);
      }
      if (
        prior.tenantId !== stored.tenantId ||
        prior.competitionId !== stored.competitionId
      ) {
        return validationFail([
          createFieldError(
            "tenantId",
            COMPETITION_LIFECYCLE_ERROR_CODE.CROSS_TENANT_ACCESS,
            "lifecycle lineage tenant/competition mismatch",
            {}
          ),
        ]);
      }
    }

    if (stored.idempotencyKey) {
      const idemKey = createLifecycleIdempotencyStorageKey(
        stored.tenantId,
        stored.competitionId,
        stored.idempotencyKey
      );
      const owner = byIdempotency.get(idemKey);
      if (owner && owner !== stored.recordId) {
        return validationFail([
          createFieldError(
            "idempotencyKey",
            COMPETITION_LIFECYCLE_ERROR_CODE.IDEMPOTENCY_CONFLICT,
            "idempotency key already bound to another lifecycle record",
            { idempotencyKey: stored.idempotencyKey }
          ),
        ]);
      }
    }

    byId.set(stored.recordId, stored);
    byScopeCurrent.set(scope, stored.recordId);
    byScopeHistory.set(scope, [...history, stored.recordId]);
    if (stored.idempotencyKey) {
      byIdempotency.set(
        createLifecycleIdempotencyStorageKey(
          stored.tenantId,
          stored.competitionId,
          stored.idempotencyKey
        ),
        stored.recordId
      );
    }

    return validationOk(deepFreeze(clonePlain(stored)));
  }

  /**
   * @param {{ tenantId: string, competitionId: string, recordId: string }} params
   */
  function findLifecycleRecord(params = {}) {
    if (!isNonEmptyString(params.tenantId) || !isNonEmptyString(params.competitionId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_TENANT,
          "tenantId and competitionId are required",
          {}
        ),
      ]);
    }
    if (!isNonEmptyString(params.recordId)) {
      return validationFail([
        createFieldError(
          "recordId",
          COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CONTRACT,
          "recordId is required",
          {}
        ),
      ]);
    }
    const stored = byId.get(String(params.recordId).trim());
    if (!stored) {
      return validationOk(null);
    }
    if (
      stored.tenantId !== String(params.tenantId).trim() ||
      stored.competitionId !== String(params.competitionId).trim()
    ) {
      return validationFail([
        createFieldError(
          "recordId",
          COMPETITION_LIFECYCLE_ERROR_CODE.CROSS_TENANT_ACCESS,
          "lifecycle record not accessible for this tenant/competition",
          {}
        ),
      ]);
    }
    return validationOk(deepFreeze(clonePlain(stored)));
  }

  /**
   * @param {{ tenantId: string, competitionId: string }} params
   */
  function findCurrentLifecycle(params = {}) {
    if (!isNonEmptyString(params.tenantId) || !isNonEmptyString(params.competitionId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_TENANT,
          "tenantId and competitionId are required",
          {}
        ),
      ]);
    }
    const scope = lifecycleScopeKey(params.tenantId, params.competitionId);
    const currentId = byScopeCurrent.get(scope);
    if (!currentId) return validationOk(null);
    const stored = byId.get(currentId);
    if (!stored) return validationOk(null);
    return validationOk(deepFreeze(clonePlain(stored)));
  }

  /**
   * @param {{ tenantId: string, competitionId: string }} params
   */
  function listLifecycleHistory(params = {}) {
    if (!isNonEmptyString(params.tenantId) || !isNonEmptyString(params.competitionId)) {
      return validationFail([
        createFieldError(
          "tenantId",
          COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_TENANT,
          "tenantId and competitionId are required",
          {}
        ),
      ]);
    }
    const scope = lifecycleScopeKey(params.tenantId, params.competitionId);
    const ids = byScopeHistory.get(scope) ?? [];
    const records = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((r) => deepFreeze(clonePlain(r)));
    return validationOk(Object.freeze(records));
  }

  /**
   * @param {{ tenantId: string, competitionId: string, idempotencyKey: string }} params
   */
  function findByIdempotencyKey(params = {}) {
    if (
      !isNonEmptyString(params.tenantId) ||
      !isNonEmptyString(params.competitionId) ||
      !isNonEmptyString(params.idempotencyKey)
    ) {
      return validationFail([
        createFieldError(
          "idempotencyKey",
          COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_IDEMPOTENCY_KEY,
          "tenantId, competitionId, and idempotencyKey are required",
          {}
        ),
      ]);
    }
    const key = createLifecycleIdempotencyStorageKey(
      params.tenantId,
      params.competitionId,
      params.idempotencyKey
    );
    const recordId = byIdempotency.get(key);
    if (!recordId) return validationOk(null);
    const stored = byId.get(recordId);
    if (!stored) return validationOk(null);
    if (
      stored.tenantId !== String(params.tenantId).trim() ||
      stored.competitionId !== String(params.competitionId).trim()
    ) {
      return validationFail([
        createFieldError(
          "idempotencyKey",
          COMPETITION_LIFECYCLE_ERROR_CODE.CROSS_TENANT_ACCESS,
          "idempotency key not accessible for this tenant/competition",
          {}
        ),
      ]);
    }
    return validationOk(deepFreeze(clonePlain(stored)));
  }

  return Object.freeze({
    appendLifecycleTransitionAtomically,
    findLifecycleRecord,
    findCurrentLifecycle,
    listLifecycleHistory,
    findByIdempotencyKey,
    // introspection for tests only
    __isCapabilityLocalInMemory: true,
    __portMethods: COMPETITION_LIFECYCLE_REPOSITORY_PORT_METHODS,
  });
}
