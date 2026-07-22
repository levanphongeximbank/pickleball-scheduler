/**
 * CORE-14 — ResourceOccupancy validate / normalize.
 * Does not mutate caller input. Returns frozen copies.
 *
 * Failure rule:
 * - validateResourceOccupancy → { ok, value? | diagnostics } (never throws for invalid caller input)
 * - createResourceOccupancy / normalizeResourceOccupancy → throws ResourceConflictContractError
 *   whose code is the first frozen INPUT_DIAGNOSTIC_CODE from diagnostics
 */

import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { SCOPE_TYPE } from "../enums/scopeType.js";
import { resolveOccupancySource } from "../enums/occupancySource.js";
import { validateHalfOpenInterval } from "../time/interval.js";
import { deepFreezeClone, isPlainObject } from "../deterministic/serialize.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";
import {
  createCanonicalResourceKey,
  validateCanonicalResourceKey,
} from "./CanonicalResourceKey.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>|null} [details]
 * @param {string|null} [path]
 * @param {string|null} [occupancyId]
 */
function diagnostic(code, message, details = null, path = null, occupancyId = null) {
  return Object.freeze({
    code,
    message,
    path,
    resourceKey: null,
    occupancyId,
    assignmentId: null,
    details: details ? Object.freeze({ ...details }) : null,
  });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function actualTypeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyIdentityString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function optionalIdentity(value) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  return value.length > 0 ? value : null;
}

/**
 * @param {unknown} input
 * @returns {{ ok: true, value: object } | { ok: false, diagnostics: object[] }}
 */
