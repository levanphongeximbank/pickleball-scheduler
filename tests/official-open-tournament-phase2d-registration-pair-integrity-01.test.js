/**
 * Phase 2D integrity — individual registration SSOT vs pair materialization.
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
  normalizeTournament,
} from "../src/models/tournament/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  patchOfficialCompetitionSettings,
  projectOfficialFinalizationBuckets,
  getOfficialCompetitionSettings,
} from "../src/features/individual-tournament/index.js";
import {
  formOfficialIndividualPairs,
  projectOfficialDrawSubsteps,
  getOfficialGroupDrawUnits,
  applyOfficialGroupDrawPreservingRegistration,
  listOfficialRegistrationEntries,
  listOfficialDrawEntries,
  OFFICIAL_DRAW_PAIR_ORIGIN,
} from "../src/features/individual-tournament/engines/officialDrawOrchestrationEngine.js";

function sixPlayers() {
  return [
    { id: "p1", name: "A", gender: "male", rating: 4.0, status: ENTRY_STATUS.ACTIVE, source: "system" },
    { id: "p2", name: "B", gender: "male", rating: 4.1, status: ENTRY_STATUS.APPROVED, source: "online" },
    { id: "p3", name: "C", gender: "male", rating: 3.9, status: ENTRY_STATUS.ACTIVE, source: "system" },
    { id: "p4", name: "D", gender: "male", rating: 4.2, status: ENTRY_STATUS.APPROVED, source: "btc" },
    { id: "p5", name: "E", gender: "male", rating: 4.0, status: ENTRY_STATUS.ACTIVE, source: "system" },
    { id: "p6", name: "F", gender: "male", rating: 3.8, status: ENTRY_STATUS.APPROVED, source: "online" },
  ];
}

function baseTournament() {
  const players = sixPlayers();
  return patchOfficialCompetitionSettings(
    {
      id: "t-p2d-integrity",
      name: "Official P2D Integrity",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      officialMode: OFFICIAL_MODE.OPEN,
      status: TOURNAMENT_STATUS.DRAFT,
      settings: {
        officialCompetition: {
          registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        },
        registration: { locked: true },
      },
      events: [
        {
          id: "ev1",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: players.map((p) => ({
            id: `e-${p.id}`,
            name: p.name,
            playerIds: [p.id],
            status: p.status,
            source: p.source,
            sourceLabel: p.source,
          })),
          drawEntries: [],
          groups: [],
          matches: [],
        },
      ],
    },
    { registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL }
  );
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

function pairTournament() {
  const t = baseTournament();
  const formed = formOfficialIndividualPairs({
    tournament: t,
    eventId: "ev1",
    players: sixPlayers(),
    eventType: EVENT_TYPE.MEN_DOUBLE,
    pairingFn: stubOpenPairing,
  });
  assert.equal(formed.ok, true);
  return formed;
}

describe("official-open-tournament-phase2d-registration-pair-integrity-01", () => {
  it("A/B. six individual registrations and statuses remain after pairing", () => {
    const before = baseTournament();
    const beforeEntries = listOfficialRegistrationEntries(before.events[0]);
    const formed = pairTournament();
    const afterEntries = listOfficialRegistrationEntries(formed.tournament.events[0]);

    assert.equal(afterEntries.length, 6);
    assert.equal(beforeEntries.length, 6);
    afterEntries.forEach((entry, index) => {
      assert.equal(String(entry.id), String(beforeEntries[index].id));
      assert.equal(entry.status, beforeEntries[index].status);
      assert.equal(entry.source, beforeEntries[index].source);
      assert.equal((entry.playerIds || []).length, 1);
      assert.notEqual(entry.origin, OFFICIAL_DRAW_PAIR_ORIGIN);
    });
  });

  it("C. finalization projection remains six individuals after pairing", () => {
    const formed = pairTournament();
    const buckets = projectOfficialFinalizationBuckets(formed.tournament, "ev1");
    assert.equal(buckets.counts.eligible, 6);
    assert.equal(buckets.eligible.every((e) => (e.playerIds || []).length === 1), true);
    assert.equal(buckets.eligible.some((e) => (e.playerIds || []).length >= 2), false);
  });

  it("D/E. draw projection is three pairs and zero groups", () => {
    const formed = pairTournament();
    const sub = projectOfficialDrawSubsteps(formed.tournament, "ev1");
    assert.equal(sub.pairingComplete, true);
    assert.equal(sub.groupDrawReady, true);
    assert.equal(sub.formedPairs.length, 3);
    assert.equal(sub.groupsCreated, false);
    assert.equal(sub.groupCount, 0);
    assert.equal(listOfficialDrawEntries(formed.tournament.events[0]).length, 3);
  });

  it("F. F5-equivalent hydration preserves 6/6/3/0", () => {
    const formed = pairTournament();
    const hydrated = normalizeTournament(JSON.parse(JSON.stringify(formed.tournament)));
    const entries = listOfficialRegistrationEntries(hydrated.events[0]);
    const buckets = projectOfficialFinalizationBuckets(hydrated, "ev1");
    const sub = projectOfficialDrawSubsteps(hydrated, "ev1");

    assert.equal(entries.length, 6);
    assert.equal(entries.every((e) => (e.playerIds || []).length === 1), true);
    assert.equal(buckets.counts.eligible, 6);
    assert.equal(sub.formedPairs.length, 3);
    assert.equal(sub.groupCount, 0);
    assert.equal(sub.groupsCreated, false);
    assert.equal((hydrated.events[0].groups || []).length, 0);
  });

  it("G. group draw consumes the three generated pairs, not raw individuals", () => {
    const formed = pairTournament();
    const units = getOfficialGroupDrawUnits(formed.tournament, "ev1");
    assert.equal(units.ok, true);
    assert.equal(units.source, "drawEntries");
    assert.equal(units.units.length, 3);
    assert.equal(units.units.every((u) => (u.playerIds || []).length === 2), true);
    assert.equal(units.pairingInvoked, 0);

    const plannedEvent = {
      ...formed.tournament.events[0],
      entries: units.units,
      groups: [
        { id: "gA", label: "A", entries: units.units.slice(0, 2), entryIds: units.units.slice(0, 2).map((u) => u.id) },
        { id: "gB", label: "B", entries: units.units.slice(2), entryIds: units.units.slice(2).map((u) => u.id) },
      ],
      matches: [{ id: "m1", entryAId: units.units[0].id, entryBId: units.units[1].id }],
    };
    const applied = applyOfficialGroupDrawPreservingRegistration(formed.tournament, plannedEvent);
    assert.equal(applied.ok, true);
    const regs = listOfficialRegistrationEntries(applied.event);
    assert.equal(regs.length, 6);
    assert.equal(regs.every((e) => (e.playerIds || []).length === 1), true);
    assert.equal(listOfficialDrawEntries(applied.event).length, 3);
    assert.equal((applied.event.groups || []).length, 2);
  });

  it("H. Draw → Registration still renders individual mode", () => {
    const formed = pairTournament();
    const competition = getOfficialCompetitionSettings(formed.tournament);
    assert.equal(competition.registrationMode, OFFICIAL_REGISTRATION_MODE.INDIVIDUAL);
    assert.equal(formed.tournament.settings.registration.locked, true);

    const regSrc = readFileSync(
      "src/components/tournament/official/OfficialTournamentRegistrationScreen.jsx",
      "utf8"
    );
    assert.match(regSrc, /OFFICIAL_REGISTRATION_MODE\.PAIR/);
    assert.match(regSrc, /event\?\.entries/);
    assert.doesNotMatch(regSrc, /drawEntries/);
    assert.match(regSrc, /Danh sách VĐV đăng ký/);
  });

  it("I. generated pairs are not fabricated as registration records", () => {
    const formed = pairTournament();
    const regs = listOfficialRegistrationEntries(formed.tournament.events[0]);
    const draw = listOfficialDrawEntries(formed.tournament.events[0]);
    assert.equal(regs.some((e) => e.origin === OFFICIAL_DRAW_PAIR_ORIGIN), false);
    assert.equal(draw.every((e) => e.origin === OFFICIAL_DRAW_PAIR_ORIGIN), true);
    assert.equal(draw.every((e) => e.registrationRecord === false), true);
    assert.equal(regs.some((e) => (e.playerIds || []).length >= 2), false);

    const setup = readFileSync("src/pages/tournament/OfficialTournamentSetup.jsx", "utf8");
    assert.match(setup, /persistDrawMaterialization/);
    assert.match(setup, /handleFormOfficialPairs[\s\S]*persistDrawMaterialization/);
  });
});
