import { loadClubData } from "../domain/clubStorage.js";
import { loadPlayerHistoryProfileForClub } from "../tournament/engines/playerHistoryEngine.js";
import { TOURNAMENT_MODE } from "../models/tournament/constants.js";
import { todayIsoDate } from "../pages/courtManagement/courtManagement.constants.js";

export function getLevelLabel(level) {
  const value = Number(level) || 0;

  if (value <= 2) return "Người mới";
  if (value <= 2.5) return "Trung bình";
  if (value <= 3.5) return "Khá";
  return "Cao thủ";
}

export function getLevelColor(level) {
  const value = Number(level) || 0;

  if (value <= 2) return "#16a34a";
  if (value <= 2.5) return "#0284c7";
  if (value <= 3.5) return "#f59e0b";
  return "#dc2626";
}

export function getLevelProgress(level) {
  return Math.min(100, Math.max(0, ((Number(level) - 1.5) / 4.5) * 100));
}

export function getPlayerStatusMeta(player) {
  if (!player) {
    return { key: "unknown", label: "Chưa rõ", color: "#64748b" };
  }

  if (player.status === "archived" || player.active === false) {
    return { key: "locked", label: "Bị khóa", color: "#64748b" };
  }

  if (player.status === "inactive") {
    return { key: "rest", label: "Nghỉ", color: "#94a3b8" };
  }

  return { key: "active", label: "Đang hoạt động", color: "#0f766e" };
}

function isToday(isoDate) {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === todayIsoDate();
}

export function getTodayCheckedInPlayerIds(clubId) {
  const data = loadClubData(clubId);
  const ids = new Set();

  (data.tournaments || []).forEach((tournament) => {
    if (tournament?.mode !== TOURNAMENT_MODE.DAILY_PLAY) return;

    const daily = tournament.settings?.dailyPlay;
    if (!daily) return;

    const sessionDate = daily.sessionDate || tournament.createdAt;
    if (!isToday(sessionDate) && daily.checkedInPlayerIds?.length > 0) {
      const updated = tournament.updatedAt || tournament.createdAt;
      if (!isToday(updated)) return;
    }

    (daily.checkedInPlayerIds || []).forEach((id) => ids.add(String(id)));
  });

  (data.bookings || []).forEach((booking) => {
    if (booking.date !== todayIsoDate()) return;
    if (!["checked_in", "playing"].includes(booking.bookingStatus)) return;
    (booking.playerIds || []).forEach((id) => ids.add(String(id)));
  });

  return ids;
}

export function computePlayerDashboardStats(players = [], clubId) {
  const total = players.length;
  const male = players.filter((p) => p.gender === "Nam").length;
  const female = players.filter((p) => p.gender === "Nữ").length;
  const averageLevel =
    total === 0 ? 0 : players.reduce((sum, p) => sum + (Number(p.level) || 0), 0) / total;

  const checkedInIds = clubId ? getTodayCheckedInPlayerIds(clubId) : new Set();
  const checkedInToday = players.filter((p) => checkedInIds.has(String(p.id))).length;

  let playingNow = 0;
  let waitingNow = 0;

  if (clubId) {
    const data = loadClubData(clubId);
    (data.tournaments || []).forEach((tournament) => {
      if (tournament?.mode !== TOURNAMENT_MODE.DAILY_PLAY) return;
      const matches = tournament.settings?.dailyPlay?.matches || [];
      matches.forEach((match) => {
        if (match.status === "playing" || match.status === "in_progress") {
          const ids = [...(match.teamAPlayerIds || []), ...(match.teamBPlayerIds || [])];
          playingNow += ids.length;
        }
      });
      const pool = tournament.settings?.dailyPlay?.waitingPlayerIds || [];
      waitingNow += pool.length;
    });
  }

  return {
    total,
    male,
    female,
    averageLevel,
    checkedInToday,
    checkedInHasData: checkedInIds.size > 0,
    playingNow,
    waitingNow,
    hasLiveData: playingNow > 0 || waitingNow > 0,
  };
}

export function getPlayerQuickStats(player, clubId, playersById = new Map()) {
  if (!player?.id || !clubId) {
    return null;
  }

  const profile = loadPlayerHistoryProfileForClub(clubId, player.id, { recentLimit: 5 });
  if (!profile.ok) return null;

  const { stats, topPartners, recentMatches } = profile;
  const topPartner = topPartners?.[0];
  const partnerName = topPartner
    ? playersById.get(String(topPartner.playerId)) || topPartner.name
    : null;

  const recentForm = recentMatches?.slice(0, 3).map((m) => {
    if (m.outcome?.won) return "W";
    if (m.outcome?.lost) return "L";
    return "D";
  });

  return {
    matches: stats.matchesPlayed || 0,
    winRate: stats.winRate ?? null,
    recentForm: recentForm?.length ? recentForm.join("") : null,
    topPartner: partnerName,
    hasData: (stats.matchesPlayed || 0) > 0,
  };
}

