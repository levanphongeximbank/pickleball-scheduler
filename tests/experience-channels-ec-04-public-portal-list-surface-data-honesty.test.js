/**
 * EC-04 — Public Portal List-Surface Data Honesty (Tournaments + Rankings).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as ExperienceChannels from "../src/features/experience-channels/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("EC-04 phase marker reuses EC-03 contract and does not claim LIVE cutover", () => {
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC04_PHASE.id, "EC-04");
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC04_PHASE.reusesEc03DataResultContract,
    true
  );
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC04_PHASE.tournamentsRankingsAdapterRemediation,
    true
  );
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC04_PHASE.mockFallbackRemoved, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC04_PHASE.homeDeferred, true);
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC04_PHASE.competitionPublicDetailUntouched,
    true
  );
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC04_PHASE.wiredToRuntimeRouter, false);
});

test("LIVE tournament-shaped result has no fallback; MIXED keeps error metadata", () => {
  const live = ExperienceChannels.createLiveResult({
    data: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS,
  });
  assert.equal(live.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(live.fallbackUsed, false);
  assert.equal(live.fallbackReason, null);
  assert.equal(live.productionReady, true);
  assert.equal(ExperienceChannels.certifyPublicDataResult(live).ok, true);

  const mixed = ExperienceChannels.resolvePublicListDataResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS,
    loadLive: () => {
      throw new Error("tournament live load failed");
    },
    mockData: [{ id: "mock-t1" }, { id: "mock-t2" }, { id: "mock-t3" }],
    minLength: 3,
    allowMockFallback: true,
  });
  assert.equal(mixed.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MIXED);
  assert.equal(mixed.fallbackUsed, true);
  assert.ok(mixed.fallbackReason);
  assert.ok(mixed.error);
  assert.equal(mixed.productionReady, false);
  assert.notEqual(mixed.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);
});

test("Rankings MOCK is not production-ready; error path is not empty SUCCESS", () => {
  const mock = ExperienceChannels.createMockResult({
    data: [
      { rank: 1, name: "A" },
      { rank: 2, name: "B" },
    ],
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS,
  });
  assert.equal(mock.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.equal(mock.productionReady, false);
  assert.equal(mock.fallbackUsed, false);
  assert.ok(Array.isArray(mock.data));
  assert.equal(mock.data[0].rank, 1);
  assert.equal(mock.data[1].rank, 2);
  assert.equal(ExperienceChannels.certifyPublicDataResult(mock).ok, true);

  const noFallback = ExperienceChannels.resolvePublicListDataResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS,
    loadLive: () => {
      throw new Error("leaderboard boom");
    },
    mockData: [],
    minLength: 1,
    allowMockFallback: false,
  });
  assert.equal(noFallback.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.notEqual(noFallback.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.notEqual(noFallback.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.SUCCESS);

  const mixed = ExperienceChannels.resolvePublicListDataResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS,
    loadLive: () => {
      throw new Error("leaderboard boom");
    },
    mockData: [{ rank: 1, name: "Mock" }],
    minLength: 1,
    allowMockFallback: true,
  });
  assert.equal(mixed.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MIXED);
  assert.equal(mixed.fallbackUsed, true);
  assert.ok(mixed.fallbackReason);
  assert.ok(mixed.error);
});

test("Adapters and pages wire honesty without Competition / ranking-calc / infinite retry", () => {
  const adapter = readSrc(
    "src/features/public-portal/services/publicTournamentsRankingsDataSource.js"
  );
  assert.match(adapter, /resolvePublicListDataResult/);
  assert.match(adapter, /getPublicTournamentsResult/);
  assert.match(adapter, /getPublicRankingsResult/);
  assert.match(adapter, /createMockResult/);
  assert.match(adapter, /PUBLIC_PORTAL_SURFACE_ID\.PUBLIC_TOURNAMENTS/);
  assert.match(adapter, /PUBLIC_PORTAL_SURFACE_ID\.PUBLIC_RANKINGS/);
  assert.match(adapter, /isVprRankingEnabled/);
  assert.match(adapter, /queryPublicLeaderboard/);
  assert.doesNotMatch(adapter, /competition-engine/);
  assert.doesNotMatch(adapter, /from\s+["'].*competition-engine/);
  assert.doesNotMatch(adapter, /calculateVprPoints|rebuildLeaderboardFromLedger|scoringEngine/);
  assert.doesNotMatch(adapter, /from\s+["'].*router\.jsx/);
  assert.doesNotMatch(adapter, /AuthProvider|ClubProvider|TenantProvider/);
  assert.doesNotMatch(adapter, /setInterval|while\s*\(true\)/);
  assert.doesNotMatch(adapter, /catch\s*\{\s*\/\/ Fall back to mock/);
  assert.doesNotMatch(adapter, /withFallback\s*\(/);

  const tournamentsPage = readSrc("src/pages/public/TournamentsPage.jsx");
  const rankingsPage = readSrc("src/pages/public/RankingsPage.jsx");
  for (const src of [tournamentsPage, rankingsPage]) {
    assert.match(src, /PublicDataSourceNotice/);
    assert.match(src, /PublicErrorState/);
    assert.match(src, /PublicEmptyState/);
    assert.match(src, /PublicUnavailableState/);
    assert.match(src, /retryToken|Thử lại/);
    assert.match(src, /publicTournamentsRankingsDataSource/);
    assert.doesNotMatch(src, /competition-engine/);
    assert.doesNotMatch(src, /setInterval|while\s*\(true\)/);
  }

  assert.doesNotMatch(tournamentsPage, /IndividualTournamentPublic/);
  assert.doesNotMatch(rankingsPage, /calculateVprPoints|rebuildLeaderboardFromLedger/);

  const notice = readSrc("src/components/public/states/PublicDataSourceNotice.jsx");
  assert.match(notice, /role="status"/);
  assert.match(notice, /aria-live="polite"/);
});

test("No duplicate PublicDataResult contract; facade re-exports; Competition detail untouched", () => {
  const contract = readSrc(
    "src/features/experience-channels/public-portal/data-source/publicDataResult.js"
  );
  assert.doesNotMatch(contract, /from\s+["'].*router\.jsx/);
  assert.doesNotMatch(contract, /competition-engine/);

  const facade = readSrc("src/features/public-portal/services/publicPortalService.js");
  assert.match(facade, /publicTournamentsRankingsDataSource/);
  assert.match(facade, /publicClubsCourtsDataSource/);
  assert.doesNotMatch(facade, /withFallback\s*\(/);
  assert.doesNotMatch(facade, /MOCK_TOURNAMENTS|MOCK_RANKINGS/);

  assert.match(readSrc("docs/experience-channels/ec-04/README.md"), /EC-04/);
  assert.match(
    readSrc("docs/experience-channels/ec-04/00_EC_04_LIST_SURFACE_DATA_HONESTY_REPORT.md"),
    /Silent-fallback/
  );

  assert.equal(ExperienceChannels.certifyExperienceChannelRegistry().ok, true);
  assert.equal(ExperienceChannels.certifyPublicPortalReadiness().ok, true);

  const tournamentPublic = ExperienceChannels.getPublicPortalBoundaryMarker(
    ExperienceChannels.PUBLIC_PORTAL_BOUNDARY_ID.TOURNAMENT_PUBLIC_VIEW
  );
  assert.equal(tournamentPublic.safeForRemediation, false);

  const tournaments = ExperienceChannels.getPublicPortalSurface(
    ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS
  );
  const rankings = ExperienceChannels.getPublicPortalSurface(
    ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS
  );
  assert.match(String(tournaments.dataSourceNotes), /EC-04/);
  assert.match(String(rankings.dataSourceNotes), /EC-04/);
});
