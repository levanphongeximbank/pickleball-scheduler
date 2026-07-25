/**
 * Export artifact storage port (REPORTING-02).
 * Stores opaque references only — never fabricates download URLs.
 */

import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { ReportingError } from "../errors/ReportingError.js";

export const ARTIFACT_STORAGE_PORT_METHODS = Object.freeze(["put"]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesArtifactStoragePort(port) {
  return Boolean(port && typeof port === "object" && typeof port.put === "function");
}

export function createUnimplementedArtifactStoragePort() {
  return {
    async put() {
      throw new ReportingError(
        REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED,
        "ArtifactStoragePort.put is not configured",
        { portName: "ArtifactStoragePort", method: "put" }
      );
    },
  };
}

/**
 * In-memory artifact store for tests. Not durable. Not production.
 * @returns {{ put: Function, getById: Function, resetAllForTests: Function }}
 */
export function createInMemoryArtifactStoragePort() {
  /** @type {Record<string, object>} */
  const store = Object.create(null);
  let seq = 0;
  return {
    async put({ exportJobId, format, contentType, body, byteLength, metadata }) {
      seq += 1;
      const artifactId = `art_${seq}`;
      const reference = Object.freeze({
        artifactId,
        exportJobId: String(exportJobId),
        format: String(format),
        contentType: String(contentType || "application/octet-stream"),
        byteLength: Number(byteLength) || 0,
        // Explicitly NOT a download URL — opaque locator only.
        storageKind: "IN_MEMORY_TEST",
        locator: `memory://${artifactId}`,
        metadata: metadata && typeof metadata === "object" ? Object.freeze({ ...metadata }) : null,
      });
      store[artifactId] = Object.freeze({
        ...reference,
        body: String(body ?? ""),
      });
      return reference;
    },
    async getById(artifactId) {
      return store[String(artifactId)] || null;
    },
    resetAllForTests() {
      for (const key of Object.keys(store)) Reflect.deleteProperty(store, key);
      seq = 0;
    },
  };
}
