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
  MATCH_STATUS,
} from "../src/models/tournament/constants.js";
import { resolveTournamentExperienceAdapter } from "../src/features/tournament/experience-a1/experienceModeResolver.js";
import { deriveGroupStageModel } from "../src/features/tournament/experience-a1/batchC/deriveGroupStage.js";
import { deriveScheduleModel } from "../src/features/tournament/experience-a1/batchD/deriveSchedule.js";
import { deriveMatchCenterModel } from "../src/features/tournament/experience-a1/batchD/deriveMatchCenter.js";
import { deriveStandingsModel } from "../src/features/tournament/experience-a1/batchD/deriveStandings.js";
import {
  OFFICIAL_EXPERIENCE_AUTHORITY,
  buildOfficialCreateGroupMatchesPatch,
  buildOfficialAssignGroupSchedulePatch,
  projectOfficialGroupStage,
  projectOfficialSchedule,
  projectOfficialMatchCenter,
  projectOfficialStandings,
  projectOfficialMatchIdentity,
  listOfficialGroupDrawCompetitionUnits,
} from "../src/features/tournament/official-tournament-experience/index.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_MATCH_FORMAT,
} from "../src/features/individual-tournament/engines/officialTournamentSettingsEngine.js";
import { hasExplicitDashboardClubId } from "../src/pages/dashboard.logic.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makePairs() {
  const players = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
  }));
  const entries = players.map((p) => ({
    id: `e-${p.id}`,
    name: p.name,
    status: ENTRY_STATUS.APPROVED,
    playerIds: [p.id],
  }));
  const drawEntries = [];
  for (let i = 0; i < 4; i += 1) {
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
      entryIds: drawEntries.slice(0, 2).map((e) => e.id),
      entries: drawEntries.slice(0, 2),
      matches: [],
    },
    {
      id: "gB",
      label: "B",
      name: "Bảng B",
      entryIds: drawEntries.slice(2, 4).map((e) => e.id),
      entries: drawEntries.slice(2, 4),
      matches: [],
    },
  ];
  return { entries, drawEntries, groups, players };
}

function officialBase(overrides = {}) {
  const { entries, drawEntries, groups } = makePairs();
  return {
    id: "off-o6",
    name: "Official O6",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.OPEN,
    status: TOURNAMENT_STATUS.READY,
    courts: [
      { id: "c1", name: "Sân 1", number: 1, active: true },
      { id: "c2", name: "Sân 2", number: 2, active: true },
    ],
    courtSchedule: {
      date: "2026-08-21",
      startTime: "08:00",
      endTime: "18:00",
    },
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
        qualifiersPerGroup: 1,
      },
      draw: { status: "draft" },
      schedule: { status: "draft" },
    },
    ...overrides,
  };
}

