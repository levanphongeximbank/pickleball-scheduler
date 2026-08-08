/**
 * Public Tournaments/Rankings data-source adapters (EC-04 + PUBLIC-CATALOG-02).
 * Public-portal only — no Competition Engine and no business ranking writers.
 *
 * Default: local / mock-honest path (EC-04).
 * Opt-in remote: VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE=remote → PUBLIC-CATALOG-02 RPC
 * with LIVE provenance and no mock fallback.
 */
import { loadClubs } from "../../../data/club.js";
import { loadClubData } from "../../../domain/clubStorage.js";
import { MOCK_RANKINGS, MOCK_TOURNAMENTS } from "../../../data/public/mockPublicData.js";
import { PUBLIC_PORTAL_SURFACE_ID } from "../../experience-channels/public-portal/constants/surfaceIds.js";
import { PUBLIC_PORTAL_DATA_SOURCE } from "../../experience-channels/public-portal/constants/dataSources.js";
import {
  createErrorResult,
  createLiveResult,
  createMockResult,
  resolvePublicListDataResult,
} from "../../experience-channels/public-portal/data-source/index.js";
import {
  listPublicTournamentsRemote,
  listPublicRankingsRemote,
} from "../../public-catalog/remote/index.js";
import { isOk } from "../../../core/platform/contracts/result.js";
import { isVprRankingEnabled } from "../../vpr-ranking/config/vprFlags.js";
import { VPR_CATEGORY_OPTIONS } from "../../vpr-ranking/constants/vprCategories.js";
import { vprCategoryToGenderFilter } from "../../vpr-ranking/constants/vprCategories.js";
import { queryPublicLeaderboard } from "../../vpr-ranking/services/vprLeaderboardService.js";

export const PUBLIC_TOURNAMENTS_RANKINGS_SOURCE = Object.freeze({
  LOCAL: "local",
  REMOTE: "remote",
});

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

function readTournamentsRankingsSource(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.REMOTE) {
    return PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.REMOTE;
  }
  if (normalized === PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.LOCAL) {
    return PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.LOCAL;
  }
  return null;
}

/**
 * Explicit source selection.
 * Canonical cutover default: REMOTE published catalog (no browser/mock SSOT).
 * Opt-out with VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE=local for legacy diagnostics only.
 * @param {{ source?: string }} [options]
 * @returns {"local"|"remote"}
 */
export function resolvePublicTournamentsRankingsSource(options = {}) {
  const explicit = readTournamentsRankingsSource(options.source);
  if (explicit) return explicit;

  const env =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE
      : undefined;
  const nodeEnv =
    typeof globalThis.process !== "undefined"
      ? globalThis.process.env?.VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE
      : undefined;
  const fromEnv = readTournamentsRankingsSource(env || nodeEnv);
  if (fromEnv) return fromEnv;

  return PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.REMOTE;
}

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
 * Map PUBLIC-CATALOG-02 tournament DTO → portal TournamentCard model.
 * @param {Record<string, unknown>} dto
 */
export function mapCatalogTournamentDtoToPortalCard(dto) {
  const row = dto && typeof dto === "object" ? dto : {};
  const status = String(row.operationalStatus || "upcoming");
  return Object.freeze({
    id: String(row.id || ""),
    name: String(row.displayName || "").trim() || "Giải công khai",
    type: "public",
    typeLabel: String(row.formatSummary || row.sport || "PICKLEBALL").toUpperCase(),
    status,
    statusLabel: STATUS_LABELS[status] || STATUS_LABELS.upcoming,
    location: String(row.locationSummary || "").trim() || "Việt Nam",
    date: formatDate(row.startDate),
    participants: 0,
    participantLabel: "VĐV",
    image: row.imageUrl == null ? null : String(row.imageUrl),
  });
}

/**
 * Map PUBLIC-CATALOG-02 ranking DTO → portal Ranking row model.
 * Does not invent movement/change.
 * @param {Record<string, unknown>} dto
 */
