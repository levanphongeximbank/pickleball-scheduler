/**
 * Internal Tournament Adapter B — conditional / optional / disabled activation.
 * Inactive adapters must not block Internal lifecycle.
 * Required-but-NOT_CONFIGURED must fail honestly — never fake success.
 */
import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";

export const INTERNAL_ADAPTER_ACTIVATION = Object.freeze({
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  DISABLED: "DISABLED",
  OPTIONAL: "OPTIONAL",
});

function settingsOf(tournament) {
  return tournament?.settings && typeof tournament.settings === "object"
    ? tournament.settings
    : {};
}

function hasExplicitRatingRule(tournament) {
  const settings = settingsOf(tournament);
  const pairing = settings.pairing || settings.draw || {};
  if (settings.useRating === false || pairing.useRating === false) {
    return false;
  }
  if (String(tournament?.mode || "") === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return true;
  }
  return Boolean(
    settings.minRating != null ||
      settings.maxRating != null ||
      settings.skillBand ||
      settings.balanceByRating === true ||
      settings.useRatingSeeding === true ||
      pairing.useRating === true ||
      pairing.strategyKey === "skill_controlled" ||
      pairing.seedBy === "rating"
  );
}

function hasExplicitExternalRankingRule(tournament) {
  const settings = settingsOf(tournament);
  return Boolean(
    settings.externalRanking ||
      settings.rankingProvider ||
      settings.vprRanking === true ||
      settings.rankingRule
  );
}

function hasFinanceRule(tournament) {
  const settings = settingsOf(tournament);
  const finance = settings.finance || settings.payment || {};
  return Boolean(
    settings.entryFee != null ||
      settings.fee ||
      settings.prize ||
      settings.settlement ||
      settings.waiver ||
      settings.refund ||
      finance.entryFee != null ||
      finance.prize ||
      finance.settlement ||
      finance.waiver ||
      finance.refund
  );
}

/**
 * @param {object} [tournament]
 */
export function resolveInternalConditionalAdapterActivation(tournament = null) {
  const rating = hasExplicitRatingRule(tournament)
    ? INTERNAL_ADAPTER_ACTIVATION.ACTIVE
    : INTERNAL_ADAPTER_ACTIVATION.INACTIVE;
  const ranking = hasExplicitExternalRankingRule(tournament)
    ? INTERNAL_ADAPTER_ACTIVATION.ACTIVE
    : INTERNAL_ADAPTER_ACTIVATION.INACTIVE;
  const finance = hasFinanceRule(tournament)
    ? INTERNAL_ADAPTER_ACTIVATION.ACTIVE
    : INTERNAL_ADAPTER_ACTIVATION.INACTIVE;

  return Object.freeze({
    identity: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    tenant: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    participant: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    membership: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    rating,
    ranking,
    court: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    referee: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    finance,
    notification: INTERNAL_ADAPTER_ACTIVATION.OPTIONAL,
    fileMedia: INTERNAL_ADAPTER_ACTIVATION.OPTIONAL,
    streaming: INTERNAL_ADAPTER_ACTIVATION.OPTIONAL,
    federation: INTERNAL_ADAPTER_ACTIVATION.DISABLED,
    crm: INTERNAL_ADAPTER_ACTIVATION.DISABLED,
    analytics: INTERNAL_ADAPTER_ACTIVATION.OPTIONAL,
    audit: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    lifecycleBlockedByInactiveConditional: false,
  });
}

export function isInternalConditionalAdapterRequired(activationKey, tournament) {
  const activation = resolveInternalConditionalAdapterActivation(tournament);
  return activation[activationKey] === INTERNAL_ADAPTER_ACTIVATION.ACTIVE;
}