describe("wave-o6-official-group-schedule-match-standings-01", () => {
  it("1-7 Group Stage: route, groups, units, no load mutation, create matches", () => {
    const page = readFileSync(
      path.join(root, "src/features/tournament/experience-a1/pages/IndividualGroupStagePage.jsx"),
      "utf8"
    );
    assert.ok(page.includes('TEST_ID = "tournament-groups-page"'));

    const t = officialBase();
    const before = JSON.stringify(t.events);
    const model = deriveGroupStageModel(t, { selectedEventId: "ev-a", selectedGroupId: "gA" });
    assert.equal(JSON.stringify(t.events), before);
    assert.equal(model.official, true);
    assert.equal(model.groups.length, 2);
    assert.equal(model.kpis.pairs, 4);
    assert.equal(model.createMatchesEnabled, true);

    const multi = deriveGroupStageModel(t, { selectedEventId: "" });
    assert.equal(multi.needsEventChoice, true);

    const created = buildOfficialCreateGroupMatchesPatch(t, { selectedEventId: "ev-a" });
    assert.equal(created.ok, true);
    assert.ok(created.matchCount > 0);
    assert.equal(created.groupsUnchanged, true);
    const event = created.patch.events.find((e) => e.id === "ev-a");
    assert.ok(event.matches.length > 0);
    assert.equal(event.groups.every((g) => !g.matches?.length), true);
    const units = listOfficialGroupDrawCompetitionUnits(
      { ...t, events: created.patch.events },
      { selectedEventId: "ev-a" }
    );
    assert.equal(units.units.length, 4);
  });

  it("8-16 Schedule: assign/publish authority, no load mutation, court identity", () => {
    const t = officialBase();
    const created = buildOfficialCreateGroupMatchesPatch(t, { selectedEventId: "ev-a" });
    const withMatches = { ...t, events: created.patch.events };
    const before = JSON.stringify(withMatches.events);
    deriveScheduleModel(withMatches, { selectedEventId: "ev-a" });
    assert.equal(JSON.stringify(withMatches.events), before);

    const sched = projectOfficialSchedule(withMatches, { selectedEventId: "ev-a" });
    assert.equal(sched.ok, true);
    assert.equal(sched.clusterUsedAsPhysicalCourt, false);

    const assigned = buildOfficialAssignGroupSchedulePatch(withMatches, {
      selectedEventId: "ev-a",
      courts: t.courts,
      courtIds: ["c1", "c2"],
      date: "2026-08-21",
      startTime: "08:00",
      endTime: "18:00",
    });
    assert.equal(assigned.ok, true);
    assert.equal(assigned.matchIdsPreserved, true);
    const ev = assigned.patch.events.find((e) => e.id === "ev-a");
    const idsBefore = created.matchIds.slice().sort();
    const idsAfter = ev.matches.map((m) => String(m.id)).sort();
    assert.deepEqual(idsAfter, idsBefore);
    assert.ok(ev.matches.every((m) => m.scheduledStart && m.courtId));
    assert.equal(
      ev.matches.every((m) => String(m.courtId) === "c1" || String(m.courtId) === "c2"),
      true
    );
  });

  it("17-26 Match Center CORE authorities + no local writers", () => {
    const adapter = resolveTournamentExperienceAdapter(officialBase(), {
      selectedEventId: "ev-a",
    });
    assert.equal(adapter.wave, "O6");
    assert.equal(typeof adapter.commands.createGroupMatches, "function");
    assert.equal(typeof adapter.commands.publishSchedule, "function");
    assert.equal(adapter.commands.scoreMatch, null);
    assert.equal(adapter.commands.acceptMatchResult, null);
    assert.equal(adapter.commands.assignReferee, null);

    const t = officialBase();
    const created = buildOfficialCreateGroupMatchesPatch(t, { selectedEventId: "ev-a" });
    const withMatches = { ...t, events: created.patch.events };
    const mc = projectOfficialMatchCenter(withMatches, { selectedEventId: "ev-a" });
    assert.equal(mc.lifecycleAuthority, OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE);
    assert.equal(mc.scoringAuthority, OFFICIAL_EXPERIENCE_AUTHORITY.SCORING);
    assert.equal(mc.resultAuthority, OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT);
    assert.equal(mc.refereeAuthority, OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT);
    assert.equal(mc.liveScoreTreatedAsFinal, false);
    assert.equal(mc.completedTreatedAsAccepted, false);
    assert.equal(mc.scoreMatchCommand, null);

    const model = deriveMatchCenterModel(withMatches, { selectedEventId: "ev-a" });
    assert.equal(model.official, true);
    assert.equal(model.scoringDenied, true);
    assert.equal(model.liveScoreTreatedAsFinal, false);
  });

  it("27-33 Standings / qualification reuse Official engine", () => {
    const t = officialBase();
    const created = buildOfficialCreateGroupMatchesPatch(t, { selectedEventId: "ev-a" });
    const event = created.patch.events.find((e) => e.id === "ev-a");
    event.matches = event.matches.map((m, i) =>
      i === 0
        ? { ...m, status: MATCH_STATUS.COMPLETED, scoreA: 11, scoreB: 5, winnerId: m.entryAId }
        : m
    );
    const withPartial = { ...t, events: created.patch.events };
    const standings = projectOfficialStandings(withPartial, { selectedEventId: "ev-a" });
    assert.equal(standings.ok, true);
    assert.equal(standings.formulaAuthority, "officialStandingsEngine");
    assert.equal(standings.qualificationAuthority, "officialQualificationReady");
    assert.equal(standings.onlyAcceptedActiveViaCore17, false);
    assert.equal(standings.qualification.ready, false);

    const model = deriveStandingsModel(withPartial, {
      selectedEventId: "ev-a",
      groupId: "gA",
    });
    assert.equal(model.official, true);
    assert.equal(model.formulaAuthority, "officialStandingsEngine");
  });

  it("34-44 Cross-screen match identity + event scoping", () => {
    const t = officialBase();
    const created = buildOfficialCreateGroupMatchesPatch(t, { selectedEventId: "ev-a" });
    const withMatches = { ...t, events: created.patch.events };
    const gs = projectOfficialGroupStage(withMatches, { selectedEventId: "ev-a" });
    const sch = projectOfficialSchedule(withMatches, { selectedEventId: "ev-a" });
    const mc = projectOfficialMatchCenter(withMatches, { selectedEventId: "ev-a" });
    const ids = gs.matches.map((m) => String(m.id)).sort();
    assert.deepEqual(
      sch.matches.map((m) => m.matchId).sort(),
      ids
    );
    assert.deepEqual(
      mc.matches.map((m) => m.matchId).sort(),
      ids
    );
    const first = sch.matches[0];
    const identity = projectOfficialMatchIdentity(
      withMatches.events[0].matches.find((m) => String(m.id) === first.matchId),
      {
        unitsById: new Map(
          listOfficialGroupDrawCompetitionUnits(withMatches, { selectedEventId: "ev-a" }).units.map(
            (u) => [String(u.id), u]
          )
        ),
      }
    );
    assert.equal(identity.eventId, "ev-a");
    assert.equal(identity.liveScoreIsFinal, false);

    const noEvent = projectOfficialGroupStage(withMatches, { selectedEventId: "" });
    assert.equal(noEvent.ok, false);
    assert.equal(noEvent.code, "EVENT_REQUIRED");
  });

  it("45-60 regression locks", () => {
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.REFEREE_ASSIGNMENT, "CORE-13");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.MATCH_LIFECYCLE, "CORE-15");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.SCORING, "CORE-16");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_RESULT, "CORE-17");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.COURT, "canonical-court-authority");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_GROUP_DRAW, "official-open-group-draw-engines");
    assert.equal(OFFICIAL_EXPERIENCE_AUTHORITY.OFFICIAL_KNOCKOUT, "official-open-knockout-engines");
    assert.ok(hasExplicitDashboardClubId("club-a"));

    const rem = readFileSync(
      path.join(
        root,
        "src/features/tournament/official-tournament-experience/groupDrawProjection.js"
      ),
      "utf8"
    );
    assert.ok(rem.includes("listOfficialGroupDrawCompetitionUnits"));

    const adapter = resolveTournamentExperienceAdapter(officialBase());
    assert.equal(adapter.wave, "O6");
    assert.equal(adapter.commands.publishAwards, null);
    assert.equal(adapter.commands.completeTournament, null);
  });
});
