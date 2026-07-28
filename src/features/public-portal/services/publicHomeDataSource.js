/**
 * Public Portal Home data-source orchestration (EC-05).
 *
 * Public-only — reuses EC-03 PublicDataResult contract and EC-03/04 list adapters.
 * Does not import Competition Engine, router, providers, or business calculators.
 * Does not mutate canonical adapter results.
 */
import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import {
  MOCK_LIVE_SCORES,
  MOCK_RESULTS,
  MOCK_SCHEDULE,
  MOCK_SPONSORS,
  MOCK_UPCOMING_EVENTS,
  PUBLIC_STATS,
} from "../../../data/public/mockPublicData.js";
import { PUBLIC_PORTAL_SURFACE_ID } from "../../experience-channels/public-portal/constants/surfaceIds.js";
import { PUBLIC_PORTAL_DATA_SOURCE } from "../../experience-channels/public-portal/constants/dataSources.js";
import {
  PUBLIC_DATA_RESULT_STATUS,
  createEmptyResult,
  createErrorResult,
  createLiveResult,
  createMockResult,
  createPreviewResult,
  createUnavailableResult,
} from "../../experience-channels/public-portal/data-source/index.js";
import { getPublicClubsResult, getPublicCourtsResult } from "./publicClubsCourtsDataSource.js";
import { getPublicTournamentsResult } from "./publicTournamentsRankingsDataSource.js";
import { PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE } from "../runtime/constants.js";
import { resolvePublicPortalRuntime } from "../runtime/resolvePublicPortalRuntime.js";

function readEnvBag(options = {}) {
  if (options.env && typeof options.env === "object") return options.env;
  const vite =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const node =
    typeof globalThis.process !== "undefined" ? globalThis.process.env || {} : {};
  return { ...node, ...vite };
}

function isHardCutoverHome(options = {}) {
  return resolvePublicPortalRuntime({
    env: readEnvBag(options),
    hardCutover: options.hardCutover,
  }).isHardCutover;
}

/** NEWS-04 status/source literals — avoid importing publicNewsService (Supabase chain). */
const NEWS_STATUS = Object.freeze({
  OK: "ok",
  EMPTY: "empty",
  ERROR: "error",
});

const NEWS_SOURCE = Object.freeze({
  LIVE: "live",
  MOCK: "mock",
  PREVIEW: "preview",
});

export const PUBLIC_HOME_SECTION_ID = Object.freeze({
  STATS: "home-stats",
  FEATURED_TOURNAMENTS: "home-featured-tournaments",
  LIVE_SCORES: "home-live-scores",
  SCHEDULE: "home-schedule",
  RESULTS: "home-results",
  FEATURED_CLUBS: "home-featured-clubs",
  FEATURED_COURTS: "home-featured-courts",
  UPCOMING_EVENTS: "home-upcoming-events",
  NEWS: "home-news",
  SPONSORS: "home-sponsors",
});

const OWNER = PUBLIC_PORTAL_SURFACE_ID.PUBLIC_HOME;

const FEATURED_TOURNAMENT_PRIORITY = Object.freeze(["live", "upcoming", "finished"]);

function safeLoadClubData(clubId) {
  try {
    return loadClubData(clubId);
  } catch {
    return null;
  }
}

/**
 * @param {Readonly<object>} result
 * @param {{ sectionId: string, data?: unknown }} projection
 */
function projectSection(result, { sectionId, data }) {
  return Object.freeze({
    source: result.source,
    status: result.status,
    data: data === undefined ? result.data : data,
    error: result.error,
    fallbackUsed: result.fallbackUsed,
    fallbackReason: result.fallbackReason,
    isStale: result.isStale,
    productionReady: result.productionReady,
    ownerSurface: result.ownerSurface,
    sectionId,
  });
}

function computeLiveStatsRows() {
  const clubs = loadClubs().filter((c) => !c.isDefault);
  if (!clubs.length) return null;

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

  return [
    { label: "CLB", value: `${clubs.length}+`, icon: "groups" },
    { label: "Sân pickleball", value: `${courtCount}+`, icon: "court" },
    { label: "Vận động viên", value: `${playerCount}+`, icon: "players" },
    { label: "Giải đấu", value: `${tournamentCount}+`, icon: "trophy" },
    { label: "Trận đấu", value: `${matchCount}+`, icon: "match" },
  ];
}

/**
 * Honest Home stats — mock counters are never labeled LIVE.
 * Does not fabricate minimum counts when live zeros are real.
 * HC ON: no localStorage stats authority and no PUBLIC_STATS mock-on-empty.
 */
