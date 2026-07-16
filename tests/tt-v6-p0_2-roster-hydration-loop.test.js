/**
 * TEAM TOURNAMENT V6 — P0.2 roster hydration lifecycle loop regression tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeEach } from "node:test";

import {
  ROSTER_HYDRATION_STATUS,
  ROSTER_LOADING_MESSAGE,
  hydrateTeamRoster,
} from "../src/features/team-tournament/engines/teamRosterHydration.js";
import {
  ROSTER_BACKGROUND_REFRESH_MESSAGE,
  ROSTER_LIFECYCLE_STATUS,
  __resetTeamRosterHydrationCacheForTests,
  buildRosterCacheKey,
  computeRosterMemberIdsHash,
  computeTournamentRosterSetupSignature,
  getCachedTeamRoster,
  resolveTeamRosterHydrationState,
  setCachedTeamRoster,
} from "../src/features/team-tournament/engines/teamRosterHydrationCache.js";
import {
  __getTeamTournamentAthletePoolInFlightCountForTests,
  __resetTeamTournamentAthletePoolRequestsForTests,
} from "../src/features/team-tournament/ui/useTeamTournamentAthletePool.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TOURNAMENT_ID = "tt-v6-loop-tournament";
const SETUP_VERSION = 3;

const TEAM = {
  id: "team-alpha",
  name: "Alpha MLP",
  playerIds: [
    "a1000000-0000-4000-8000-000000000001",
    "a1000000-0000-4000-8000-000000000002",
  ],
  captainPlayerId: "a1000000-0000-4000-8000-000000000001",
  deputyPlayerIds: [],
};

const POOL = [
  {
    id: "a1000000-0000-4000-8000-000000000001",
    athleteId: "a1000000-0000-4000-8000-000000000001",
    displayName: "TEST-NAM-01",
    gender: "Nam",
    currentRating: 4.0,
  },
  {
    id: "a1000000-0000-4000-8000-000000000002",
    athleteId: "a1000000-0000-4000-8000-000000000002",
    displayName: "TEST-NAM-02",
    gender: "Nam",
    vprRating: 3.8,
  },
];

function primeReadyCache() {
  const ready = hydrateTeamRoster({
    team: TEAM,
    athletePool: POOL,
    setupReady: true,
    athletePoolLoading: false,
  });
  const key = buildRosterCacheKey(
    TOURNAMENT_ID,
    SETUP_VERSION,
    TEAM.id,
    computeRosterMemberIdsHash(TEAM)
  );
  setCachedTeamRoster(key, ready);
  return { ready, key };
}

describe("P0.2 roster hydration lifecycle cache", () => {
  beforeEach(() => {
    __resetTeamRosterHydrationCacheForTests();
    __resetTeamTournamentAthletePoolRequestsForTests();
  });

  it("initial load: loading_initial only until pool ready", () => {
    const loading = resolveTeamRosterHydrationState({
      tournamentId: TOURNAMENT_ID,
      setupVersion: SETUP_VERSION,
      team: TEAM,
      athletePool: [],
      setupReady: true,
      poolLoadingInitial: true,
      poolRefreshing: false,
    });
    assert.equal(loading.lifecycleStatus, ROSTER_LIFECYCLE_STATUS.LOADING_INITIAL);
    assert.equal(loading.loadingMessage, ROSTER_LOADING_MESSAGE);
    assert.equal(loading.members.length, TEAM.playerIds.length);

    const ready = resolveTeamRosterHydrationState({
      tournamentId: TOURNAMENT_ID,
      setupVersion: SETUP_VERSION,
      team: TEAM,
      athletePool: POOL,
      setupReady: true,
      poolLoadingInitial: false,
      poolRefreshing: false,
    });
    assert.equal(ready.lifecycleStatus, ROSTER_LIFECYCLE_STATUS.READY);
    assert.equal(ready.status, ROSTER_HYDRATION_STATUS.READY);
    assert.equal(ready.members.filter((m) => m.resolved).length, 2);
  });

  it("tab switch away/back keeps ready roster via module cache", () => {
    primeReadyCache();

    const afterTabReturn = resolveTeamRosterHydrationState({
      tournamentId: TOURNAMENT_ID,
      setupVersion: SETUP_VERSION,
      team: TEAM,
      athletePool: [],
      setupReady: true,
      poolLoadingInitial: true,
      poolRefreshing: false,
    });

    assert.equal(afterTabReturn.usedCache, true);
    assert.equal(
      afterTabReturn.lifecycleStatus,
      ROSTER_LIFECYCLE_STATUS.REFRESHING_BACKGROUND
    );
    assert.equal(afterTabReturn.members.filter((m) => m.resolved).length, 2);
    assert.equal(afterTabReturn.refreshMessage, ROSTER_BACKGROUND_REFRESH_MESSAGE);
  });

  it("background refresh keeps old roster visible", () => {
    const { key } = primeReadyCache();
    assert.ok(getCachedTeamRoster(key));

    const refreshing = resolveTeamRosterHydrationState({
      tournamentId: TOURNAMENT_ID,
      setupVersion: SETUP_VERSION,
      team: TEAM,
      athletePool: [],
      setupReady: true,
      poolLoadingInitial: false,
      poolRefreshing: true,
    });

    assert.equal(refreshing.backgroundRefreshing, true);
    assert.equal(refreshing.lifecycleStatus, ROSTER_LIFECYCLE_STATUS.REFRESHING_BACKGROUND);
    assert.equal(refreshing.members.length, 2);
    assert.ok(refreshing.members.every((m) => m.displayName.startsWith("TEST-")));
  });

  it("candidate pool refresh does not reset stored roster to loading_initial", () => {
    primeReadyCache();

    const duringPoolRefresh = resolveTeamRosterHydrationState({
      tournamentId: TOURNAMENT_ID,
      setupVersion: SETUP_VERSION,
      team: TEAM,
      athletePool: POOL,
      setupReady: true,
      poolLoadingInitial: false,
      poolRefreshing: true,
    });

    assert.notEqual(
      duringPoolRefresh.lifecycleStatus,
      ROSTER_LIFECYCLE_STATUS.LOADING_INITIAL
    );
    assert.equal(duringPoolRefresh.members.filter((m) => !m.pending).length, 2);
  });

  it("pool error during background refresh keeps cached roster", () => {
    primeReadyCache();

    const withError = resolveTeamRosterHydrationState({
      tournamentId: TOURNAMENT_ID,
      setupVersion: SETUP_VERSION,
      team: TEAM,
      athletePool: [],
      setupReady: true,
      poolLoadingInitial: false,
      poolRefreshing: true,
      athletePoolError: { message: "network" },
    });

    assert.equal(withError.usedCache, true);
    assert.equal(withError.members.length, 2);
  });

  it("setup signature changes only when roster member ids change", () => {
    const base = computeTournamentRosterSetupSignature({ teams: [TEAM] });
    const same = computeTournamentRosterSetupSignature({ teams: [{ ...TEAM }] });
    const changed = computeTournamentRosterSetupSignature({
      teams: [
        {
          ...TEAM,
          playerIds: [...TEAM.playerIds, "a1000000-0000-4000-8000-000000000099"],
        },
      ],
    });

    assert.equal(base, same);
    assert.notEqual(base, changed);
  });

  it("cache key is not keyed by tab — only tournament/setup/members", () => {
    const hash = computeRosterMemberIdsHash(TEAM);
    const keyA = buildRosterCacheKey(TOURNAMENT_ID, SETUP_VERSION, TEAM.id, hash);
    const keyB = buildRosterCacheKey(TOURNAMENT_ID, SETUP_VERSION, TEAM.id, hash);
    assert.equal(keyA, keyB);
    assert.doesNotMatch(keyA, /tab/i);
  });

  it("mutation invalidates via new member hash / setup version", () => {
    const { key: oldKey } = primeReadyCache();
    const mutatedTeam = {
      ...TEAM,
      playerIds: [...TEAM.playerIds, "a1000000-0000-4000-8000-000000000099"],
    };
    const newKey = buildRosterCacheKey(
      TOURNAMENT_ID,
      SETUP_VERSION + 1,
      mutatedTeam.id,
      computeRosterMemberIdsHash(mutatedTeam)
    );
    assert.notEqual(oldKey, newKey);
    assert.ok(getCachedTeamRoster(oldKey));
    assert.equal(getCachedTeamRoster(newKey), null);
  });
});

describe("P0.2 athlete pool request dedupe", () => {
  beforeEach(() => {
    __resetTeamTournamentAthletePoolRequestsForTests();
  });

  it("deduplicates in-flight pool requests for the same key", async () => {
    const inFlight = new Map();
    let fetchCount = 0;

    async function fetchAthletePoolDeduped(key, fetcher) {
      if (inFlight.has(key)) return inFlight.get(key);
      fetchCount += 1;
      const promise = fetcher().finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
      return promise;
    }

    const key = "t1::club1::tenant1::club::all::||::caller";
    const p1 = fetchAthletePoolDeduped(key, async () => ({ ok: true, athletes: POOL }));
    const p2 = fetchAthletePoolDeduped(key, async () => ({ ok: true, athletes: [] }));
    const [r1, r2] = await Promise.all([p1, p2]);

    assert.equal(fetchCount, 1);
    assert.deepEqual(r1, r2);
    assert.equal(__getTeamTournamentAthletePoolInFlightCountForTests(), 0);
  });

  it("stale sequence does not overwrite newer ready state (simulated)", async () => {
    let sequence = 0;
    let committed = null;

    async function commit(seq, payload) {
      await Promise.resolve();
      if (seq !== sequence) return;
      committed = payload;
    }

    sequence = 1;
    const stale = commit(1, { athletes: [] });
    sequence = 2;
    await commit(2, { athletes: POOL });
    await stale;

    assert.deepEqual(committed, { athletes: POOL });
  });
});

describe("P0.2 wiring regression", () => {
  it("TeamTournamentSetup uses rosterSetupRevision for pool, not dataVersion", () => {
    const src = readFileSync(
      path.join(ROOT, "src/pages/tournament/TeamTournamentSetup.jsx"),
      "utf8"
    );
    assert.match(src, /rosterSetupRevision/);
    assert.match(src, /revision:\s*rosterSetupRevision/);
    assert.match(src, /athletePoolLoadingInitial/);
    assert.match(src, /athletePoolRefreshing/);
    assert.match(src, /setupVersion=\{version/);
    assert.doesNotMatch(
      src,
      /revision:\s*dataVersion[\s\S]{0,120}TeamTournamentSetup\.club/
    );
  });

  it("useTeamTournamentPage bumps rosterSetupRevision only when roster signature changes", () => {
    const src = readFileSync(
      path.join(ROOT, "src/features/team-tournament/ui/useTeamTournamentPage.js"),
      "utf8"
    );
    assert.match(src, /computeTournamentRosterSetupSignature/);
    assert.match(src, /rosterChanged/);
    assert.match(src, /setRosterSetupRevision/);
  });

  it("TeamRosterPanel uses lifecycle cache resolver", () => {
    const src = readFileSync(
      path.join(ROOT, "src/components/tournament/TeamRosterPanel.jsx"),
      "utf8"
    );
    assert.match(src, /resolveTeamRosterHydrationState/);
    assert.match(src, /ROSTER_LIFECYCLE_STATUS\.LOADING_INITIAL/);
    assert.match(src, /ROSTER_BACKGROUND_REFRESH_MESSAGE/);
    assert.match(src, /TeamRosterPanel\.mount/);
  });

  it("useTeamTournamentAthletePool separates loadingInitial and refreshing", () => {
    const src = readFileSync(
      path.join(ROOT, "src/features/team-tournament/ui/useTeamTournamentAthletePool.js"),
      "utf8"
    );
    assert.match(src, /loadingInitial/);
    assert.match(src, /refreshing/);
    assert.match(src, /sequenceRef/);
    assert.match(src, /inFlightPoolRequests/);
    assert.match(src, /hasCachedAthletes/);
  });
});
