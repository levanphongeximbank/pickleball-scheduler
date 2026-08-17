/**
 * Official / Open Tournament Mode Court Adapter B.
 * Owner: 2.13 Competition Engine.
 * Path: Official/Open Tournament → this adapter → Head A → Court provider → Gateway.
 *
 * Official registration/seeding/draw/knockout/referee rules stay above this adapter.
 */
import { COMPETITION_TYPE } from "../../../competition-core/contracts/competitionCourtAdapterContract.js";
import { createModeCourtAdapterB } from "./createModeCourtAdapterB.js";

export const OFFICIAL_TOURNAMENT_MODE_KEY = "official_tournament";

export function createOfficialTournamentCourtAdapter(overrides = {}) {
  return createModeCourtAdapterB({
    modeKey: OFFICIAL_TOURNAMENT_MODE_KEY,
    competitionType: COMPETITION_TYPE.OFFICIAL_OPEN,
    headA: overrides.headA,
    headAOverrides: overrides.headAOverrides,
    buildRequestId({ competitionId, physicalCourtIds, date, startTime, startsAt }) {
      const courts = (physicalCourtIds || []).join(",");
      const span = startsAt || `${date || ""}T${startTime || ""}`;
      return `official-reserve:${competitionId || "unknown"}:${courts}:${span}`;
    },
  });
}

export const officialTournamentCourtAdapter = createOfficialTournamentCourtAdapter();
