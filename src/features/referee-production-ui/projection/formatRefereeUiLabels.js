/**
 * Product-facing Vietnamese labels and safe display formatting.
 * Projection / UX only — not authority.
 */

import { COMPETITION_REFEREE_MODE } from "../../competition-engine/integration/referee/constants.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COMPETITION_MODE_LABEL_VI = Object.freeze({
  [COMPETITION_REFEREE_MODE.DAILY_PLAY]: "Vui chơi hằng ngày",
  [COMPETITION_REFEREE_MODE.INTERNAL]: "Giải nội bộ",
  [COMPETITION_REFEREE_MODE.OFFICIAL]: "Giải chính thức / mở rộng",
  [COMPETITION_REFEREE_MODE.TEAM]: "Giải đồng đội",
});

export const ASSIGNMENT_STATUS_LABEL_VI = Object.freeze({
  ASSIGNED: "Đã phân công",
  ACTIVE: "Đã phân công",
  READY: "Đã phân công",
  IN_PROGRESS: "Đang thi đấu",
  COMPLETED: "Đã hoàn tất",
  RELEASED: "Đã thu hồi",
  REVOKED: "Đã thu hồi",
});

export const MATCH_STATUS_LABEL_VI = Object.freeze({
  READY_TO_START: "Sẵn sàng",
  READY: "Sẵn sàng",
  NOT_STARTED: "Chưa bắt đầu",
  IN_PROGRESS: "Đang thi đấu",
  SUSPENDED: "Tạm dừng",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
});

export function isRawTechnicalId(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (UUID_RE.test(s)) return true;
  if (/^(team-|matchup-|sub-|entry-|p-|court-)/i.test(s) && !/\s/.test(s)) {
    return true;
  }
  return false;
}

export function formatCompetitionModeLabel(mode) {
  const key = String(mode || "").trim().toUpperCase();
  if (!key) return null;
  return COMPETITION_MODE_LABEL_VI[key] || null;
}

export function formatAssignmentStatusLabel(status) {
  const key = String(status || "").trim().toUpperCase();
  if (!key) return null;
  return ASSIGNMENT_STATUS_LABEL_VI[key] || null;
}

export function formatMatchStatusLabel(status) {
  const key = String(status || "").trim().toUpperCase();
  if (!key) return null;
  return MATCH_STATUS_LABEL_VI[key] || null;
}

/**
 * Format ISO/timestamp for local user timezone. Never return raw ISO in UI.
 * @param {string|number|Date|null|undefined} value
 * @param {string} [timeZone]
 */
export function formatLocalScheduledTime(value, timeZone) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: timeZone || undefined,
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
}

/**
 * Compact clock for assignment meta row (HH:mm). Never return raw ISO.
 * @param {string|number|Date|null|undefined} value
 * @param {string} [timeZone]
 */
export function formatCompactScheduledClock(value, timeZone) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: timeZone || undefined,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
}

/**
 * Prefer human court labels. Never show raw UUID as "Sân <uuid>".
 */
export function formatCourtLabel({ courtLabel, courtId } = {}) {
  const label = String(courtLabel || "").trim();
  if (label && !isRawTechnicalId(label)) return label;
  if (label && /^sân\s+/i.test(label) && !isRawTechnicalId(label.replace(/^sân\s+/i, ""))) {
    return label;
  }
  const id = String(courtId || "").trim();
  if (!id) return "Sân chưa xác định";
  if (isRawTechnicalId(id)) return "Sân chưa xác định";
  if (/^sân\s+/i.test(id)) return id;
  return `Sân ${id}`;
}

export function formatCompetitionDisplayName({ competitionName } = {}) {
  const name = String(competitionName || "").trim();
  if (name && !isRawTechnicalId(name)) return name;
  return "Giải chưa xác định tên";
}

export function formatParticipantDisplayName(raw, fallback = "Chưa có tên") {
  const name = String(raw || "").trim();
  if (!name || name === "—" || isRawTechnicalId(name)) return fallback;
  return name;
}
