/**
 * Shared port resolve result helpers — distinguish missing / invalid / empty / populated.
 */

import { REFEREE_SNAPSHOT_STATUS } from "../enums/snapshotStatus.js";
import { REFEREE_DIAGNOSTIC_SEVERITY } from "../enums/diagnosticSeverity.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createPortResolveResult(partial = {}) {
  const status = partial.status || REFEREE_SNAPSHOT_STATUS.MISSING;
  const ok =
    status === REFEREE_SNAPSHOT_STATUS.EMPTY ||
    status === REFEREE_SNAPSHOT_STATUS.POPULATED;

  return Object.freeze({
    ok,
    status,
    code: partial.code ?? null,
    severity:
      partial.severity ??
      (ok
        ? null
        : REFEREE_DIAGNOSTIC_SEVERITY.FATAL),
    message: partial.message ?? null,
    items: Object.freeze(Array.isArray(partial.items) ? [...partial.items] : []),
    details: Object.freeze(
      partial.details && typeof partial.details === "object"
        ? { ...partial.details }
        : {}
    ),
  });
}

export function createMissingSnapshotResult(message, details = {}) {
  return createPortResolveResult({
    status: REFEREE_SNAPSHOT_STATUS.MISSING,
    code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING,
    severity: REFEREE_DIAGNOSTIC_SEVERITY.FATAL,
    message: message || "Required snapshot missing",
    items: [],
    details,
  });
}

export function createInvalidSnapshotResult(message, details = {}) {
  return createPortResolveResult({
    status: REFEREE_SNAPSHOT_STATUS.INVALID,
    code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID,
    severity: REFEREE_DIAGNOSTIC_SEVERITY.FATAL,
    message: message || "Snapshot invalid",
    items: [],
    details,
  });
}

export function createEmptySnapshotResult(message = "Valid empty snapshot") {
  return createPortResolveResult({
    status: REFEREE_SNAPSHOT_STATUS.EMPTY,
    code: null,
    severity: null,
    message,
    items: [],
  });
}

export function createPopulatedSnapshotResult(items, message = "Snapshot populated") {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return createEmptySnapshotResult(message);
  }
  return createPortResolveResult({
    status: REFEREE_SNAPSHOT_STATUS.POPULATED,
    code: null,
    severity: null,
    message,
    items: list,
  });
}
