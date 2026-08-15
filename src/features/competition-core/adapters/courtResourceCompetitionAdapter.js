/**
 * Neutral Competition → Court Resource binding (ĐẦU A implementation).
 *
 * Competition Court Adapter Contract
 *   → this adapter
 *   → CourtResourceGateway
 *
 * Forbidden:
 *   - CourtResourceGateway → Competition business
 *   - this adapter → Internal / Official / Open / Team Tournament modules
 *   - storage bypass (club_data_v3, bookings, Physical Court tables)
 *
 * Transitional owner mapping (Phase 3B-replaceable below the gateway):
 *   competition owner { ownerType: "competition", ownerId: competitionId }
 *   → gateway owner { type: "tournament", id: competitionId }
 *
 * Transitional identity mapping:
 *   physicalCourtId (contract) → courtId / selectedCourtIds (gateway)
 * Phase 3B may change the gateway substrate without changing the public contract.
 */
import {
  OWNERSHIP_STATUS,
  RESERVATION_OWNER_TYPE,
  getCourtAvailability as gatewayGetCourtAvailability,
  listEligibleCourts as gatewayListEligibleCourts,
  reserveCourts as gatewayReserveCourts,
  releaseCourts as gatewayReleaseCourts,
  validateCourtAssignment as gatewayValidateCourtAssignment,
} from "../../court-resource/index.js";
import {
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ADAPTER_CAPABILITY,
  COMPETITION_COURT_ERROR_CODE,
  COMPETITION_COURT_RESULT_CODE,
  COMPETITION_RESERVATION_OWNER_TYPE,
  createCompetitionCourtContractEnvelope,
  createCompetitionReservationOwner,
  createSharedContractCapabilityGap,
  hasCourtCountWithoutPhysicalIds,
  hasDisplayIdentityWithoutPhysicalIds,
  isFailClosedAvailabilityCode,
  isForeignReservationCode,
  isSupportedCompetitionCourtCapability,
  isWholeClusterReservationAttempt,
  listPhysicalCourtIds,
  mapGatewayCodeToCompetitionCode,
  normalizeCompetitionCourtContext,
} from "../contracts/competitionCourtAdapterContract.js";

const defaultGateway = Object.freeze({
  listEligibleCourts: gatewayListEligibleCourts,
  getCourtAvailability: gatewayGetCourtAvailability,
  reserveCourts: gatewayReserveCourts,
  releaseCourts: gatewayReleaseCourts,
  validateCourtAssignment: gatewayValidateCourtAssignment,
});

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function toGatewayOwner(input) {
  const owner = createCompetitionReservationOwner(input);
  if (!owner) return null;
  return {
    type: RESERVATION_OWNER_TYPE.TOURNAMENT,
    id: owner.ownerId,
  };
}

function toCompetitionOwner(input, gatewayOwner = null) {
  const owner = createCompetitionReservationOwner(input);
  if (owner) return owner;
  const id = trimId(gatewayOwner?.id);
  if (!id) return null;
  return {
    ownerType: COMPETITION_RESERVATION_OWNER_TYPE,
    ownerId: id,
    competitionType: trimId(input.competitionType),
  };
}

function physicalCourtIdFromCourt(court, fallbackId = null) {
  return (
    trimId(court?.physicalCourtId) ||
    trimId(court?.id) ||
    trimId(court?.courtId) ||
    trimId(fallbackId)
  );
}

function displayNameOf(court) {
  const named = trimId(court?.displayName) || trimId(court?.name);
  if (named) return named;
  if (court?.number != null && String(court.number).trim() !== "") {
    return `Sân ${court.number}`;
  }
  return null;
}

function displayProjection(court, physicalCourtId) {
  const displayName = displayNameOf(court);
  return {
    physicalCourtId,
    clusterId: trimId(court?.clusterId),
    displayName,
    displayCode: trimId(court?.displayCode) || trimId(court?.code),
    displayNumber:
      court?.displayNumber != null
        ? String(court.displayNumber)
        : court?.number != null
          ? String(court.number)
          : null,
    courtLabel: displayName,
  };
}

