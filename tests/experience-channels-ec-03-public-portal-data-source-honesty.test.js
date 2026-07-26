/**
 * EC-03 — Public Portal Data-Source Honesty.
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

test("EC-03 phase marker and data-result exports exist", () => {
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC03_PHASE.id, "EC-03");
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC03_PHASE.wiredToRuntimeRouter,
    false
  );
  assert.equal(
    ExperienceChannels.EXPERIENCE_CHANNELS_EC03_PHASE.mockFallbackRemoved,
    false
  );
  for (const name of [
    "PUBLIC_DATA_RESULT_STATUS",
    "createLiveResult",
    "createMockResult",
    "createPreviewResult",
    "createMixedResult",
    "createEmptyResult",
    "createErrorResult",
    "createUnavailableResult",
    "certifyPublicDataResult",
    "resolvePublicListDataResult",
  ]) {
    assert.ok(name in ExperienceChannels, `missing export: ${name}`);
  }
});

test("LIVE has no fallback; MOCK/PREVIEW are not production-ready", () => {
  const live = ExperienceChannels.createLiveResult({
    data: [{ id: "c1" }],
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
  });
  assert.equal(live.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(live.fallbackUsed, false);
  assert.equal(live.fallbackReason, null);
  assert.equal(live.productionReady, true);
  assert.equal(ExperienceChannels.certifyPublicDataResult(live).ok, true);

  const mock = ExperienceChannels.createMockResult({
    data: [{ id: "m1" }],
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
  });
  assert.equal(mock.productionReady, false);
  assert.equal(ExperienceChannels.certifyPublicDataResult(mock).ok, true);

  const preview = ExperienceChannels.createPreviewResult({
    data: [{ id: "p1" }],
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
  });
  assert.equal(preview.productionReady, false);
  assert.equal(ExperienceChannels.certifyPublicDataResult(preview).ok, true);
});

test("MIXED requires fallback metadata; UNKNOWN cannot be production-ready", () => {
  assert.throws(() =>
    ExperienceChannels.createMixedResult({
      data: [],
      ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    })
  );

  const mixed = ExperienceChannels.createMixedResult({
    data: [{ id: "fallback" }],
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    fallbackReason:
      ExperienceChannels.PUBLIC_DATA_FALLBACK_REASON.LIVE_EMPTY_USING_MOCK,
    error: { code: "PUBLIC_DATA_LOAD_FAILED", message: "Live load failed" },
  });
  assert.equal(mixed.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MIXED);
  assert.equal(mixed.fallbackUsed, true);
  assert.ok(mixed.fallbackReason);
  assert.equal(mixed.productionReady, false);
  assert.equal(mixed.error?.code, "PUBLIC_DATA_LOAD_FAILED");
  assert.equal(ExperienceChannels.certifyPublicDataResult(mixed).ok, true);

  const unknown = ExperienceChannels.createUnavailableResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    source: ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN,
  });
  assert.notEqual(unknown.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(unknown.productionReady, false);
  assert.equal(ExperienceChannels.certifyPublicDataResult(unknown).ok, true);

  assert.equal(
    ExperienceChannels.certifyPublicDataResult({
      ...unknown,
      productionReady: true,
    }).ok,
    false
  );
});

test("error, empty, and unavailable remain distinct", () => {
  const empty = ExperienceChannels.createEmptyResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
    data: [],
  });
  const error = ExperienceChannels.createErrorResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
    error: { code: "PUBLIC_DATA_LOAD_FAILED", message: "Failed" },
  });
  const unavailable = ExperienceChannels.createUnavailableResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
  });

  assert.equal(empty.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.equal(error.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.equal(
    unavailable.status,
    ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE
  );
  assert.notEqual(empty.status, error.status);
  assert.notEqual(empty.status, unavailable.status);
  assert.equal(empty.error, null);
  assert.ok(error.error);
});

test("fallback does not erase error metadata; secret messages are sanitized", () => {
  const mixed = ExperienceChannels.createMixedResult({
    data: [{ id: "m" }],
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    fallbackReason:
      ExperienceChannels.PUBLIC_DATA_FALLBACK_REASON.LIVE_LOAD_FAILED_USING_MOCK,
    error: {
      code: "PUBLIC_DATA_LOAD_FAILED",
      message: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc",
    },
  });
  assert.equal(mixed.error?.code, "PUBLIC_DATA_LOAD_FAILED");
  assert.equal(mixed.error?.message, "Public data request failed");
  assert.doesNotMatch(mixed.error.message, /eyJ/);
});

test("results are deterministic and immutable; contract has no runtime imports", () => {
  const a = ExperienceChannels.createLiveResult({
    data: [{ id: "1" }],
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
  });
  const b = ExperienceChannels.createLiveResult({
    data: [{ id: "1" }],
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
  });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(Object.isFrozen(a), true);
  assert.throws(() => {
    /** @type {any} */ (a).source = "MOCK";
  });

  const contract = readSrc(
    "src/features/experience-channels/public-portal/data-source/publicDataResult.js"
  );
  assert.doesNotMatch(contract, /from\s+["'].*router\.jsx/);
  assert.doesNotMatch(contract, /from\s+["'].*main\.jsx/);
  assert.doesNotMatch(contract, /from\s+["'].*pages\/public/);
  assert.doesNotMatch(contract, /AuthProvider|ClubProvider|TenantProvider/);
  assert.doesNotMatch(contract, /standings|eligibility|scoringEngine|rankingScore/i);
});

test("resolvePublicListDataResult never turns load failure into silent LIVE empty", () => {
  const failed = ExperienceChannels.resolvePublicListDataResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    loadLive: () => {
      throw new Error("boom");
    },
    mockData: [{ id: "mock-club" }],
    minLength: 3,
    allowMockFallback: true,
  });
  assert.equal(failed.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MIXED);
  assert.equal(failed.fallbackUsed, true);
  assert.ok(failed.fallbackReason);
  assert.ok(failed.error);
  assert.notEqual(failed.source, ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE);

  const noFallback = ExperienceChannels.resolvePublicListDataResult({
    ownerSurface: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    loadLive: () => {
      throw new Error("boom");
    },
    mockData: [],
    minLength: 1,
    allowMockFallback: false,
  });
  assert.equal(noFallback.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.notEqual(noFallback.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.notEqual(noFallback.status, ExperienceChannels.PUBLIC_DATA_RESULT_STATUS.SUCCESS);
});

test("Clubs/Courts adapters and pages wire honest results without Competition imports", () => {
  const adapter = readSrc(
    "src/features/public-portal/services/publicClubsCourtsDataSource.js"
  );
  assert.match(adapter, /resolvePublicListDataResult/);
  assert.match(adapter, /getPublicClubsResult/);
  assert.match(adapter, /getPublicCourtsResult/);
  assert.match(adapter, /PUBLIC_PORTAL_SURFACE_ID\.PUBLIC_CLUBS/);
  assert.match(adapter, /PUBLIC_PORTAL_SURFACE_ID\.PUBLIC_COURTS/);
  assert.doesNotMatch(adapter, /competition-engine/);
  assert.doesNotMatch(adapter, /standings|eligibility/i);
  assert.doesNotMatch(adapter, /from\s+["'].*publicNewsService/);
  assert.doesNotMatch(adapter, /from\s+["'].*supabaseClient/);


  const clubsPage = readSrc("src/pages/public/ClubsPage.jsx");
  const courtsPage = readSrc("src/pages/public/CourtsPage.jsx");
  for (const src of [clubsPage, courtsPage]) {
    assert.match(src, /PublicDataSourceNotice/);
    assert.match(src, /PublicErrorState/);
    assert.match(src, /PublicEmptyState/);
    assert.match(src, /PublicUnavailableState/);
    assert.match(src, /PublicLoadingState/);
    assert.match(src, /retryToken|Thử lại/);
    assert.match(src, /publicClubsCourtsDataSource/);
    assert.match(src, /loadPublicClubsPageResult|loadPublicCourtsPageResult/);
    assert.doesNotMatch(src, /competition-engine/);
    assert.doesNotMatch(src, /setInterval|while\s*\(true\)/);
  }

  const notice = readSrc("src/components/public/states/PublicDataSourceNotice.jsx");
  assert.match(notice, /role="status"/);
  assert.match(notice, /aria-live="polite"/);
  assert.match(notice, /data-testid="public-data-source-notice"/);
  assert.doesNotMatch(notice, /competition-engine/);
});

test("Competition-owned boundaries stay unsafe; EC-00/01 remain green", () => {
  for (const boundary of ExperienceChannels.listPublicPortalBoundaryMarkers()) {
    assert.equal(boundary.safeForRemediation, false);
  }
  const tournamentPublic = ExperienceChannels.getPublicPortalBoundaryMarker(
    ExperienceChannels.PUBLIC_PORTAL_BOUNDARY_ID.TOURNAMENT_PUBLIC_VIEW
  );
  assert.equal(tournamentPublic.safeForRemediation, false);
  assert.ok(
    tournamentPublic.competitionOwnershipMarker ===
      ExperienceChannels.PUBLIC_PORTAL_COMPETITION_MARKER.COMPETITION_E2E_OWNED ||
      tournamentPublic.competitionOwnershipMarker ===
        ExperienceChannels.PUBLIC_PORTAL_COMPETITION_MARKER.TOURNAMENT_OPS_DEFERRED
  );
  assert.ok(String(tournamentPublic.deferReason || "").trim().length > 0);

  assert.equal(ExperienceChannels.certifyExperienceChannelRegistry().ok, true);
  assert.equal(ExperienceChannels.certifyPublicPortalReadiness().ok, true);
});

test("EC-03 docs exist and Clubs/Courts adapter does not import Competition Engine", () => {
  assert.match(readSrc("docs/experience-channels/ec-03/README.md"), /EC-03/);
  const adapter = readSrc(
    "src/features/public-portal/services/publicClubsCourtsDataSource.js"
  );
  assert.match(adapter, /getPublicClubsResult/);
  assert.match(adapter, /getPublicCourtsResult/);
  assert.doesNotMatch(adapter, /competition-engine/);
  assert.doesNotMatch(adapter, /standings|eligibility/i);
  assert.doesNotMatch(adapter, /from\s+["'].*publicNewsService/);
  assert.doesNotMatch(adapter, /from\s+["'].*supabaseClient/);


  const facade = readSrc(
    "src/features/public-portal/services/publicPortalService.js"
  );
  assert.match(facade, /publicClubsCourtsDataSource/);
});
