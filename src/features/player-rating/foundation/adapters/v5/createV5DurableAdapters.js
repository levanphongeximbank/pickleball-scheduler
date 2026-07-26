/**
 * Thin V5 durable adapters for Player Rating foundation ports.
 */

import { createInMemoryRatingCurrentStateAdapter } from "../../verification-adjustment/createInMemoryRatingCurrentStateAdapter.js";
import { createInMemoryRatingHistoryAdapter } from "../../history-snapshot/createInMemoryRatingHistoryAdapter.js";
import { createInMemoryRatingSnapshotAdapter } from "../../history-snapshot/createInMemoryRatingSnapshotAdapter.js";
import { createInMemoryRatingAdjustmentAuditAdapter } from "../../verification-adjustment/createInMemoryRatingAdjustmentAuditAdapter.js";
import {
  createV5DurableRuntimeHandle,
  isV5DurableCasRuntime,
  resolveDefaultV5DurableRuntime,
  throwDurableRuntimeUnavailable,
  PLAYER_RATING_V5_DURABLE_AUTHORITY,
} from "./v5DurableRuntime.js";

/**
 * @param {unknown} handle
 * @param {string} operation
 */
function requireReadyHandle(handle, operation) {
  if (!handle || handle.ready !== true) {
    throwDurableRuntimeUnavailable(operation, {
      reason: "V5 durable handle not ready",
    });
  }
}

/**
 * Current-state adapter backed by a V5 durable runtime handle.
 * @param {{ runtimeHandle?: object|null }} [deps]
 */
export function createV5DurableCurrentStateAdapter(deps = {}) {
  const handle = deps.runtimeHandle ?? null;

  return {
    authority: PLAYER_RATING_V5_DURABLE_AUTHORITY,
    async getCurrentState(playerId, scope, ratingMode) {
      requireReadyHandle(handle, "getCurrentState");
      return handle.getCurrentState(playerId, scope, ratingMode);
    },
    async saveCurrentState(state) {
      requireReadyHandle(handle, "saveCurrentState");
      return handle.saveCurrentState(state);
    },
    preflightOperation(identity, payloadFingerprint) {
      requireReadyHandle(handle, "preflightOperation");
      return handle.preflightOperation(identity, payloadFingerprint);
    },
    getOperationRecord(identity) {
      requireReadyHandle(handle, "getOperationRecord");
      return handle.getOperationRecord(identity);
    },
    async compareAndSetCurrentState(args) {
      requireReadyHandle(handle, "compareAndSetCurrentState");
      return handle.compareAndSetCurrentState(args);
    },
  };
}

/**
 * @param {{ runtimeHandle?: object|null }} [deps]
 */
export function createV5DurableHistoryAdapter(deps = {}) {
  const handle = deps.runtimeHandle ?? null;
  return {
    authority: PLAYER_RATING_V5_DURABLE_AUTHORITY,
    async appendHistoryEntry(entry) {
      requireReadyHandle(handle, "appendHistoryEntry");
      return handle.appendHistoryEntry(entry);
    },
    async listHistory(playerId, scope, options) {
      requireReadyHandle(handle, "listHistory");
      if (typeof handle.listHistory === "function") {
        return handle.listHistory(playerId, scope, options);
      }
      throwDurableRuntimeUnavailable("listHistory", {
        reason: "listHistory not on runtime",
      });
    },
    async getHistoryEntry(eventId) {
      requireReadyHandle(handle, "getHistoryEntry");
      if (typeof handle.getHistoryEntry === "function") {
        return handle.getHistoryEntry(eventId);
      }
      throwDurableRuntimeUnavailable("getHistoryEntry", {
        reason: "getHistoryEntry not on runtime",
      });
    },
  };
}

/**
 * @param {{ runtimeHandle?: object|null }} [deps]
 */
export function createV5DurableSnapshotAdapter(deps = {}) {
  const handle = deps.runtimeHandle ?? null;
  return {
    authority: PLAYER_RATING_V5_DURABLE_AUTHORITY,
    async createSnapshot(snapshot) {
      requireReadyHandle(handle, "createSnapshot");
      return handle.createSnapshot(snapshot);
    },
    async getSnapshot(snapshotId, scope) {
      requireReadyHandle(handle, "getSnapshot");
      return handle.getSnapshot(snapshotId, scope);
    },
    async listSnapshots(playerId, scope, options) {
      requireReadyHandle(handle, "listSnapshots");
      if (typeof handle.listSnapshots === "function") {
        return handle.listSnapshots(playerId, scope, options);
      }
      throwDurableRuntimeUnavailable("listSnapshots", {
        reason: "listSnapshots not on runtime",
      });
    },
  };
}

