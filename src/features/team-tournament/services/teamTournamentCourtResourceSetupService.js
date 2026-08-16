import {
  COMPETITION_COURT_RESULT_CODE,
} from "../../competition-core/contracts/competitionCourtAdapterContract.js";
import {
  createTeamTournamentCourtAdapter,
  toFormatVenueCourt,
} from "../adapters/canonical/TeamTournamentCourtAdapter.js";

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

function physicalId(court) {
  return text(court?.physicalCourtId || court?.id || court?.courtId);
}

function isOwnReservation(row) {
  const status = String(row?.ownership?.status || "").toLowerCase();
  return (
    row?.resultCode === COMPETITION_COURT_RESULT_CODE.OWN_RESERVATION ||
    status === "own_reservation"
  );
}

function isAvailable(row) {
  return row?.available === true || row?.resultCode === COMPETITION_COURT_RESULT_CODE.AVAILABLE || isOwnReservation(row);
}

function wrapLegacyCourtDeps(deps = {}) {
  if (deps.courtAdapter) return deps.courtAdapter;
  const hasLegacy =
    typeof deps.listCanonicalCloudCourts === "function" ||
    typeof deps.getCourtAvailability === "function" ||
    typeof deps.reserveCourts === "function";
  if (!hasLegacy) {
    return createTeamTournamentCourtAdapter(deps.courtDeps || {});
  }

  return {
    async listEligibleCourts(input = {}) {
      const listed = await deps.listCanonicalCloudCourts({
        clubId: input.clubId,
        tenantId: input.tenantId,
        venueId: input.venueId,
        clusterId: input.clusterId,
        includeInactive: false,
      });
      const courts = listed?.ok ? listed.courts || [] : [];
      return {
        ok: listed?.ok === true,
        courts: courts.map((court) => ({
          ...court,
          physicalCourtId: physicalId(court),
          clusterId: court.clusterId,
        })),
      };
    },
    async getCourtAvailability(input = {}) {
      const availability = await deps.getCourtAvailability({
        clubId: input.clubId,
        tenantId: input.tenantId,
        venueId: input.venueId,
        clusterId: input.clusterId,
        courtIds: input.physicalCourtIds || input.selectedCourtIds,
        selectedCourtIds: input.physicalCourtIds || input.selectedCourtIds,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        owner: { type: "tournament", id: input.competitionId },
        context: { owner: { type: "tournament", id: input.competitionId } },
        includeUnavailable: input.includeUnavailable !== false,
        courts: input.courts,
      });
      return {
        ok: true,
        courts: (availability?.courts || []).map((row) => ({
          ...row,
          physicalCourtId: physicalId(row) || text(row.courtId),
          available: row.available === true,
          resultCode:
            row.ownership?.status === "own_reservation"
              ? COMPETITION_COURT_RESULT_CODE.OWN_RESERVATION
              : row.available === true
                ? COMPETITION_COURT_RESULT_CODE.AVAILABLE
                : row.resultCode,
          ownership: row.ownership,
        })),
      };
    },
    async reserveCourts(input = {}) {
      const reservation = await deps.reserveCourts({
        clubId: input.clubId,
        tenantId: input.tenantId,
        venueId: input.venueId,
        clusterId: input.clusterId,
        selectedCourtIds: input.physicalCourtIds,
        courtIds: input.physicalCourtIds,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        owner: { type: "tournament", id: input.competitionId },
        label: input.label,
        courts: input.courts,
      });
      return {
        ok: reservation?.ok === true,
        reserved: (reservation?.created || []).map((booking) => ({
          physicalCourtId: text(booking?.courtId || booking?.court_id),
        })),
        created: reservation?.created || [],
        error: reservation?.error,
      };
    },
    async releaseCourts(input = {}) {
      const releaseFn = deps.releaseCourts;
      if (typeof releaseFn !== "function") return { ok: true, released: [] };
      return releaseFn({
        clubId: input.clubId,
        owner: { type: "tournament", id: input.competitionId },
        courtIds: input.physicalCourtIds,
      });
    },
  };
}

