import { API_SCOPES } from "../../constants/apiScopes.js";
import { filterByTenant } from "../../../tenant/guards/tenantGuard.js";
import { loadPlayersForClub } from "../../../../domain/clubStorage.js";
import { loadClubs } from "../../../../data/club.js";

export function handlePlayersList(ctx) {
  const tenantId = ctx.auth?.tenantId;
  const clubs = filterByTenant(loadClubs(), tenantId);
  const clubId = ctx.query?.clubId || clubs[0]?.id;

  if (!clubId) {
    return { items: [], total: 0 };
  }

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
