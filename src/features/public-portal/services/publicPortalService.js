/**
 * Public portal data — live-first for most surfaces; mock-fallback remains for
 * clubs/tournaments/courts/rankings. News (NEWS-04) is provenance-honest and
 * never silently falls back to MOCK_NEWS on live failure.
 *
 * EC-03: Clubs/Courts honest PublicDataResult adapters live in
 * `publicClubsCourtsDataSource.js` and are re-exported here for compatibility.
 *
 * EC-04: Tournaments/Rankings honest PublicDataResult adapters live in
 * `publicTournamentsRankingsDataSource.js` and are re-exported here.
 *
 * EC-05: Home orchestration adapters live in `publicHomeDataSource.js` and are
 * re-exported here for compatibility. Prefer Result helpers over array getters.
 *
 * EC-06: Certified remote LIVE cutover count is 0 — uncertified sources keep
 * mock fallback / MOCK provenance; News remains ALREADY_LIVE (NEWS-04).
 */
import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import {
  MOCK_LIVE_SCORES,
  MOCK_SPONSORS,
  PUBLIC_STATS,
} from "../../../data/public/mockPublicData.js";

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

export {
  getPublicTournamentsResult,
  getPublicTournaments,
  getFeaturedTournaments,
  getPublicRankingsResult,
  getPublicRankings,
} from "./publicTournamentsRankingsDataSource.js";

export {
  PUBLIC_HOME_SECTION_ID,
  getPublicHomeSyncSections,
  getPublicHomeStatsResult,
  getPublicHomeFeaturedTournamentsResult,
  getPublicHomeFeaturedClubsResult,
  getPublicHomeFeaturedCourtsResult,
  getPublicHomeLiveScoresResult,
  getPublicHomeScheduleResult,
  getPublicHomeResultsResult,
  getPublicHomeUpcomingEventsResult,
  getPublicHomeSponsorsResult,
  projectHomeNewsSection,
} from "./publicHomeDataSource.js";

function safeLoadClubData(clubId) {
  try {
    return loadClubData(clubId);
  } catch {
    return null;
  }
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

export function getPublicStats() {
  return computeLiveStats() || PUBLIC_STATS;
}

export function getPublicLiveScores() {
  return MOCK_LIVE_SCORES;
}

export function getPublicSponsors() {
  return MOCK_SPONSORS;
}
