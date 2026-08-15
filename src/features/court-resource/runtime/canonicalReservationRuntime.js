/**
 * Court Resource-owned production binding for canonical reservation RPCs.
 * Wired into CourtResourceGateway default deps — not test-only setters.
 */
export {
  rpcReserveCourts as productionCanonicalReserve,
  rpcReleaseCourts as productionCanonicalRelease,
  rpcGetAvailability as productionCanonicalGetAvailability,
} from "../services/canonicalReservationClient.js";
