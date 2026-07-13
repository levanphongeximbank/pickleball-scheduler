import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

let testRpcClientOverride = null;

/** RPC names that have Phase 23C + TT-1B overloads — always pass full TT-1B arg set. */
export const TT1B_COMMAND_RPCS = Object.freeze([
  "team_tournament_submit_lineup",
  "team_tournament_randomize_lineup",
  "team_tournament_lock_matchup",
  "team_tournament_publish_matchup",
  "team_tournament_confirm_sub_match",
  "team_tournament_apply_forfeit",
  "team_tournament_withdraw_team",
  "team_tournament_provision_referee_match",
  "team_tournament_revoke_referee_link",
]);

/** TT-1B commands that require optimistic-lock version before RPC. */
export const TT1B_REQUIRES_EXPECTED_VERSION = Object.freeze([
  "team_tournament_submit_lineup",
  "team_tournament_confirm_sub_match",
]);

/** Auto idempotency key prefix when caller omits idempotencyKey (same rule as cloudSync). */
export const TT1B_IDEMPOTENCY_PREFIX_BY_RPC = Object.freeze({
  team_tournament_save_lineup_draft: "draft",
  team_tournament_submit_lineup: "submit",
  team_tournament_randomize_lineup: "randomize",
  team_tournament_lock_matchup: "lock",
  team_tournament_publish_matchup: "publish",
  team_tournament_override_lineup: "override",
  team_tournament_confirm_sub_match: "confirm",
  team_tournament_apply_forfeit: "forfeit",
  team_tournament_withdraw_team: "withdraw",
  team_tournament_provision_referee_match: "provision",
  team_tournament_revoke_referee_link: "revoke_link",
  team_tournament_resync_referee_link: "resync_link",
  team_tournament_upsert_standings: "standings",
});

/** Exact PostgREST argument names for TT-1B 6/7-parameter overloads (never legacy 23C-only sets). */
export const TT1B_RPC_ARG_CONTRACTS = Object.freeze({
  team_tournament_save_lineup_draft: [
    "p_tournament_id",
    "p_matchup_id",
    "p_team_id",
    "p_selections",
    "p_expected_version",
    "p_idempotency_key",
  ],
  team_tournament_submit_lineup: [
    "p_tournament_id",
    "p_matchup_id",
    "p_team_id",
    "p_selections",
    "p_expected_version",
    "p_idempotency_key",
  ],
  team_tournament_randomize_lineup: [
    "p_tournament_id",
    "p_matchup_id",
    "p_team_id",
    "p_expected_version",
    "p_idempotency_key",
  ],
  team_tournament_lock_matchup: [
    "p_tournament_id",
    "p_matchup_id",
    "p_expected_version",
    "p_idempotency_key",
  ],
  team_tournament_publish_matchup: [
    "p_tournament_id",
    "p_matchup_id",
    "p_expected_matchup_version",
    "p_expected_lineup_a_version",
    "p_expected_lineup_b_version",
    "p_idempotency_key",
  ],
  team_tournament_override_lineup: [
    "p_tournament_id",
    "p_matchup_id",
    "p_team_id",
    "p_selections",
    "p_reason",
    "p_expected_matchup_version",
    "p_expected_lineup_version",
    "p_idempotency_key",
  ],
  team_tournament_confirm_sub_match: [
    "p_tournament_id",
    "p_matchup_id",
    "p_sub_match_id",
    "p_score",
    "p_winner_team_id",
    "p_expected_version",
    "p_idempotency_key",
  ],
  team_tournament_apply_forfeit: [
    "p_tournament_id",
    "p_matchup_id",
    "p_sub_match_id",
    "p_forfeiting_team_id",
    "p_scope",
    "p_result_type",
    "p_forfeit_reason",
    "p_technical_score",
    "p_expected_version",
    "p_idempotency_key",
    "p_reason_code",
    "p_request_id",
  ],
  team_tournament_withdraw_team: [
    "p_tournament_id",
    "p_team_id",
    "p_reason",
    "p_reason_code",
    "p_idempotency_key",
    "p_request_id",
  ],
  team_tournament_provision_referee_match: [
    "p_tournament_id",
    "p_matchup_id",
    "p_sub_match_id",
    "p_referee_assignment_id",
    "p_expected_sub_match_version",
    "p_idempotency_key",
    "p_reason",
    "p_source",
  ],
  team_tournament_revoke_referee_link: [
    "p_tournament_id",
    "p_sub_match_id",
    "p_reason",
    "p_expected_link_version",
    "p_idempotency_key",
  ],
  team_tournament_resync_referee_link: [
    "p_tournament_id",
    "p_sub_match_id",
    "p_expected_link_version",
    "p_reason",
  ],
  team_tournament_upsert_standings: [
    "p_tournament_id",
    "p_standings",
    "p_expected_version",
    "p_idempotency_key",
  ],
});