export function mapCatalogRankingDtoToPortalCard(dto) {
  const row = dto && typeof dto === "object" ? dto : {};
  const displayName = String(row.displayName || "").trim() || "VĐV công khai";
  return Object.freeze({
    rank: Number(row.rank) || 0,
    name: displayName,
    displayName,
    clubName: row.clubName == null ? null : String(row.clubName),
    region: row.region == null ? null : String(row.region),
    points: Number(row.totalPoints) || 0,
    totalPoints: Number(row.totalPoints) || 0,
    tournamentsCount: Number(row.tournamentsCount) || 0,
    bestPlacement: row.bestPlacement == null ? null : String(row.bestPlacement),
    vprAthleteId: null,
    change: 0,
  });
}

/**
 * Local tournaments list — fail closed without mock authority.
 * Canonical production path uses remote catalog (loadPublicTournamentsPageResult).
 */
export function getPublicTournamentsResult() {
  return resolvePublicListDataResult({
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS,
    loadLive: mapLiveTournaments,
    mockData: MOCK_TOURNAMENTS,
    minLength: 3,
    allowMockFallback: false,
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

function remoteFailToErrorResult(error, ownerSurface) {
  const payload =
    error && typeof error === "object"
      ? error
      : {
          code: "PUBLIC_CATALOG_REMOTE_FAILED",
          message: "Public catalog remote read failed",
        };
  return createErrorResult({
    ownerSurface,
    source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
    error: {
      code: String(payload.code || "PUBLIC_CATALOG_REMOTE_FAILED"),
      message: String(payload.message || "Public catalog remote read failed"),
    },
    data: [],
  });
}

/**
 * Remote Tournaments loader — RPC only, no mock fallback.
 */
export async function loadPublicTournamentsFromRemote(options = {}) {
  const remote = await listPublicTournamentsRemote(options.query || {}, {
    client: options.client,
    repository: options.repository,
    facade: options.facade,
  });

  if (!isOk(remote)) {
    return remoteFailToErrorResult(
      remote.error,
      PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS
    );
  }

  const items = Array.isArray(remote.value?.items) ? remote.value.items : null;
  if (!items) {
    return remoteFailToErrorResult(
      {
        code: "PUBLIC_CATALOG_MALFORMED_RESPONSE",
        message: "Remote tournament list response is malformed",
      },
      PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS
    );
  }

  const data = items.map((row) => mapCatalogTournamentDtoToPortalCard(row));
  return createLiveResult({
    data,
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS,
    productionReady: false,
  });
}

/**
 * Remote Rankings loader — RPC only, no mock fallback.
 */
export async function loadPublicRankingsFromRemote(options = {}) {
  const remote = await listPublicRankingsRemote(options.query || {}, {
    client: options.client,
    repository: options.repository,
    facade: options.facade,
  });

  if (!isOk(remote)) {
    return remoteFailToErrorResult(
      remote.error,
      PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS
    );
  }

  const items = Array.isArray(remote.value?.items) ? remote.value.items : null;
  if (!items) {
    return remoteFailToErrorResult(
      {
        code: "PUBLIC_CATALOG_MALFORMED_RESPONSE",
        message: "Remote ranking list response is malformed",
      },
      PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS
    );
  }

  const data = items.map((row) => mapCatalogRankingDtoToPortalCard(row));
  return createLiveResult({
    data,
    ownerSurface: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS,
    productionReady: false,
  });
}

/**
 * Tournaments page loader. Remote when source=remote; else local EC-04 path.
 */
export async function loadPublicTournamentsPageResult(options = {}) {
  const source = resolvePublicTournamentsRankingsSource(options);
  if (source === PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.REMOTE) {
    return loadPublicTournamentsFromRemote(options);
  }
  return getPublicTournamentsResult();
}

/**
 * Rankings page loader. Remote when source=remote; else local EC-04 path.
 */
export async function loadPublicRankingsPageResult(options = {}) {
  const source = resolvePublicTournamentsRankingsSource(options);
  if (source === PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.REMOTE) {
    return loadPublicRankingsFromRemote(options);
  }
  return getPublicRankingsResult(options.query || options.filters || {});
}
