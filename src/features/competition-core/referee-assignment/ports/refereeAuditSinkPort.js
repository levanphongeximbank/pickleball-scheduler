import { createRefereeAssignmentAuditRecord } from "../contracts/refereeAssignmentAuditRecord.js";
import {
  createEmptySnapshotResult,
  createInvalidSnapshotResult,
  createMissingSnapshotResult,
  createPortResolveResult,
} from "./portResult.js";
import { REFEREE_SNAPSHOT_STATUS } from "../enums/snapshotStatus.js";

export const REFEREE_AUDIT_SINK_PORT_METHODS = Object.freeze(["appendAuditRecord"]);

export function matchesRefereeAuditSinkPort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ appendAuditRecord?: unknown }} */ (port)
        .appendAuditRecord === "function"
  );
}

export function createFailClosedRefereeAuditSinkPort() {
  return Object.freeze({
    async appendAuditRecord() {
      return createMissingSnapshotResult(
        "RefereeAuditSinkPort denied: fail-closed double"
      );
    },
  });
}

/**
 * In-memory sink for tests — does not invent wall-clock; records as provided.
 * @param {'missing'|'invalid'|object} [mode]
 */
export function createFixedRefereeAuditSinkPort(mode = {}) {
  if (mode === "missing") {
    return createFailClosedRefereeAuditSinkPort();
  }
  if (mode === "invalid") {
    return Object.freeze({
      async appendAuditRecord() {
        return createInvalidSnapshotResult(
          "RefereeAuditSinkPort: invalid sink double"
        );
      },
    });
  }

  /** @type {object[]} */
  const records = [];

  return Object.freeze({
    async appendAuditRecord(record) {
      const frozen = createRefereeAssignmentAuditRecord(record);
      records.push(frozen);
      return createPortResolveResult({
        status: REFEREE_SNAPSHOT_STATUS.POPULATED,
        message: "Audit record accepted",
        items: [frozen],
      });
    },
    /** Test helper — not part of production port surface */
    getRecords() {
      return Object.freeze([...records]);
    },
    async list() {
      if (records.length === 0) {
        return createEmptySnapshotResult("No audit records");
      }
      return createPortResolveResult({
        status: REFEREE_SNAPSHOT_STATUS.POPULATED,
        items: [...records],
      });
    },
  });
}
