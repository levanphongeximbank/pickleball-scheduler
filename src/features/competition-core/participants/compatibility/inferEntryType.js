/**
 * Core-02 — deterministic COMPETITION_ENTRY_TYPE inference for compatibility adapters.
 * Fail closed on ambiguous input. Never infers from UI labels, names, or free-form metadata.
 */

import { COMPETITION_ENTRY_TYPE, isCompetitionEntryType } from "../enums/entryTypes.js";
import { PARTICIPANT_ERROR_CODE } from "../errors/errorCodes.js";
import { isValidCompetitionTeamReference } from "../contracts/teamReference.js";
import { memberReferenceToken } from "../contracts/entryIdentity.js";
import { isNonEmptyString } from "../contracts/shared.js";
import {
  validationError,
  validationFail,
  validationOk,
} from "../results/validationResult.js";

/**
 * @param {{
 *   memberRefs?: Array<{ kind?: string, id?: string }|null|undefined>,
 *   teamRef?: unknown,
 *   entryType?: string|null,
 * }} input
 * @returns {{
 *   ok: boolean,
 *   entryType: string|null,
 *   result: import('../results/validationResult.js').ParticipantValidationResult,
 * }}
 */
export function inferCompetitionEntryType(input = {}) {
  if (input.entryType != null && String(input.entryType).trim() !== "") {
    const explicit = String(input.entryType).trim();
    if (!isCompetitionEntryType(explicit)) {
      return {
        ok: false,
        entryType: null,
        result: validationFail([
          validationError(
            PARTICIPANT_ERROR_CODE.INVALID_ENTRY_TYPE,
            "entryType",
            "Explicit entryType is not a COMPETITION_ENTRY_TYPE",
            { value: explicit }
          ),
        ]),
      };
    }
    return { ok: true, entryType: explicit, result: validationOk() };
  }

  if (isValidCompetitionTeamReference(input.teamRef)) {
    return {
      ok: true,
      entryType: COMPETITION_ENTRY_TYPE.TEAM,
      result: validationOk(),
    };
  }

  const tokens = (Array.isArray(input.memberRefs) ? input.memberRefs : [])
    .map((ref) => memberReferenceToken(ref))
    .filter((t) => isNonEmptyString(t));

  if (tokens.length === 1) {
    return {
      ok: true,
      entryType: COMPETITION_ENTRY_TYPE.INDIVIDUAL,
      result: validationOk(),
    };
  }
  if (tokens.length === 2) {
    if (tokens[0] === tokens[1]) {
      return {
        ok: false,
        entryType: null,
        result: validationFail([
          validationError(
            PARTICIPANT_ERROR_CODE.ENTRY_TYPE_AMBIGUOUS,
            "memberRefs",
            "Cannot infer PAIR from two identical member references"
          ),
        ]),
      };
    }
    return {
      ok: true,
      entryType: COMPETITION_ENTRY_TYPE.PAIR,
      result: validationOk(),
    };
  }

  return {
    ok: false,
    entryType: null,
    result: validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.ENTRY_TYPE_AMBIGUOUS,
        "entryType",
        "Ambiguous legacy entry — cannot silently default entryType",
        { memberCount: tokens.length, hasTeamRef: Boolean(input.teamRef) }
      ),
    ]),
  };
}
