/**
 * Home daily summary + status filter buckets — projection only.
 */

import { MATCH_STATUS } from "../../competition-core/matches/index.js";
import { mapModeStatusToCore15 } from "../../competition-engine/integration/referee/adapters/shared/matchStatusMapper.js";
import { ASSIGNMENT_CARD_ACTION, ASSIGNMENT_CARD_ACTION_LABEL } from "../constants.js";

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
 * Single source for Home tabs/counters/labels.
 * Product rule: TIẾP TỤC = Đang thi đấu (never trust a stale homeStatusBucket).
 * @param {object} card
 * @returns {"UPCOMING"|"LIVE"|"DONE"}
 */
export function resolveAssignmentHomeBucket(card = {}) {
  const status = card.matchStatus ? mapModeStatusToCore15(card.matchStatus) : "";
  // Live lifecycle wins over a stale VIEW_RESULT action from partial enrichment.
  if (LIVE_STATUSES.has(status)) return HOME_STATUS_FILTER.LIVE;

  const action = String(card.action || "").trim().toUpperCase();
  const actionLabel = String(card.actionLabel || "").trim().toUpperCase();

  if (
    action === ASSIGNMENT_CARD_ACTION.CONTINUE ||
    actionLabel === String(ASSIGNMENT_CARD_ACTION_LABEL.CONTINUE).toUpperCase()
  ) {
    return HOME_STATUS_FILTER.LIVE;
  }
  if (
    action === ASSIGNMENT_CARD_ACTION.VIEW_RESULT ||
    actionLabel === String(ASSIGNMENT_CARD_ACTION_LABEL.VIEW_RESULT).toUpperCase()
  ) {
    return HOME_STATUS_FILTER.DONE;
  }
  if (card.acceptedOfficialResult === true) return HOME_STATUS_FILTER.DONE;
  if (DONE_STATUSES.has(status)) return HOME_STATUS_FILTER.DONE;
  return HOME_STATUS_FILTER.UPCOMING;
}

/**
 * Recompute bucket + Vietnamese label so Home never shows mismatched chip vs counters.
 * @param {object} card
 */
export function normalizeRefereeHomeCard(card = {}) {
  const bucket = resolveAssignmentHomeBucket({
    ...card,
    homeStatusBucket: undefined,
  });
  return Object.freeze({
    ...card,
    homeStatusBucket: bucket,
    homeStatusLabel:
      bucket === HOME_STATUS_FILTER.LIVE
        ? "Đang thi đấu"
        : bucket === HOME_STATUS_FILTER.DONE
          ? "Hoàn tất"
          : "Sắp diễn ra",
  });
}

/**
 * @param {object[]} assignments
 * @param {Date} [now]
 */
export function selectRefereeHomeBoard(assignments = [], now = new Date()) {
  const list = Array.isArray(assignments) ? assignments : [];
  const todayKey = localDayKey(now);
  const today = list.filter((card) => isAssignmentForDay(card, todayKey));
  // Prefer today's matches when any exist; otherwise show the full assignment list.
  return today.length > 0 ? today : list;
}

/**
 * @param {object[]} assignments
 * @param {Date} [now]
 */
export function buildRefereeHomeSummary(assignments = [], now = new Date()) {
  const board = selectRefereeHomeBoard(assignments, now).map((card) =>
    normalizeRefereeHomeCard(card)
  );

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
    board: Object.freeze(board),
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
