/**
 * Internal Tournament Court Adapter (ĐẦU B).
 * Translates Internal schedule demand into Competition Court Adapter Contract V1.
 * Does not own court assignment, inventory, or reservation authority.
 */
import { createCourtResourceCompetitionAdapter } from "../../competition-core/adapters/courtResourceCompetitionAdapter.js";
import {
  COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
  COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
  COMPETITION_COURT_ADAPTER_CAPABILITY,
  COMPETITION_COURT_ERROR_CODE,
  COMPETITION_COURT_RESULT_CODE,
  COMPETITION_TYPE,
  isFailClosedAvailabilityCode,
  isForeignReservationCode,
} from "../../competition-core/contracts/competitionCourtAdapterContract.js";

export const INTERNAL_COURT_AUTHORITY = "competition-court-adapter-v1";
export const INTERNAL_COURT_READER = COMPETITION_COURT_ADAPTER_CAPABILITY.LIST_ELIGIBLE_COURTS;

function withInternalContext(input = {}) {
  return {
    ...input,
    competitionType: input.competitionType || COMPETITION_TYPE.INTERNAL,
  };
}

function failClosedIfForeign(result) {
  if (!result) {
    return {
      ok: false,
      failClosed: true,
      code: COMPETITION_COURT_ERROR_CODE.FOREIGN_RESERVATION,
      error: "Court reservation result missing — fail closed.",
    };
  }
  if (isForeignReservationCode(result.code) || isFailClosedAvailabilityCode(result.code)) {
    return {
      ...result,
      ok: false,
      failClosed: true,
      code: isForeignReservationCode(result.code)
        ? COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION
        : result.code,
    };
  }
  return result;
}

export function createInternalTournamentCourtAdapter(overrides = {}) {
  const contract = createCourtResourceCompetitionAdapter(overrides);
  return Object.freeze({
    adapterId: "internal-tournament-court-adapter",
    contractName: COMPETITION_COURT_ADAPTER_CONTRACT_NAME,
    contractVersion: COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
    competitionType: COMPETITION_TYPE.INTERNAL,
    authority: INTERNAL_COURT_AUTHORITY,
    reader: INTERNAL_COURT_READER,
    ownsCourtAssignmentAuthority: false,
    ownsReservationAuthority: false,
    capabilities: COMPETITION_COURT_ADAPTER_CAPABILITY,
    listEligibleCourts(input = {}) {
      return contract.listEligibleCourts(withInternalContext(input));
    },
    getCourtAvailability(input = {}) {
      const result = contract.getCourtAvailability(withInternalContext(input));
      const courts = Array.isArray(result?.courts)
        ? result.courts.map((court) => {
            if (
              isForeignReservationCode(court.resultCode) ||
              court.resultCode === COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION
            ) {
              return { ...court, available: false, failClosed: true };
            }
            return court;
          })
        : [];
      return { ...result, courts };
    },
    reserveCourts(input = {}) {
      return failClosedIfForeign(contract.reserveCourts(withInternalContext(input)));
    },
    releaseCourts(input = {}) {
      return contract.releaseCourts(withInternalContext(input));
    },
    validateMatchAssignment(input = {}) {
      return failClosedIfForeign(
        contract.validateMatchAssignment(withInternalContext(input))
      );
    },
    invoke(capability, input = {}) {
      if (typeof this[capability] === "function") {
        return this[capability](input);
      }
      return contract.invoke(capability, withInternalContext(input));
    },
  });
}

export const internalTournamentCourtAdapter = createInternalTournamentCourtAdapter();
