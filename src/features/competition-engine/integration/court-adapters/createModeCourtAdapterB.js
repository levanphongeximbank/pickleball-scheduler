/**
 * Shared factory for Competition Mode Court Adapter B mechanics.
 *
 * Ownership: 2.13 Competition Engine (mode translation only).
 * Invokes Competition Court Contract A (Head A) — never CourtResourceGateway,
 * never club blob storage, club court loaders, or legacy id remappers.
 *
 * Shared code must not erase mode ownership: each mode binds competitionType
 * and request metadata through a distinct adapter module.
 */
import { isCanonicalPhysicalCourtId } from "../../../court-resource/contracts/canonicalPhysicalCourt.js";
import {
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ADAPTER_CAPABILITY,
  createCompetitionCourtContractEnvelope,
  createSharedContractCapabilityGap,
  isSupportedCompetitionCourtCapability,
  listPhysicalCourtIds,
} from "../../../competition-core/contracts/competitionCourtAdapterContract.js";
import { createCourtResourceCompetitionAdapter } from "../../../competition-core/adapters/courtResourceCompetitionAdapter.js";

export const MODE_COURT_ADAPTER_B_OWNER = "2.13_COMPETITION_ENGINE";

export const MODE_COURT_ADAPTER_B_CODE = Object.freeze({
  OK: "OK",
  MISSING_TENANT_ID: "MISSING_TENANT_ID",
  TENANT_VENUE_COLLAPSE_DENIED: "TENANT_VENUE_COLLAPSE_DENIED",
  MISSING_CLUB_ID: "MISSING_CLUB_ID",
  MISSING_COMPETITION_ID: "MISSING_COMPETITION_ID",
  MISSING_COURT_ID: "MISSING_COURT_ID",
  LEGACY_COURT_IDENTITY_DENIED: "LEGACY_COURT_IDENTITY_DENIED",
  HEAD_A_UNAVAILABLE: "HEAD_A_UNAVAILABLE",
  CANONICAL_PATH_UNAVAILABLE: "CANONICAL_PATH_UNAVAILABLE",
});

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
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

/**
 * Normalize physical court ids. Accepts physicalCourtIds / physicalCourtId.
 * Compatibility: selectedCourtIds / courtIds only when every value is a UUID
 * (projection). Non-UUID ids fail closed — no remapping helper.
 */
export function normalizeModePhysicalCourtIds(input = {}) {
  const fromCanonical = listPhysicalCourtIds(input);
  if (fromCanonical.length > 0) {
    const invalid = fromCanonical.filter((id) => !isCanonicalPhysicalCourtId(id));
    if (invalid.length) {
      return {
        ok: false,
        code: MODE_COURT_ADAPTER_B_CODE.LEGACY_COURT_IDENTITY_DENIED,
        error:
          "Canonical Mode Adapter B requires UUID physicalCourtId — legacy court ids are not identity.",
        invalid,
        physicalCourtIds: [],
      };
    }
    return { ok: true, physicalCourtIds: fromCanonical };
  }

  const compat = [];
  if (Array.isArray(input.selectedCourtIds)) {
    for (const id of input.selectedCourtIds) {
      const trimmed = trimId(id);
      if (trimmed) compat.push(trimmed);
    }
  }
  if (Array.isArray(input.courtIds)) {
    for (const id of input.courtIds) {
      const trimmed = trimId(id);
      if (trimmed) compat.push(trimmed);
    }
  }
  if (compat.length === 0) {
    return { ok: true, physicalCourtIds: [] };
  }
  const invalid = compat.filter((id) => !isCanonicalPhysicalCourtId(id));
  if (invalid.length) {
    return {
      ok: false,
      code: MODE_COURT_ADAPTER_B_CODE.LEGACY_COURT_IDENTITY_DENIED,
      error:
        "selectedCourtIds/courtIds on canonical path must already be physicalCourt UUID values — no legacy mapping.",
      invalid,
      physicalCourtIds: [],
    };
  }
  return { ok: true, physicalCourtIds: [...new Set(compat)] };
}

