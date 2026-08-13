/**
 * Phase 2G — Open vs AI Balance product contract.
 * Pair formation + shared rating-neutral group draw. No new engines.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  ENTRY_STATUS,
  EVENT_TYPE,
} from "../src/models/tournament/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  patchOfficialCompetitionSettings,
  assessOfficialCompetitionStrategyChange,
  resolveOfficialPairingDispatch,
  resolveOfficialGroupDrawDispatch,
  allowedOfficialRegistrationModes,
  OFFICIAL_PAIRING_AUTHORITY,
  OFFICIAL_GROUP_DRAW_AUTHORITY,
  formOfficialIndividualPairs,
} from "../src/features/individual-tournament/index.js";
import {
  suggestOpenRandomEntriesFromPlayers,
  suggestBalancedEntriesFromIndividuals,
  suggestEntriesFromPlayers,
  assignEntriesOpenConditional,
  buildOfficialOpenPlan,
} from "../src/tournament/engines/index.js";

function src(path) {
  return readFileSync(path, "utf8");
}

function makeRng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sixteenPlayers(ratingForIndex = (index) => 3.0 + index * 0.1) {
  return Array.from({ length: 16 }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    gender: "male",
    rating: ratingForIndex(index),
    level: ratingForIndex(index),
  }));
}

function pairKeys(entries = []) {
  return (entries || [])
    .map((entry) =>
      [...(entry.playerIds || [])]
        .map(String)
        .sort()
        .join("|")
    )
    .sort();
}

function groupAssignment(groups = []) {
  return (groups || [])
    .map((group) => {
      const ids = (group.entryIds || (group.entries || []).map((entry) => entry.id) || [])
        .map(String)
        .sort()
        .join(",");
      return `${group.label || group.name || group.id}:${ids}`;
    })
    .sort()
    .join("|");
}

function baseTournament(overrides = {}) {
  return {
    id: "t-p2g-mode",
    name: "Official P2G Mode",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.DRAFT,
    settings: {
      officialCompetition: {
        registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      },
    },
    events: [
      {
        id: "ev1",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [],
        drawEntries: [],
        groups: [],
        matches: [],
      },
    ],
    ...overrides,
  };
}

function registeredIndividuals(players, officialMode = OFFICIAL_MODE.OPEN) {
  return {
    ...baseTournament(),
    officialMode,
    events: [
      {
        id: "ev1",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: players.map((player) => ({
          id: `e-${player.id}`,
          name: player.name,
          playerIds: [player.id],
          status: ENTRY_STATUS.ACTIVE,
        })),
        drawEntries: [],
        groups: [],
        matches: [],
      },
    ],
  };
}

describe("official-open-tournament-phase2g-mode-strategy-01", () => {
  it("PAIRING_AUTHORITY_MATRIX — Open individual uses random, not AI", () => {
    const dispatch = resolveOfficialPairingDispatch({
      officialMode: OFFICIAL_MODE.OPEN,
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(dispatch.ok, true);
    assert.equal(dispatch.pairingAuthority, OFFICIAL_PAIRING_AUTHORITY.OPEN_RANDOM);
    assert.equal(dispatch.usesRating, false);
    assert.equal(dispatch.pairingInvoked, true);
  });

  it("A. Open + individual → random pairing; AI authority invocation = 0", () => {
    const players = sixteenPlayers();
    let aiCalls = 0;
    const formed = formOfficialIndividualPairs({
      tournament: registeredIndividuals(players),
      eventId: "ev1",
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      pairingFn: (selected, eventType, options) =>
        suggestOpenRandomEntriesFromPlayers(selected, eventType, {
          ...options,
          randomFn: makeRng(42),
        }),
    });
    assert.equal(formed.ok, true);
    assert.equal(formed.pairs.length, 8);
    assert.equal(aiCalls, 0);
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /suggestOpenRandomEntriesFromPlayers/);
    assert.match(setup, /OFFICIAL_PAIRING_AUTHORITY\.AI_BALANCE/);
    assert.match(setup, /handleRunGroupDraw[\s\S]*handleDrawGroups\(false\)/);
    assert.doesNotMatch(setup, /handleBuildAiGroups/);
    assert.equal(
      setup.includes("suggestBalancedEntriesFromIndividuals") &&
        setup.includes("suggestOpenRandomEntriesFromPlayers"),
      true
    );
  });

  it("B. Open pair formation does not use rating for allocation", () => {
    const low = sixteenPlayers(() => 2.0);
    const high = sixteenPlayers((index) => 5.0 - index * 0.05);
    const rngSeed = 77;
    const a = suggestOpenRandomEntriesFromPlayers(low, EVENT_TYPE.MEN_DOUBLE, {
      randomFn: makeRng(rngSeed),
    });
    const b = suggestOpenRandomEntriesFromPlayers(high, EVENT_TYPE.MEN_DOUBLE, {
      randomFn: makeRng(rngSeed),
    });
    assert.deepEqual(pairKeys(a), pairKeys(b));
    const engine = src("src/tournament/engines/teamPairingEngine.js");
    assert.match(engine, /mode: "open"/);
    assert.match(engine, /createTeamsFromPlayers/);
  });

  it("C. Open + pair registration → no pairing invocation", () => {
    const dispatch = resolveOfficialPairingDispatch({
      officialMode: OFFICIAL_MODE.OPEN,
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    assert.equal(dispatch.pairingAuthority, OFFICIAL_PAIRING_AUTHORITY.NONE);
    assert.equal(dispatch.pairingInvoked, false);
    assert.equal(dispatch.usesRating, false);

    let calls = 0;
    const formed = formOfficialIndividualPairs({
      tournament: patchOfficialCompetitionSettings(baseTournament(), {
        registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
      }),
      eventId: "ev1",
      players: sixteenPlayers(),
      eventType: EVENT_TYPE.MEN_DOUBLE,
      pairingFn: (players, eventType, options) => {
        calls += 1;
        return suggestOpenRandomEntriesFromPlayers(players, eventType, options);
      },
    });
    assert.equal(formed.ok, false);
    assert.equal(calls, 0);
    assert.match(formed.error, /cá nhân/i);
  });

  it("D/E. Open group draw is rating-neutral under the same RNG seed", () => {
    const playersA = sixteenPlayers((index) => 2 + index * 0.2);
    const playersB = sixteenPlayers((index) => 5 - index * 0.1);
    const entries = suggestOpenRandomEntriesFromPlayers(playersA, EVENT_TYPE.MEN_DOUBLE, {
      randomFn: makeRng(3),
    });
    const drawA = assignEntriesOpenConditional(entries, 4, {
      randomFn: makeRng(11),
      splitUnits: false,
      playersById: new Map(playersA.map((player) => [player.id, player])),
    });
    const drawB = assignEntriesOpenConditional(entries, 4, {
      randomFn: makeRng(11),
      splitUnits: false,
      playersById: new Map(playersB.map((player) => [player.id, player])),
    });
    assert.equal(drawA.ok, true);
    assert.equal(drawB.ok, true);
    assert.equal(groupAssignment(drawA.groups), groupAssignment(drawB.groups));

    const open = src("src/tournament/engines/openConditionalRandomEngine.js");
    assert.doesNotMatch(open, /playerRating|entry\.rating|\bVPR\b/);
    assert.match(open, /shuffleArray/);
  });

  it("GROUP_DRAW_AUTHORITY_MATRIX — Open and AI Balance share random group draw", () => {
    const open = resolveOfficialGroupDrawDispatch({ officialMode: OFFICIAL_MODE.OPEN });
    const ai = resolveOfficialGroupDrawDispatch({
      officialMode: OFFICIAL_MODE.AI_BALANCE,
    });
    assert.equal(open.groupDrawAuthority, OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM);
    assert.equal(ai.groupDrawAuthority, OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM);
    assert.equal(open.usesRating, false);
    assert.equal(ai.usesRating, false);
    assert.equal(open.sharedPolicy, true);
    assert.equal(ai.sharedPolicy, true);
  });

  it("AI Balance settings force individual; pair unavailable", () => {
    assert.deepEqual(allowedOfficialRegistrationModes(OFFICIAL_MODE.AI_BALANCE), [
      OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    ]);
    assert.deepEqual(allowedOfficialRegistrationModes(OFFICIAL_MODE.OPEN), [
      OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
      OFFICIAL_REGISTRATION_MODE.PAIR,
    ]);
    const settings = src(
      "src/components/tournament/official/OfficialTournamentSettingsScreen.jsx"
    );
    assert.match(settings, /AI Balance chỉ đăng ký cá nhân/);
    assert.match(settings, /officialMode === OFFICIAL_MODE.AI_BALANCE/);
    assert.match(settings, /OFFICIAL_REGISTRATION_MODE\.PAIR/);

    const aiTournament = { ...baseTournament(), officialMode: OFFICIAL_MODE.AI_BALANCE };
    assert.throws(
      () =>
        patchOfficialCompetitionSettings(aiTournament, {
          registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
        }),
      /cá nhân/
    );
  });

  it("AI Balance pair formation invokes AI authority; Open random = 0", () => {
    const dispatch = resolveOfficialPairingDispatch({
      officialMode: OFFICIAL_MODE.AI_BALANCE,
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    assert.equal(dispatch.pairingAuthority, OFFICIAL_PAIRING_AUTHORITY.AI_BALANCE);
    assert.equal(dispatch.usesRating, true);

    let openCalls = 0;
    let aiCalls = 0;
    const players = sixteenPlayers();
    const formed = formOfficialIndividualPairs({
      tournament: registeredIndividuals(players, OFFICIAL_MODE.AI_BALANCE),
      eventId: "ev1",
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      pairingFn: (players, eventType, options) => {
        aiCalls += 1;
        return suggestBalancedEntriesFromIndividuals(players, eventType, options);
      },
    });
    assert.equal(formed.ok, true);
    assert.equal(aiCalls, 1);
    assert.equal(openCalls, 0);
    const blocked = resolveOfficialPairingDispatch({
      officialMode: OFFICIAL_MODE.AI_BALANCE,
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.pairingAuthority, OFFICIAL_PAIRING_AUTHORITY.INVALID);
    assert.equal(openCalls, 0);
  });

  it("E. changing ratings may affect AI pairing", () => {
    const base = sixteenPlayers((index) => 3 + index * 0.1);
    const boosted = sixteenPlayers((index) => 3 + index * 0.1);
    boosted[0] = { ...boosted[0], rating: 9, level: 9 };
    const a = suggestBalancedEntriesFromIndividuals(base, EVENT_TYPE.MEN_DOUBLE);
    const b = suggestBalancedEntriesFromIndividuals(boosted, EVENT_TYPE.MEN_DOUBLE);
    assert.notDeepEqual(pairKeys(a), pairKeys(b));
  });

  it("F/G. after pairs exist, group draw does not use AI/rating balance", () => {
    const playersA = sixteenPlayers((index) => 2 + index * 0.2);
    const playersB = sixteenPlayers((index) => 5 - index * 0.15);
    const pairs = suggestBalancedEntriesFromIndividuals(playersA, EVENT_TYPE.MEN_DOUBLE);
    const tournament = {
      ...baseTournament(),
      officialMode: OFFICIAL_MODE.AI_BALANCE,
      hostClubName: "",
    };
    const planA = buildOfficialOpenPlan({
      tournament,
      entries: pairs,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      eventId: "ev1",
      groupCount: 4,
      players: playersA,
      splitUnits: false,
      randomFn: makeRng(21),
    });
    const planB = buildOfficialOpenPlan({
      tournament,
      entries: pairs,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      eventId: "ev1",
      groupCount: 4,
      players: playersB,
      splitUnits: false,
      randomFn: makeRng(21),
    });
    assert.equal(planA.ok, true);
    assert.equal(planB.ok, true);
    assert.equal(groupAssignment(planA.event.groups), groupAssignment(planB.event.groups));

    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.match(setup, /handleRunGroupDraw[\s\S]{0,200}handleDrawGroups\(false\)/);
    assert.doesNotMatch(setup, /buildOfficialAiBalancePlan/);
  });

  it("mode switch — empty Open individual → AI Balance allowed", () => {
    const gate = assessOfficialCompetitionStrategyChange(
      baseTournament(),
      OFFICIAL_MODE.AI_BALANCE
    );
    assert.equal(gate.allowed, true);
  });

  it("mode switch — Open pair, no registrations → normalize to individual", () => {
    const tournament = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    const gate = assessOfficialCompetitionStrategyChange(
      tournament,
      OFFICIAL_MODE.AI_BALANCE
    );
    assert.equal(gate.allowed, true);
    assert.equal(gate.normalizeRegistrationMode, OFFICIAL_REGISTRATION_MODE.INDIVIDUAL);
  });

  it("mode switch — existing pair registrations → AI Balance blocked", () => {
    const tournament = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    tournament.events[0].entries = [
      {
        id: "pair-1",
        name: "A / B",
        playerIds: ["p1", "p2"],
        status: ENTRY_STATUS.ACTIVE,
      },
    ];
    const gate = assessOfficialCompetitionStrategyChange(
      tournament,
      OFFICIAL_MODE.AI_BALANCE
    );
    assert.equal(gate.allowed, false);
    assert.equal(gate.code, "MODE_SWITCH_BLOCKED_PAIR_REGISTRATION");
    assert.equal(tournament.events[0].entries.length, 1);
  });

  it("mode switch — drawEntries/groups/matches blocked; no conversion", () => {
    const withDraw = baseTournament();
    withDraw.events[0].drawEntries = [{ id: "d1", playerIds: ["p1", "p2"] }];
    assert.equal(
      assessOfficialCompetitionStrategyChange(withDraw, OFFICIAL_MODE.AI_BALANCE)
        .allowed,
      false
    );

    const withGroups = baseTournament();
    withGroups.events[0].groups = [{ id: "gA", entryIds: ["d1"] }];
    assert.equal(
      assessOfficialCompetitionStrategyChange(withGroups, OFFICIAL_MODE.AI_BALANCE)
        .allowed,
      false
    );

    const withMatches = baseTournament();
    withMatches.events[0].matches = [{ id: "m1" }];
    assert.equal(
      assessOfficialCompetitionStrategyChange(withMatches, OFFICIAL_MODE.OPEN).allowed,
      true
    );
    withMatches.officialMode = OFFICIAL_MODE.AI_BALANCE;
    assert.equal(
      assessOfficialCompetitionStrategyChange(withMatches, OFFICIAL_MODE.OPEN).allowed,
      false
    );
  });

  it("default suggestEntriesFromPlayers is not the Open Official path", () => {
    const players = sixteenPlayers();
    const skill = suggestEntriesFromPlayers(players, EVENT_TYPE.MEN_DOUBLE);
    const open = suggestOpenRandomEntriesFromPlayers(players, EVENT_TYPE.MEN_DOUBLE, {
      randomFn: makeRng(5),
    });
    assert.equal(skill.length > 0, true);
    assert.equal(open.length > 0, true);
    const setup = src("src/pages/tournament/OfficialTournamentSetup.jsx");
    assert.doesNotMatch(
      setup,
      /pairingFn = isAiBalance[\s\S]*suggestEntriesFromPlayers/
    );
  });

  it("private pairing does not rewrite Open randomness when runtime is off", () => {
    const runtime = src("src/features/private-pairing-rules/runtime/runtimeCodes.js");
    assert.match(runtime, /isPrivatePairingRuntimeEnabled/);
    const openDraw = src(
      "src/features/private-pairing-rules/runtime/applyPrivatePairingToOpenDraw.js"
    );
    assert.match(openDraw, /if \(!isPrivatePairingRuntimeEnabled\(envSource\)\)/);
    assert.match(openDraw, /openAssigner\(entries, groupCount, openOptions\)/);
  });
});
