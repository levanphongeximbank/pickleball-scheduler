export const CLUB_ACTIVITY_DAY_LABELS = Object.freeze({
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
  7: "Chủ nhật",
});

function normalizeTime(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function normalizeClubActivitySession(raw, defaults = {}) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const dayOfWeek = Number(raw.dayOfWeek);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    return null;
  }

  const startTime = normalizeTime(raw.startTime);
  const endTime = normalizeTime(raw.endTime);
  if (!startTime || !endTime) {
    return null;
  }

  const clubId = String(raw.clubId || defaults.clubId || "").trim();
  if (!clubId) {
    return null;
  }

  return {
    id: String(raw.id || defaults.id || `cas-${Date.now()}`).trim(),
    clubId,
    tenantId: String(raw.tenantId || defaults.tenantId || "").trim() || null,
    dayOfWeek,
    startTime,
    endTime,
    clusterId: raw.clusterId ? String(raw.clusterId).trim() : null,
    note: String(raw.note || "").trim(),
    createdBy: raw.createdBy ? String(raw.createdBy).trim() : null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

export function createClubActivitySessionRecord({
  clubId,
  tenantId,
  dayOfWeek,
  startTime,
  endTime,
  clusterId = null,
  note = "",
  createdBy = null,
}) {
  const now = new Date().toISOString();
  return normalizeClubActivitySession({
    id: `cas-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    clubId,
    tenantId,
    dayOfWeek,
    startTime,
    endTime,
    clusterId,
    note,
    createdBy,
    createdAt: now,
    updatedAt: now,
  });
}

export function formatClubActivityDayLabel(dayOfWeek) {
  return CLUB_ACTIVITY_DAY_LABELS[dayOfWeek] || `Ngày ${dayOfWeek}`;
}