/** Phase 23C legacy overload signatures — client must never emit these alone. */
export const TT1B_LEGACY_RPC_ARG_CONTRACTS = Object.freeze({
  team_tournament_save_lineup_draft: [
    "p_tournament_id",
    "p_matchup_id",
    "p_team_id",
    "p_selections",
  ],
  team_tournament_submit_lineup: [
    "p_tournament_id",
    "p_matchup_id",
    "p_team_id",
    "p_selections",
  ],
  team_tournament_lock_matchup: ["p_tournament_id", "p_matchup_id"],
  team_tournament_publish_matchup: ["p_tournament_id", "p_matchup_id"],
  team_tournament_confirm_sub_match: [
    "p_tournament_id",
    "p_matchup_id",
    "p_sub_match_id",
    "p_score",
    "p_winner_team_id",
  ],
  team_tournament_upsert_standings: ["p_tournament_id", "p_standings"],
});

export function __setTeamTournamentRpcClientForTests(client) {
  testRpcClientOverride = client;
}

export function __resetTeamTournamentRpcClientForTests() {
  testRpcClientOverride = null;
}

export function createTeamTournamentIdempotencyKey(prefix = "tt") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveRpcClient() {
  return testRpcClientOverride || getSupabaseAuthClient();
}

function parseRpcJson(data) {
  if (!data) {
    return { ok: false, code: "EMPTY_RESPONSE", error: "RPC trả về rỗng." };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, ...data };
}

export function isTeamTournamentRpcNotFoundError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist"))
  );
}

export function isTeamTournamentRpcSignatureMismatchError(error) {
  return error?.code === "PGRST202";
}

export function mapTeamTournamentRpcTransportError(error) {
  if (!error) {
    return { ok: false, code: "RPC_FAILED", error: "Unknown RPC error.", provider: "rpc" };
  }

  if (isTeamTournamentRpcSignatureMismatchError(error)) {
    return {
      ok: false,
      code: "rpc_signature_mismatch",
      error: error.message,
      provider: "rpc",
    };
  }

  if (isTeamTournamentRpcNotFoundError(error)) {
    return {
      ok: false,
      code: "rpc_not_deployed",
      legacyCode: "RPC_NOT_DEPLOYED",
      error: error.message,
      provider: "rpc",
    };
  }

  return {
    ok: false,
    code: "RPC_FAILED",
    error: error.message,
    provider: "rpc",
  };
}

/**
 * Always attach TT-1B command params so PostgREST resolves the 6-parameter overload,
 * not the legacy Phase 23C signature.
 */
export function buildTt1bCommandRpcArgs(baseArgs, options = {}) {
  const expectedVersion =
    options.expectedVersion != null && options.expectedVersion !== ""
      ? Number(options.expectedVersion)
      : null;
  const idempotencyKey =
    options.idempotencyKey != null && options.idempotencyKey !== ""
      ? String(options.idempotencyKey)
      : null;

  return {
    ...baseArgs,
    p_expected_version: expectedVersion,
    p_idempotency_key: idempotencyKey,
  };
}

function resolveTt1bIdempotencyKey(rpcName, normalized) {
  if (normalized.idempotencyKey != null && normalized.idempotencyKey !== "") {
    return String(normalized.idempotencyKey);
  }

  const prefix = TT1B_IDEMPOTENCY_PREFIX_BY_RPC[rpcName];
  if (prefix) {
    return createTeamTournamentIdempotencyKey(prefix);
  }

  return null;
}

/**
 * Validate + normalize TT-1B command params before PostgREST call.
 * @returns {{ ok: true, args: object } | { ok: false, code: string, error: string, provider: 'client' }}
 */
