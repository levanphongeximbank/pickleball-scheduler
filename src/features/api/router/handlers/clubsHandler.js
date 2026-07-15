import { API_SCOPES } from "../../constants/apiScopes.js";
import { filterByTenant } from "../../../tenant/guards/tenantGuard.js";
import { getScopedClubsForAuthz } from "../../../../auth/clubScopeResolver.js";
import { hydrateApiClubScope } from "../../services/clubScopeService.js";

export async function handleClubsList(ctx) {
  await hydrateApiClubScope(ctx);
  const tenantId = ctx.auth?.tenantId;
  const { clubs, cloudAuthoritative, ready } = getScopedClubsForAuthz({
    user: ctx.auth?.user,
    tenantId,
  });

  // Cloud registry authoritative but unresolved → return no clubs (deny-by-default).
  const scoped = cloudAuthoritative && !ready ? [] : filterByTenant(clubs, tenantId);

  return {
    items: scoped.map((c) => ({
      id: c.id,
      name: c.name,
      tenantId: c.tenantId || tenantId,
    })),
    total: scoped.length,
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
