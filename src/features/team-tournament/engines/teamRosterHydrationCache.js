/**
 * P0.2 — Cached roster hydration lifecycle (survives tab unmount).
 */

import {
  ROSTER_HYDRATION_STATUS,
  ROSTER_LOADING_MESSAGE,
  hydrateTeamRoster,
} from "./teamRosterHydration.js";

export const ROSTER_LIFECYCLE_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING_INITIAL: "loading_initial",
  READY: "ready",
  REFRESHING_BACKGROUND: "refreshing_background",
  PARTIAL: "partial",
  ERROR: "error",
});

export const ROSTER_BACKGROUND_REFRESH_MESSAGE = "Đang cập nhật…";

const rosterCache = new Map();

function normalizeId(value) {
  return String(value || "").trim();
}

/**
 * Stable hash of stored roster member ids (+ captain/deputy).
 * @param {object} team
 */
export function computeRosterMemberIdsHash(team = {}) {
  const playerIds = (team?.playerIds || []).map((id) => normalizeId(id)).filter(Boolean);
  const captain = normalizeId(team?.captainPlayerId);
  const deputies = (team?.deputyPlayerIds || [])
    .map((id) => normalizeId(id))
    .filter(Boolean)
    .sort();
  return `${playerIds.join("|")}::c=${captain}::d=${deputies.join("|")}`;
}

/**
 * @param {string} tournamentId
 * @param {number|string} setupVersion
 * @param {string} teamId
 * @param {string} memberHash
 */
export function buildRosterCacheKey(tournamentId, setupVersion, teamId, memberHash) {
  return `${normalizeId(tournamentId)}::v${setupVersion}::${normalizeId(teamId)}::${memberHash}`;
}

/**
 * @param {string} key
 */
export function getCachedTeamRoster(key) {
  return rosterCache.get(key) || null;
}

/**
 * @param {string} key
 * @param {object} hydrated
 */
export function setCachedTeamRoster(key, hydrated) {
  if (!key || !hydrated) return;
  if (
    hydrated.status === ROSTER_HYDRATION_STATUS.READY ||
    hydrated.status === ROSTER_HYDRATION_STATUS.PARTIAL
  ) {
    rosterCache.set(key, {
      hydrated,
      cachedAt: Date.now(),
    });
  }
}

export function clearRosterCacheForTournament(tournamentId) {
  const prefix = `${normalizeId(tournamentId)}::`;
  for (const key of rosterCache.keys()) {
    if (key.startsWith(prefix)) rosterCache.delete(key);
  }
}

export function __resetTeamRosterHydrationCacheForTests() {
  rosterCache.clear();
}

/**
 * Resolve lifecycle-aware hydrated roster for one team.
 *
 * @param {{
 *   tournamentId: string,
 *   setupVersion: number|string,
 *   team: object,
 *   athletePool?: object[],
 *   setupReady?: boolean,
 *   poolLoadingInitial?: boolean,
 *   poolRefreshing?: boolean,
 *   athletePoolError?: object|null,
 * }} input
 */
export function resolveTeamRosterHydrationState({
  tournamentId,
  setupVersion = 0,
  team = {},
  athletePool = [],
  setupReady = true,
  poolLoadingInitial = false,
  poolRefreshing = false,
  athletePoolError = null,
} = {}) {
  const memberHash = computeRosterMemberIdsHash(team);
  const cacheKey = buildRosterCacheKey(tournamentId, setupVersion, team?.id, memberHash);
  const cached = getCachedTeamRoster(cacheKey);

  const hasCachedReady =
    cached?.hydrated &&
    (cached.hydrated.status === ROSTER_HYDRATION_STATUS.READY ||
      cached.hydrated.status === ROSTER_HYDRATION_STATUS.PARTIAL) &&
    cached.hydrated.members?.length > 0;

  // Initial load — no cache yet.
  if (!hasCachedReady && (!setupReady || poolLoadingInitial)) {
    const loading = hydrateTeamRoster({
      team,
      athletePool: [],
      setupReady: false,
      athletePoolLoading: true,
    });
    return {
      ...loading,
      lifecycleStatus: ROSTER_LIFECYCLE_STATUS.LOADING_INITIAL,
      backgroundRefreshing: false,
      cacheKey,
      memberHash,
      usedCache: false,
      loadingMessage: ROSTER_LOADING_MESSAGE,
    };
  }

  // Background refresh — keep cached roster visible.
  if (hasCachedReady && (poolRefreshing || poolLoadingInitial) && !athletePoolError) {
    return {
      ...cached.hydrated,
      lifecycleStatus: ROSTER_LIFECYCLE_STATUS.REFRESHING_BACKGROUND,
      backgroundRefreshing: true,
      cacheKey,
      memberHash,
      usedCache: true,
      loadingMessage: null,
      refreshMessage: ROSTER_BACKGROUND_REFRESH_MESSAGE,
    };
  }

  const hydrated = hydrateTeamRoster({
    team,
    athletePool,
    setupReady,
    athletePoolLoading: poolLoadingInitial && !hasCachedReady,
    athletePoolError,
  });

  if (
    hydrated.status === ROSTER_HYDRATION_STATUS.READY ||
    hydrated.status === ROSTER_HYDRATION_STATUS.PARTIAL
  ) {
    setCachedTeamRoster(cacheKey, hydrated);
  }

  if (hydrated.status === ROSTER_HYDRATION_STATUS.ERROR && hasCachedReady) {
    return {
      ...cached.hydrated,
      lifecycleStatus: ROSTER_LIFECYCLE_STATUS.REFRESHING_BACKGROUND,
      backgroundRefreshing: true,
      cacheKey,
      memberHash,
      usedCache: true,
      poolError: athletePoolError,
      refreshMessage: ROSTER_BACKGROUND_REFRESH_MESSAGE,
    };
  }

  const lifecycleStatus =
    hydrated.status === ROSTER_HYDRATION_STATUS.LOADING
      ? ROSTER_LIFECYCLE_STATUS.LOADING_INITIAL
      : hydrated.status === ROSTER_HYDRATION_STATUS.ERROR
        ? ROSTER_LIFECYCLE_STATUS.ERROR
        : hydrated.status === ROSTER_HYDRATION_STATUS.PARTIAL
          ? ROSTER_LIFECYCLE_STATUS.PARTIAL
          : ROSTER_LIFECYCLE_STATUS.READY;

  return {
    ...hydrated,
    lifecycleStatus,
    backgroundRefreshing: false,
    cacheKey,
    memberHash,
    usedCache: false,
    loadingMessage: hydrated.loadingMessage || null,
  };
}

/**
 * Tournament-level roster signature for invalidation.
 * @param {object} teamData
 */
export function computeTournamentRosterSetupSignature(teamData) {
  return (teamData?.teams || [])
    .map((team) => `${team.id}:${computeRosterMemberIdsHash(team)}`)
    .sort()
    .join("||");
}