export function prepareTt1bCommandRpcCall(rpcName, baseArgs, normalized = {}) {
  if (TT1B_REQUIRES_EXPECTED_VERSION.includes(rpcName)) {
    if (normalized.expectedVersion == null || normalized.expectedVersion === "") {
      return {
        ok: false,
        code: "MISSING_EXPECTED_VERSION",
        error: `${rpcName} yêu cầu expectedVersion — không gọi overload 23C.`,
        provider: "client",
      };
    }
  }

  const idempotencyKey = resolveTt1bIdempotencyKey(rpcName, normalized);
  if (!idempotencyKey) {
    return {
      ok: false,
      code: "MISSING_IDEMPOTENCY_KEY",
      error: `${rpcName} yêu cầu idempotencyKey hoặc prefix auto-generate.`,
      provider: "client",
    };
  }

  const args = buildTt1bCommandRpcArgs(baseArgs, {
    ...normalized,
    idempotencyKey,
  });

  const contract = TT1B_RPC_ARG_CONTRACTS[rpcName];
  if (contract) {
    const argNames = Object.keys(args).sort();
    const expected = [...contract].sort();
    const isLegacyOnly =
      JSON.stringify(argNames) === JSON.stringify([...TT1B_LEGACY_RPC_ARG_CONTRACTS[rpcName]].sort());
    if (isLegacyOnly || argNames.join(",") !== expected.join(",")) {
      return {
        ok: false,
        code: "RPC_ARG_CONTRACT_MISMATCH",
        error: `${rpcName} argument contract mismatch`,
        provider: "client",
        expectedArgs: expected,
        actualArgs: argNames,
      };
    }
  }

  return { ok: true, args, idempotencyKey };
}

async function callTt1bCommandRpc(rpcName, baseArgs, normalized) {
  const prepared = prepareTt1bCommandRpcCall(rpcName, baseArgs, normalized);
  if (!prepared.ok) {
    return prepared;
  }
  return callTeamTournamentRpc(rpcName, prepared.args);
}

async function callTeamTournamentRpc(rpcName, args = {}) {
  const client = resolveRpcClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc(rpcName, args);

  if (error) {
    return mapTeamTournamentRpcTransportError(error);
  }

  const payload = parseRpcJson(data);

  if (payload.replay && payload.result && typeof payload.result === "object") {
    return { ...payload.result, replay: true, provider: "rpc" };
  }

  if (!payload.ok) {
    const code = payload.code || "FORBIDDEN";
    const passthrough = [
      "version_conflict",
      "idempotency_payload_mismatch",
      "VALIDATION",
      "LOCKED",
      "lineup_locked",
      "deadline_passed",
      "player_not_in_team",
      "player_inactive",
      "player_not_eligible",
      "invalid_gender",
      "invalid_discipline",
      "duplicate_player",
      "duplicate_slot",
      "roster_limit_exceeded",
      "lineup_incomplete",
      "captain_scope_denied",
      "cross_tenant_denied",
      "publish_forbidden",
      "matchup_not_locked",
      "lineup_not_locked",
      "lineup_missing",
      "missing_policy_unresolved",
      "manual_pending",
      "already_published",
      "CANNOT_PUBLISH",
      "NOT_FOUND",
      "FORBIDDEN",
      "NOT_AUTHENTICATED",
    ];
    if (passthrough.includes(code)) {
      return { ...payload, provider: "rpc" };
    }
    const errorByCode = {
      NOT_FOUND: "Giải chưa có trên cloud. Kiểm tra venue ở header rồi thử lại.",
      FORBIDDEN: "Không có quyền quản lý giải đồng đội.",
      NOT_AUTHENTICATED: "Phiên đăng nhập hết hạn — đăng nhập lại.",
      VALIDATION: payload.error || "Dữ liệu đội không hợp lệ.",
    };
    return {
      ok: false,
      code,
      error: payload.error || errorByCode[code] || "Không có quyền.",
      ...payload,
      provider: "rpc",
    };
  }

  return { ...payload, provider: "rpc" };
}

function normalizeCommandParams(params, legacyArgs) {
  if (typeof params === "object" && params !== null && "tournamentId" in params) {
    return params;
  }
  return legacyArgs;
}

export async function rpcTeamTournamentGetSetup(tournamentId, viewerTeamId = null) {
  return callTeamTournamentRpc("team_tournament_get_setup", {
    p_tournament_id: String(tournamentId),
    p_viewer_team_id: viewerTeamId ? String(viewerTeamId) : null,
  });
}

