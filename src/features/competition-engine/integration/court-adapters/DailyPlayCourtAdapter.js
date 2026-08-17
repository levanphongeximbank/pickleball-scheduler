/**
 * Daily Play Mode Court Adapter B.
 * Owner: 2.13 Competition Engine.
 * Path: Daily Play business → this adapter → Head A → Court provider → Gateway.
 *
 * Capacity: court_resource_reservations via Head A only.
 * Lease/session projection is owned by Daily Play separately — not Head A.
 * Must never call the certified D4 acquire RPC (would double-reserve capacity).
 */
import { createModeCourtAdapterB } from "./createModeCourtAdapterB.js";

export const DAILY_PLAY_MODE_KEY = "daily_play";
export const DAILY_PLAY_COMPETITION_TYPE = "daily_play";

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

export function createDailyPlayCourtAdapter(overrides = {}) {
  return createModeCourtAdapterB({
    modeKey: DAILY_PLAY_MODE_KEY,
    competitionType: DAILY_PLAY_COMPETITION_TYPE,
    headA: overrides.headA,
    headAOverrides: overrides.headAOverrides,
    buildRequestId({ competitionId, matchId, physicalCourtIds, date, startTime, startsAt }) {
      const courts = (physicalCourtIds || []).join(",");
      const span = startsAt || `${date || ""}T${startTime || ""}`;
      const match = trimId(matchId) || "session";
      return `daily-play-reserve:${competitionId || "unknown"}:${match}:${courts}:${span}`;
    },
  });
}

export const dailyPlayCourtAdapter = createDailyPlayCourtAdapter();
