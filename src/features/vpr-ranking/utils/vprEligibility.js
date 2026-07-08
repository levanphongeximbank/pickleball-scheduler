import {
  CERTIFICATION_STATUS,
  TOURNAMENT_STATUS,
  VPR_AWARD_STATUS,
  VPR_ELIGIBLE_LEVELS,
} from "../../../models/tournament/constants.js";

export function canAwardVprPoints(tournament) {
  if (!tournament) {
    return { ok: false, reason: "missing-tournament" };
  }
  if (tournament.rankingEnabled !== true) {
    return { ok: false, reason: "ranking-disabled" };
  }
  if (tournament.certificationStatus !== CERTIFICATION_STATUS.APPROVED) {
    return { ok: false, reason: "not-certified" };
  }
  if (tournament.status !== TOURNAMENT_STATUS.COMPLETED) {
    return { ok: false, reason: "not-completed" };
  }
  if (tournament.resultsConfirmation?.confirmed !== true) {
    return { ok: false, reason: "results-not-confirmed" };
  }
  if (tournament.vprAward?.status === VPR_AWARD_STATUS.AWARDED) {
    return { ok: false, reason: "already-awarded" };
  }
  return { ok: true };
}

export function shouldRequestCertification(tournamentLevel) {
  return VPR_ELIGIBLE_LEVELS.includes(tournamentLevel);
}
