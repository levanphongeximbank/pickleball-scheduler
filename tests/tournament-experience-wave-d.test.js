import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EVENT_TYPE, MATCH_STAGE, MATCH_STATUS, TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import { BATCH_D_ACTION_MATRIX } from "../src/features/tournament/experience-a1/batchD/actionMatrix.js";
import { deriveScheduleModel } from "../src/features/tournament/experience-a1/batchD/deriveSchedule.js";
import { deriveMatchCenterModel } from "../src/features/tournament/experience-a1/batchD/deriveMatchCenter.js";
import { deriveStandingsModel } from "../src/features/tournament/experience-a1/batchD/deriveStandings.js";
import { deriveBracketModel, deriveKnockoutModel } from "../src/features/tournament/experience-a1/batchD/deriveKnockout.js";
import { resolveSelectedEvent, listTournamentEvents } from "../src/features/tournament/experience-a1/deriveOverview.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A1_DIR = path.join(root, "src/features/tournament/experience-a1");
const ACCEPTED_C_HEAD = "b1284455317ffafa95b8464ff71ab31cbf797f69";
const FROZEN_PAGES = [
  "pages/TournamentCenterExperiencePage.jsx",
  "pages/IndividualOverviewPage.jsx",
  "pages/IndividualSettingsPage.jsx",
  "pages/IndividualRegistrationPublicationPage.jsx",
  "pages/IndividualParticipantsPage.jsx",
  "pages/IndividualPairFormationPage.jsx",
  "pages/IndividualPairDrawRoomPage.jsx",
  "pages/IndividualGroupDrawRoomPage.jsx",
  "pages/IndividualGroupStagePage.jsx",
];
const BATCH_D_PAGES = [
  "pages/IndividualSchedulePage.jsx",
  "pages/IndividualMatchCenterPage.jsx",
  "pages/IndividualStandingsPage.jsx",
  "pages/IndividualKnockoutPage.jsx",
  "pages/IndividualBracketPage.jsx",
];
const BANNED_VISIBLE = [
  "canonical",
  "payload",
  "writer",
  "SSOT",
  "events[0]",
  "Wave D",
  "prototype",
  "fixture",
  "court-engine",
];

function walkJs(dir) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
    }
  };
  visit(dir);
  return files.map((file) => ({
    file: path.relative(root, file).replaceAll("\\", "/"),
    source: readFileSync(file, "utf8"),
  }));
}

function sampleTournament(events, extra = {}) {
  return {
    id: "fc6da50a-b174-4187-af88-e38a025f22a5",
    name: "Giải đấu 17/8/2026 Test 1",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    status: "registration",
    settings: extra.settings || {},
    courtSchedule: extra.courtSchedule || {
      date: "2026-08-17",
      startTime: "08:00",
      endTime: "18:00",
      courtIds: ["c1", "c2"],
      physicalCourtIds: ["c1", "c2"],
    },
    courts: extra.courts || [
      { id: "c1", name: "Sân 1" },
      { id: "c2", name: "Sân 2" },
    ],
    events,
  };
}

