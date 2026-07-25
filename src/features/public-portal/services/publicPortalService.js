/**
 * Public portal data — live-first for most surfaces; mock-fallback remains for
 * clubs/tournaments/courts/rankings. News (NEWS-04) is provenance-honest and
 * never silently falls back to MOCK_NEWS on live failure.
 *
 * EC-03: Clubs/Courts honest PublicDataResult adapters live in
 * `publicClubsCourtsDataSource.js` and are re-exported here for compatibility.
 */
import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import {
  MOCK_LIVE_SCORES,
  MOCK_RANKINGS,
  MOCK_SPONSORS,
  MOCK_TOURNAMENTS,
  PUBLIC_STATS,
} from "../../../data/public/mockPublicData.js";
import { queryPublicLeaderboard } from "../../vpr-ranking/services/vprLeaderboardService.js";
import { isVprRankingEnabled } from "../../vpr-ranking/config/vprFlags.js";
import { VPR_CATEGORY_OPTIONS } from "../../vpr-ranking/constants/vprCategories.js";
import { vprCategoryToGenderFilter } from "../../vpr-ranking/constants/vprCategories.js";

export {
  getPublicNews,
  PUBLIC_NEWS_SOURCE,
  PUBLIC_NEWS_STATUS,
  PUBLIC_NEWS_ERROR_CODE,
  resolvePublicNewsSource,
  mapPublicCandidateToPortalItem,
  mapPublicNewsFailure,
  getPublicNewsItemsOrEmpty,
} from "./publicNewsService.js";

export {
  getPublicClubsResult,
  getPublicClubs,
  getFeaturedClubs,
  getPublicCourtsResult,
  getPublicCourts,
  getFeaturedCourts,
} from "./publicClubsCourtsDataSource.js";

const STATUS_MAP = {
  draft: "upcoming",
  registration: "upcoming",
  active: "live",
  running: "live",
  completed: "finished",
  archived: "finished",
};

const STATUS_LABELS = {
  upcoming: "Sắp diễn ra",
  live: "Đang diễn ra",
  finished: "Đã kết thúc",
};

function safeLoadClubData(clubId) {
  try {
    return loadClubData(clubId);
  } catch {
    return null;
  }
}

function mapTournamentStatus(status) {
  const key = STATUS_MAP[String(status || "").toLowerCase()] || "upcoming";
  return { status: key, statusLabel: STATUS_LABELS[key] };
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("vi-VN");
}

function mapLiveTournaments() {
  const clubs = loadClubs().filter((c) => !c.isDefault);
  const items = [];

  for (const club of clubs) {
    const data = safeLoadClubData(club.id);
    const tournaments = data?.tournaments || [];
    for (const t of tournaments) {
      const { status, statusLabel } = mapTournamentStatus(t.status);
      items.push({
        id: t.id || `${club.id}-${t.name}`,
        name: t.name || "Giải đấu",
        type: t.competitionType || t.type || "community",
        typeLabel: (t.competitionType || t.type || "Phong trào").toUpperCase(),
        status,
        statusLabel,
        location: club.city || club.location || club.name,
        date: formatDate(t.startDate || t.date),
        participants: t.playerCount || t.participants?.length || t.teams?.length || 0,
        participantLabel: t.format === "team" ? "đội" : "VĐV",
        image: t.image || null,
      });
    }
  }

  return items;
}

function computeLiveStats() {
  const clubs = loadClubs().filter((c) => !c.isDefault);
  let courtCount = 0;
  let playerCount = 0;
  let tournamentCount = 0;
  let matchCount = 0;

  for (const club of clubs) {
    const data = safeLoadClubData(club.id);
    if (!data) continue;
    courtCount += (data.courts || []).filter((c) => c.active !== false).length;
    playerCount += (data.players || []).length;
    tournamentCount += (data.tournaments || []).length;
    matchCount += (data.sessions || []).length * 4;
  }

  if (!clubs.length) return null;

  return [
    { label: "CLB", value: `${clubs.length}+`, icon: "groups" },
    { label: "Sân pickleball", value: `${courtCount || 1}+`, icon: "court" },
    { label: "Vận động viên", value: `${playerCount || 1}+`, icon: "players" },
    { label: "Giải đấu", value: `${tournamentCount || 1}+`, icon: "trophy" },
    { label: "Trận đấu", value: `${matchCount || 1}+`, icon: "match" },
  ];
}

function withFallback(live, mock, minLength = 1) {
  if (Array.isArray(live) && live.length >= minLength) return live;
  return mock;
}

export function getPublicStats() {
  return computeLiveStats() || PUBLIC_STATS;
}

export function getPublicTournaments() {
  return withFallback(mapLiveTournaments(), MOCK_TOURNAMENTS, 3);
}

export function getFeaturedTournaments(limit = 4) {
  const all = getPublicTournaments();
  const priority = ["live", "upcoming", "finished"];
  const sorted = [...all].sort(
    (a, b) => priority.indexOf(a.status) - priority.indexOf(b.status)
  );
  return sorted.slice(0, limit);
}

export function getPublicLiveScores() {
  return MOCK_LIVE_SCORES;
}

export function getPublicSponsors() {
  return MOCK_SPONSORS;
}

export function getPublicRankings(filters = {}) {
  const category = filters.category || "men_single";
  const gender =
    filters.gender ||
    (filters.genderFilter === "all" ? null : vprCategoryToGenderFilter(category));

  if (isVprRankingEnabled()) {
    try {
      const live = queryPublicLeaderboard({
        category,
        region: filters.region,
        gender,
        year: filters.year,
        search: filters.search,
      });
      if (live.length > 0) {
        return live.map((row) => ({
          rank: row.rank,
          name: row.displayName,
          displayName: row.displayName,
          clubName: row.clubName,
          region: row.region,
          points: row.totalPoints,
          totalPoints: row.totalPoints,
          tournamentsCount: row.tournamentsCount,
          bestPlacement: row.bestPlacement,
          vprAthleteId: row.vprAthleteId,
          change: 0,
        }));
      }
    } catch {
      // Fall back to mock data when local VPR store is corrupted.
    }
  }

  const mockFiltered = MOCK_RANKINGS.filter((row) => {
    if (filters.region && filters.region !== "Tất cả" && row.region !== filters.region) {
      return false;
    }
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      if (!row.name.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return mockFiltered;
}

getPublicRankings.categories = VPR_CATEGORY_OPTIONS;
