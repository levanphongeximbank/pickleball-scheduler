import { API_SCOPES } from "../../constants/apiScopes.js";
import { loadAIData } from "../../../../ai/storage.js";
import { resolveScopedClubId, hydrateApiClubScope } from "../../services/clubScopeService.js";

export async function handleCourtsList(ctx) {
  await hydrateApiClubScope(ctx);
  const clubId = resolveScopedClubId(ctx);

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
