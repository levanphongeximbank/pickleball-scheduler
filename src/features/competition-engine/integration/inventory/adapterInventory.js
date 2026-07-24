/**
 * E2E-01 adapter inventory — status for priority and deferred adapters.
 */

import { ADAPTER_STATUS } from "../constants.js";

/**
 * @returns {ReadonlyArray<{
 *   code: string,
 *   name: string,
 *   status: string,
 *   evidence: string,
 *   notes: string,
 * }>}
 */
export function buildAdapterInventory() {
  return Object.freeze([
    Object.freeze({
      code: "INT-01",
      name: "Identity & Permission Adapter",
      status: ADAPTER_STATUS.IMPLEMENTED_IN_E2E_01,
      evidence:
        "createIdentityEvidenceFromIdentityAdapter → CORE-02 IdentityEvidencePort",
      notes: "Fail-closed missing actor/role/tenant; Identity matrix SoT",
    }),
    Object.freeze({
      code: "INT-02",
      name: "Venue & Court Adapter",
      status: ADAPTER_STATUS.IMPLEMENTED_IN_E2E_01,
      evidence:
        "CAA + descriptor providers → createInjectedVenueCourtAvailabilityProvider",
      notes: "No first-venue/club fallback; no scheduling logic",
    }),
    Object.freeze({
      code: "INT-03",
      name: "Player Profile Adapter",
      status: ADAPTER_STATUS.IMPLEMENTED_IN_E2E_01,
      evidence: "createPlayerParticipantLookupAdapter → ParticipantLookupPort",
      notes: "Missing mapping explicit; no Player Management ownership",
    }),
    Object.freeze({
      code: "INT-04",
      name: "Club Adapter",
      status: ADAPTER_STATUS.IMPLEMENTED_IN_E2E_01,
      evidence: "createMembershipStatusFromClubAdapter → MembershipStatusPort",
      notes: "Club owns membership; fail-closed when club required",
    }),
    Object.freeze({
      code: "INT-05",
      name: "Player Rating Adapter",
      status: ADAPTER_STATUS.IMPLEMENTED_IN_E2E_01,
      evidence:
        "createRankingRatingSnapshotFromRatingAdapter → RankingRatingSnapshotProviderPort",
      notes: "Read-only snapshots; does not calculate or mutate rating",
    }),
    Object.freeze({
      code: "INT-06",
      name: "Ranking Adapter",
      status: ADAPTER_STATUS.PARTIAL,
      evidence: "vpr-ranking platform projection; optional for Pool+KO seeding",
      notes: "DEFERRED_TO_LATER if seeding uses rating-only path",
    }),
    Object.freeze({
      code: "INT-07",
      name: "Finance & Payment Adapter",
      status: ADAPTER_STATUS.CONTRACT_ONLY,
      evidence: "paymentStatusPort null→UNKNOWN; fees optional for MVP",
      notes: ADAPTER_STATUS.DEFERRED_TO_LATER_E2E_WORKSTREAM,
    }),
    Object.freeze({
      code: "INT-08",
      name: "CRM Adapter",
      status: ADAPTER_STATUS.DEFERRED_TO_LATER_E2E_WORKSTREAM,
      evidence: "No CE CRM port",
      notes: "Not required for IND Pool+KO",
    }),
    Object.freeze({
      code: "INT-09",
      name: "Notification Adapter",
      status: ADAPTER_STATUS.PARTIAL,
      evidence: "emitMatchScheduledFromBoundary one-way boundary exists",
      notes: "P1 for ops UX; non-blocking for draw foundation",
    }),
    Object.freeze({
      code: "INT-10",
      name: "File & Media Adapter",
      status: ADAPTER_STATUS.DEFERRED_TO_LATER_E2E_WORKSTREAM,
      evidence: "CORE-22 excludes file storage",
      notes: "Not required for engine path",
    }),
    Object.freeze({
      code: "INT-11",
      name: "Streaming Adapter",
      status: ADAPTER_STATUS.DEFERRED_TO_LATER_E2E_WORKSTREAM,
      evidence: "No CE streaming port",
      notes: "N/A for Pool+KO engine",
    }),
    Object.freeze({
      code: "INT-12",
      name: "External API & Federation",
      status: ADAPTER_STATUS.DEFERRED_TO_LATER_E2E_WORKSTREAM,
      evidence: "Platform descriptor projection ≠ live ports",
      notes: "N/A for local MVP",
    }),
  ]);
}

/**
 * @param {string} code
 * @returns {object|null}
 */
export function getAdapterInventoryEntry(code) {
  return buildAdapterInventory().find((row) => row.code === code) || null;
}
