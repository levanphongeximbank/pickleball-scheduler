/**
 * CORE-14 — CanonicalResourceKey validate + CORE14_CRK_V1 serialize.
 * Time is never part of the resource key. Identity strings are not silently transformed.
 */

import { CORE14_CRK_V1 } from "../constants/versions.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { isResourceKind } from "../enums/resourceKind.js";
import { SCOPE_TYPE, isScopeType } from "../enums/scopeType.js";
import { escapeCore14Token } from "../deterministic/escape.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 */
function diagnostic(code, message, details = null) {
  return Object.freeze({
    code,
    message,
    path: details && typeof details.path === "string" ? details.path : null,
    resourceKey: null,
    occupancyId: null,
    assignmentId: null,
    details: details ? Object.freeze({ ...details }) : null,
  });
}

/**
 * Non-empty string without silent trim/normalize.
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyIdentityString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * @param {unknown} input
 * @returns {{ ok: true, value: Readonly<{resourceKind:string,resourceId:string,scopeType:string,scopeId:string|null}> } | { ok: false, diagnostics: object[] }}
 */
export function validateCanonicalResourceKey(input) {
  const diagnostics = [];
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE, "CanonicalResourceKey must be an object")
    );
    return { ok: false, diagnostics };
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const resourceKind = raw.resourceKind;
  const resourceId = raw.resourceId;
  const scopeType = raw.scopeType;
  const scopeId = raw.scopeId === undefined ? null : raw.scopeId;

  if (!isResourceKind(resourceKind)) {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE, "Unknown or missing resourceKind", {
        resourceKind: resourceKind ?? null,
      })
    );
  }

  if (!isNonEmptyIdentityString(resourceId)) {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.RESOURCE_ID_MISSING, "resourceId must be a non-empty string", {
        resourceId: resourceId ?? null,
      })
    );
  }

  if (!isScopeType(scopeType)) {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING, "Unknown or missing scopeType", {
        scopeType: scopeType ?? null,
      })
    );
  } else if (scopeType === SCOPE_TYPE.GLOBAL) {
    if (scopeId != null) {
      diagnostics.push(
        diagnostic(INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING, "GLOBAL scope requires scopeId null or absent", {
          scopeId,
        })
      );
    }
  } else if (!isNonEmptyIdentityString(scopeId)) {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING, "Non-GLOBAL scope requires non-empty scopeId", {
        scopeType,
        scopeId: scopeId ?? null,
      })
    );
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  const value = Object.freeze({
    resourceKind: /** @type {string} */ (resourceKind),
    resourceId: /** @type {string} */ (resourceId),
    scopeType: /** @type {string} */ (scopeType),
    scopeId: scopeType === SCOPE_TYPE.GLOBAL ? null : /** @type {string} */ (scopeId),
  });
  return { ok: true, value };
}

/**
 * @param {unknown} input
 * @returns {Readonly<{resourceKind:string,resourceId:string,scopeType:string,scopeId:string|null}>}
 */
export function createCanonicalResourceKey(input) {
  const result = validateCanonicalResourceKey(input);
  if (!result.ok) {
    const first = result.diagnostics[0];
    throw new ResourceConflictContractError(first.code, first.message, {
      diagnostics: result.diagnostics,
    });
  }
  return result.value;
}

/**
 * CORE14_CRK_V1 deterministic serialization.
 * @param {{ resourceKind: string, resourceId: string, scopeType: string, scopeId: string | null }} key
 * @returns {string}
 */
export function serializeCanonicalResourceKey(key) {
  const validated = validateCanonicalResourceKey(key);
  if (!validated.ok) {
    const first = validated.diagnostics[0];
    throw new ResourceConflictContractError(first.code, first.message, {
      diagnostics: validated.diagnostics,
    });
  }
  const k = validated.value;
  const sid = k.scopeId === null ? "null" : escapeCore14Token(k.scopeId);
  return (
    `${CORE14_CRK_V1}` +
    `|k=${escapeCore14Token(k.resourceKind)}` +
    `|i=${escapeCore14Token(k.resourceId)}` +
    `|st=${escapeCore14Token(k.scopeType)}` +
    `|sid=${sid}`
  );
}

/**
 * Adapter EVENT identity check: if both eventId and scopeId supplied, must match exactly.
 * @param {unknown} scopeId
 * @param {unknown} adapterEventId
 * @returns {{ ok: true } | { ok: false, diagnostic: object }}
 */
export function validateEventScopeIdentity(scopeId, adapterEventId) {
  if (adapterEventId == null || adapterEventId === undefined) {
    return { ok: true };
  }
  if (typeof adapterEventId !== "string" || adapterEventId.length === 0) {
    return {
      ok: false,
      diagnostic: diagnostic(
        INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING,
        "adapter eventId must be a non-empty string when supplied",
        { adapterEventId }
      ),
    };
  }
  if (typeof scopeId !== "string" || scopeId.length === 0) {
    return {
      ok: false,
      diagnostic: diagnostic(
        INPUT_DIAGNOSTIC_CODE.SCOPE_MISSING,
        "EVENT scopeId required when validating adapter eventId",
        { scopeId: scopeId ?? null, adapterEventId }
      ),
    };
  }
  if (scopeId !== adapterEventId) {
    return {
      ok: false,
      diagnostic: diagnostic(
        INPUT_DIAGNOSTIC_CODE.SCOPE_IDENTITY_MISMATCH,
        "adapter eventId must exactly match EVENT scopeId",
        { scopeId, adapterEventId }
      ),
    };
  }
  return { ok: true };
}

/**
 * @param {{ resourceKind: string, resourceId: string, scopeType: string, scopeId: string | null }} a
 * @param {{ resourceKind: string, resourceId: string, scopeType: string, scopeId: string | null }} b
 * @returns {number}
 */
export function compareCanonicalResourceKeys(a, b) {
  return compareUtf8Bytewise(serializeCanonicalResourceKey(a), serializeCanonicalResourceKey(b));
}
