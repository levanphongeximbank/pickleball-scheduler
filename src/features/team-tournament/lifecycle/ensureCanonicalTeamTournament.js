/**
 * Canonical Team Tournament create / historical heal.
 *
 * NORMAL_NEW_CREATE_PATH: team_tournament_create only.
 * HISTORICAL_HEAL_PATH: team_tournament_ensure_canonical only.
 *
 * Missing RPC → FAIL CLOSED. No client dual-write. No alternate writer.
 */
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { adoptCanonicalCreateTeamData } from "../engines/mlpPresetEngine.js";

export const CANONICAL_TEAM_CREATE_RPC = "team_tournament_create";
export const CANONICAL_TEAM_ENSURE_RPC = "team_tournament_ensure_canonical";

function buildSettings(options = {}) {
  const settings = {
    formatPreset: options.formatPreset || "mlp_4",
    ...(options.settings && typeof options.settings === "object" ? options.settings : {}),
  };
  const idempotencyKey = String(
    options.idempotencyKey || settings.idempotencyKey || ""
  ).trim();
  if (idempotencyKey) {
    settings.idempotencyKey = idempotencyKey;
  }
  return settings;
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

function failClosed(code, error, extra = {}) {
  return {
    ok: false,
    code,
    error,
    ...extra,
  };
}

/**
 * Sole new-create authority: team_tournament_create.
 * RPC_MISSING / missing writer → fail closed. Never dual-write.
 */
export async function persistCanonicalTeamTournamentCreate(input = {}, deps = {}) {
  const clubId = String(input.clubId || "").trim();
  const tenantId = String(input.tenantId || input.runtimeTenantId || "").trim();
  if (!clubId) {
    return failClosed("CLUB_REQUIRED", "Thiếu CLB để tạo giải đồng đội.");
  }
  if (!tenantId) {
    return failClosed("TENANT_MISSING", "Thiếu tenant để tạo giải đồng đội.");
  }

  const payload = buildCanonicalTeamCreatePayload(input);

  if (typeof deps.createViaRpc !== "function") {
    return failClosed(
      "RPC_MISSING",
      "Chưa có RPC team_tournament_create — không tạo giải bằng writer phụ."
    );
  }

  const rpcResult = await deps.createViaRpc({
    tenantId,
    clubId,
    payload,
  });

  if (rpcResult?.ok && rpcResult.tournament?.id) {
    return finalizeCreated(rpcResult, clubId, tenantId, payload, input);
  }

  return failClosed(
    rpcResult?.code || "CANONICAL_CREATE_FAILED",
    rpcResult?.error || "Không tạo được giải đồng đội trên máy chủ.",
    { tournament: rpcResult?.tournament || null }
  );
}

function finalizeCreated(rpcResult, clubId, tenantId, payload, input) {
  const tournamentId = String(rpcResult.tournament.id);
  const rpcTournament = rpcResult.tournament;
  const teamData = adoptCanonicalCreateTeamData(
    rpcTournament.teamData,
    rpcTournament.settings || payload.settings
  );
  const tournament = {
    ...rpcTournament,
    id: tournamentId,
    clubId,
    tenantId,
    canonicalId: tournamentId,
    mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
    status: rpcTournament.status || TOURNAMENT_STATUS.DRAFT,
    name: rpcTournament.name || payload.name,
    seasonId: rpcTournament.seasonId || payload.seasonId || input.seasonId || "",
    leagueId: rpcTournament.leagueId || payload.leagueId || input.leagueId || "",
    settings: rpcTournament.settings || payload.settings,
    teamData,
    createdBy: payload.createdBy,
    ownerPlayerId: payload.ownerPlayerId,
  };
  return {
    ok: true,
    tournament,
    clubId,
    tenantId,
    canonical: true,
    cloudSynced: true,
    tournamentId,
    replayed: rpcResult.replayed === true,
  };
}

/**
 * Historical heal only. Does not create new tournaments.
 * Sole authority: team_tournament_ensure_canonical.
 */
export async function ensureCanonicalTeamTournamentListing(input = {}, deps = {}) {
  if (typeof deps.ensureViaRpc !== "function") {
    return failClosed(
      "RPC_MISSING",
      "Chưa có RPC team_tournament_ensure_canonical — không heal bằng writer phụ."
    );
  }
  const result = await deps.ensureViaRpc({
    tenantId: input.tenantId,
    clubId: input.clubId,
    tournamentId: input.tournamentId,
    name: input.name,
    createdBy: input.createdBy,
  });
  if (result?.ok) return result;
  return failClosed(
    result?.code || "CANONICAL_ENSURE_FAILED",
    result?.error || "Không đồng bộ được giải vào danh sách canonical."
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
