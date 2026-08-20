import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EVENT_TYPE, MATCH_STATUS, TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import { BATCH_E_ACTION_MATRIX } from "../src/features/tournament/experience-a1/batchE/actionMatrix.js";
import { deriveDirectorModel } from "../src/features/tournament/experience-a1/batchE/deriveDirector.js";
import { deriveCourtBoardModel } from "../src/features/tournament/experience-a1/batchE/deriveCourtBoard.js";
import { deriveRefereeBoardModel } from "../src/features/tournament/experience-a1/batchE/deriveRefereeBoard.js";
import { deriveExceptionModel } from "../src/features/tournament/experience-a1/batchE/deriveExceptions.js";
import { OPS_STATUS } from "../src/features/tournament/experience-a1/batchE/opsStatus.js";
import { resolveSelectedEvent, listTournamentEvents } from "../src/features/tournament/experience-a1/deriveOverview.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A1_DIR = path.join(root, "src/features/tournament/experience-a1");
const ACCEPTED_D_HEAD = "e99f8ecbdf19f9f63013e3663112d2cd50cf54b0";
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
  "pages/IndividualSchedulePage.jsx",
  "pages/IndividualMatchCenterPage.jsx",
  "pages/IndividualStandingsPage.jsx",
  "pages/IndividualKnockoutPage.jsx",
  "pages/IndividualBracketPage.jsx",
];
const BATCH_E_PAGES = [
  "pages/IndividualDirectorOpsPage.jsx",
  "pages/IndividualCourtBoardPage.jsx",
  "pages/IndividualRefereeBoardPage.jsx",
  "pages/IndividualExceptionCenterPage.jsx",
];
const BANNED_VISIBLE = [
  "canonical",
  "payload",
  "writer",
  "SSOT",
  "events[0]",
  "Wave E",
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

describe("tournament-experience-wave-e", () => {
  it("SCREENS_01_14_UNCHANGED", () => {
    for (const rel of FROZEN_PAGES) {
      const current = readFileSync(path.join(A1_DIR, rel), "utf8").replaceAll("\r\n", "\n");
      const accepted = execFileSync("git", ["show", `${ACCEPTED_D_HEAD}:src/features/tournament/experience-a1/${rel}`], {
        encoding: "utf8",
        cwd: root,
      }).replaceAll("\r\n", "\n");
      assert.equal(current, accepted, `${rel} must match accepted Screens 01–14 HEAD`);
    }
  });

  it("NO_NEW_EVENTS0_ASSUMPTION", () => {
    const hits = walkJs(path.join(A1_DIR, "batchE"))
      .concat(BATCH_E_PAGES.map((rel) => ({ file: rel, source: readFileSync(path.join(A1_DIR, rel), "utf8") })))
      .filter((item) => item.source.includes("events[0]"));
    assert.deepEqual(hits.map((item) => item.file), []);
  });

  it("SCREEN15_NO_NEW_SCORE_WRITER", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualDirectorOpsPage.jsx"), "utf8");
    for (const banned of ["submitTournamentDirectorMatchScore", "+1", "Undo", "Complete Match", "setMatchScore"]) {
      assert.equal(page.includes(banned), false, banned);
    }
  });

  it("SCREEN15_MATCH_REGISTRY_WRITE=NO", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualDirectorOpsPage.jsx"), "utf8");
    assert.equal(page.includes("updateTournamentCommand"), false);
    assert.equal(page.includes("saveMatches"), false);
  });

  it("SCREEN15_NO_FALSE_FRIEND_COURT_ENGINE", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualDirectorOpsPage.jsx"), "utf8");
    assert.equal(page.includes("court-engine"), false);
  });

  it("SCREEN16_COURT_STATUS_WRITER=NO", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualCourtBoardPage.jsx"), "utf8");
    assert.equal(page.includes("toggleTournamentDirectorCourtLock"), false);
    assert.equal(page.includes("setCourtStatus"), false);
  });

  it("SCREEN16_PHYSICAL_COURT_IDENTITY", () => {
    const model = deriveCourtBoardModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, matches: [] }]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.physicalCourtCount, 2);
    assert.ok(model.allCourts.every((court) => court.id && court.name));
  });

  it("SCREEN16_STATUS_COUNT_INVARIANT", () => {
    const model = deriveCourtBoardModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          matches: [
            { id: "m1", status: MATCH_STATUS.PLAYING, courtId: "c1", entryAId: "a", entryBId: "b" },
            { id: "m2", status: MATCH_STATUS.WAITING, courtId: "c2", scheduledStart: "13:00" },
          ],
        },
      ]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.statusCountSum, model.physicalCourtCount);
    assert.equal(model.kpis.live + model.kpis.next + model.kpis.available + model.kpis.delay + model.kpis.maintenance, 2);
    assert.equal(model.kpis.live, 1);
    assert.equal(model.kpis.next, 1);
  });

  it("SCREEN16_NO_FALSE_FRIEND_COURT_ENGINE", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualCourtBoardPage.jsx"), "utf8");
    assert.equal(page.includes("/court-engine"), false);
    assert.ok(page.includes("Sân vật lý"));
  });

  it("SCREEN17_WORKER_SCORE_CONTROLS=ABSENT", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualRefereeBoardPage.jsx"), "utf8");
    for (const banned of ["+1", "Undo", "Pause scoring", "Hoàn tất trận"]) {
      assert.equal(page.includes(banned), false, banned);
    }
  });

  it("SCREEN17_NEW_ASSIGNMENT_AUTHORITY=NO", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualRefereeBoardPage.jsx"), "utf8");
    assert.equal(page.includes("setCourtRefereeAssignment"), false);
    assert.equal(page.includes("onAssign"), false);
  });

  it("SCREEN17_ASSIGNMENT_MUTATIONS_GATED", () => {
    const surfaces = readFileSync(path.join(A1_DIR, "batchE/ExperienceBatchESurfaces.jsx"), "utf8");
    assert.ok(surfaces.includes("Phân công"));
    assert.ok(surfaces.includes("disabled>Phân công") || /disabled>\s*Phân công/.test(surfaces));
  });

  it("SCREEN17 does not label idle referees available", () => {
    const model = deriveRefereeBoardModel(
      sampleTournament(
        [{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, matches: [] }],
        { settings: { refereeRoster: [{ id: "r1", name: "Trọng tài 01" }] } }
      ),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.kpis.available, 0);
    assert.equal(model.hasAvailabilityModel, false);
    assert.equal(model.allReferees[0].derivedStatus, "");
  });

  it("SCREEN18_NEW_INCIDENT_STORE=NO", () => {
    const sources = walkJs(path.join(A1_DIR, "batchE")).concat(
      BATCH_E_PAGES.map((rel) => ({ file: rel, source: readFileSync(path.join(A1_DIR, rel), "utf8") }))
    );
    for (const item of sources) {
      assert.equal(item.source.includes("incident table"), false, item.file);
      assert.equal(item.source.includes("createIncident"), false, item.file);
    }
  });

  it("SCREEN18_FAKE_INCIDENTS=0", () => {
    const model = deriveExceptionModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, matches: [] }]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.allItems.length, 0);
    assert.equal(model.kpis.open, 0);
  });

  it("SCREEN18_NEW_CORRECTION_REOPEN_AUTHORITY=NO", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualExceptionCenterPage.jsx"), "utf8");
    assert.equal(page.includes("reopenMatch"), false);
    assert.equal(page.includes("correctScore"), false);
  });

  it("SCREEN18_REAL_EXCEPTION_DATA_ONLY", () => {
    const model = deriveExceptionModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          matches: [{ id: "m1", status: MATCH_STATUS.POSTPONED, courtId: "c1" }],
        },
      ]),
      { selectedEventId: "e-a" }
    );
    assert.ok(model.allItems.some((item) => item.type === "Trận hoãn"));
    assert.equal(model.allItems.some((item) => item.title.includes("fixture")), false);
  });

  it("PROTOTYPE_FIXTURE_USED=NO and NEW_DOMAIN_AUTHORITY=NO", () => {
    const sources = walkJs(path.join(A1_DIR, "batchE")).concat(
      BATCH_E_PAGES.map((rel) => ({ file: rel, source: readFileSync(path.join(A1_DIR, rel), "utf8") }))
    );
    for (const item of sources) {
      assert.equal(item.source.includes("prototypeFixture"), false, item.file);
      assert.equal(item.source.includes("opsFixture"), false, item.file);
    }
    const classC = BATCH_E_ACTION_MATRIX.filter((row) => row.class === "C");
    assert.ok(classC.length >= 6);
    for (const row of classC) {
      assert.equal(row.enabled, false, row.action);
      assert.equal(row.mutationPath, null, row.action);
    }
  });

  it("USER_VISIBLE_DEVELOPER_COPY=0 on Batch E pages", () => {
    for (const rel of BATCH_E_PAGES) {
      const source = readFileSync(path.join(A1_DIR, rel), "utf8");
      for (const banned of BANNED_VISIBLE) {
        assert.equal(source.includes(banned), false, `${rel} contains ${banned}`);
      }
    }
  });

  it("does not invent a first-event fallback on Batch E reads", () => {
    const tournament = sampleTournament([
      { id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, matches: [{ id: "1", status: MATCH_STATUS.WAITING }] },
      { id: "e-b", name: "Đôi nữ", eventType: EVENT_TYPE.WOMEN_DOUBLE, matches: [{ id: "2", status: MATCH_STATUS.WAITING }] },
    ]);
    assert.equal(resolveSelectedEvent(listTournamentEvents(tournament), null), null);
    assert.equal(deriveDirectorModel(tournament, { selectedEventId: "all" }).emptyEvents, false);
    assert.equal(deriveCourtBoardModel(tournament, { selectedEventId: "" }).physicalCourtCount, 2);
  });

  it("SCREEN16 maintenance only from court record", () => {
    const model = deriveCourtBoardModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, matches: [] }], {
        courts: [
          { id: "c1", name: "Sân 1" },
          { id: "c2", name: "Sân 2", status: "maintenance" },
        ],
      }),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.kpis.maintenance, 1);
    assert.equal(model.kpis.available, 1);
    assert.equal(model.statusCountSum, 2);
    assert.equal(model.allCourts.find((court) => court.id === "c2").derivedStatus, OPS_STATUS.MAINTENANCE);
  });
});
