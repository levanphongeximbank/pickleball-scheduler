/**
 * Core-01 Rule Engine → Core-03 RuleEvaluationPort adapter.
 *
 * Depends only on an injected Core-01 public facade (evaluateCanonicalRules shape).
 * Does not import Core-01 private modules and does not duplicate rule evaluation logic.
 */

import { ELIGIBILITY_CHECK_TYPE } from "../enums/eligibilityCheckType.js";
import { ELIGIBILITY_REASON_SEVERITY } from "../enums/eligibilityReasonSeverity.js";
import {
  createEligibilityCheckResult,
  createEligibilityReason,
  orderEligibilityReasons,
} from "../contracts/eligibility.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  CORE03_SIBLING_ADAPTER_NAME,
  CORE03_SIBLING_CAPABILITY,
  createSiblingAdapterMetadata,
  defensiveCopy,
  orderReasonCodes,
} from "./adapterMetadata.js";

export const RULE_EVALUATION_ADAPTER_CONTRACT_VERSION = "core01-evaluateCanonicalRules-v1";

/**
 * @typedef {Object} Core01RuleEngineFacade
 * @property {(ruleSet: unknown, context: unknown, options?: unknown) => unknown|Promise<unknown>} evaluateCanonicalRules
 */

/**
 * Map Core-03 operation / check type into a Core-01 rule-set evaluation request.
 * @param {import('../ports/ruleEvaluationPort.js').RuleEvaluationRequest} request
 * @returns {{ ruleSet: Record<string, unknown>, context: Record<string, unknown>, options: Record<string, unknown> }}
 */
export function mapCore03RequestToCore01RuleEvaluation(request) {
  const ruleSetId =
    request?.ruleSetId != null && String(request.ruleSetId).trim() !== ""
      ? String(request.ruleSetId).trim()
      : "competition-core-default";
  const ruleSetVersion =
    request?.ruleSetVersion != null && String(request.ruleSetVersion).trim() !== ""
      ? String(request.ruleSetVersion).trim()
      : "1";

  return {
    ruleSet: {
      id: ruleSetId,
      version: ruleSetVersion,
      constraints: Array.isArray(request?.context?.constraints)
        ? defensiveCopy(request.context.constraints)
        : [],
      status: request?.context?.ruleSetStatus ?? "ACTIVE",
    },
    context: {
      competitionId: request?.competitionId ?? null,
      operation: request?.operation ?? null,
      subject: defensiveCopy(request?.subject ?? null),
      divisionId: request?.context?.divisionId ?? null,
      formatHint: request?.context?.formatHint ?? null,
      teams: Array.isArray(request?.context?.teams) ? defensiveCopy(request.context.teams) : [],
      groups: Array.isArray(request?.context?.groups) ? defensiveCopy(request.context.groups) : [],
      matchOption: request?.context?.matchOption ?? null,
      entriesByPlayerId: request?.context?.entriesByPlayerId
        ? defensiveCopy(request.context.entriesByPlayerId)
        : undefined,
      playersById: request?.context?.playersById
        ? defensiveCopy(request.context.playersById)
        : undefined,
    },
    options: {
      skipConflictCheck: request?.context?.skipConflictCheck === true,
    },
  };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: boolean, accepted: boolean, reasonCodes: string[], ruleSetId: string|null, ruleSetVersion: string|null, engineVersion: string|null, eligible: boolean|null, feasible: boolean|null, outcomeHint: string, errorCode: string|null }}
 */
