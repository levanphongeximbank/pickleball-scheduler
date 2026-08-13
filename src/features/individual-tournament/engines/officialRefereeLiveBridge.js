/**
 * Bridge individual referee assignment (payload) → tournament_match_live (live read model).
 * Payload match remains competition result authority; live row is execution only.
 *
 * Lazy-imports matchLiveSync so unit tests can exercise assignment without loading Supabase.
 */

import {
  buildMatchLiveRecord,
  resolveMatchLabels,
} from "../../../tournament/engines/refereeEngine.js";
import { collectEventMatches } from "./refereeAssignEngine.js";

export const REFEREE_IDENTITY_BINDING_BLOCKED = true;
/** Live table has no structured scoring-rules columns; stageLabel must not carry them. */
export const REFEREE_SCORING_RULE_TRANSPORT_BLOCKED = true;

async function loadMatchLiveApi() {
  const mod = await import("../../../domain/matchLiveSync.js");
  return {
    hasSupabaseConfig: mod.hasSupabaseConfig,
    upsertMatchLive: mod.upsertMatchLive,
  };
}

/**
 * Sync one assigned match to live table if referee token exists.
 */
export async function syncOfficialAssignedMatchToLive({
  tournament,
  match,
  clubId,
  courts = [],
  players = [],
}) {
  if (!tournament || !match) {
    return { ok: false, error: "Thiếu giải hoặc trận.", skipped: true };
  }
  if (!match?.referee?.token) {
    return {
      ok: false,
      error: "Trận chưa có token trọng tài — không tạo live row.",
      skipped: true,
    };
  }

  let liveApi;
  try {
    liveApi = await loadMatchLiveApi();
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Không tải được matchLiveSync.",
      skipped: true,
      needsSupabase: true,
    };
  }

  if (!liveApi.hasSupabaseConfig()) {
    return {
      ok: false,
      error: "Cần cấu hình Supabase để đồng bộ live trọng tài.",
      skipped: true,
      needsSupabase: true,
    };
  }

  const labels = resolveMatchLabels(match, {
    entries: (tournament.events || []).flatMap((event) => event.entries || []),
    players,
    courts,
  });

  // stageLabel is display-only. Do not encode scoring method/target into it.
  // Structured scoring transport requires future live-table columns or authorized
  // tournament read for the referee token session (see REFEREE_SCORING_RULE_TRANSPORT_BLOCKED).
  const liveRecord = buildMatchLiveRecord({
    clubId,
    tournamentId: tournament.id,
    eventId: match.eventId || "",
    match,
    labels,
    isDaily: false,
    tournamentName: tournament.name || "",
  });

  if (!liveRecord) {
    return { ok: false, error: "Không tạo được live record.", skipped: true };
  }

  const syncResult = await liveApi.upsertMatchLive(liveRecord);
  if (!syncResult.ok) {
    return { ok: false, error: syncResult.error || "Không đồng bộ live.", liveRecord };
  }
  return { ok: true, row: syncResult.row, liveRecord };
}

/**
 * After assign/reassign/auto-assign, sync affected matches to live.
 */
export async function syncOfficialRefereeAssignResultToLive({
  tournament,
  assignResult,
  clubId,
  courts = [],
  players = [],
}) {
  if (!assignResult?.ok || !tournament) {
    return { ok: false, error: "Không có kết quả phân công hợp lệ.", synced: [] };
  }

  const matches = [];
  if (assignResult.match) {
    matches.push(assignResult.match);
  }
  if (Array.isArray(assignResult.assigned)) {
    assignResult.assigned.forEach((item) => {
      if (item?.match) matches.push(item.match);
      else if (item?.matchId) {
        const found = collectEventMatches(assignResult.tournament || tournament).find(
          (match) => String(match.id) === String(item.matchId)
        );
        if (found) matches.push(found);
      }
    });
  }

  if (matches.length === 0 && assignResult.tournament) {
    const assignments = assignResult.tournament.settings?.refereeAssignments || {};
    collectEventMatches(assignResult.tournament).forEach((match) => {
      if (match?.referee?.token || assignments[String(match.id)]) {
        matches.push(match);
      }
    });
  }

  const synced = [];
  const failures = [];
  for (const match of matches) {
    const result = await syncOfficialAssignedMatchToLive({
      tournament: assignResult.tournament || tournament,
      match,
      clubId,
      courts,
      players,
    });
    if (result.ok) {
      synced.push({ matchId: match.id, row: result.row });
    } else {
      failures.push({
        matchId: match.id,
        error: result.error,
        needsSupabase: Boolean(result.needsSupabase),
      });
    }
  }

  if (failures.some((item) => item.needsSupabase)) {
    return {
      ok: false,
      error: failures.find((item) => item.needsSupabase)?.error,
      synced,
      failures,
      needsSupabase: true,
    };
  }

  if (failures.length && synced.length === 0) {
    return {
      ok: false,
      error: failures[0]?.error || "Đồng bộ live thất bại.",
      synced,
      failures,
    };
  }

  return {
    ok: failures.length === 0,
    synced,
    failures,
    warning:
      failures.length > 0
        ? `Đã phân công nhưng ${failures.length} trận chưa đồng bộ live.`
        : null,
  };
}
