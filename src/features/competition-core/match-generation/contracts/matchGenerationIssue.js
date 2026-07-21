/**
 * CORE-09 — MatchGenerationIssue contract (deterministic codes + severity).
 *
 * Defaults (documented):
 * - severity omitted → ERROR
 * - path omitted → ""
 * - message omitted → code string
 * - details omitted → {}
 *
 * Unknown code or severity → throws MatchGenerationContractError (fail closed).
 */

import {
  MATCH_GENERATION_ISSUE_SEVERITY,
  isMatchGenerationIssueSeverity,
} from "../enums/issueSeverity.js";
import {
  MATCH_GENERATION_ISSUE_CODE,
  isMatchGenerationIssueCode,
} from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";

/**
 * @typedef {Object} MatchGenerationIssue
 * @property {string} code
 * @property {string} severity
 * @property {string} path
 * @property {string} message
 * @property {Readonly<Record<string, unknown>>} details
 */

/**
 * @param {Partial<MatchGenerationIssue>} [partial]
 * @returns {MatchGenerationIssue}
 */
export function createMatchGenerationIssue(partial = {}) {
  if (partial == null || typeof partial !== "object") {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_ISSUE_CODE,
      "MatchGenerationIssue partial must be an object"
    );
  }

  if (!isMatchGenerationIssueCode(partial.code)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_ISSUE_CODE,
      "Unknown or missing MatchGenerationIssue code",
      { code: partial.code ?? null }
    );
  }

  let severity = MATCH_GENERATION_ISSUE_SEVERITY.ERROR;
  if (partial.severity !== undefined && partial.severity !== null) {
    if (!isMatchGenerationIssueSeverity(partial.severity)) {
      throw new MatchGenerationContractError(
        MATCH_GENERATION_ISSUE_CODE.INVALID_ENUM_VALUE,
        "Unknown MatchGenerationIssue severity",
        { severity: partial.severity }
      );
    }
    severity = partial.severity;
  }

  return Object.freeze({
    code: partial.code,
    severity,
    path: String(partial.path || ""),
    message: String(partial.message || partial.code),
    details: freezeMetadata(partial.details || {}, "details"),
  });
}
