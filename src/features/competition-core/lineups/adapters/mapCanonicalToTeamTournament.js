/**
 * CORE-06 Phase 1F — canonical result → Team Tournament compatibility shape.
 * No hidden field leakage. No fingerprint exposure by default.
 */

import { lineupMappingFail, lineupMappingOk } from "../contracts/mappingResult.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { COMPETITION_LINEUP_STATUS } from "../../participants/enums/statuses.js";

/** Canonical statuses not represented as distinct TT aliases without reason. */
export const CANONICAL_FIELDS_NOT_IN_LEGACY = Object.freeze([
  "visibilityState",
  "revealEligible",
  "revealPhase",
  "mutationPhase",
  "commandFingerprint",
  "resultFingerprint",
  "hardeningPolicyId",
  "lineupIdentityKey_structured",
]);

/**
 * @param {string} status
 * @returns {string}
 */
function mapStatusToLegacy(status) {
  const s = String(status || "").trim().toUpperCase();
  switch (s) {
    case COMPETITION_LINEUP_STATUS.DRAFT:
      return "draft";
    case COMPETITION_LINEUP_STATUS.SUBMITTED:
      return "submitted";
    case COMPETITION_LINEUP_STATUS.LOCKED:
      return "locked";
    case COMPETITION_LINEUP_STATUS.PUBLISHED:
      return "published";
    case COMPETITION_LINEUP_STATUS.SUPERSEDED:
      return "overridden";
    case COMPETITION_LINEUP_STATUS.VOIDED:
      return "voided";
    default:
      return "unknown";
  }
}

/**
 * @param {object} result — domain service result or projection-aware envelope
 * @param {object} [options]
 */
export function mapCanonicalLineupResultToTeamTournament(result = {}, options = {}) {
  if (!result || typeof result !== "object") {
    return lineupMappingFail(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP_MAPPING,
      "Canonical result must be an object"
    );
  }

  const ok = result.ok === true;
  const value =
    result.value && typeof result.value === "object" ? result.value : null;
  const exposeFingerprints = options.exposeFingerprints === true;
  const opponentAuthorized = options.opponentAuthorized === true;

  if (!ok) {
    return lineupMappingOk(
      Object.freeze({
        ok: false,
        status: null,
        revision: null,
        expectedVersion: null,
        visibilityState: null,
        revealEligible: null,
        mutationPhase: null,
        revealPhase: null,
        requiresRepublish: null,
        selections: null,
        errorCode: result.code ?? LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
        errorMessage: result.message ?? "Operation failed",
        replayed: result.details?.replayed === true,
        idempotencyKey: result.details?.idempotencyKey ?? null,
        unsupportedCanonicalFields: CANONICAL_FIELDS_NOT_IN_LEGACY,
      })
    );
  }

  if (!value) {
    return lineupMappingFail(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP_MAPPING,
      "Successful result missing lineup value"
    );
  }

  const lifecycle = String(value.status || "").trim().toUpperCase();
  const visibilityState = value.visibilityState ?? null;
  const revealEligible =
    result.details?.revealEligible === true ||
    value.revealEligible === true;

  // Do not collapse LOCKED with reveal eligibility.
  const lockState = lifecycle === COMPETITION_LINEUP_STATUS.LOCKED;
  const mutationPhase =
    result.details?.mutationPhase ??
    result.details?.deadlinePhase ??
    null;
  const revealPhase = result.details?.revealPhase ?? null;

  let selections = null;
  if (opponentAuthorized === true || options.includeSelections === true) {
    selections = Array.isArray(value.slots)
      ? value.slots.map((s) =>
          s && typeof s === "object"
            ? Object.freeze({
                disciplineOrSideKey: s.disciplineOrSideKey ?? null,
                index: s.index ?? null,
                playerId: s.person?.id ?? null,
              })
            : null
        )
      : [];
  }

  const out = {
    ok: true,
    tournamentId: value.competitionId ?? null,
    matchupId: value.contextId ?? null,
    teamId: value.teamId ?? null,
    tenantId: value.tenantId ?? null,
    status: mapStatusToLegacy(lifecycle),
    canonicalStatus: lifecycle,
    revision: value.revision ?? null,
    expectedVersion: value.revision ?? null,
    requiresRepublish: value.requiresRepublish === true,
    lockState,
    visibilityState,
    revealEligible,
    mutationPhase,
    revealPhase,
    selections,
    replayed: result.details?.replayed === true,
    idempotencyKey: result.details?.idempotencyKey ?? null,
    errorCode: null,
    errorMessage: null,
    unsupportedCanonicalFields: CANONICAL_FIELDS_NOT_IN_LEGACY,
  };

  if (exposeFingerprints) {
    out.commandFingerprint = result.details?.commandFingerprint ?? null;
    out.resultFingerprint = result.details?.resultFingerprint ?? null;
  }

  return lineupMappingOk(Object.freeze(out));
}
