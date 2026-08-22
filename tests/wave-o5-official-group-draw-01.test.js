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
import { deriveGroupDrawModel } from "../src/features/tournament/experience-a1/batchC/deriveGroupDraw.js";
import {
  OFFICIAL_EXPERIENCE_AUTHORITY,
  resolveOfficialCanonicalOpenPath,
  officialLegacySetupPath,
  buildOfficialFormPairsPatch,
  buildOfficialCreateGroupDrawPatch,
  buildOfficialLockGroupDrawPatch,
  buildOfficialPublishGroupDrawPatch,
  buildOfficialPresentGroupDraw,
  buildOfficialRegenerateGroupDrawPatch,
  resolveOfficialGroupDrawDownstreamGuards,
  projectOfficialGroupDraw,
} from "../src/features/tournament/official-tournament-experience/index.js";
import {
  OFFICIAL_GROUP_DRAW_AUTHORITY,
  resolveOfficialGroupDrawDispatch,
} from "../src/features/individual-tournament/engines/officialCompetitionStrategyEngine.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_MATCH_FORMAT,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { ratingMayInfluenceOpenPairingOrDraw } from "../src/features/tournament/official-open-adapter-b/activation.js";
import { hasExplicitDashboardClubId } from "../src/pages/dashboard.logic.js";
import { suggestBalancedEntriesFromIndividuals } from "../src/tournament/engines/teamPairingEngine.js";

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
    id: "off-o5",
    name: "Official O5",
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
          { id: "e5", name: "P5", status: ENTRY_STATUS.APPROVED, playerIds: ["p5"] },
          { id: "e6", name: "P6", status: ENTRY_STATUS.APPROVED, playerIds: ["p6"] },
          { id: "e7", name: "P7", status: ENTRY_STATUS.APPROVED, playerIds: ["p7"] },
          { id: "e8", name: "P8", status: ENTRY_STATUS.APPROVED, playerIds: ["p8"] },
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
  const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
  const built = buildOfficialFormPairsPatch(tournament, {
    selectedEventId: "ev-a",
    players: makePlayers(ids),
  });
  assert.equal(built.ok, true);
  return { ...tournament, events: built.patch.events };
}

