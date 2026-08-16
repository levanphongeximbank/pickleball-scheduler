/**
 * Team Tournament Court Adapter (ĐẦU B).
 *
 * Team Format & Venue
 *   → TeamTournamentCourtAdapter
 *   → Competition Court Adapter Contract V1
 *
 * Does not import the Court Resource gateway. Does not use local cluster registry
 * as Competition court authority. physicalCourtId is identity.
 */

import { createCourtResourceCompetitionAdapter } from "../../../competition-core/adapters/courtResourceCompetitionAdapter.js";
import {
  COMPETITION_COURT_ADAPTER_CAPABILITY,
  COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ERROR_CODE,
  COMPETITION_COURT_RESULT_CODE,
  COMPETITION_TYPE,
} from "../../../competition-core/contracts/competitionCourtAdapterContract.js";
import {
  TEAM_ADAPTER_B_CLASSIFICATION,
  TEAM_ADAPTER_B_NAMES,
  TEAM_COMPETITION_TYPE,
  TEAM_TOURNAMENT_ADAPTER_B_MODE,
} from "./constants.js";

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

export function toTeamCourtContractContext(input = {}) {
  return {
    tenantId: trimId(input.tenantId),
    venueId: trimId(input.venueId),
    organizationId: trimId(input.organizationId),
    clubId: trimId(input.clubId),
    competitionId: trimId(input.competitionId) || trimId(input.tournamentId),
    competitionType: trimId(input.competitionType) || COMPETITION_TYPE.TEAM || TEAM_COMPETITION_TYPE,
    clusterId: trimId(input.clusterId),
    actorId: trimId(input.actorId),
    physicalCourtId: trimId(input.physicalCourtId) || trimId(input.courtId),
    physicalCourtIds:
      Array.isArray(input.physicalCourtIds) && input.physicalCourtIds.length
        ? input.physicalCourtIds
        : Array.isArray(input.selectedCourtIds) && input.selectedCourtIds.length
          ? input.selectedCourtIds
          : Array.isArray(input.courtIds) && input.courtIds.length
            ? input.courtIds
            : undefined,
    matchId: trimId(input.matchId) || trimId(input.matchupId),
    date: trimId(input.date) || trimId(input.window?.date),
    startTime:
      trimId(input.startTime) ||
      trimId(input.scheduledStart) ||
      trimId(input.window?.startTime),
    endTime:
      trimId(input.endTime) ||
      trimId(input.scheduledEnd) ||
      trimId(input.window?.endTime),
    window: input.window,
    label: input.label,
    includeUnavailable: input.includeUnavailable,
    requireOwnerReservation: input.requireOwnerReservation,
  };
}

export const TEAM_COURT_DISCOVERY_OUTCOME = Object.freeze({
  SUCCESS_WITH_COURTS: "SUCCESS_WITH_COURTS",
  SUCCESS_EMPTY: "SUCCESS_EMPTY",
  END_A_ERROR: "END_A_ERROR",
  MISSING_TEAM_CONTEXT: "MISSING_TEAM_CONTEXT",
});

export function deriveCanonicalClusterChoices(courts = []) {
  const byId = new Map();
  for (const court of Array.isArray(courts) ? courts : []) {
    const clusterId = trimId(court?.clusterId);
    if (!clusterId) continue;
    if (byId.has(clusterId)) continue;
    byId.set(clusterId, {
      id: clusterId,
      name:
        trimId(court.clusterName) ||
        trimId(court.clusterLabel) ||
        clusterId,
      status: trimId(court.clusterStatus),
    });
  }
  return [...byId.values()];
}

export function toFormatVenueCourt(court = {}) {
  const physicalCourtId =
    trimId(court.physicalCourtId) || trimId(court.id) || trimId(court.courtId);
  return {
    ...court,
    id: physicalCourtId,
    physicalCourtId,
    clusterId: trimId(court.clusterId),
    name: trimId(court.displayName) || trimId(court.name) || physicalCourtId,
    displayName: trimId(court.displayName) || trimId(court.name) || physicalCourtId,
  };
}

/**
 * Classify Contract A listEligibleCourts responses for Team Format & Venue.
 * Never treat END_A_ERROR as empty-success.
 */
