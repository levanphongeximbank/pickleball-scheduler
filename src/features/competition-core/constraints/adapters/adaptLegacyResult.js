/**
 * Adapt canonical evaluation results back to legacy consumer shapes.
 */

import { RULE_ERROR_CODE } from "../ruleConstants.js";

/** @typedef {{ message: string, reasonCode?: string }} ValidationDetail */

/**
 * @param {string} message
 * @returns {string}
 */
function normalizeValidationMessageKey(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heuristic dedupe between legacy Vietnamese messages and canonical reason codes.
 *
 * @param {string} legacyMessage
 * @param {string} [reasonCode]
 * @returns {boolean}
 */
function legacyMessageMatchesReasonCode(legacyMessage, reasonCode) {
  const message = normalizeValidationMessageKey(legacyMessage);
  if (!message || !reasonCode) {
    return false;
  }

  const patterns = {
    [RULE_ERROR_CODE.GENDER_ELIGIBILITY_VIOLATED]: /(nam|nu|nữ|mixed|doi|đôi|vdv)/,
    [RULE_ERROR_CODE.MIXED_TEAM_COMPOSITION_VIOLATED]: /(nam nu|nữ|mixed|doi nam nu)/,
    [RULE_ERROR_CODE.ENTRY_ELIGIBILITY_VIOLATED]: /(nhieu doi|nhiều đội|duplicate|ton tai|tồn tại)/,
    [RULE_ERROR_CODE.LINEUP_VALIDITY_VIOLATED]: /(can \d+ vdv|cần \d+ vđv|playerIds)/,
    [RULE_ERROR_CODE.SKILL_CAP_EXCEEDED]: /(rating|trinh do|trình độ|skill)/,
    [RULE_ERROR_CODE.CHECKIN_REQUIRED_MISSING]: /(check-in|check in|chua check|chưa check)/,
    [RULE_ERROR_CODE.PLAYER_BUSY]: /(dang choi|đang chơi|busy|playing)/,
  };

  const pattern = patterns[reasonCode];
  return pattern ? pattern.test(message) : false;
}

/**
 * Merge legacy validation output with canonical adapter output without duplicate errors.
 *
 * @param {{ ok?: boolean, errors?: string[], warnings?: string[], errorDetails?: ValidationDetail[], warningDetails?: ValidationDetail[] }} legacy
 * @param {{ ok?: boolean, errors?: string[], warnings?: string[], errorDetails?: ValidationDetail[], warningDetails?: ValidationDetail[] }} canonical
 * @param {{ decisionTrace?: import('./decisionTrace.js').DecisionTrace }} [options]
 */
export function mergeValidationResults(legacy, canonical, options = {}) {
  const errors = [...(legacy.errors || [])];
  const warnings = [...(legacy.warnings || [])];
  const errorDetails = [...(legacy.errorDetails || [])];
  const warningDetails = [...(legacy.warningDetails || [])];

  (canonical.errorDetails || []).forEach((detail) => {
    const message = detail?.message;
    const reasonCode = detail?.reasonCode;
    if (!message) {
      return;
    }

    const duplicate = errors.some(
      (legacyMessage) =>
        normalizeValidationMessageKey(legacyMessage) === normalizeValidationMessageKey(message) ||
        legacyMessageMatchesReasonCode(legacyMessage, reasonCode)
    );

    if (!duplicate) {
      errors.push(message);
      errorDetails.push({ message, reasonCode });
    }
  });

  (canonical.warningDetails || []).forEach((detail) => {
    const message = detail?.message;
    if (!message) {
      return;
    }
    const duplicate = warnings.some(
      (legacyMessage) => normalizeValidationMessageKey(legacyMessage) === normalizeValidationMessageKey(message)
    );
    if (!duplicate) {
      warnings.push(message);
      warningDetails.push(detail);
    }
  });

  const result = {
    ok: errors.length === 0,
    errors,
    warnings,
  };

  if (errorDetails.length) {
    result.errorDetails = errorDetails;
  }
  if (warningDetails.length) {
    result.warningDetails = warningDetails;
  }
  if (options.decisionTrace) {
    result.decisionTrace = options.decisionTrace;
  }

  return result;
}

/**
 * pairing-constraints evaluator shape.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @returns {{ score: number, violations: Array<Record<string, unknown>>, satisfied: unknown[], hardViolations: Array<Record<string, unknown>>, ok: boolean }}
 */
export function toPairingConstraintEvaluation(canonical) {
  const violations = (canonical.hardViolations || []).map((item) => ({
    constraint: item.details?.constraintId ? { id: item.details.constraintId } : undefined,
    message: item.message,
    code: item.reasonCode,
    soft: false,
  }));

  const softNotes = (canonical.softNotes || []).map((item) => ({
    constraint: item.details?.constraintId ? { id: item.details.constraintId } : undefined,
    message: item.message,
    code: item.reasonCode,
    soft: true,
  }));

  const allViolations = [...violations, ...softNotes];

  return {
    score: Number(canonical.softScore ?? 0),
    violations: allViolations,
    satisfied: [],
    hardViolations: violations,
    ok: canonical.feasible !== false,
  };
}

/**
 * AI scoring adjustment — preserve legacy score envelope when feasible.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @param {number} [baseScore]
 * @returns {{ rejected: boolean, totalScore: number, canonicalSoftDelta: number, policyScore: number, ruleScore: number }}
 */
export function toAiScoreBridgeResult(canonical, baseScore = 0) {
  if (!canonical.feasible) {
    return {
      rejected: true,
      totalScore: -100,
      canonicalSoftDelta: 0,
      policyScore: 0,
      ruleScore: 0,
    };
  }

  const softDelta = Number(canonical.softScore ?? 0);
  return {
    rejected: false,
    totalScore: baseScore + softDelta,
    canonicalSoftDelta: softDelta,
    policyScore: softDelta,
    ruleScore: 0,
  };
}

/**
 * Tournament validation adapter shape.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function toValidationResult(canonical) {
  const errorDetails = (canonical.hardViolations || [])
    .map((item) => ({
      message: item.message,
      reasonCode: item.reasonCode || item.code,
    }))
    .filter((item) => item.message);

  const warningDetails = (canonical.softNotes || [])
    .map((item) => ({
      message: item.message,
      reasonCode: item.reasonCode || item.code,
    }))
    .filter((item) => item.message);

  const errors = errorDetails.map((item) => item.message);
  const warnings = warningDetails.map((item) => item.message);

  if (!canonical.eligible) {
    const message = "Entry eligibility failed.";
    errors.push(message);
    errorDetails.push({ message, reasonCode: RULE_ERROR_CODE.ENTRY_ELIGIBILITY_VIOLATED });
  }

  return {
    ok: canonical.feasible !== false && canonical.eligible !== false && errors.length === 0,
    errors,
    warnings,
    errorDetails,
    warningDetails,
  };
}

/**
 * Court Engine queue gate adapter.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @returns {{ ok: boolean, error?: string, errors?: string[] }}
 */
export function toCourtQueueGateResult(canonical) {
  if (!canonical.feasible) {
    const violation = (canonical.hardViolations || [])[0];
    const code = violation?.reasonCode || violation?.code;
    const fallbackByCode = {
      [RULE_ERROR_CODE.CHECKIN_REQUIRED_MISSING]: "Người chơi chưa check-in.",
      [RULE_ERROR_CODE.PLAYER_BUSY]: "Người chơi đang chơi, không thể vào queue.",
    };
    const error = fallbackByCode[code] || violation?.message || "Không thể thêm vào queue.";
    return { ok: false, error, errors: [error] };
  }

  return { ok: true };
}

/**
 * Court Engine scoring adapter — soft delta only; hard reject handled separately.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @returns {{ ok: boolean, softScoreDelta: number, hardRejected: boolean }}
 */
export function toCourtEngineScoreBridgeResult(canonical) {
  if (!canonical.feasible) {
    return { ok: false, softScoreDelta: 0, hardRejected: true };
  }

  return {
    ok: true,
    softScoreDelta: Number(canonical.softScore ?? 0),
    hardRejected: false,
  };
}

/**
 * Daily Play eligibility adapter.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @param {string} playerId
 * @returns {boolean}
 */
export function isDailyPlayPlayerEligible(canonical, playerId) {
  if (!canonical.feasible || !canonical.eligible) {
    return false;
  }

  const blocked = (canonical.hardViolations || []).some((item) =>
    (item.affectedPlayers || []).includes(String(playerId))
  );
  return !blocked;
}
