/**
 * Resolve the Mode Court Adapter B for a competition mode.
 */
import { COMPETITION_TYPE } from "../../../competition-core/contracts/competitionCourtAdapterContract.js";
import { createDailyPlayCourtAdapter } from "./DailyPlayCourtAdapter.js";
import { createInternalTournamentCourtAdapter } from "./InternalTournamentCourtAdapter.js";
import { createOfficialTournamentCourtAdapter } from "./OfficialTournamentCourtAdapter.js";
import { createTeamTournamentCourtAdapter } from "./TeamTournamentCourtAdapter.js";

export function resolveCompetitionTypeForMode(modeOrType) {
  const raw = String(modeOrType || "").trim().toLowerCase();
  if (raw === "daily_play" || raw === "daily") {
    return "daily_play";
  }
  if (raw === "internal_tournament" || raw === COMPETITION_TYPE.INTERNAL || raw === "internal") {
    return COMPETITION_TYPE.INTERNAL;
  }
  if (
    raw === "official_tournament" ||
    raw === COMPETITION_TYPE.OFFICIAL_OPEN ||
    raw === "official" ||
    raw === "official_open" ||
    raw === "official_ai_balance"
  ) {
    return COMPETITION_TYPE.OFFICIAL_OPEN;
  }
  if (raw === "team_tournament" || raw === COMPETITION_TYPE.TEAM || raw === "team") {
    return COMPETITION_TYPE.TEAM;
  }
  return null;
}

export function createModeCourtAdapterForCompetition(modeOrType, overrides = {}) {
  const competitionType = resolveCompetitionTypeForMode(modeOrType);
  if (competitionType === "daily_play") {
    return createDailyPlayCourtAdapter(overrides);
  }
  if (competitionType === COMPETITION_TYPE.INTERNAL) {
    return createInternalTournamentCourtAdapter(overrides);
  }
  if (competitionType === COMPETITION_TYPE.OFFICIAL_OPEN) {
    return createOfficialTournamentCourtAdapter(overrides);
  }
  if (competitionType === COMPETITION_TYPE.TEAM) {
    return createTeamTournamentCourtAdapter(overrides);
  }
  return null;
}
