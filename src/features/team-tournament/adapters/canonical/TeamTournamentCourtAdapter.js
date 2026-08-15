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
      const listed = await this.listEligibleCourts(input);
      const courts = listed?.ok ? listed.courts || [] : [];
      return {
        ok: listed?.ok === true,
        code: listed?.code || COMPETITION_COURT_RESULT_CODE.OK,
        error: listed?.error || null,
        clusters: deriveCanonicalClusterChoices(courts),
        courts: courts.map(toFormatVenueCourt),
      };
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
