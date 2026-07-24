/**
 * Map internal match status to public-safe status vocabulary.
 * Does not infer winners or mutate lifecycle.
 */

import { PUBLIC_MATCH_STATUS } from "../constants.js";

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function mapPublicMatchStatus(raw) {
  const status = String(raw || "")
    .trim()
    .toUpperCase();
  switch (status) {
    case "SCHEDULED":
    case "READY":
    case "ASSIGNED":
    case "QUEUED":
      return PUBLIC_MATCH_STATUS.SCHEDULED;
    case "DELAYED":
    case "POSTPONED":
      return PUBLIC_MATCH_STATUS.DELAYED;
    case "SUSPENDED":
    case "PAUSED":
      return PUBLIC_MATCH_STATUS.SUSPENDED;
    case "ACTIVE":
    case "IN_PROGRESS":
    case "STARTED":
    case "LIVE":
      return PUBLIC_MATCH_STATUS.ACTIVE;
    case "COMPLETED":
    case "COMPLETE":
    case "FINISHED":
      return PUBLIC_MATCH_STATUS.COMPLETED;
    case "CANCELLED":
    case "CANCELED":
      return PUBLIC_MATCH_STATUS.CANCELLED;
    case "VOID":
    case "VOIDED":
      return PUBLIC_MATCH_STATUS.VOID;
    case "PENDING":
    case "":
      return PUBLIC_MATCH_STATUS.PENDING;
    default:
      return PUBLIC_MATCH_STATUS.PENDING;
  }
}

/**
 * Score visibility: only accepted/published scores when policy allows.
 * @param {object} match
 * @param {{ resultsPublished: boolean }} visibility
 * @returns {object|null}
 */
export function mapPublicScore(match, visibility) {
  if (!visibility.resultsPublished) return null;
  const accepted =
    match?.scoreAccepted === true ||
    match?.resultValidated === true ||
    match?.validatedResult != null ||
    String(match?.resultPublicationState || "").toUpperCase() === "PUBLISHED";
  if (!accepted && match?.scoreDraftOnly === true) return null;
  if (!accepted && match?.score != null && match?.requireAcceptedScore !== false) {
    // Fail-closed for unpublished/unaccepted scores when flag present.
    if (match?.scorePublished === false || match?.scoreAccepted === false) {
      return null;
    }
  }
  if (match?.scorePublished === false) return null;
  if (match?.scoreAccepted === false) return null;

  const score = match?.score;
  if (score == null) {
    if (match?.validatedResult?.score != null) {
      return Object.freeze({
        display: match.validatedResult.score,
        published: true,
      });
    }
    return null;
  }
  if (typeof score === "object") {
    return Object.freeze({
      home: score.home ?? score.teamA ?? score.sideA ?? null,
      away: score.away ?? score.teamB ?? score.sideB ?? null,
      display: score.display ?? null,
      published: true,
    });
  }
  return Object.freeze({ display: score, published: true });
}