export function normalizeCore01RuleResult(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      accepted: false,
      reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE],
      ruleSetId: null,
      ruleSetVersion: null,
      engineVersion: null,
      eligible: null,
      feasible: null,
      outcomeHint: "FAIL_CLOSED",
      errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE,
    };
  }

  const hardViolations = Array.isArray(raw.hardViolations) ? raw.hardViolations : [];
  const softNotes = Array.isArray(raw.softNotes) ? raw.softNotes : [];
  const validationErrors =
    raw.validation && typeof raw.validation === "object" && Array.isArray(raw.validation.errors)
      ? raw.validation.errors
      : [];

  /** @type {string[]} */
  const reasonCodes = [];
  for (const item of hardViolations) {
    const code =
      (item && typeof item === "object" && (item.reasonCode || item.code || item.constraintType)) ||
      null;
    if (code) reasonCodes.push(String(code));
  }
  for (const item of validationErrors) {
    const code =
      (item && typeof item === "object" && (item.code || item.reasonCode)) || null;
    if (code) reasonCodes.push(String(code));
  }

  const feasible = typeof raw.feasible === "boolean" ? raw.feasible : null;
  const eligible = typeof raw.eligible === "boolean" ? raw.eligible : null;
  const validationOk =
    raw.validation && typeof raw.validation === "object" && typeof raw.validation.ok === "boolean"
      ? raw.validation.ok
      : null;

  const blocking =
    feasible === false ||
    eligible === false ||
    validationOk === false ||
    hardViolations.length > 0;

  const conditional =
    !blocking &&
    (softNotes.length > 0 ||
      (Array.isArray(raw.explanations) &&
        raw.explanations.some(
          (item) =>
            item &&
            typeof item === "object" &&
            String(item.severity || "").toUpperCase() === "SOFT"
        )));

  const manualReview =
    !blocking &&
    (raw.requiresManualReview === true ||
      reasonCodes.some((code) => String(code).includes("MANUAL_REVIEW")));

  let outcomeHint = "ELIGIBLE";
  if (blocking) outcomeHint = "BLOCKING";
  else if (manualReview) outcomeHint = "MANUAL_REVIEW";
  else if (conditional) outcomeHint = "CONDITIONAL";

  if (!blocking && reasonCodes.length === 0 && softNotes.length > 0) {
    for (const note of softNotes) {
      const code =
        (note && typeof note === "object" && (note.reasonCode || note.code)) || "SOFT_CONSTRAINT";
      reasonCodes.push(String(code));
    }
  }

  const accepted = !blocking && outcomeHint === "ELIGIBLE";

  return {
    ok: true,
    accepted,
    reasonCodes: orderReasonCodes(reasonCodes),
    ruleSetId:
      raw.ruleSetId != null && String(raw.ruleSetId).trim() !== ""
        ? String(raw.ruleSetId)
        : null,
    ruleSetVersion:
      raw.ruleSetVersion != null && String(raw.ruleSetVersion).trim() !== ""
        ? String(raw.ruleSetVersion)
        : null,
    engineVersion:
      raw.engineVersion != null && String(raw.engineVersion).trim() !== ""
        ? String(raw.engineVersion)
        : null,
    eligible,
    feasible,
    outcomeHint,
    errorCode: null,
  };
}

/**
 * Normalize into Core-03 EligibilityCheckResult + EligibilityReason models.
 * @param {ReturnType<typeof normalizeCore01RuleResult>} normalized
 * @param {{ checkType?: string, evaluatedAt?: string|null }} [options]
 */
export function toEligibilityCheckResultFromRuleNormalization(normalized, options = {}) {
  const checkType = options.checkType || ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT;
  const evaluatedAt = options.evaluatedAt ?? null;
  /** @type {import('../contracts/eligibility.js').EligibilityReason[]} */
  const reasons = [];

  if (!normalized.ok) {
    reasons.push(
      createEligibilityReason({
        code: normalized.errorCode || REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE,
        checkType,
        severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
        message: "Core-01 rule evaluation response was malformed or unavailable",
        details: { expected: "canonical rule result", actual: "malformed" },
      })
    );
  } else if (normalized.outcomeHint === "BLOCKING") {
    for (const code of normalized.reasonCodes) {
      reasons.push(
        createEligibilityReason({
          code,
          checkType,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: code,
          details: {
            ruleSetId: normalized.ruleSetId,
            ruleSetVersion: normalized.ruleSetVersion,
            engineVersion: normalized.engineVersion,
          },
        })
      );
    }
    if (reasons.length === 0) {
      reasons.push(
        createEligibilityReason({
          code: "RULE_EVALUATION_BLOCKED",
          checkType,
          severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
          message: "Core-01 rule evaluation blocked eligibility",
          details: {
            ruleSetId: normalized.ruleSetId,
            ruleSetVersion: normalized.ruleSetVersion,
          },
        })
      );
    }
  } else if (normalized.outcomeHint === "MANUAL_REVIEW") {
    reasons.push(
      createEligibilityReason({
        code: normalized.reasonCodes[0] || "RULE_MANUAL_REVIEW_REQUIRED",
        checkType,
        severity: ELIGIBILITY_REASON_SEVERITY.WARNING,
        message: "Core-01 rule evaluation requires manual review",
        details: {
          ruleSetId: normalized.ruleSetId,
          ruleSetVersion: normalized.ruleSetVersion,
        },
      })
    );
  } else if (normalized.outcomeHint === "CONDITIONAL") {
    for (const code of normalized.reasonCodes) {
      reasons.push(
        createEligibilityReason({
          code,
          checkType,
          severity: ELIGIBILITY_REASON_SEVERITY.WARNING,
          message: code,
          details: {
            ruleSetId: normalized.ruleSetId,
            ruleSetVersion: normalized.ruleSetVersion,
          },
        })
      );
    }
  }

  const passed =
    normalized.ok &&
    (normalized.outcomeHint === "ELIGIBLE" ||
      normalized.outcomeHint === "CONDITIONAL" ||
      normalized.outcomeHint === "MANUAL_REVIEW");

  return createEligibilityCheckResult({
    checkType,
    passed: normalized.outcomeHint === "BLOCKING" || !normalized.ok ? false : passed,
    evaluatedAt,
    ruleRef: normalized.ruleSetId,
    reasons: orderEligibilityReasons(reasons),
  });
}

