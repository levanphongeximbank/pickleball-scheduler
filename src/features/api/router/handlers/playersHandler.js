import { API_SCOPES } from "../../constants/apiScopes.js";
import { loadPlayersForClub } from "../../../../domain/clubStorage.js";
import { resolveScopedClubId } from "../../services/clubScopeService.js";

export function handlePlayersList(ctx) {
  const clubId = resolveScopedClubId(ctx);

  if (!clubId) {
    return { items: [], total: 0 };
  }

  const tenantId = ctx.auth?.tenantId;
  const players = loadPlayersForClub(clubId) || [];
  return {
    items: players.map((p) => ({
      id: p.id,
      name: p.name,
      skillLevel: p.skillLevel,
      tenantId: p.tenantId || tenantId,
    })),
    total: players.length,
    clubId,
  };
}

export const playersRoutes = [
  {
    method: "GET",
    path: "/players",
    scope: API_SCOPES.PLAYERS_READ,
    handler: handlePlayersList,
  },
];
