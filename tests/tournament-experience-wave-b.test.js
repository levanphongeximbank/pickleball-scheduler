import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EVENT_TYPE, TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import { BATCH_B_ACTION_MATRIX } from "../src/features/tournament/experience-a1/batchB/actionMatrix.js";
import { deriveFormationModel, FORMATION_MODE_ITEMS } from "../src/features/tournament/experience-a1/batchB/deriveFormation.js";
import { deriveParticipantsModel, filterParticipantRows } from "../src/features/tournament/experience-a1/batchB/deriveParticipants.js";
import { deriveRegistrationModel, filterRegistrationRows } from "../src/features/tournament/experience-a1/batchB/deriveRegistration.js";
import { resolveSelectedEvent, listTournamentEvents } from "../src/features/tournament/experience-a1/deriveOverview.js";
import {
  hasCanonicalRegistrationPublication,
  publicationPrimaryActionLabel,
} from "../src/features/tournament/experience-a1/publicationSemantics.js";
import {
  individualParticipantsPath,
  individualPairsPath,
  individualRegistrationPublicationPath,
} from "../src/features/tournament/experience-a1/routes.js";
import { A1_SETTINGS_WRITER } from "../src/features/tournament/experience-a1/settingsWriters.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A1_DIR = path.join(root, "src/features/tournament/experience-a1");
const BATCH_A_HEAD = "a0d20d0b4f7958582d7c01fd381f544d0a8e75b9";
const FROZEN_PAGES = [
  "pages/TournamentCenterExperiencePage.jsx",
  "pages/IndividualOverviewPage.jsx",
  "pages/IndividualSettingsPage.jsx",
];
const BANNED_VISIBLE = [
  "canonical",
  "payload",
  "writer",
  "RPC",
  "Wave B",
  "B-01",
  "B-02",
  "B-03",
  "lockRegistration",
  "events[0]",
  "updateTournamentCommand",
  "fixture",
  "prototype",
];
const BANNED_FORMATION_EN = ["BTC manual", "Random", "Rating-balanced", "Draft", "Hybrid"];

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

function sampleTournament(events) {
  return {
    id: "fc6da50a-b174-4187-af88-e38a025f22a5",
    name: "Giải đấu 17/8/2026 Test 1",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    status: "registration",
    settings: {
      registration: { opensAt: "2026-08-01T00:00:00.000Z", maxEntries: 16 },
      entryFee: { enabled: false, mode: "free" },
    },
    events,
  };
}