export async function rpcTeamTournamentGetVisibleLineups(
  tournamentId,
  matchupId,
  viewerTeamId = null
) {
  return callTeamTournamentRpc("team_tournament_get_visible_lineups", {
    p_tournament_id: String(tournamentId),
    p_matchup_id: String(matchupId),
    p_viewer_team_id: viewerTeamId ? String(viewerTeamId) : null,
  });
}

export async function rpcTeamTournamentSaveTeam(tournamentId, team) {
  return callTeamTournamentRpc("team_tournament_save_team", {
    p_tournament_id: String(tournamentId),
    p_team: team,
  });
}

export async function rpcTeamTournamentAssignMember(tournamentId, teamId, playerId) {
  return callTeamTournamentRpc("team_tournament_assign_member", {
    p_tournament_id: String(tournamentId),
    p_team_id: String(teamId),
    p_player_id: String(playerId),
  });
}

export async function rpcTeamTournamentRemoveMember(tournamentId, teamId, playerId) {
  return callTeamTournamentRpc("team_tournament_remove_member", {
    p_tournament_id: String(tournamentId),
    p_team_id: String(teamId),
    p_player_id: String(playerId),
  });
}

export async function rpcTeamTournamentSetCaptain(
  tournamentId,
  teamId,
  playerId,
  deputyIds = []
) {
  return callTeamTournamentRpc("team_tournament_set_captain", {
    p_tournament_id: String(tournamentId),
    p_team_id: String(teamId),
    p_player_id: String(playerId),
    p_deputy_ids: deputyIds,
  });
}

export async function rpcTeamTournamentSaveLineupDraft(params, matchupId, teamId, selections) {
  const normalized = normalizeCommandParams(params, {
    tournamentId: params,
    matchupId,
    teamId,
    selections,
  });

  if (normalized.expectedVersion != null && normalized.idempotencyKey) {
    return callTt1bCommandRpc(
      "team_tournament_save_lineup_draft",
      {
        p_tournament_id: String(normalized.tournamentId),
        p_matchup_id: String(normalized.matchupId),
        p_team_id: String(normalized.teamId),
        p_selections: normalized.selections || {},
      },
      normalized
    );
  }

  return callTeamTournamentRpc("team_tournament_save_lineup_draft", {
    p_tournament_id: String(normalized.tournamentId),
    p_matchup_id: String(normalized.matchupId),
    p_team_id: String(normalized.teamId),
    p_selections: normalized.selections || {},
  });
}

export async function rpcTeamTournamentSubmitLineup(params, matchupId, teamId, selections) {
  const normalized = normalizeCommandParams(params, {
    tournamentId: params,
    matchupId,
    teamId,
    selections,
  });

  return callTt1bCommandRpc(
    "team_tournament_submit_lineup",
    {
      p_tournament_id: String(normalized.tournamentId),
      p_matchup_id: String(normalized.matchupId),
      p_team_id: String(normalized.teamId),
      p_selections: normalized.selections,
    },
    normalized
  );
}

export async function rpcTeamTournamentLockMatchup(params, matchupId) {
  const normalized = normalizeCommandParams(params, {
    tournamentId: params,
    matchupId,
  });

  return callTt1bCommandRpc(
    "team_tournament_lock_matchup",
    {
      p_tournament_id: String(normalized.tournamentId),
      p_matchup_id: String(normalized.matchupId),
    },
    normalized
  );
}

export async function rpcTeamTournamentRandomizeLineup(params, matchupId, teamId) {
  const normalized = normalizeCommandParams(params, {
    tournamentId: params,
    matchupId,
    teamId,
  });

  return callTt1bCommandRpc(
    "team_tournament_randomize_lineup",
    {
      p_tournament_id: String(normalized.tournamentId),
      p_matchup_id: String(normalized.matchupId),
      p_team_id: String(normalized.teamId),
    },
    normalized
  );
}

export function buildPublishRpcArgs(baseArgs, options = {}) {
  const expectedMatchupVersion =
    options.expectedVersion != null && options.expectedVersion !== ""
      ? Number(options.expectedVersion)
      : null;
  const expectedLineupAVersion =
    options.expectedLineupAVersion != null && options.expectedLineupAVersion !== ""
      ? Number(options.expectedLineupAVersion)
      : null;
  const expectedLineupBVersion =
    options.expectedLineupBVersion != null && options.expectedLineupBVersion !== ""
      ? Number(options.expectedLineupBVersion)
      : null;
  const idempotencyKey =
    options.idempotencyKey != null && options.idempotencyKey !== ""
      ? String(options.idempotencyKey)
      : null;

  return {
    ...baseArgs,
    p_expected_matchup_version: expectedMatchupVersion,
    p_expected_lineup_a_version: expectedLineupAVersion,
    p_expected_lineup_b_version: expectedLineupBVersion,
    p_idempotency_key: idempotencyKey,
  };
}

