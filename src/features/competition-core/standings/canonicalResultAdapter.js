/**
 * CORE-18 — narrow CORE-17 ValidatedResult → StandingsMatchRecord adapter.
 *
 * Consumes only the CORE-17 public surface. Does not mutate validated results.
 * Does not import CORE-16 projection internals or recreate acceptance logic.
 */

import {
  ACCEPTANCE_STATUS,
  LINEAGE_STATUS,
  OUTCOME,
  RESULT_TYPE,
  SCORING_SIDE,
  TECHNICAL_SUBTYPE,
  isScoreDifferentialEligible,
  isStandingsSafe,
  resolveSideIdentity,
} from "../result-validation/index.js";
import { MATCH_RESULT_TYPE } from "./standingsConstants.js";
import {
  STANDINGS_ERROR_CODE,
  STANDINGS_WARNING_CODE,
  createStandingsIssue,
} from "./standingsErrors.js";
import { createStandingsMatchRecord } from "./standingsContracts.js";

export const STANDINGS_EXPLANATION_CODE = Object.freeze({
  RESULT_INCLUDED: "RESULT_INCLUDED",
  RESULT_EXCLUDED: "RESULT_EXCLUDED",
  DIFFERENTIAL_APPLIED: "DIFFERENTIAL_APPLIED",
  DIFFERENTIAL_SKIPPED: "DIFFERENTIAL_SKIPPED",
  WINNER_FROM_VALIDATED_RESULT: "WINNER_FROM_VALIDATED_RESULT",
});

/**
 * Deterministic code-point (UTF-16 unit) identity compare — no locale.
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareCanonicalIdentity(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * @param {object|null|undefined} result
 * @returns {string}
 */
function exclusionReasonForResult(result) {
  if (!result || typeof result !== "object") {
    return "invalid_result";
  }
  if (result.acceptanceStatus !== ACCEPTANCE_STATUS.ACCEPTED) {
    return "not_accepted";
  }
  if (result.lineageStatus !== LINEAGE_STATUS.ACTIVE) {
    return "not_active";
  }
  if (
    result.resultType === RESULT_TYPE.ABANDONED ||
    result.resultType === RESULT_TYPE.CANCELLED ||
    result.resultType === RESULT_TYPE.VOID
  ) {
    return String(result.resultType).toLowerCase();
  }
  return "not_standings_safe";
}

/**
 * Map CORE-17 resultType (+ optional forfeit subtype) to standings match type.
 * @param {object} result
 * @returns {string}
 */
export function mapCore17ResultTypeToStandings(result) {
  const type = result?.resultType;
  if (type === RESULT_TYPE.COMPLETED) return MATCH_RESULT_TYPE.COMPLETED;
  if (type === RESULT_TYPE.WALKOVER) return MATCH_RESULT_TYPE.WALKOVER;
  if (type === RESULT_TYPE.NO_SHOW) return MATCH_RESULT_TYPE.NO_SHOW;
  if (type === RESULT_TYPE.RETIREMENT) return MATCH_RESULT_TYPE.RETIREMENT;
  if (type === RESULT_TYPE.ABANDONED) return MATCH_RESULT_TYPE.ABANDONED;
  if (type === RESULT_TYPE.CANCELLED) return MATCH_RESULT_TYPE.CANCELLED;
  if (type === RESULT_TYPE.VOID) return MATCH_RESULT_TYPE.VOID;
  if (type === RESULT_TYPE.FORFEIT) {
    const subtype = result?.technicalMetadata?.technicalSubtype;
    if (subtype === TECHNICAL_SUBTYPE.FORFEIT_BEFORE_START) {
      return MATCH_RESULT_TYPE.FORFEIT_BEFORE_START;
    }
    if (subtype === TECHNICAL_SUBTYPE.FORFEIT_AFTER_START) {
      return MATCH_RESULT_TYPE.FORFEIT_AFTER_START;
    }
    if (subtype === TECHNICAL_SUBTYPE.ADMINISTRATIVE_FORFEIT) {
      return MATCH_RESULT_TYPE.ADMINISTRATIVE_FORFEIT;
    }
    return MATCH_RESULT_TYPE.FORFEIT;
  }
  return MATCH_RESULT_TYPE.COMPLETED;
}