export function classifyTeamCourtDiscovery(input = {}, listed = null) {
  const clubId = trimId(input.clubId);
  const tenantId = trimId(input.tenantId);
  if (!clubId || !tenantId) {
    return Object.freeze({
      ok: false,
      outcome: TEAM_COURT_DISCOVERY_OUTCOME.MISSING_TEAM_CONTEXT,
      code: COMPETITION_COURT_ERROR_CODE.MISSING_CLUB_ID,
      error: !clubId
        ? "Thiếu clubId — không gọi Competition Court Adapter."
        : "Thiếu tenantId — không gọi Competition Court Adapter.",
      clusters: [],
      courts: [],
      missing: {
        clubId: !clubId,
        tenantId: !tenantId,
      },
    });
  }

  if (!listed || listed.ok !== true) {
    return Object.freeze({
      ok: false,
      outcome: TEAM_COURT_DISCOVERY_OUTCOME.END_A_ERROR,
      code:
        listed?.code || COMPETITION_COURT_ERROR_CODE.DATA_UNAVAILABLE,
      error:
        listed?.error ||
        "Competition Court Adapter V1 trả lỗi — không giả thành công rỗng.",
      clusters: [],
      courts: [],
      endA: listed || null,
    });
  }

  const courts = (listed.courts || []).map(toFormatVenueCourt);
  const clusters = deriveCanonicalClusterChoices(courts);
  if (courts.length === 0) {
    return Object.freeze({
      ok: true,
      outcome: TEAM_COURT_DISCOVERY_OUTCOME.SUCCESS_EMPTY,
      code: listed.code || COMPETITION_COURT_RESULT_CODE.OK,
      error: null,
      clusters: [],
      courts: [],
      endA: listed,
    });
  }

  return Object.freeze({
    ok: true,
    outcome: TEAM_COURT_DISCOVERY_OUTCOME.SUCCESS_WITH_COURTS,
    code: listed.code || COMPETITION_COURT_RESULT_CODE.OK,
    error: null,
    clusters,
    courts,
    endA: listed,
  });
}

export function createTeamTournamentCourtAdapter(deps = {}) {
  const contractA =
    deps.contractA ||
    createCourtResourceCompetitionAdapter(deps.gateway || {});

  function call(capability, input = {}) {
    if (typeof contractA[capability] !== "function") {
      return contractA.invoke
        ? contractA.invoke(capability, toTeamCourtContractContext(input))
        : {
            ok: false,
            code: COMPETITION_COURT_ERROR_CODE.SHARED_CONTRACT_CAPABILITY_GAP,
            error: `Capability '${capability}' is not available`,
          };
    }
    return contractA[capability](toTeamCourtContractContext(input));
  }

  return Object.freeze({
    adapterBName: TEAM_ADAPTER_B_NAMES[7],
    ordinal: 7,
    classification: TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED,
    activation: true,
    adapterBReady: true,
    sharedRuntime: "BOUND",
    competitionMode: TEAM_TOURNAMENT_ADAPTER_B_MODE,
    ownsAuthority: false,
    contractName: COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
    contractVersion: COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
    capabilities: COMPETITION_COURT_ADAPTER_CAPABILITY,
    listEligibleCourts(input = {}) {
      return call(COMPETITION_COURT_ADAPTER_CAPABILITY.LIST_ELIGIBLE_COURTS, input);
    },
    getCourtAvailability(input = {}) {
      return call(COMPETITION_COURT_ADAPTER_CAPABILITY.GET_COURT_AVAILABILITY, input);
    },
    reserveCourts(input = {}) {
      return call(COMPETITION_COURT_ADAPTER_CAPABILITY.RESERVE_COURTS, input);
    },
    releaseCourts(input = {}) {
      return call(COMPETITION_COURT_ADAPTER_CAPABILITY.RELEASE_COURTS, input);
    },
    validateMatchAssignment(input = {}) {
      return call(
        COMPETITION_COURT_ADAPTER_CAPABILITY.VALIDATE_MATCH_ASSIGNMENT,
        input
      );
    },
    async listCanonicalClusters(input = {}) {
      const context = toTeamCourtContractContext(input);
      if (!trimId(context.clubId) || !trimId(context.tenantId)) {
        return classifyTeamCourtDiscovery(context, null);
      }
      const listed = await this.listEligibleCourts(input);
      return classifyTeamCourtDiscovery(context, listed);
    },
    requireValidMatchAssignment(input = {}) {
      const result = this.validateMatchAssignment(input);
      if (result?.ok === true && result?.valid === true) return result;
      return {
        ok: false,
        valid: false,
        code: result?.code || COMPETITION_COURT_ERROR_CODE.OUT_OF_SCOPE,
        error: result?.error || "validateMatchAssignment must PASS before match assignment",
        physicalCourtId: result?.physicalCourtId || trimId(input.physicalCourtId),
        matchId: trimId(input.matchId) || trimId(input.matchupId),
      };
    },
  });
}

export const TeamTournamentCourtAdapter = {
  create: createTeamTournamentCourtAdapter,
};
