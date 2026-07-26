/**
 * EC-05 — Public Portal Home Data-Source Honesty.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as ExperienceChannels from "../src/features/experience-channels/index.js";
import {
  PUBLIC_HOME_SECTION_ID,
  getPublicHomeFeaturedClubsResult,
  getPublicHomeFeaturedCourtsResult,
  getPublicHomeFeaturedTournamentsResult,
  getPublicHomeLiveScoresResult,
  getPublicHomeResultsResult,
  getPublicHomeScheduleResult,
  getPublicHomeSponsorsResult,
  getPublicHomeStatsResult,
  getPublicHomeSyncSections,
  getPublicHomeUpcomingEventsResult,
  projectHomeNewsSection,
} from "../src/features/public-portal/services/publicHomeDataSource.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** NEWS-04 literals for projection tests (avoid importing supabase-backed news service). */
const PUBLIC_NEWS_SOURCE = Object.freeze({
  LIVE: "live",
  MOCK: "mock",
  PREVIEW: "preview",
});
const PUBLIC_NEWS_STATUS = Object.freeze({
  OK: "ok",
  EMPTY: "empty",
  ERROR: "error",
});

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("EC-05 phase marker reuses EC-03 contract and does not claim LIVE cutover", () => {
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC05_PHASE.id, "EC-05");
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC05_PHASE.reusesEc03DataResultContract,
    true
  );
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC05_PHASE.reusesEc02PresentationStates,
    true
  );
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC05_PHASE.reusesEc03Ec04ListAdapters,
    true
  );
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC05_PHASE.homeDataHonestyRemediation,
    true
  );
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC05_PHASE.mockFallbackRemoved, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC05_PHASE.liveCutover, false);
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC05_PHASE.competitionEngineUntouched,
    true
  );
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC05_PHASE.wiredToRuntimeRouter, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC04_PHASE.homeDeferred, true);
});

test("Home mock sections are MOCK and not productionReady", () => {
  for (const result of [
    getPublicHomeLiveScoresResult(),
    getPublicHomeScheduleResult(),
    getPublicHomeResultsResult(),
    getPublicHomeUpcomingEventsResult(),
    getPublicHomeSponsorsResult(),
  ]) {
    assert.equal(result.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK);
    assert.equal(result.productionReady, false);
    assert.ok(result.sectionId);
    assert.equal(ExperienceChannels.certifyPublicDataResult(result).ok, true);
  }
});

test("Featured Clubs/Courts/Tournaments reuse EC-03/04 adapters without mutating source", () => {
  const clubs = getPublicHomeFeaturedClubsResult(5);
  const courts = getPublicHomeFeaturedCourtsResult(4);
  const tournaments = getPublicHomeFeaturedTournamentsResult(4);

  assert.equal(clubs.sectionId, PUBLIC_HOME_SECTION_ID.FEATURED_CLUBS);
  assert.equal(courts.sectionId, PUBLIC_HOME_SECTION_ID.FEATURED_COURTS);
  assert.equal(tournaments.sectionId, PUBLIC_HOME_SECTION_ID.FEATURED_TOURNAMENTS);

  for (const result of [clubs, courts, tournaments]) {
    assert.ok(
      [
        ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE,
        ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MIXED,
        ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK,
      ].includes(result.source)
    );
    if (result.source === ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MIXED) {
      assert.equal(result.fallbackUsed, true);
      assert.ok(result.fallbackReason);
      assert.equal(result.productionReady, false);
    }
    if (result.source !== ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE) {
      assert.equal(result.productionReady, false);
    }
    assert.equal(ExperienceChannels.certifyPublicDataResult(result).ok, true);
  }

  assert.doesNotMatch(
    readSrc("src/features/public-portal/services/publicHomeDataSource.js"),
    /competition-engine|calculateVprPoints|rebuildLeaderboardFromLedger|scoringEngine/
  );
});

test("Stats result never hard-codes LIVE for mock fallback; errors are not EMPTY", () => {
  const stats = getPublicHomeStatsResult();
  assert.equal(stats.sectionId, PUBLIC_HOME_SECTION_ID.STATS);
  assert.notEqual(stats.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN);
  if (stats.source === ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK) {
    assert.equal(stats.productionReady, false);
  }
  if (stats.source === ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE) {
    assert.equal(stats.fallbackUsed, false);
    assert.equal(stats.fallbackReason, null);
  }
  assert.notEqual(stats.status, undefined);
  assert.equal(ExperienceChannels.certifyPublicDataResult(stats).ok, true);
});