/**
 * @param {object} result
 * @returns {{ entryAId: string, entryBId: string }|null}
 */
function resolveSideEntries(result) {
  const bindings = Array.isArray(result.sideBindings) ? result.sideBindings : [];
  let entryAId = "";
  let entryBId = "";
  for (const binding of bindings) {
    const id = resolveSideIdentity(binding);
    if (!id) continue;
    if (binding.scoringSide === SCORING_SIDE.SIDE_A) entryAId = id;
    if (binding.scoringSide === SCORING_SIDE.SIDE_B) entryBId = id;
  }
  if (!entryAId || !entryBId) return null;
  return { entryAId, entryBId };
}

/**
 * Map eligible scoreSnapshot fields without recomputation.
 * Missing side statistics stay undefined (never invented as official zeros).
 * @param {object|null|undefined} snapshot
 * @returns {{ scoreA?: number, scoreB?: number, setsA?: number, setsB?: number, gamesA?: number, gamesB?: number, statisticsPresent: boolean }}
 */
export function mapEligibleScoreStatistics(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return { statisticsPresent: false };
  }

  /** @type {{ scoreA?: number, scoreB?: number, setsA?: number, setsB?: number, gamesA?: number, gamesB?: number, statisticsPresent: boolean }} */
  const mapped = { statisticsPresent: false };

  if (snapshot.points && typeof snapshot.points === "object") {
    if (Number.isFinite(Number(snapshot.points.SIDE_A))) {
      mapped.scoreA = Number(snapshot.points.SIDE_A);
      mapped.statisticsPresent = true;
    }
    if (Number.isFinite(Number(snapshot.points.SIDE_B))) {
      mapped.scoreB = Number(snapshot.points.SIDE_B);
      mapped.statisticsPresent = true;
    }
  }

  if (snapshot.setsWon && typeof snapshot.setsWon === "object") {
    if (Number.isFinite(Number(snapshot.setsWon.SIDE_A))) {
      mapped.setsA = Number(snapshot.setsWon.SIDE_A);
      mapped.statisticsPresent = true;
    }
    if (Number.isFinite(Number(snapshot.setsWon.SIDE_B))) {
      mapped.setsB = Number(snapshot.setsWon.SIDE_B);
      mapped.statisticsPresent = true;
    }
  }

  // Optional per-side games when present on snapshot; never synthesize from points.
  if (snapshot.gamesWon && typeof snapshot.gamesWon === "object") {
    if (Number.isFinite(Number(snapshot.gamesWon.SIDE_A))) {
      mapped.gamesA = Number(snapshot.gamesWon.SIDE_A);
      mapped.statisticsPresent = true;
    }
    if (Number.isFinite(Number(snapshot.gamesWon.SIDE_B))) {
      mapped.gamesB = Number(snapshot.gamesWon.SIDE_B);
      mapped.statisticsPresent = true;
    }
  }

  return mapped;
}

/**
 * Adapt one CORE-17 validated result into a standings match record or exclusion.
 *
 * @param {object} validatedResult
 * @param {{ entryRoster?: Set<string>|string[] }} [options]
 * @returns {{
 *   included: boolean,
 *   record: import('./standingsTypes.js').StandingsMatchRecord|null,
 *   differentialEligible: boolean,
 *   exclusionCode?: string,
 *   explanation: ReturnType<typeof createStandingsIssue>,
 *   warnings: ReturnType<typeof createStandingsIssue>[],
 *   error?: ReturnType<typeof createStandingsIssue>,
 * }}
 */