export function getPublicHomeStatsResult(options = {}) {
  if (isHardCutoverHome(options)) {
    return projectSection(
      createUnavailableResult({
        ownerSurface: OWNER,
        source: PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN,
        data: [],
        message: PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
      }),
      { sectionId: PUBLIC_HOME_SECTION_ID.STATS }
    );
  }

  try {
    const live = computeLiveStatsRows();
    if (live) {
      return projectSection(
        createLiveResult({ data: live, ownerSurface: OWNER }),
        { sectionId: PUBLIC_HOME_SECTION_ID.STATS }
      );
    }
    return projectSection(
      createMockResult({ data: PUBLIC_STATS, ownerSurface: OWNER }),
      { sectionId: PUBLIC_HOME_SECTION_ID.STATS }
    );
  } catch (error) {
    return projectSection(
      createErrorResult({
        ownerSurface: OWNER,
        error,
        source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
      }),
      { sectionId: PUBLIC_HOME_SECTION_ID.STATS, data: null }
    );
  }
}

/**
 * Featured tournaments — reuses EC-04 getPublicTournamentsResult; presentation sort only.
 * HC ON: do not surface local/mock tournament cards as public home authority.
 */
export function getPublicHomeFeaturedTournamentsResult(limit = 4, options = {}) {
  if (isHardCutoverHome(options)) {
    return projectSection(
      createUnavailableResult({
        ownerSurface: OWNER,
        source: PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN,
        data: [],
        message: PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
      }),
      { sectionId: PUBLIC_HOME_SECTION_ID.FEATURED_TOURNAMENTS }
    );
  }

  const result = getPublicTournamentsResult();
  const all = Array.isArray(result.data) ? result.data : [];
  const sorted = [...all].sort(
    (a, b) =>
      FEATURED_TOURNAMENT_PRIORITY.indexOf(a.status) -
      FEATURED_TOURNAMENT_PRIORITY.indexOf(b.status)
  );
  return projectSection(result, {
    sectionId: PUBLIC_HOME_SECTION_ID.FEATURED_TOURNAMENTS,
    data: sorted.slice(0, limit),
  });
}

/**
 * Featured clubs — reuses EC-03 getPublicClubsResult (HC-aware).
 */
export function getPublicHomeFeaturedClubsResult(limit = 5, options = {}) {
  const result = getPublicClubsResult(options);
  const all = Array.isArray(result.data) ? result.data : [];
  return projectSection(result, {
    sectionId: PUBLIC_HOME_SECTION_ID.FEATURED_CLUBS,
    data: all.slice(0, limit),
  });
}

/**
 * Featured courts — reuses EC-03 getPublicCourtsResult (HC-aware).
 */
export function getPublicHomeFeaturedCourtsResult(limit = 4, options = {}) {
  const result = getPublicCourtsResult(options);
  const all = Array.isArray(result.data) ? result.data : [];
  return projectSection(result, {
    sectionId: PUBLIC_HOME_SECTION_ID.FEATURED_COURTS,
    data: all.slice(0, limit),
  });
}

function mockOrUnavailableHomeSection(sectionId, mockData, options = {}) {
  if (isHardCutoverHome(options)) {
    return projectSection(
      createUnavailableResult({
        ownerSurface: OWNER,
        source: PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN,
        data: [],
        message: PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
      }),
      { sectionId }
    );
  }
  return projectSection(
    createMockResult({ data: mockData, ownerSurface: OWNER }),
    { sectionId }
  );
}

export function getPublicHomeLiveScoresResult(options = {}) {
  return mockOrUnavailableHomeSection(
    PUBLIC_HOME_SECTION_ID.LIVE_SCORES,
    MOCK_LIVE_SCORES,
    options
  );
}

export function getPublicHomeScheduleResult(options = {}) {
  return mockOrUnavailableHomeSection(
    PUBLIC_HOME_SECTION_ID.SCHEDULE,
    MOCK_SCHEDULE,
    options
  );
}

export function getPublicHomeResultsResult(options = {}) {
  return mockOrUnavailableHomeSection(
    PUBLIC_HOME_SECTION_ID.RESULTS,
    MOCK_RESULTS,
    options
  );
}

export function getPublicHomeUpcomingEventsResult(options = {}) {
  return mockOrUnavailableHomeSection(
    PUBLIC_HOME_SECTION_ID.UPCOMING_EVENTS,
    MOCK_UPCOMING_EVENTS,
    options
  );
}

