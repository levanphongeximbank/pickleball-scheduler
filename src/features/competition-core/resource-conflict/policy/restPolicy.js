/**
 * CORE-14 Phase 1D — rest policy helpers.
 * Rest evaluation applies only to PLAYER and TEAM.
 */

import { RESOURCE_KIND } from "../enums/resourceKind.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { isResourceKind } from "../enums/resourceKind.js";

export const REST_POLICY_VERSION = "core14-rest-policy-v1";

export const REST_MODE = Object.freeze({
  MANDATORY: "MANDATORY",
  PREFERRED: "PREFERRED",
});

export const REST_MODE_VALUES = Object.freeze([REST_MODE.MANDATORY, REST_MODE.PREFERRED]);

const REST_MODE_SET = new Set(REST_MODE_VALUES);

export const DEFAULT_REST_RESOURCE_KINDS = Object.freeze([
  RESOURCE_KIND.PLAYER,
  RESOURCE_KIND.TEAM,
]);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isRestMode(value) {
  return typeof value === "string" && REST_MODE_SET.has(value);
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>|null} [details]
 */
function diagnostic(code, message, details = null) {
  return Object.freeze({
    code,
    message,
    path: null,
    resourceKey: null,
    occupancyId: null,
    assignmentId: null,
    details: details ? Object.freeze({ ...details }) : null,
  });
}

/**
 * Normalize rest policy. Null/undefined means rest detection disabled.
 *
 * @param {unknown} raw
 * @returns {{
 *   ok: true,
 *   value: null | {
 *     restMode: string,
 *     minimumRestMs: number,
 *     applicableResourceKinds: readonly string[],
 *     policyVersion: string,
 *   }
 * } | { ok: false, diagnostics: object[] }}
 */
export function normalizeRestPolicy(raw) {
  if (raw == null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE, "restPolicy must be an object or null", {
          valueType: Array.isArray(raw) ? "array" : typeof raw,
          reason: "INVALID_REST_POLICY",
        }),
      ],
    };
  }

  const policy = /** @type {Record<string, unknown>} */ (raw);
  const diagnostics = [];

  if (!isRestMode(policy.restMode)) {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE, "restMode must be MANDATORY or PREFERRED", {
        restMode: policy.restMode ?? null,
        reason: "INVALID_REST_MODE",
      })
    );
  }

  const minimumRestMs = policy.minimumRestMs;
  if (
    typeof minimumRestMs !== "number" ||
    !Number.isSafeInteger(minimumRestMs) ||
    minimumRestMs < 0
  ) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.INVALID_TIME_INTERVAL,
        "minimumRestMs must be a safe integer greater than or equal to zero",
        { minimumRestMs: minimumRestMs ?? null }
      )
    );
  }

  let applicableResourceKinds = DEFAULT_REST_RESOURCE_KINDS;
  if (policy.applicableResourceKinds != null) {
    if (!Array.isArray(policy.applicableResourceKinds)) {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          "applicableResourceKinds must be an array when supplied",
          { reason: "INVALID_REST_RESOURCE_KINDS" }
        )
      );
    } else {
      const kinds = [];
      for (const kind of policy.applicableResourceKinds) {
        if (!isResourceKind(kind)) {
          diagnostics.push(
            diagnostic(INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE, "Unknown rest applicable resourceKind", {
              resourceKind: kind ?? null,
            })
          );
        } else if (kind !== RESOURCE_KIND.PLAYER && kind !== RESOURCE_KIND.TEAM) {
          diagnostics.push(
            diagnostic(
              INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
              "Rest detection applies only to PLAYER and TEAM",
              { resourceKind: kind, reason: "REST_KIND_NOT_SUPPORTED" }
            )
          );
        } else {
          kinds.push(kind);
        }
      }
      applicableResourceKinds = Object.freeze([...new Set(kinds)]);
    }
  }

  const policyVersion =
    typeof policy.policyVersion === "string" && policy.policyVersion.length > 0
      ? policy.policyVersion
      : REST_POLICY_VERSION;

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    value: Object.freeze({
      restMode: /** @type {string} */ (policy.restMode),
      minimumRestMs: /** @type {number} */ (minimumRestMs),
      applicableResourceKinds,
      policyVersion,
    }),
  };
}