export function adaptValidatedResultToStandingsMatch(validatedResult, options = {}) {
  const warnings = [];

  if (!isStandingsSafe(validatedResult)) {
    const reason = exclusionReasonForResult(validatedResult);
    const issue = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_RESULT_NOT_STANDINGS_SAFE,
      `Validated result is not standings-safe (${reason}).`,
      {
        matchId: validatedResult?.matchId ?? null,
        validatedResultId: validatedResult?.validatedResultId ?? null,
        acceptanceStatus: validatedResult?.acceptanceStatus ?? null,
        lineageStatus: validatedResult?.lineageStatus ?? null,
        resultType: validatedResult?.resultType ?? null,
        reason,
      }
    );
    return {
      included: false,
      record: null,
      differentialEligible: false,
      exclusionCode: reason,
      explanation: createStandingsIssue(
        STANDINGS_EXPLANATION_CODE.RESULT_EXCLUDED,
        `Result excluded: ${reason}.`,
        issue.details
      ),
      warnings: [
        createStandingsIssue(
          STANDINGS_WARNING_CODE.STANDINGS_RESULT_EXCLUDED,
          issue.message,
          issue.details
        ),
      ],
      error: undefined,
    };
  }

  const sides = resolveSideEntries(validatedResult);
  if (!sides) {
    const error = createStandingsIssue(
      STANDINGS_ERROR_CODE.STANDINGS_MISSING_WINNER_LOSER,
      "Validated result is missing side participant identities.",
      { validatedResultId: validatedResult.validatedResultId, matchId: validatedResult.matchId }
    );
    return {
      included: false,
      record: null,
      differentialEligible: false,
      exclusionCode: "missing_side_identity",
      explanation: createStandingsIssue(
        STANDINGS_EXPLANATION_CODE.RESULT_EXCLUDED,
        error.message,
        error.details
      ),
      warnings: [],
      error,
    };
  }

  const roster = options.entryRoster
    ? new Set(
        Array.isArray(options.entryRoster)
          ? options.entryRoster.map(String)
          : [...options.entryRoster].map(String)
      )
    : null;

  if (roster) {
    if (!roster.has(sides.entryAId) || !roster.has(sides.entryBId)) {
      const error = createStandingsIssue(
        STANDINGS_ERROR_CODE.STANDINGS_PARTICIPANT_OUTSIDE_GROUP,
        "Validated result participants are outside the standings group.",
        {
          matchId: validatedResult.matchId,
          entryAId: sides.entryAId,
          entryBId: sides.entryBId,
        }
      );
      return {
        included: false,
        record: null,
        differentialEligible: false,
        exclusionCode: "participant_outside_group",
        explanation: createStandingsIssue(
          STANDINGS_EXPLANATION_CODE.RESULT_EXCLUDED,
          error.message,
          error.details
        ),
        warnings: [],
        error,
      };
    }
  }

  const differentialEligible = isScoreDifferentialEligible(validatedResult);
  const stats = differentialEligible
    ? mapEligibleScoreStatistics(validatedResult.scoreSnapshot)
    : { statisticsPresent: false };

  if (differentialEligible && !stats.statisticsPresent) {
    warnings.push(
      createStandingsIssue(
        STANDINGS_WARNING_CODE.STANDINGS_STATISTICS_ABSENT,
        "Score differential eligible but scoreSnapshot statistics are absent; differentials not invented.",
        { matchId: validatedResult.matchId, validatedResultId: validatedResult.validatedResultId }
      )
    );
  }

  if (!differentialEligible) {
    warnings.push(
      createStandingsIssue(
        STANDINGS_WARNING_CODE.STANDINGS_DIFFERENTIAL_SKIPPED,
        `Score differential skipped for resultType ${validatedResult.resultType}.`,
        {
          matchId: validatedResult.matchId,
          resultType: validatedResult.resultType,
          reason:
            validatedResult.resultType === RESULT_TYPE.RETIREMENT
              ? "retirement_no_differential"
              : "not_differential_eligible",
        }
      )
    );
  }

  let winnerEntryId;
  let loserEntryId;
  if (validatedResult.outcome === OUTCOME.WIN_LOSS) {
    winnerEntryId =
      validatedResult.winnerId != null ? String(validatedResult.winnerId) : undefined;
    loserEntryId =
      validatedResult.loserId != null ? String(validatedResult.loserId) : undefined;
    if (!winnerEntryId || !loserEntryId) {
      const error = createStandingsIssue(
        STANDINGS_ERROR_CODE.STANDINGS_MISSING_WINNER_LOSER,
        "WIN_LOSS validated result requires winnerId and loserId.",
        { validatedResultId: validatedResult.validatedResultId, matchId: validatedResult.matchId }
      );
      return {
        included: false,
        record: null,
        differentialEligible: false,
        exclusionCode: "missing_winner_loser",
        explanation: createStandingsIssue(
          STANDINGS_EXPLANATION_CODE.RESULT_EXCLUDED,
          error.message,
          error.details
        ),
        warnings,
        error,
      };
    }
  }

  const record = createStandingsMatchRecord({
    matchId: String(validatedResult.matchId),
    entryAId: sides.entryAId,
    entryBId: sides.entryBId,
    resultType: mapCore17ResultTypeToStandings(validatedResult),
    winnerEntryId,
    loserEntryId,
    scoreA: stats.scoreA,
    scoreB: stats.scoreB,
    setsA: stats.setsA,
    setsB: stats.setsB,
    gamesA: stats.gamesA,
    gamesB: stats.gamesB,
    verified: true,
    canonicalSource: true,
    validatedResultId: String(validatedResult.validatedResultId),
    differentialEligible,
    core17ResultType: validatedResult.resultType,
    core17Outcome: validatedResult.outcome,
  });

  return {
    included: true,
    record,
    differentialEligible,
    explanation: createStandingsIssue(
      STANDINGS_EXPLANATION_CODE.RESULT_INCLUDED,
      "Accepted active standings-safe result included.",
      {
        matchId: record.matchId,
        validatedResultId: record.validatedResultId,
        resultType: validatedResult.resultType,
        winnerEntryId: winnerEntryId ?? null,
        differentialEligible,
        differentialNote: differentialEligible
          ? STANDINGS_EXPLANATION_CODE.DIFFERENTIAL_APPLIED
          : STANDINGS_EXPLANATION_CODE.DIFFERENTIAL_SKIPPED,
        winnerSource: STANDINGS_EXPLANATION_CODE.WINNER_FROM_VALIDATED_RESULT,
      }
    ),
    warnings,
  };
}

