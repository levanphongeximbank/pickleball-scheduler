/**
 * CORE-19 adapter — CORE-18 Standings completion prerequisite mapping.
 *
 * Imports only from the CORE-18 public barrel.
 * Never calculates standings or invents tie-breaks.
 *
 * Owner-frozen policy:
 * satisfied only when ok===true, typedErrors empty, complete deterministic
 * final ordering exists, and every ranked entry has a stable final position.
 * STANDINGS_UNRESOLVED_TIE is non-blocking only when those conditions hold.
 */

import {
  STANDINGS_WARNING_CODE,
} from "../../standings/index.js";
import { WORKFLOW_ERROR_CODE } from "../errors/workflowErrorCodes.js";
import { createTransitionPrerequisiteResult } from "../contracts/workflowDecisions.js";
import {
  compareStableString,
  isPlainObject,
} from "../utils/canonicalizeWorkflowPayload.js";

const DEPENDENCY = "core-18:standings";

/**
 * @param {unknown} issue
 * @returns {string|null}
 */
function issueCode(issue) {
  if (issue == null) return null;
  if (typeof issue === "string") return issue;
  if (isPlainObject(issue) && issue.code != null) return String(issue.code);
  return null;
}

/**
 * @param {unknown} standingsResult
 * @returns {{ complete: boolean, reasons: string[], ranks: number[] }}
 */
function assessFinalOrdering(standingsResult) {
  const reasons = [];
  if (!isPlainObject(standingsResult)) {
    return {
      complete: false,
      reasons: ["Standings result shape cannot prove deterministic completion"],
      ranks: [],
    };
  }

  const rows = Array.isArray(standingsResult.rows) ? standingsResult.rows : null;
  if (!rows) {
    return {
      complete: false,
      reasons: ["Standings rows are missing; final ordering incomplete"],
      ranks: [],
    };
  }

  const ranks = [];
  const seen = new Set();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!isPlainObject(row)) {
      reasons.push(`Row at index ${i} is not a plain object`);
      continue;
    }
    if (row.entryId == null || String(row.entryId).trim() === "") {
      reasons.push(`Row at index ${i} lacks entryId`);
    }

    const rankRaw = row.rank ?? row.finalPosition ?? row.position;
    const rank = Number(rankRaw);
    if (!Number.isFinite(rank) || rank <= 0 || !Number.isInteger(rank)) {
      reasons.push(
        `Entry ${row.entryId || i} lacks a stable final position`
      );
      continue;
    }
    if (seen.has(rank)) {
      reasons.push(`Duplicate final position ${rank}`);
    }
    seen.add(rank);
    ranks.push(rank);
  }

  if (rows.length > 0) {
    const expected = [];
    for (let n = 1; n <= rows.length; n += 1) expected.push(n);
    const sorted = [...ranks].sort((a, b) => a - b);
    const contiguous =
      sorted.length === rows.length &&
      sorted.every((value, idx) => value === expected[idx]);
    if (!contiguous && reasons.length === 0) {
      // Non-contiguous ranks still fail "complete deterministic final ordering".
      reasons.push("Final ordering is incomplete or non-contiguous");
    }
  }

  return {
    complete: reasons.length === 0,
    reasons: reasons.sort(compareStableString),
    ranks: ranks.sort((a, b) => a - b),
  };
}

/**
 * @param {object} [input]
 * @param {object} [input.standingsResult]
 * @param {object} [input.result]
 * @param {string|null} [input.prerequisiteId]
 * @returns {Readonly<import('../contracts/workflowDecisions.js').TransitionPrerequisiteResult>}
 */
