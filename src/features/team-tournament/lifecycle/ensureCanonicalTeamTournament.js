/**
 * Canonical Team Tournament create / heal.
 * After first persist, canonical_tournaments is the list authority and
 * team_tournaments.tournament_id is the domain id (same stable string).
 */
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { createTeamTournamentShell } from "../engines/teamTournamentEngine.js";

export const CANONICAL_TEAM_CREATE_RPC = "team_tournament_create";
export const CANONICAL_TEAM_ENSURE_RPC = "team_tournament_ensure_canonical";

function buildSettings(options = {}) {
  return {
    formatPreset: options.formatPreset || "mlp_4",
    ...(options.settings && typeof options.settings === "object" ? options.settings : {}),
  };
}

export function buildCanonicalTeamCreatePayload(input = {}) {
  const name = String(input.name || "Giải đồng đội").trim();
  const createdBy = input.createdBy || input.ownerPlayerId || null;
  return {
    name,
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    status: TOURNAMENT_STATUS.DRAFT,
    seasonId: input.seasonId || "",
    leagueId: input.leagueId || "",
    createdBy,
    ownerPlayerId: input.ownerPlayerId || createdBy,
    settings: buildSettings(input),
  };
}

/**
 * Prefer the atomic RPC. If it is not deployed yet, dual-write
 * canonical_tournament_create + team header using the same id.
 */
export async function persistCanonicalTeamTournamentCreate(input = {}, deps = {}) {
  const clubId = String(input.clubId || "").trim();
  const tenantId = String(input.tenantId || input.runtimeTenantId || "").trim();
  if (!clubId) {
    return { ok: false, code: "CLUB_REQUIRED", error: "Thiếu CLB để tạo giải đồng đội." };
  }
  if (!tenantId) {
    return { ok: false, code: "TENANT_MISSING", error: "Thiếu tenant để tạo giải đồng đội." };
  }

  const payload = buildCanonicalTeamCreatePayload(input);

  if (typeof deps.createViaRpc === "function") {
    const rpcResult = await deps.createViaRpc({
      tenantId,
      clubId,
      payload,
    });
    if (rpcResult?.ok && rpcResult.tournament?.id) {
      return finalizeCreated(rpcResult, clubId, tenantId, payload, input);
    }
    if (rpcResult && rpcResult.code && rpcResult.code !== "RPC_MISSING") {
      return rpcResult;
    }
  }

  if (typeof deps.createCanonical !== "function" || typeof deps.ensureHeader !== "function") {
    return {
      ok: false,
      code: "CANONICAL_CREATE_UNAVAILABLE",
      error: "Chưa có writer canonical để lưu giải đồng đội.",
    };
  }

  const created = await deps.createCanonical({
    clubId,
    tenantId,
    ...payload,
  });
  if (!created?.ok || !created.tournament?.id) {
    return {
      ok: false,
      code: created?.code || "CANONICAL_CREATE_FAILED",
      error: created?.error || "Không tạo được giải trên danh sách canonical.",
    };
  }

  const tournamentId = String(created.tournament.id);
  const shell = createTeamTournamentShell(clubId, {
    ...input,
    id: tournamentId,
    name: payload.name,
    seasonId: payload.seasonId,
    leagueId: payload.leagueId,
    tenantId,
    status: TOURNAMENT_STATUS.DRAFT,
    settings: payload.settings,
    createdBy: payload.createdBy,
    ownerPlayerId: payload.ownerPlayerId,
  });
  shell.canonicalId = tournamentId;
  shell.createdBy = payload.createdBy;
  shell.ownerPlayerId = payload.ownerPlayerId;

  const header = await deps.ensureHeader({
    ...shell,
    clubId,
    tenantId,
    runtimeTenantId: tenantId,
  });
  if (!header?.ok) {
    return {
      ok: false,
      code: header?.code || "CLOUD_HEADER_FAILED",
      error:
        header?.error ||
        "Đã tạo danh sách canonical nhưng chưa ghi được header team_tournaments.",
      tournament: shell,
      canonicalCreated: true,
    };
  }

  return {
    ok: true,
    tournament: shell,
    clubId,
    tenantId,
    canonical: true,
    cloudSynced: true,
    tournamentId,
  };
}

function finalizeCreated(rpcResult, clubId, tenantId, payload, input) {
  const tournamentId = String(rpcResult.tournament.id);
  const shell =
    rpcResult.tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT &&
    rpcResult.tournament.teamData
      ? {
          ...rpcResult.tournament,
          clubId,
          tenantId,
          canonicalId: tournamentId,
        }
      : createTeamTournamentShell(clubId, {
          ...input,
          id: tournamentId,
          name: payload.name,
          seasonId: payload.seasonId,
          leagueId: payload.leagueId,
          tenantId,
          status: TOURNAMENT_STATUS.DRAFT,
          settings: payload.settings,
          createdBy: payload.createdBy,
          ownerPlayerId: payload.ownerPlayerId,
        });
  shell.canonicalId = tournamentId;
  shell.createdBy = payload.createdBy;
  shell.ownerPlayerId = payload.ownerPlayerId;
  return {
    ok: true,
    tournament: shell,
    clubId,
    tenantId,
    canonical: true,
    cloudSynced: true,
    tournamentId,
    replayed: rpcResult.replayed === true,
  };
}

export async function ensureCanonicalTeamTournamentListing(input = {}, deps = {}) {
  if (typeof deps.ensureViaRpc === "function") {
    const result = await deps.ensureViaRpc({
      tenantId: input.tenantId,
      clubId: input.clubId,
      tournamentId: input.tournamentId,
      name: input.name,
      createdBy: input.createdBy,
    });
    if (result?.ok) return result;
    if (result?.code && result.code !== "RPC_MISSING") return result;
  }
  if (typeof deps.getCanonical === "function" && input.tournamentId) {
    const existing = await deps.getCanonical(input.clubId, input.tournamentId, {
      tenantId: input.tenantId,
    });
    if (existing?.ok && existing.tournament) {
      return { ok: true, tournament: existing.tournament, already: true };
    }
  }
  if (!input.tournamentId) {
    return persistCanonicalTeamTournamentCreate(input, deps);
  }
  return persistCanonicalTeamTournamentCreate(
    {
      ...input,
      id: input.tournamentId,
    },
    deps
  );
}

export function classifyTeamTournamentStorageAuthority(kind) {
  const map = {
    presentation: "PRESENTATION_ONLY",
    cache: "CACHE_ONLY",
    legacy: "LEGACY_AUTHORITY",
    canonical: "CANONICAL_AUTHORITY",
  };
  return map[kind] || "LEGACY_AUTHORITY";
}
