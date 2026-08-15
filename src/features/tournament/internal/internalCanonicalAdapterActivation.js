/**
 * Internal Tournament Adapter B — conditional / optional / disabled activation.
 * Inactive adapters must not block Internal lifecycle.
 * Required-but-NOT_CONFIGURED must fail honestly — never fake success.
 *
 * Rating ACTIVE only when an explicit rating rule exists.
 * Referee ACTIVE only when an explicit referee requirement exists.
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

function pairingOf(settings) {
  return settings.pairing && typeof settings.pairing === "object"
    ? settings.pairing
    : settings.draw && typeof settings.draw === "object"
      ? settings.draw
      : {};
}

/**
 * Explicit rating rule only. mode=INTERNAL_TOURNAMENT alone is NOT enough.
 */
export function hasExplicitInternalRatingRule(tournament) {
  const settings = settingsOf(tournament);
  const pairing = pairingOf(settings);
  if (settings.useRating === false || pairing.useRating === false) {
    return false;
  }
  return Boolean(
    settings.minRating != null ||
      settings.maxRating != null ||
      settings.skillBand ||
      settings.balanceByRating === true ||
      settings.useRatingSeeding === true ||
      settings.useRating === true ||
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

function normalizeLower(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

/**
 * Explicit Internal referee policy.
 * Self-scored / optional / disabled → INACTIVE.
 * Tournament/stage/match require referee → ACTIVE.
 * Does not invent assignment authority.
 */
export function resolveInternalRefereeActivation(tournament = null) {
  const settings = settingsOf(tournament);
  const referee =
    settings.referee && typeof settings.referee === "object" ? settings.referee : {};
  const scoringMode = normalizeLower(
    settings.scoringMode || settings.resultEntryMode || referee.scoringMode
  );
  const refereeMode = normalizeLower(
    settings.refereeMode || referee.mode || referee.policy
  );

  if (
    settings.requireReferee === false ||
    settings.refereeRequired === false ||
    referee.required === false ||
    referee.enabled === false ||
    scoringMode === "self_scored" ||
    scoringMode === "selfscore" ||
    scoringMode === "organizer_self_score" ||
    refereeMode === "optional" ||
    refereeMode === "self_scored" ||
    refereeMode === "disabled" ||
    refereeMode === "none"
  ) {
    return INTERNAL_ADAPTER_ACTIVATION.INACTIVE;
  }

  if (
    settings.requireReferee === true ||
    settings.refereeRequired === true ||
    referee.required === true ||
    referee.enabled === true ||
    refereeMode === "required" ||
    refereeMode === "mandatory"
  ) {
    return INTERNAL_ADAPTER_ACTIVATION.ACTIVE;
  }

  const stages = settings.stages && typeof settings.stages === "object" ? settings.stages : {};
  for (const stage of Object.values(stages)) {
    if (!stage || typeof stage !== "object") continue;
    if (
      stage.requireReferee === true ||
      stage.refereeRequired === true ||
      stage.referee?.required === true
    ) {
      return INTERNAL_ADAPTER_ACTIVATION.ACTIVE;
    }
  }

  const events = Array.isArray(tournament?.events) ? tournament.events : [];
  for (const event of events) {
    const matches = Array.isArray(event?.matches) ? event.matches : [];
    for (const match of matches) {
      if (match?.requireReferee === true || match?.refereeRequired === true) {
        return INTERNAL_ADAPTER_ACTIVATION.ACTIVE;
      }
    }
  }

  void TOURNAMENT_MODE;
  return INTERNAL_ADAPTER_ACTIVATION.INACTIVE;
}

/**
 * @param {object} [tournament]
 */
export function resolveInternalConditionalAdapterActivation(tournament = null) {
  const rating = hasExplicitInternalRatingRule(tournament)
    ? INTERNAL_ADAPTER_ACTIVATION.ACTIVE
    : INTERNAL_ADAPTER_ACTIVATION.INACTIVE;
  const ranking = hasExplicitExternalRankingRule(tournament)
    ? INTERNAL_ADAPTER_ACTIVATION.ACTIVE
    : INTERNAL_ADAPTER_ACTIVATION.INACTIVE;
  const finance = hasFinanceRule(tournament)
    ? INTERNAL_ADAPTER_ACTIVATION.ACTIVE
    : INTERNAL_ADAPTER_ACTIVATION.INACTIVE;
  const referee = resolveInternalRefereeActivation(tournament);

  return Object.freeze({
    identity: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    tenant: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    participant: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    membership: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    rating,
    ranking,
    court: INTERNAL_ADAPTER_ACTIVATION.ACTIVE,
    referee,
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