test("News error projects ERROR not empty SUCCESS; empty differs from error; unavailable differs", () => {
  const errorProjected = projectHomeNewsSection({
    status: PUBLIC_NEWS_STATUS.ERROR,
    items: [],
    source: PUBLIC_NEWS_SOURCE.LIVE,
    error: { code: "PUBLIC_NEWS_NETWORK_FAILURE", message: "boom", userMessage: "Lỗi mạng" },
  });
  assert.equal(errorProjected.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.notEqual(errorProjected.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.notEqual(errorProjected.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.SUCCESS);
  assert.ok(errorProjected.error);
  assert.equal(errorProjected.productionReady, false);

  const emptyProjected = projectHomeNewsSection({
    status: PUBLIC_NEWS_STATUS.EMPTY,
    items: [],
    source: PUBLIC_NEWS_SOURCE.LIVE,
    error: null,
  });
  assert.equal(emptyProjected.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.notEqual(emptyProjected.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.ERROR);

  const unavailable = projectHomeNewsSection(null);
  assert.equal(unavailable.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE);
  assert.notEqual(unavailable.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);

  const mockNews = projectHomeNewsSection({
    status: PUBLIC_NEWS_STATUS.OK,
    items: [{ id: "n1", type: "article" }],
    source: PUBLIC_NEWS_SOURCE.MOCK,
    error: null,
  });
  assert.equal(mockNews.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.equal(mockNews.productionReady, false);
});

test("One section error does not rewrite successful sibling sections", () => {
  const sections = getPublicHomeSyncSections();
  assert.ok(sections.sponsors);
  assert.ok(sections.liveScores);
  assert.equal(sections.sponsors.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.equal(sections.liveScores.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.equal(sections.sponsors.sectionId, PUBLIC_HOME_SECTION_ID.SPONSORS);
  assert.equal(sections.liveScores.sectionId, PUBLIC_HOME_SECTION_ID.LIVE_SCORES);
  assert.notEqual(sections.sponsors.sectionId, sections.liveScores.sectionId);
});

test("Home adapter and page wire honesty without Competition / infinite retry / duplicate contract", () => {
  const adapter = readSrc("src/features/public-portal/services/publicHomeDataSource.js");
  assert.match(adapter, /getPublicClubsResult/);
  assert.match(adapter, /getPublicCourtsResult/);
  assert.match(adapter, /getPublicTournamentsResult/);
  assert.match(adapter, /createMockResult|createLiveResult|createErrorResult/);
  assert.match(adapter, /PUBLIC_PORTAL_SURFACE_ID\.PUBLIC_HOME/);
  assert.doesNotMatch(adapter, /competition-engine/);
  assert.doesNotMatch(adapter, /from\s+["'].*competition-engine/);
  assert.doesNotMatch(adapter, /calculateVprPoints|rebuildLeaderboardFromLedger|scoringEngine/);
  assert.doesNotMatch(adapter, /from\s+["'].*router\.jsx/);
  assert.doesNotMatch(adapter, /AuthProvider|ClubProvider|TenantProvider/);
  assert.doesNotMatch(adapter, /setInterval|while\s*\(true\)/);
  assert.doesNotMatch(adapter, /createPublicDataResult\s*=/);

  const home = readSrc("src/pages/public/HomePage.jsx");
  assert.match(home, /PublicDataSourceNotice/);
  assert.match(home, /PublicErrorState/);
  assert.match(home, /PublicEmptyState/);
  assert.match(home, /PublicUnavailableState/);
  assert.match(home, /PublicLoadingState/);
  assert.match(home, /retryToken|Thử lại/);
  assert.match(home, /publicHomeDataSource/);
  assert.match(home, /getPublicHomeSyncSections/);
  assert.doesNotMatch(home, /competition-engine/);
  assert.doesNotMatch(home, /setInterval|while\s*\(true\)/);
  assert.doesNotMatch(home, /MOCK_UPCOMING_EVENTS/);
  assert.doesNotMatch(home, /getPublicNewsItemsOrEmpty/);
  assert.doesNotMatch(home, /LIVE SCORE|LỊCH THI ĐẤU HÔM NAY|KẾT QUẢ MỚI NHẤT|Sự kiện sắp diễn ra/);

  const hub = readSrc("src/components/public/sections/LiveDataHubSection.jsx");
  assert.match(hub, /TỶ SỐ MẪU|LỊCH MẪU|KẾT QUẢ MẪU/);
  assert.match(hub, /PublicDataSourceNotice/);
  assert.doesNotMatch(hub, /LIVE SCORE|LỊCH THI ĐẤU HÔM NAY|KẾT QUẢ MỚI NHẤT/);
  assert.doesNotMatch(hub, /animation:\s*["']pulse/);
  assert.doesNotMatch(hub, /MOCK_SCHEDULE|MOCK_RESULTS/);

  const notice = readSrc("src/components/public/states/PublicDataSourceNotice.jsx");
  assert.match(notice, /role="status"/);
  assert.match(notice, /aria-live="polite"/);

  const facade = readSrc("src/features/public-portal/services/publicPortalService.js");
  assert.match(facade, /publicHomeDataSource/);

  assert.match(readSrc("docs/experience-channels/ec-05/README.md"), /EC-05/);
  assert.match(
    readSrc("docs/experience-channels/ec-05/00_EC_05_HOME_DATA_SOURCE_HONESTY_REPORT.md"),
    /Silent-fallback/
  );

  assert.equal(ExperienceChannels.certifyExperienceChannelRegistry().ok, true);
  assert.equal(ExperienceChannels.certifyPublicPortalReadiness().ok, true);

  const homeSurface = ExperienceChannels.getPublicPortalSurface(
    ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_HOME
  );
  assert.match(String(homeSurface.dataSourceNotes), /EC-05/);
  assert.equal(homeSurface.dataSource, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MIXED);
});

test("No duplicate PublicDataResult contract file introduced by EC-05", () => {
  const adapter = readSrc("src/features/public-portal/services/publicHomeDataSource.js");
  assert.match(
    adapter,
    /from\s+["'].*experience-channels\/public-portal\/data-source/
  );
  assert.doesNotMatch(adapter, /function\s+createLiveResult|function\s+createMockResult/);
});
