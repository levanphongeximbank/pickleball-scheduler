/**
 * Official/Open Court Adapter B surface.
 *
 * Official/Open → this module → Competition Court Adapter Contract V1.
 * Does not call Team Tournament court services or private club court persistence.
 * Does not modify CourtResourceGateway.
 */

import { createOfficialOpenAdapterB } from "./createOfficialOpenAdapterB.js";

/**
 * @param {{
 *   clubId?: string|null,
 *   tenantId?: string|null,
 *   venueId?: string|null,
 *   currentTenantId?: string|null,
 *   tournament?: object|null,
 *   activeClub?: object|null,
 *   competitionId?: string|null,
 *   physicalCourtIds?: string[],
 *   selectedCourtIds?: string[],
 * }} [input]
 */
export async function listOfficialOpenEligibleCourts(input = {}) {
  const adapter = createOfficialOpenAdapterB({
    tournament: input.tournament,
    activeClub: input.activeClub,
    currentTenantId: input.tenantId || input.currentTenantId,
  });
  return adapter.listEligibleCourts(input);
}