function windowFrom(input = {}) {
  const window = input.window || {};
  return {
    date: trimId(input.date) || trimId(window.date),
    startTime:
      trimId(input.startTime) ||
      trimId(input.scheduledStart) ||
      trimId(window.startTime) ||
      trimId(window.scheduledStart),
    endTime:
      trimId(input.endTime) ||
      trimId(input.scheduledEnd) ||
      trimId(window.endTime) ||
      trimId(window.scheduledEnd),
  };
}

function reject(code, error, extra = {}) {
  return createCompetitionCourtContractEnvelope({
    ok: false,
    valid: false,
    code,
    error,
    ...extra,
  });
}

function denyIdentityMisuse(input, extra = {}) {
  if (hasCourtCountWithoutPhysicalIds(input)) {
    return reject(
      COMPETITION_COURT_ERROR_CODE.COURT_COUNT_RESERVATION_DENIED,
      "courtCount is capacity demand only — reservation/assignment identity is physicalCourtId.",
      extra
    );
  }
  if (hasDisplayIdentityWithoutPhysicalIds(input)) {
    return reject(
      COMPETITION_COURT_ERROR_CODE.SYNTHETIC_COURT_DENIED,
      "courtLabel/display fields are display-only — identity authority is physicalCourtId.",
      extra
    );
  }
  if (isWholeClusterReservationAttempt(input)) {
    return reject(
      COMPETITION_COURT_ERROR_CODE.WHOLE_CLUSTER_DENIED,
      "A selected cluster does not reserve or identify every Physical Court in that cluster.",
      extra
    );
  }
  return null;
}

function gatewayScope(input) {
  const context = normalizeCompetitionCourtContext(input);
  const owner = toGatewayOwner(input);
  return {
    tenantId: context.tenantId,
    clubId: context.clubId,
    clusterId: context.clusterId,
    venueId: context.tenantId,
    owner,
  };
}

function catchGateway(run) {
  try {
    const result = run();
    if (result && typeof result.then === "function") {
      return result.catch((error) =>
        reject(
          error?.code || COMPETITION_COURT_ERROR_CODE.DATA_UNAVAILABLE,
          error?.message || "CourtResourceGateway rejected the request."
        )
      );
    }
    return result;
  } catch (error) {
    return reject(
      error?.code || COMPETITION_COURT_ERROR_CODE.DATA_UNAVAILABLE,
      error?.message || "CourtResourceGateway rejected the request."
    );
  }
}

function mapAvailabilityRow(row, input) {
  const physicalCourtId = physicalCourtIdFromCourt(row?.court, row?.courtId);
  const conflictCode = row?.conflicts?.[0]?.code || null;
  const ownershipStatus = row?.ownership?.status || null;
  let resultCode;
  if (row?.available) {
    resultCode =
      ownershipStatus === OWNERSHIP_STATUS.OWN_RESERVATION
        ? COMPETITION_COURT_RESULT_CODE.OWN_RESERVATION
        : COMPETITION_COURT_RESULT_CODE.AVAILABLE;
  } else {
    resultCode = mapGatewayCodeToCompetitionCode(conflictCode || ownershipStatus, ownershipStatus);
  }
  return {
    ...displayProjection(row?.court, physicalCourtId),
    available: Boolean(row?.available),
    resultCode,
    ownership: {
      status: ownershipStatus,
      owner: toCompetitionOwner(input, row?.ownership?.owner),
      reservationId: row?.ownership?.reservationId ?? null,
    },
    reasons: Array.isArray(row?.reasons) ? [...row.reasons] : [],
    conflicts: Array.isArray(row?.conflicts) ? row.conflicts.map((item) => ({ ...item })) : [],
    gatewayCode: conflictCode,
  };
}

