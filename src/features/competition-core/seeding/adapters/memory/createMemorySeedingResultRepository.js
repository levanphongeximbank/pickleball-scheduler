/**
 * Explicit MEMORY/TEST adapter for SeedingResultRepositoryPort (Phase 1F).
 * Per-instance storage only. Not a Production default.
 */

import { deepFreezeClone } from "../../domain/deepFreeze.js";
import { buildSeedingScopeKey } from "../../domain/normalizeSeedingScope.js";
import { FINALIZATION_STATE } from "../../domain/constants.js";
import {
  createSeedingDomainError,
} from "../../errors/SeedingDomainError.js";
import { SEEDING_ERROR_CODE } from "../../errors/seedingErrorCodes.js";
import { CORE07_RESULT_REPOSITORY_PORT_VERSION } from "../../ports/SeedingResultRepositoryPort.js";

/**
 * @returns {import('../../ports/SeedingResultRepositoryPort.js').SeedingResultRepositoryPort & {
 *   _debug: { byIdSize: () => number, authoritativeSize: () => number }
 * }}
 */
export function createMemorySeedingResultRepository() {
  /** @type {Map<string, object>} */
  const byId = new Map();
  /** @type {Map<string, string>} scopeKey -> resultId */
  const authoritativeByScope = new Map();

  function cloneOut(value) {
    if (value == null) return null;
    return deepFreezeClone(value);
  }

  function scopeKeyOf(scope) {
    return buildSeedingScopeKey(scope);
  }

  function assertResult(result, expectedState) {
    if (!result || typeof result !== "object") {
      throw createSeedingDomainError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "repository result is required"
      );
    }
    if (!result.resultId || result.scope == null) {
      throw createSeedingDomainError(
        SEEDING_ERROR_CODE.INVALID_REQUEST,
        "resultId and scope are required"
      );
    }
    if (
      expectedState &&
      String(result.finalizationState) !== String(expectedState)
    ) {
      throw createSeedingDomainError(
        SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION,
        `Expected ${expectedState} for repository save`,
        { finalizationState: result.finalizationState }
      );
    }
  }

  return {
    contractVersion: CORE07_RESULT_REPOSITORY_PORT_VERSION,
    findByResultId(resultId) {
      return cloneOut(byId.get(String(resultId)) || null);
    },
    findAuthoritativeByScope(scope) {
      if (!scope || typeof scope !== "object") {
        throw createSeedingDomainError(
          SEEDING_ERROR_CODE.INVALID_SCOPE,
          "scope is required for findAuthoritativeByScope"
        );
      }
      const key = scopeKeyOf(scope);
      const id = authoritativeByScope.get(key);
      if (!id) return null;
      return cloneOut(byId.get(id) || null);
    },
    saveDraft(result) {
      assertResult(result, FINALIZATION_STATE.DRAFT);
      const copy = deepFreezeClone(result);
      byId.set(String(copy.resultId), copy);
      return cloneOut(copy);
    },
    saveFinalized(result) {
      assertResult(result, FINALIZATION_STATE.FINALIZED);
      const copy = deepFreezeClone(result);
      const key = scopeKeyOf(copy.scope);
      const existingId = authoritativeByScope.get(key);
      byId.set(String(copy.resultId), copy);
      if (existingId && existingId !== String(copy.resultId)) {
        // Store as non-authoritative FINALIZED companion (pending supersede).
        // Does not create a second authoritative result for the scope.
        return cloneOut(copy);
      }
      authoritativeByScope.set(key, String(copy.resultId));
      return cloneOut(copy);
    },
    saveSuperseded(result) {
      assertResult(result, FINALIZATION_STATE.SUPERSEDED);
      const copy = deepFreezeClone(result);
      const key = scopeKeyOf(copy.scope);
      byId.set(String(copy.resultId), copy);
      const authId = authoritativeByScope.get(key);
      if (authId && authId === String(copy.resultId)) {
        authoritativeByScope.delete(key);
      }
      // Atomic supersede: if replacement is already saved FINALIZED, ensure it is authoritative.
      const replacementId = copy.supersededByResultId
        ? String(copy.supersededByResultId)
        : null;
      if (replacementId) {
        const replacement = byId.get(replacementId);
        if (
          replacement &&
          replacement.finalizationState === FINALIZATION_STATE.FINALIZED
        ) {
          const replKey = scopeKeyOf(replacement.scope);
          if (replKey !== key) {
            throw createSeedingDomainError(
              SEEDING_ERROR_CODE.SUPERSEDE_SCOPE_MISMATCH,
              "Replacement authoritative scope mismatch during supersede save"
            );
          }
          authoritativeByScope.set(key, replacementId);
        }
      }
      return cloneOut(copy);
    },
    saveCancelled(result) {
      assertResult(result, FINALIZATION_STATE.CANCELLED);
      const copy = deepFreezeClone(result);
      byId.set(String(copy.resultId), copy);
      return cloneOut(copy);
    },
    _debug: {
      byIdSize: () => byId.size,
      authoritativeSize: () => authoritativeByScope.size,
    },
  };
}
