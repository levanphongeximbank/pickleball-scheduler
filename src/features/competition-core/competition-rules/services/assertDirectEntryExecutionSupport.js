/**
 * Direct knockout entry execution support — first-playable stage only.
 *
 * LATER_STAGE_DIRECT_ENTRY_EXECUTION = DEFERRED
 * Current certified execution requires:
 *   effectiveTargetStage == bracketWideEntryRound
 */

import { COMPETITION_RULES_ERROR_CODE } from "../constants/errorCodes.js";
import { ADMISSION_SOURCE_SEMANTICS } from "../constants/admissionSource.js";

/**
 * @param {{
 *   entrants?: Array<{ entryId: string, effectiveTargetStage?: string|null, targetStage?: string|null }>,
 *   bracketWideEntryRound?: string|null,
 *   policyTargetStage?: string|null,
 * }} input
 */
export function assertFirstPlayableDirectEntryExecution(input = {}) {
  const bracketWideEntryRound =
    input.bracketWideEntryRound != null
      ? String(input.bracketWideEntryRound)
      : null;
  if (!bracketWideEntryRound) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.INVALID_DIRECT_KNOCKOUT_ENTRY,
      message: "bracketWideEntryRound required for DIRECT execution support check",
      details: Object.freeze({}),
      supported: false,
      deferred: true,
    });
  }

  const deferred = [];
  const supported = [];

  for (const raw of input.entrants || []) {
    const entryId = String(raw?.entryId || "").trim();
    const effectiveTargetStage =
      raw?.effectiveTargetStage ||
      raw?.targetStage ||
      input.policyTargetStage ||
      null;
    if (!entryId) {
      return Object.freeze({
        ok: false,
        code: COMPETITION_RULES_ERROR_CODE.MISSING_ENTRANT_IDENTITY,
        message: "DIRECT entrant requires canonical entryId",
        details: Object.freeze({}),
        supported: false,
        deferred: true,
      });
    }
    if (effectiveTargetStage === bracketWideEntryRound) {
      supported.push(
        Object.freeze({
          entryId,
          effectiveTargetStage,
          executionSupport: "SUPPORTED_FIRST_PLAYABLE",
        })
      );
    } else {
      deferred.push(
        Object.freeze({
          entryId,
          effectiveTargetStage,
          bracketWideEntryRound,
          executionSupport: "DEFERRED_LATER_STAGE",
          reason:
            "Shared bracket runtime supports only effectiveTargetStage == bracketWideEntryRound",
        })
      );
    }
  }

  if (deferred.length > 0) {
    return Object.freeze({
      ok: false,
      code: COMPETITION_RULES_ERROR_CODE.CAPABILITY_EXECUTION_UNAVAILABLE,
      message:
        "Later-stage DIRECT_KNOCKOUT_ENTRY execution is deferred — fail closed",
      details: Object.freeze({
        LATER_STAGE_DIRECT_ENTRY_EXECUTION:
          ADMISSION_SOURCE_SEMANTICS.LATER_STAGE_DIRECT_ENTRY_EXECUTION,
        deferred: Object.freeze(deferred),
        supported: Object.freeze(supported),
        FAKE_BYE_WINNER: ADMISSION_SOURCE_SEMANTICS.FAKE_BYE_WINNER,
        PHANTOM_RESULT: ADMISSION_SOURCE_SEMANTICS.PHANTOM_RESULT,
      }),
      supported: false,
      deferred: true,
    });
  }

  return Object.freeze({
    ok: true,
    supported: true,
    deferred: false,
    entrants: Object.freeze(supported),
    bracketWideEntryRound,
    executionCondition: "effectiveTargetStage == bracketWideEntryRound",
    code: null,
    message: null,
  });
}
