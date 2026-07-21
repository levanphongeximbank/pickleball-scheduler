/**
 * CORE-09 — unsupported strategy fail-closed helper.
 */

import { createMatchGenerationIssue } from "../contracts/matchGenerationIssue.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { resolveSupportedStrategy } from "../enums/matchGenerationStrategy.js";
import { matchGenerationFail } from "../contracts/matchGenerationResult.js";

/**
 * @param {unknown} strategy
 * @returns {import('../contracts/matchGenerationResult.js').MatchGenerationResult|null}
 *   null when strategy is supported; failure result otherwise.
 */
export function rejectUnsupportedStrategy(strategy) {
  const check = resolveSupportedStrategy(strategy);
  if (check.ok) return null;

  const code =
    check.reason === "STRATEGY_DEFERRED"
      ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_DEFERRED
      : check.reason === "STRATEGY_REQUIRED"
        ? MATCH_GENERATION_ISSUE_CODE.STRATEGY_REQUIRED
        : MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED;

  return matchGenerationFail(code, `Unsupported match generation strategy`, {
    path: "strategy",
    details: { strategy: strategy ?? null, reason: check.reason },
    issues: [
      createMatchGenerationIssue({
        code,
        path: "strategy",
        message: `Strategy rejected: ${strategy}`,
        details: { reason: check.reason },
      }),
    ],
  });
}
