import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  OFFICIAL_MODE,
  EVENT_TYPE,
  ENTRY_STATUS,
} from "../src/models/tournament/constants.js";
import { resolveTournamentExperienceAdapter } from "../src/features/tournament/experience-a1/experienceModeResolver.js";
import { derivePairDrawModel } from "../src/features/tournament/experience-a1/batchC/derivePairDraw.js";
import {
  PAIR_FORMATION_MODE,
  OFFICIAL_EXPERIENCE_AUTHORITY,
  resolveOfficialCanonicalOpenPath,
  officialLegacySetupPath,
  listOfficialPairDrawUnits,
  buildOfficialPresentPairDraw,
  resolveOfficialPairDrawMutationGuards,
  buildOfficialFormPairsPatch,
} from "../src/features/tournament/official-tournament-experience/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_MATCH_FORMAT,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { hasExplicitDashboardClubId } from "../src/pages/dashboard.logic.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makePlayers(ids) {
  return ids.map((id, index) => ({
    id,
    name: `Player ${id}`,
    gender: "male",
    level: 3 + (index % 3) * 0.5,
    rating: 1000 + index * 50,
  }));
}

function officialBase(overrides = {}) {
  return {
    id: "off-o4",
    name: "Official O4",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.READY,
    tenantId: "tenant-a",
    clubId: "club-a",
    events: [
      {
        id: "ev-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [
          { id: "e1", name: "P1", status: ENTRY_STATUS.APPROVED, playerIds: ["p1"] },
          { id: "e2", name: "P2", status: ENTRY_STATUS.APPROVED, playerIds: ["p2"] },
          { id: "e3", name: "P3", status: ENTRY_STATUS.APPROVED, playerIds: ["p3"] },
          { id: "e4", name: "P4", status: ENTRY_STATUS.APPROVED, playerIds: ["p4"] },
        ],
        drawEntries: [],
        groups: [],
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
    ...overrides,
  };
}

function withFormedPairs(tournament) {
  const built = buildOfficialFormPairsPatch(tournament, {
    selectedEventId: "ev-a",
    players: makePlayers(["p1", "p2", "p3", "p4"]),
  });
  assert.equal(built.ok, true);
  return { ...tournament, events: built.patch.events };
}

describe("wave-o4-official-pair-draw-01", () => {
  it("1-6 Screen 07 route / event scope / no auto formation", () => {
    const page = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualPairDrawRoomPage.jsx"),
      "utf8"
    );
    assert.ok(page.includes('TEST_ID = "tournament-pair-draw-page"'));
    assert.ok(page.includes("presentPairDraw"));
    assert.ok(page.includes("official-pair-draw-present"));
    assert.equal(page.includes("events[0]"), false);
    assert.equal(page.includes("buildOfficialFormPairsPatch"), false);
    assert.equal(page.includes("formOfficialIndividualPairs"), false);

    const multi = officialBase();
    const needs = derivePairDrawModel(multi, { selectedEventId: "" });
    assert.equal(needs.needsEventChoice, true);
    assert.equal(needs.presentEnabled, false);
    assert.ok(needs.blocker);

    const missing = listOfficialPairDrawUnits(multi, { selectedEventId: "ev-a" });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "UNITS_MISSING");
    assert.deepEqual(multi.events[0].drawEntries, []);
  });

  it("7-12 Open Individual membership preserved", () => {
    const formed = withFormedPairs(officialBase());
    const before = JSON.parse(JSON.stringify(formed.events[0].drawEntries));
    const listed = listOfficialPairDrawUnits(formed, { selectedEventId: "ev-a" });
    assert.equal(listed.ok, true);
    assert.equal(listed.source, "drawEntries");
    assert.equal(listed.modeResolution.mode, PAIR_FORMATION_MODE.RANDOM_PAIRING);

    const model = derivePairDrawModel(formed, { selectedEventId: "ev-a" });
    assert.equal(model.official, true);
    assert.equal(model.presentEnabled, true);
    assert.equal(model.ledger.length, before.length);
    model.ledger.forEach((row, index) => {
      assert.deepEqual([...row.playerIds].sort(), [...before[index].playerIds].map(String).sort());
      assert.equal(row.id, before[index].id);
    });

    const present = buildOfficialPresentPairDraw(formed, { selectedEventId: "ev-a" });
    assert.equal(present.ok, true);
    assert.equal(present.mutates, false);
    assert.deepEqual(
      present.units.map((u) => [...u.playerIds].sort().join("+")).sort(),
      before.map((u) => [...u.playerIds].map(String).sort().join("+")).sort()
    );
    assert.deepEqual(formed.events[0].drawEntries, before);
  });

  it("13-16 mutation safety + presentation does not mutate", () => {
    const formed = withFormedPairs(officialBase());
    const snapshot = JSON.stringify(formed);
    derivePairDrawModel(formed, { selectedEventId: "ev-a" });
    buildOfficialPresentPairDraw(formed, { selectedEventId: "ev-a" });
    derivePairDrawModel(formed, { selectedEventId: "ev-b" });
    assert.equal(JSON.stringify(formed), snapshot);

    const adapter = resolveTournamentExperienceAdapter(formed, { selectedEventId: "ev-a" });
    assert.equal(adapter.wave, "O4");
    assert.equal(typeof adapter.commands.presentPairDraw, "function");
    assert.equal(adapter.commands.createPairDraw, null);
    assert.equal(adapter.commands.lockPairDraw, null);
    assert.equal(adapter.commands.publishPairDraw, null);
    assert.equal(adapter.commands.regeneratePairDraw, null);
    assert.equal(adapter.commands.runGroupDraw, null);
  });

  it("16-20 OPEN PAIR + AI Balance membership", () => {
    const openPair = officialBase({
      events: [
        {
          id: "ev-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            {
              id: "pair-1",
              name: "A / B",
              status: ENTRY_STATUS.ACTIVE,
              playerIds: ["p1", "p2"],
            },
            {
              id: "pair-2",
              name: "C / D",
              status: ENTRY_STATUS.ACTIVE,
              playerIds: ["p3", "p4"],
            },
          ],
          drawEntries: [],
          groups: [],
          matches: [],
        },
      ],
      settings: {
        officialCompetition: {
          registrationMode: OFFICIAL_REGISTRATION_MODE.PAIR,
          scoringMethod: OFFICIAL_SCORING_METHOD.RALLY,
          matchFormat: OFFICIAL_MATCH_FORMAT.BEST_OF_1,
          groupCount: 2,
        },
        draw: { status: "draft" },
      },
    });
    const listed = listOfficialPairDrawUnits(openPair, { selectedEventId: "ev-a" });
    assert.equal(listed.ok, true);
    assert.equal(listed.source, "entries");
    assert.equal(listed.modeResolution.mode, PAIR_FORMATION_MODE.REGISTERED_PAIRS);
    assert.deepEqual(listed.units[0].playerIds, ["p1", "p2"]);

    const ai = withFormedPairs(officialBase({ officialMode: OFFICIAL_MODE.AI_BALANCE }));
    const aiListed = listOfficialPairDrawUnits(ai, { selectedEventId: "ev-a" });
    assert.equal(aiListed.ok, true);
    assert.equal(aiListed.modeResolution.mode, PAIR_FORMATION_MODE.AI_BALANCE_PAIRING);
    assert.equal(aiListed.source, "drawEntries");
  });

  it("21-29 downstream guards + no invent writers", () => {
    const formed = withFormedPairs(officialBase());
    const withGroups = {
      ...formed,
      events: formed.events.map((event) =>
        event.id === "ev-a" ? { ...event, groups: [{ id: "g1", name: "A" }] } : event
      ),
      settings: { ...formed.settings, draw: { status: "published" } },
    };
    const guards = resolveOfficialPairDrawMutationGuards(withGroups, {
      selectedEventId: "ev-a",
    });
    assert.equal(guards.pairDrawWriterExists, false);
    assert.equal(guards.canMutatePairMembership, false);
    assert.equal(guards.canRegenerate, false);
    assert.equal(guards.canLock, false);
    assert.equal(guards.canPublish, false);
    assert.ok(guards.blockers.some((item) => item.code === "GROUPS_EXIST"));

    const present = buildOfficialPresentPairDraw(withGroups, { selectedEventId: "ev-a" });
    assert.equal(present.ok, true);
    assert.equal(present.mutates, false);
  });

  it("30-51 identity / regression / dashboard remediation", () => {
    assert.equal(resolveOfficialCanonicalOpenPath({ id: "off-o4" }), "/tournament/off-o4/overview");
    assert.ok(officialLegacySetupPath("off-o4").includes("experience=legacy"));
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT, "CORE-13");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE, "CORE-15");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.SCORING, "CORE-16");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT, "CORE-17");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.COURT, "canonical-court-authority");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_PAIRING, "official-open-pairing-engines");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_GROUP_DRAW, "official-open-group-draw-engines");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SCHEDULE, "official-open-schedule-engines");

    const page = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualPairDrawRoomPage.jsx"),
      "utf8"
    );
    assert.ok(page.includes("ExperienceDrawRoomShell"));
    assert.ok(page.includes("TournamentAnimationDialog"));
    assert.equal(page.includes("OfficialTournamentTheme"), false);
    assert.equal(page.includes("clubs[0]"), false);

    const dash = readFileSync(path.join(root, "src/pages/Dashboard.jsx"), "utf8");
    assert.ok(dash.includes("hasExplicitDashboardClubId"));
    assert.equal(hasExplicitDashboardClubId(""), false);
    assert.equal(hasExplicitDashboardClubId("club-a"), true);

    const storage = readFileSync(path.join(root, "src/ai/storage.js"), "utf8");
    assert.ok(storage.includes("assertExplicitClubId"));
  });
});
