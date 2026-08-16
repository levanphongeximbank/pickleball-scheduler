/**
 * Home daily summary + status filter buckets — projection only.
 */

import { MATCH_STATUS } from "../../competition-core/matches/index.js";
import { mapModeStatusToCore15 } from "../../competition-engine/integration/referee/adapters/shared/matchStatusMapper.js";
import { ASSIGNMENT_CARD_ACTION } from "../constants.js";

export const HOME_STATUS_FILTER = Object.freeze({
  ALL: "ALL",
  UPCOMING: "UPCOMING",
  LIVE: "LIVE",
  DONE: "DONE",
});

export const HOME_STATUS_FILTER_LABEL = Object.freeze({
  ALL: "Tất cả",
  UPCOMING: "Sắp diễn ra",
  LIVE: "Đang thi đấu",
  DONE: "Hoàn tất",
});

const LIVE_STATUSES = new Set([
  MATCH_STATUS.IN_PROGRESS,
  MATCH_STATUS.SUSPENDED,
  MATCH_STATUS.PAUSED,
]);

const DONE_STATUSES = new Set([
  MATCH_STATUS.COMPLETED,
  MATCH_STATUS.CANCELLED,
]);

/**
 * @param {object} card
 * @returns {"UPCOMING"|"LIVE"|"DONE"}
 */
export function resolveAssignmentHomeBucket(card = {}) {
  // Prefer precomputed bucket from card builder (single source of truth).
  const precomputed = String(card.homeStatusBucket || "").trim().toUpperCase();
  if (
    precomputed === HOME_STATUS_FILTER.LIVE ||
    precomputed === HOME_STATUS_FILTER.DONE ||
    precomputed === HOME_STATUS_FILTER.UPCOMING
  ) {
    return precomputed;
  }

  // Action is product UX authority for Home tabs (TIẾP TỤC = đang thi đấu).
  if (card.action === ASSIGNMENT_CARD_ACTION.CONTINUE) return HOME_STATUS_FILTER.LIVE;
  if (card.action === ASSIGNMENT_CARD_ACTION.VIEW_RESULT) return HOME_STATUS_FILTER.DONE;
  if (card.acceptedOfficialResult === true) return HOME_STATUS_FILTER.DONE;

  const status = card.matchStatus
    ? mapModeStatusToCore15(card.matchStatus)
    : "";
  if (LIVE_STATUSES.has(status)) return HOME_STATUS_FILTER.LIVE;
  if (DONE_STATUSES.has(status)) return HOME_STATUS_FILTER.DONE;
  return HOME_STATUS_FILTER.UPCOMING;
}

/**
 * @param {object[]} assignments
 * @param {Date} [now]
 */
export function buildRefereeHomeSummary(assignments = [], now = new Date()) {
  const list = Array.isArray(assignments) ? assignments : [];
  const todayKey = localDayKey(now);
  const today = list.filter((card) => isAssignmentForDay(card, todayKey));
  const board = today.length > 0 ? today : list;

  let upcoming = 0;
  let live = 0;
  let done = 0;
  for (const card of board) {
    const bucket = resolveAssignmentHomeBucket(card);
    if (bucket === HOME_STATUS_FILTER.LIVE) live += 1;
    else if (bucket === HOME_STATUS_FILTER.DONE) done += 1;
    else upcoming += 1;
  }

  return Object.freeze({
    totalToday: board.length,
    headline: `Hôm nay: ${board.length} trận`,
    counters: Object.freeze({
      upcoming,
      live,
      done,
    }),
    filters: Object.freeze([
      Object.freeze({
        id: HOME_STATUS_FILTER.ALL,
        label: HOME_STATUS_FILTER_LABEL.ALL,
        count: board.length,
      }),
      Object.freeze({
        id: HOME_STATUS_FILTER.UPCOMING,
        label: HOME_STATUS_FILTER_LABEL.UPCOMING,
        count: upcoming,
      }),
      Object.freeze({
        id: HOME_STATUS_FILTER.LIVE,
        label: HOME_STATUS_FILTER_LABEL.LIVE,
        count: live,
      }),
      Object.freeze({
        id: HOME_STATUS_FILTER.DONE,
        label: HOME_STATUS_FILTER_LABEL.DONE,
        count: done,
      }),
    ]),
  });
}

/**
 * @param {object[]} assignments
 * @param {string} filterId
 */
export function filterAssignmentsByHomeStatus(assignments = [], filterId = HOME_STATUS_FILTER.ALL) {
  const list = Array.isArray(assignments) ? assignments : [];
  const key = String(filterId || HOME_STATUS_FILTER.ALL).toUpperCase();
  if (key === HOME_STATUS_FILTER.ALL) return list;
  return list.filter((card) => resolveAssignmentHomeBucket(card) === key);
}

function localDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isAssignmentForDay(card, dayKey) {
  const raw = card?.scheduledTimeRaw;
  if (raw == null || raw === "") return true;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return true;
  return localDayKey(date) === dayKey;
}