describe("tournament-experience-wave-d", () => {
  it("SCREENS_01_09_UNCHANGED", () => {
    for (const rel of FROZEN_PAGES) {
      const current = readFileSync(path.join(A1_DIR, rel), "utf8").replaceAll("\r\n", "\n");
      const accepted = execFileSync("git", ["show", `${ACCEPTED_C_HEAD}:src/features/tournament/experience-a1/${rel}`], {
        encoding: "utf8",
        cwd: root,
      }).replaceAll("\r\n", "\n");
      assert.equal(current, accepted, `${rel} must match accepted Screens 01–09 HEAD`);
    }
  });

  it("NO_NEW_EVENTS0_ASSUMPTION", () => {
    const hits = walkJs(path.join(A1_DIR, "batchD"))
      .concat(walkJs(path.join(A1_DIR, "pages")).filter((item) => /Schedule|MatchCenter|StandingsPage|Knockout|BracketPage/.test(item.file)))
      .filter((item) => item.source.includes("events[0]"));
    assert.deepEqual(hits.map((item) => item.file), []);
  });

  it("SCREEN10_NO_NEW_COURT_ALLOCATION_WRITER", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualSchedulePage.jsx"), "utf8");
    assert.equal(page.includes("assignCourt"), false);
    assert.equal(page.includes("publishSchedule("), false);
    assert.ok(page.includes("disabled"));
    assert.ok(page.includes("Công bố lịch"));
  });

  it("SCREEN10_READINESS_COUNTS_CONSISTENT", () => {
    const model = deriveScheduleModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          matches: [
            { id: "m1", entryAId: "a", entryBId: "b", status: MATCH_STATUS.WAITING, courtId: "c1", scheduledStart: "08:00" },
            { id: "m2", entryAId: "c", entryBId: "d", status: MATCH_STATUS.WAITING, courtId: "c1", scheduledStart: "08:00" },
            { id: "m3", entryAId: "e", entryBId: "f", status: MATCH_STATUS.WAITING },
          ],
        },
      ]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.unscheduledCount, 1);
    assert.equal(model.conflictCount, 1);
    assert.equal(model.readinessItems[1].ready, false);
    assert.equal(model.readinessItems[2].ready, false);
    assert.equal(model.readinessItems[1].label.includes("1"), true);
    assert.equal(model.readinessItems.some((item) => /Không còn trận chưa xếp/.test(item.label) && !item.ready), false);
  });

  it("SCREEN10_NO_FALSE_FRIEND_COURT_ENGINE", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualSchedulePage.jsx"), "utf8");
    assert.equal(page.includes("/court-engine"), false);
    assert.equal(page.includes("CourtEngine"), false);
  });

  it("SCREEN10_NO_NEW_EVENTS0_ASSUMPTION", () => {
    const tournament = sampleTournament([
      { id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, matches: [] },
      { id: "e-b", name: "Đôi nữ", eventType: EVENT_TYPE.WOMEN_DOUBLE, matches: [{ id: "m9", status: MATCH_STATUS.WAITING }] },
    ]);
    const none = deriveScheduleModel(tournament, { selectedEventId: "" });
    assert.equal(none.needsEventChoice, true);
    assert.equal(none.cards.length, 0);
    const picked = deriveScheduleModel(tournament, { selectedEventId: "e-b" });
    assert.equal(picked.eventName, "Đôi nữ");
    assert.equal(picked.unscheduledCount, 1);
  });

  it("SCREEN11_READ_ONLY_REGISTRY", () => {
    const model = deriveMatchCenterModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            { id: "a", name: "A / B", playerIds: ["p1", "p2"] },
            { id: "c", name: "C / D", playerIds: ["p3", "p4"] },
          ],
          matches: [{ id: "m1", entryAId: "a", entryBId: "c", status: MATCH_STATUS.PLAYING, scoreA: 6, scoreB: 4 }],
        },
      ]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.rows.length, 1);
    assert.equal(model.scoringDenied, true);
    assert.equal(model.kpis.live, 1);
  });

  it("SCREEN11_NO_SCORE_WRITER", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualMatchCenterPage.jsx"), "utf8");
    for (const banned of ["+1", "Complete Match", "updateMatchScore", "completeMatch", "onScore", "Undo score"]) {
      assert.equal(page.includes(banned), false, banned);
    }
  });

  it("SCREEN11_NO_COMPLETE_MATCH_CONTROL", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualMatchCenterPage.jsx"), "utf8");
    assert.equal(/Hoàn tất trận|Complete Match|Finalize/.test(page), false);
  });

  it("SCREEN11_REFEREE_LAUNCH_ONLY", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualMatchCenterPage.jsx"), "utf8");
    const surfaces = readFileSync(path.join(A1_DIR, "batchD/ExperienceBatchDSurfaces.jsx"), "utf8");
    assert.ok(surfaces.includes("Mở bảng điểm trọng tài"));
    assert.ok(surfaces.includes("refereeLaunchTo"));
    assert.equal(page.includes("submitMatchScore"), false);
  });

  it("SCREEN12_STANDINGS_LOCK_DISABLED_WITHOUT_AUTHORITY", () => {
    const model = deriveStandingsModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          groups: [{ id: "g-a", label: "A", entryIds: ["a"] }],
          matches: [],
        },
      ]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.notReady, true);
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualStandingsPage.jsx"), "utf8");
    assert.ok(page.includes("Khóa BXH"));
    assert.ok(page.includes("disabled"));
    assert.equal(page.includes("lockStandings"), false);
  });

  it("SCREEN12_NO_FAKE_QUALIFICATION", () => {
    const model = deriveStandingsModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          groups: [{ id: "g-a", label: "A", entryIds: ["a", "b"], entries: [{ id: "a", name: "A" }, { id: "b", name: "B" }] }],
          matches: [],
        },
      ]),
      { selectedEventId: "e-a", groupId: "g-a" }
    );
    assert.equal(model.hasQualConfig, false);
    assert.ok(model.standings.every((row) => row.qualLabel === "Chưa cấu hình" || row.qualLabel === "Chưa xác định"));
  });

  it("SCREEN13_NO_SCORE_WRITER", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualKnockoutPage.jsx"), "utf8");
    for (const banned of ["submitKnockoutMatchScore", "setBracketWinner", "+1", "generateKnockoutBracket("]) {
      assert.equal(page.includes(banned), false, banned);
    }
  });

  it("SCREEN14_CONNECTORS_PRESENT", () => {
    const surfaces = readFileSync(path.join(A1_DIR, "batchD/ExperienceBatchDSurfaces.jsx"), "utf8");
    assert.ok(surfaces.includes("bracket-connector-"));
    assert.ok(surfaces.includes("showConnectors"));
  });

  it("SCREEN14_BYE_ADVANCEMENT", () => {
    const model = deriveBracketModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [{ id: "a", name: "Minh / Nam", playerIds: ["p1", "p2"] }],
          matches: [
            {
              id: "ko1",
              stage: MATCH_STAGE.QUARTERFINAL,
              entryAId: "a",
              entryBId: "",
              status: MATCH_STATUS.COMPLETED,
              winnerId: "a",
              bracketMatchId: "QF1",
            },
          ],
        },
      ]),
      { selectedEventId: "e-a" }
    );
    const node = model.columns.flatMap((column) => column.matches).find((item) => item.bye || item.b === "Miễn");
    assert.ok(node);
    assert.equal(node.b, "Miễn");
  });

  it("SCREEN14_MOBILE_NAV", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualBracketPage.jsx"), "utf8");
    assert.ok(page.includes("bracket-mobile-nav"));
    assert.ok(page.includes("scrollSnapType"));
  });

  it("PROTOTYPE_FIXTURE_USED=NO and NEW_DOMAIN_AUTHORITY=NO", () => {
    const sources = walkJs(path.join(A1_DIR, "batchD")).concat(
      BATCH_D_PAGES.map((rel) => ({ file: rel, source: readFileSync(path.join(A1_DIR, rel), "utf8") }))
    );
    for (const item of sources) {
      assert.equal(item.source.includes("prototypeFixture"), false, item.file);
      assert.equal(item.source.includes("opsFixture"), false, item.file);
    }
    const classC = BATCH_D_ACTION_MATRIX.filter((row) => row.class === "C");
    assert.ok(classC.length >= 6);
    for (const row of classC) {
      assert.equal(row.enabled, false, row.action);
      assert.equal(row.mutationPath, null, row.action);
    }
  });

  it("USER_VISIBLE_DEVELOPER_COPY=0 on Batch D pages", () => {
    for (const rel of BATCH_D_PAGES) {
      const source = readFileSync(path.join(A1_DIR, rel), "utf8");
      for (const banned of BANNED_VISIBLE) {
        assert.equal(source.includes(banned), false, `${rel} contains ${banned}`);
      }
    }
  });

  it("does not invent a first-event fallback on Batch D reads", () => {
    const tournament = sampleTournament([
      { id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, matches: [{ id: "1", status: MATCH_STATUS.WAITING }] },
      { id: "e-b", name: "Đôi nữ", eventType: EVENT_TYPE.WOMEN_DOUBLE, matches: [{ id: "2", status: MATCH_STATUS.WAITING }] },
    ]);
    assert.equal(resolveSelectedEvent(listTournamentEvents(tournament), null), null);
    assert.equal(deriveScheduleModel(tournament, { selectedEventId: "" }).needsEventChoice, true);
    assert.equal(deriveStandingsModel(tournament, { selectedEventId: "" }).needsEventChoice, true);
    assert.equal(deriveKnockoutModel(tournament, { selectedEventId: "" }).needsEventChoice, true);
    assert.equal(deriveBracketModel(tournament, { selectedEventId: "" }).needsEventChoice, true);
  });
});
