import { RATING_INELIGIBILITY_REASON } from "./ratingConstants.js";

/**
 * @typedef {Object} MatchRatingEligibilityResult
 * @property {boolean} eligible
 * @property {string|null} reason
 * @property {import('../constants/ratingEligibilityStatus.js').RatingEligibilityStatusValue} status
 */

const INELIGIBLE_RESULT_TYPES = new Set([
  RATING_INELIGIBILITY_REASON.BYE,
  RATING_INELIGIBILITY_REASON.CANCELLED,
  RATING_INELIGIBILITY_REASON.VOID,
  RATING_INELIGIBILITY_REASON.TEST,
  RATING_INELIGIBILITY_REASON.WALKOVER_BEFORE_START,
  RATING_INELIGIBILITY_REASON.UNVERIFIED,
  RATING_INELIGIBILITY_REASON.FRAUD_SUSPECTED,
  RATING_INELIGIBILITY_REASON.INVALID_LINEUP,
]);

const INELIGIBLE_STATUSES = new Set([
  "cancelled",
  "void",
  "voided",
  "test",
  "bye",
  "walkover_before_start",
  "unverified",
  "fraud_suspected",
  "invalid_lineup",
]);

/**
 * Determine whether a completed match record should update competition Elo.
 *
 * @param {Object|null|undefined} record Match record or raw match object
 * @param {Object} [options]
 * @param {Object|null} [options.match] Original match for extra flags
 * @param {boolean} [options.allowForfeit] When true, forfeit counts as eligible (legacy compat)
 * @returns {MatchRatingEligibilityResult}
 */
export function isMatchRatingEligible(record, options = {}) {
  if (!record) {
    return {
      eligible: false,
      reason: RATING_INELIGIBILITY_REASON.MISSING_TEAMS,
      status: "ineligible",
    };
  }

  const match = options.match && typeof options.match === "object" ? options.match : record;
  const resultType = String(
    record.resultType ?? record.ratingResultType ?? match.resultType ?? ""
  )
    .trim()
    .toLowerCase();

  if (resultType && INELIGIBLE_RESULT_TYPES.has(resultType)) {
    return { eligible: false, reason: resultType, status: "ineligible" };
  }

  const status = String(record.status ?? match.status ?? "completed")
    .trim()
    .toLowerCase();

  if (INELIGIBLE_STATUSES.has(status)) {
    return { eligible: false, reason: status, status: "ineligible" };
  }

  if (record.isBye === true || match.isBye === true || record.bye === true || match.bye === true) {
    return {
      eligible: false,
      reason: RATING_INELIGIBILITY_REASON.BYE,
      status: "ineligible",
    };
  }

  if (record.ratingEligible === false || match.ratingEligible === false) {
    return {
      eligible: false,
      reason: record.ratingIneligibleReason ?? match.ratingIneligibleReason ?? "ineligible",
      status: "ineligible",
    };
  }

  if (record.ratingRequiresReview === true || match.ratingRequiresReview === true) {
    return { eligible: false, reason: "requires_review", status: "requires_review" };
  }

  const teamA = (record.teamAPlayerIds || match.teamAPlayerIds || []).map(String);
  const teamB = (record.teamBPlayerIds || match.teamBPlayerIds || []).map(String);

  if (!teamA.length || !teamB.length) {
    return {
      eligible: false,
      reason: RATING_INELIGIBILITY_REASON.MISSING_TEAMS,
      status: "ineligible",
    };
  }

  if (status === "forfeit" && options.allowForfeit !== true) {
    return {
      eligible: false,
      reason: RATING_INELIGIBILITY_REASON.WALKOVER_BEFORE_START,
      status: "requires_review",
    };
  }

  if (record.source === "daily_play" || record.mode === "daily_play") {
    return {
      eligible: false,
      reason: RATING_INELIGIBILITY_REASON.DAILY_PLAY,
      status: "ineligible",
    };
  }

  return { eligible: true, reason: null, status: "eligible" };
}
