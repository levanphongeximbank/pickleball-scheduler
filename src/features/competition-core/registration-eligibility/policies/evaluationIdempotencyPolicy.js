import { createRegistrationIdempotencyRecord } from "../contracts/idempotency.js";
import { buildRegistrationTargetStableIdentity } from "../contracts/registrationTarget.js";
import {
  ELIGIBILITY_EVALUATOR_VERSION,
  isNonEmptyString,
} from "../contracts/shared.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  registrationEligibilityError,
  registrationEligibilityFail,
  registrationEligibilityOk,
} from "../errors/registrationEligibilityError.js";

/** Namespaced prefix — never reuse registration submission idempotency keys. */
export const EVALUATION_IDEMPOTENCY_KEY_PREFIX = "EVAL_IDEMP";

/**
 * @typedef {Object} CanonicalEvaluationRequestParts
 * @property {string} registrationId
 * @property {string} competitionId
 * @property {string|null} [divisionId]
 * @property {import('../contracts/registrationTarget.js').RegistrationTarget} target
 * @property {string} [evaluatorVersion]
 * @property {string|null} [ruleSetId]
 * @property {string|null} [ruleSetVersion]
 * @property {string|null} [policyId]
 * @property {string|null} [policyVersion]
 * @property {string[]} [requiredCheckTypes]
 * @property {Record<string, unknown>|null} [evaluationOptions]
 */

/**
 * @typedef {Object} CanonicalEvaluationRequestFingerprint
 * @property {string} registrationId
 * @property {string} competitionId
 * @property {string|null} divisionId
 * @property {string} targetStableIdentity
 * @property {string} evaluatorVersion
 * @property {string|null} ruleSetId
 * @property {string|null} ruleSetVersion
 * @property {string|null} policyId
 * @property {string|null} policyVersion
 * @property {string[]} requiredCheckTypes
 * @property {Record<string, unknown>|null} evaluationOptions
 */

/**
 * @param {string} evaluationRequestId
 * @returns {string}
 */
export function buildEvaluationIdempotencyKey(evaluationRequestId) {
  if (!isNonEmptyString(evaluationRequestId)) {
    throw new TypeError("evaluationRequestId is required");
  }
  return `${EVALUATION_IDEMPOTENCY_KEY_PREFIX}::${String(evaluationRequestId).trim()}`;
}

/**
 * Deterministic JSON for nested objects (sorted keys). Excludes volatile fields.
 * @param {unknown} value
 * @returns {unknown}
 */
function canonicalizeJsonValue(value) {
  if (value === null || typeof value !== "object") {
    return value ?? null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item));
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of Object.keys(/** @type {Record<string, unknown>} */ (value)).sort()) {
    out[key] = canonicalizeJsonValue(/** @type {Record<string, unknown>} */ (value)[key]);
  }
  return out;
}

/**
 * Build an immutable canonical evaluation-request fingerprint.
 * Does not include evaluatedAt, async completion order, or actor/correlation ids.
 *
 * @param {CanonicalEvaluationRequestParts} parts
 * @returns {CanonicalEvaluationRequestFingerprint}
 */
export function buildCanonicalEvaluationRequestFingerprint(parts) {
  if (!isNonEmptyString(parts?.registrationId)) {
    throw new TypeError("canonical fingerprint requires registrationId");
  }
  if (!isNonEmptyString(parts?.competitionId)) {
    throw new TypeError("canonical fingerprint requires competitionId");
  }
  if (!parts?.target) {
    throw new TypeError("canonical fingerprint requires target");
  }

  const requiredCheckTypes = Array.isArray(parts.requiredCheckTypes)
    ? [...parts.requiredCheckTypes].map((t) => String(t)).sort()
    : [];

  const evaluationOptions =
    parts.evaluationOptions &&
    typeof parts.evaluationOptions === "object" &&
    !Array.isArray(parts.evaluationOptions)
      ? /** @type {Record<string, unknown>} */ (canonicalizeJsonValue(parts.evaluationOptions))
      : null;

  return Object.freeze({
    registrationId: String(parts.registrationId).trim(),
    competitionId: String(parts.competitionId).trim(),
    divisionId:
      parts.divisionId != null && String(parts.divisionId).trim() !== ""
        ? String(parts.divisionId).trim()
        : null,
    targetStableIdentity: buildRegistrationTargetStableIdentity(parts.target),
    evaluatorVersion: String(parts.evaluatorVersion || ELIGIBILITY_EVALUATOR_VERSION),
    ruleSetId:
      parts.ruleSetId != null && String(parts.ruleSetId).trim() !== ""
        ? String(parts.ruleSetId).trim()
        : null,
    ruleSetVersion:
      parts.ruleSetVersion != null && String(parts.ruleSetVersion).trim() !== ""
        ? String(parts.ruleSetVersion).trim()
        : null,
    policyId:
      parts.policyId != null && String(parts.policyId).trim() !== ""
        ? String(parts.policyId).trim()
        : null,
    policyVersion:
      parts.policyVersion != null && String(parts.policyVersion).trim() !== ""
        ? String(parts.policyVersion).trim()
        : null,
    requiredCheckTypes,
    evaluationOptions,
  });
}

/**
 * Stable string form for equality comparison.
 * @param {CanonicalEvaluationRequestFingerprint|Record<string, unknown>} fingerprint
 * @returns {string}
 */
