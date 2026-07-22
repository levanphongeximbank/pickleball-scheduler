/**
 * CORE-13 — hard-failure / soft-note diagnostic items (immutable).
 */

import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_CONSTRAINT_KIND } from "../enums/constraintKind.js";
import { REFEREE_DIAGNOSTIC_SEVERITY } from "../enums/diagnosticSeverity.js";
import {
  REFEREE_SOFT_NOTE_CODE,
  isRefereeSoftNoteCode,
} from "../enums/softNotes.js";
import { resolveDefaultDiagnosticSeverity } from "../errors/failureSemantics.js";
import { ownedFreeze } from "../contracts/shared.js";
import { compareStableString } from "../deterministic/compare.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { RefereeAssignmentContractError } from "../errors/RefereeAssignmentContractError.js";

/**
 * @param {object} partial
 */
export function createHardFailure(partial = {}) {
  const code = String(partial.code || "");
  return ownedFreeze({
    code,
    severity:
      partial.severity ||
      resolveDefaultDiagnosticSeverity(code) ||
      REFEREE_DIAGNOSTIC_SEVERITY.MATCH_RECOVERABLE,
    constraintKind: REFEREE_CONSTRAINT_KIND.HARD,
    message:
      typeof partial.message === "string" && partial.message.trim()
        ? partial.message.trim()
        : code,
    details: ownedFreeze(
      partial.details && typeof partial.details === "object"
        ? partial.details
        : {}
    ),
  });
}

/**
 * Soft preference note — never blocks without hard failure unless policy says otherwise.
 * Soft notes do not override hard constraints. Code must be a RefereeSoftNoteCode.
 * @param {object} partial
 */
export function createSoftNote(partial = {}) {
  const code = String(partial.code || "");
  if (!isRefereeSoftNoteCode(code)) {
    throw new RefereeAssignmentContractError(
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST,
      `Unknown soft note code: ${code || "(empty)"}`,
      { code }
    );
  }
  return ownedFreeze({
    code,
    severity: REFEREE_DIAGNOSTIC_SEVERITY.WARNING,
    constraintKind: REFEREE_CONSTRAINT_KIND.SOFT,
    message:
      typeof partial.message === "string" && partial.message.trim()
        ? partial.message.trim()
        : code,
    details: ownedFreeze(
      partial.details && typeof partial.details === "object"
        ? partial.details
        : {}
    ),
  });
}

void REFEREE_SOFT_NOTE_CODE;

/**
 * Sort hard failures by code then message (stable).
 * @param {readonly object[]} failures
 */
export function sortHardFailures(failures) {
  return [...(failures || [])].sort((a, b) => {
    const c = compareStableString(a.code, b.code);
    if (c !== 0) return c;
    return compareStableString(a.message, b.message);
  });
}

/**
 * Unique sorted reason codes from hard failures.
 * @param {readonly object[]} failures
 * @returns {string[]}
 */
export function collectReasonCodes(failures) {
  const set = new Set();
  for (const f of failures || []) {
    if (f && typeof f.code === "string" && f.code) set.add(f.code);
  }
  return [...set].sort(compareStableString);
}

/**
 * Eligibility evaluation result contract (Phase 1C).
 * @param {object} partial
 */
export function createRefereeEligibilityResult(partial = {}) {
  const hardFailures = Object.freeze(
    sortHardFailures(partial.hardFailures || []).map((f) =>
      createHardFailure(f)
    )
  );
  const softNotes = Object.freeze(
    [...(partial.softNotes || [])]
      .map((n) => createSoftNote(n))
      .sort((a, b) => {
        const c = compareStableString(a.code, b.code);
        if (c !== 0) return c;
        return compareStableString(a.message, b.message);
      })
  );
  const evaluatedConstraintKinds = Object.freeze(
    [...(partial.evaluatedConstraintKinds || [])]
      .map(String)
      .sort(compareStableString)
  );
  const evidenceRefs = Object.freeze(
    [...(partial.evidenceRefs || [])]
      .map(String)
      .filter(Boolean)
      .sort(compareStableString)
  );

  const eligible =
    typeof partial.eligible === "boolean"
      ? partial.eligible
      : hardFailures.length === 0;

  return ownedFreeze({
    schemaVersion: String(partial.schemaVersion ?? CORE13_SCHEMA_VERSION),
    refereeId: String(partial.refereeId || ""),
    matchId: String(partial.matchId || ""),
    roleCode: String(partial.roleCode || ""),
    eligible,
    hardFailures,
    softNotes,
    evaluatedConstraintKinds,
    evidenceRefs,
  });
}
