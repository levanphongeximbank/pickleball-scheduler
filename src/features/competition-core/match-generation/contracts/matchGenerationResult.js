/**
 * CORE-09 — MatchGenerationResult envelope.
 */

import { createMatchPlan } from "./matchPlan.js";
import { createMatchGenerationIssue } from "./matchGenerationIssue.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";
import { isMatchGenerationIssueCode } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";

/**
 * @param {Partial<object>} [partial]
 */
export function createMatchGenerationResult(partial = {}) {
  const ok = partial?.ok === true;
  const issues = Object.freeze(
    (Array.isArray(partial.issues) ? partial.issues : []).map((i) =>
      createMatchGenerationIssue(i)
    )
  );

  const fingerprints = Object.freeze({
    drawFingerprint: String(partial.fingerprints?.drawFingerprint || "").trim(),
    ruleEvaluationFingerprint: String(
      partial.fingerprints?.ruleEvaluationFingerprint || ""
    ).trim(),
    participantFingerprint: String(
      partial.fingerprints?.participantFingerprint || ""
    ).trim(),
    generationFingerprint: String(
      partial.fingerprints?.generationFingerprint || ""
    ).trim(),
  });

  return Object.freeze({
    ok,
    matchPlan: ok && partial.matchPlan ? createMatchPlan(partial.matchPlan) : null,
    issues,
    diagnostics: freezeMetadata(partial.diagnostics || {}, "diagnostics"),
    fingerprints,
  });
}

export function matchGenerationOk({
  matchPlan,
  issues = [],
  diagnostics = {},
  fingerprints = {},
}) {
  return createMatchGenerationResult({
    ok: true,
    matchPlan,
    issues,
    diagnostics,
    fingerprints,
  });
}

export function matchGenerationFail(code, message, options = {}) {
  if (!isMatchGenerationIssueCode(code)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_ISSUE_CODE,
      "matchGenerationFail requires a known issue code",
      { code: code ?? null }
    );
  }
  const issue = createMatchGenerationIssue({
    code,
    path: options.path || "",
    message: message || code,
    details: options.details || {},
  });
  return createMatchGenerationResult({
    ok: false,
    issues: [issue, ...(Array.isArray(options.issues) ? options.issues : [])],
    diagnostics: options.diagnostics || {},
    fingerprints: options.fingerprints || {},
  });
}
