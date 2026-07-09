import { DEFAULT_CLUB } from "../data/club.js";
import { getCompetitionTypeOptions } from "../ai/competition.js";

export const LEAGUE_FORMAT_OPTIONS = [
  { id: "social", label: "Giao lưu" },
  { id: "round_robin", label: "Vòng tròn" },
  { id: "knockout", label: "Loại trực tiếp" },
  { id: "hybrid", label: "Hỗn hợp" },
];

export const SEASON_STATUS_OPTIONS = [
  { id: "draft", label: "Nháp" },
  { id: "active", label: "Đang diễn ra" },
  { id: "archived", label: "Lưu trữ" },
];

export function buildClubManagementOverviewCards({ activeClub = null, totals = {} }) {
  const activeClubName = activeClub?.name || "CLB của bạn";

  return [
    {
      key: "players",
      label: "Người chơi",
      value: totals.players ?? 0,
      caption: `${activeClubName} đang quản lý`,
      icon: "Groups",
      accent: "#2563eb",
    },
    {
      key: "courts",
      label: "Sân hoạt động",
      value: `${totals.activeCourts ?? 0}/${totals.courts ?? 0}`,
      caption: "Sân sẵn sàng cho buổi tập",
      icon: "SportsTennis",
      accent: "#16a34a",
    },
    {
      key: "seasons",
      label: "Mùa / Giải",
      value: `${totals.seasons ?? 0} / ${totals.leagues ?? 0}`,
      caption: "Mùa giải và league đang chạy",
      icon: "CalendarMonth",
      accent: "#ea580c",
    },
    {
      key: "sessions",
      label: "Phiên xếp sân",
      value: totals.sessions ?? 0,
      caption: "Số phiên đã tạo gần đây",
      icon: "EventNote",
      accent: "#7c3aed",
    },
  ];
}

export function buildClubManagementView({
  clubs = [],
  activeClubId,
  summary,
  seasons = [],
  leagues = [],
}) {
  const activeClub = clubs.find((club) => club.id === activeClubId) || null;
  const totals = summary?.totals || {
    players: 0,
    courts: 0,
    activeCourts: 0,
    seasons: 0,
    leagues: 0,
    sessions: 0,
    rounds: 0,
  };

  return {
    activeClub,
    canDeleteActiveClub: activeClub?.id !== DEFAULT_CLUB.id,
    totals,
    overviewCards: buildClubManagementOverviewCards({ activeClub, totals }),
    seasons,
    leagues,
    competitionOptions: getCompetitionTypeOptions(),
    formatOptions: LEAGUE_FORMAT_OPTIONS,
    seasonStatusOptions: SEASON_STATUS_OPTIONS,
  };
}

export function filterLeaguesBySeason(leagues = [], seasonId) {
  if (!seasonId) {
    return leagues;
  }

  return leagues.filter((league) => league.seasonId === seasonId);
}
