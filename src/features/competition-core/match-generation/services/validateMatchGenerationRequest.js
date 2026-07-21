/**
 * CORE-09 — MatchGenerationRequest validation (fail-closed).
 */

import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { collectForbiddenFieldPaths } from "../contracts/forbiddenSchedulingFields.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { resolveSupportedStrategy } from "../enums/matchGenerationStrategy.js";
import { sortMatchGenerationIssues } from "./asciiCompare.js";

/**
 * @param {import('../contracts/matchGenerationRequest.js').MatchGenerationRequest|object|null|undefined} request
 * @returns {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]}
 */
export function validateMatchGenerationRequest(request) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];

  if (!request || typeof request !== "object") {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.INVALID_REQUEST,
        path: "",
        message: "MatchGenerationRequest must be an object",
      })
    );
    return sortMatchGenerationIssues(issues);
  }

  const required = [
    ["competitionId", request.competitionId],
    ["divisionId", request.divisionId],
    ["stageId", request.stageId],
    ["generatorVersion", request.generatorVersion],
    ["drawReference.drawId", request.drawReference?.drawId],
    ["drawReference.drawVersion", request.drawReference?.drawVersion],
    ["drawReference.drawFingerprint", request.drawReference?.drawFingerprint],
    [
      "evaluatedRuleReference.ruleEvaluationFingerprint",
      request.evaluatedRuleReference?.ruleEvaluationFingerprint,
    ],
    [
      "participantSnapshotReference.participantFingerprint",
      request.participantSnapshotReference?.participantFingerprint,
    ],
  ];

  for (const [path, raw] of required) {
    if (!String(raw || "").trim()) {
      let code = MATCH_GENERATION_ISSUE_CODE.INVALID_REQUEST;
      if (path.includes("drawFingerprint")) {
        code = MATCH_GENERATION_ISSUE_CODE.DRAW_FINGERPRINT_MISSING;
      } else if (path.includes("ruleEvaluationFingerprint")) {
        code = MATCH_GENERATION_ISSUE_CODE.RULE_FINGERPRINT_MISSING;
      } else if (path.includes("participantFingerprint")) {
        code = MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_FINGERPRINT_MISSING;
      } else if (path === "generatorVersion") {
        code = MATCH_GENERATION_ISSUE_CODE.GENERATOR_VERSION_REQUIRED;
      }
      issues.push(
        createMatchGenerationIssue({
          code,
          path,
          message: `${path} is required`,
        })
      );
    }
  }

  const strategyCheck = resolveSupportedStrategy(request.strategy);
  if (!strategyCheck.ok) {
    issues.push(
      createMatchGenerationIssue({
        code:
          strategyCheck.reason === "STRATEGY_DEFERRED"
            ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_DEFERRED
            : strategyCheck.reason === "STRATEGY_REQUIRED"
              ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_REQUIRED
              : MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED,
        path: "strategy",
        message: `Strategy is unsupported or deferred: ${request.strategy}`,
        details: { reason: strategyCheck.reason },
      })
    );
  }

  for (const path of collectForbiddenFieldPaths(request)) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.FORBIDDEN_SCHEDULING_FIELD,
        path,
        message: `Forbidden scheduling/lifecycle field: ${path}`,
      })
    );
  }

  return sortMatchGenerationIssues(issues);
}
