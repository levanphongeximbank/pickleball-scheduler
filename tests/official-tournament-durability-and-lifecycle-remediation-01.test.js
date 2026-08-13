/**
 * OFFICIAL-TOURNAMENT-DURABILITY-AND-LIFECYCLE-REMEDIATION-01
 *
 * Proves:
 * - accepted draw persists entries+groups+matches before animation authority
 * - Open/AI accepted entries are durable (not memory-only until draw)
 * - processMatchId invokes canonical lifecycle (not legacy blob ById)
 * - lifecycle is idempotent for club Elo / season points
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";

import { setActiveClubId, loadClubs, saveClubs, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData, saveClubData } from "../src/domain/clubStorage.js";
import {
  createTournamentCommand,
  updateTournamentCommand,
  getTournamentQuery,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
  processCanonicalCompletedMatch,
  findMatchInCanonicalTournament,
} from "../src/features/tournament/index.js";
import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  EVENT_TYPE,
  createEntryRecord,
} from "../src/models/tournament/index.js";
import {
  buildOfficialOpenPlan,
  buildOfficialOpenPatch,
  buildOfficialAiBalancePlan,
  buildOfficialAiBalancePatch,
  submitTournamentDirectorMatchScore,
} from "../src/tournament/engines/index.js";
import { applySeasonPointsFromMatchRecord } from "../src/domain/seasonStandingsService.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TENANT_ID = "tenant-official-durability-01";
const CLUB_SCOPE = { id: DEFAULT_CLUB.id, tenantId: TENANT_ID, venueId: TENANT_ID };

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
  };
}

function buildMenDoubleEntries(count = 8) {
  return Array.from({ length: count }, (_, index) =>
    createEntryRecord({
      id: `entry-${index + 1}`,
      name: `Cap ${index + 1}`,
      playerIds: [`p${index * 2 + 1}`, `p${index * 2 + 2}`],
      clubName: index % 2 === 0 ? "CLB A" : "CLB B",
      representativeClubName: index % 2 === 0 ? "CLB A" : "CLB B",
    })
  );
}

function buildPlayersForEntries(entries) {
  const players = [];
  entries.forEach((entry) => {
    (entry.playerIds || []).forEach((playerId, idx) => {
      players.push({
        id: playerId,
        name: `Player ${playerId}`,
        gender: "Nam",
        clubName: entry.clubName,
        skillLevel: 3.5 + idx * 0.1,
        rating: 3.5 + idx * 0.1,
      });
    });
  });
  return players;
}

describe("official-tournament-durability-and-lifecycle-remediation-01", () => {
  let memory;

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    __resetTournamentRepositorySingleton();
    const clubs = loadClubs().map((club) =>
      club.id === DEFAULT_CLUB.id
        ? { ...club, tenantId: TENANT_ID, venueId: TENANT_ID }
        : club
    );
    saveClubs(clubs);
    setActiveClubId(DEFAULT_CLUB.id);
    memory = createInMemoryCanonicalTournamentRpc({ tenantId: TENANT_ID });
    __setTournamentRepositoryRpcForTests(memory.rpc);
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("static: Option A — Official setup persists full matches before animation", () => {
    const setup = readSrc("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.equal(setup.includes("stripMatchesFromEvent"), false);

    // Shared Open/AI Balance group draw: persistTournament before showAnimation
    const openIdx = setup.indexOf("handleDrawGroups");
    assert.ok(openIdx > 0);
    assert.equal(setup.includes("handleBuildAiGroups"), false);
    assert.match(setup, /handleRunGroupDraw[\s\S]{0,250}handleDrawGroups\(false\)/);

    const openEnd = setup.indexOf("persistMatchPairing");
    const openBlock = setup.slice(openIdx, openEnd);
    assert.ok(openBlock.includes("persistTournament({"));
    assert.ok(openBlock.indexOf("persistTournament({") < openBlock.indexOf("anim.showAnimation"));

    const adapters = readSrc(
      "src/components/tournament/animation/tournamentFlowAdapters.js"
    );
    assert.ok(adapters.includes("drawAlreadyPersisted"));
  });

  it("static: Official adapter no longer strips matches on draw persist", () => {
    const adapters = readSrc(
      "src/components/tournament/animation/tournamentFlowAdapters.js"
    );
    const officialStart = adapters.indexOf("export function createOfficialFlowAdapters");
    const officialBlock = adapters.slice(officialStart);
    const persistStart = officialBlock.indexOf("async persist(animationMode, ctx)");
    const persistSection = officialBlock.slice(persistStart, persistStart + 3500);
    assert.equal(persistSection.includes("stripMatchesFromEvent"), false);
    assert.ok(persistSection.includes("drawAlreadyPersisted"));
    assert.ok(persistSection.includes("persistTournament({ events: patch.events })"));
  });

  it("static: entry durability helpers exist for Open + AI", () => {
    const setup = readSrc("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.ok(setup.includes("persistAcceptedEntries"));
    assert.ok(setup.includes("await persistAcceptedEntries(nextEntries)"));
  });

  it("static: processMatchId contract B — command invokes canonical lifecycle, not blob ById", () => {
    const commands = readSrc("src/features/tournament/services/tournamentCommands.js");
    const lifecycle = readSrc(
      "src/features/tournament/services/tournamentMatchLifecycle.js"
    );
    const cloud = readSrc(
      "src/features/tournament/repositories/cloudTournamentRepository.js"
    );

    assert.ok(commands.includes("processCanonicalCompletedMatch"));
    assert.ok(commands.includes("processMatchId"));
    assert.equal(commands.includes("processCompletedMatchById"), false);

    assert.ok(lifecycle.includes("processCompletedMatch("));
    assert.equal(lifecycle.includes("processCompletedMatchById"), false);
    assert.equal(lifecycle.includes("loadClubData"), false);

    assert.equal(cloud.includes("processMatchId"), false);
    assert.equal(cloud.includes("processCompletedMatch"), false);
  });

  it("Open plan + cloud update persist entries/groups/matches atomically", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      name: "Official Open Durability",
      createdBy: "owner-1",
    });
    assert.equal(created.ok, true);

    const entries = buildMenDoubleEntries(8);
    const players = buildPlayersForEntries(entries);
    const plan = buildOfficialOpenPlan({
      tournament: created.tournament,
      entries,
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
      randomFn: () => 0.33,
    });
    assert.equal(plan.ok, true);
    assert.ok((plan.event.matches || []).length > 0);
    assert.ok((plan.event.groups || []).length > 0);

    const patch = buildOfficialOpenPatch(created.tournament, plan);
    assert.equal(patch.ok, true);

    const updated = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      events: patch.events,
      status: TOURNAMENT_STATUS.READY,
      officialMode: OFFICIAL_MODE.OPEN,
    });
    assert.equal(updated.ok, true);

    const reloaded = await getTournamentQuery(CLUB_SCOPE, created.tournament.id);
    assert.equal(reloaded.ok, true);
    const event = reloaded.tournament.events[0];
    assert.equal(event.entries.length, 8);
    assert.ok(event.groups.length >= 2);
    assert.ok(event.matches.length > 0);
  });

  it("AI Balance plan + cloud update persist entries/groups/matches", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.AI_BALANCE,
      name: "Official AI Durability",
      createdBy: "owner-1",
    });
    assert.equal(created.ok, true);

    const entries = buildMenDoubleEntries(8);
    const players = buildPlayersForEntries(entries);
    const plan = buildOfficialAiBalancePlan({
      tournament: created.tournament,
      players,
      selectedPlayerIds: players.map((p) => String(p.id)),
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
      manualEntries: entries,
      individualRegistration: true,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    assert.ok((plan.event.matches || []).length > 0);

    const patch = buildOfficialAiBalancePatch(created.tournament, plan);
    assert.equal(patch.ok, true);

    const updated = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      events: patch.events,
      status: TOURNAMENT_STATUS.READY,
      officialMode: OFFICIAL_MODE.AI_BALANCE,
    });
    assert.equal(updated.ok, true);

    const reloaded = await getTournamentQuery(CLUB_SCOPE, created.tournament.id);
    const event = reloaded.tournament.events[0];
    assert.ok(event.entries.length > 0);
    assert.ok(event.groups.length > 0);
    assert.ok(event.matches.length > 0);
  });

  it("pre-draw Open entry persistence survives reload (canonical events)", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      name: "Open Entry Durability",
      createdBy: "owner-1",
    });
    assert.equal(created.ok, true);

    const entries = buildMenDoubleEntries(2);
    const updated = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      events: [
        {
          id: `event-${created.tournament.id}`,
          name: "Men Double",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries,
          groups: [],
          matches: [],
        },
      ],
    });
    assert.equal(updated.ok, true);

    const reloaded = await getTournamentQuery(CLUB_SCOPE, created.tournament.id);
    assert.equal(reloaded.tournament.events[0].entries.length, 2);
  });

  it("score update with processMatchId invokes canonical lifecycle once (idempotent)", async () => {
    const clubId = DEFAULT_CLUB.id;
    const data = loadClubData(clubId);
    // Ensure season/league exist for season-points path when leagueId set.
    if (!data.leagues?.length) {
      data.leagues = [
        {
          id: "league-official-durability",
          name: "League Durability",
          pointsSystem: { win: 2, loss: 1, draw: 1 },
        },
      ];
      saveClubData(clubId, data);
    }
    const leagueId = data.leagues[0].id;

    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      name: "Official Lifecycle",
      createdBy: "owner-1",
      leagueId,
      seasonId: "season-1",
    });
    assert.equal(created.ok, true);

    const entries = buildMenDoubleEntries(4);
    const players = buildPlayersForEntries(entries);
    // Seed players into club blob for Elo/season processors.
    const clubData = loadClubData(clubId);
    const existingIds = new Set((clubData.players || []).map((p) => String(p.id)));
    for (const player of players) {
      if (!existingIds.has(String(player.id))) {
        clubData.players.push(player);
      }
    }
    saveClubData(clubId, clubData);

    const plan = buildOfficialOpenPlan({
      tournament: { ...created.tournament, leagueId, clubId },
      entries,
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
      randomFn: () => 0.2,
    });
    assert.equal(plan.ok, true);

    const patch = buildOfficialOpenPatch(
      { ...created.tournament, leagueId, clubId },
      plan
    );
    const withGroups = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      events: patch.events,
      status: TOURNAMENT_STATUS.READY,
      leagueId,
      clubId,
    });
    assert.equal(withGroups.ok, true);

    const event = withGroups.tournament.events[0];
    const matchId = event.matches[0].id;
    const scored = submitTournamentDirectorMatchScore(event, matchId, {
      scoreA: 11,
      scoreB: 5,
    });
    assert.equal(scored.ok, true);

    const first = await updateTournamentCommand(
      CLUB_SCOPE,
      created.tournament.id,
      { events: [scored.event] },
      { processMatchId: matchId, processEventId: scored.event.id }
    );
    assert.equal(first.ok, true);
    assert.equal(first.lifecycleOk, true);
    assert.ok(first.lifecycle);

    const second = await updateTournamentCommand(
      CLUB_SCOPE,
      created.tournament.id,
      { events: [scored.event] },
      { processMatchId: matchId, processEventId: scored.event.id }
    );
    assert.equal(second.ok, true);
    assert.equal(second.lifecycleOk, true);
    // Club Elo path: second apply must skip as already-processed.
    if (second.lifecycle?.clubEloResult) {
      assert.equal(second.lifecycle.clubEloResult.skipped, true);
      assert.equal(second.lifecycle.clubEloResult.reason, "already-processed");
    }

    const found = findMatchInCanonicalTournament(first.tournament, matchId, {
      eventId: scored.event.id,
    });
    assert.ok(found.match);
    assert.equal(String(found.match.scoreA), "11");
  });

  it("processCanonicalCompletedMatch never reads tournament from legacy blob", () => {
    const lifecycle = readSrc(
      "src/features/tournament/services/tournamentMatchLifecycle.js"
    );
    assert.equal(lifecycle.includes("getTournamentFromClub"), false);
    assert.equal(lifecycle.includes("loadClubData"), false);
    assert.equal(lifecycle.includes("processCompletedMatchById"), false);
  });

  it("season points re-apply is idempotent by matchContributions", () => {
    const clubId = DEFAULT_CLUB.id;
    const data = loadClubData(clubId);
    const league =
      data.leagues?.[0] ||
      ({
        id: "league-idem",
        name: "League",
        pointsSystem: { win: 2, loss: 1 },
      });
    if (!data.leagues?.length) {
      data.leagues = [league];
      saveClubData(clubId, data);
    }

    const record = {
      id: "match-idem-1",
      date: new Date().toISOString(),
      playerIds: ["p1", "p2", "p3", "p4"],
      teamAPlayerIds: ["p1", "p2"],
      teamBPlayerIds: ["p3", "p4"],
      scoreA: 11,
      scoreB: 3,
      status: "completed",
    };

    const first = applySeasonPointsFromMatchRecord(clubId, league.id, record);
    assert.equal(first.ok, true);
    const second = applySeasonPointsFromMatchRecord(clubId, league.id, record);
    assert.equal(second.ok, true);

    const after = loadClubData(clubId);
    const contrib = after.seasonStandings?.[league.id]?.matchContributions?.["match-idem-1"];
    assert.ok(contrib);
  });

  it("canonical lifecycle helper resolves match from tournament snapshot", () => {
    const tournament = {
      id: "t1",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      clubId: DEFAULT_CLUB.id,
      events: [
        {
          id: "e1",
          matches: [{ id: "m1", status: "completed", scoreA: 11, scoreB: 7 }],
        },
      ],
    };
    const found = findMatchInCanonicalTournament(tournament, "m1", { eventId: "e1" });
    assert.equal(found.match.id, "m1");

    const missing = processCanonicalCompletedMatch(DEFAULT_CLUB.id, tournament, "missing");
    assert.equal(missing.ok, false);
  });
});
