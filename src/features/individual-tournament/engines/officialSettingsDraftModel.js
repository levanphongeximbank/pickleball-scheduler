/**
 * Official Settings local draft model — prevents soft-poll / context refresh
 * from wiping unsaved edits (CANONICAL_REHYDRATE_OVERWRITE).
 *
 * Hydrate only when canonical identity fingerprint changes and draft is clean.
 */
import {
  getOfficialCompetitionSettings,
  OFFICIAL_MATCH_FORMAT,
  OFFICIAL_SCORING_METHOD,
} from "./officialTournamentSettingsEngine.js";
import { getEligibilityRules } from "./eligibilityEngine.js";

export function buildOfficialSettingsCanonicalFingerprint(tournament) {
  const settings = getOfficialCompetitionSettings(tournament);
  const eligibility = getEligibilityRules(tournament);
  return JSON.stringify({
    id: String(tournament?.id || ""),
    version: Number(tournament?.version) || 0,
    name: String(tournament?.name || "").trim(),
    registrationMode: settings.registrationMode || "",
    scoringMethod: settings.scoringMethod || "",
    matchFormat: settings.matchFormat || "",
    roundTargets: settings.roundTargets || {},
    groupCount: settings.groupCount,
    qualifiersPerGroup: settings.qualifiersPerGroup,
    maxSkillLevel: eligibility.skill?.maxLevel ?? null,
    maxRating: eligibility.rating?.maxRating ?? null,
  });
}

export function buildOfficialSettingsDraftFromTournament(tournament) {
  const current = getOfficialCompetitionSettings(tournament);
  const eligibility = getEligibilityRules(tournament);
  return {
    tournamentName: tournament?.name || "",
    registrationMode: current.registrationMode || "",
    scoringMethod: current.scoringMethod || OFFICIAL_SCORING_METHOD.RALLY,
    matchFormat: current.matchFormat || OFFICIAL_MATCH_FORMAT.BEST_OF_1,
    roundTargets: { ...current.roundTargets },
    qualifiersPerGroup: current.qualifiersPerGroup || 2,
    maxSkillLevel:
      eligibility.skill?.maxLevel != null ? String(eligibility.skill.maxLevel) : "",
    maxRating:
      eligibility.rating?.maxRating != null ? String(eligibility.rating.maxRating) : "",
  };
}

export function officialSettingsDraftEqualsCanonical(draft, tournament) {
  const canonical = buildOfficialSettingsDraftFromTournament(tournament);
  return JSON.stringify(draft) === JSON.stringify(canonical);
}