describe("wave-o5-official-group-draw-01", () => {
  it("1-6 Screen 08 route / event scope / no pair formation", () => {
    const page = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualGroupDrawRoomPage.jsx"),
      "utf8"
    );
    assert.ok(page.includes('TEST_ID = "tournament-group-draw-page"'));
    assert.ok(page.includes("createGroupDraw"));
    assert.ok(page.includes("official-group-draw-create"));
    assert.equal(page.includes("events[0]"), false);
    assert.equal(page.includes("suggestBalancedEntriesFromIndividuals"), false);
    assert.equal(page.includes("formOfficialIndividualPairs"), false);

    const multi = withFormedPairs(officialBase());
    const needs = deriveGroupDrawModel(multi, { selectedEventId: "" });
    assert.equal(needs.needsEventChoice, true);
    assert.equal(needs.createEnabled, false);
    assert.ok(needs.blocker);
  });

  it("7-13 rating-neutral Group Draw for Open / Pair / AI Balance", () => {
    assert.equal(ratingMayInfluenceOpenPairingOrDraw(), false);
    const dispatch = resolveOfficialGroupDrawDispatch({ officialMode: OFFICIAL_MODE.AI_BALANCE });
    assert.equal(dispatch.groupDrawAuthority, OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM);
    assert.equal(dispatch.usesRating, false);

    const open = withFormedPairs(officialBase({ officialMode: OFFICIAL_MODE.OPEN }));
    const created = buildOfficialCreateGroupDrawPatch(open, {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]),
      randomFn: () => 0.42,
    });
    assert.equal(created.ok, true);
    assert.equal(created.usesRating, false);
    assert.equal(created.groupDrawAuthority, OFFICIAL_GROUP_DRAW_AUTHORITY.OPEN_RANDOM);
    assert.equal(created.strippedMatches, true);
    assert.ok(created.groups.length >= 2);
    const event = created.patch.events.find((item) => item.id === "ev-a");
    assert.deepEqual(event.matches, []);
    assert.equal(event.entries.length, 8);
    assert.ok(event.drawEntries.length >= 4);

    const ai = withFormedPairs(officialBase({ officialMode: OFFICIAL_MODE.AI_BALANCE }));
    const aiCreated = buildOfficialCreateGroupDrawPatch(ai, {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]),
      randomFn: () => 0.17,
    });
    assert.equal(aiCreated.ok, true);
    assert.equal(aiCreated.usesRating, false);
    assert.equal(aiCreated.patch.officialMode, OFFICIAL_MODE.AI_BALANCE);

    // AI Balance pairing writer must not be invoked by group draw module
    const projSrc = readFileSync(
      path.join(root, "src/features/tournament/official-tournament-experience/groupDrawProjection.js"),
      "utf8"
    );
    assert.equal(projSrc.includes("suggestBalancedEntriesFromIndividuals"), false);
    assert.equal(projSrc.includes("buildOfficialAiBalancePlan"), false);
    assert.ok(projSrc.includes("buildOfficialOpenPlan"));
    void suggestBalancedEntriesFromIndividuals;
  });

  it("14-19 create / identity / no load mutation", () => {
    const formed = withFormedPairs(officialBase());
    const before = JSON.stringify(formed);
    deriveGroupDrawModel(formed, { selectedEventId: "ev-a" });
    projectOfficialGroupDraw(formed, { selectedEventId: "ev-a" });
    assert.equal(JSON.stringify(formed), before);

    const created = buildOfficialCreateGroupDrawPatch(formed, {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]),
      randomFn: () => 0.5,
    });
    assert.equal(created.ok, true);
    const event = created.patch.events.find((item) => item.id === "ev-a");
    const memberIds = event.groups.flatMap((group) =>
      (group.entries || []).map((entry) => String(entry.id))
    );
    assert.ok(memberIds.every((id) => id && !id.includes(" ")));
    event.groups.forEach((group) => {
      (group.entries || []).forEach((entry) => {
        assert.ok(Array.isArray(entry.playerIds) && entry.playerIds.length === 2);
      });
    });
    assert.ok(created.persistedFields.includes("events[].groups"));
  });

  it("20-25 lock / publish do not generate schedule/matches", () => {
    const formed = withFormedPairs(officialBase());
    const created = buildOfficialCreateGroupDrawPatch(formed, {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]),
      randomFn: () => 0.33,
    });
    const afterCreate = { ...formed, ...created.patch, events: created.patch.events };
    const locked = buildOfficialLockGroupDrawPatch(afterCreate, {
      selectedEventId: "ev-a",
      userId: "u1",
    });
    assert.equal(locked.ok, true);
    assert.equal(Object.keys(locked.patch).join(","), "settings");
    assert.equal(locked.drawPublish.status, "locked");

    const afterLock = {
      ...afterCreate,
      settings: locked.patch.settings,
    };
    const published = buildOfficialPublishGroupDrawPatch(afterLock, {
      selectedEventId: "ev-a",
      userId: "u1",
    });
    assert.equal(published.ok, true);
    assert.equal(published.mutatesMatches, false);
    assert.equal(published.mutatesSchedule, false);
    assert.equal(published.drawPublish.status, "published");
  });

  it("26-38 redraw / downstream / presentation", () => {
    const formed = withFormedPairs(officialBase());
    const created = buildOfficialCreateGroupDrawPatch(formed, {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]),
      randomFn: () => 0.2,
    });
    const withGroups = { ...formed, ...created.patch, events: created.patch.events };

    const present = buildOfficialPresentGroupDraw(withGroups, { selectedEventId: "ev-a" });
    assert.equal(present.ok, true);
    assert.equal(present.mutates, false);
    const snap = JSON.stringify(withGroups.events);
    buildOfficialPresentGroupDraw(withGroups, { selectedEventId: "ev-a" });
    assert.equal(JSON.stringify(withGroups.events), snap);

    const withMatches = {
      ...withGroups,
      events: withGroups.events.map((event) =>
        event.id === "ev-a"
          ? {
              ...event,
              matches: [{ id: "m1", status: "scheduled", entryAId: "x", entryBId: "y" }],
            }
          : event
      ),
    };
    const blocked = buildOfficialRegenerateGroupDrawPatch(withMatches, {
      selectedEventId: "ev-a",
      players: makePlayers(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]),
    });
    assert.equal(blocked.ok, false);
    assert.ok(
      blocked.code === "MATCHES_EXIST" ||
        (blocked.blockers || []).some((item) => item.code === "MATCHES_EXIST")
    );

    const withResults = {
      ...withGroups,
      events: withGroups.events.map((event) =>
        event.id === "ev-a"
          ? {
              ...event,
              matches: [{ id: "m1", status: "completed", scoreA: 11, scoreB: 5 }],
            }
          : event
      ),
    };
    const guards = resolveOfficialGroupDrawDownstreamGuards(
      withResults,
      withResults.events.find((event) => event.id === "ev-a")
    );
    assert.equal(guards.ok, false);
    assert.ok(guards.blockers.some((item) => item.code === "RESULTS_EXIST"));
  });

  it("39-55 regression / shell / dashboard", () => {
    assert.equal(resolveOfficialCanonicalOpenPath({ id: "off-o5" }), "/tournament/off-o5/overview");
    assert.ok(officialLegacySetupPath("off-o5").includes("experience=legacy"));
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT, "CORE-13");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE, "CORE-15");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.SCORING, "CORE-16");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT, "CORE-17");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.COURT, "canonical-court-authority");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_GROUP_DRAW, "official-open-group-draw-engines");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_SCHEDULE, "official-open-schedule-engines");

    const adapter = resolveTournamentExperienceAdapter(withFormedPairs(officialBase()), {
      selectedEventId: "ev-a",
    });
    assert.equal(adapter.wave, "O6");
    assert.equal(typeof adapter.commands.createGroupDraw, "function");
    assert.equal(typeof adapter.commands.lockGroupDraw, "function");
    assert.equal(typeof adapter.commands.publishGroupDraw, "function");
    assert.equal(typeof adapter.commands.publishSchedule, "function");
    assert.equal(adapter.commands.scoreMatch, null);

    const page = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualGroupDrawRoomPage.jsx"),
      "utf8"
    );
    assert.ok(page.includes("ExperienceDrawRoomShell"));
    assert.equal(page.includes("OfficialTournamentTheme"), false);
    assert.ok(hasExplicitDashboardClubId("club-a"));
    assert.equal(hasExplicitDashboardClubId(""), false);
  });
});
