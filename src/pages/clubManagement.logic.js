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

export function buildClubManagementView({
  clubs = [],
  activeClubId,
  summary,
  seasons = [],
  leagues = [],
}) {
  const activeClub = clubs.find((club) => club.id === activeClubId) || null;

  return {
    activeClub,
    canDeleteActiveClub: activeClub?.id !== DEFAULT_CLUB.id,
    totals: summary?.totals || {
      players: 0,
      courts: 0,
      activeCourts: 0,
      seasons: 0,
      leagues: 0,
      sessions: 0,
      rounds: 0,
    },
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
