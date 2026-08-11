/**
 * Map canonical_tournaments DB row ↔ Tournament domain/runtime model.
 * Full durable state lives in payload JSONB (+ top-level indexed fields / engine_v4).
 */
import { normalizeTournament } from "../../../models/tournament/index.js";

export function tournamentToCanonicalRow(tournament, { tenantId, clubId } = {}) {
  const t = tournament && typeof tournament === "object" ? tournament : {};
  const engineV4 =
    t.settings?.engineV4 && typeof t.settings.engineV4 === "object"
      ? t.settings.engineV4
      : {};

  const {
    id,
    name,
    mode,
    status,
    seasonId,
    leagueId,
    tenantId: sourceTenantId,
    clubId: sourceClubId,
    settings,
    ...rest
  } = t;

  const nextSettings = { ...(settings && typeof settings === "object" ? settings : {}) };
  // engine_v4 column is authoritative for EngineV4; keep settings without duplicate if present
  if (nextSettings.engineV4) {
    delete nextSettings.engineV4;
  }

  return {
    id: id || undefined,
    tenant_id: tenantId || sourceTenantId,
    club_id: clubId || sourceClubId,
    external_key: String(id || t.externalKey || "").trim() || undefined,
    name: String(name || "").trim() || "Giải mới",
    mode: mode,
    status: status || "draft",
    season_id: seasonId || null,
    league_id: leagueId || null,
    payload: {
      ...rest,
      settings: nextSettings,
    },
    engine_v4: engineV4,
  };
}

export function canonicalRowToTournament(row) {
  if (!row || typeof row !== "object") return null;
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const settings = {
    ...(payload.settings && typeof payload.settings === "object" ? payload.settings : {}),
  };
  if (row.engine_v4 && typeof row.engine_v4 === "object") {
    settings.engineV4 = row.engine_v4;
  }

  return normalizeTournament({
    ...payload,
    id: row.id || payload.id,
    externalKey: row.external_key || payload.externalKey || payload.teamDomainId,
    teamDomainId: payload.teamDomainId || row.external_key || null,
    clubId: row.club_id || payload.clubId,
    tenantId: row.tenant_id || payload.tenantId,
    name: row.name || payload.name,
    mode: row.mode || payload.mode,
    status: row.status || payload.status,
    seasonId: row.season_id ?? payload.seasonId ?? "",
    leagueId: row.league_id ?? payload.leagueId ?? "",
    settings,
    createdAt: row.created_at || payload.createdAt,
    updatedAt: row.updated_at || payload.updatedAt,
  });
}

/**
 * Client-side mine filter (mirrors SQL list_mine semantics for tests / offline checks).
 */
export function tournamentMatchesMine(tournament, playerId) {
  if (!playerId || !tournament) return false;
  const pid = String(playerId);
  if (String(tournament.createdBy || "") === pid) return true;
  if (String(tournament.ownerPlayerId || "") === pid) return true;

  const entries = (tournament.events || []).flatMap((event) => event.entries || []);
  if (entries.some((entry) => String(entry.playerId || entry.id || "") === pid)) {
    return true;
  }

  const teams = tournament.teamData?.teams || [];
  if (
    teams.some((team) => {
      if (String(team.captainPlayerId || "") === pid) return true;
      if ((team.deputyPlayerIds || []).map(String).includes(pid)) return true;
      return (team.members || []).some(
        (member) => String(member.playerId || member.id || "") === pid
      );
    })
  ) {
    return true;
  }

  const assignments = tournament.refereeAssignments || tournament.myRefereeAssignments || [];
  if (assignments.some((item) => String(item.playerId || item.refereePlayerId || "") === pid)) {
    return true;
  }

  return false;
}