export function adaptCore18StandingsCompletion(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const standingsResult =
    (isPlainObject(source.standingsResult) && source.standingsResult) ||
    (isPlainObject(source.result) && source.result) ||
    null;

  if (!standingsResult) {
    return createTransitionPrerequisiteResult({
      satisfied: false,
      code: WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
      message: "Standings result is required",
      dependencyRef: DEPENDENCY,
      details: {
        dependency: DEPENDENCY,
        dependencyCode: WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
        prerequisiteId:
          source.prerequisiteId != null ? String(source.prerequisiteId) : null,
        blockingReasons: Object.freeze(["Standings result missing"]),
        warnings: Object.freeze([]),
      },
    });
  }

  const typedErrors = Array.isArray(standingsResult.typedErrors)
    ? standingsResult.typedErrors
    : [];
  const typedWarnings = Array.isArray(standingsResult.typedWarnings)
    ? standingsResult.typedWarnings
    : [];
  const warnings = Array.isArray(standingsResult.warnings)
    ? standingsResult.warnings
    : [];

  const ordering = assessFinalOrdering(standingsResult);
  const blockingReasons = [];

  if (standingsResult.ok !== true) {
    blockingReasons.push("standingsResult.ok === false");
  }
  if (typedErrors.length > 0) {
    blockingReasons.push("typedErrors is non-empty");
  }
  if (!ordering.complete) {
    blockingReasons.push(...ordering.reasons);
  }

  const unresolvedTieCodes = [
    ...typedWarnings.map(issueCode),
    ...warnings.map(issueCode),
  ].filter((code) => code === STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE);

  const hasUnresolvedTieWarning = unresolvedTieCodes.length > 0;

  // Unresolved tie without complete stable ranking blocks.
  if (hasUnresolvedTieWarning && !ordering.complete) {
    blockingReasons.push(
      "STANDINGS_UNRESOLVED_TIE without complete stable ranking"
    );
  }

  const stableBlocking = Object.freeze(
    [...new Set(blockingReasons.map(String))].sort(compareStableString)
  );

  const preservedWarnings = [];
  if (hasUnresolvedTieWarning && ordering.complete && standingsResult.ok === true && typedErrors.length === 0) {
    preservedWarnings.push(STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE);
  }
  for (const w of typedWarnings) {
    const code = issueCode(w);
    if (code && code !== STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE) {
      preservedWarnings.push(code);
    }
  }
  for (const w of warnings) {
    const code = issueCode(w);
    if (
      code &&
      code !== STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE &&
      !preservedWarnings.includes(code)
    ) {
      preservedWarnings.push(code);
    }
  }

  const satisfied = stableBlocking.length === 0;

  const dependencyErrorCodes = Object.freeze(
    typedErrors
      .map(issueCode)
      .filter(Boolean)
      .sort(compareStableString)
  );

  return createTransitionPrerequisiteResult({
    satisfied,
    code: satisfied
      ? hasUnresolvedTieWarning
        ? STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE
        : "STANDINGS_COMPLETION_SATISFIED"
      : WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
    message: satisfied
      ? hasUnresolvedTieWarning
        ? "Standings complete with non-blocking unresolved-tie warning"
        : "Standings completion prerequisite satisfied"
      : stableBlocking[0] || "Standings completion prerequisite not satisfied",
    dependencyRef: DEPENDENCY,
    details: {
      dependency: DEPENDENCY,
      dependencyCode: satisfied
        ? hasUnresolvedTieWarning
          ? STANDINGS_WARNING_CODE.STANDINGS_UNRESOLVED_TIE
          : null
        : WORKFLOW_ERROR_CODE.PREREQUISITE_NOT_SATISFIED,
      prerequisiteId:
        source.prerequisiteId != null ? String(source.prerequisiteId) : null,
      ok: standingsResult.ok === true,
      typedErrorCodes: dependencyErrorCodes,
      completeFinalOrdering: ordering.complete,
      ranks: Object.freeze([...ordering.ranks]),
      blockingReasons: stableBlocking,
      warnings: Object.freeze(
        [...new Set(preservedWarnings.map(String))].sort(compareStableString)
      ),
      nonBlockingUnresolvedTie:
        satisfied === true && hasUnresolvedTieWarning === true,
      warning: satisfied === true && hasUnresolvedTieWarning === true,
      nonBlocking: satisfied === true && hasUnresolvedTieWarning === true,
    },
  });
}