/**
 * Adapt many validated results. Fail-closed on duplicate/conflicting identities.
 *
 * @param {object[]} validatedResults
 * @param {{ entryRoster?: Set<string>|string[] }} [options]
 */
export function adaptValidatedResultsToStandingsMatches(validatedResults = [], options = {}) {
  const matches = [];
  const excluded = [];
  const explanations = [];
  const warnings = [];
  const errors = [];
  /** @type {Map<string, object>} */
  const byMatchId = new Map();
  /** @type {Map<string, object>} */
  const byValidatedId = new Map();

  const sorted = [...(validatedResults || [])].sort((left, right) => {
    const matchCmp = compareCanonicalIdentity(left?.matchId, right?.matchId);
    if (matchCmp !== 0) return matchCmp;
    return compareCanonicalIdentity(left?.validatedResultId, right?.validatedResultId);
  });

  for (const result of sorted) {
    const adapted = adaptValidatedResultToStandingsMatch(result, options);
    explanations.push(adapted.explanation);
    warnings.push(...adapted.warnings);
    if (adapted.error) {
      errors.push(adapted.error);
    }

    if (!adapted.included || !adapted.record) {
      excluded.push({
        matchId: result?.matchId != null ? String(result.matchId) : "",
        validatedResultId:
          result?.validatedResultId != null ? String(result.validatedResultId) : "",
        reason: adapted.exclusionCode || "excluded",
        code: STANDINGS_WARNING_CODE.STANDINGS_RESULT_EXCLUDED,
      });
      continue;
    }

    const record = adapted.record;
    const validatedId = String(record.validatedResultId || "");
    if (validatedId && byValidatedId.has(validatedId)) {
      // Fail closed: neither duplicate identity remains in the accepted set.
      const prior = byValidatedId.get(validatedId);
      byValidatedId.delete(validatedId);
      if (prior?.matchId) {
        byMatchId.delete(String(prior.matchId));
        const priorIdx = matches.findIndex((item) => item.matchId === prior.matchId);
        if (priorIdx >= 0) matches.splice(priorIdx, 1);
      }
      errors.push(
        createStandingsIssue(
          STANDINGS_ERROR_CODE.STANDINGS_DUPLICATE_MATCH_IDENTITY,
          `Duplicate validatedResultId ${validatedId}.`,
          { validatedResultId: validatedId, matchId: record.matchId }
        )
      );
      continue;
    }

    if (byMatchId.has(record.matchId)) {
      const prior = byMatchId.get(record.matchId);
      const conflict =
        standingsMatchOutcomeFingerprint(prior) !==
        standingsMatchOutcomeFingerprint(record);
      // Fail closed: remove prior so neither conflicting/duplicate result wins.
      byMatchId.delete(record.matchId);
      if (prior?.validatedResultId) {
        byValidatedId.delete(String(prior.validatedResultId));
      }
      const priorIdx = matches.findIndex((item) => item.matchId === record.matchId);
      if (priorIdx >= 0) matches.splice(priorIdx, 1);
      errors.push(
        createStandingsIssue(
          conflict
            ? STANDINGS_ERROR_CODE.STANDINGS_CONFLICTING_ACCEPTED_RESULTS
            : STANDINGS_ERROR_CODE.STANDINGS_DUPLICATE_MATCH_IDENTITY,
          conflict
            ? `Conflicting accepted results for matchId ${record.matchId}.`
            : `Duplicate match identity ${record.matchId}.`,
          {
            matchId: record.matchId,
            priorValidatedResultId: prior.validatedResultId ?? null,
            nextValidatedResultId: record.validatedResultId ?? null,
          }
        )
      );
      continue;
    }

    byMatchId.set(record.matchId, record);
    if (validatedId) byValidatedId.set(validatedId, record);
    matches.push(record);
  }

  return {
    matches,
    excluded,
    explanations,
    warnings,
    errors,
    ok: errors.length === 0,
  };
}

