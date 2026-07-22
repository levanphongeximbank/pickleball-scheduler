/**
 * CORE-14 Phase 1E — immutable ResolutionPolicy V1.
 * Caller input is never mutated. No hidden defaults that expand mutation scope.
 */

import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { isSafeEpochMs, validateHalfOpenInterval } from "../time/interval.js";
import { deepFreezeClone, isPlainObject } from "../deterministic/serialize.js";
import {
  createCanonicalResourceKey,
  validateCanonicalResourceKey,
} from "../domain/CanonicalResourceKey.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";
import { isResolutionActionType } from "./actionTypes.js";

export const RESOLUTION_POLICY_VERSION = "core14-resolution-policy-v1";

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
 * @param {unknown} value
 * @returns {boolean}
 */
function isPositiveSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonNegativeSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Normalize / validate ResolutionPolicy V1 without mutating caller input.
 *
 * @param {unknown} input
 * @returns {{ ok: true, value: object } | { ok: false, diagnostics: object[] }}
 */
export function normalizeResolutionPolicy(input) {
  const diagnostics = [];
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
          "resolutionPolicy must be an object",
          { fieldName: "resolutionPolicy" }
        ),
      ],
    };
  }

  const raw = /** @type {Record<string, unknown>} */ (input);
  const policyVersion = raw.policyVersion;
  if (typeof policyVersion !== "string" || policyVersion.length === 0) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
        "policyVersion is required and non-empty",
        { fieldName: "policyVersion" }
      )
    );
  }

  if (!isPositiveSafeInteger(raw.maximumRecommendationCount)) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
        "maximumRecommendationCount must be a safe integer greater than zero",
        { maximumRecommendationCount: raw.maximumRecommendationCount ?? null }
      )
    );
  }

  if (!isPositiveSafeInteger(raw.maximumCandidatesPerConflict)) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
        "maximumCandidatesPerConflict must be a safe integer greater than zero",
        { maximumCandidatesPerConflict: raw.maximumCandidatesPerConflict ?? null }
      )
    );
  }

  if (!isPositiveSafeInteger(raw.maximumChangedAssignments)) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
        "maximumChangedAssignments must be a safe integer greater than zero",
        { maximumChangedAssignments: raw.maximumChangedAssignments ?? null }
      )
    );
  }

  if (!isNonNegativeSafeInteger(raw.maximumShiftMs)) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
        "maximumShiftMs must be a safe integer greater than or equal to zero",
        { maximumShiftMs: raw.maximumShiftMs ?? null }
      )
    );
  }

  const hasStart = raw.allowedEvaluationStartMs != null;
  const hasEnd = raw.allowedEvaluationEndMs != null;
  if (hasStart || hasEnd) {
    if (!isSafeEpochMs(raw.allowedEvaluationStartMs) || !isSafeEpochMs(raw.allowedEvaluationEndMs)) {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.INVALID_TIME_INTERVAL,
          "allowedEvaluationStartMs/EndMs must be safe-integer epoch milliseconds when supplied",
          {
            allowedEvaluationStartMs: raw.allowedEvaluationStartMs ?? null,
            allowedEvaluationEndMs: raw.allowedEvaluationEndMs ?? null,
          }
        )
      );
    } else if (
      /** @type {number} */ (raw.allowedEvaluationStartMs) >=
      /** @type {number} */ (raw.allowedEvaluationEndMs)
    ) {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.INVALID_TIME_INTERVAL,
          "allowedEvaluationStartMs must be less than allowedEvaluationEndMs",
          {
            allowedEvaluationStartMs: raw.allowedEvaluationStartMs,
            allowedEvaluationEndMs: raw.allowedEvaluationEndMs,
          }
        )
      );
    }
  }

  /** @type {string[]} */
  const allowedActionTypes = [];
  if (!Array.isArray(raw.allowedActionTypes)) {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
        "allowedActionTypes must be an array",
        { fieldName: "allowedActionTypes" }
      )
    );
  } else {
    for (const action of raw.allowedActionTypes) {
      if (!isResolutionActionType(action)) {
        diagnostics.push(
          diagnostic(
            INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
            "Unknown action type fails closed",
            { actionType: action ?? null }
          )
        );
      } else if (!allowedActionTypes.includes(/** @type {string} */ (action))) {
        allowedActionTypes.push(/** @type {string} */ (action));
      }
    }
  }

  /** @type {object[]} */
  const candidateTimeWindows = [];
  const rawWindows = Array.isArray(raw.candidateTimeWindows) ? raw.candidateTimeWindows : [];
  for (let i = 0; i < rawWindows.length; i += 1) {
    const w = rawWindows[i];
    if (w == null || typeof w !== "object" || Array.isArray(w)) {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.INVALID_TIME_INTERVAL,
          "candidate time window must be an object",
          { index: i }
        )
      );
      continue;
    }
    const interval = validateHalfOpenInterval(w.startMs, w.endMs);
    if (!interval.ok) {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.INVALID_TIME_INTERVAL,
          "candidate time windows must use canonical half-open intervals",
          { index: i, startMs: w.startMs ?? null, endMs: w.endMs ?? null }
        )
      );
      continue;
    }
    candidateTimeWindows.push(
      Object.freeze({ startMs: interval.startMs, endMs: interval.endMs })
    );
  }

  /** @type {object[]} */
  const candidateCourtResources = [];
  const rawCourts = Array.isArray(raw.candidateCourtResources) ? raw.candidateCourtResources : [];
  for (let i = 0; i < rawCourts.length; i += 1) {
    const keyResult = validateCanonicalResourceKey(rawCourts[i]);
    if (!keyResult.ok) {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE,
          "candidate court resources must use CanonicalResourceKey",
          { index: i, nested: keyResult.diagnostics }
        )
      );
      continue;
    }
    if (keyResult.value.resourceKind !== "COURT") {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE,
          "candidateCourtResources must have resourceKind COURT",
          { index: i, resourceKind: keyResult.value.resourceKind }
        )
      );
      continue;
    }
    candidateCourtResources.push(keyResult.value);
  }

  /** @type {object[]} */
  const candidateRefereeResources = [];
  const rawRefs = Array.isArray(raw.candidateRefereeResources)
    ? raw.candidateRefereeResources
    : [];
  for (let i = 0; i < rawRefs.length; i += 1) {
    const keyResult = validateCanonicalResourceKey(rawRefs[i]);
    if (!keyResult.ok) {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE,
          "candidate referee resources must use CanonicalResourceKey",
          { index: i, nested: keyResult.diagnostics }
        )
      );
      continue;
    }
    if (keyResult.value.resourceKind !== "REFEREE") {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.UNKNOWN_RESOURCE_TYPE,
          "candidateRefereeResources must have resourceKind REFEREE",
          { index: i, resourceKind: keyResult.value.resourceKind }
        )
      );
      continue;
    }
    candidateRefereeResources.push(keyResult.value);
  }

  /** @type {number[]} */
  const candidateCapacityValues = [];
  const rawCaps = Array.isArray(raw.candidateCapacityValues) ? raw.candidateCapacityValues : [];
  for (let i = 0; i < rawCaps.length; i += 1) {
    const cap = rawCaps[i];
    if (!isPositiveSafeInteger(cap)) {
      diagnostics.push(
        diagnostic(
          INPUT_DIAGNOSTIC_CODE.INVALID_CAPACITY,
          "candidate capacity values must be safe integers greater than zero",
          { index: i, capacity: cap ?? null }
        )
      );
      continue;
    }
    candidateCapacityValues.push(/** @type {number} */ (cap));
  }

  // Booleans: fail closed if present and non-boolean; defaults only for omission
  // and never expand mutation scope beyond false for lock/published.
  const allowTouchLocked = raw.allowTouchLocked === true;
  const allowTouchPublished = raw.allowTouchPublished === true;
  const allowCrossScopeResourceChange = raw.allowCrossScopeResourceChange === true;
  const requireManualApprovalForLocked =
    raw.requireManualApprovalForLocked === undefined
      ? true
      : raw.requireManualApprovalForLocked === true;
  const requireManualApprovalForPublished =
    raw.requireManualApprovalForPublished === undefined
      ? true
      : raw.requireManualApprovalForPublished === true;
  const automaticEligibilityEnabled = raw.automaticEligibilityEnabled === true;

  if (raw.allowTouchLocked != null && typeof raw.allowTouchLocked !== "boolean") {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID, "allowTouchLocked must be boolean", {
        fieldName: "allowTouchLocked",
      })
    );
  }
  if (raw.allowTouchPublished != null && typeof raw.allowTouchPublished !== "boolean") {
    diagnostics.push(
      diagnostic(
        INPUT_DIAGNOSTIC_CODE.OCCUPANCY_BOOLEAN_INVALID,
        "allowTouchPublished must be boolean",
        { fieldName: "allowTouchPublished" }
      )
    );
  }

  const metadata =
    raw.metadata == null
      ? null
      : isPlainObject(raw.metadata)
        ? /** @type {Record<string, unknown>} */ (deepFreezeClone({ ...raw.metadata }))
        : null;
  if (raw.metadata != null && !isPlainObject(raw.metadata)) {
    diagnostics.push(
      diagnostic(INPUT_DIAGNOSTIC_CODE.OCCUPANCY_METADATA_INVALID, "metadata must be plain object or null", {
        fieldName: "metadata",
      })
    );
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    value: Object.freeze({
      policyVersion: /** @type {string} */ (policyVersion),
      allowedActionTypes: Object.freeze([...allowedActionTypes]),
      maximumRecommendationCount: /** @type {number} */ (raw.maximumRecommendationCount),
      maximumCandidatesPerConflict: /** @type {number} */ (raw.maximumCandidatesPerConflict),
      maximumChangedAssignments: /** @type {number} */ (raw.maximumChangedAssignments),
      maximumShiftMs: /** @type {number} */ (raw.maximumShiftMs),
      allowedEvaluationStartMs: hasStart
        ? /** @type {number} */ (raw.allowedEvaluationStartMs)
        : null,
      allowedEvaluationEndMs: hasEnd
        ? /** @type {number} */ (raw.allowedEvaluationEndMs)
        : null,
      allowTouchLocked,
      allowTouchPublished,
      allowCrossScopeResourceChange,
      requireManualApprovalForLocked,
      requireManualApprovalForPublished,
      automaticEligibilityEnabled,
      candidateTimeWindows: Object.freeze(candidateTimeWindows),
      candidateCourtResources: Object.freeze(candidateCourtResources),
      candidateRefereeResources: Object.freeze(candidateRefereeResources),
      candidateCapacityValues: Object.freeze(candidateCapacityValues),
      metadata,
    }),
  };
}

/**
 * @param {unknown} input
 * @returns {object}
 */
export function createResolutionPolicy(input) {
  const result = normalizeResolutionPolicy(input);
  if (!result.ok) {
    const first = result.diagnostics[0];
    throw new ResourceConflictContractError(
      first?.code || INPUT_DIAGNOSTIC_CODE.UNSUPPORTED_CANONICAL_VALUE,
      first?.message || "Invalid resolution policy",
      { diagnostics: result.diagnostics }
    );
  }
  return result.value;
}

/**
 * Convenience factory that materializes CanonicalResourceKey copies for callers.
 * @param {object} key
 */
export function cloneResourceKey(key) {
  return createCanonicalResourceKey(key);
}
