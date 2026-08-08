/**
 * Deterministic in-memory RPC seam for cloud-mode unit tests.
 * Mirrors SQL list_mine + permission-shaped fail-closed responses.
 */
import { tournamentMatchesMine } from "../mappers/canonicalTournamentMapper.js";

function uuid() {
  return `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, "0")}${Math.floor(
    Math.random() * 1000
  )
    .toString()
    .padStart(3, "0")}`;
}

export function createInMemoryCanonicalTournamentRpc(seed = {}) {
  /** @type {Map<string, object>} */
  const rows = new Map(Object.entries(seed.rows || {}));
  const actor = {
    tenantId: seed.tenantId || "tenant-cutover-01",
    permissions: new Set(
      seed.permissions || [
        "tournament.view",
        "tournament.create",
        "tournament.update",
        "tournament.delete",
      ]
    ),
    isSuperAdmin: Boolean(seed.isSuperAdmin),
  };

  function deny(code, message) {
    return { ok: false, code, error: message, tournaments: [], tournament: null };
  }

  function assertTenant(pTenantId) {
    if (!pTenantId || pTenantId === "default-tenant" || pTenantId === "default") {
      return deny("TOURNAMENT_MISSING_TENANT", "tenant missing");
    }
    if (!actor.isSuperAdmin && pTenantId !== actor.tenantId) {
      return deny("TOURNAMENT_FORBIDDEN", "tenant mismatch");
    }
    return null;
  }

  function assertPerm(permission) {
    if (actor.isSuperAdmin) return null;
    if (!actor.permissions.has(permission)) {
      return deny("TOURNAMENT_FORBIDDEN", `missing ${permission}`);
    }
    return null;
  }

  async function rpc(name, args = {}) {
    const tenantDeny = assertTenant(args.p_tenant_id);
    if (tenantDeny) return tenantDeny;

    if (name === "canonical_tournament_list") {
      const permDeny = assertPerm("tournament.view");
      if (permDeny) return permDeny;
      const list = [...rows.values()].filter(
        (row) =>
          row.tenant_id === args.p_tenant_id && row.club_id === args.p_club_id
      );
      return { ok: true, tournaments: list };
    }

    if (name === "canonical_tournament_list_mine") {
      const permDeny = assertPerm("tournament.view");
      if (permDeny) return permDeny;
      const playerId = String(args.p_player_id || "").trim();
      if (!playerId) return deny("TOURNAMENT_FORBIDDEN", "missing player");
      const list = [...rows.values()]
        .filter(
          (row) =>
            row.tenant_id === args.p_tenant_id && row.club_id === args.p_club_id
        )
        .filter((row) => {
          const payload = row.payload || {};
          return tournamentMatchesMine(
            {
              ...payload,
              createdBy: payload.createdBy,
              ownerPlayerId: payload.ownerPlayerId,
              events: payload.events,
              teamData: payload.teamData,
            },
            playerId
          );
        });
      return { ok: true, tournaments: list };
    }

    if (name === "canonical_tournament_get") {
      const permDeny = assertPerm("tournament.view");
      if (permDeny) return permDeny;
      const row = rows.get(String(args.p_tournament_id));
      if (!row || row.club_id !== args.p_club_id || row.tenant_id !== args.p_tenant_id) {
        return deny("TOURNAMENT_NOT_FOUND", "not found");
      }
      return { ok: true, tournament: row };
    }

    if (name === "canonical_tournament_create") {
      const permDeny = assertPerm("tournament.create");
      if (permDeny) return permDeny;
      const id = uuid();
      const payload = args.p_payload || {};
      const row = {
        id,
        tenant_id: args.p_tenant_id,
        club_id: args.p_club_id,
        external_key: payload.external_key || id,
        name: payload.name || "Giải mới",
        mode: payload.mode || "internal_tournament",
        status: payload.status || "draft",
        season_id: payload.season_id || null,
        league_id: payload.league_id || null,
        payload: { ...(payload.payload || {}), id },
        engine_v4: payload.engine_v4 || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      rows.set(id, row);
      return { ok: true, tournament: row };
    }

    if (name === "canonical_tournament_update") {
      const permDeny = assertPerm("tournament.update");
      if (permDeny) return permDeny;
      const id = String(args.p_tournament_id);
      const current = rows.get(id);
      if (!current || current.club_id !== args.p_club_id) {
        return deny("TOURNAMENT_NOT_FOUND", "not found");
      }
      const patch = args.p_patch || {};
      const next = {
        ...current,
        name: patch.name ?? current.name,
        status: patch.status ?? current.status,
        season_id: patch.season_id ?? current.season_id,
        league_id: patch.league_id ?? current.league_id,
        payload: patch.payload ?? current.payload,
        engine_v4: patch.engine_v4 ?? current.engine_v4,
        updated_at: new Date().toISOString(),
      };
      rows.set(id, next);
      return { ok: true, tournament: next };
    }

    if (name === "canonical_tournament_delete") {
      const permDeny = assertPerm("tournament.delete");
      if (permDeny) return permDeny;
      const id = String(args.p_tournament_id);
      const current = rows.get(id);
      if (!current || current.club_id !== args.p_club_id) {
        return deny("TOURNAMENT_NOT_FOUND", "not found");
      }
      rows.delete(id);
      return { ok: true };
    }

    if (name === "canonical_tournament_apply_engine_state") {
      const permDeny = assertPerm("tournament.update");
      if (permDeny) return permDeny;
      const id = String(args.p_tournament_id);
      const current = rows.get(id);
      if (!current || current.club_id !== args.p_club_id) {
        return deny("TOURNAMENT_NOT_FOUND", "not found");
      }
      const next = {
        ...current,
        engine_v4: args.p_engine_state || {},
        updated_at: new Date().toISOString(),
      };
      rows.set(id, next);
      return { ok: true, tournament: next };
    }

    return deny("TOURNAMENT_CLOUD_UNAVAILABLE", `unknown rpc ${name}`);
  }

  return {
    rpc,
    rows,
    setActor(next) {
      Object.assign(actor, next);
      if (Array.isArray(next.permissions)) {
        actor.permissions = new Set(next.permissions);
      }
    },
  };
}
