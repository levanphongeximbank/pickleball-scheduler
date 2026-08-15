/**
 * Official/Open activation predicates for conditional adapters.
 * OPEN rating/ranking must not influence pairing or group draw.
 */

import { OFFICIAL_MODE } from "../../../models/tournament/constants.js";
import {
  getOfficialCompetitionSettings,
  isOfficialIndividualRegistrationMode,
  OFFICIAL_REGISTRATION_MODE,
} from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";
import { getEligibilityRules } from "../../individual-tournament/engines/eligibilityEngine.js";

function trimId(value) {
  return value != null ? String(value).trim() : "";
}

export function isOfficialOpenTournament(tournament) {
  const mode = String(tournament?.mode || "");
  return mode === "official_tournament" || Boolean(tournament?.officialMode);
}

export function isOpenMode(tournament) {
  return String(tournament?.officialMode || "") === OFFICIAL_MODE.OPEN;
}

export function isAiBalanceMode(tournament) {
  return String(tournament?.officialMode || "") === OFFICIAL_MODE.AI_BALANCE;
}

/**
 * A: configured Official/Open rating eligibility threshold/bound exists.
 */
export function hasConfiguredRatingEligibilityBound(tournament) {
  const rules = getEligibilityRules(tournament);
  return (
    rules.rating.enabled === true &&
    (rules.rating.minRating != null || rules.rating.maxRating != null)
  );
}

/**
 * B: AI_BALANCE + INDIVIDUAL registration + AI pairing requires rating evidence.
 */
export function aiBalanceIndividualPairingRequiresRating(tournament) {
  if (!isAiBalanceMode(tournament)) return false;
  if (!isOfficialIndividualRegistrationMode(tournament)) return false;
  return true;
}

/**
 * C: another explicitly configured rating-based competition rule.
 * Seeding-by-rating is not currently a separate Official/Open config surface.
 */
export function hasExplicitRatingCompetitionRule(tournament) {
  return false && tournament;
}

/**
 * Rating adapter activation. OPEN pairing/draw stay rating-neutral even when
 * eligibility rating bounds activate evidence for eligibility only.
 */
export function shouldActivateOfficialOpenRating(tournament) {
  return (
    hasConfiguredRatingEligibilityBound(tournament) ||
    aiBalanceIndividualPairingRequiresRating(tournament) ||
    hasExplicitRatingCompetitionRule(tournament)
  );
}

export function ratingMayInfluencePairing(tournament) {
  return aiBalanceIndividualPairingRequiresRating(tournament);
}

export function ratingMayInfluenceOpenPairingOrDraw() {
  return false;
}

export function shouldActivateOfficialOpenMembership(tournament) {
  const rules = getEligibilityRules(tournament);
  return rules.clubMembership.enabled === true;
}

export function shouldActivateOfficialOpenRanking(tournament) {
  const settings = tournament?.settings || {};
  const ranking = settings.rankingRequirement || settings.vprRankingRequirement;
  if (!ranking || typeof ranking !== "object") return false;
  return ranking.enabled === true;
}

export function shouldActivateOfficialOpenFederation(tournament) {
  const federation = tournament?.settings?.federation || tournament?.federation;
  if (!federation || typeof federation !== "object") return false;
  return (
    federation.enabled === true ||
    Boolean(trimId(federation.federationId)) ||
    Boolean(trimId(federation.sanctionId)) ||
    federation.requireLicense === true ||
    federation.requireExternalEligibility === true
  );
}

export function isPairRegistrationMode(tournament) {
  const competition = getOfficialCompetitionSettings(tournament);
  return competition.registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR;
}
