import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  EVENT_TYPE,
  ENTRY_STATUS,
} from "../src/models/tournament/constants.js";
import { deriveGroupDrawModel } from "../src/features/tournament/experience-a1/batchC/deriveGroupDraw.js";
import {
  listOfficialGroupDrawCompetitionUnits,
  projectOfficialGroupDrawUnitMetrics,
} from "../src/features/tournament/official-tournament-experience/groupDrawProjection.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_MATCH_FORMAT,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { ratingMayInfluenceOpenPairingOrDraw } from "../src/features/tournament/official-open-adapter-b/activation.js";
import { hasExplicitDashboardClubId } from "../src/pages/dashboard.logic.js";

function buildOwnerShapeTournament({ mode = TOURNAMENT_MODE.OFFICIAL_TOURNAMENT, officialMode = OFFICIAL_MODE.OPEN } = {}) {
  const players = Array.from({ length: 16 }, (_, i) => ({
    id: `p${i + 1}`,
    name: i < 8 ? `IT421 Nam ${String(i + 1).padStart(2, "0")}` : `TT412-SEED-M${String(i - 7).padStart(2, "0")}`,
  }));
  const entries = players.map((player) => ({
    id: `e-${player.id}`,
    name: player.name,
    status: ENTRY_STATUS.APPROVED,
    playerIds: [player.id],
  }));
  const drawEntries = [];
  for (let i = 0; i < 8; i += 1) {
    const a = players[i * 2];
    const b = players[i * 2 + 1];
    drawEntries.push({
      id: `pair-${i + 1}`,
      name: `${a.name} / ${b.name}`,
      playerIds: [a.id, b.id],
      status: "active",
    });
  }
  const groups = [
    {
      id: "gA",
      label: "A",
      name: "Bảng A",
      entryIds: drawEntries.slice(0, 4).map((entry) => entry.id),
      entries: drawEntries.slice(0, 4),
    },
    {
      id: "gB",
      label: "B",
      name: "Bảng B",
      entryIds: drawEntries.slice(4, 8).map((entry) => entry.id),
      entries: drawEntries.slice(4, 8),
    },
  ];
  return {
    id: "off-o5-remediation",
    name: "Giải đấu 17/8/2026 Test 1",
    mode,
    officialMode,
    status: TOURNAMENT_STATUS.READY,
    events: [
      {
        id: "ev-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries,
        drawEntries,
        groups,
        matches: [],
      },
      {
        id: "ev-b",
        name: "Đôi nữ",
        eventType: EVENT_TYPE.WOMEN_DOUBLE,
        entries: [],
        drawEntries: [],
        groups: [],
        matches: [],
      },
    ],
    settings: {
      officialCompetition: {
        registrationMode: OFFICIAL_REGISTRATION_MODE.INDIVIDUAL,
        scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
        matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
        groupCount: 2,
      },
      draw: { status: "draft" },
    },
  };
}

