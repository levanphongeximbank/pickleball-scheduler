/**
 * Bridge individual referee assignment (payload) → tournament_match_live (execution only).
 * Official mint/revoke goes through server commands. Direct client upsert is not used.
 */

import {
  resolveMatchLabels,
} from "../../../tournament/engines/refereeEngine.js";
import { collectEventMatches } from "./refereeAssignEngine.js";
import {
  ensureOfficialMatchLiveCommand,
  revokeOfficialMatchLiveCommand,
} from "../../tournament/official-lifecycle/officialOpenLifecycleCommands.js";

export const REFEREE_IDENTITY_BINDING_BLOCKED = false;
/** Live table has no structured scoring-rules columns; stageLabel must not carry them. */
export const REFEREE_SCORING_RULE_TRANSPORT_BLOCKED = true;

function resolveScope(tournament, clubId) {
  return {
    tenantId: tournament?.tenantId || "",
    clubId: clubId || tournament?.clubId || "",
    tournamentId: tournament?.id,
  };
}

/**
 * Mint or refresh the live execution row for an assigned Official match.
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

  const labels = resolveMatchLabels(match, {
    entries: (tournament.events || []).flatMap((event) => event.entries || []),
    players,
    courts,
  });
  const scope = resolveScope(tournament, clubId);
  const result = await ensureOfficialMatchLiveCommand({
    ...scope,
    matchId: match.id,
    labels: {
      tournamentName: tournament.name || "",
      refereeName: match.referee?.name || "",
      entryALabel: labels?.entryALabel || labels?.sideA || "",
      entryBLabel: labels?.entryBLabel || labels?.sideB || "",
      courtLabel: labels?.courtLabel || "",
      stageLabel: labels?.stageLabel || "",
      scheduledStart: match.scheduledStart || "",
    },
  });
  if (!result.ok) {
    return { ok: false, error: result.error || "Không đồng bộ live.", code: result.code };
  }
  return { ok: true, row: result };
}

export async function revokeOfficialAssignedMatchLive({ tournament, matchId, clubId }) {
  if (!tournament || !matchId) {
    return { ok: false, error: "Thiếu giải hoặc trận.", skipped: true };
  }
  const scope = resolveScope(tournament, clubId);
  return revokeOfficialMatchLiveCommand({
    ...scope,
    matchId,
  });
}

/**
 * After assign/reassign/auto-assign/unassign, sync affected matches to live.
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

  if (assignResult.matchId && !assignResult.match && !assignResult.assigned) {
    const revoked = await revokeOfficialAssignedMatchLive({
      tournament,
      matchId: assignResult.matchId,
      clubId,
    });
    return {
      ok: revoked.ok !== false,
      synced: [],
      revoked: [assignResult.matchId],
      error: revoked.ok === false ? revoked.error : null,
    };
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
        code: result.code,
      });
    }
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
