/**
 * Team Tournament Mode Court Adapter B.
 * Owner: 2.13 Competition Engine.
 * Path: Team Tournament → this adapter → Head A → Court provider → Gateway.
 *
 * Court translation only — no team scoring, matchup, or stage policy logic.
 */
import { COMPETITION_TYPE } from "../../../competition-core/contracts/competitionCourtAdapterContract.js";
import { createModeCourtAdapterB } from "./createModeCourtAdapterB.js";

export const TEAM_TOURNAMENT_MODE_KEY = "team_tournament";

export function createTeamTournamentCourtAdapter(overrides = {}) {
  return createModeCourtAdapterB({
    modeKey: TEAM_TOURNAMENT_MODE_KEY,
    competitionType: COMPETITION_TYPE.TEAM,
    headA: overrides.headA,
    headAOverrides: overrides.headAOverrides,
    buildRequestId({ competitionId, physicalCourtIds, date, startTime, startsAt }) {
      const courts = (physicalCourtIds || []).join(",");
      const span = startsAt || `${date || ""}T${startTime || ""}`;
      return `team-reserve:${competitionId || "unknown"}:${courts}:${span}`;
    },
  });
}

export const teamTournamentCourtAdapter = createTeamTournamentCourtAdapter();