export function getPublicHomeSponsorsResult(options = {}) {
  return mockOrUnavailableHomeSection(
    PUBLIC_HOME_SECTION_ID.SPONSORS,
    MOCK_SPONSORS,
    options
  );
}

/**
 * Map NEWS-04 typed result → EC-03 PublicDataResult projection for Home.
 * Does not rebuild a second news contract; does not hide errors as empty.
 *
 * @param {object|null|undefined} newsResult
 */
export function projectHomeNewsSection(newsResult) {
  if (newsResult == null) {
    return projectSection(
      createUnavailableResult({
        ownerSurface: OWNER,
        source: PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN,
        data: [],
      }),
      { sectionId: PUBLIC_HOME_SECTION_ID.NEWS }
    );
  }

  const items = Array.isArray(newsResult.items) ? newsResult.items : [];
  const rawSource = String(newsResult.source || "").toLowerCase();

  if (newsResult.status === NEWS_STATUS.ERROR) {
    return projectSection(
      createErrorResult({
        ownerSurface: OWNER,
        source:
          rawSource === NEWS_SOURCE.MOCK
            ? PUBLIC_PORTAL_DATA_SOURCE.MOCK
            : rawSource === NEWS_SOURCE.PREVIEW
              ? PUBLIC_PORTAL_DATA_SOURCE.PREVIEW
              : PUBLIC_PORTAL_DATA_SOURCE.LIVE,
        error: {
          code:
            newsResult.error?.code ||
            newsResult.diagnostics?.errorCode ||
            "PUBLIC_NEWS_ERROR",
          message:
            newsResult.error?.userMessage ||
            newsResult.error?.message ||
            "Không tải được tin tức công khai.",
        },
        data: [],
      }),
      { sectionId: PUBLIC_HOME_SECTION_ID.NEWS }
    );
  }

  if (newsResult.status === NEWS_STATUS.EMPTY || items.length === 0) {
    const source =
      rawSource === NEWS_SOURCE.MOCK
        ? PUBLIC_PORTAL_DATA_SOURCE.MOCK
        : rawSource === NEWS_SOURCE.PREVIEW
          ? PUBLIC_PORTAL_DATA_SOURCE.PREVIEW
          : PUBLIC_PORTAL_DATA_SOURCE.LIVE;
    return projectSection(
      createEmptyResult({ source, data: [], ownerSurface: OWNER }),
      { sectionId: PUBLIC_HOME_SECTION_ID.NEWS }
    );
  }

  if (rawSource === NEWS_SOURCE.MOCK) {
    return projectSection(
      createMockResult({ data: items, ownerSurface: OWNER }),
      { sectionId: PUBLIC_HOME_SECTION_ID.NEWS }
    );
  }
  if (rawSource === NEWS_SOURCE.PREVIEW) {
    return projectSection(
      createPreviewResult({ data: items, ownerSurface: OWNER }),
      { sectionId: PUBLIC_HOME_SECTION_ID.NEWS }
    );
  }
  if (rawSource === NEWS_SOURCE.LIVE) {
    return projectSection(
      createLiveResult({ data: items, ownerSurface: OWNER }),
      { sectionId: PUBLIC_HOME_SECTION_ID.NEWS }
    );
  }

  return projectSection(
    createUnavailableResult({
      ownerSurface: OWNER,
      source: PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN,
      data: items,
      message: "Nguồn tin tức công khai chưa xác định.",
    }),
    { sectionId: PUBLIC_HOME_SECTION_ID.NEWS }
  );
}

/**
 * Aggregate Home section results. One section failure does not rewrite others.
 * Caller-controlled retry: re-invoke this function (no internal retry loop).
 * Pass `{ hardCutover: true }` or HC env to fail closed without mock-on-empty.
 */
export function getPublicHomeSyncSections(options = {}) {
  return Object.freeze({
    stats: getPublicHomeStatsResult(options),
    tournaments: getPublicHomeFeaturedTournamentsResult(4, options),
    liveScores: getPublicHomeLiveScoresResult(options),
    schedule: getPublicHomeScheduleResult(options),
    results: getPublicHomeResultsResult(options),
    clubs: getPublicHomeFeaturedClubsResult(5, options),
    courts: getPublicHomeFeaturedCourtsResult(4, options),
    upcomingEvents: getPublicHomeUpcomingEventsResult(options),
    sponsors: getPublicHomeSponsorsResult(options),
  });
}

export { PUBLIC_DATA_RESULT_STATUS, PUBLIC_PORTAL_DATA_SOURCE };
