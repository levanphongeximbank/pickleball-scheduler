import { API_SCOPES } from "../../constants/apiScopes.js";
import { loadAIData } from "../../../../ai/storage.js";
import { loadClubs } from "../../../../data/club.js";
import { filterByTenant } from "../../../tenant/guards/tenantGuard.js";

export function handleCourtsList(ctx) {
  const tenantId = ctx.auth?.tenantId;
  const clubs = filterByTenant(loadClubs(), tenantId);
  const clubId = ctx.query?.clubId || clubs[0]?.id;

  if (!clubId) {
    return { items: [], total: 0 };
  }

  const aiData = loadAIData(clubId);
  const courts = aiData?.courts || [];
  return {
    items: courts.map((c) => ({
      id: c.id,
      name: c.name,
      number: c.number,
      active: c.active,
    })),
    total: courts.length,
    clubId,
  };
}

export const courtsRoutes = [
  {
    method: "GET",
    path: "/courts",
    scope: API_SCOPES.COURTS_READ,
    handler: handleCourtsList,
  },
];
