/**
 * Honest Team Adapter B activation. OPTIONAL / NOT_REQUIRED is not fake success.
 */

import { FORMAT_PRESET, TEAM_GROUP_SEEDING } from "../../constants.js";
import { TEAM_ADAPTER_B_CLASSIFICATION } from "./constants.js";

function settingsOf(input = {}) {
  const tournament = input.tournament && typeof input.tournament === "object"
    ? input.tournament
    : {};
  const teamData = input.teamData && typeof input.teamData === "object"
    ? input.teamData
    : {};
  return {
    ...(tournament.settings && typeof tournament.settings === "object"
      ? tournament.settings
      : {}),
    ...(teamData.settings && typeof teamData.settings === "object"
      ? teamData.settings
      : {}),
  };
}

export function isTeamRatingActivated(input = {}) {
  if (input.activation === false) return false;
  if (input.activation === true || input.ratingActivated === true) return true;
  if (input.mlpRatingBalanced === true) return true;
  if (input.operation === "ai_team_formation") return true;
  if (input.ratingBasedGroupSeeding === true) return true;

  const settings = settingsOf(input);
  const skill = settings.eligibilityRules?.skill;
  if (skill?.enabled === true) return true;

  if (settings.formatPreset === FORMAT_PRESET.MLP_4 && input.operation === "ai_team_formation") {
    return true;
  }

  const seeding = settings.groupSeeding;
  if (
    seeding === TEAM_GROUP_SEEDING.AVG_LEVEL ||
    seeding === TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL
  ) {
    return true;
  }
  return false;
}

export function isTeamRankingActivated(input = {}) {
  if (input.activation === false) return false;
  if (input.activation === true) return true;
  const tournament = input.tournament || {};
  const settings = settingsOf(input);
  return (
    tournament.rankingEnabled === true ||
    settings.rankingEnabled === true ||
    input.rankingEnabled === true
  );
}

export function isTeamRefereeActivated(input = {}) {
  if (input.activation === false) return false;
  if (input.activation === true) return true;
  const settings = settingsOf(input);
  if (settings.refereeRuntime === false) return false;
  return true;
}

export function isTeamFinanceActivated(input = {}) {
  const settings = settingsOf(input);
  const fee = settings.entryFee && typeof settings.entryFee === "object"
    ? settings.entryFee
    : {};
  return fee.enabled === true && Number(fee.amount) > 0;
}

export function isTeamFederationActivated(input = {}) {
  const settings = settingsOf(input);
  const federation = settings.federation && typeof settings.federation === "object"
    ? settings.federation
    : {};
  return (
    federation.sanction === true ||
    federation.licenseRequired === true ||
    federation.externalEligibility === true ||
    federation.externalAuthorityValidation === true
  );
}

export function isTeamOptionalActivated(flagPath, input = {}) {
  if (input.activation === true) return true;
  const settings = settingsOf(input);
  const value = flagPath.split(".").reduce(
    (cursor, key) => (cursor && typeof cursor === "object" ? cursor[key] : undefined),
    settings
  );
  return value === true;
}

export function activationRecord(classification, activated) {
  return Object.freeze({
    classification,
    activation: activated === true,
    inactiveIsNotSuccess: classification !== TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED,
  });
}
