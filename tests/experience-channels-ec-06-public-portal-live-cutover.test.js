/**
 * EC-06 — Public Portal Certified LIVE Cutover audit lock.
 * Deterministic — no network. Proves zero certified cutovers and no forced LIVE.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as ExperienceChannels from "../src/features/experience-channels/index.js";
import {
  PUBLIC_HOME_SECTION_ID,
  getPublicHomeLiveScoresResult,
  getPublicHomeResultsResult,
  getPublicHomeScheduleResult,
  getPublicHomeSponsorsResult,
  getPublicHomeUpcomingEventsResult,
  projectHomeNewsSection,
} from "../src/features/public-portal/services/publicHomeDataSource.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const C = ExperienceChannels.PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION;

const EVIDENCE_COACHING =
  "docs/coaching-training/coaching-03/evidence/APPLY_REFUSED.json";
const EVIDENCE_PM =
  "docs/player-management/pm-id-01/activation/evidence/APPLY_REFUSED_NO_GO.json";

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256File(rel) {
  const buf = readFileSync(path.join(ROOT, rel));
  return createHash("sha256").update(buf).digest("hex").toUpperCase();
}

function gitPorcelainFor(...rels) {
  return execFileSync("git", ["status", "--porcelain", "--", ...rels], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
}

test("EC-06 phase marker: audit complete, zero certified cutovers, no forced LIVE", () => {
  const phase = ExperienceChannels.EXPERIENCE_CHANNELS_EC06_PHASE;
  assert.equal(phase.id, "EC-06");
  assert.equal(phase.auditComplete, true);
  assert.equal(phase.certifiedLiveCutoverCount, 0);
  assert.equal(phase.mockFallbackRemoved, false);
  assert.equal(phase.liveCutover, false);
  assert.equal(phase.forcedUncertifiedLive, false);
  assert.equal(phase.reusesEc02PresentationStates, true);
  assert.equal(phase.reusesEc03DataResultContract, true);
  assert.equal(phase.reusesEc03Ec04Ec05Adapters, true);
  assert.equal(phase.competitionEngineUntouched, true);
  assert.equal(phase.wiredToRuntimeRouter, false);
});

test("EC-06 certifyPublicPortalLiveCutover returns audit-complete no-cutover verdict", () => {
  const result = ExperienceChannels.certifyPublicPortalLiveCutover();
  assert.equal(result.ok, true);
  assert.equal(result.auditComplete, true);
  assert.equal(result.certifiedCutoverCount, 0);
  assert.equal(result.verdict, "EC_06_AUDIT_COMPLETE_NO_CERTIFIED_CUTOVER");
  assert.equal(ExperienceChannels.listCertifiedLiveCutoverRows().length, 0);
  assert.ok(result.matrixSize >= 10);
});

test("EC-06 matrix classifications cover required audit surfaces", () => {
  const matrix = ExperienceChannels.listPublicPortalLiveCutoverMatrix();
  const byId = Object.fromEntries(matrix.map((row) => [row.id, row]));

  assert.equal(byId["public-clubs"]?.classification, C.NO_REMOTE_SOURCE);
  assert.equal(byId["public-courts"]?.classification, C.NO_REMOTE_SOURCE);
  assert.equal(byId["public-tournaments"]?.classification, C.NO_REMOTE_SOURCE);
  assert.equal(byId["public-rankings"]?.classification, C.LIVE_SOURCE_NOT_CERTIFIED);
  assert.equal(byId["public-home"]?.classification, C.LIVE_SOURCE_NOT_CERTIFIED);
  assert.equal(byId["public-news"]?.classification, C.ALREADY_LIVE_NO_CHANGE);
  assert.equal(
    byId[PUBLIC_HOME_SECTION_ID.LIVE_SCORES]?.classification,
    C.MOCK_WITH_HONEST_PROVENANCE
  );
  assert.equal(byId[PUBLIC_HOME_SECTION_ID.NEWS]?.classification, C.ALREADY_LIVE_NO_CHANGE);
  assert.equal(
    byId[ExperienceChannels.PUBLIC_PORTAL_BOUNDARY_ID.TOURNAMENT_PUBLIC_VIEW]
      ?.classification,
    C.HIGH_COLLISION_DEFERRED
  );

  for (const row of matrix) {
    assert.equal(row.implementCutover, false, row.id);
    assert.notEqual(row.classification, C.CERTIFIED_LIVE_CUTOVER, row.id);
  }
});

test("EC-06 uncertified list adapters retain allowMockFallback true", () => {
  const clubs = readSrc(
    "src/features/public-portal/services/publicClubsCourtsDataSource.js"
  );
  const tournaments = readSrc(
    "src/features/public-portal/services/publicTournamentsRankingsDataSource.js"
  );
  assert.match(clubs, /allowMockFallback:\s*true/);
  assert.match(tournaments, /allowMockFallback:\s*true/);
  assert.doesNotMatch(clubs, /allowMockFallback:\s*false/);
  assert.doesNotMatch(tournaments, /allowMockFallback:\s*false/);
});

test("EC-06 live failure path without mock fallback returns ERROR not empty success", () => {
  const errorResult = ExperienceChannels.resolvePublicListDataResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    loadLive: () => {
      throw new Error("simulated live failure");
    },
    mockData: [{ id: "mock-1" }],
    minLength: 1,
    allowMockFallback: false,
  });
  assert.equal(errorResult.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.equal(errorResult.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(errorResult.fallbackUsed, false);
  assert.ok(errorResult.error);
  assert.notEqual(errorResult.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.notEqual(errorResult.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.SUCCESS);
});

test("EC-06 MIXED mock fallback cannot claim productionReady; empty LIVE is not SUCCESS", () => {
  const mixed = ExperienceChannels.resolvePublicListDataResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
    loadLive: () => {
      throw new Error("boom");
    },
    mockData: [{ id: "m1" }, { id: "m2" }],
    minLength: 2,
    allowMockFallback: true,
  });
  assert.equal(mixed.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MIXED);
  assert.equal(mixed.fallbackUsed, true);
  assert.equal(mixed.productionReady, false);

  const emptyLive = ExperienceChannels.resolvePublicListDataResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS,
    loadLive: () => [],
    mockData: [{ id: "t-mock" }],
    minLength: 1,
    allowMockFallback: false,
  });
  assert.equal(emptyLive.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(emptyLive.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.equal(emptyLive.productionReady, false);
});

test("EC-06 Home mock sections keep MOCK provenance; news error is not empty success", () => {
  for (const result of [
    getPublicHomeLiveScoresResult(),
    getPublicHomeScheduleResult(),
    getPublicHomeResultsResult(),
    getPublicHomeUpcomingEventsResult(),
    getPublicHomeSponsorsResult(),
  ]) {
    assert.equal(result.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK);
    assert.equal(result.productionReady, false);
    assert.equal(result.fallbackUsed, false);
  }

  const newsError = projectHomeNewsSection({
    status: "error",
    source: "live",
    items: [],
    error: { code: "PUBLIC_NEWS_RPC_FAILURE", userMessage: "fail" },
  });
  assert.equal(newsError.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.notEqual(newsError.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.equal(newsError.productionReady, false);
});

test("EC-06 News service remains remote-live without silent mock fallback", () => {
  const news = readSrc("src/features/public-portal/services/publicNewsService.js");
  assert.match(news, /No silent mock fallback/);
  assert.match(news, /news_public_content_query_public/);
  assert.doesNotMatch(news, /withFallback\(/);
  assert.doesNotMatch(news, /allowMockFallback:\s*true/);
});

test("EC-06 no Competition Engine imports in public portal adapters / certification", () => {
  const files = [
    "src/features/public-portal/services/publicClubsCourtsDataSource.js",
    "src/features/public-portal/services/publicTournamentsRankingsDataSource.js",
    "src/features/public-portal/services/publicHomeDataSource.js",
    "src/features/public-portal/services/publicNewsService.js",
    "src/features/experience-channels/public-portal/certification/liveCutoverCertificationMatrix.js",
    "src/features/experience-channels/public-portal/validation/certifyPublicPortalLiveCutover.js",
  ];
  for (const file of files) {
    const src = readSrc(file);
    assert.doesNotMatch(src, /competition-engine/, file);
  }
});

test("EC-06 does not duplicate PublicDataResult contract or notice component", () => {
  const matrix = readSrc(
    "src/features/experience-channels/public-portal/certification/liveCutoverCertificationMatrix.js"
  );
  assert.doesNotMatch(matrix, /function createLiveResult/);
  assert.doesNotMatch(matrix, /PublicDataSourceNotice/);
  assert.ok(
    existsSync(
      path.join(ROOT, "src/components/public/states/PublicDataSourceNotice.jsx")
    )
  );
  assert.ok(
    existsSync(
      path.join(
        ROOT,
        "src/features/experience-channels/public-portal/data-source/publicDataResult.js"
      )
    )
  );
});

test("EC-06 caller-controlled retry remains page-owned (no infinite adapter retry)", () => {
  const clubsPage = readSrc("src/pages/public/ClubsPage.jsx");
  const homePage = readSrc("src/pages/public/HomePage.jsx");
  assert.match(clubsPage, /retryToken/);
  assert.match(homePage, /retryToken/);
  const resolver = readSrc(
    "src/features/experience-channels/public-portal/data-source/resolvePublicListDataResult.js"
  );
  assert.doesNotMatch(resolver, /setInterval|while\s*\(|for\s*\(\s*;\s*;\s*\)/);
  assert.match(resolver, /Does not fetch remotely, retry/);
});

test("EC-06 one surface failure isolation: Home sections independent", () => {
  const home = readSrc(
    "src/features/public-portal/services/publicHomeDataSource.js"
  );
  assert.match(home, /One section failure does not rewrite others/);
  assert.match(home, /Caller-controlled retry/);
  assert.doesNotMatch(home, /allowMockFallback:\s*false/);
});

test("EC-06 staging evidence unchanged (exists, stable hash in-process, git clean)", () => {
  assert.equal(existsSync(path.join(ROOT, EVIDENCE_COACHING)), true);
  assert.equal(existsSync(path.join(ROOT, EVIDENCE_PM)), true);

  const beforeCoaching = sha256File(EVIDENCE_COACHING);
  const beforePm = sha256File(EVIDENCE_PM);
  assert.match(beforeCoaching, /^[A-F0-9]{64}$/);
  assert.match(beforePm, /^[A-F0-9]{64}$/);
  assert.equal(sha256File(EVIDENCE_COACHING), beforeCoaching);
  assert.equal(sha256File(EVIDENCE_PM), beforePm);

  // Portable across CRLF/LF checkouts — do not hardcode Windows working-tree digests.
  assert.equal(gitPorcelainFor(EVIDENCE_COACHING, EVIDENCE_PM), "");
});

test("EC-06 docs and ownership evidence exist", () => {
  assert.match(readSrc("docs/experience-channels/ec-06/README.md"), /EC-06/);
  assert.match(
    readSrc("docs/experience-channels/ec-06/00_EC_06_LIVE_CUTOVER_CERTIFICATION_REPORT.md"),
    /CERTIFIED_LIVE_CUTOVER/
  );
  assert.match(
    readSrc("src/features/experience-channels/ARCHITECTURE.md"),
    /EC-06 — Public Portal Certified LIVE Cutover/
  );
});
