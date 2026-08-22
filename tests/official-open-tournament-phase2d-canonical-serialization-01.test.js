/**
 * Phase 2D — prove event.drawEntries survives the real canonical cloud path:
 * updateTournamentCommand → tournamentToCanonicalRow → RPC payload
 * → canonicalRowToTournament → getTournamentQuery (useCanonicalTournament read).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, beforeEach, afterEach } from "node:test";

import { setActiveClubId, loadClubs, saveClubs, DEFAULT_CLUB } from "../src/data/club.js";
import {
  createTournamentCommand,
  updateTournamentCommand,
  getTournamentQuery,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
} from "../src/features/tournament/index.js";
import {
  tournamentToCanonicalRow,
  canonicalRowToTournament,
} from "../src/features/tournament/mappers/canonicalTournamentMapper.js";
import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  EVENT_TYPE,
  ENTRY_STATUS,
} from "../src/models/tournament/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  patchOfficialCompetitionSettings,
  getOfficialCompetitionSettings,
  formOfficialIndividualPairs,
  getOfficialGroupDrawUnits,
  applyOfficialGroupDrawPreservingRegistration,
  listOfficialRegistrationEntries,
  listOfficialDrawEntries,
  OFFICIAL_DRAW_PAIR_ORIGIN,
} from "../src/features/individual-tournament/index.js";

const TENANT_ID = "tenant-p2d-serialization-01";
const CLUB_SCOPE = { id: DEFAULT_CLUB.id, tenantId: TENANT_ID, venueId: TENANT_ID };

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
  };
}

function sixPlayers() {
  return [
    { id: "p1", name: "A", gender: "male", rating: 4.0 },
    { id: "p2", name: "B", gender: "male", rating: 4.1 },
    { id: "p3", name: "C", gender: "male", rating: 3.9 },
    { id: "p4", name: "D", gender: "male", rating: 4.2 },
    { id: "p5", name: "E", gender: "male", rating: 4.0 },
    { id: "p6", name: "F", gender: "male", rating: 3.8 },
  ];
}

function stubOpenPairing(players) {
  const out = [];
  for (let i = 0; i + 1 < players.length; i += 2) {
    const a = players[i];
    const b = players[i + 1];
    out.push({
      id: `pair-${a.id}-${b.id}`,
      name: `${a.name} / ${b.name}`,
      playerIds: [String(a.id), String(b.id)],
      status: ENTRY_STATUS.ACTIVE,
      rating: 4,
    });
  }
  return out;
}

function assertRegistrationVsPairs(tournament) {
  const event = tournament.events[0];
  const regs = listOfficialRegistrationEntries(event);
  const pairs = listOfficialDrawEntries(event);
  assert.equal(regs.length, 6);
  assert.equal(pairs.length, 3);
  assert.equal(regs.every((e) => (e.playerIds || []).length === 1), true);
  assert.equal(regs.some((e) => e.origin === OFFICIAL_DRAW_PAIR_ORIGIN), false);
  assert.equal(pairs.every((e) => (e.playerIds || []).length === 2), true);
  assert.equal(
    getOfficialCompetitionSettings(tournament).registrationMode,
    OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
  );
}

describe("official-open-tournament-phase2d-canonical-serialization-01", () => {
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

  it("mapper payload carries event.drawEntries (not a column whitelist drop)", () => {
    const mapperSrc = readFileSync(
      "src/features/tournament/mappers/canonicalTournamentMapper.js",
      "utf8"
    );
    assert.match(mapperSrc, /\.\.\.rest/);
    assert.match(mapperSrc, /payload:\s*\{/);
    assert.doesNotMatch(mapperSrc, /events:\s*payload\.events\.map/);
    assert.doesNotMatch(
      mapperSrc,
      /entries:\s*event\.entries,\s*groups:\s*event\.groups/
    );

    const eventJs = readFileSync("src/models/tournament/event.js", "utf8");
    assert.match(eventJs, /drawEntries:\s*normalizeEntries\(event\.drawEntries/);
  });

  it("cloud update/get roundtrip keeps 6 registrations + 3 drawEntries + 0 groups", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      name: "P2D Serialization",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
    });
    assert.equal(created.ok, true);

    const players = sixPlayers();
    const withRegs = patchOfficialCompetitionSettings(
      {
        ...created.tournament,
        events: [
          {
            id: "ev1",
            name: "Đôi nam",
            eventType: EVENT_TYPE.MEN_DOUBLE,
            entries: players.map((p) => ({
              id: `e-${p.id}`,
              name: p.name,
              playerIds: [p.id],
              status: ENTRY_STATUS.ACTIVE,
            })),
            drawEntries: [],
            groups: [],
            matches: [],
          },
        ],
      },
      { registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL }
    );

    const formed = formOfficialIndividualPairs({
      tournament: withRegs,
      eventId: "ev1",
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      pairingFn: stubOpenPairing,
    });
    assert.equal(formed.ok, true);
    assert.equal(formed.tournament.events[0].groups.length, 0);

    const row = tournamentToCanonicalRow(formed.tournament, {
      tenantId: TENANT_ID,
      clubId: DEFAULT_CLUB.id,
    });
    assert.equal((row.payload.events[0].entries || []).length, 6);
    assert.equal((row.payload.events[0].drawEntries || []).length, 3);
    assert.equal((row.payload.events[0].groups || []).length, 0);

    const fromRow = canonicalRowToTournament({
      ...row,
      id: created.tournament.id,
      tenant_id: TENANT_ID,
      club_id: DEFAULT_CLUB.id,
    });
    assertRegistrationVsPairs(fromRow);
    assert.equal((fromRow.events[0].groups || []).length, 0);

    const saved = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      events: formed.tournament.events,
      settings: formed.tournament.settings,
      officialMode: OFFICIAL_MODE.OPEN,
      status: TOURNAMENT_STATUS.DRAFT,
    });
    assert.equal(saved.ok, true);
    assertRegistrationVsPairs(saved.tournament);
    assert.equal((saved.tournament.events[0].groups || []).length, 0);

    const loaded = await getTournamentQuery(CLUB_SCOPE, created.tournament.id);
    assert.equal(loaded.ok, true);
    assertRegistrationVsPairs(loaded.tournament);
    assert.equal((loaded.tournament.events[0].groups || []).length, 0);
  });

  it("group-draw mapper roundtrip keeps 6 entries + 3 drawEntries + groups > 0", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      name: "P2D Group Draw Serialization",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
    });
    assert.equal(created.ok, true);

    const players = sixPlayers();
    const withRegs = patchOfficialCompetitionSettings(
      {
        ...created.tournament,
        events: [
          {
            id: "ev1",
            name: "Đôi nam",
            eventType: EVENT_TYPE.MEN_DOUBLE,
            entries: players.map((p) => ({
              id: `e-${p.id}`,
              name: p.name,
              playerIds: [p.id],
              status: ENTRY_STATUS.ACTIVE,
            })),
            drawEntries: [],
            groups: [],
            matches: [],
          },
        ],
      },
      { registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL }
    );
    const formed = formOfficialIndividualPairs({
      tournament: withRegs,
      eventId: "ev1",
      players,
      eventType: EVENT_TYPE.MEN_DOUBLE,
      pairingFn: stubOpenPairing,
    });
    const pairedSave = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      events: formed.tournament.events,
      settings: formed.tournament.settings,
    });
    assert.equal(pairedSave.ok, true);

    const units = getOfficialGroupDrawUnits(pairedSave.tournament, "ev1");
    assert.equal(units.ok, true);
    assert.equal(units.source, "drawEntries");
    assert.equal(units.units.length, 3);

    const plannedEvent = {
      ...pairedSave.tournament.events[0],
      entries: units.units,
      groups: [
        {
          id: "gA",
          label: "A",
          entries: units.units.slice(0, 2),
          entryIds: units.units.slice(0, 2).map((u) => u.id),
        },
        {
          id: "gB",
          label: "B",
          entries: units.units.slice(2),
          entryIds: units.units.slice(2).map((u) => u.id),
        },
      ],
      matches: [{ id: "m1", entryAId: units.units[0].id, entryBId: units.units[1].id }],
    };
    const applied = applyOfficialGroupDrawPreservingRegistration(
      pairedSave.tournament,
      plannedEvent
    );
    assert.equal(applied.ok, true);

    const afterDraw = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      events: applied.tournament.events,
    });
    assert.equal(afterDraw.ok, true);
    assertRegistrationVsPairs(afterDraw.tournament);
    assert.ok((afterDraw.tournament.events[0].groups || []).length > 0);

    const reloaded = await getTournamentQuery(CLUB_SCOPE, created.tournament.id);
    assert.equal(reloaded.ok, true);
    assertRegistrationVsPairs(reloaded.tournament);
    assert.ok((reloaded.tournament.events[0].groups || []).length > 0);
    assert.equal(listOfficialDrawEntries(reloaded.tournament.events[0]).length, 3);
  });
});