export function generatePlayerInsight(player, options = {}) {
  const { clubId, players = [], checkedInIds = new Set() } = options;
  const level = Number(player?.level) || 3.5;
  const low = Math.max(1.5, Math.round((level - 0.5) * 10) / 10);
  const high = Math.min(6, Math.round((level + 0.5) * 10) / 10);

  if (clubId) {
    const quick = getPlayerQuickStats(
      player,
      clubId,
      new Map(players.map((p) => [String(p.id), p.name]))
    );

    if (quick?.topPartner && quick.matches >= 3) {
      const partnerCount = quick.matches > 0 ? Math.min(quick.matches, 8) : 0;
      if (partnerCount >= 5) {
        return `AI: Cần tránh ghép lại partner cũ quá nhiều (${quick.topPartner})`;
      }
    }

    if (quick?.recentForm) {
      const losses = (quick.recentForm.match(/L/g) || []).length;
      if (losses >= 2) {
        return "AI: Nên ghép với người chơi kiểm soát tốt để ổn định phong độ";
      }
      const wins = (quick.recentForm.match(/W/g) || []).length;
      if (wins >= 2) {
        return `AI: Phù hợp nhóm level ${low}–${high}, đang có phong độ tốt`;
      }
    }

    if (!checkedInIds.has(String(player.id)) && quick?.matches > 0) {
      const data = loadClubData(clubId);
      const records = profileSessionsAbsent(player, data);
      if (records >= 3) {
        return `AI: ${records} buổi chưa tham gia gần đây`;
      }
    }
  }

  if (level >= 4) {
    return `AI: Phù hợp nhóm level ${low}–${high}, ưu tiên ghép cân bằng đối thủ`;
  }

  if (level <= 2.5) {
    return "AI: Nên ghép với người chơi kiểm soát tốt để phát triển kỹ năng";
  }

  return `AI: Phù hợp nhóm level ${low}–${high}`;
}

function profileSessionsAbsent(player, data) {
  let absent = 0;
  const id = String(player.id);

  (data.tournaments || []).slice(0, 5).forEach((tournament) => {
    if (tournament?.mode !== TOURNAMENT_MODE.DAILY_PLAY) return;
    const checked = new Set(
      (tournament.settings?.dailyPlay?.checkedInPlayerIds || []).map(String)
    );
    if (checked.size > 0 && !checked.has(id)) {
      absent += 1;
    }
  });

  return absent;
}

export function filterPlayers(players, filters = {}) {
  const {
    search = "",
    genderFilter = "all",
    levelRange = [1.5, 6],
    statusFilter = "all",
    checkedInIds = new Set(),
  } = filters;

  const keyword = search.trim().toLowerCase();

  return players.filter((player) => {
    const matchesSearch =
      !keyword ||
      [player.name, player.gender, player.phone, player.nickname]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));

    const matchesGender = genderFilter === "all" || player.gender === genderFilter;

    const level = Number(player.level) || 0;
    const matchesLevel = level >= levelRange[0] && level <= levelRange[1];

    let matchesStatus = true;
    const statusMeta = getPlayerStatusMeta(player);
    const isCheckedIn = checkedInIds.has(String(player.id));

    if (statusFilter === "active") {
      matchesStatus = statusMeta.key === "active" && !isCheckedIn;
    } else if (statusFilter === "checked_in") {
      matchesStatus = isCheckedIn;
    } else if (statusFilter === "rest") {
      matchesStatus = statusMeta.key === "rest";
    } else if (statusFilter === "locked") {
      matchesStatus = statusMeta.key === "locked";
    }

    return matchesSearch && matchesGender && matchesLevel && matchesStatus;
  });
}

export function sortPlayers(players, sortBy = "name", sortDirection = "asc") {
  return [...players].sort((a, b) => {
    if (sortBy === "level") {
      return sortDirection === "asc" ? a.level - b.level : b.level - a.level;
    }

    const nameA = a.name?.toLowerCase() || "";
    const nameB = b.name?.toLowerCase() || "";

    if (nameA < nameB) return sortDirection === "asc" ? -1 : 1;
    if (nameA > nameB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}
