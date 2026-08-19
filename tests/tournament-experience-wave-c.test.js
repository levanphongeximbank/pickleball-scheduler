import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EVENT_TYPE, MATCH_STATUS, TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import { BATCH_C_ACTION_MATRIX } from "../src/features/tournament/experience-a1/batchC/actionMatrix.js";
import { resolveDrawRoomActionState } from "../src/features/tournament/experience-a1/batchC/drawRoomActionState.js";
import { derivePairDrawModel } from "../src/features/tournament/experience-a1/batchC/derivePairDraw.js";
import { deriveGroupDrawModel } from "../src/features/tournament/experience-a1/batchC/deriveGroupDraw.js";
import { deriveGroupStageModel } from "../src/features/tournament/experience-a1/batchC/deriveGroupStage.js";
import { resolveSelectedEvent, listTournamentEvents } from "../src/features/tournament/experience-a1/deriveOverview.js";
import {
  individualGroupDrawPath,
  individualGroupStagePath,
  individualPairDrawPath,
} from "../src/features/tournament/experience-a1/routes.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A1_DIR = path.join(root, "src/features/tournament/experience-a1");
const BATCH_B_HEAD = "01f9f9cc32fe3fa5263f522cc64a2c7083200c7f";
const FROZEN_PAGES = [
  "pages/TournamentCenterExperiencePage.jsx",
  "pages/IndividualOverviewPage.jsx",
  "pages/IndividualSettingsPage.jsx",
  "pages/IndividualRegistrationPublicationPage.jsx",
  "pages/IndividualParticipantsPage.jsx",
  "pages/IndividualPairFormationPage.jsx",
];
const BANNED_VISIBLE = [
  "canonical",
  "payload",
  "writer",
  "RPC",
  "Wave C",
  "B-03",
  "B-16",
  "lockDraw",
  "publishDraw",
  "events[0]",
  "updateTournamentCommand",
  "fixture",
  "prototype",
  "Operator Mode",
  "Presentation Mode",
  "Draw next",
  "Lock draw",
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
    events,
  };
}

