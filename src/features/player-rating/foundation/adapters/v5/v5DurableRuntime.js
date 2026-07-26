/**
 * V5 durable runtime contract (BM-FINAL-RATING-01).
 *
 * Persistence authority remains existing V5 durable tables / service RPCs:
 * player_rating_profiles, player_rating_events, rating_snapshots,
 * rating_v5_idempotency.
 *
 * General verification/adjustment CAS is not exposed on the client V5 RPC
 * surface today. Adapters therefore require an injected durable runtime that
 * speaks the foundation CAS protocol. Missing runtime → fail closed.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../../errors/errorCodes.js";
import { PlayerRatingFoundationError } from "../../errors/PlayerRatingFoundationError.js";
import { V5_FOUNDATION_TABLES } from "../../../../pick-vn-rating-v5/constants/v5TableRegistry.js";

export const PLAYER_RATING_V5_DURABLE_AUTHORITY = Object.freeze({
  id: "pick-vn-rating-v5-service-rpc",
  tables: Object.freeze(
    (V5_FOUNDATION_TABLES || [])
      .map((row) => row.table_name)
      .filter(Boolean)
  ),
  requiredTables: Object.freeze([
    "player_rating_profiles",
    "player_rating_events",
    "rating_snapshots",
    "rating_v5_idempotency",
  ]),
  clientGeneralCasRpcAvailable: false,
  productionCutover: false,
});

/**
 * @param {string} operation
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function throwDurableRuntimeUnavailable(operation, details = {}) {
  throw new PlayerRatingFoundationError(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.DURABLE_RUNTIME_UNAVAILABLE,
    `V5 durable runtime unavailable for ${operation}`,
    {
      operation,
      authority: PLAYER_RATING_V5_DURABLE_AUTHORITY.id,
      ...details,
    }
  );
}

/**
 * @param {string} operation
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function throwPersistenceFailed(operation, details = {}) {
  throw new PlayerRatingFoundationError(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.PERSISTENCE_FAILED,
    `V5 durable persistence failed for ${operation}`,
    {
      operation,
      authority: PLAYER_RATING_V5_DURABLE_AUTHORITY.id,
      ...details,
    }
  );
}

/**
 * Detect whether a composed runtime exposes the CAS surface required by
 * foundation verification / adjustment workflows.
 *
 * @param {unknown} runtime
 * @returns {boolean}
 */
export function isV5DurableCasRuntime(runtime) {
  if (!runtime || typeof runtime !== "object") return false;
  const r = /** @type {Record<string, unknown>} */ (runtime);
  return (
    typeof r.getCurrentState === "function" &&
    typeof r.saveCurrentState === "function" &&
    typeof r.preflightOperation === "function" &&
    typeof r.getOperationRecord === "function" &&
    typeof r.compareAndSetCurrentState === "function" &&
    typeof r.appendHistoryEntry === "function"
  );
}

/**
 * Default Production/browser composition: client V5 RPC does not expose general
 * CAS verify/adjust. Fail closed — never invent local durable success.
 *
 * @returns {null}
 */
export function resolveDefaultV5DurableRuntime() {
  return null;
}

/**
 * Wrap an injected CAS runtime and stamp V5 authority metadata.
 * Used by tests and by future service-role composition.
 *
 * @param {object} runtime
 * @param {{ requireIdempotency?: boolean }} [options]
 */
export function createV5DurableRuntimeHandle(runtime, options = {}) {
  if (!isV5DurableCasRuntime(runtime)) {
    throwDurableRuntimeUnavailable("createV5DurableRuntimeHandle", {
      reason: "runtime missing CAS methods",
    });
  }

  const requireIdempotency = options.requireIdempotency !== false;

  return Object.freeze({
    authority: PLAYER_RATING_V5_DURABLE_AUTHORITY,
    requireIdempotency,
    ready: true,
    async getCurrentState(playerId, scope, ratingMode) {
      return runtime.getCurrentState(playerId, scope, ratingMode);
    },
    async saveCurrentState(state) {
      return runtime.saveCurrentState(state);
    },
    preflightOperation(identity, payloadFingerprint) {
      return runtime.preflightOperation(identity, payloadFingerprint);
    },
    getOperationRecord(identity) {
      return runtime.getOperationRecord(identity);
    },
    async compareAndSetCurrentState(args) {
      if (requireIdempotency) {
        if (!args?.operationIdentity || !args?.payloadFingerprint) {
          throw new PlayerRatingFoundationError(
            PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_COMMAND,
            "V5 durable CAS requires operationIdentity and payloadFingerprint (idempotency)",
            { args }
          );
        }
        if (args.expectedVersion == null || !Number.isInteger(Number(args.expectedVersion))) {
          throw new PlayerRatingFoundationError(
            PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_COMMAND,
            "V5 durable CAS requires integer expectedVersion",
            { expectedVersion: args?.expectedVersion }
          );
        }
      }
      try {
        return await runtime.compareAndSetCurrentState(args);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          /** @type {{ code?: string }} */ (err).code
        ) {
          throw err;
        }
        throwPersistenceFailed("compareAndSetCurrentState", {
          cause: err instanceof Error ? err.message : String(err ?? "unknown"),
        });
      }
    },
    async appendHistoryEntry(entry) {
      try {
        return await runtime.appendHistoryEntry(entry);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          /** @type {{ code?: string }} */ (err).code
        ) {
          throw err;
        }
        throwPersistenceFailed("appendHistoryEntry", {
          cause: err instanceof Error ? err.message : String(err ?? "unknown"),
        });
      }
    },
    async listHistory(playerId, scope, options) {
      if (typeof runtime.listHistory !== "function") {
        throwDurableRuntimeUnavailable("listHistory", {
          reason: "listHistory method missing on runtime",
        });
      }
      return runtime.listHistory(playerId, scope, options);
    },
    async getHistoryEntry(eventId) {
      if (typeof runtime.getHistoryEntry !== "function") {
        throwDurableRuntimeUnavailable("getHistoryEntry", {
          reason: "getHistoryEntry method missing on runtime",
        });
      }
      return runtime.getHistoryEntry(eventId);
    },
    async createSnapshot(snapshot) {
      if (typeof runtime.createSnapshot !== "function") {
        throwDurableRuntimeUnavailable("createSnapshot", {
          reason: "snapshot method missing on runtime",
        });
      }
      try {
        return await runtime.createSnapshot(snapshot);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          /** @type {{ code?: string }} */ (err).code
        ) {
          throw err;
        }
        throwPersistenceFailed("createSnapshot", {
          cause: err instanceof Error ? err.message : String(err ?? "unknown"),
        });
      }
    },
    async getSnapshot(snapshotId, scope) {
      if (typeof runtime.getSnapshot !== "function") {
        throwDurableRuntimeUnavailable("getSnapshot", {
          reason: "snapshot method missing on runtime",
        });
      }
      return runtime.getSnapshot(snapshotId, scope);
    },
    async recordAdjustmentAudit(entry) {
      if (typeof runtime.recordAdjustmentAudit !== "function") {
        throwDurableRuntimeUnavailable("recordAdjustmentAudit", {
          reason: "audit method missing on runtime",
        });
      }
      return runtime.recordAdjustmentAudit(entry);
    },
    hasAuditOperationId(operationId) {
      return typeof runtime.hasAuditOperationId === "function"
        ? runtime.hasAuditOperationId(operationId)
        : false;
    },
    hasAuditId(auditId) {
      return typeof runtime.hasAuditId === "function"
        ? runtime.hasAuditId(auditId)
        : false;
    },
  });
}