function createAdapter(gateway) {
  async function listEligibleCourts(input = {}) {
    const identityError = denyIdentityMisuse(input, { courts: [] });
    if (identityError && hasCourtCountWithoutPhysicalIds(input)) {
      return { ...identityError, courts: [] };
    }
    if (identityError && hasDisplayIdentityWithoutPhysicalIds(input)) {
      return { ...identityError, courts: [] };
    }

    const context = normalizeCompetitionCourtContext(input);
    if (!context.clubId) {
      return reject(COMPETITION_COURT_ERROR_CODE.MISSING_CLUB_ID, "clubId is required.", {
        courts: [],
      });
    }

    const physicalCourtIds = listPhysicalCourtIds(input);
    const result = await catchGateway(() =>
      gateway.listEligibleCourts({
        ...gatewayScope(input),
        selectedCourtIds: physicalCourtIds,
      })
    );
    if (result.ok === false && result.contractVersion) return result;
    if (!result?.ok) {
      return reject(
        mapGatewayCodeToCompetitionCode(result?.code) || COMPETITION_COURT_ERROR_CODE.DATA_UNAVAILABLE,
        result?.error || "Failed to list eligible Physical Courts.",
        { courts: [], failed: result?.failed || [] }
      );
    }

    return createCompetitionCourtContractEnvelope({
      ok: true,
      code: COMPETITION_COURT_RESULT_CODE.OK,
      courts: (result.courts || []).map((court) =>
        displayProjection(court, physicalCourtIdFromCourt(court))
      ),
    });
  }

  async function getCourtAvailability(input = {}) {
    const identityError = denyIdentityMisuse(input, { courts: [] });
    if (identityError && (hasCourtCountWithoutPhysicalIds(input) || hasDisplayIdentityWithoutPhysicalIds(input))) {
      return { ...identityError, courts: [] };
    }

    const context = normalizeCompetitionCourtContext(input);
    const window = windowFrom(input);
    if (!context.clubId) {
      return reject(COMPETITION_COURT_ERROR_CODE.MISSING_CLUB_ID, "clubId is required.", {
        courts: [],
      });
    }
    if (!window.date || !window.startTime || !window.endTime) {
      return reject(
        COMPETITION_COURT_ERROR_CODE.MISSING_WINDOW,
        "date, startTime, and endTime are required.",
        { courts: [] }
      );
    }

    const physicalCourtIds = listPhysicalCourtIds(input);
    const result = await catchGateway(() =>
      gateway.getCourtAvailability({
        ...gatewayScope(input),
        ...window,
        courtIds: physicalCourtIds,
        includeUnavailable: input.includeUnavailable !== false,
      })
    );
    if (result.ok === false && result.contractVersion) return result;

    const courts = (result?.courts || []).map((row) => mapAvailabilityRow(row, input));
    return createCompetitionCourtContractEnvelope({
      ok: true,
      code: COMPETITION_COURT_RESULT_CODE.OK,
      clubId: result?.clubId || context.clubId,
      tenantId: context.tenantId,
      competitionId: context.competitionId,
      window,
      courts,
    });
  }

  async function reserveCourts(input = {}) {
    const identityError = denyIdentityMisuse(input, { reserved: [] });
    if (identityError) return { ...identityError, reserved: [] };

    const context = normalizeCompetitionCourtContext(input);
    const owner = toGatewayOwner(input);
    const physicalCourtIds = listPhysicalCourtIds(input);
    const window = windowFrom(input);

    if (!context.clubId) {
      return reject(COMPETITION_COURT_ERROR_CODE.MISSING_CLUB_ID, "clubId is required.", {
        reserved: [],
      });
    }
    if (!owner) {
      return reject(
        COMPETITION_COURT_ERROR_CODE.MISSING_OWNER,
        "competitionId is required as reservation ownerId.",
        { reserved: [] }
      );
    }
    if (physicalCourtIds.length === 0) {
      return reject(
        COMPETITION_COURT_ERROR_CODE.MISSING_COURT_ID,
        "physicalCourtIds are required — courtCount/cluster cannot reserve.",
        { reserved: [] }
      );
    }

    const result = await catchGateway(() =>
      gateway.reserveCourts({
        ...gatewayScope(input),
        selectedCourtIds: physicalCourtIds,
        ...window,
        label: input.label || context.competitionId,
      })
    );
    if (result.ok === false && result.contractVersion) return result;
    if (!result?.ok) {
      const code = mapGatewayCodeToCompetitionCode(result?.code);
      return reject(code, result?.error || "Reservation failed.", {
        reserved: [],
        failed: result?.failed || [],
      });
    }

    return createCompetitionCourtContractEnvelope({
      ok: true,
      code: COMPETITION_COURT_RESULT_CODE.OK,
      reserved: (result.selectedCourtIds || physicalCourtIds).map((id) => ({
        physicalCourtId: String(id),
      })),
      owner: toCompetitionOwner(input),
    });
  }

  async function releaseCourts(input = {}) {
    const identityError = denyIdentityMisuse(input, { released: [] });
    if (identityError && (hasCourtCountWithoutPhysicalIds(input) || hasDisplayIdentityWithoutPhysicalIds(input))) {
      return { ...identityError, released: [] };
    }

    const context = normalizeCompetitionCourtContext(input);
    const owner = toGatewayOwner(input);
    if (!context.clubId) {
      return reject(COMPETITION_COURT_ERROR_CODE.MISSING_CLUB_ID, "clubId is required.", {
        released: [],
      });
    }
    if (!owner) {
      return reject(
        COMPETITION_COURT_ERROR_CODE.MISSING_OWNER,
        "competitionId is required as reservation ownerId.",
        { released: [] }
      );
    }

    const physicalCourtIds = listPhysicalCourtIds(input);
    const result = await catchGateway(() =>
      gateway.releaseCourts({
        ...gatewayScope(input),
        selectedCourtIds: physicalCourtIds,
      })
    );
    if (result.ok === false && result.contractVersion) return result;
    if (!result?.ok) {
      return reject(
        mapGatewayCodeToCompetitionCode(result?.code),
        result?.error || "Release failed.",
        { released: [], failed: result?.failed || [] }
      );
    }

    const released = (result.cancelled || []).map((booking) => ({
      physicalCourtId: physicalCourtIdFromCourt(booking, booking?.courtId),
      reservationId: booking?.id != null ? String(booking.id) : null,
    }));
    return createCompetitionCourtContractEnvelope({
      ok: true,
      code: COMPETITION_COURT_RESULT_CODE.OK,
      released,
      owner: toCompetitionOwner(input),
    });
  }

  async function validateMatchAssignment(input = {}) {
    const identityError = denyIdentityMisuse(input, { valid: false });
    if (identityError) return identityError;

    const context = normalizeCompetitionCourtContext(input);
    const matchId = trimId(input.matchId);
    const physicalCourtIds = listPhysicalCourtIds(input);
    const physicalCourtId = physicalCourtIds[0] || null;
    const window = windowFrom(input);

    if (!context.clubId) {
      return reject(COMPETITION_COURT_ERROR_CODE.MISSING_CLUB_ID, "clubId is required.");
    }
    if (!physicalCourtId) {
      return reject(
        COMPETITION_COURT_ERROR_CODE.MISSING_COURT_ID,
        "physicalCourtId is required for match assignment."
      );
    }
    if (!window.date || !window.startTime || !window.endTime) {
      return reject(
        COMPETITION_COURT_ERROR_CODE.MISSING_WINDOW,
        "Match assignment requires a time window."
      );
    }

    const result = await catchGateway(() =>
      gateway.validateCourtAssignment({
        ...gatewayScope(input),
        courtId: physicalCourtId,
        matchId,
        ...window,
        requireOwnerReservation: input.requireOwnerReservation,
      })
    );
    if (result.ok === false && result.contractVersion) return result;
    if (!result?.ok) {
      const code = mapGatewayCodeToCompetitionCode(result?.code, result?.availability?.ownership?.status);
      return reject(code, result?.error || "Match assignment is not valid.", {
        matchId,
        physicalCourtId,
        valid: false,
      });
    }

    return createCompetitionCourtContractEnvelope({
      ok: true,
      valid: true,
      code: COMPETITION_COURT_RESULT_CODE.ASSIGNMENT_VALID,
      matchId,
      physicalCourtId: result.courtId || physicalCourtId,
      owner: toCompetitionOwner(input, result.ownership?.owner),
      ownershipStatus: result.ownership?.status || null,
    });
  }

  return Object.freeze({
    contractVersion: COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
    capabilities: COMPETITION_COURT_ADAPTER_CAPABILITY,
    listEligibleCourts,
    getCourtAvailability,
    reserveCourts,
    releaseCourts,
    validateMatchAssignment,
    async invoke(capability, input) {
      if (!isSupportedCompetitionCourtCapability(capability)) {
        return createSharedContractCapabilityGap(capability);
      }
      return this[capability](input);
    },
  });
}

export function createCourtResourceCompetitionAdapter(overrides = {}) {
  return createAdapter({
    ...defaultGateway,
    ...overrides,
  });
}

export const courtResourceCompetitionAdapter = createCourtResourceCompetitionAdapter();

export {
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ADAPTER_CAPABILITY,
  isFailClosedAvailabilityCode,
  isForeignReservationCode,
};