export function preparePublishRpcCall(baseArgs, normalized = {}) {
  if (normalized.expectedVersion == null || normalized.expectedVersion === "") {
    return {
      ok: false,
      code: "MISSING_EXPECTED_VERSION",
      error: "team_tournament_publish_matchup yêu cầu expectedVersion (matchup).",
      provider: "client",
    };
  }
  if (normalized.expectedLineupAVersion == null || normalized.expectedLineupAVersion === "") {
    return {
      ok: false,
      code: "MISSING_EXPECTED_LINEUP_VERSION",
      error: "team_tournament_publish_matchup yêu cầu expectedLineupAVersion.",
      provider: "client",
    };
  }
  if (normalized.expectedLineupBVersion == null || normalized.expectedLineupBVersion === "") {
    return {
      ok: false,
      code: "MISSING_EXPECTED_LINEUP_VERSION",
      error: "team_tournament_publish_matchup yêu cầu expectedLineupBVersion.",
      provider: "client",
    };
  }

  const idempotencyKey = resolveTt1bIdempotencyKey("team_tournament_publish_matchup", normalized);
  if (!idempotencyKey) {
    return {
      ok: false,
      code: "MISSING_IDEMPOTENCY_KEY",
      error: "team_tournament_publish_matchup yêu cầu idempotencyKey.",
      provider: "client",
    };
  }

  const args = buildPublishRpcArgs(baseArgs, {
    ...normalized,
    idempotencyKey,
  });

  const contract = TT1B_RPC_ARG_CONTRACTS.team_tournament_publish_matchup;
  const argNames = Object.keys(args).sort();
  const expected = [...contract].sort();
  if (argNames.join(",") !== expected.join(",")) {
    return {
      ok: false,
      code: "RPC_ARG_CONTRACT_MISMATCH",
      error: "team_tournament_publish_matchup argument contract mismatch",
      provider: "client",
      expectedArgs: expected,
      actualArgs: argNames,
    };
  }

  return { ok: true, args, idempotencyKey };
}

export async function rpcTeamTournamentPublishMatchup(params, matchupId) {
  const normalized = normalizeCommandParams(params, {
    tournamentId: params,
    matchupId,
  });

  const prepared = preparePublishRpcCall(
    {
      p_tournament_id: String(normalized.tournamentId),
      p_matchup_id: String(normalized.matchupId),
    },
    normalized
  );
  if (!prepared.ok) {
    return prepared;
  }

  return callTeamTournamentRpc("team_tournament_publish_matchup", prepared.args);
}

export async function rpcTeamTournamentSaveSubMatchDraft(
  tournamentId,
  matchupId,
  subMatchId,
  score
) {
  return callTeamTournamentRpc("team_tournament_save_sub_match_draft", {
    p_tournament_id: String(tournamentId),
    p_matchup_id: String(matchupId),
    p_sub_match_id: String(subMatchId),
    p_score: score,
  });
}

export async function rpcTeamTournamentConfirmSubMatch(
  params,
  matchupId,
  subMatchId,
  score,
  winnerTeamId = null
) {
  const normalized = normalizeCommandParams(params, {
    tournamentId: params,
    matchupId,
    subMatchId,
    score,
    winnerTeamId,
  });

  return callTt1bCommandRpc(
    "team_tournament_confirm_sub_match",
    {
      p_tournament_id: String(normalized.tournamentId),
      p_matchup_id: String(normalized.matchupId),
      p_sub_match_id: String(normalized.subMatchId),
      p_score: normalized.score,
      p_winner_team_id: normalized.winnerTeamId || null,
    },
    normalized
  );
}