/**
 * Batch 5 scope semantics: explicit tenantId, venueId ≠ substitute, clubId required.
 */
export function normalizeModeCourtScope(input = {}, { requireClubId = true } = {}) {
  const tenantId = trimId(input.tenantId);
  const venueId = trimId(input.venueId);
  if (!tenantId && venueId) {
    return reject(
      MODE_COURT_ADAPTER_B_CODE.TENANT_VENUE_COLLAPSE_DENIED,
      "venueId cannot substitute for tenantId — TENANT_ID_EQUALS_VENUE_ID_ASSUMPTION=NO."
    );
  }
  if (!tenantId) {
    return reject(
      MODE_COURT_ADAPTER_B_CODE.MISSING_TENANT_ID,
      "tenantId is required for Mode Adapter B — fail closed."
    );
  }
  const clubId = trimId(input.clubId);
  if (requireClubId && !clubId) {
    return reject(
      MODE_COURT_ADAPTER_B_CODE.MISSING_CLUB_ID,
      "clubId is required for Mode Adapter B."
    );
  }
  return {
    ok: true,
    code: MODE_COURT_ADAPTER_B_CODE.OK,
    scope: Object.freeze({
      tenantId,
      clubId: clubId || null,
      venueId: venueId || null,
      clusterId: trimId(input.clusterId),
      actorId: trimId(input.actorId) || trimId(input.userId),
      competitionId: trimId(input.competitionId) || trimId(input.tournamentId) || trimId(input.ownerId),
    }),
  };
}

function buildHeadAInput(mode, scope, input, physicalCourtIds) {
  const competitionId = scope.competitionId;
  const requestId =
    trimId(input.requestId) ||
    (typeof mode.buildRequestId === "function"
      ? mode.buildRequestId({ ...input, ...scope, physicalCourtIds })
      : null);

  return {
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    clusterId: scope.clusterId || undefined,
    actorId: scope.actorId || undefined,
    competitionId,
    competitionType: mode.competitionType,
    ownerId: competitionId,
    physicalCourtIds,
    physicalCourtId:
      physicalCourtIds.length === 1 ? physicalCourtIds[0] : trimId(input.physicalCourtId),
    date: trimId(input.date) || trimId(input.window?.date),
    startTime:
      trimId(input.startTime) ||
      trimId(input.scheduledStart) ||
      trimId(input.window?.startTime),
    endTime:
      trimId(input.endTime) ||
      trimId(input.scheduledEnd) ||
      trimId(input.window?.endTime),
    startsAt: trimId(input.startsAt) || trimId(input.window?.startsAt),
    endsAt: trimId(input.endsAt) || trimId(input.window?.endsAt),
    matchId: trimId(input.matchId),
    requestId: requestId || undefined,
    label: trimId(input.label) || competitionId,
    releaseReason: trimId(input.releaseReason),
    reservationIds: Array.isArray(input.reservationIds) ? input.reservationIds : undefined,
    requireOwnerReservation: input.requireOwnerReservation,
    expectedVersion: input.expectedVersion,
    includeUnavailable: input.includeUnavailable,
  };
}

/**
 * @param {{
 *   modeKey: string,
 *   competitionType: string,
 *   buildRequestId?: Function,
 *   headA?: object,
 * }} mode
 */