/**
 * @param {{ runtimeHandle?: object|null }} [deps]
 */
export function createV5DurableAuditAdapter(deps = {}) {
  const handle = deps.runtimeHandle ?? null;
  return {
    authority: PLAYER_RATING_V5_DURABLE_AUTHORITY,
    async recordAdjustmentAudit(entry) {
      requireReadyHandle(handle, "recordAdjustmentAudit");
      return handle.recordAdjustmentAudit(entry);
    },
    hasAuditOperationId(operationId) {
      requireReadyHandle(handle, "hasAuditOperationId");
      return handle.hasAuditOperationId(operationId);
    },
    hasAuditId(auditId) {
      requireReadyHandle(handle, "hasAuditId");
      return handle.hasAuditId(auditId);
    },
  };
}

/**
 * Compose V5 durable adapters. Without an injected CAS runtime, adapters fail
 * closed (default browser/Production path until service-role CAS is available).
 *
 * @param {{ runtime?: object|null }} [deps]
 */
export function createV5DurableAdapterBundle(deps = {}) {
  const runtime =
    deps.runtime === undefined ? resolveDefaultV5DurableRuntime() : deps.runtime;

  if (!runtime) {
    return Object.freeze({
      ready: false,
      authority: PLAYER_RATING_V5_DURABLE_AUTHORITY,
      runtimeHandle: null,
      currentStateAdapter: createV5DurableCurrentStateAdapter({ runtimeHandle: null }),
      historyAdapter: createV5DurableHistoryAdapter({ runtimeHandle: null }),
      snapshotAdapter: createV5DurableSnapshotAdapter({ runtimeHandle: null }),
      auditAdapter: createV5DurableAuditAdapter({ runtimeHandle: null }),
    });
  }

  const runtimeHandle = isV5DurableCasRuntime(runtime)
    ? createV5DurableRuntimeHandle(runtime)
    : null;

  if (!runtimeHandle) {
    throwDurableRuntimeUnavailable("createV5DurableAdapterBundle", {
      reason: "injected runtime is not CAS-capable",
    });
  }

  return Object.freeze({
    ready: true,
    authority: PLAYER_RATING_V5_DURABLE_AUTHORITY,
    runtimeHandle,
    currentStateAdapter: createV5DurableCurrentStateAdapter({ runtimeHandle }),
    historyAdapter: createV5DurableHistoryAdapter({ runtimeHandle }),
    snapshotAdapter: createV5DurableSnapshotAdapter({ runtimeHandle }),
    auditAdapter: createV5DurableAuditAdapter({ runtimeHandle }),
  });
}

/**
 * Test/helper: compose an in-memory CAS stack stamped as V5 durable authority.
 * Does not claim Production cutover. Does not dual-write V2 local stores.
 */
export function createInMemoryV5DurableRuntime() {
  const currentState = createInMemoryRatingCurrentStateAdapter();
  const history = createInMemoryRatingHistoryAdapter();
  const snapshot = createInMemoryRatingSnapshotAdapter();
  const audit = createInMemoryRatingAdjustmentAuditAdapter();

  return {
    getCurrentState: (...args) => currentState.getCurrentState(...args),
    saveCurrentState: (...args) => currentState.saveCurrentState(...args),
    seedCurrentState: (...args) => currentState.seedCurrentState(...args),
    preflightOperation: (...args) => currentState.preflightOperation(...args),
    getOperationRecord: (...args) => currentState.getOperationRecord(...args),
    compareAndSetCurrentState: (...args) =>
      currentState.compareAndSetCurrentState(...args),
    appendHistoryEntry: (...args) => history.appendHistoryEntry(...args),
    listHistory: (...args) => history.listHistory(...args),
    getHistoryEntry: (...args) => history.getHistoryEntry(...args),
    createSnapshot: (...args) => snapshot.createSnapshot(...args),
    getSnapshot: (...args) => snapshot.getSnapshot(...args),
    listSnapshots: (...args) => snapshot.listSnapshots(...args),
    recordAdjustmentAudit: (...args) => audit.recordAdjustmentAudit(...args),
    hasAuditOperationId: (...args) => audit.hasAuditOperationId(...args),
    hasAuditId: (...args) => audit.hasAuditId(...args),
  };
}