describe("tournament-experience-wave-b", () => {
  it("SCREENS_01_02_03_UNCHANGED", () => {
    for (const rel of FROZEN_PAGES) {
      const current = readFileSync(path.join(A1_DIR, rel), "utf8").replaceAll("\r\n", "\n");
      const accepted = execFileSync(
        "git",
        ["show", `${BATCH_A_HEAD}:src/features/tournament/experience-a1/${rel}`],
        { encoding: "utf8", cwd: root }
      ).replaceAll("\r\n", "\n");
      assert.equal(current, accepted, `${rel} must match Batch A HEAD`);
    }
  });

  it("NO_NEW_EVENTS0_ASSUMPTION", () => {
    const hits = walkJs(A1_DIR).filter((item) => item.source.includes("events[0]"));
    assert.deepEqual(hits.map((item) => item.file), []);
  });

  it("SCREEN_04_REAL_DATA_BINDING", () => {
    const tournament = sampleTournament([
      {
        id: "e-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [
          { id: "en1", name: "Minh / Nam", playerIds: ["p1", "p2"], status: "approved" },
          { id: "en2", name: "Lan", playerIds: ["p3"], status: "pending" },
          { id: "en3", name: "Hà / Việt", playerIds: ["p4", "p5"], status: "waitlisted" },
        ],
      },
    ]);
    const model = deriveRegistrationModel(tournament, {
      selectedEventId: "e-a",
      publicHref: "https://example.test/tournament/t/public",
    });
    assert.equal(model.tournamentName, "Giải đấu 17/8/2026 Test 1");
    assert.equal(model.eventName, "Đôi nam");
    assert.equal(model.kpis.confirmed, 1);
    assert.equal(model.kpis.pending, 1);
    assert.equal(model.kpis.waitlist, 1);
    assert.equal(model.rows.length, 3);
    assert.equal(model.rows[0].names, "Minh / Nam");
    assert.equal(model.rows[0].source, "Hồ sơ giải");
    assert.equal(model.rows[0].checkinLabel, "Chưa có dữ liệu");
    assert.equal(filterRegistrationRows(model.rows, { tab: "pending" }).length, 1);
    assert.equal(individualRegistrationPublicationPath("abc", "e1"), "/tournament/abc/registration?eventId=e1");
  });

  it("SCREEN_04_NO_FAKE_REGISTRATION_PUBLISH_AUTHORITY", () => {
    assert.equal(hasCanonicalRegistrationPublication(), false);
    assert.equal(publicationPrimaryActionLabel(""), "Công bố đăng ký");
    assert.equal(publicationPrimaryActionLabel("READY"), "Công bố đăng ký");
    assert.equal(publicationPrimaryActionLabel("REGISTRATION"), "Công bố đăng ký");
    const tournament = sampleTournament([
      { id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [], status: "ready" },
    ]);
    tournament.status = "ready";
    tournament.settings.registration.lockedAt = "2026-08-17T00:00:00.000Z";
    const model = deriveRegistrationModel(tournament, { selectedEventId: "e-a" });
    assert.equal(model.publicationEnabled, false);
    assert.equal(model.publicationActionLabel, "Công bố đăng ký");
    assert.notEqual(model.publicationStatusLabel, "Đã công bố");
    assert.equal(model.closeEnabled, false);
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualRegistrationPublicationPage.jsx"), "utf8");
    assert.equal(page.includes("lockRegistration"), false);
    assert.equal(page.includes("approveEntry"), false);
  });

  it("SCREEN_04_PUBLIC_CTA_SEMANTICS", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualRegistrationPublicationPage.jsx"), "utf8");
    const previewStart = page.indexOf("Nút kêu gọi công khai");
    const previewEnd = page.indexOf("Sẵn sàng đóng đăng ký");
    assert.ok(previewStart >= 0 && previewEnd > previewStart);
    const preview = page.slice(previewStart, previewEnd);
    assert.ok(preview.includes("Đăng ký ngay"));
    assert.ok(preview.includes("Xem trước nút kêu gọi"));
    assert.ok(preview.includes("Chỉ hoạt động sau khi đăng ký được công bố."));
    assert.ok(preview.includes("disabled"));
    assert.equal(preview.includes("RouterLink"), false);
    assert.equal(preview.includes("individualPublicTournamentPath"), false);
    assert.equal(hasCanonicalRegistrationPublication(), false);
  });

  it("SCREEN_05_REAL_PARTICIPANT_READ", () => {
    const tournament = sampleTournament([
      {
        id: "e-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [
          { id: "en1", name: "Minh / Nam", playerIds: ["p1", "p2"], status: "approved" },
          { id: "en2", name: "Lan", playerIds: ["p3"], status: "pending" },
        ],
      },
    ]);
    const model = deriveParticipantsModel(tournament, { selectedEventId: "e-a" });
    assert.equal(model.kpis.total, 2);
    assert.equal(model.kpis.complete, 1);
    assert.equal(model.kpis.checkedIn, "—");
    assert.equal(model.rows[0].checkinLabel, "Chưa có dữ liệu");
    assert.equal(model.rows[0].eligibilityLabel, "Chưa có dữ liệu");
    assert.equal(model.rows[1].profile, "incomplete");
    assert.equal(filterParticipantRows(model.rows, { profile: "incomplete" }).length, 1);
    assert.equal(filterParticipantRows(model.rows, { checkin: "yes" }).length, 0);
  });

  it("SCREEN_05_NO_NEW_PARTICIPANT_LOCK_WRITER", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualParticipantsPage.jsx"), "utf8");
    assert.equal(page.includes("lockRegistration"), false);
    assert.equal(page.includes("updateTournamentCommand"), false);
    const model = deriveParticipantsModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [] }]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.lockEnabled, false);
    assert.equal(A1_SETTINGS_WRITER.command, "updateTournamentCommand");
    const settings = readFileSync(path.join(A1_DIR, "settingsWriters.js"), "utf8");
    assert.equal(settings.includes("lockRegistration"), false);
  });

  it("SCREEN_06_REAL_ENTRY_PAIR_READ", () => {
    const tournament = sampleTournament([
      {
        id: "e-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [
          { id: "en1", name: "Minh / Nam", playerIds: ["p1", "p2"], status: "approved", seed: 1 },
          { id: "en2", name: "Lan", playerIds: ["p3"], status: "pending" },
        ],
      },
    ]);
    const model = deriveFormationModel(tournament, { selectedEventId: "e-a", mode: "together" });
    assert.equal(model.formed.length, 1);
    assert.equal(model.formed[0].a, "Minh");
    assert.equal(model.formed[0].mode, "Đăng ký cùng");
    assert.equal(model.unpaired.length, 1);
    assert.equal(model.unpaired[0].name, "Lan");
    assert.equal(model.kpis.formed, 1);
    assert.equal(model.createPairEnabled, false);
  });

  it("SCREEN_06_FORMATION_LABELS_VIETNAMESE", () => {
    const labels = FORMATION_MODE_ITEMS.map((item) => item.label);
    assert.deepEqual(labels, [
      "Đăng ký cùng",
      "BTC ghép thủ công",
      "Ghép ngẫu nhiên",
      "Cân bằng Rating",
      "Chọn theo lượt",
      "Kết hợp",
    ]);
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualPairFormationPage.jsx"), "utf8");
    const derive = readFileSync(path.join(A1_DIR, "batchB/deriveFormation.js"), "utf8");
    for (const banned of BANNED_FORMATION_EN) {
      assert.equal(page.includes(banned), false, banned);
      assert.equal(derive.includes(banned), false, banned);
    }
  });

  it("SCREEN_06_NO_SELECT_PLAYERS_FALSE_FRIEND", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualPairFormationPage.jsx"), "utf8");
    assert.equal(page.includes("/select-players"), false);
    assert.equal(page.includes("select-players"), false);
  });

  it("SCREEN_06_NO_NEW_PAIR_LOCK_WRITER", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualPairFormationPage.jsx"), "utf8");
    assert.equal(page.includes("lockRegistration"), false);
    assert.equal(page.includes("updateTournamentCommand"), false);
    const model = deriveFormationModel(
      sampleTournament([{ id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [] }]),
      { selectedEventId: "e-a" }
    );
    assert.equal(model.lockEnabled, false);
    assert.equal(model.drawEnabled, false);
  });

  it("does not invent a first-event fallback on Batch B reads", () => {
    const tournament = sampleTournament([
      { id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [{ id: "1", name: "A / B", playerIds: ["p1", "p2"] }] },
      { id: "e-b", name: "Đôi nữ", eventType: EVENT_TYPE.WOMEN_DOUBLE, entries: [{ id: "2", name: "C / D", playerIds: ["p3", "p4"] }] },
    ]);
    const events = listTournamentEvents(tournament);
    assert.equal(resolveSelectedEvent(events, null), null);
    const registration = deriveRegistrationModel(tournament, { selectedEventId: "" });
    assert.equal(registration.needsEventChoice, true);
    assert.equal(registration.rows.length, 0);
    const participants = deriveParticipantsModel(tournament, { selectedEventId: "" });
    assert.equal(participants.needsEventChoice, true);
    assert.equal(participants.rows.length, 0);
    const formation = deriveFormationModel(tournament, { selectedEventId: "" });
    assert.equal(formation.needsEventChoice, true);
    assert.equal(formation.formed.length, 0);
  });

  it("PROTOTYPE_FIXTURE_USED=NO and NEW_DOMAIN_AUTHORITY=NO", () => {
    const sources = walkJs(A1_DIR);
    const batchB = sources.filter((item) =>
      /batchB\/|IndividualRegistrationPublicationPage|IndividualParticipantsPage|IndividualPairFormationPage|publicationSemantics/.test(
        item.file
      )
    );
    for (const item of batchB) {
      assert.equal(item.source.includes("prototypeFixture"), false, item.file);
      assert.equal(item.source.includes("opsFixture"), false, item.file);
      assert.equal(item.source.includes("lockRegistration("), false, item.file);
    }
    const matrixC = BATCH_B_ACTION_MATRIX.filter((row) => row.class === "C");
    assert.ok(matrixC.length >= 5);
    for (const row of matrixC) {
      assert.equal(row.enabled, false, row.action);
      assert.equal(row.mutationPath, null, row.action);
    }
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes("/tournament/:tournamentId/registration"));
    assert.ok(router.includes("/tournament/:tournamentId/participants"));
    assert.ok(router.includes("/tournament/:tournamentId/pairs"));
    assert.equal(individualParticipantsPath("abc"), "/tournament/abc/participants");
    assert.equal(individualPairsPath("abc", "e1"), "/tournament/abc/pairs?eventId=e1");
  });

  it("USER_VISIBLE_DEVELOPER_COPY=0 on Batch B pages", () => {
    const pages = [
      "pages/IndividualRegistrationPublicationPage.jsx",
      "pages/IndividualParticipantsPage.jsx",
      "pages/IndividualPairFormationPage.jsx",
      "batchB/ExperienceBatchBFrame.jsx",
    ];
    for (const rel of pages) {
      const source = readFileSync(path.join(A1_DIR, rel), "utf8");
      for (const banned of BANNED_VISIBLE) {
        assert.equal(source.includes(banned), false, `${rel} contains ${banned}`);
      }
    }
  });
});