export function createModeCourtAdapterB(mode) {
  if (!mode?.modeKey || !mode?.competitionType) {
    throw new TypeError("Mode Adapter B requires modeKey and competitionType.");
  }

  const headA =
    mode.headA ||
    createCourtResourceCompetitionAdapter(
      mode.headAOverrides && typeof mode.headAOverrides === "object"
        ? mode.headAOverrides
        : undefined
    );

  if (!headA || typeof headA.listEligibleCourts !== "function") {
    throw new TypeError("Mode Adapter B requires a Head A (Competition Court Contract) binding.");
  }

  async function invokeCapability(capability, input = {}) {
    if (!isSupportedCompetitionCourtCapability(capability)) {
      return createSharedContractCapabilityGap(capability);
    }

    const scoped = normalizeModeCourtScope(input);
    if (!scoped.ok) {
      return {
        ...scoped,
        courts: [],
        reserved: [],
        released: [],
        valid: false,
      };
    }

    if (
      capability === COMPETITION_COURT_ADAPTER_CAPABILITY.RESERVE_COURTS ||
      capability === COMPETITION_COURT_ADAPTER_CAPABILITY.RELEASE_COURTS ||
      capability === COMPETITION_COURT_ADAPTER_CAPABILITY.VALIDATE_MATCH_ASSIGNMENT
    ) {
      if (!scoped.scope.competitionId) {
        return reject(
          MODE_COURT_ADAPTER_B_CODE.MISSING_COMPETITION_ID,
          "competitionId is required for reservation/assignment via Mode Adapter B.",
          { reserved: [], released: [], valid: false }
        );
      }
    }

    const courts = normalizeModePhysicalCourtIds(input);
    if (!courts.ok) {
      return {
        ...reject(courts.code, courts.error, { invalid: courts.invalid }),
        courts: [],
        reserved: [],
        released: [],
        valid: false,
        physicalCourtIds: [],
      };
    }

    if (
      (capability === COMPETITION_COURT_ADAPTER_CAPABILITY.RESERVE_COURTS ||
        capability === COMPETITION_COURT_ADAPTER_CAPABILITY.VALIDATE_MATCH_ASSIGNMENT) &&
      courts.physicalCourtIds.length === 0
    ) {
      return reject(
        MODE_COURT_ADAPTER_B_CODE.MISSING_COURT_ID,
        "physicalCourtIds are required — Mode Adapter B does not invent court identity.",
        { reserved: [], valid: false }
      );
    }

    if (!headA[capability]) {
      return reject(
        MODE_COURT_ADAPTER_B_CODE.HEAD_A_UNAVAILABLE,
        `Head A capability '${capability}' is unavailable — fail closed.`,
        { courts: [], reserved: [], released: [], valid: false }
      );
    }

    const headInput = buildHeadAInput(mode, scoped.scope, input, courts.physicalCourtIds);
    const result = await headA[capability](headInput);
    if (!result || typeof result !== "object") {
      return reject(
        MODE_COURT_ADAPTER_B_CODE.HEAD_A_UNAVAILABLE,
        "Head A returned an empty result — fail closed."
      );
    }

    return {
      ...result,
      modeKey: mode.modeKey,
      competitionType: mode.competitionType,
      adapterOwner: MODE_COURT_ADAPTER_B_OWNER,
      contractVersion: result.contractVersion || COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
    };
  }

  return Object.freeze({
    modeKey: mode.modeKey,
    competitionType: mode.competitionType,
    adapterOwner: MODE_COURT_ADAPTER_B_OWNER,
    contractVersion: COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
    capabilities: COMPETITION_COURT_ADAPTER_CAPABILITY,
    listEligibleCourts: (input) =>
      invokeCapability(COMPETITION_COURT_ADAPTER_CAPABILITY.LIST_ELIGIBLE_COURTS, input),
    getCourtAvailability: (input) =>
      invokeCapability(COMPETITION_COURT_ADAPTER_CAPABILITY.GET_COURT_AVAILABILITY, input),
    reserveCourts: (input) =>
      invokeCapability(COMPETITION_COURT_ADAPTER_CAPABILITY.RESERVE_COURTS, input),
    releaseCourts: (input) =>
      invokeCapability(COMPETITION_COURT_ADAPTER_CAPABILITY.RELEASE_COURTS, input),
    validateMatchAssignment: (input) =>
      invokeCapability(COMPETITION_COURT_ADAPTER_CAPABILITY.VALIDATE_MATCH_ASSIGNMENT, input),
    async invoke(capability, input) {
      return invokeCapability(capability, input);
    },
  });
}