describe("wave-o5-group-draw-competition-unit-projection-remediation-01", () => {
  it("1-7 Owner shape: 16 players / 8 pair units / progress 8/8 / waiting empty", () => {
    const tournament = buildOwnerShapeTournament();
    const before = JSON.stringify(tournament.events);
    const listed = listOfficialGroupDrawCompetitionUnits(tournament, { selectedEventId: "ev-a" });
    const metrics = projectOfficialGroupDrawUnitMetrics(tournament, { selectedEventId: "ev-a" });
    const model = deriveGroupDrawModel(tournament, { selectedEventId: "ev-a" });

    assert.equal(listed.ok, true);
    assert.equal(listed.units.length, 8);
    assert.equal(listed.playerCount, 16);
    assert.equal(listed.source, "drawEntries");

    assert.equal(metrics.totalUnits, 8);
    assert.equal(metrics.assignedUnits, 8);
    assert.equal(metrics.unassignedUnits, 0);
    assert.equal(metrics.progressNumerator, 8);
    assert.equal(metrics.progressDenominator, 8);
    assert.equal(metrics.drawComplete, true);
    assert.equal(metrics.awaiting.length, 0);
    assert.equal(metrics.playerCount, 16);

    assert.equal(model.expectedTotal, 8);
    assert.equal(model.drawnCount, 8);
    assert.equal(model.awaiting.length, 0);
    assert.equal(model.playerCount, 16);
    assert.equal(model.kpis.units, 8);
    assert.equal(model.kpis.players, 16);
    assert.equal(model.kpis.awaiting, 0);
    assert.equal(model.summary.totalPairs, 8);

    const bốc = model.readinessItems.find((item) => item.label === "Đã bốc xong");
    assert.ok(bốc);
    assert.equal(bốc.ready, true);
    assert.equal(bốc.note, "8/8");

    // No individual player appears as an independent Group Draw unit
    assert.equal(
      listed.units.every((unit) => (unit.playerIds || []).length >= 2),
      true
    );
    assert.equal(
      model.awaiting.every((item) => !/^IT421 Nam \d+$/.test(String(item.name || ""))),
      true
    );

    assert.equal(JSON.stringify(tournament.events), before);
  });

  it("8-13 identity preserved / no mutation on projection", () => {
    const tournament = buildOwnerShapeTournament();
    const groupSnap = JSON.stringify(tournament.events[0].groups);
    const drawSnap = JSON.stringify(tournament.events[0].drawEntries);
    const metrics = projectOfficialGroupDrawUnitMetrics(tournament, { selectedEventId: "ev-a" });
    deriveGroupDrawModel(tournament, { selectedEventId: "ev-a" });
    deriveGroupDrawModel(tournament, { selectedEventId: "ev-a" });

    assert.equal(JSON.stringify(tournament.events[0].groups), groupSnap);
    assert.equal(JSON.stringify(tournament.events[0].drawEntries), drawSnap);
    assert.deepEqual(
      metrics.units.map((unit) => unit.id),
      ["pair-1", "pair-2", "pair-3", "pair-4", "pair-5", "pair-6", "pair-7", "pair-8"]
    );
    metrics.units.forEach((unit) => {
      assert.equal(unit.playerIds.length, 2);
    });
  });

  it("14-16 Open Pair / AI Balance / no events[0]", () => {
    const openPair = buildOwnerShapeTournament();
    openPair.settings.officialCompetition.registrationMode = OFFICIAL_REGISTRATION_MODE.PAIR;
    openPair.events[0].entries = openPair.events[0].drawEntries.map((entry) => ({
      ...entry,
      status: ENTRY_STATUS.APPROVED,
    }));
    openPair.events[0].drawEntries = [];
    const pairListed = listOfficialGroupDrawCompetitionUnits(openPair, { selectedEventId: "ev-a" });
    assert.equal(pairListed.ok, true);
    assert.equal(pairListed.source, "entries");
    assert.equal(pairListed.units.length, 8);

    const ai = buildOwnerShapeTournament({ officialMode: OFFICIAL_MODE.AI_BALANCE });
    const aiListed = listOfficialGroupDrawCompetitionUnits(ai, { selectedEventId: "ev-a" });
    assert.equal(aiListed.source, "drawEntries");
    assert.equal(aiListed.units.length, 8);

    const multi = deriveGroupDrawModel(buildOwnerShapeTournament(), { selectedEventId: "" });
    assert.equal(multi.needsEventChoice, true);
    assert.equal(ratingMayInfluenceOpenPairingOrDraw(), false);
    assert.ok(hasExplicitDashboardClubId("club-a"));
  });

  it("17 officialMode fallback still uses pair units (not 16 players)", () => {
    const weirdMode = buildOwnerShapeTournament({ mode: "official" });
    weirdMode.officialMode = OFFICIAL_MODE.OPEN;
    const model = deriveGroupDrawModel(weirdMode, { selectedEventId: "ev-a" });
    assert.equal(model.official, true);
    assert.equal(model.expectedTotal, 8);
    assert.equal(model.drawnCount, 8);
    assert.equal(model.awaiting.length, 0);
    assert.equal(model.playerCount, 16);
  });
});