/**
 * Outcome fingerprint for conflict detection — excludes validatedResultId.
 * @param {import('./standingsTypes.js').StandingsMatchRecord} match
 * @returns {string}
 */
export function standingsMatchOutcomeFingerprint(match) {
  return [
    match?.matchId,
    match?.resultType,
    match?.winnerEntryId,
    match?.loserEntryId,
    match?.scoreA,
    match?.scoreB,
    match?.setsA,
    match?.setsB,
    match?.gamesA,
    match?.gamesB,
    match?.core17Outcome,
  ]
    .map((value) => (value == null ? "" : String(value)))
    .join("|");
}

/**
 * @param {import('./standingsTypes.js').StandingsMatchRecord} match
 * @returns {string}
 */
export function standingsMatchFingerprint(match) {
  return [standingsMatchOutcomeFingerprint(match), match?.validatedResultId ?? ""].join("|");
}

/**
 * Reject raw CORE-16 projection objects as standings truth.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRawCore16Projection(value) {
  if (!value || typeof value !== "object") return false;
  const obj = /** @type {Record<string, unknown>} */ (value);
  // Validated results carry contractId / acceptanceStatus; projections do not.
  if (obj.acceptanceStatus != null || obj.validatedResultId != null) return false;
  return (
    obj.calculatedMatchComplete != null ||
    (obj.points != null && obj.setsWon != null && obj.events != null) ||
    obj.projectionKind === "CALCULATED_SCORE_ONLY"
  );
}
