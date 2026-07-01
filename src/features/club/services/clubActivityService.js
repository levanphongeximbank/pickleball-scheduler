import { guardClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { guardClubTenant } from "../../tenant/guards/tenantGuard.js";
import { CLUB_MATCH_TYPES } from "../models/clubMatch.js";
import { CLUB_MEMBER_STATUSES } from "../constants/clubMemberRoles.js";
import { loadClubExtension } from "../storage/clubExtensionStorage.js";
import { getClubMembers } from "./clubMemberService.js";
import { addClubMatch } from "./clubMatchService.js";
import { applyClubMatchEloById } from "./clubEloService.js";

function guardMatchWrite(clubId, tenantId) {
  if (tenantId) {
    const check = guardClubTenant(clubId, tenantId);
    if (!check.ok) {
      return check;
    }
  }
  return guardClubAction(clubId, PERMISSIONS.TOURNAMENT_UPDATE);
}

function assertPlayersAreMembers(clubId, playerIds, tenantId) {
  const members = getClubMembers(clubId, tenantId).filter(
    (m) => m.status === CLUB_MEMBER_STATUSES.ACTIVE
  );
  const memberIds = new Set(members.map((m) => m.playerId));

  for (const playerId of playerIds) {
    if (!memberIds.has(String(playerId))) {
      return { ok: false, error: `Player ${playerId} không phải thành viên active của CLB.` };
    }
  }

  return { ok: true };
}

function resolveWinnerTeam(scoreA, scoreB) {
  if (scoreA == null || scoreB == null) {
    return null;
  }
  if (Number(scoreA) > Number(scoreB)) {
    return "A";
  }
  if (Number(scoreB) > Number(scoreA)) {
    return "B";
  }
  return null;
}

export function createFriendlyClubMatch(clubId, data = {}, tenantId) {
  const check = guardMatchWrite(clubId, tenantId);
  if (!check.ok) {
    return check;
  }

  const teamA = (data.teamAPlayerIds || []).map(String).filter(Boolean);
  const teamB = (data.teamBPlayerIds || []).map(String).filter(Boolean);

  if (!teamA.length || !teamB.length) {
    return { ok: false, error: "Cần chọn player cho cả hai đội." };
  }

  const overlap = teamA.some((id) => teamB.includes(id));
  if (overlap) {
    return { ok: false, error: "Không được trùng player giữa hai đội." };
  }

  const memberCheck = assertPlayersAreMembers(clubId, [...teamA, ...teamB], tenantId);
  if (!memberCheck.ok) {
    return memberCheck;
  }

  const teamAScore = data.teamAScore != null ? Number(data.teamAScore) : null;
  const teamBScore = data.teamBScore != null ? Number(data.teamBScore) : null;
  const winnerTeam = data.winnerTeam || resolveWinnerTeam(teamAScore, teamBScore);

  const created = addClubMatch(
    clubId,
    {
      type: CLUB_MATCH_TYPES.FRIENDLY,
      playedAt: data.playedAt || new Date().toISOString(),
      teamAPlayerIds: teamA,
      teamBPlayerIds: teamB,
      teamAScore,
      teamBScore,
      winnerTeam,
      eloApplied: false,
    },
    tenantId
  );

  if (!created.ok) {
    return created;
  }

  if (winnerTeam && data.applyElo !== false) {
    const eloResult = applyClubMatchEloById(created.match.id, clubId, tenantId);
    return { ...created, eloResult };
  }

  return created;
}

export function getRecentClubActivity(clubId, tenantId, limit = 8) {
  const ext = loadClubExtension(clubId);
  const matches = [...ext.matches].sort(
    (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
  );
  const history = [...ext.ratingHistory].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );

  const items = [
    ...matches.slice(0, limit).map((m) => ({
      kind: "match",
      at: m.playedAt,
      id: m.id,
      label:
        m.type === CLUB_MATCH_TYPES.FRIENDLY
          ? `Trận giao hữu — ${m.teamAScore ?? "?"}:${m.teamBScore ?? "?"}`
          : `Giải nội bộ — ${m.teamAScore ?? "?"}:${m.teamBScore ?? "?"}`,
    })),
    ...history.slice(0, limit).map((h) => ({
      kind: "elo",
      at: h.changedAt,
      id: h.id,
      label: `ELO ${h.oldElo} → ${h.newElo}${h.reason ? ` (${h.reason})` : ""}`,
    })),
  ];

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