describe("tournament-experience-wave-c", () => {
  it("SCREENS_01_06_UNCHANGED", () => {
    for (const rel of FROZEN_PAGES) {
      const current = readFileSync(path.join(A1_DIR, rel), "utf8").replaceAll("\r\n", "\n");
      const accepted = execFileSync(
        "git",
        ["show", `${BATCH_B_HEAD}:src/features/tournament/experience-a1/${rel}`],
        { encoding: "utf8", cwd: root }
      ).replaceAll("\r\n", "\n");
      assert.equal(current, accepted, `${rel} must match accepted Batch B HEAD`);
    }
  });

  it("NO_NEW_EVENTS0_ASSUMPTION", () => {
    const hits = walkJs(path.join(A1_DIR, "batchC"))
      .concat(
        walkJs(path.join(A1_DIR, "pages")).filter((item) =>
          /PairDrawRoom|GroupDrawRoom|GroupStagePage/.test(item.file)
        )
      )
      .filter((item) => item.source.includes("events[0]"));
    assert.deepEqual(hits.map((item) => item.file), []);
  });

  it("SCREEN_07_STRICT_VISUAL_STRUCTURE", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualPairDrawRoomPage.jsx"), "utf8");
    const shell = readFileSync(path.join(A1_DIR, "batchC/ExperienceDrawRoomShell.jsx"), "utf8");
    const surfaces = readFileSync(path.join(A1_DIR, "batchC/ExperienceDrawRoomSurfaces.jsx"), "utf8");
    const actionState = readFileSync(path.join(A1_DIR, "batchC/drawRoomActionState.js"), "utf8");
    const blob = `${page}\n${shell}\n${surfaces}\n${actionState}`;
    for (const needle of [
      "Bốc thăm ghép cặp / đội",
      "Điều hành",
      "Trình chiếu",
      "Hoàn tác",
      "Mở màn hình trình chiếu",
      "Bốc tiếp",
      "Kết quả bốc thăm",
      "Tiến độ bốc thăm",
      "Lịch sử bốc thăm",
      "Khóa kết quả bốc thăm",
      "Sang bốc thăm chia bảng",
      "Nhóm A",
      "Nhóm B",
      "drawBg",
    ]) {
      assert.ok(blob.includes(needle), needle);
    }
    const model = derivePairDrawModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            { id: "en1", name: "Minh / Nam", playerIds: ["p1", "p2"] },
            { id: "en2", name: "Lan", playerIds: ["p3"] },
          ],
        },
      ]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.ledger.length, 1);
    assert.equal(model.poolA.length, 1);
    assert.equal(model.poolB.length, 0);
    assert.equal(model.eventName, "Đôi nam");
    assert.equal(individualPairDrawPath("abc", "e1"), "/tournament/abc/pair-draw?eventId=e1");
  });

  it("SCREEN_07_NO_NEW_PAIR_DRAW_LOCK_WRITER", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualPairDrawRoomPage.jsx"), "utf8");
    assert.equal(page.includes("lockDraw"), false);
    assert.equal(page.includes("updateTournamentCommand"), false);
    assert.equal(page.includes("setLocked"), false);
    const model = derivePairDrawModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [] }]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.actionState.lockAllowed, false);
    assert.equal(model.actionState.nextLifecycleDisabled, true);
    assert.equal(model.locked, false);
  });

  it("SCREEN_07_UNDO_AUTHORITY_SAFE", () => {
    const state = resolveDrawRoomActionState({ drawnCount: 4, expectedTotal: 4, locked: false, lockAuthority: false });
    assert.equal(state.drawNextDisabled, true);
    assert.equal(state.lockDisabled, true);
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualPairDrawRoomPage.jsx"), "utf8");
    assert.ok(page.includes("disabled"));
    assert.equal(page.includes("undoDraw"), false);
    assert.equal(page.includes("drawNext("), false);
  });

  it("SCREEN_08_STRICT_VISUAL_STRUCTURE", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualGroupDrawRoomPage.jsx"), "utf8");
    const shell = readFileSync(path.join(A1_DIR, "batchC/ExperienceDrawRoomShell.jsx"), "utf8");
    const surfaces = readFileSync(path.join(A1_DIR, "batchC/ExperienceDrawRoomSurfaces.jsx"), "utf8");
    const actionState = readFileSync(path.join(A1_DIR, "batchC/drawRoomActionState.js"), "utf8");
    const blob = `${page}\n${shell}\n${surfaces}\n${actionState}`;
    for (const needle of [
      "Bốc thăm chia bảng",
      "Khóa kết quả bốc thăm",
      "Sang vòng bảng",
      "Kết quả bốc thăm",
      "Tiến độ bốc thăm",
      "Lịch sử bốc thăm",
      "drawBg",
    ]) {
      assert.ok(blob.includes(needle), needle);
    }
    const model = deriveGroupDrawModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            { id: "en1", name: "Minh / Nam", playerIds: ["p1", "p2"] },
            { id: "en2", name: "Hà / Việt", playerIds: ["p3", "p4"] },
          ],
          groups: [{ id: "g-a", label: "A", entryIds: ["en1"] }],
        },
      ]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.groupCards.length, 1);
    assert.equal(model.awaiting.length, 1);
    assert.equal(model.drawnCount, 1);
    assert.equal(model.locked, false);
    assert.equal(individualGroupDrawPath("abc"), "/tournament/abc/group-draw");
  });

  it("SCREEN_08_EXISTING_DRAW_AUTHORITY_ONLY", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualGroupDrawRoomPage.jsx"), "utf8");
    assert.equal(page.includes("lockDraw("), false);
    assert.equal(page.includes("publishDraw("), false);
    assert.equal(page.includes("updateTournamentCommand"), false);
    const model = deriveGroupDrawModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [], groups: [] }]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.actionState.lockAllowed, false);
  });

  it("SCREEN_08_LOCK_NEXT_STATE_REAL", () => {
    const unlocked = deriveGroupDrawModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [] }]),
      { selectedEventId: "e-a" }
    );
    assert.equal(unlocked.actionState.nextLifecycleDisabled, true);
    const locked = deriveGroupDrawModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [] }], {
        settings: { draw: { status: "locked" } },
      }),
      { selectedEventId: "e-a" }
    );
    assert.equal(locked.locked, true);
    assert.equal(locked.actionState.nextLifecycleDisabled, false);
    assert.equal(locked.actionState.lockAllowed, false);
  });

  it("SCREEN_09_STRICT_VISUAL_STRUCTURE", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualGroupStagePage.jsx"), "utf8");
    for (const needle of [
      "Vòng bảng",
      "Bảng xếp hạng",
      "Danh sách trận",
      "Chốt BXH",
      "Chọn bảng",
      "Quyền đi tiếp",
      "Kết quả & BXH",
      "Tiến độ bảng",
    ]) {
      assert.ok(page.includes(needle), needle);
    }
    const model = deriveGroupStageModel(
      sampleTournament([
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [
            { id: "en1", name: "Minh / Nam", playerIds: ["p1", "p2"] },
            { id: "en2", name: "Hà / Việt", playerIds: ["p3", "p4"] },
          ],
          groups: [{ id: "g-a", label: "A", entryIds: ["en1", "en2"] }],
          matches: [
            {
              id: "m1",
              groupId: "g-a",
              entryAId: "en1",
              entryBId: "en2",
              status: MATCH_STATUS.COMPLETED,
              scoreA: 11,
              scoreB: 8,
            },
          ],
        },
      ]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.standings.length, 2);
    assert.equal(model.matches.length, 1);
    assert.equal(model.matches[0].score, "11–8");
    assert.equal(model.standings.every((row) => row.qualLabel === "Chưa xác định"), true);
    assert.equal(individualGroupStagePath("abc", "e1"), "/tournament/abc/groups?eventId=e1");
  });

  it("SCREEN_09_NO_SCORE_WRITER", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualGroupStagePage.jsx"), "utf8");
    for (const banned of ["+1", "Complete Match", "updateMatchScore", "completeMatch", "scoreA +", "onScore"]) {
      assert.equal(page.includes(banned), false, banned);
    }
    assert.ok(page.includes("directorPath"));
    assert.ok(page.includes("Kết quả & BXH"));
  });

  it("SCREEN_09_NO_NEW_STANDINGS_LOCK_WRITER", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualGroupStagePage.jsx"), "utf8");
    assert.equal(page.includes("lockStandings"), false);
    assert.equal(page.includes("updateTournamentCommand"), false);
    assert.equal(page.includes("lockDraw"), false);
    const model = deriveGroupStageModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, groups: [] }]),
      { selectedEventId: "e-a" }
    );
    assert.ok(model.lockHint.includes("Chốt bảng xếp hạng"));
  });

  it("does not invent a first-event fallback on Batch C reads", () => {
    const tournament = sampleTournament([
      { id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [{ id: "1", name: "A / B", playerIds: ["p1", "p2"] }] },
      { id: "e-b", name: "Đôi nữ", eventType: EVENT_TYPE.WOMEN_DOUBLE, entries: [{ id: "2", name: "C / D", playerIds: ["p3", "p4"] }] },
    ]);
    const events = listTournamentEvents(tournament);
    assert.equal(resolveSelectedEvent(events, null), null);
    const pair = derivePairDrawModel(tournament, { selectedEventId: "" });
    assert.equal(pair.needsEventChoice, true);
    assert.equal(pair.ledger.length, 0);
    const group = deriveGroupDrawModel(tournament, { selectedEventId: "" });
    assert.equal(group.needsEventChoice, true);
    assert.equal(group.groupCards.length, 0);
    const stage = deriveGroupStageModel(tournament, { selectedEventId: "" });
    assert.equal(stage.needsEventChoice, true);
    assert.equal(stage.standings.length, 0);
  });

  it("PROTOTYPE_FIXTURE_USED=NO and NEW_DOMAIN_AUTHORITY=NO", () => {
    const sources = walkJs(path.join(A1_DIR, "batchC")).concat(
      ["IndividualPairDrawRoomPage.jsx", "IndividualGroupDrawRoomPage.jsx", "IndividualGroupStagePage.jsx"].map((name) => ({
        file: `pages/${name}`,
        source: readFileSync(path.join(A1_DIR, "pages", name), "utf8"),
      }))
    );
    for (const item of sources) {
      assert.equal(item.source.includes("prototypeFixture"), false, item.file);
      assert.equal(item.source.includes("opsFixture"), false, item.file);
      assert.equal(item.source.includes("lockDraw("), false, item.file);
    }
    const matrixC = BATCH_C_ACTION_MATRIX.filter((row) => row.class === "C");
    assert.ok(matrixC.length >= 5);
    for (const row of matrixC) {
      assert.equal(row.enabled, false, row.action);
      assert.equal(row.mutationPath, null, row.action);
    }
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes("/tournament/:tournamentId/pair-draw"));
    assert.ok(router.includes("/tournament/:tournamentId/group-draw"));
    assert.ok(router.includes("/tournament/:tournamentId/groups"));
  });

  it("USER_VISIBLE_DEVELOPER_COPY=0 on Batch C pages", () => {
    const pages = [
      "pages/IndividualPairDrawRoomPage.jsx",
      "pages/IndividualGroupDrawRoomPage.jsx",
      "pages/IndividualGroupStagePage.jsx",
      "batchC/ExperienceDrawRoomShell.jsx",
      "batchC/ExperienceDrawRoomStates.jsx",
    ];
    for (const rel of pages) {
      const source = readFileSync(path.join(A1_DIR, rel), "utf8");
      for (const banned of BANNED_VISIBLE) {
        assert.equal(source.includes(banned), false, `${rel} contains ${banned}`);
      }
    }
  });
});