export async function rpcTeamTournamentApplyForfeit(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};

  return callTt1bCommandRpc(
    "team_tournament_apply_forfeit",
    {
      p_tournament_id: String(normalized.tournamentId),
      p_matchup_id: String(normalized.matchupId),
      p_sub_match_id: normalized.subMatchId || null,
      p_forfeiting_team_id: normalized.forfeitingTeamId || null,
      p_scope: normalized.scope || "sub_match",
      p_result_type: normalized.resultType || "forfeit",
      p_forfeit_reason: normalized.forfeitReason || normalized.reason || "",
      p_technical_score: normalized.technicalScore || {},
      p_reason_code: normalized.reasonCode || "",
      p_request_id: normalized.requestId || null,
    },
    normalized
  );
}

export async function rpcTeamTournamentWithdrawTeam(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};

  return callTt1bCommandRpc(
    "team_tournament_withdraw_team",
    {
      p_tournament_id: String(normalized.tournamentId),
      p_team_id: String(normalized.teamId),
      p_reason: normalized.reason || "",
      p_reason_code: normalized.reasonCode || "team_withdrawal",
      p_request_id: normalized.requestId || null,
    },
    normalized
  );
}

export async function rpcTeamTournamentProvisionRefereeMatch(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};

  return callTt1bCommandRpc(
    "team_tournament_provision_referee_match",
    {
      p_tournament_id: String(normalized.tournamentId),
      p_matchup_id: String(normalized.matchupId),
      p_sub_match_id: String(normalized.subMatchId),
      p_referee_assignment_id: normalized.refereeAssignmentId,
      p_expected_sub_match_version: normalized.expectedSubMatchVersion ?? null,
      p_reason: normalized.reason || "tt5b_provision",
      p_source: normalized.source || "client",
    },
    normalized
  );
}

export async function rpcTeamTournamentRevokeRefereeLink(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};

  return callTt1bCommandRpc(
    "team_tournament_revoke_referee_link",
    {
      p_tournament_id: String(normalized.tournamentId),
      p_sub_match_id: String(normalized.subMatchId),
      p_reason: normalized.reason || "",
      p_expected_link_version: normalized.expectedLinkVersion ?? null,
    },
    normalized
  );
}

export async function rpcTeamTournamentResyncRefereeLink(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};

  return callTeamTournamentRpc("team_tournament_resync_referee_link", {
    p_tournament_id: String(normalized.tournamentId),
    p_sub_match_id: String(normalized.subMatchId),
    p_expected_link_version: normalized.expectedLinkVersion ?? null,
    p_reason: normalized.reason || "tt5c_resync",
  });
}

export async function rpcTeamTournamentGetStandings(tournamentId) {
  return callTeamTournamentRpc("team_tournament_get_standings", {
    p_tournament_id: String(tournamentId),
  });
}

export async function rpcTeamTournamentUpsertStandings(params, standings) {
  const normalized = normalizeCommandParams(params, {
    tournamentId: params,
    standings,
  });

  if (normalized.expectedVersion != null && normalized.idempotencyKey) {
    return callTt1bCommandRpc(
      "team_tournament_upsert_standings",
      {
        p_tournament_id: String(normalized.tournamentId),
        p_standings: normalized.standings,
      },
      normalized
    );
  }

  return callTeamTournamentRpc("team_tournament_upsert_standings", {
    p_tournament_id: String(normalized.tournamentId),
    p_standings: normalized.standings,
  });
}

export function prepareOverrideRpcCall(baseArgs, params = {}) {
  const normalized = normalizeCommandParams(params, baseArgs);
  const idempotencyKey = resolveTt1bIdempotencyKey("team_tournament_override_lineup", normalized);
  if (!idempotencyKey) {
    return {
      ok: false,
      code: "MISSING_IDEMPOTENCY_KEY",
      error: "team_tournament_override_lineup yêu cầu idempotencyKey.",
      provider: "client",
    };
  }

  const args = {
    p_tournament_id: String(normalized.tournamentId),
    p_matchup_id: String(normalized.matchupId),
    p_team_id: String(normalized.teamId),
    p_selections: normalized.selections || {},
    p_reason: String(normalized.reason || ""),
    p_expected_matchup_version: Number(normalized.expectedMatchupVersion),
    p_expected_lineup_version: Number(normalized.expectedLineupVersion),
    p_idempotency_key: idempotencyKey,
  };

  return { ok: true, args, idempotencyKey };
}

export async function rpcTeamTournamentOverrideLineup(params) {
  const prepared = prepareOverrideRpcCall(
    {
      tournamentId: params.tournamentId,
      matchupId: params.matchupId,
      teamId: params.teamId,
    },
    params
  );
  if (!prepared.ok) {
    return prepared;
  }
  return callTeamTournamentRpc("team_tournament_override_lineup", prepared.args);
}