/**
 * @param {{
 *   core01RuleEngine?: Core01RuleEngineFacade|null,
 *   clock?: { now: () => string }|null,
 * }} [dependencies]
 * @returns {import('../ports/ruleEvaluationPort.js').RuleEvaluationPort & {
 *   normalizeLastResult?: Function,
 *   getAdapterMetadata: Function,
 * }}
 */
export function createCore01RuleEvaluationAdapter(dependencies = {}) {
  const facade = dependencies.core01RuleEngine ?? null;
  const clock = dependencies.clock ?? null;

  return {
    getAdapterMetadata() {
      return createSiblingAdapterMetadata({
        adapterName: CORE03_SIBLING_ADAPTER_NAME.RULE_EVALUATION,
        siblingCapability: CORE03_SIBLING_CAPABILITY.CORE01_RULE_ENGINE,
        siblingContractVersion: RULE_EVALUATION_ADAPTER_CONTRACT_VERSION,
      });
    },

    async evaluateRules(request) {
      const evaluatedAt = clock && typeof clock.now === "function" ? String(clock.now()) : null;

      if (!facade || typeof facade.evaluateCanonicalRules !== "function") {
        return {
          accepted: false,
          reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_API_UNAVAILABLE],
          ruleSetVersion: request?.ruleSetVersion ?? null,
          traceRef: null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.RULE_EVALUATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE01_RULE_ENGINE,
            siblingContractVersion: RULE_EVALUATION_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: ["CORE01_FACADE_UNAVAILABLE"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromRuleNormalization(
            {
              ok: false,
              accepted: false,
              reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_API_UNAVAILABLE],
              ruleSetId: null,
              ruleSetVersion: null,
              engineVersion: null,
              eligible: null,
              feasible: null,
              outcomeHint: "FAIL_CLOSED",
              errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_API_UNAVAILABLE,
            },
            {
              checkType: request?.operation || ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT,
              evaluatedAt,
            }
          ),
        };
      }

      try {
        const mapped = mapCore03RequestToCore01RuleEvaluation(request);
        const raw = await facade.evaluateCanonicalRules(
          mapped.ruleSet,
          mapped.context,
          mapped.options
        );
        const normalized = normalizeCore01RuleResult(raw);

        if (!normalized.ok) {
          return {
            accepted: false,
            reasonCodes: normalized.reasonCodes,
            ruleSetVersion: request?.ruleSetVersion ?? null,
            traceRef: null,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.RULE_EVALUATION,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE01_RULE_ENGINE,
              siblingContractVersion: RULE_EVALUATION_ADAPTER_CONTRACT_VERSION,
              evaluatedAt,
              warnings: ["CORE01_MALFORMED_RESPONSE"],
            }),
            eligibilityCheckResult: toEligibilityCheckResultFromRuleNormalization(normalized, {
              checkType: request?.operation || ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT,
              evaluatedAt,
            }),
          };
        }

        // Port contract: accepted=false is treated as blocking by Core-03 executor.
        // CONDITIONAL / MANUAL_REVIEW remain non-blocking at the port boundary;
        // richer EligibilityCheckResult carries WARNING reasons.
        const portAccepted = normalized.ok && normalized.outcomeHint !== "BLOCKING";

        return {
          accepted: portAccepted,
          reasonCodes:
            normalized.outcomeHint === "BLOCKING" ? normalized.reasonCodes : orderReasonCodes([]),
          ruleSetVersion: normalized.ruleSetVersion ?? request?.ruleSetVersion ?? null,
          traceRef: normalized.engineVersion,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.RULE_EVALUATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE01_RULE_ENGINE,
            siblingContractVersion: RULE_EVALUATION_ADAPTER_CONTRACT_VERSION,
            siblingResultVersion: normalized.engineVersion,
            evaluatedAt,
            sourceIds: normalized.ruleSetId ? [normalized.ruleSetId] : [],
            warnings:
              normalized.outcomeHint === "CONDITIONAL" ||
              normalized.outcomeHint === "MANUAL_REVIEW"
                ? [normalized.outcomeHint]
                : [],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromRuleNormalization(normalized, {
            checkType: request?.operation || ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT,
            evaluatedAt,
          }),
          outcomeHint: normalized.outcomeHint,
        };
      } catch {
        return {
          accepted: false,
          reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED],
          ruleSetVersion: request?.ruleSetVersion ?? null,
          traceRef: null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.RULE_EVALUATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE01_RULE_ENGINE,
            siblingContractVersion: RULE_EVALUATION_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: ["CORE01_EXCEPTION"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromRuleNormalization(
            {
              ok: false,
              accepted: false,
              reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED],
              ruleSetId: null,
              ruleSetVersion: null,
              engineVersion: null,
              eligible: null,
              feasible: null,
              outcomeHint: "FAIL_CLOSED",
              errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED,
            },
            {
              checkType: request?.operation || ELIGIBILITY_CHECK_TYPE.RANKING_REQUIREMENT,
              evaluatedAt,
            }
          ),
        };
      }
    },
  };
}
