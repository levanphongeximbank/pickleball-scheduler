import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { TOURNAMENT_ROUTES } from "../src/config/tournamentRoutes.js";
import { TOURNAMENT_IN_PAGE_NAV } from "../src/config/v5Menu/tournamentInPageNav.js";
import { TOURNAMENT_MODE, EVENT_TYPE } from "../src/models/tournament/constants.js";
import {
  isTournamentExperienceA1Enabled,
  isA1LegacyHubRequested,
} from "../src/features/tournament/experience-a1/flags.js";
import {
  deriveOverviewModel,
  deriveOverviewVisual,
  listTournamentEvents,
  resolveSelectedEvent,
} from "../src/features/tournament/experience-a1/deriveOverview.js";
import {
  A1_SETTINGS_WRITER,
  buildAddOfficialEventPatch,
  buildIdentityPatch,
  buildUpdateEventPatch,
} from "../src/features/tournament/experience-a1/settingsWriters.js";
import {
  individualOverviewPath,
  individualSettingsPath,
  resolveA1OpenPath,
} from "../src/features/tournament/experience-a1/routes.js";
import {
  deriveAttentionItems,
  deriveCenterCard,
  deriveCenterKpis,
  filterCenterTournaments,
} from "../src/features/tournament/experience-a1/visual/centerListModel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A1_DIR = path.join(root, "src/features/tournament/experience-a1");

function readA1Sources() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(A1_DIR);
  return files.map((file) => ({
    file: path.relative(root, file).replaceAll("\\", "/"),
    source: readFileSync(file, "utf8"),
  }));
}

function collectInPagePaths(nav = TOURNAMENT_IN_PAGE_NAV) {
  const paths = [];
  for (const hub of Object.values(nav)) {
    for (const section of hub.sections || []) {
      for (const item of section.items || []) {
        paths.push({ key: item.key, text: item.text, path: item.path });
      }
    }
  }
  return paths;
}

