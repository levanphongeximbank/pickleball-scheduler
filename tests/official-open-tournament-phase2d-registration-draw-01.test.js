/**
 * Phase 2D — registration purity, local player selection, explicit pairing checkpoint.
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
  buildOfficialCompetitionFacts,
  deriveOfficialOrganizerStages,
  OFFICIAL_STAGE_ID,
} from "../src/features/individual-tournament/index.js";
import {
  projectOfficialDrawSubsteps,
  formOfficialIndividualPairs,
  assertOfficialGroupDrawAllowed,
  OFFICIAL_REGISTRATION_LOCAL_SELECTION,
  OFFICIAL_REGISTRATION_FORBIDDEN_LABELS,
} from "../src/features/individual-tournament/engines/officialDrawOrchestrationEngine.js";

function baseTournament(overrides = {}) {
  return {
    id: "t-p2d",
    name: "Official P2D",
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
        groups: [],
        matches: [],
      },
    ],
    ...overrides,
  };
}

function individualPlayers() {
  return [
    { id: "p1", name: "A", gender: "male", rating: 4 },
    { id: "p2", name: "B", gender: "male", rating: 4.2 },
    { id: "p3", name: "C", gender: "male", rating: 3.8 },
    { id: "p4", name: "D", gender: "male", rating: 4.1 },
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

describe("official-open-tournament-phase2d-registration-draw-01", () => {
  it("registration/finalization/setup sources do not mount presentation or group-draw CTAs", () => {
    const setup = readFileSync("src/pages/tournament/OfficialTournamentSetup.jsx", "utf8");
    const reg = readFileSync(
      "src/components/tournament/official/OfficialTournamentRegistrationScreen.jsx",
      "utf8"
    );
    const fin = readFileSync(
      "src/components/tournament/official/OfficialTournamentFinalizeScreen.jsx",
      "utf8"
    );
    for (const label of OFFICIAL_REGISTRATION_FORBIDDEN_LABELS) {
      assert.equal(setup.includes(label), false, `Setup still contains ${label}`);
      assert.equal(reg.includes(label), false);
      assert.equal(fin.includes(label), false);
    }
    assert.equal(reg.includes("Bắt đầu trình chiếu"), false);
    assert.equal(fin.includes("Chia bảng"), false);
    assert.match(setup, /mode="select"/);
    assert.match(setup, /Đăng ký VĐV/);
    assert.doesNotMatch(setup, /mode="register"/);
  });

  it("player selection contract is local-only until explicit register", () => {
    assert.equal(OFFICIAL_REGISTRATION_LOCAL_SELECTION.candidateClickPersistsTournament, false);
    assert.equal(OFFICIAL_REGISTRATION_LOCAL_SELECTION.searchReloadsTournament, false);
    assert.equal(OFFICIAL_REGISTRATION_LOCAL_SELECTION.filterReloadsTournament, false);
    assert.equal(OFFICIAL_REGISTRATION_LOCAL_SELECTION.tabSwitchReloadsTournament, false);
    assert.equal(OFFICIAL_REGISTRATION_LOCAL_SELECTION.explicitRegisterPersists, true);

    const setup = readFileSync("src/pages/tournament/OfficialTournamentSetup.jsx", "utf8");
    assert.match(setup, /handleSelectIndividualCandidate/);
    assert.match(
      setup,
      /const handleSelectIndividualCandidate = \(playerId\) => \{[\s\S]*setSelectedIndividualPlayerId/
    );
    assert.doesNotMatch(
      setup,
      /handleSelectIndividualCandidate[\s\S]{0,200}persistTournament/
    );
    assert.match(setup, /onSearchChange=\{setPickerSearch\}/);
    assert.match(setup, /onGenderFilterChange=\{setPickerGenderFilter\}/);
    assert.match(setup, /onClubFilterChange=\{setOpenClubFilter\}/);
    assert.match(setup, /persistDrawMaterialization/);
  });

  it("doubles + individual: pairing required, group draw locked until pairs persist", () => {
    const t = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    t.events[0].entries = individualPlayers().map((p) => ({
      id: `e-${p.id}`,
      name: p.name,
      playerIds: [p.id],
      status: ENTRY_STATUS.ACTIVE,
    }));
    const sub = projectOfficialDrawSubsteps(t, "ev1");
    assert.equal(sub.pairingRequired, true);
    assert.equal(sub.pairingComplete, false);
    assert.equal(sub.groupDrawReady, false);
    assert.equal(sub.groupsCreated, false);
    assert.equal(assertOfficialGroupDrawAllowed(t, "ev1").ok, false);

    const facts = buildOfficialCompetitionFacts(t);
    assert.equal(facts.draw.needsPairing, true);
    assert.equal(facts.draw.groupDrawReady, false);
    assert.match(facts.draw.substeps.summary, /cần ghép cặp/);
  });

  it("pair action persists pairs without invoking group draw; F5 keeps pairs", () => {
    let t = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    t.events[0].entries = individualPlayers().map((p) => ({
      id: `e-${p.id}`,
      name: p.name,
      playerIds: [p.id],
      status: ENTRY_STATUS.ACTIVE,
    }));

    let pairingCalls = 0;
    let groupCalls = 0;
    const pairingFn = (players) => {
      pairingCalls += 1;
      groupCalls += 0;
      return stubOpenPairing(players);
    };

    const formed = formOfficialIndividualPairs({
      tournament: t,
      eventId: "ev1",
      players: individualPlayers(),
      eventType: EVENT_TYPE.MEN_DOUBLE,
      pairingFn,
      pairingOptions: {},
    });
    assert.equal(formed.ok, true);
    assert.equal(formed.pairingInvoked, 1);
    assert.equal(formed.groupDrawInvoked, 0);
    assert.equal(pairingCalls, 1);
    assert.equal(groupCalls, 0);
    assert.equal(formed.substeps.pairingComplete, true);
    assert.equal(formed.substeps.groupDrawReady, true);
    assert.equal(formed.substeps.groupsCreated, false);
    assert.equal(formed.pairs.length, 2);
    assert.equal(formed.tournament.events[0].entries.length, 4);
    assert.equal(formed.tournament.events[0].entries.every((e) => (e.playerIds || []).length === 1), true);
    assert.equal((formed.tournament.events[0].drawEntries || []).length, 2);

    const hydrated = JSON.parse(JSON.stringify(formed.tournament));
    const afterF5 = projectOfficialDrawSubsteps(hydrated, "ev1");
    assert.equal(afterF5.pairingComplete, true);
    assert.equal(afterF5.groupDrawReady, true);
    assert.equal(afterF5.groupsCreated, false);
    assert.equal(afterF5.formedPairs.length, 2);
    assert.equal(afterF5.eligibleIndividuals.length, 4);
    assert.equal(afterF5.registrationCount, 4);
  });

  it("group draw remains a separate action; pair mode never pairs", () => {
    const pairT = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
    });
    pairT.events[0].entries = [
      {
        id: "pair1",
        name: "A / B",
        playerIds: ["p1", "p2"],
        status: ENTRY_STATUS.ACTIVE,
      },
      {
        id: "pair2",
        name: "C / D",
        playerIds: ["p3", "p4"],
        status: ENTRY_STATUS.ACTIVE,
      },
    ];
    const sub = projectOfficialDrawSubsteps(pairT, "ev1");
    assert.equal(sub.pairingRequired, false);
    assert.equal(sub.groupDrawReady, true);
    assert.equal(assertOfficialGroupDrawAllowed(pairT, "ev1").ok, true);
    assert.equal(assertOfficialGroupDrawAllowed(pairT, "ev1").pairingInvoked, 0);

    const refused = formOfficialIndividualPairs({
      tournament: pairT,
      eventId: "ev1",
      players: individualPlayers(),
      eventType: EVENT_TYPE.MEN_DOUBLE,
      pairingFn: () => {
        throw new Error("pairing must not run in pair mode");
      },
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.pairingInvoked, 0);
    assert.equal(refused.groupDrawInvoked, 0);
  });

  it("pairing failure does not unlock group draw or create groups", () => {
    const t = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    t.events[0].entries = individualPlayers().slice(0, 2).map((p) => ({
      id: `e-${p.id}`,
      name: p.name,
      playerIds: [p.id],
      status: ENTRY_STATUS.ACTIVE,
    }));
    const failed = formOfficialIndividualPairs({
      tournament: t,
      eventId: "ev1",
      players: individualPlayers(),
      eventType: EVENT_TYPE.MEN_DOUBLE,
      pairingFn: () => [],
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.pairingInvoked, 1);
    assert.equal(failed.groupDrawInvoked, 0);
    assert.equal(projectOfficialDrawSubsteps(t, "ev1").groupsCreated, false);
    assert.equal(projectOfficialDrawSubsteps(t, "ev1").pairingComplete, false);
  });

  it("workflow draw summary follows pairing checkpoint", () => {
    const t = patchOfficialCompetitionSettings(baseTournament(), {
      registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
    });
    t.events[0].entries = individualPlayers().map((p) => ({
      id: `e-${p.id}`,
      name: p.name,
      playerIds: [p.id],
      status: ENTRY_STATUS.ACTIVE,
    }));
    const { stages } = deriveOfficialOrganizerStages(t);
    const draw = stages.find((stage) => stage.id === OFFICIAL_STAGE_ID.DRAW);
    assert.match(draw.summary, /cần ghép cặp/);
    assert.equal(draw.primaryAction.id, "form_pairs");
  });
});
