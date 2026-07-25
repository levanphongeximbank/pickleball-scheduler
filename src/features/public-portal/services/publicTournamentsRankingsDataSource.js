/**
 * Public Tournaments/Rankings data-source adapters (EC-04).
 * Public-portal only — no Competition Engine and no business ranking engines.
 */
import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import { MOCK_RANKINGS, MOCK_TOURNAMENTS } from "../../../data/public/mockPublicData.js";
import { PUBLIC_PORTAL_SURFACE_ID } from "../../experience-channels/public-portal/constants/surfaceIds.js";
import {
  createMockResult,
  resolvePublicListDataResult,
} from "../../experience-channels/public-portal/data-source/index.js";
import { isVprRankingEnabled } from "../../vpr-ranking/config/vprFlags.js";
import { VPR_CATEGORY_OPTIONS } from "../../vpr-ranking/constants/vprCategories.js";
import { vprCategoryToGenderFilter } from "../../vpr-ranking/constants/vprCategories.js";
import { queryPublicLeaderboard } from "../../vpr-ranking/services/vprLeaderboardService.js";

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

function mapLiveRankings(filters = {}) {
  const category = filters.category || "men_single";
  const gender =
    filters.gender ||
    (filters.genderFilter === "all" ? null : vprCategoryToGenderFilter(category));

  const live = queryPublicLeaderboard({
    category,
    region: filters.region,
    gender,
    year: filters.year,
    search: filters.search,
  });

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

function filterMockRankings(filters = {}) {
  return MOCK_RANKINGS.filter((row) => {
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
}

/**
 * Honest Tournaments list result (EC-04). Keeps mock fallback but never presents it as LIVE.
 */
export function getPublicTournamentsResult() {
  return resolvePublicListDataResult({
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS,
    loadLive: mapLiveTournaments,
    mockData: MOCK_TOURNAMENTS,
    minLength: 3,
    allowMockFallback: true,
  });
}

export function getPublicTournaments() {
  const result = getPublicTournamentsResult();
  return Array.isArray(result.data) ? result.data : [];
}

export function getFeaturedTournaments(limit = 4) {
  const all = getPublicTournaments();
  const priority = ["live", "upcoming", "finished"];
  const sorted = [...all].sort(
    (a, b) => priority.indexOf(a.status) - priority.indexOf(b.status)
  );
  return sorted.slice(0, limit);
}

/**
 * Honest Rankings list result (EC-04).
 * Preserves canonical leaderboard order/rows; does not recalculate rank/rating/points.
 * When VPR flag is off, source is explicit MOCK (not silent LIVE).
 */
export function getPublicRankingsResult(filters = {}) {
  if (!isVprRankingEnabled()) {
    return createMockResult({
      data: filterMockRankings(filters),
      ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS,
    });
  }

  return resolvePublicListDataResult({
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS,
    loadLive: () => mapLiveRankings(filters),
    mockData: filterMockRankings(filters),
    minLength: 1,
    allowMockFallback: true,
  });
}

export function getPublicRankings(filters = {}) {
  const result = getPublicRankingsResult(filters);
  return Array.isArray(result.data) ? result.data : [];
}

getPublicRankings.categories = VPR_CATEGORY_OPTIONS;
