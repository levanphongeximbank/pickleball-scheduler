/**
 * In-memory RatingCurrentStatePort adapter (foundation/test only).
 * Isolated per instance. No browser storage / filesystem / Supabase client.
 * Caller-supplied IDs and timestamps only.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { requireSupportedRatingMode } from "../contracts/ratingModes.js";
import { requireExplicitPlayerRatingScope } from "../contracts/scopeContract.js";
import {
  clonePlain,
  deepFreeze,
  failContract,
  requireNonEmptyString,
} from "../contracts/shared.js";
import { matchesRatingCurrentStatePort } from "../ports/ratingCurrentStatePort.js";
import {
  buildCurrentStateKey,
  fingerprintPayload,
  normalizeStoredCurrentState,
} from "./stateHelpers.js";
import {
  buildRatingOperationIdentityKey,
  createRatingOperationIdentity,
} from "./createRatingOperationIdentity.js";

/**
 * @returns {import('../ports/ratingCurrentStatePort.js').RatingCurrentStatePort & {
 *   seedCurrentState: (state: unknown) => Promise<Readonly<Record<string, unknown>>>,
 *   hasOperation: (identity: unknown) => boolean,
 *   getOperationRecord: (identity: unknown) => Readonly<Record<string, unknown>>|null,
 *   preflightOperation: (identity: unknown, payloadFingerprint: string) => 'absent'|'replay'|'conflict',
 *   compareAndSetCurrentState: (args: {
 *     playerId: string,
 *     scope: unknown,
 *     ratingMode: string,
 *     expectedVersion: number,
 *     nextState: unknown,
 *     operationIdentity: unknown,
 *     payloadFingerprint: string,
 *     result: unknown,
 *   }) => Promise<{ applied: boolean, state: Readonly<Record<string, unknown>>, result: unknown }>,
 * }}
 */
export function createInMemoryRatingCurrentStateAdapter() {
  /** @type {Map<string, Readonly<Record<string, unknown>>>} */
  const byKey = new Map();
  /** @type {Map<string, Readonly<Record<string, unknown>>>} */
  const operations = new Map();

  /**
   * @param {string} playerId
   * @param {unknown} scope
   * @param {string} ratingMode
   */
  function lookup(playerId, scope, ratingMode) {
    const key = buildCurrentStateKey(
      requireNonEmptyString(playerId, "playerId"),
      requireExplicitPlayerRatingScope(scope),
      requireSupportedRatingMode(ratingMode)
    );
    return { key, state: byKey.get(key) ?? null };
  }

  const adapter = {
    async getCurrentState(playerId, scope, ratingMode) {
      const { state } = lookup(playerId, scope, ratingMode);
      return state ? deepFreeze(clonePlain(state)) : null;
    },

    async saveCurrentState(stateInput) {
      const state = normalizeStoredCurrentState(stateInput);
      const key = buildCurrentStateKey(
        /** @type {string} */ (state.playerId),
        state.scope,
        /** @type {string} */ (state.ratingMode)
      );
      const existing = byKey.get(key);
      if (existing) {
        if (existing.stateVersion !== Number(state.stateVersion) - 1) {
          failContract(
            PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_VERSION_CONFLICT,
            "saveCurrentState compare-and-set failed",
            {
              expectedPrevious: Number(state.stateVersion) - 1,
              actual: existing.stateVersion,
            }
          );
        }
      } else if (Number(state.stateVersion) !== 1) {
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
          "Initial current state must use stateVersion=1",
          { stateVersion: state.stateVersion }
        );
      }
      byKey.set(key, state);
      return deepFreeze(clonePlain(state));
    },

    async seedCurrentState(stateInput) {
      const state = normalizeStoredCurrentState(stateInput);
      const key = buildCurrentStateKey(
        /** @type {string} */ (state.playerId),
        state.scope,
        /** @type {string} */ (state.ratingMode)
      );
      if (byKey.has(key)) {
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
          "seedCurrentState refuses overwrite of existing state",
          { key }
        );
      }
      byKey.set(key, state);
      return deepFreeze(clonePlain(state));
    },

    hasOperation(identityInput) {
      const key = buildRatingOperationIdentityKey(identityInput);
      return operations.has(key);
    },

    getOperationRecord(identityInput) {
      const key = buildRatingOperationIdentityKey(identityInput);
      const record = operations.get(key);
      return record ? deepFreeze(clonePlain(record)) : null;
    },

    /**
     * @param {unknown} identityInput
     * @param {string} payloadFingerprint
     * @returns {'absent'|'replay'|'conflict'}
     */
    preflightOperation(identityInput, payloadFingerprint) {
      const identity = createRatingOperationIdentity(identityInput);
      const key = buildRatingOperationIdentityKey(identity);
      const existing = operations.get(key);
      if (!existing) return "absent";
      if (existing.payloadFingerprint === payloadFingerprint) return "replay";
      return "conflict";
    },

    /**
     * Atomic compare-and-set of current state + operation ledger entry.
     * Preflight must have already validated history/audit appendability.
     */
    async compareAndSetCurrentState(args) {
      const identity = createRatingOperationIdentity(args.operationIdentity);
      const opKey = buildRatingOperationIdentityKey(identity);
      const fingerprint = requireNonEmptyString(
        args.payloadFingerprint,
        "payloadFingerprint"
      );

      const existingOp = operations.get(opKey);
      if (existingOp) {
        if (existingOp.payloadFingerprint === fingerprint) {
          return {
            applied: false,
            state: deepFreeze(clonePlain(existingOp.afterState)),
            result: deepFreeze(clonePlain(existingOp.result)),
          };
        }
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_PAYLOAD_CONFLICT,
          "Conflicting payload for existing operationId",
          { operationId: identity.operationId }
        );
      }

      const { key, state: current } = lookup(
        args.playerId,
        args.scope,
        args.ratingMode
      );
      if (!current) {
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.CURRENT_STATE_NOT_FOUND,
          "Current state not found for compare-and-set",
          {
            playerId: args.playerId,
            ratingMode: args.ratingMode,
          }
        );
      }
      if (current.stateVersion !== args.expectedVersion) {
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_VERSION_CONFLICT,
          "Stale expectedVersion rejected",
          {
            expectedVersion: args.expectedVersion,
            actualVersion: current.stateVersion,
          }
        );
      }

      const nextState = normalizeStoredCurrentState(args.nextState);
      if (Number(nextState.stateVersion) !== Number(current.stateVersion) + 1) {
        failContract(
          PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT,
          "nextState.stateVersion must be previous + 1",
          {
            previous: current.stateVersion,
            next: nextState.stateVersion,
          }
        );
      }

      byKey.set(key, nextState);
      const record = deepFreeze({
        identity: clonePlain(identity),
        payloadFingerprint: fingerprint,
        afterState: clonePlain(nextState),
        result: clonePlain(args.result),
      });
      operations.set(opKey, record);

      return {
        applied: true,
        state: deepFreeze(clonePlain(nextState)),
        result: deepFreeze(clonePlain(args.result)),
      };
    },
  };

  // Touch fingerprint helper so callers can import from one place via adapter tests.
  void fingerprintPayload;

  if (!matchesRatingCurrentStatePort(adapter)) {
    throw new Error(
      "In-memory current-state adapter does not match RatingCurrentStatePort"
    );
  }

  return adapter;
}
