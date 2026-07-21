/**
 * CORE-07 SeedingLifecycleAuditPort — capability-local contract (Phase 1E).
 * No hidden timestamps. No silent audit failure. No Production adapter here.
 */

import {
  createSeedingDomainError,
} from "../errors/SeedingDomainError.js";
import { SEEDING_ERROR_CODE } from "../errors/seedingErrorCodes.js";
import { CORE07_LIFECYCLE_AUDIT_PORT_VERSION } from "../domain/constants.js";

export { CORE07_LIFECYCLE_AUDIT_PORT_VERSION };

/**
 * @typedef {Object} SeedingLifecycleAuditPort
 * @property {string} contractVersion
 * @property {(events: ReadonlyArray<unknown>) => unknown} appendLifecycleEvents
 */

/**
 * @param {unknown} port
 * @returns {port is SeedingLifecycleAuditPort}
 */
export function isSeedingLifecycleAuditPort(port) {
  return (
    !!port &&
    typeof port === "object" &&
    typeof /** @type {SeedingLifecycleAuditPort} */ (port).contractVersion ===
      "string" &&
    /** @type {SeedingLifecycleAuditPort} */ (port).contractVersion.length >
      0 &&
    typeof /** @type {SeedingLifecycleAuditPort} */ (port)
      .appendLifecycleEvents === "function"
  );
}

/**
 * @param {unknown} port
 * @param {boolean} [required]
 * @returns {SeedingLifecycleAuditPort|null}
 */
export function requireSeedingLifecycleAuditPort(port, required = true) {
  if (port == null) {
    if (!required) return null;
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "SeedingLifecycleAuditPort is required",
      { failClosed: true }
    );
  }
  if (!isSeedingLifecycleAuditPort(port)) {
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "SeedingLifecycleAuditPort contract is invalid",
      { failClosed: true }
    );
  }
  return port;
}

/**
 * Append lifecycle events through the port. Invalid output fails closed.
 *
 * @param {SeedingLifecycleAuditPort} port
 * @param {ReadonlyArray<unknown>} events
 * @returns {ReadonlyArray<unknown>}
 */
export function appendLifecycleEventsThroughPort(port, events) {
  const safePort = requireSeedingLifecycleAuditPort(port, true);
  if (!Array.isArray(events)) {
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "lifecycle events must be an array",
      { failClosed: true }
    );
  }
  try {
    const output = safePort.appendLifecycleEvents(events);
    if (output == null) {
      // Allow void/undefined success when the port acknowledges by side effect;
      // callers still retain the deterministic event documents.
      return events;
    }
    if (!Array.isArray(output)) {
      throw createSeedingDomainError(
        SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
        "SeedingLifecycleAuditPort.appendLifecycleEvents returned invalid output",
        { failClosed: true }
      );
    }
    for (let i = 0; i < output.length; i += 1) {
      const item = output[i];
      if (
        !item ||
        typeof item !== "object" ||
        typeof /** @type {{ eventId?: unknown }} */ (item).eventId !== "string" ||
        /** @type {{ eventId: string }} */ (item).eventId.length === 0
      ) {
        throw createSeedingDomainError(
          SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
          "SeedingLifecycleAuditPort returned event without eventId",
          { failClosed: true }
        );
      }
    }
    return output;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      /** @type {{ code?: string }} */ (err).code ===
        SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
    ) {
      throw err;
    }
    if (
      err &&
      typeof err === "object" &&
      typeof /** @type {{ code?: string }} */ (err).code === "string" &&
      /** @type {{ code: string }} */ (err).code !==
        SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
    ) {
      throw err;
    }
    throw createSeedingDomainError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "SeedingLifecycleAuditPort.appendLifecycleEvents failed",
      {
        failClosed: true,
        details: {
          message: err instanceof Error ? err.message : String(err),
        },
      }
    );
  }
}