export function validateResourceOccupancy(input) {
  const diagnostics = [];
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.OCCUPANCY_ID_MISSING,
          "ResourceOccupancy must be an object with a non-empty occupancyId",
          {
            fieldName: "occupancyId",
            expectedType: "string",
            actualType: actualTypeOf(input),
          }
        ),
      ],
    };
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const occupancyId = raw.occupancyId;
  const source = raw.source;
  const locked = raw.locked;
  const published = raw.published;
  const capacityUnits = raw.capacityUnits;
  const startMs = raw.startMs;
  const endMs = raw.endMs;
  const assignmentId = optionalIdentity(raw.assignmentId);
  const activityId = optionalIdentity(raw.activityId);
  const matchId = optionalIdentity(raw.matchId);
  const competitionId = optionalIdentity(raw.competitionId);
  const venueId = optionalIdentity(raw.venueId);
  const metadataRaw = raw.metadata === undefined ? null : raw.metadata;

  if (!isNonEmptyIdentityString(occupancyId)) {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.OCCUPANCY_ID_MISSING, "occupancyId must be a non-empty string", {
        fieldName: "occupancyId",
        expectedType: "string",
        actualType: actualTypeOf(occupancyId),
      })
    );
  }

  const keyResult = validateCanonicalResourceKey(raw.resourceKey);
  if (!keyResult.ok) {
    diagnostics.push(...keyResult.diagnostics);
  }

  const interval = validateHalfOpenInterval(startMs, endMs);
  if (!interval.ok) {
    diagnostics.push(
      diagnostic(
        interval.reason === "TIME_WINDOW_MISSING"
          ? INPUT_DIAGNOSTIC_CODE.TIME_WINDOW_MISSING
          : INPUT_DIAGNOSTIC_CODE.INVALID_TIME_INTERVAL,
        interval.reason === "TIME_WINDOW_MISSING"
          ? "startMs and endMs are required"
          : "startMs/endMs must be safe integers with startMs < endMs",
        { startMs: startMs ?? null, endMs: endMs ?? null },
        null,
        typeof occupancyId === "string" ? occupancyId : null
      )
    );
  }

  if (capacityUnits == null) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.CAPACITY_MISSING,
        "capacityUnits is required",
        { capacityUnits: null },
        null,
        typeof occupancyId === "string" ? occupancyId : null
      )
    );
  } else if (typeof capacityUnits !== "number" || !Number.isSafeInteger(capacityUnits) || capacityUnits <= 0) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.INVALID_CAPACITY,
        "capacityUnits must be a safe integer greater than zero",
        { capacityUnits },
        null,
        typeof occupancyId === "string" ? occupancyId : null
      )
    );
  }

  if (typeof locked !== "boolean") {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID, "locked must be a boolean", {
        fieldName: "locked",
        expectedType: "boolean",
        actualType: actualTypeOf(locked),
      })
    );
  }
  if (typeof published !== "boolean") {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID, "published must be a boolean", {
        fieldName: "published",
        expectedType: "boolean",
        actualType: actualTypeOf(published),
      })
    );
  }

  const sourceResolved = resolveOccupancySource(source);
  if (!sourceResolved.ok) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.OCCUPANCY_SOURCE_MISSING,
        "source must be a non-empty provenance string",
        {
          fieldName: "source",
          expectedType: "string",
          actualType: actualTypeOf(source),
        },
        null,
        typeof occupancyId === "string" ? occupancyId : null
      )
    );
  }

  if (!assignmentId && !activityId && !matchId) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.ACTIVITY_IDENTITY_MISSING,
        "At least one of assignmentId, activityId, matchId is required",
        null,
        null,
        typeof occupancyId === "string" ? occupancyId : null
      )
    );
  }

  if (keyResult.ok && keyResult.value.scopeType === SCOPE_TYPE.COMPETITION) {
    if (!competitionId) {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING,
          "competitionId is required when resource scopeType is COMPETITION",
          { scopeType: SCOPE_TYPE.COMPETITION },
          null,
          typeof occupancyId === "string" ? occupancyId : null
        )
      );
    }
  }

  if (metadataRaw != null && !isPlainObject(metadataRaw)) {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.OCCUPANCY_METADATA_INVALID, "metadata must be a plain object or null", {
        fieldName: "metadata",
        expectedType: "object|null",
        actualType: actualTypeOf(metadataRaw),
      })
    );
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  const metadata =
    metadataRaw == null
      ? null
      : /** @type {Record<string, unknown>} */ (deepFreezeClone({ ...metadataRaw }));

  const value = Object.freeze({
    occupancyId: /** @type {string} */ (occupancyId),
    resourceKey: keyResult.value,
    assignmentId,
    activityId,
    matchId,
    competitionId,
    venueId,
    startMs: interval.startMs,
    endMs: interval.endMs,
    capacityUnits: /** @type {number} */ (capacityUnits),
    locked: /** @type {boolean} */ (locked),
    published: /** @type {boolean} */ (published),
    source: sourceResolved.value,
    metadata,
  });

  return { ok: true, value };
}

/**
 * Normalize occupancy without mutating caller input.
 * @param {unknown} input
 * @returns {object}
 */
export function normalizeResourceOccupancy(input) {
  const result = validateResourceOccupancy(input);
  if (!result.ok) {
    const first = result.diagnostics[0];
    throw new ResourceConflictContractError(first.code, first.message, {
      diagnostics: result.diagnostics,
    });
  }
  return result.value;
}

/**
 * @param {unknown} input
 * @returns {object}
 */
export function createResourceOccupancy(input) {
  return normalizeResourceOccupancy(input);
}

/**
 * @param {Record<string, unknown>} partial
 * @returns {object}
 */
export function createResourceOccupancyFromPartial(partial) {
  const resourceKey =
    partial.resourceKey && typeof partial.resourceKey === "object"
      ? createCanonicalResourceKey(partial.resourceKey)
      : createCanonicalResourceKey({
          resourceKind: partial.resourceKind,
          resourceId: partial.resourceId,
          scopeType: partial.scopeType,
          scopeId: partial.scopeId,
        });
  return createResourceOccupancy({
    ...partial,
    resourceKey,
  });
}
