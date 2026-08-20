import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { EVENT_TYPE, MATCH_STAGE, MATCH_STATUS, TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";
import { BATCH_F_ACTION_MATRIX } from "../src/features/tournament/experience-a1/batchF/actionMatrix.js";
import { deriveCommunicationsModel } from "../src/features/tournament/experience-a1/batchF/deriveCommunications.js";
import { normalizeScoreLine } from "../src/features/tournament/experience-a1/batchF/deriveMediaPresentation.js";
import { deriveAwardsModel } from "../src/features/tournament/experience-a1/batchF/deriveAwards.js";
import { deriveCompletionModel } from "../src/features/tournament/experience-a1/batchF/deriveCompletion.js";
import {
  derivePublicExperienceModel,
  resolvePublicRegistrationCta,
} from "../src/features/tournament/experience-a1/batchF/derivePublicExperience.js";
import { resolvePresentationActions, PRESENTATION_SESSION } from "../src/features/tournament/experience-a1/batchF/presentationSessionState.js";
import { resolveSelectedEvent, listTournamentEvents } from "../src/features/tournament/experience-a1/deriveOverview.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A1_DIR = path.join(root, "src/features/tournament/experience-a1");
const ACCEPTED_E_HEAD = "ca955d3544d00cbc034aea639a31170f90ce9ecc";
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
  "pages/IndividualDirectorOpsPage.jsx",
  "pages/IndividualCourtBoardPage.jsx",
  "pages/IndividualRefereeBoardPage.jsx",
  "pages/IndividualExceptionCenterPage.jsx",
];
const BATCH_F_PAGES = [
  "pages/IndividualCommunicationsPage.jsx",
  "pages/IndividualMediaPresentationPage.jsx",
  "pages/IndividualAwardsExperiencePage.jsx",
  "pages/IndividualCompleteTournamentPage.jsx",
  "pages/IndividualPublicExperiencePage.jsx",
];
const BANNED_VISIBLE = [
  "canonical",
  "payload",
  "writer",
  "SSOT",
  "events[0]",
  "Wave F",
  "prototype",
  "fixture",
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

describe("tournament-experience-wave-f", () => {
  it("SCREENS_01_18_UNCHANGED", () => {
    for (const rel of FROZEN_PAGES) {
      const current = readFileSync(path.join(A1_DIR, rel), "utf8").replaceAll("\r\n", "\n");
      const accepted = execFileSync("git", ["show", `${ACCEPTED_E_HEAD}:src/features/tournament/experience-a1/${rel}`], {
        encoding: "utf8",
        cwd: root,
      }).replaceAll("\r\n", "\n");
      assert.equal(current, accepted, `${rel} must match accepted Screens 01–18 HEAD`);
    }
  });

  it("NO_NEW_EVENTS0_ASSUMPTION", () => {
    const hits = walkJs(path.join(A1_DIR, "batchF"))
      .concat(BATCH_F_PAGES.map((rel) => ({ file: rel, source: readFileSync(path.join(A1_DIR, rel), "utf8") })))
      .filter((item) => item.source.includes("events[0]"));
    assert.deepEqual(hits.map((item) => item.file), []);
  });

  it("SCREEN19_NEW_COMMUNICATION_WRITER=NO", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualCommunicationsPage.jsx"), "utf8");
    for (const banned of ["sendNotification", "createCampaign", "scheduleMessage", "updateTournamentCommand"]) {
      assert.equal(page.includes(banned), false, banned);
    }
  });

  it("SCREEN19_FAKE_CAMPAIGNS=0", () => {
    const model = deriveCommunicationsModel(sampleTournament([{ id: "e-a", name: "Đôi nam", matches: [] }]));
    assert.equal(model.messages.length, 0);
    assert.equal(model.kpis.sentToday, 0);
  });

  it("SCREEN19_TARGETING_AUTHORITY_GATED=PASS", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualCommunicationsPage.jsx"), "utf8");
    assert.ok(page.includes("disabled"));
    assert.ok(page.includes("Chưa hỗ trợ gửi thông báo"));
  });

  it("SCREEN20_PRESENTATION_STATE_ACTIONS_CONSISTENT=PASS", () => {
    const live = resolvePresentationActions(PRESENTATION_SESSION.LIVE);
    assert.equal(live.startEnabled, false);
    assert.equal(live.pauseEnabled, true);
    const paused = resolvePresentationActions(PRESENTATION_SESSION.PAUSED);
    assert.equal(paused.resumeEnabled, true);
    assert.equal(paused.startEnabled, false);
  });

  it("SCREEN20_NEW_MEDIA_SESSION_AUTHORITY=NO", () => {
    const sources = walkJs(path.join(A1_DIR, "batchF")).concat(
      BATCH_F_PAGES.map((rel) => ({ file: rel, source: readFileSync(path.join(A1_DIR, rel), "utf8") }))
    );
    for (const item of sources) {
      assert.equal(item.source.includes("savePresentationSession"), false, item.file);
      assert.equal(item.source.includes("broadcastSession"), false, item.file);
    }
  });

  it("SCREEN20_SCORE_PREVIEW_SINGLE_LINE=PASS", () => {
    assert.equal(normalizeScoreLine("6 - 4"), "6-4");
    assert.equal(normalizeScoreLine("6–4"), "6–4");
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualMediaPresentationPage.jsx"), "utf8");
    assert.ok(page.includes('whiteSpace: "nowrap"'));
    assert.ok(page.includes('data-testid="presentation-live-score"'));
  });

  it("SCREEN21_FAKE_AWARDS=0", () => {
    const model = deriveAwardsModel(sampleTournament([{ id: "e-a", name: "Đôi nam", matches: [] }]), {
      selectedEventId: "e-a",
    });
    assert.equal(model.podium.every((item) => item.pair === "Chưa xác định" || item.status === "NOT_READY" || item.status === "CONFIRMED"), true);
  });

  it("SCREEN21_NEW_AWARD_WRITER=NO", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualAwardsExperiencePage.jsx"), "utf8");
    assert.equal(page.includes("assignAward"), false);
    assert.equal(page.includes("publishAwards"), false);
    assert.ok(page.includes("disabled"));
  });

  it("SCREEN21_PODIUM_REAL_DATA_ONLY=PASS", () => {
    const tournament = sampleTournament([
      {
        id: "e-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        entries: [{ id: "a1", name: "A / B" }],
        matches: [
          {
            id: "f1",
            stage: MATCH_STAGE.FINAL,
            status: MATCH_STATUS.COMPLETED,
            winnerId: "a1",
            entryAId: "a1",
            entryBId: "b1",
          },
        ],
      },
    ]);
    const model = deriveAwardsModel(tournament, { selectedEventId: "e-a" });
    assert.equal(model.officialResult, true);
  });

  it("SCREEN22_COMPLETION_TOTALS_RECONCILE=PASS", () => {
    const tournament = sampleTournament([
      {
        id: "e-a",
        name: "Đôi nam",
        eventType: EVENT_TYPE.MEN_DOUBLE,
        matches: [
          { id: "m1", status: MATCH_STATUS.COMPLETED },
          { id: "m2", status: MATCH_STATUS.WAITING },
        ],
      },
      {
        id: "e-b",
        name: "Đôi nữ",
        eventType: EVENT_TYPE.WOMEN_DOUBLE,
        matches: [{ id: "m3", status: MATCH_STATUS.COMPLETED }],
      },
    ]);
    const model = deriveCompletionModel(tournament);
    assert.equal(model.eventTotalSum, model.tournamentTotalMatches);
    assert.equal(model.eventTerminalSum, model.tournamentTerminalMatches);
    assert.equal(model.tournamentRemainingMatches, model.tournamentTotalMatches - model.tournamentTerminalMatches);
  });

  it("SCREEN22_NEW_COMPLETION_WRITER=NO", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualCompleteTournamentPage.jsx"), "utf8");
    assert.equal(page.includes("closeTournament"), false);
    assert.equal(page.includes("setTournamentStatusCommand"), false);
    assert.ok(page.includes("disabled"));
  });

  it("SCREEN22_SAVE_LOCK_PUBLISH_COMPLETE_DISTINCT=PASS", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualCompleteTournamentPage.jsx"), "utf8");
    const surfaces = readFileSync(path.join(A1_DIR, "batchF/ExperienceBatchFSurfaces.jsx"), "utf8");
    assert.equal(page.includes("Lưu"), false);
    assert.equal(page.includes("Khóa"), false);
    assert.ok(page.includes("Hoàn tất giải đấu"));
    assert.ok(surfaces.includes("Hoàn tất nội dung"));
  });

  it("SCREEN23_ADMIN_SIDEBAR_VISIBLE=NO", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualPublicExperiencePage.jsx"), "utf8");
    assert.equal(page.includes("MainLayout"), false);
    assert.equal(page.includes("Sidebar"), false);
    assert.ok(page.includes('data-testid="public-site-header"'));
  });

  it("SCREEN23_PUBLIC_PRIVATE_DATA_LEAK=NO", () => {
    const page = readFileSync(path.join(A1_DIR, "pages/IndividualPublicExperiencePage.jsx"), "utf8");
    assert.equal(page.includes("refereeLaunchTo"), false);
    assert.equal(page.includes("tenantId"), false);
    assert.equal(page.includes("operator notes"), false);
  });

  it("SCREEN23_REGISTRATION_CTA_MATCHES_REAL_STATE=PASS", () => {
    const open = resolvePublicRegistrationCta({ status: TOURNAMENT_STATUS.REGISTRATION });
    const closed = resolvePublicRegistrationCta({ status: TOURNAMENT_STATUS.ACTIVE });
    assert.equal(open.label, "Đăng ký ngay");
    assert.equal(closed.label, "Đã đóng đăng ký");
    assert.equal(closed.disabled, true);
  });

  it("PROTOTYPE_FIXTURE_USED=NO and NEW_DOMAIN_AUTHORITY=NO", () => {
    const sources = walkJs(path.join(A1_DIR, "batchF")).concat(
      BATCH_F_PAGES.map((rel) => ({ file: rel, source: readFileSync(path.join(A1_DIR, rel), "utf8") }))
    );
    for (const item of sources) {
      assert.equal(item.source.includes("prototypeFixture"), false, item.file);
      assert.equal(item.source.includes("opsFixture"), false, item.file);
    }
    const classC = BATCH_F_ACTION_MATRIX.filter((row) => row.class === "C");
    assert.ok(classC.length >= 4);
    for (const row of classC) {
      assert.equal(row.mutationPath, null, row.action);
    }
  });

  it("USER_VISIBLE_DEVELOPER_COPY=0 on Batch F pages", () => {
    for (const rel of BATCH_F_PAGES) {
      const source = readFileSync(path.join(A1_DIR, rel), "utf8");
      for (const banned of BANNED_VISIBLE) {
        assert.equal(source.includes(banned), false, `${rel} contains ${banned}`);
      }
    }
  });

  it("does not invent a first-event fallback on Batch F reads", () => {
    const tournament = sampleTournament([
      { id: "e-a", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE, matches: [{ id: "1", status: MATCH_STATUS.WAITING }] },
      { id: "e-b", name: "Đôi nữ", eventType: EVENT_TYPE.WOMEN_DOUBLE, matches: [{ id: "2", status: MATCH_STATUS.WAITING }] },
    ]);
    assert.equal(resolveSelectedEvent(listTournamentEvents(tournament), null), null);
    const publicModel = derivePublicExperienceModel(tournament);
    assert.equal(publicModel.eventCards.length, 2);
  });
});
