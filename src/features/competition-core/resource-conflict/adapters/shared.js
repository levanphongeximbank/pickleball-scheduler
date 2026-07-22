/**
 * CORE-14 Phase 1F — shared adapter helpers (shape-only, no adjacent imports).
 */

import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { createCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { validateHalfOpenInterval } from "../time/interval.js";
import { isPlainObject } from "../deterministic/serialize.js";

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function optionalIdentity(value) {
  if (!isNonEmptyString(value)) return null;
  return value;
}

/**
 * @param {unknown} input
 * @returns {{ ok: true, value: string } | { ok: false, diagnostic: object }}
 */
export function requireSourceContractVersion(input) {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
        message: "adapter input must be a plain object",
        details: { reason: "INPUT_NOT_OBJECT" },
      }),
    };
  }
  const version = input.sourceContractVersion;
  if (!isNonEmptyString(version)) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.ADAPTER_SOURCE_VERSION_MISSING,
        message: "sourceContractVersion is required",
        details: { fieldName: "sourceContractVersion" },
      }),
    };
  }
  return { ok: true, value: version };
}

/**
 * Resolve half-open interval from explicit fields or an explicit slotResolver.
 * Never invents end time or duration. Unresolved slot fails closed.
 *
 * @param {Record<string, unknown>} record
 * @param {((record: Record<string, unknown>) => { startMs: number, endMs: number } | null) | null | undefined} slotResolver
 * @param {string} path
 * @returns {{ ok: true, startMs: number, endMs: number, viaSlot: boolean } | { ok: false, diagnostic: object }}
 */
export function resolveInterval(record, slotResolver, path) {
  const hasStart = record.startMs != null;
  const hasEnd = record.endMs != null;
  if (hasStart || hasEnd) {
    const interval = validateHalfOpenInterval(record.startMs, record.endMs);
    if (!interval.ok) {
      return {
        ok: false,
        diagnostic: createInputDiagnostic({
          code:
            interval.reason === "TIME_WINDOW_MISSING"
              ? INPUT_DIAGNOSTIC_CODE.TIME_WINDOW_MISSING
              : INPUT_DIAGNOSTIC_CODE.INVALID_TIME_INTERVAL,
          message:
            interval.reason === "TIME_WINDOW_MISSING"
              ? "startMs and endMs are required together"
              : "startMs/endMs must be safe integers with startMs < endMs",
          path,
          assignmentId: optionalIdentity(record.assignmentId),
          details: {
            startMs: record.startMs ?? null,
            endMs: record.endMs ?? null,
            reason: interval.reason,
          },
        }),
      };
    }
    return { ok: true, startMs: interval.startMs, endMs: interval.endMs, viaSlot: false };
  }

  if (typeof slotResolver === "function") {
    let resolved;
    try {
      resolved = slotResolver(record);
    } catch {
      return {
        ok: false,
        diagnostic: createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.SLOT_RESOLUTION_FAILED,
          message: "slotResolver threw while resolving interval",
          path,
          assignmentId: optionalIdentity(record.assignmentId),
          details: { reason: "SLOT_RESOLVER_THREW" },
        }),
      };
    }
    if (resolved == null || typeof resolved !== "object" || Array.isArray(resolved)) {
      return {
        ok: false,
        diagnostic: createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.SLOT_RESOLUTION_FAILED,
          message: "slotResolver returned no interval",
          path,
          assignmentId: optionalIdentity(record.assignmentId),
          details: { reason: "SLOT_RESOLVER_EMPTY" },
        }),
      };
    }
    const interval = validateHalfOpenInterval(resolved.startMs, resolved.endMs);
    if (!interval.ok) {
      return {
        ok: false,
        diagnostic: createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.SLOT_RESOLUTION_FAILED,
          message: "slotResolver returned invalid interval",
          path,
          assignmentId: optionalIdentity(record.assignmentId),
          details: {
            startMs: resolved.startMs ?? null,
            endMs: resolved.endMs ?? null,
            reason: interval.reason,
          },
        }),
      };
    }
    return { ok: true, startMs: interval.startMs, endMs: interval.endMs, viaSlot: true };
  }

  if (record.slotKey != null || record.slotId != null) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.SLOT_RESOLUTION_FAILED,
        message: "slot key present but no explicit slotResolver supplied",
        path,
        assignmentId: optionalIdentity(record.assignmentId),
        details: {
          slotKey: record.slotKey ?? null,
          slotId: record.slotId ?? null,
          reason: "SLOT_RESOLVER_REQUIRED",
        },
      }),
    };
  }

  return {
    ok: false,
    diagnostic: createInputDiagnostic({
      code: INPUT_DIAGNOSTIC_CODE.TIME_WINDOW_MISSING,
      message: "canonical interval missing and no slotResolver provided",
      path,
      assignmentId: optionalIdentity(record.assignmentId),
      details: { reason: "INTERVAL_MISSING" },
    }),
  };
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} path
 * @returns {{ ok: true, assignmentId: string|null, activityId: string|null, matchId: string|null, activityIdentity: string } | { ok: false, diagnostic: object }}
 */