export function serializeCanonicalEvaluationRequestFingerprint(fingerprint) {
  return JSON.stringify(canonicalizeJsonValue(fingerprint));
}

/**
 * @param {CanonicalEvaluationRequestFingerprint} a
 * @param {CanonicalEvaluationRequestFingerprint|Record<string, unknown>|null|undefined} b
 * @returns {boolean}
 */
export function canonicalEvaluationFingerprintsEqual(a, b) {
  if (!b || typeof b !== "object") return false;
  return (
    serializeCanonicalEvaluationRequestFingerprint(a) ===
    serializeCanonicalEvaluationRequestFingerprint(
      /** @type {CanonicalEvaluationRequestFingerprint} */ (b)
    )
  );
}

/**
 * @typedef {Object} EvaluationReplayPayload
 * @property {'ELIGIBILITY_EVALUATION_REPLAY'} kind
 * @property {CanonicalEvaluationRequestFingerprint} canonicalFingerprint
 * @property {string} registrationId
 * @property {string} decisionId
 * @property {string} outcome
 * @property {string} evidenceId
 * @property {string|null} auditEventId
 * @property {string[]} summaryReasonCodes
 * @property {string} evaluatorVersion
 * @property {string} evaluatedAt
 * @property {import('../contracts/eligibility.js').EligibilityCheckResult[]} checkResults
 * @property {import('../contracts/eligibilityEvaluationEvidence.js').EligibilityEvaluationEvidence} evidence
 * @property {import('../contracts/eligibility.js').EligibilityDecision} decision
 */

/**
 * Compare a new evaluation request against an existing evaluation idempotency record.
 * Same evaluationRequestId + same canonical fingerprint → HIT.
 * Same evaluationRequestId + different fingerprint → CONFLICT.
 *
 * @param {{
 *   evaluationRequestId: string,
 *   registrationId: string,
 *   canonicalFingerprint: CanonicalEvaluationRequestFingerprint,
 * }} request
 * @param {import('../contracts/idempotency.js').RegistrationIdempotencyRecord|null|undefined} existing
 * @returns {import('../errors/registrationEligibilityError.js').RegistrationEligibilityResult}
 */
export function evaluateIdempotentEvaluation(request, existing) {
  if (!isNonEmptyString(request?.evaluationRequestId)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "evaluationRequestId",
        "evaluationRequestId is required for duplicate-safe evaluation"
      ),
    ]);
  }
  if (!isNonEmptyString(request?.registrationId)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "registrationId",
        "registrationId is required"
      ),
    ]);
  }
  if (!request?.canonicalFingerprint || typeof request.canonicalFingerprint !== "object") {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
        "canonicalFingerprint",
        "canonical evaluation fingerprint is required"
      ),
    ]);
  }

  if (!existing) {
    return registrationEligibilityOk({
      kind: "MISS",
      replay: null,
      evaluationRequestId: String(request.evaluationRequestId).trim(),
    });
  }

  const fingerprint = existing.requestFingerprint;
  const replay =
    fingerprint &&
    typeof fingerprint === "object" &&
    /** @type {{ kind?: string }} */ (fingerprint).kind === "ELIGIBILITY_EVALUATION_REPLAY"
      ? /** @type {EvaluationReplayPayload} */ (fingerprint)
      : null;

  if (!replay) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT,
        "evaluationRequestId",
        "Evaluation request id is bound to a non-evaluation idempotency record",
        { evaluationRequestId: request.evaluationRequestId }
      ),
    ]);
  }

  const storedFingerprint =
    replay.canonicalFingerprint ||
    /** @type {{ canonicalFingerprint?: CanonicalEvaluationRequestFingerprint }} */ (
      fingerprint
    ).canonicalFingerprint;

  if (!canonicalEvaluationFingerprintsEqual(request.canonicalFingerprint, storedFingerprint)) {
    return registrationEligibilityFail([
      registrationEligibilityError(
        REGISTRATION_ELIGIBILITY_ERROR_CODE.IDEMPOTENCY_CONFLICT,
        "evaluationRequestId",
        "Evaluation request id already bound to a different canonical evaluation request",
        {
          evaluationRequestId: request.evaluationRequestId,
          existingRegistrationId: storedFingerprint?.registrationId ?? replay.registrationId,
          registrationId: String(request.registrationId).trim(),
        }
      ),
    ]);
  }

  return registrationEligibilityOk({
    kind: "HIT",
    replay,
    evaluationRequestId: String(request.evaluationRequestId).trim(),
  });
}

/**
 * @param {{
 *   evaluationRequestId: string,
 *   registrationId: string,
 *   createdAt: string,
 *   replay: EvaluationReplayPayload,
 * }} input
 * @returns {import('../contracts/idempotency.js').RegistrationIdempotencyRecord}
 */
export function createIdempotencyRecordForEvaluation(input) {
  const idempotencyKey = buildEvaluationIdempotencyKey(input.evaluationRequestId);
  return createRegistrationIdempotencyRecord({
    idempotencyKey,
    registrationId: input.registrationId,
    registrationRequestId: `eval::${input.evaluationRequestId}`,
    competitionId: input.replay.canonicalFingerprint.competitionId,
    divisionId: input.replay.canonicalFingerprint.divisionId,
    targetType: "EVALUATION",
    targetStableIdentity: input.replay.canonicalFingerprint.targetStableIdentity,
    createdAt: input.createdAt,
    requestFingerprint: input.replay,
  });
}
