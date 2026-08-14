/**
 * IT-E2E-BROWSER-013 — Internal doubles grouping uses TEAM competition unit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import {
  EVENT_TYPE,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../src/models/tournament/constants.js";
import {
  canonicalRowToTournament,
  tournamentToCanonicalRow,
} from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import { updateTournamentCommand } from "../src/features/tournament/services/tournamentCommands.js";
import {
  __resetTournamentRepositorySingleton,
} from "../src/features/tournament/repositories/tournamentRepositoryFactory.js";
import { createCloudTournamentRepository } from "../src/features/tournament/repositories/cloudTournamentRepository.js";
import {
  COMPETITION_UNIT,
  INTERNAL_TEAM_ID_FIELD,
  INTERNAL_TEAM_MEMBER_IDS_FIELD,
  computeInternalSetupDirtyFlags,
  decideInternalSetupHydration,
  INTERNAL_HYDRATION_ACTION,
  inspectInternalGroupedCompetitionUnits,
  isTeamCompetitionEntry,
  listInternalPersistedGroups,
  projectInternalGroupDrawCard,
  resolveInternalCompetitionUnit,
  resolveInternalGroupingEntries,
} from "../src/features/tournament/internal/index.js";
import {
  buildInternalDrawEventWithoutMatches,
  buildInternalScheduleFromPersistedGroups,
  buildInternalTournamentPlan,
  createSingleEntriesFromPlayers,
  suggestEntriesFromPlayers,
} from "../src/tournament/engines/index.js";
import {
  CONSTRAINT_TYPE,
} from "../src/features/pairing-constraints/constants.js";
import { createPairingConstraint } from "../src/features/pairing-constraints/models/pairingConstraint.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_VERSION = 1;
const TOURNAMENT_ID = "d3a35fd1-5caf-4d18-86b4-5df0881c9dc3";

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function makePlayer(id, genderLabel, rating = 3.5) {
  return {
    id,
    name: `IT421 ${genderLabel} ${id}`,
    gender: genderLabel,
    level: rating,
  };
}

function makeMalePlayers(count = 12) {
  return Array.from({ length: count }, (_, index) =>
    makePlayer(`m${index + 1}`, "Nam", 4 - index * 0.05)
  );
}

function makeFemalePlayers(count = 12) {
  return Array.from({ length: count }, (_, index) =>
    makePlayer(`f${index + 1}`, "Nữ", 4 - index * 0.05)
  );
}

function makeMixedPlayers(count = 12) {
  const players = [];
  for (let i = 0; i < count; i += 1) {
    players.push(
      makePlayer(
        i % 2 === 0 ? `m${i / 2 + 1}` : `f${Math.ceil(i / 2)}`,
        i % 2 === 0 ? "Nam" : "Nữ",
        4 - i * 0.05
      )
    );
  }
  return players;
}

function makeRow(overrides = {}) {
  return {
    id: TOURNAMENT_ID,
    tenant_id: "tenant-a",
    club_id: "club-a",
    external_key: TOURNAMENT_ID,
    name: "Giải nội bộ 14/8/2026",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    status: TOURNAMENT_STATUS.DRAFT,
    season_id: null,
    league_id: null,
    payload: { events: [], settings: {} },
    engine_v4: {},
    version: SERVER_VERSION,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createBrowserCasStore(initialRow) {
  let store = { ...initialRow, version: Number(initialRow.version || 1) };
  const patches = [];
  let writeCount = 0;

  const rpc = async (name, args) => {
    if (name === "canonical_tournament_get") {
      return { ok: true, tournament: store };
    }
    if (name === "canonical_tournament_update") {
      const patch = args.p_patch || {};
      patches.push(patch);
      if (patch.expected_version == null || String(patch.expected_version).trim() === "") {
        throw new Error("expected_version is required for internal_tournament updates.");
      }
      if (Number(patch.expected_version) !== Number(store.version)) {
        return {
          ok: false,
          code: "VERSION_CONFLICT",
          expectedVersion: patch.expected_version,
          currentVersion: store.version,
          error: "VERSION_CONFLICT",
        };
      }
      writeCount += 1;
      store = {
        ...store,
        name: patch.name ?? store.name,
        status: patch.status ?? store.status,
        payload: patch.payload ?? store.payload,
        engine_v4: patch.engine_v4 ?? store.engine_v4,
        version: Number(store.version) + 1,
        updated_at: new Date().toISOString(),
      };
      return { ok: true, tournament: store };
    }
    return { ok: false, code: "UNEXPECTED", error: name };
  };

  return {
    rpc,
    getStore: () => store,
    getPatches: () => patches,
    getWriteCount: () => writeCount,
  };
}

function buildPlan({
  players,
  eventType,
  groupCount,
  manualEntries = null,
  pairingConstraints = [],
} = {}) {
  const tournament = canonicalRowToTournament(makeRow());
  return buildInternalTournamentPlan({
    tournament,
    players,
    selectedPlayerIds: players.map((player) => player.id),
    eventType,
    groupCount,
    manualEntries,
    pairingConstraints,
  });
}

async function persistDraw({
  players,
  eventType,
  groupCount,
  manualEntries = null,
} = {}) {
  const row = makeRow();
  const tournament = canonicalRowToTournament(row);
  const store = createBrowserCasStore(row);
  const repo = createCloudTournamentRepository({ rpc: store.rpc });
  const plan = buildInternalTournamentPlan({
    tournament,
    players,
    selectedPlayerIds: players.map((player) => player.id),
    eventType,
    groupCount,
    manualEntries,
  });
  assert.equal(plan.ok, true, plan.errors?.join(" "));
  const draw = buildInternalDrawEventWithoutMatches(plan);
  assert.equal(draw.ok, true);
  const result = await updateTournamentCommand(
    { id: "club-a", tenantId: "tenant-a" },
    TOURNAMENT_ID,
    {
      events: [draw.event],
      status: TOURNAMENT_STATUS.READY,
      settings: {
        internal: {
          groupCount: draw.groupCount,
          eventType: draw.event.eventType,
        },
      },
    },
    {
      repository: repo,
      tenantId: "tenant-a",
      currentTournament: tournament,
      expectedVersion: SERVER_VERSION,
    }
  );
  return { store, result, draw, plan, tournament };
}

function assertTeamGroups(event, { groupCount, teamsPerGroup, athletesPerGroup, totalTeams, totalAthletes }) {
  const groups = listInternalPersistedGroups(event);
  assert.equal(groups.length, groupCount);
  const inspected = inspectInternalGroupedCompetitionUnits(groups, event);
  inspected.groups.forEach((group) => {
    assert.equal(group.memberUnit, COMPETITION_UNIT.TEAM);
    assert.equal(group.teamCount, teamsPerGroup);
    assert.equal(group.athleteCount, athletesPerGroup);
    group.teamIds.forEach((id) => assert.ok(id));
  });
  assert.equal(inspected.totalUniqueTeamCount, totalTeams);
  assert.equal(inspected.totalUniqueAthleteCount, totalAthletes);
  const eventEntries = event.entries || [];
  assert.equal(eventEntries.length, totalTeams);
  eventEntries.forEach((entry) => {
    assert.equal(isTeamCompetitionEntry(entry), true);
    assert.equal((entry.playerIds || []).length, 2);
  });
  return inspected;
}

describe("IT-E2E-BROWSER-013 — doubles groups contain teams", () => {
  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("resolves COMPETITION_UNIT from content mode", () => {
    assert.equal(resolveInternalCompetitionUnit(EVENT_TYPE.MEN_SINGLE), COMPETITION_UNIT.PLAYER);
    assert.equal(resolveInternalCompetitionUnit(EVENT_TYPE.WOMEN_SINGLE), COMPETITION_UNIT.PLAYER);
    assert.equal(resolveInternalCompetitionUnit(EVENT_TYPE.MEN_DOUBLE), COMPETITION_UNIT.TEAM);
    assert.equal(resolveInternalCompetitionUnit(EVENT_TYPE.WOMEN_DOUBLE), COMPETITION_UNIT.TEAM);
    assert.equal(resolveInternalCompetitionUnit(EVENT_TYPE.MIXED_DOUBLE), COMPETITION_UNIT.TEAM);
    assert.equal(resolveInternalCompetitionUnit(EVENT_TYPE.OPEN_DOUBLE), COMPETITION_UNIT.TEAM);
    assert.equal(INTERNAL_TEAM_ID_FIELD, "id");
    assert.equal(INTERNAL_TEAM_MEMBER_IDS_FIELD, "playerIds");
  });

  it("A. 12 athletes / 6 doubles teams / 2 groups → 3 teams and 6 athletes per group", () => {
    const players = makeMalePlayers(12);
    const pairing = suggestEntriesFromPlayers(players, EVENT_TYPE.MEN_DOUBLE, {
      tournamentId: TOURNAMENT_ID,
      eventId: "event-1",
    });
    assert.equal(pairing.length, 6);
    pairing.forEach((entry) => assert.equal((entry.playerIds || []).length, 2));

    const plan = buildPlan({
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
      manualEntries: pairing,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    assert.equal(plan.event.eventType, EVENT_TYPE.MEN_DOUBLE);
    assertTeamGroups(plan.event, {
      groupCount: 2,
      teamsPerGroup: 3,
      athletesPerGroup: 6,
      totalTeams: 6,
      totalAthletes: 12,
    });
  });

  it("A2. athlete-shaped preview is rebuilt into teams for doubles", () => {
    const players = makeMalePlayers(12);
    const athleteEntries = createSingleEntriesFromPlayers(players, EVENT_TYPE.MEN_SINGLE, {
      tournamentId: TOURNAMENT_ID,
      eventId: "event-1",
    });
    assert.equal(athleteEntries.length, 12);

    const grouping = resolveInternalGroupingEntries({
      eventType: EVENT_TYPE.MEN_DOUBLE,
      previewEntries: athleteEntries,
      selectedPlayers: players,
      pairingOptions: { tournamentId: TOURNAMENT_ID, eventId: "event-1" },
    });
    assert.equal(grouping.ok, true);
    assert.equal(grouping.unit, COMPETITION_UNIT.TEAM);
    assert.equal(grouping.source, "rebuilt_unit_mismatch");
    assert.equal(grouping.entries.length, 6);
    grouping.entries.forEach((entry) => assert.equal((entry.playerIds || []).length, 2));

    const plan = buildPlan({
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
      manualEntries: athleteEntries,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    assertTeamGroups(plan.event, {
      groupCount: 2,
      teamsPerGroup: 3,
      athletesPerGroup: 6,
      totalTeams: 6,
      totalAthletes: 12,
    });
  });

  it("B. 6 teams / 1 group → 6 teams, not 12", () => {
    const players = makeMalePlayers(12);
    const plan = buildPlan({
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 1,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    assertTeamGroups(plan.event, {
      groupCount: 1,
      teamsPerGroup: 6,
      athletesPerGroup: 12,
      totalTeams: 6,
      totalAthletes: 12,
    });
  });

  it("C. mixed doubles retains pair unit", () => {
    const players = makeMixedPlayers(12);
    const plan = buildPlan({
      players,
      eventType: EVENT_TYPE.MIXED_DOUBLE,
      groupCount: 2,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    assertTeamGroups(plan.event, {
      groupCount: 2,
      teamsPerGroup: 3,
      athletesPerGroup: 6,
      totalTeams: 6,
      totalAthletes: 12,
    });
  });

  it("D. women's doubles retains pair unit", () => {
    const players = makeFemalePlayers(12);
    const plan = buildPlan({
      players,
      eventType: EVENT_TYPE.WOMEN_DOUBLE,
      groupCount: 2,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    assertTeamGroups(plan.event, {
      groupCount: 2,
      teamsPerGroup: 3,
      athletesPerGroup: 6,
      totalTeams: 6,
      totalAthletes: 12,
    });
  });

  it("E. singles competition unit remains player", () => {
    const players = makeMalePlayers(8);
    const plan = buildPlan({
      players,
      eventType: EVENT_TYPE.MEN_SINGLE,
      groupCount: 2,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    const inspected = inspectInternalGroupedCompetitionUnits(
      listInternalPersistedGroups(plan.event),
      plan.event
    );
    assert.equal(inspected.groups.length, 2);
    inspected.groups.forEach((group) => {
      assert.equal(group.memberUnit, COMPETITION_UNIT.PLAYER);
      assert.equal(group.teamCount, 4);
      assert.equal(group.athleteCount, 4);
    });
    assert.equal(inspected.totalUniqueAthleteCount, 8);
    (plan.event.entries || []).forEach((entry) => {
      assert.equal((entry.playerIds || []).length, 1);
    });
  });

  it("F. 3 teams/group round-robin → 3 matches/group, 6 total, team vs team", () => {
    const players = makeMalePlayers(12);
    const plan = buildPlan({
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    const draw = buildInternalDrawEventWithoutMatches(plan);
    const scheduled = buildInternalScheduleFromPersistedGroups({
      tournament: { ...canonicalRowToTournament(makeRow()), events: [draw.event] },
      players,
    });
    assert.equal(scheduled.ok, true, scheduled.errors?.join(" "));
    const groups = scheduled.event.groups || [];
    assert.equal(groups.length, 2);
    groups.forEach((group) => {
      assert.equal((group.matches || []).length, 3);
    });
    const matches = (scheduled.event.matches || []).filter((match) => !match.bracketMatchId);
    assert.equal(matches.length, 6);
    const entriesById = new Map((draw.event.entries || []).map((entry) => [String(entry.id), entry]));
    matches.forEach((match) => {
      const entryA = entriesById.get(String(match.entryAId));
      const entryB = entriesById.get(String(match.entryBId));
      assert.ok(entryA, `missing team A ${match.entryAId}`);
      assert.ok(entryB, `missing team B ${match.entryBId}`);
      assert.equal((entryA.playerIds || []).length, 2);
      assert.equal((entryB.playerIds || []).length, 2);
      assert.notEqual(String(match.entryAId), String(match.entryBId));
    });
  });

  it("G. UI renders team count and pair rows", () => {
    const setup = readSrc("src/pages/tournament/InternalTournamentSetup.jsx");
    assert.match(setup, /projectInternalGroupDrawCard/);
    assert.match(setup, /resolveInternalGroupingEntries/);
    assert.match(setup, /resolveInternalCompetitionUnit/);
    assert.match(setup, /card\.chipLabel/);
    assert.match(setup, /index \+ 1\}\. \{label\}/);
    assert.match(setup, /card\.athleteCountLabel/);

    const players = makeMalePlayers(12);
    const plan = buildPlan({
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
    });
    const groups = listInternalPersistedGroups(plan.event);
    const cardA = projectInternalGroupDrawCard(groups[0], EVENT_TYPE.MEN_DOUBLE, plan.event);
    assert.equal(cardA.unit, COMPETITION_UNIT.TEAM);
    assert.equal(cardA.teamCount, 3);
    assert.equal(cardA.chipLabel, "3 đội");
    assert.equal(cardA.athleteCountLabel, "6 VĐV");
    assert.equal(cardA.teamLabels.length, 3);
    cardA.teamLabels.forEach((label) => assert.match(label, / \/ /));
  });

  it("H. F5 mapper keeps the same team membership", async () => {
    const players = makeMalePlayers(12);
    const { store, result } = await persistDraw({
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
    });
    assert.equal(result.ok, true);
    assert.equal(store.getWriteCount(), 1);
    assert.equal(result.tournament.version, SERVER_VERSION + 1);

    const fresh = canonicalRowToTournament(store.getStore());
    const wrote = inspectInternalGroupedCompetitionUnits(
      listInternalPersistedGroups(result.tournament),
      result.tournament.events[0]
    );
    const reloaded = inspectInternalGroupedCompetitionUnits(
      listInternalPersistedGroups(fresh),
      fresh.events[0]
    );
    assert.deepEqual(reloaded.groups.map((group) => [...group.teamIds].sort()), wrote.groups.map((group) => [...group.teamIds].sort()));
    assert.equal(reloaded.totalUniqueTeamCount, 6);
    assert.equal(reloaded.totalUniqueAthleteCount, 12);
    assert.equal(fresh.events[0].eventType, EVENT_TYPE.MEN_DOUBLE);

    const roundTrip = canonicalRowToTournament(
      tournamentToCanonicalRow(fresh, { tenantId: "tenant-a", clubId: "club-a" })
    );
    assert.equal(roundTrip.events[0].eventType, EVENT_TYPE.MEN_DOUBLE);
    assert.equal(listInternalPersistedGroups(roundTrip).length, 2);
  });

  it("I. Founder pairing intervention still groups teams", () => {
    const players = makeMalePlayers(12);
    const constraints = [
      createPairingConstraint({
        type: CONSTRAINT_TYPE.PREFER_PARTNER,
        anchorPlayerId: "m1",
        targetPlayerIds: ["m2"],
        mode: "hard",
      }),
    ];
    const pairing = suggestEntriesFromPlayers(players, EVENT_TYPE.MEN_DOUBLE, {
      tournamentId: TOURNAMENT_ID,
      eventId: "event-1",
      pairingConstraints: constraints,
    });
    assert.equal(pairing.length, 6);
    pairing.forEach((entry) => assert.equal((entry.playerIds || []).length, 2));

    const grouping = resolveInternalGroupingEntries({
      eventType: EVENT_TYPE.MEN_DOUBLE,
      previewEntries: pairing,
      selectedPlayers: players,
      pairingOptions: {
        tournamentId: TOURNAMENT_ID,
        eventId: "event-1",
        pairingConstraints: constraints,
      },
    });
    assert.equal(grouping.ok, true);
    assert.equal(grouping.source, "confirmed_preview");
    assert.deepEqual(
      grouping.entries.map((entry) => String(entry.id)).sort(),
      pairing.map((entry) => String(entry.id)).sort()
    );

    const plan = buildPlan({
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
      manualEntries: pairing,
      pairingConstraints: constraints,
    });
    assert.equal(plan.ok, true, plan.errors?.join(" "));
    assertTeamGroups(plan.event, {
      groupCount: 2,
      teamsPerGroup: 3,
      athletesPerGroup: 6,
      totalTeams: 6,
      totalAthletes: 12,
    });
    const groupedTeamIds = listInternalPersistedGroups(plan.event)
      .flatMap((group) => group.entryIds || [])
      .map(String)
      .sort();
    assert.deepEqual(groupedTeamIds, pairing.map((entry) => String(entry.id)).sort());
  });

  it("confirmed pairing preview is dirty and not wiped by hydration", () => {
    const preview = [{ id: "t1|t2", playerIds: ["t1", "t2"], name: "A / B" }];
    const flags = computeInternalSetupDirtyFlags(
      {
        eventType: EVENT_TYPE.MEN_DOUBLE,
        groupCount: 2,
        selectedPlayerIds: ["t1", "t2"],
        previewEntries: preview,
      },
      {
        eventType: EVENT_TYPE.MEN_DOUBLE,
        groupCount: 2,
        selectedPlayerIds: ["t1", "t2"],
        previewEntries: [],
      }
    );
    assert.equal(flags.previewEntries, true);
    const decision = decideInternalSetupHydration({
      tournament: canonicalRowToTournament(makeRow()),
      hydratedTournamentId: TOURNAMENT_ID,
      hydratedEventId: "",
      baselineVersion: 1,
      baselineHydration: {
        eventType: EVENT_TYPE.MEN_SINGLE,
        groupCount: 2,
        selectedPlayerIds: [],
        previewEntries: [],
      },
      form: {
        eventType: EVENT_TYPE.MEN_DOUBLE,
        groupCount: 2,
        selectedPlayerIds: makeMalePlayers(12).map((player) => player.id),
        previewEntries: preview,
        queryEventType: EVENT_TYPE.MEN_SINGLE,
      },
    });
    assert.equal(decision.action, INTERNAL_HYDRATION_ACTION.KEEP_DIRTY);
    assert.equal(decision.apply.eventType, false);
    assert.equal(decision.apply.previewEntries, false);
  });
});
