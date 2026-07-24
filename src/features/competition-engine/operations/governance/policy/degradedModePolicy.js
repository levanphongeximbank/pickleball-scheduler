/**
 * Degraded-mode projection and continuation policy.
 * Distinguishes safe continue / read-only / retry / manual / hard-block.
 * Never converts errors into silent success.
 */

import {
  DEGRADED_CONTINUATION,
  DEPENDENCY_STATUS,
  ISSUE_SEVERITY,
  ISSUE_SOURCE_OWNER,
  RELIABILITY_ISSUE_CODE,
} from "../constants.js";
import { computeGovernanceFingerprint, deepFreeze } from "../fingerprint.js";

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function asObject(value) {
  return value && typeof value === "object"
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * @param {string} dependency
 * @param {string} status
 * @param {string} continuation
 * @param {string} severity
 * @param {string} message
 */
function depIssue(dependency, status, continuation, severity, message) {
  return Object.freeze({
    code:
      continuation === DEGRADED_CONTINUATION.HARD_BLOCK
        ? RELIABILITY_ISSUE_CODE.HARD_BLOCK
        : continuation === DEGRADED_CONTINUATION.CONTINUE_SAFE
          ? RELIABILITY_ISSUE_CODE.DEGRADED_SAFE_PARTIAL
          : RELIABILITY_ISSUE_CODE.DEPENDENCY_UNAVAILABLE,
    dependency,
    status,
    continuation,
    severity,
    message,
    sourceOwner: ISSUE_SOURCE_OWNER.E2E06,
  });
}

/**
 * @param {object} record
 * @param {object} [policyResult]
 */
export function buildDegradedModeProjection(record, policyResult = {}) {
  const r = asObject(record);
  const deps = asObject(r.dependencies);
  const signals = [];

  const matrix = [
    ["identity", DEGRADED_CONTINUATION.HARD_BLOCK, ISSUE_SEVERITY.CRITICAL],
    ["workflow", DEGRADED_CONTINUATION.HARD_BLOCK, ISSUE_SEVERITY.BLOCKING],
    ["audit", DEGRADED_CONTINUATION.HARD_BLOCK, ISSUE_SEVERITY.BLOCKING],
    ["replay", DEGRADED_CONTINUATION.RETRY_REQUIRED, ISSUE_SEVERITY.BLOCKING],
    [
      "recoveryCheckpoint",
      DEGRADED_CONTINUATION.MANUAL_INTERVENTION_REQUIRED,
      ISSUE_SEVERITY.BLOCKING,
    ],
    [
      "ratingSnapshot",
      DEGRADED_CONTINUATION.CONTINUE_SAFE,
      ISSUE_SEVERITY.WARNING,
    ],
    [
      "venueCourt",
      DEGRADED_CONTINUATION.READ_ONLY_FALLBACK,
      ISSUE_SEVERITY.WARNING,
    ],
    [
      "auditPersistence",
      DEGRADED_CONTINUATION.READ_ONLY_FALLBACK,
      ISSUE_SEVERITY.WARNING,
    ],
    [
      "publicProjection",
      DEGRADED_CONTINUATION.READ_ONLY_FALLBACK,
      ISSUE_SEVERITY.WARNING,
    ],
    [
      "importExport",
      DEGRADED_CONTINUATION.RETRY_REQUIRED,
      ISSUE_SEVERITY.WARNING,
    ],
  ];

  for (const [name, continuation, severity] of matrix) {
    const status = String(deps[name] || DEPENDENCY_STATUS.AVAILABLE);
    if (
      status === DEPENDENCY_STATUS.UNAVAILABLE ||
      status === DEPENDENCY_STATUS.PARTIAL
    ) {
      signals.push(
        depIssue(
          name,
          status,
          continuation,
          severity,
          `Dependency ${name} is ${status}`
        )
      );
    }
  }

  if (asObject(r.publication).partialEvidence === true) {
    signals.push(
      depIssue(
        "publicationEvidence",
        DEPENDENCY_STATUS.PARTIAL,
        DEGRADED_CONTINUATION.READ_ONLY_FALLBACK,
        ISSUE_SEVERITY.WARNING,
        "Partial publication evidence present"
      )
    );
  }

  const hardBlocked = signals.some(
    (s) => s.continuation === DEGRADED_CONTINUATION.HARD_BLOCK
  );
  const manual = signals.some(
    (s) => s.continuation === DEGRADED_CONTINUATION.MANUAL_INTERVENTION_REQUIRED
  );
  const retry = signals.some(
    (s) => s.continuation === DEGRADED_CONTINUATION.RETRY_REQUIRED
  );
  const readOnly = signals.some(
    (s) => s.continuation === DEGRADED_CONTINUATION.READ_ONLY_FALLBACK
  );
  const continueSafe = signals.some(
    (s) => s.continuation === DEGRADED_CONTINUATION.CONTINUE_SAFE
  );

  let primaryContinuation = DEGRADED_CONTINUATION.CONTINUE_SAFE;
  if (hardBlocked) primaryContinuation = DEGRADED_CONTINUATION.HARD_BLOCK;
  else if (manual)
    primaryContinuation = DEGRADED_CONTINUATION.MANUAL_INTERVENTION_REQUIRED;
  else if (retry) primaryContinuation = DEGRADED_CONTINUATION.RETRY_REQUIRED;
  else if (readOnly)
    primaryContinuation = DEGRADED_CONTINUATION.READ_ONLY_FALLBACK;
  else if (continueSafe)
    primaryContinuation = DEGRADED_CONTINUATION.CONTINUE_SAFE;

  const active =
    signals.length > 0 ||
    policyResult.degraded === true ||
    policyResult.blocked === true;

  const fingerprint = computeGovernanceFingerprint(
    {
      active,
      primaryContinuation,
      signals: signals.map((s) => ({
        dependency: s.dependency,
        status: s.status,
        continuation: s.continuation,
      })),
    },
    "e2e06-degraded"
  );

  return deepFreeze({
    active,
    primaryContinuation,
    canContinueSafely:
      !hardBlocked &&
      primaryContinuation === DEGRADED_CONTINUATION.CONTINUE_SAFE,
    readOnlyFallback: primaryContinuation === DEGRADED_CONTINUATION.READ_ONLY_FALLBACK,
    retryRequired: primaryContinuation === DEGRADED_CONTINUATION.RETRY_REQUIRED,
    manualInterventionRequired:
      primaryContinuation ===
      DEGRADED_CONTINUATION.MANUAL_INTERVENTION_REQUIRED,
    hardBlocked,
    silentSuccessForbidden: true,
    signals,
    fingerprint,
  });
}