export function resolveActivityIdentity(record, path) {
  const assignmentId = optionalIdentity(record.assignmentId);
  const activityId = optionalIdentity(record.activityId);
  const matchId = optionalIdentity(record.matchId);
  if (!assignmentId && !activityId && !matchId) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.ACTIVITY_IDENTITY_MISSING,
        message: "At least one of assignmentId, activityId, matchId is required",
        path,
        details: { reason: "ACTIVITY_IDENTITY_MISSING" },
      }),
    };
  }
  const activityIdentity = assignmentId || activityId || matchId;
  return { ok: true, assignmentId, activityId, matchId, activityIdentity };
}

/**
 * @param {unknown} keyInput
 * @param {string} expectedKind
 * @param {string} path
 * @returns {{ ok: true, value: object } | { ok: false, diagnostic: object }}
 */
export function requireResourceKeyOfKind(keyInput, expectedKind, path) {
  if (keyInput == null || typeof keyInput !== "object" || Array.isArray(keyInput)) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING,
        message: "resourceKey is required",
        path,
        details: { expectedKind },
      }),
    };
  }
  try {
    const key = createCanonicalResourceKey(keyInput);
    if (key.resourceKind !== expectedKind) {
      return {
        ok: false,
        diagnostic: createInputDiagnostic({
          code: INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE,
          message: `resourceKind must be ${expectedKind}`,
          path,
          resourceKey: key,
          details: {
            expectedKind,
            actualKind: key.resourceKind,
            reason: "ADAPTER_RESOURCE_KIND_MISMATCH",
          },
        }),
      };
    }
    return { ok: true, value: key };
  } catch (err) {
    const code =
      err && typeof err === "object" && typeof err.code === "string"
        ? err.code
        : INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING;
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE_VALUES_SAFE(code),
        message: err && typeof err.message === "string" ? err.message : "invalid resourceKey",
        path,
        details: { expectedKind, reason: "RESOURCE_KEY_INVALID" },
      }),
    };
  }
}

/**
 * @param {string} code
 */
function INPUT_DIAGNOSTIC_CODE_VALUES_SAFE(code) {
  const allowed = new Set(Object.values(INPUT_DIAGNOSTIC_CODE));
  return allowed.has(code) ? code : INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING;
}

/**
 * @param {unknown} locked
 * @param {unknown} published
 * @param {string} path
 * @returns {{ ok: true, locked: boolean, published: boolean } | { ok: false, diagnostic: object }}
 */
export function resolveLockPublished(locked, published, path) {
  const lockedValue = locked == null ? false : locked;
  const publishedValue = published == null ? false : published;
  if (typeof lockedValue !== "boolean") {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID,
        message: "locked must be a boolean when supplied",
        path,
        details: { fieldName: "locked" },
      }),
    };
  }
  if (typeof publishedValue !== "boolean") {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID,
        message: "published must be a boolean when supplied",
        path,
        details: { fieldName: "published" },
      }),
    };
  }
  return { ok: true, locked: lockedValue, published: publishedValue };
}

/**
 * @param {unknown} value
 * @param {number} defaultValue
 * @param {string} path
 */
export function resolveCapacityUnits(value, defaultValue, path) {
  if (value == null) {
    return { ok: true, value: defaultValue };
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return {
      ok: false,
      diagnostic: createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.INVALID_CAPACITY,
        message: "capacityUnits must be a safe integer greater than zero",
        path,
        details: { capacityUnits: value },
      }),
    };
  }
  return { ok: true, value };
}
