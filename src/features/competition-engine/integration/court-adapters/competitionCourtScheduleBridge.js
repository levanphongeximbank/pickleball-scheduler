/**
 * Canonical competition court schedule bridge via Mode Adapter B.
 *
 * When CANONICAL_COMPETITION_COURT_ADAPTERS is ON:
 *   Mode Adapter B → Head A → provider → Gateway
 * Fail closed — no silent fallback to the legacy tournament booking bridge.
 *
 * When OFF: callers keep the legacy tournamentBookingService path.
 */
import { isCanonicalCompetitionCourtAdaptersEnabled } from "./canonicalCompetitionCourtAdapters.js";
import { createModeCourtAdapterForCompetition } from "./resolveModeCourtAdapter.js";
import { MODE_COURT_ADAPTER_B_CODE } from "./createModeCourtAdapterB.js";

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Sync tournament court schedule capacity through Mode Adapter B.
 *
 * @param {object} tournament
 * @param {object} options
 */
export async function syncCompetitionCourtScheduleViaAdapterB(tournament, options = {}) {
  if (!isCanonicalCompetitionCourtAdaptersEnabled() && options.forceCanonical !== true) {
    return {
      ok: false,
      code: MODE_COURT_ADAPTER_B_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: "Canonical Competition Court Adapters are OFF — use legacy path.",
      canonical: false,
    };
  }

  const mode =
    options.mode ||
    tournament?.mode ||
    tournament?.competitionType ||
    options.competitionType;
  const adapter =
    options.adapter || createModeCourtAdapterForCompetition(mode, { headA: options.headA });
  if (!adapter) {
    return {
      ok: false,
      code: MODE_COURT_ADAPTER_B_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: `No Mode Adapter B for mode '${mode}'.`,
      canonical: true,
    };
  }

  const schedule = tournament?.courtSchedule || options.schedule || {};
  const physicalCourtIds =
    options.physicalCourtIds ||
    schedule.physicalCourtIds ||
    schedule.courtIds ||
    tournament?.settings?.selectedCourtIds ||
    [];

  const input = {
    tenantId: trimId(options.tenantId) || trimId(tournament?.tenantId),
    clubId: trimId(options.clubId) || trimId(tournament?.clubId),
    clusterId: trimId(schedule.clusterId) || trimId(options.clusterId),
    actorId: trimId(options.actorId),
    competitionId: trimId(tournament?.id) || trimId(options.competitionId),
    physicalCourtIds,
    date: schedule.date,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    label: tournament?.name || tournament?.id,
    requestId: options.requestId,
  };

  const reserved = await adapter.reserveCourts(input);
  if (!reserved?.ok) {
    return {
      ...reserved,
      canonical: true,
      modeKey: adapter.modeKey,
      created: [],
      updated: [],
      cancelled: [],
      failed: reserved?.failed || [],
    };
  }

  return {
    ok: true,
    code: null,
    message: `Đã khóa ${(reserved.reserved || []).length} sân qua Mode Adapter B.`,
    canonical: true,
    modeKey: adapter.modeKey,
    competitionType: adapter.competitionType,
    created: reserved.reserved || [],
    updated: [],
    cancelled: [],
    failed: [],
    reserved: reserved.reserved || [],
  };
}

export async function releaseCompetitionCourtScheduleViaAdapterB(tournament, options = {}) {
  if (!isCanonicalCompetitionCourtAdaptersEnabled() && options.forceCanonical !== true) {
    return {
      ok: false,
      code: MODE_COURT_ADAPTER_B_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: "Canonical Competition Court Adapters are OFF — use legacy path.",
      canonical: false,
    };
  }

  const mode =
    options.mode ||
    tournament?.mode ||
    tournament?.competitionType ||
    options.competitionType;
  const adapter =
    options.adapter || createModeCourtAdapterForCompetition(mode, { headA: options.headA });
  if (!adapter) {
    return {
      ok: false,
      code: MODE_COURT_ADAPTER_B_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: `No Mode Adapter B for mode '${mode}'.`,
      canonical: true,
    };
  }

  const schedule = tournament?.courtSchedule || options.schedule || {};
  const input = {
    tenantId: trimId(options.tenantId) || trimId(tournament?.tenantId),
    clubId: trimId(options.clubId) || trimId(tournament?.clubId),
    competitionId: trimId(tournament?.id) || trimId(options.competitionId),
    physicalCourtIds:
      options.physicalCourtIds ||
      schedule.physicalCourtIds ||
      schedule.courtIds ||
      [],
    releaseReason: trimId(options.releaseReason) || "schedule_cleared",
    requestId: options.requestId,
  };

  const released = await adapter.releaseCourts(input);
  return {
    ...released,
    canonical: true,
    modeKey: adapter.modeKey,
    cancelled: released.released || [],
  };
}

/**
 * List eligible courts for a mode via Adapter B → Head A.
 */
export async function listCompetitionEligibleCourtsViaAdapterB(input = {}) {
  if (!isCanonicalCompetitionCourtAdaptersEnabled() && input.forceCanonical !== true) {
    return {
      ok: false,
      code: MODE_COURT_ADAPTER_B_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: "Canonical Competition Court Adapters are OFF — use legacy path.",
      courts: [],
      canonical: false,
    };
  }
  const adapter =
    input.adapter ||
    createModeCourtAdapterForCompetition(input.mode || input.competitionType, {
      headA: input.headA,
    });
  if (!adapter) {
    return {
      ok: false,
      code: MODE_COURT_ADAPTER_B_CODE.CANONICAL_PATH_UNAVAILABLE,
      error: "No Mode Adapter B for inventory listing.",
      courts: [],
      canonical: true,
    };
  }
  const listed = await adapter.listEligibleCourts(input);
  return { ...listed, canonical: true, modeKey: adapter.modeKey };
}