function teamCourtContext(params, normalized) {
  return {
    clubId: text(params.clubId),
    tenantId: text(params.tenantId),
    venueId: text(params.venueId),
    competitionId: text(params.tournamentId || params.competitionId),
    competitionType: "team",
    clusterId: normalized.clusterId,
    physicalCourtIds: normalized.selectedCourtIds,
    selectedCourtIds: normalized.selectedCourtIds,
    date: normalized.courtCapacityWindow.date,
    startTime: normalized.courtCapacityWindow.startTime,
    endTime: normalized.courtCapacityWindow.endTime,
    label: text(params.tournamentName) || text(params.tournamentId),
  };
}

/**
 * Single Team Tournament application boundary for court-capacity setup.
 * Goes through TeamTournamentCourtAdapter → Competition Court Adapter V1.
 */
export async function saveTeamTournamentCourtResourceSetup(
  params = {},
  deps = {}
) {
  const normalized = validateTeamTournamentCourtResourceSetup(params.config);
  if (!normalized.ok) return normalized;

  const clubId = text(params.clubId);
  const tenantId = text(params.tenantId);
  const tournamentId = text(params.tournamentId);
  if (!clubId || !tournamentId || !tenantId) {
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }

  const persistFn = deps.persistSetupConfig || params.persistSetupConfig;
  if (typeof persistFn !== "function") {
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }

  const adapter = wrapLegacyCourtDeps(deps);
  const context = teamCourtContext(params, normalized);

  try {
    const inventory = await adapter.listEligibleCourts(context);
    const courts = inventory?.ok ? (inventory.courts || []).map(toFormatVenueCourt) : [];
    const inventoryIds = new Set(courts.map((court) => physicalId(court)));
    if (
      !inventory?.ok ||
      normalized.selectedCourtIds.some((courtId) => !inventoryIds.has(courtId))
    ) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }

    const availability = await adapter.getCourtAvailability({
      ...context,
      courts,
      includeUnavailable: true,
    });
    const rows = availability?.courts || [];
    const returnedIds = new Set(rows.map((row) => physicalId(row)));
    const unavailable = rows.filter((row) => !isAvailable(row));
    const missing = normalized.selectedCourtIds.filter((courtId) => !returnedIds.has(courtId));
    if (unavailable.length > 0 || missing.length > 0) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }

    const reservation = await adapter.reserveCourts({ ...context, courts });
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
      (reservation.reserved || reservation.created || []).map(
        (booking) => booking?.physicalCourtId || booking?.courtId || booking?.court_id
      )
    );
    if (createdCourtIds.length > 0) {
      try {
        await adapter.releaseCourts({
          ...context,
          physicalCourtIds: createdCourtIds,
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
  const tenantId = text(params.tenantId);
  const tournamentId = text(params.tournamentId);
  if (!clubId || !tournamentId || !tenantId) {
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }

  try {
    const adapter = wrapLegacyCourtDeps(deps);
    const context = teamCourtContext(params, normalized);
    const inventory = await adapter.listEligibleCourts(context);
    const courts = inventory?.ok ? inventory.courts || [] : [];
    const inventoryIds = new Set(courts.map((court) => physicalId(court)));
    if (
      !inventory?.ok ||
      normalized.selectedCourtIds.some((courtId) => !inventoryIds.has(courtId))
    ) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }

    const availability = await adapter.getCourtAvailability({
      ...context,
      courts,
      includeUnavailable: true,
    });
    const rows = availability?.courts || [];
    if (
      rows.length !== normalized.selectedCourtIds.length ||
      rows.some((row) => !isOwnReservation(row) && row?.available !== true)
    ) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }
    if (rows.some((row) => !isOwnReservation(row))) {
      return { ok: false, error: GENERIC_SAVE_ERROR };
    }
    return { ok: true, courts, availability };
  } catch {
    return { ok: false, error: GENERIC_SAVE_ERROR };
  }
}
