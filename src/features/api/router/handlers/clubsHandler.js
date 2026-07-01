import { API_SCOPES } from "../../constants/apiScopes.js";
import { filterByTenant } from "../../../tenant/guards/tenantGuard.js";
import { loadClubs } from "../../../../data/club.js";

export function handleClubsList(ctx) {
  const tenantId = ctx.auth?.tenantId;
  const clubs = filterByTenant(loadClubs(), tenantId);
  return {
    items: clubs.map((c) => ({
      id: c.id,
      name: c.name,
      tenantId: c.tenantId || tenantId,
    })),
    total: clubs.length,
  };
}

export const clubsRoutes = [
  {
    method: "GET",
    path: "/clubs",
    scope: API_SCOPES.CLUBS_READ,
    handler: handleClubsList,
  },
];
