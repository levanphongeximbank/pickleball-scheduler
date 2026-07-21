/**
 * CORE-09 — read-only MatchGenerationRulePort.
 * Resolves EvaluatedMatchGenerationRules once; does not implement a Rule Engine.
 * Fixed double validates strategy on raw input BEFORE factory normalization.
 */

import { createEvaluatedMatchGenerationRules } from "../contracts/evaluatedMatchGenerationRules.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { MATCH_GENERATION_ISSUE_SEVERITY } from "../enums/issueSeverity.js";
import { resolveSupportedStrategy } from "../enums/matchGenerationStrategy.js";
import { RULE_OPERATION } from "../../constraints/operations/ruleOperations.js";
import {
  isMatchGenerationContractError,
} from "../errors/contractError.js";
import { isMatchGenerationIssueCode } from "../errors/matchGenerationIssueCodes.js";

export const MATCH_GENERATION_RULE_PORT_METHODS = Object.freeze([
  "resolveEvaluatedRules",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesMatchGenerationRulePort(port) {
  return Boolean(
    port &&
      typeof port === "object" &&
      typeof /** @type {{ resolveEvaluatedRules?: unknown }} */ (port)
        .resolveEvaluatedRules === "function"
  );
}

/**
 * Fail-closed port double (test/support only — not a production fallback).
 */
export function createFailClosedMatchGenerationRulePort() {
  return {
    async resolveEvaluatedRules(request) {
      return Object.freeze({
        ok: false,
        evaluatedRules: null,
        issues: Object.freeze([
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISSING,
            severity: MATCH_GENERATION_ISSUE_SEVERITY.ERROR,
            path: "evaluatedRules",
            message: "MatchGenerationRulePort denied: fail-closed double",
            details: { ruleSetId: request?.ruleSetId ?? null },
          }),
        ]),
      });
    },
  };
}

/**
 * In-memory read-only double for contract tests (test/support only).
 * Stores raw rules; validates strategy before createEvaluatedMatchGenerationRules.
 *
 * @param {object} rules
 */
export function createFixedMatchGenerationRulePort(rules) {
  const raw =
    rules && typeof rules === "object" && !Array.isArray(rules)
      ? { ...rules }
      : {};

  return {
    async resolveEvaluatedRules(request) {
      /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
      const issues = [];

      const strategyCheck = resolveSupportedStrategy(
        request?.strategy || raw.generationStrategy
      );
      if (!strategyCheck.ok) {
        issues.push(
          createMatchGenerationIssue({
            code:
              strategyCheck.reason === "STRATEGY_DEFERRED"
                ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_DEFERRED
                : strategyCheck.reason === "STRATEGY_REQUIRED"
                  ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_REQUIRED
                  : MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED,
            path: "generationStrategy",
            message: `Unsupported or deferred strategy: ${
              request?.strategy || raw.generationStrategy
            }`,
            details: { reason: strategyCheck.reason },
          })
        );
        return Object.freeze({
          ok: false,
          evaluatedRules: null,
          issues: Object.freeze(issues),
        });
      }

      if (
        request?.ruleEvaluationFingerprint &&
        raw.ruleEvaluationFingerprint &&
        String(request.ruleEvaluationFingerprint).trim() !==
          String(raw.ruleEvaluationFingerprint).trim()
      ) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISMATCH,
            path: "evaluatedRuleReference.ruleEvaluationFingerprint",
            message: "Rule evaluation fingerprint does not match request",
            details: {
              requested: request.ruleEvaluationFingerprint,
              actual: raw.ruleEvaluationFingerprint,
            },
          })
        );
      }

      if (!String(raw.ruleEvaluationFingerprint || "").trim()) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISSING,
            path: "ruleEvaluationFingerprint",
            message: "Rule evaluation fingerprint is required",
          })
        );
      }

      if (issues.length > 0) {
        return Object.freeze({
          ok: false,
          evaluatedRules: null,
          issues: Object.freeze(issues),
        });
      }

      try {
        const frozen = createEvaluatedMatchGenerationRules({
          ...raw,
          generationStrategy: strategyCheck.strategy,
        });
        if (frozen.operation !== RULE_OPERATION.MATCHUP) {
          return Object.freeze({
            ok: false,
            evaluatedRules: null,
            issues: Object.freeze([
              createMatchGenerationIssue({
                code: MATCH_GENERATION_ISSUE_CODE.INVALID_REQUEST,
                path: "operation",
                message: "Evaluated rules must bind CORE-01 MATCHUP operation",
                details: { operation: frozen.operation },
              }),
            ]),
          });
        }
        return Object.freeze({
          ok: true,
          evaluatedRules: frozen,
          issues: Object.freeze([]),
        });
      } catch (err) {
        if (isMatchGenerationContractError(err)) {
          return Object.freeze({
            ok: false,
            evaluatedRules: null,
            issues: Object.freeze([
              createMatchGenerationIssue({
                code: isMatchGenerationIssueCode(err.code)
                  ? err.code
                  : MATCH_GENERATION_ISSUE_CODE.INVALID_REQUEST,
                path: "evaluatedRules",
                message: err.message,
                details: err.details || {},
              }),
            ]),
          });
        }
        throw err;
      }
    },
  };
}
