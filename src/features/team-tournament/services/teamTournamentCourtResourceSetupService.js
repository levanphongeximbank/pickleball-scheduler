import {
  getCourtAvailability,
  releaseCourts,
  reserveCourts,
} from "../../venue-court/services/courtResourceGateway.js";
import { listCanonicalCloudCourts } from "../../venue-court/services/canonicalCloudCourtInventory.js";

const GENERIC_SAVE_ERROR =
  "Không thể lưu cụm sân và sức chứa. Kiểm tra lịch sân rồi thử lại.";

function text(value) {
  return value == null ? "" : String(value).trim();
}

function uniqueIds(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => text(value))
        .filter(Boolean)
    ),
  ];
}

function isCivilDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text(value));
}

function isCivilTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text(value));
}

export function normalizeCourtCapacityWindow(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    date: text(source.date),
    startTime: text(source.startTime),
    endTime: text(source.endTime),
  };
}

export function validateTeamTournamentCourtResourceSetup(config = {}) {
  const clusterId = text(config.clusterId);
  const selectedCourtIds = uniqueIds(config.selectedCourtIds);
  const courtCapacityWindow = normalizeCourtCapacityWindow(
    config.courtCapacityWindow
  );

  if (!clusterId) {
    return { ok: false, error: "Vui lòng chọn cụm sân." };
  }
  if (selectedCourtIds.length === 0) {
    return { ok: false, error: "Vui lòng chọn ít nhất một sân vật lý." };
  }
  if (
    !isCivilDate(courtCapacityWindow.date) ||
    !isCivilTime(courtCapacityWindow.startTime) ||
    !isCivilTime(courtCapacityWindow.endTime)
  ) {
    return {
      ok: false,
      error: "Vui lòng nhập đủ ngày, giờ bắt đầu và giờ kết thúc.",
    };
  }
  if (courtCapacityWindow.endTime <= courtCapacityWindow.startTime) {
    return {
      ok: false,
      error: "Giờ kết thúc phải sau giờ bắt đầu.",
    };
  }

  return {
    ok: true,
    clusterId,
    selectedCourtIds,
    courtCapacityWindow,
  };
}

/**
 * Single Team Tournament application boundary for court-capacity setup.
 * Shared Venue/Court remains the inventory, membership, availability, and
 * reservation authority; this service only coordinates the consumer write.
 */
export async function saveTeamTournamentCourtResourceSetup(
  params = {},
  deps = {}
) {
  const normalized = validateTeamTournamentCourtResourceSetup(params.config);
  if (!normalized.ok) return normalized;

  const clubId = text(params.clubId);
  const venueId = text(params.venueId || params.tenantId);
  const tenantId = text(params.tenantId || params.venueId);
  const tournamentId = text(params.tournamentId);
  const owner = { type: "tournament", id: tournamentId };
  if (!clubId || !tournamentId) {
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }

  const availabilityFn = deps.getCourtAvailability || getCourtAvailability;
  const listCourtsFn = deps.listCanonicalCloudCourts || listCanonicalCloudCourts;
  const reserveFn = deps.reserveCourts || reserveCourts;
  const releaseFn = deps.releaseCourts || releaseCourts;
  const persistFn = deps.persistSetupConfig || params.persistSetupConfig;

  if (typeof persistFn !== "function") {
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }

  const scope = {
    clubId,
    tenantId,
    venueId,
    clusterId: normalized.clusterId,
    courtIds: normalized.selectedCourtIds,
    selectedCourtIds: normalized.selectedCourtIds,
    ...normalized.courtCapacityWindow,
    owner,
    context: { owner },
  };

  try {
    const inventory = await listCourtsFn({
      clubId,
      tenantId,
      venueId,
      clusterId: normalized.clusterId,
      includeInactive: false,
    });
    const courts = inventory?.ok ? inventory.courts || [] : [];
    const inventoryIds = new Set(courts.map((court) => text(court?.id)));
    if (
      !inventory?.ok ||
      normalized.selectedCourtIds.some((courtId) => !inventoryIds.has(courtId))
    ) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }

    const availability = await availabilityFn({
      ...scope,
      courts,
      includeUnavailable: true,
    });
    const unavailable = (availability?.courts || []).filter(
      (court) => court?.available !== true
    );
    const returnedIds = new Set(
      (availability?.courts || []).map((court) => text(court?.courtId))
    );
    const missing = normalized.selectedCourtIds.filter(
      (courtId) => !returnedIds.has(courtId)
    );
    if (unavailable.length > 0 || missing.length > 0) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }

    const reservation = await reserveFn({
      ...scope,
      courts,
      label: text(params.tournamentName) || tournamentId,
    });
    if (!reservation?.ok) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }

    const result = await persistFn({
      ...params.config,
      clusterId: normalized.clusterId,
      selectedCourtIds: normalized.selectedCourtIds,
      courtCapacityWindow: normalized.courtCapacityWindow,
    });
    if (result?.ok) return result;

    const createdCourtIds = uniqueIds(
      (reservation.created || []).map(
        (booking) => booking?.courtId || booking?.court_id
      )
    );
    if (createdCourtIds.length > 0) {
      try {
        await releaseFn({
          clubId,
          owner,
          courtIds: createdCourtIds,
        });
      } catch {
        // Best-effort owned compensation only. Never broaden the release scope.
      }
    }
    return { ok: false, error: GENERIC_SAVE_ERROR };
  } catch {
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }
}

export async function checkTeamTournamentCourtResourceReadiness(
  params = {},
  deps = {}
) {
  const normalized = validateTeamTournamentCourtResourceSetup(params.config);
  if (!normalized.ok) return normalized;

  const clubId = text(params.clubId);
  const venueId = text(params.venueId || params.tenantId);
  const tenantId = text(params.tenantId || params.venueId);
  const tournamentId = text(params.tournamentId);
  if (!clubId || !tournamentId) {
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }

  try {
    const inventory = await (
      deps.listCanonicalCloudCourts || listCanonicalCloudCourts
    )({
      clubId,
      tenantId,
      venueId,
      clusterId: normalized.clusterId,
      includeInactive: false,
    });
    const courts = inventory?.ok ? inventory.courts || [] : [];
    const inventoryIds = new Set(courts.map((court) => text(court?.id)));
    if (
      !inventory?.ok ||
      normalized.selectedCourtIds.some((courtId) => !inventoryIds.has(courtId))
    ) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }

    const owner = { type: "tournament", id: tournamentId };
    const availability = await (
      deps.getCourtAvailability || getCourtAvailability
    )({
      clubId,
      tenantId,
      venueId,
      clusterId: normalized.clusterId,
      courtIds: normalized.selectedCourtIds,
      courts,
      ...normalized.courtCapacityWindow,
      owner,
      context: { owner },
      includeUnavailable: true,
    });
    const rows = availability?.courts || [];
    if (
      rows.length !== normalized.selectedCourtIds.length ||
      rows.some(
        (row) =>
          row?.available !== true ||
          row?.ownership?.status !== "own_reservation"
      )
    ) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }
    return { ok: true, courts, availability };
  } catch {
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }
}

