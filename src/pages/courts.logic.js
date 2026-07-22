import { getScopedStorageKey } from "../data/club.js";
import {
  loadCourtsForClub,
  saveCourtsForClub,
} from "../domain/clubStorage.js";
import {
  getCourtDisplayName,
  normalizeCourt,
  normalizeCourts,
} from "../models/court.js";
import { guardMaxCourtsForClub, countCourtsForVenue, getVenuePlanContext } from "../auth/subscriptionGuard.js";
import { guardClubAction } from "../auth/guardAction.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { isRbacEnabled } from "../auth/authService.js";
import { getClubById } from "../domain/clubService.js";
import {
  ensureCourtsHaveClusterId,
  filterCourtsByCluster,
  syncClusterCourtCount,
} from "../features/court-cluster/services/courtClusterService.js";
import { isCourtClustersEnabled } from "../features/court-cluster/config/clusterFlags.js";

const COURTS_STORAGE_KEY = "courts";

export { getCourtDisplayName, normalizeCourt, normalizeCourts };

function loadAllCourtsRaw(fallbackCourts = [], clubId) {
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
    return Array.isArray(parsed) ? normalizeCourts(parsed) : normalizeCourts(fallbackCourts);
  } catch {
    return normalizeCourts(fallbackCourts);
  }
}

export function loadCourts(fallbackCourts = [], clubId, { clusterId = null, venueId = null } = {}) {
  const normalized = loadAllCourtsRaw(fallbackCourts, clubId);
  const club = getClubById(clubId);
  const resolvedVenueId = venueId || club?.venueId || club?.tenantId || null;
  const withCluster = ensureCourtsHaveClusterId(normalized, resolvedVenueId);
  return filterCourtsByCluster(withCluster, clusterId);
}

export function saveCourts(courts, clubId, options = {}) {
  const permission = options.permission || PERMISSIONS.COURT_UPDATE;
  const clusterId = options.clusterId || null;
  const check = guardClubAction(
    clubId,
    permission,
    clusterId ? { clusterId } : {},
    options
  );
  if (!check.ok) {
    return check;
  }

  const club = getClubById(clubId);
  const venueId = club?.venueId || club?.tenantId || null;
  let courtsToSave = normalizeCourts(courts);

  if (isCourtClustersEnabled() && clusterId) {
    const existing = ensureCourtsHaveClusterId(loadAllCourtsRaw([], clubId), venueId);
    const others = existing.filter((court) => court.clusterId !== clusterId);
    courtsToSave = [
      ...others,
      ...courtsToSave.map((court) => ({ ...court, clusterId })),
    ];
  } else if (isCourtClustersEnabled() && venueId) {
    courtsToSave = ensureCourtsHaveClusterId(courtsToSave, venueId);
  }

  saveCourtsForClub(courtsToSave, clubId);
  localStorage.setItem(
    getScopedStorageKey(COURTS_STORAGE_KEY, clubId),
    JSON.stringify(normalizeCourts(courtsToSave))
  );

  if (isCourtClustersEnabled()) {
    const stamped = ensureCourtsHaveClusterId(courtsToSave, venueId);
    const clusterIds = [...new Set(stamped.map((court) => court.clusterId).filter(Boolean))];
    for (const id of clusterIds) {
      const count = stamped.filter((court) => court.clusterId === id).length;
      syncClusterCourtCount(id, count);
    }
  }

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

export function validateCourtLimitBulk(clubId, addCount = 1) {
  const count = Number(addCount);
  if (!Number.isFinite(count) || count < 1) {
    return "Số lượng sân không hợp lệ.";
  }

  const club = getClubById(clubId);
  const venueId = club?.venueId;
  if (!venueId) {
    for (let index = 0; index < count; index += 1) {
      const limitError = validateCourtLimit(clubId, { isNew: true });
      if (limitError) {
        return limitError;
      }
    }
    return null;
  }

  const { plan } = getVenuePlanContext(venueId);
  const total = countCourtsForVenue(venueId) + count;
  if (total > plan.maxCourts) {
    return `Gói hiện tại cho phép tối đa ${plan.maxCourts} sân trên venue. Nâng cấp gói để thêm sân.`;
  }

  return null;
}

export function buildBulkCourtRecords(courts, count, options = {}) {
  const targetCount = Number(count);
  if (!Number.isFinite(targetCount) || targetCount < 1) {
    return [];
  }

  const namePrefix = String(options.namePrefix || "Sân").trim() || "Sân";
  let startNumber = Number(options.startNumber);
  if (!Number.isFinite(startNumber) || startNumber < 1) {
    startNumber = 1;
  }

  const usedNumbers = new Set(
    courts
      .map((court) => court.number)
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  );
  const usedNames = new Set(
    courts.map((court) => String(court.name || "").trim().toLowerCase()).filter(Boolean)
  );

  const created = [];
  let number = startNumber;

  while (created.length < targetCount) {
    while (usedNumbers.has(number)) {
      number += 1;
    }

    const name = `${namePrefix} ${number}`;
    const normalizedName = name.toLowerCase();

    if (!usedNames.has(normalizedName)) {
      created.push(
        normalizeCourt({
          id: Date.now() + created.length,
          name,
          number,
          active: true,
          status: "active",
        })
      );
      usedNumbers.add(number);
      usedNames.add(normalizedName);
    }

    number += 1;
  }

  return created;
}

export function createCourtsBulk(courts, count, options = {}) {
  const additions = buildBulkCourtRecords(courts, count, options);
  return [...courts, ...additions];
}

export function getCourtCapacityForClub(clubId) {
  const club = getClubById(clubId);
  const venueId = club?.venueId;
  if (!venueId) {
    return null;
  }

  const { plan, planId } = getVenuePlanContext(venueId);
  const current = countCourtsForVenue(venueId);
  const maxCourts = plan?.maxCourts ?? null;

  return {
    venueId,
    current,
    maxCourts,
    remaining: maxCourts == null ? null : Math.max(0, maxCourts - current),
    planId,
    planName: plan?.name || planId,
  };
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
    clusterId: extra.clusterId,
    // Only forward priority when explicitly supplied; never invent a default.
    ...(Object.prototype.hasOwnProperty.call(extra, "priority")
      ? { priority: extra.priority }
      : {}),
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
