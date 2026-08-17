/**
 * Internal Tournament Mode Court Adapter B.
 * Owner: 2.13 Competition Engine.
 * Path: Internal Tournament → this adapter → Head A → Court provider → Gateway.
 */
import { COMPETITION_TYPE } from "../../../competition-core/contracts/competitionCourtAdapterContract.js";
import { createModeCourtAdapterB } from "./createModeCourtAdapterB.js";

export const INTERNAL_TOURNAMENT_MODE_KEY = "internal_tournament";

export function createInternalTournamentCourtAdapter(overrides = {}) {
  return createModeCourtAdapterB({
    modeKey: INTERNAL_TOURNAMENT_MODE_KEY,
    competitionType: COMPETITION_TYPE.INTERNAL,
    headA: overrides.headA,
    headAOverrides: overrides.headAOverrides,
    buildRequestId({ competitionId, physicalCourtIds, date, startTime, startsAt }) {
      const courts = (physicalCourtIds || []).join(",");
      const span = startsAt || `${date || ""}T${startTime || ""}`;
      return `internal-reserve:${competitionId || "unknown"}:${courts}:${span}`;
    },
  });
}

export const internalTournamentCourtAdapter = createInternalTournamentCourtAdapter();
