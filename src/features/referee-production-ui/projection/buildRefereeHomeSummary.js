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
  const scheduledDayKey = resolveAssignmentLocalDayKey(card);
  return Object.freeze({
    ...card,
    scheduledDayKey,
    hasScheduledDate: scheduledDayKey != null,
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
 * Local calendar day key yyyy-mm-dd from a Date (browser/app local timezone).
 * @param {Date} date
 */
export function localDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Authoritative scheduled match local day — never infer from created/updated/display clock.
 * @param {object} card
 * @returns {string|null} yyyy-mm-dd or null when undated
 */
export function resolveAssignmentLocalDayKey(card = {}) {
  const raw =
    card?.scheduledTimeRaw ??
    card?.scheduledAt ??
    card?.matchScheduledAt ??
    null;
  if (raw == null || raw === "") return null;
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return localDayKey(date);
}

/**
 * Inclusive local-date range filter. Undated assignments are excluded.
 * @param {object[]} assignments
 * @param {{ fromDate?: string|Date|null, toDate?: string|Date|null, now?: Date }} [range]
 */
export function filterAssignmentsByDateRange(assignments = [], range = {}) {
  const list = Array.isArray(assignments) ? assignments : [];
  const now = range.now instanceof Date ? range.now : new Date();
  const fromKey = normalizeDayInput(range.fromDate, localDayKey(now));
  const toKey = normalizeDayInput(range.toDate, fromKey);
  const lo = fromKey <= toKey ? fromKey : toKey;
  const hi = fromKey <= toKey ? toKey : fromKey;

  return list.filter((card) => {
    const day = resolveAssignmentLocalDayKey(card);
    if (day == null) return false;
    return day >= lo && day <= hi;
  });
}

/**
 * Undated assignments (no authoritative scheduled datetime).
 * @param {object[]} assignments
 */
export function selectUndatedAssignments(assignments = []) {
  const list = Array.isArray(assignments) ? assignments : [];
  return list.filter((card) => resolveAssignmentLocalDayKey(card) == null);
}

/**
 * @param {object[]} assignments
 * @param {{ fromDate?: string|Date|null, toDate?: string|Date|null, now?: Date }} [range]
 * @deprecated Prefer filterAssignmentsByDateRange — kept for callers expecting a board list.
 */
export function selectRefereeHomeBoard(assignments = [], rangeOrNow = new Date()) {
  if (rangeOrNow instanceof Date) {
    const day = localDayKey(rangeOrNow);
    return filterAssignmentsByDateRange(assignments, {
      fromDate: day,
      toDate: day,
      now: rangeOrNow,
    });
  }
  return filterAssignmentsByDateRange(assignments, rangeOrNow || {});
}

function normalizeDayInput(value, fallbackKey) {
  if (value == null || value === "") return fallbackKey;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fallbackKey;
    return localDayKey(value);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallbackKey;
  return localDayKey(parsed);
}

function formatDayLabelVi(dayKey) {
  const [y, m, d] = String(dayKey).split("-");
  if (!y || !m || !d) return dayKey;
  return `${d}/${m}/${y}`;
}

/**
 * @param {string} fromKey
 * @param {string} toKey
 * @param {string} todayKey
 * @param {number} total
 */
export function buildHomeDateRangeHeadline(fromKey, toKey, todayKey, total) {
  if (fromKey === toKey) {
    if (fromKey === todayKey) return `Hôm nay: ${total} trận`;
    return `Ngày ${formatDayLabelVi(fromKey)}: ${total} trận`;
  }
  return `${formatDayLabelVi(fromKey)} – ${formatDayLabelVi(toKey)}: ${total} trận`;
}

/**
 * Empty-state copy for the selected date range (never falls back to historical).
 * @param {{ fromDate: string, toDate: string, todayKey: string, userLabel?: string }} input
 */
export function buildHomeDateRangeEmptyMessage(input = {}) {
  const fromKey = input.fromDate;
  const toKey = input.toDate;
  const todayKey = input.todayKey;
  if (fromKey === toKey && fromKey === todayKey) {
    return "Chưa có trận được phân công trong ngày hôm nay.";
  }
  if (fromKey === toKey) {
    return `Chưa có trận được phân công trong ngày ${formatDayLabelVi(fromKey)}.`;
  }
  return `Chưa có trận được phân công trong khoảng ${formatDayLabelVi(fromKey)} – ${formatDayLabelVi(toKey)}.`;
}

/**
 * @param {object[]} assignments
 * @param {Date|{ fromDate?: string|Date|null, toDate?: string|Date|null, now?: Date }} [rangeOrNow]
 */
export function buildRefereeHomeSummary(assignments = [], rangeOrNow = new Date()) {
  const now =
    rangeOrNow instanceof Date
      ? rangeOrNow
      : rangeOrNow?.now instanceof Date
        ? rangeOrNow.now
        : new Date();
  const todayKey = localDayKey(now);
  const fromKey =
    rangeOrNow instanceof Date
      ? todayKey
      : normalizeDayInput(rangeOrNow?.fromDate, todayKey);
  const toKey =
    rangeOrNow instanceof Date
      ? todayKey
      : normalizeDayInput(rangeOrNow?.toDate, fromKey);
  const lo = fromKey <= toKey ? fromKey : toKey;
  const hi = fromKey <= toKey ? toKey : fromKey;

  const board = filterAssignmentsByDateRange(assignments, {
    fromDate: lo,
    toDate: hi,
    now,
  }).map((card) => normalizeRefereeHomeCard(card));

  const undated = selectUndatedAssignments(assignments).map((card) =>
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
    totalInRange: board.length,
    fromDate: lo,
    toDate: hi,
    todayKey,
    headline: buildHomeDateRangeHeadline(lo, hi, todayKey, board.length),
    emptyMessage: buildHomeDateRangeEmptyMessage({
      fromDate: lo,
      toDate: hi,
      todayKey,
    }),
    board: Object.freeze(board),
    undatedAssignments: Object.freeze(undated),
    undatedCount: undated.length,
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