export async function rpcTeamTournamentGetLineupOverrideOps(tournamentId, matchupId, teamId) {
  return callTeamTournamentRpc("team_tournament_get_lineup_override_ops", {
    p_tournament_id: String(tournamentId),
    p_matchup_id: String(matchupId),
    p_team_id: String(teamId),
  });
}

// ─── TT-5D Referee safety RPCs ─────────────────────────────────────

export async function rpcTeamTournamentRefereeMatchAccessOps({ tournamentId, matchId }) {
  return callTeamTournamentRpc("team_tournament_referee_match_access_ops", {
    p_tournament_id: String(tournamentId),
    p_match_id: String(matchId),
  });
}

export async function rpcTeamTournamentCreateRefereeAssignment(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};
  return callTeamTournamentRpc("team_tournament_create_referee_assignment", {
    p_tournament_id: String(normalized.tournamentId),
    p_matchup_id: String(normalized.matchupId),
    p_sub_match_id: String(normalized.subMatchId),
    p_referee_user_id: normalized.refereeUserId,
    p_expires_at: normalized.expiresAt ?? null,
    p_activate: normalized.activate !== false,
    p_idempotency_key: normalized.idempotencyKey ?? createTeamTournamentIdempotencyKey("tt5d-assign"),
    p_reason: normalized.reason || "tt5d_assign",
  });
}

export async function rpcTeamTournamentRevokeRefereeAssignment(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};
  return callTeamTournamentRpc("team_tournament_revoke_referee_assignment", {
    p_tournament_id: String(normalized.tournamentId),
    p_assignment_id: normalized.assignmentId,
    p_expected_version: normalized.expectedVersion ?? null,
    p_reason: normalized.reason || "",
    p_idempotency_key: normalized.idempotencyKey ?? createTeamTournamentIdempotencyKey("tt5d-revoke"),
  });
}

export async function rpcTeamTournamentListRefereeAssignments(tournamentId, subMatchId = null) {
  return callTeamTournamentRpc("team_tournament_list_referee_assignments", {
    p_tournament_id: String(tournamentId),
    p_sub_match_id: subMatchId ? String(subMatchId) : null,
  });
}

export async function rpcTeamTournamentRequestRefereeCorrection(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};
  return callTeamTournamentRpc("team_tournament_request_referee_correction", {
    p_tournament_id: String(normalized.tournamentId),
    p_match_id: String(normalized.matchId),
    p_result_revision_id: normalized.resultRevisionId,
    p_proposed_score: normalized.proposedScore || {},
    p_proposed_winner: normalized.proposedWinner ?? null,
    p_reason: normalized.reason || "",
    p_request_id: normalized.requestId || createTeamTournamentIdempotencyKey("corr-req"),
    p_expected_revision_version: normalized.expectedRevisionVersion ?? null,
    p_idempotency_key: normalized.idempotencyKey ?? createTeamTournamentIdempotencyKey("tt5d-corr"),
  });
}

export async function rpcTeamTournamentReviewRefereeCorrection(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};
  return callTeamTournamentRpc("team_tournament_review_referee_correction", {
    p_tournament_id: String(normalized.tournamentId),
    p_correction_request_id: normalized.correctionRequestId,
    p_decision: normalized.decision,
    p_review_reason: normalized.reviewReason ?? null,
    p_expected_version: normalized.expectedVersion ?? null,
    p_idempotency_key: normalized.idempotencyKey ?? createTeamTournamentIdempotencyKey("tt5d-review"),
  });
}

export async function rpcTeamTournamentListRefereeCorrections(tournamentId, status = null) {
  return callTeamTournamentRpc("team_tournament_list_referee_corrections", {
    p_tournament_id: String(tournamentId),
    p_status: status,
  });
}

export async function rpcTeamTournamentReopenRefereeMatch(params) {
  const normalized =
    typeof params === "object" && params !== null && "tournamentId" in params ? params : {};
  return callTeamTournamentRpc("team_tournament_reopen_referee_match", {
    p_tournament_id: String(normalized.tournamentId),
    p_sub_match_id: String(normalized.subMatchId),
    p_reason: normalized.reason || "",
    p_idempotency_key: normalized.idempotencyKey ?? createTeamTournamentIdempotencyKey("tt5d-reopen"),
  });
}
