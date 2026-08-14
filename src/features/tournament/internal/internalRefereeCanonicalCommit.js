/**
 * Internal referee canonical result commit (IT-E2E-BROWSER-017).
 * Live runtime remains the in-match scorer. Finish writes canonical match
 * result once via security-definer RPC (assigned referee cannot call
 * canonical_tournament_update).
 */
import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import { submitMatchScore } from "../../../tournament/engines/matchEngine.js";
import { submitTournamentDirectorMatchScore } from "../../../tournament/engines/tournamentDirectorEngine.js";
import { buildAllGroupStandings } from "../../../tournament/engines/rankingEngine.js";
import { isInternalRefereeEnsureToken } from "./internalRefereeRuntimeEnsure.js";

export const CANONICAL_COMMIT_INTERNAL_REFEREE_MATCH_RESULT =
  "canonical_commit_internal_referee_match_result";

export const INTERNAL_REFEREE_COMMIT_SQL_REQUIRED = "STAGING_SQL_GO_REQUIRED";

export function projectInternalRefereeCanonicalMatchResult(match, scores = {}) {
  return submitMatchScore(match, scores, { allowDraw: false });
}

export function projectInternalRefereeCanonicalEventResult(event, matchId, scores = {}) {
  return submitTournamentDirectorMatchScore(event, matchId, scores, { allowDraw: false });
}

export function standingsFromInternalEvent(event) {
  return buildAllGroupStandings(event || { entries: [], matches: [], groups: [] });
}

function defaultCommitRpc(name, args) {
  const supabase = getSupabaseAuthClient();
  if (!supabase?.rpc) return null;
  return supabase.rpc(name, args);
}

function classifyCommitError(error) {
  const message = String(error?.message || error || "");
  const code = String(error?.code || "");
  if (code === "PGRST202" || /function.*not found/i.test(message)) {
    return INTERNAL_REFEREE_COMMIT_SQL_REQUIRED;
  }
  if (/VERSION_REQUIRED/i.test(message)) return "VERSION_REQUIRED";
  if (/VERSION_CONFLICT/i.test(message)) return "VERSION_CONFLICT";
  if (/TOURNAMENT_FORBIDDEN/i.test(message) || code === "42501") return "FORBIDDEN";
  if (/NOT_AUTHENTICATED/i.test(message)) return "NOT_AUTHENTICATED";
  if (/REFEREE_TOKEN_INVALID/i.test(message)) return "INVALID_TOKEN";
  if (/REFEREE_TOKEN_NOT_FOUND/i.test(message)) return "NOT_FOUND";
  if (/DRAW_NOT_ALLOWED/i.test(message)) return "DRAW_NOT_ALLOWED";
  if (/MATCH_ALREADY_COMPLETED/i.test(message)) return "MATCH_ALREADY_COMPLETED";
  return "COMMIT_FAILED";
}

export async function commitInternalRefereeMatchResult(
  {
    token,
    scoreA,
    scoreB,
    expectedVersion,
  } = {},
  { rpc } = {}
) {
  const trimmed = String(token || "").trim();
  if (!isInternalRefereeEnsureToken(trimmed)) {
    return { ok: false, code: "INVALID_TOKEN" };
  }
  const a = Math.max(0, Number(scoreA) || 0);
  const b = Math.max(0, Number(scoreB) || 0);
  if (a === b) {
    return { ok: false, code: "DRAW_NOT_ALLOWED", error: "Trận hòa chưa được cho phép." };
  }
  if (expectedVersion == null || !Number.isFinite(Number(expectedVersion))) {
    return { ok: false, code: "VERSION_REQUIRED" };
  }

  const callRpc = typeof rpc === "function" ? rpc : defaultCommitRpc;
  let result;
  try {
    result = await callRpc(CANONICAL_COMMIT_INTERNAL_REFEREE_MATCH_RESULT, {
      p_token: trimmed,
      p_score_a: a,
      p_score_b: b,
      p_expected_version: Number(expectedVersion),
    });
  } catch (error) {
    const code = classifyCommitError(error);
    return {
      ok: false,
      code,
      error:
        code === INTERNAL_REFEREE_COMMIT_SQL_REQUIRED
          ? "Máy chủ chưa bật ghi kết quả trọng tài nội bộ. Cần Owner GO SQL."
          : String(error?.message || error || ""),
    };
  }

  if (result == null) {
    return { ok: false, code: "NO_CLIENT" };
  }
  const data = result?.data !== undefined ? result.data : result;
  const error = result?.error;
  if (error) {
    const code = classifyCommitError(error);
    return {
      ok: false,
      code,
      error:
        code === INTERNAL_REFEREE_COMMIT_SQL_REQUIRED
          ? "Máy chủ chưa bật ghi kết quả trọng tài nội bộ. Cần Owner GO SQL."
          : String(error.message || error),
    };
  }
  if (data && data.ok === false) {
    return { ok: false, code: data.code || "COMMIT_FAILED", error: data.error || "" };
  }
  return {
    ok: true,
    matchId: data?.match_id || data?.matchId || null,
    scoreA: data?.score_a ?? a,
    scoreB: data?.score_b ?? b,
    status: data?.status || MATCH_STATUS.COMPLETED,
    version: data?.version ?? null,
    tournament: data?.tournament || null,
  };
}
