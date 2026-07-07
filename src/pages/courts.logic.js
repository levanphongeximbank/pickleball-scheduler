import { getScopedStorageKey } from "../data/club";
import {
  loadCourtsForClub,
  saveCourtsForClub,
} from "../domain/clubStorage.js";
import {
  getCourtDisplayName,
  normalizeCourt,
  normalizeCourts,
} from "../models/court.js";
import { guardMaxCourtsForClub } from "../auth/subscriptionGuard.js";
import { guardClubAction } from "../auth/guardAction.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { isRbacEnabled } from "../auth/authService.js";

const COURTS_STORAGE_KEY = "courts";

export { getCourtDisplayName, normalizeCourt, normalizeCourts };

export function loadCourts(fallbackCourts = [], clubId) {
  const courts = loadCourtsForClub(clubId);

  if (courts.length > 0) {
    return courts;
  }

  const scopedKey = getScopedStorageKey(COURTS_STORAGE_KEY, clubId);
  const raw =
    localStorage.getItem(scopedKey) ||
    (!isRbacEnabled() ? localStorage.getItem(COURTS_STORAGE_KEY) : null);

  if (!raw) {
    return normalizeCourts(fallbackCourts);
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return normalizeCourts(fallbackCourts);
    }

    return normalizeCourts(parsed);
  } catch {
    return normalizeCourts(fallbackCourts);
  }
}

export function saveCourts(courts, clubId, options = {}) {
  const permission = options.permission || PERMISSIONS.COURT_UPDATE;
  const check = guardClubAction(clubId, permission, {}, options);
  if (!check.ok) {
    return check;
  }

  saveCourtsForClub(courts, clubId);
  localStorage.setItem(
    getScopedStorageKey(COURTS_STORAGE_KEY, clubId),
    JSON.stringify(normalizeCourts(courts))
  );
  return { ok: true };
}

export function validateCourtName(name) {
  if (!name || String(name).trim() === "") {
    return "Vui lòng nhập tên sân";
  }

  return null;
}

export function validateCourtLimit(clubId, { isNew = false } = {}) {
  const check = guardMaxCourtsForClub(clubId, { isNew });
  return check.ok ? null : check.error;
}

export function upsertCourt(courts, { courtName, courtNumber, editingCourt = null, extra = {} }) {
  const courtData = {
    name: String(courtName).trim(),
    number: courtNumber === "" || courtNumber === null ? null : Number(courtNumber),
    active: extra.active !== undefined ? extra.active : true,
    status: extra.status,
    courtType: extra.courtType,
    defaultHourlyRate: extra.defaultHourlyRate,
    peakHourlyRate: extra.peakHourlyRate,
    note: extra.note,
  };

  if (editingCourt) {
    return courts.map((court) =>
      court.id === editingCourt.id
        ? normalizeCourt({
            ...court,
            ...courtData,
          })
        : court
    );
  }

  return [
    ...courts,
    normalizeCourt({
      id: Date.now(),
      ...courtData,
    }),
  ];
}

export function removeCourt(courts, courtId) {
  return courts.filter((court) => court.id !== courtId);
}

export function toggleCourtStatus(courts, courtId) {
  return courts.map((court) =>
    court.id === courtId
      ? {
          ...court,
          active: court.active === false,
        }
      : court
  );
}