describe("tournament-experience-wave-a1", () => {
  it("FALSE_FRIEND_DIRECTOR_REMOVED", () => {
    assert.notEqual(TOURNAMENT_ROUTES.director, "/court-engine");
    assert.equal(TOURNAMENT_ROUTES.director, "/tournament/organize");
    const directorItem = collectInPagePaths().find((item) => item.key === "tournament-director");
    assert.ok(directorItem);
    assert.notEqual(directorItem.path, "/court-engine");
  });

  it("FALSE_FRIEND_PAIRING_REMOVED", () => {
    assert.notEqual(TOURNAMENT_ROUTES.pairing, "/select-players");
    assert.equal(TOURNAMENT_ROUTES.pairing, "/tournament/organize");
    const pairingItem = collectInPagePaths().find((item) => item.key === "tournament-pairing");
    assert.ok(pairingItem);
    assert.notEqual(pairingItem.path, "/select-players");
  });

  it("FALSE_FRIEND_RESULTS_REMOVED", () => {
    assert.notEqual(TOURNAMENT_ROUTES.resultsScoreboard, "/statistics?view=scoreboard");
    assert.notEqual(TOURNAMENT_ROUTES.resultsRankings, "/statistics?view=rankings");
    assert.notEqual(TOURNAMENT_ROUTES.resultsPlayers, "/statistics?view=players");
    const exportItem = collectInPagePaths().find((item) => item.key === "tournament-export-results");
    assert.ok(exportItem);
    assert.notEqual(exportItem.path, "/statistics");
  });

  it("NO_NEW_EVENTS0_ASSUMPTION_IN_A1", () => {
    const hits = readA1Sources().filter((item) => item.source.includes("events[0]"));
    assert.deepEqual(
      hits.map((item) => item.file),
      [],
      "A1 sources must not use events[0]"
    );
  });

  it("SCREEN_02_NO_WRITE_CONTROL_REQUIRING_NEW_AUTHORITY", () => {
    const overview = readFileSync(
      path.join(A1_DIR, "pages/IndividualOverviewPage.jsx"),
      "utf8"
    );
    for (const banned of [
      "updateTournamentCommand",
      "lockRegistration",
      "lockDraw",
      "publishDraw",
      "publishSchedule",
      "closeTournament",
      "useCanonicalTournament(",
    ]) {
      if (banned === "useCanonicalTournament(") {
        assert.ok(overview.includes("useCanonicalTournament"), "overview may read");
        assert.equal(overview.includes(".update("), false);
        continue;
      }
      assert.equal(overview.includes(banned), false, `overview must not call ${banned}`);
    }
    assert.equal(overview.includes("SCREEN_02_WRITE"), false);
  });

  it("SCREEN_03_WRITER_PATHS_UNCHANGED", () => {
    assert.equal(A1_SETTINGS_WRITER.command, "updateTournamentCommand");
    const settings = readFileSync(
      path.join(A1_DIR, "pages/IndividualSettingsPage.jsx"),
      "utf8"
    );
    assert.ok(settings.includes("useCanonicalTournament"));
    assert.ok(settings.includes("buildAddOfficialEventPatch"));
    assert.ok(settings.includes("await update(patch)"));
    assert.equal(settings.includes("lockRegistration"), false);
    assert.equal(settings.includes("closeTournament"), false);
    const identity = buildIdentityPatch({ name: "PICK Test", hostClubName: "CLB A" });
    assert.deepEqual(identity, { name: "PICK Test", hostClubName: "CLB A" });
  });

  it("Official multi-Nội-dung rendering uses the full events array", () => {
    const tournament = {
      id: "t-open",
      name: "Giải mở",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      status: "registration",
      events: [
        { id: "e-a", name: "Đôi nam 3.5", eventType: EVENT_TYPE.MEN_DOUBLE, entries: [{ id: "1" }], matches: [] },
        { id: "e-b", name: "Đôi nữ 3.5", eventType: EVENT_TYPE.WOMEN_DOUBLE, entries: [], matches: [] },
        { id: "e-c", name: "Mixed 3.5", eventType: EVENT_TYPE.MIXED_DOUBLE, entries: [{ id: "2" }, { id: "3" }], matches: [{ status: "completed" }] },
      ],
    };
    const events = listTournamentEvents(tournament);
    assert.equal(events.length, 3);
    assert.equal(resolveSelectedEvent(events, null), null);
    assert.equal(resolveSelectedEvent(events, "e-b")?.name, "Đôi nữ 3.5");
    const model = deriveOverviewModel(tournament);
    assert.equal(model.eventCount, 3);
    assert.deepEqual(
      model.events.map((event) => event.id),
      ["e-a", "e-b", "e-c"]
    );
    assert.equal(model.kpis.entryCount, 3);
    assert.equal(model.kpis.completedMatchCount, 1);
    assert.equal(model.compatibility.officialMultiContent, true);
  });

  it("Internal compatibility remains single-content without inventing extras", () => {
    const tournament = {
      id: "t-internal",
      name: "Giải nội bộ",
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      status: "draft",
      events: [{ id: "only", name: "Đôi nam nữ", eventType: EVENT_TYPE.MIXED_DOUBLE, entries: [], matches: [] }],
    };
    const model = deriveOverviewModel(tournament);
    assert.equal(model.compatibility.internalSingleContent, true);
    assert.equal(resolveSelectedEvent(model.events, ""), model.events[0]);
    assert.equal(resolveA1OpenPath(tournament), "/tournament/t-internal/overview");
  });

  it("A1 routing helpers and flag rollback", () => {
    assert.equal(individualOverviewPath("abc"), "/tournament/abc/overview");
    assert.equal(individualSettingsPath("abc", "e1"), "/tournament/abc/settings?eventId=e1");
    assert.equal(isTournamentExperienceA1Enabled({ VITE_TOURNAMENT_EXPERIENCE_A1_ENABLED: "false" }), false);
    assert.equal(isTournamentExperienceA1Enabled({ VITE_TOURNAMENT_EXPERIENCE_A1_ENABLED: "true" }), true);
    assert.equal(isA1LegacyHubRequested({ get: () => "legacy" }), true);
    const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
    assert.ok(router.includes("/tournament/:tournamentId/overview"));
    assert.ok(router.includes("/tournament/:tournamentId/settings"));
    const shell = readFileSync(path.join(root, "src/pages/tournament/TournamentShell.jsx"), "utf8");
    assert.ok(shell.includes("TournamentCenterExperiencePage"));
    assert.ok(shell.includes("CanonicalTournamentHubPage"));
  });

  it("workspace is stacked on mobile and two-column on desktop", () => {
    const source = readFileSync(
      path.join(A1_DIR, "components/TournamentExperienceWorkspace.jsx"),
      "utf8"
    );
    assert.ok(source.includes('xs: "1fr"'));
    assert.ok(source.includes("lg:"));
    assert.ok(source.includes("overflowX: \"hidden\""));
  });

  it("add official event uses existing engine helpers", () => {
    const tournament = {
      id: "t1",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      events: [{ id: "keep", name: "Đôi nam", eventType: EVENT_TYPE.MEN_DOUBLE }],
    };
    const { patch, event } = buildAddOfficialEventPatch(tournament, EVENT_TYPE.WOMEN_DOUBLE);
    assert.equal(patch.events.length, 2);
    assert.equal(event.eventType, EVENT_TYPE.WOMEN_DOUBLE);
    const updated = buildUpdateEventPatch(
      { ...tournament, events: patch.events },
      event.id,
      { name: "Đôi nữ 4.0" }
    );
    assert.equal(updated.ok, true);
    const renamed = updated.patch.events.find((item) => item.id === event.id);
    assert.equal(renamed.name, "Đôi nữ 4.0");
  });

  it("does not copy prototype fixtures into A1 production UI", () => {
    const fixtures = [
      "184 VĐV",
      "268 trận",
      "Cụm sân Nam Long",
      "PICK VN OPEN 2026",
      "prototypeFixture",
      "FIXTURE_TOURNAMENTS",
      "+14%",
      "+9%",
      "+20%",
      "-25%",
    ];
    for (const item of readA1Sources()) {
      for (const needle of fixtures) {
        assert.equal(item.source.includes(needle), false, `${item.file} contains ${needle}`);
      }
    }
  });

  it("SCREEN_01_REAL_CANONICAL_LIST_BINDING", () => {
    const center = readFileSync(path.join(A1_DIR, "pages/TournamentCenterExperiencePage.jsx"), "utf8");
    assert.ok(center.includes("useCanonicalTournamentList"));
    assert.ok(center.includes("deriveCenterKpis(tournaments)"));
    assert.ok(center.includes("navigate(TOURNAMENT_ROUTES.create)"));
    assert.equal(center.includes("prototypeFixture"), false);
    assert.equal(center.includes("FIXTURE_TOURNAMENTS"), false);
  });

  it("NO_USER_VISIBLE_DEVELOPER_COPY", () => {
    const pages = [
      "pages/TournamentCenterExperiencePage.jsx",
      "pages/IndividualOverviewPage.jsx",
      "pages/IndividualSettingsPage.jsx",
      "visual/CenterPageHeader.jsx",
      "visual/ExperiencePageHeader.jsx",
      "visual/ExperienceHero.jsx",
    ].map((file) => readFileSync(path.join(A1_DIR, file), "utf8"));
    const joined = pages.join("\n");
    for (const needle of [
      "Phạm vi hiện tại",
      "trang hiện có",
      "dữ liệu mẫu",
      "Giao diện cũ",
      "canonical_tournament_list",
      "canonical_tournament_update",
      "updateTournamentCommand",
      "Production authority",
      "read source",
      "legacy route",
      "Wave A1",
      "official_open",
      "internal_tournament",
      "prototypeFixture",
    ]) {
      assert.equal(joined.includes(needle), false, needle);
    }
  });

  it("ZERO_DATA_STATE keeps Screen 01 structure", () => {
    const kpis = deriveCenterKpis([]);
    assert.deepEqual(kpis, { ongoing: 0, upcoming: 0, registering: 0, attention: 0 });
    assert.deepEqual(deriveAttentionItems([]), []);
    const center = readFileSync(path.join(A1_DIR, "pages/TournamentCenterExperiencePage.jsx"), "utf8");
    assert.ok(center.includes("Chưa có giải đấu"));
    assert.ok(center.includes("Đang diễn ra"));
    assert.ok(center.includes("Sắp diễn ra"));
    assert.ok(center.includes("Đang đăng ký"));
    assert.ok(center.includes("Cần xử lý"));
    assert.ok(center.includes("Giải nội bộ"));
    assert.ok(center.includes("Chính thức / Mở rộng"));
    assert.ok(center.includes("tournament-center-empty"));
    assert.equal(center.includes("<Alert severity=\"info\">Không có giải"), false);
  });

  it("TOURNAMENT_CREATE_BEHAVIOR_UNCHANGED", () => {
    const center = readFileSync(path.join(A1_DIR, "pages/TournamentCenterExperiencePage.jsx"), "utf8");
    assert.ok(center.includes("TOURNAMENT_ROUTES.create"));
    assert.equal(center.includes("createTournamentCommand"), false);
    assert.equal(TOURNAMENT_ROUTES.create, "/tournament/create");
  });

  it("SCREEN_02_UNCHANGED writer and read-only contract", () => {
    const overview = readFileSync(path.join(A1_DIR, "pages/IndividualOverviewPage.jsx"), "utf8");
    assert.ok(overview.includes("deriveOverviewVisual"));
    assert.ok(overview.includes("useCanonicalTournament"));
    assert.ok(overview.includes("ExperienceHero"));
    assert.ok(overview.includes("CenterKpiCard"));
    assert.ok(overview.includes("Vòng đời giải đấu"));
    assert.ok(overview.includes("Trận đấu đang diễn ra"));
    assert.equal(overview.includes(".update("), false);
    assert.equal(overview.includes("createTournamentCommand"), false);
    assert.equal(overview.includes("TournamentPageHeader"), false);
  });

  it("SCREEN_03_UNCHANGED writer path", () => {
    const settings = readFileSync(path.join(A1_DIR, "pages/IndividualSettingsPage.jsx"), "utf8");
    assert.ok(settings.includes("await update(patch)"));
    assert.ok(settings.includes("Lưu nháp"));
    assert.ok(settings.includes("Thiết kế thể thức"));
    assert.ok(settings.includes("Phạm vi cấu hình"));
    assert.equal(A1_SETTINGS_WRITER.command, "updateTournamentCommand");
    assert.equal(settings.includes("lockRegistration"), false);
    assert.equal(settings.includes("updateTournamentCommand"), false);
  });

  it("center list helpers bind real tournament fields only", () => {
    const tournament = {
      id: "t1",
      name: "Giải CLB A",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      status: "draft",
      hostClubName: "CLB Thật",
      events: [
        {
          id: "e1",
          entries: [{ id: "p1" }],
          matches: [{ status: "completed" }, { status: "waiting" }],
        },
      ],
    };
    const kpis = deriveCenterKpis([tournament, { status: "active" }, { status: "registration" }]);
    assert.equal(kpis.attention, 1);
    assert.equal(kpis.ongoing, 1);
    assert.equal(kpis.registering, 1);
    const card = deriveCenterCard(tournament, { clubName: "Fallback" });
    assert.equal(card.athletes, 1);
    assert.equal(card.events, 1);
    assert.equal(card.matches, 2);
    assert.equal(card.progress, 50);
    assert.equal(card.location, "CLB Thật");
    const filtered = filterCenterTournaments([tournament], { filterKey: "active" });
    assert.equal(filtered.length, 0);
  });

  it("SCREEN_02 visual model keeps all events and honest empty ops", () => {
    const tournament = {
      id: "t-open",
      name: "Giải mở",
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      status: "active",
      hostClubName: "CLB Thật",
      events: [
        {
          id: "e-a",
          name: "Đôi nam",
          eventType: EVENT_TYPE.MEN_DOUBLE,
          entries: [{ id: "1", name: "Cặp A", playerIds: ["p1", "p2"] }],
          matches: [{ id: "m1", status: "playing", entryAId: "1", scoreA: 6, scoreB: 4 }],
        },
        {
          id: "e-b",
          name: "Đôi nữ",
          eventType: EVENT_TYPE.WOMEN_DOUBLE,
          entries: [],
          matches: [],
        },
      ],
    };
    const visual = deriveOverviewVisual(tournament);
    assert.equal(visual.eventCards.length, 2);
    assert.equal(visual.ops.playing, 1);
    assert.equal(visual.liveMatches.length, 1);
    assert.equal(visual.liveMatches[0].a, "Cặp A");
    assert.ok(visual.attention.some((item) => item.label.includes("Đôi nữ")));
    assert.equal(visual.heroStatusLabel, "ĐANG DIỄN RA");
    assert.equal(visual.lifecycle.some((step) => step.id === "compete" && step.state === "current"), true);
  });
});
