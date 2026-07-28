/**
 * Wave A3 — Public Portal post-wipe honesty.
 * Explicit HC ON / HC OFF coverage for clubs/courts catalog authority.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HARD_CUTOVER_FLAG } from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  assertPublicPortalLocalAuthorityAllowed,
  assertPublicPortalMockFallbackAllowed,
  LEGACY_AUTHORITY_ERROR,
} from "../src/features/platform-hard-cutover/legacyAuthorityPolicy.js";
import {
  PUBLIC_PORTAL_EMPTY_CLUBS_MESSAGE,
  PUBLIC_PORTAL_EMPTY_COURTS_MESSAGE,
  PUBLIC_PORTAL_ERROR_USER_MESSAGE,
  PUBLIC_PORTAL_LEGACY_DEMO_BANNER,
  PUBLIC_PORTAL_RUNTIME_MODE,
  PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
} from "../src/features/public-portal/runtime/constants.js";
import {
  resolvePublicPortalRuntime,
  resolvePublicPortalViewState,
  sanitizePublicPortalUserMessage,
} from "../src/features/public-portal/runtime/resolvePublicPortalRuntime.js";
import {
  getPublicClubsResult,
  getPublicCourtsResult,
  loadPublicClubsFromRemote,
  loadPublicCourtsFromRemote,
  loadPublicClubsPageResult,
  mapCatalogClubDtoToPortalCard,
  mapCatalogCourtDtoToPortalCard,
  resolvePublicClubsCourtsSource,
  PUBLIC_CLUBS_COURTS_SOURCE,
} from "../src/features/public-portal/services/publicClubsCourtsDataSource.js";
import {
  getPublicHomeSyncSections,
} from "../src/features/public-portal/services/publicHomeDataSource.js";
import {
  PUBLIC_DATA_RESULT_STATUS,
} from "../src/features/experience-channels/public-portal/data-source/index.js";
import { PUBLIC_PORTAL_DATA_SOURCE } from "../src/features/experience-channels/public-portal/constants/dataSources.js";
import { ok, fail } from "../src/core/platform/contracts/result.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HC_ON = Object.freeze({ [HARD_CUTOVER_FLAG]: "true" });
const HC_OFF = Object.freeze({ [HARD_CUTOVER_FLAG]: "false" });

function readSrc(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("Public Portal HC ON — runtime blocks localStorage and mock fallback", () => {
  const runtime = resolvePublicPortalRuntime({ env: HC_ON, sourceMode: "local" });
  assert.equal(runtime.mode, PUBLIC_PORTAL_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(runtime.allowsLocalStorage, false);
  assert.equal(runtime.allowsMockFallback, false);
  assert.equal(runtime.allowsDemoClubFallback, false);
  assert.equal(runtime.requiresCanonicalRemote, true);
  assert.equal(runtime.legacyBlocked, true);
  assert.match(runtime.userMessage, /hard cutover/i);
  assert.equal(assertPublicPortalLocalAuthorityAllowed(HC_ON).ok, false);
  assert.equal(
    assertPublicPortalLocalAuthorityAllowed(HC_ON).code,
    LEGACY_AUTHORITY_ERROR.PUBLIC_PORTAL_LOCALSTORAGE_AUTHORITY_FORBIDDEN
  );
  assert.equal(assertPublicPortalMockFallbackAllowed(HC_ON).ok, false);
});

test("Public Portal HC ON — sync clubs/courts do not mock-on-empty or use localStorage SoT", () => {
  const clubs = getPublicClubsResult({ env: HC_ON, hardCutover: true });
  const courts = getPublicCourtsResult({ env: HC_ON, hardCutover: true });
  assert.equal(clubs.status, PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE);
  assert.equal(courts.status, PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE);
  assert.deepEqual(clubs.data, []);
  assert.deepEqual(courts.data, []);
  assert.notEqual(clubs.source, PUBLIC_PORTAL_DATA_SOURCE.MIXED);
  assert.notEqual(clubs.source, PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.notEqual(courts.source, PUBLIC_PORTAL_DATA_SOURCE.MIXED);
  assert.notEqual(courts.source, PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.equal(clubs.productionReady, false);
  assert.match(clubs.error?.message || "", /công khai|khả dụng/i);
});

test("Public Portal HC ON — page source forces canonical remote", () => {
  assert.equal(
    resolvePublicClubsCourtsSource({ env: HC_ON, hardCutover: true, source: "local" }),
    PUBLIC_CLUBS_COURTS_SOURCE.REMOTE
  );
});

test("Public Portal HC ON — remote empty is ready-empty, not mock", async () => {
  const facade = {
    async listPublicClubs() {
      return ok({ items: [], nextCursor: null });
    },
    async listPublicCourts() {
      return ok({ items: [], nextCursor: null });
    },
  };
  const clubs = await loadPublicClubsFromRemote({ facade });
  const courts = await loadPublicCourtsFromRemote({ facade });
  assert.equal(clubs.status, PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.equal(courts.status, PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.equal(clubs.source, PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.deepEqual(clubs.data, []);
  assert.equal(clubs.fallbackUsed, false);
});

test("Public Portal HC ON — remote ready returns canonical LIVE rows without fake counts", async () => {
  const facade = {
    async listPublicClubs() {
      return ok({
        items: [
          {
            id: "pub-1",
            displayName: "CLB Công Khai",
            locationSummary: "Đà Nẵng",
          },
        ],
        nextCursor: null,
      });
    },
  };
  const clubs = await loadPublicClubsFromRemote({ facade });
  assert.equal(clubs.status, PUBLIC_DATA_RESULT_STATUS.SUCCESS);
  assert.equal(clubs.source, PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.equal(clubs.data.length, 1);
  assert.equal(clubs.data[0].members, null);
  assert.equal(clubs.data[0].tournaments, null);
});

test("Public Portal HC ON — remote unavailable is typed UNAVAILABLE with sanitized VN copy", async () => {
  const facade = {
    async listPublicClubs() {
      return fail({
        code: "CLIENT_UNAVAILABLE",
        message: "supabase://service_role=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret",
      });
    },
  };
  const clubs = await loadPublicClubsFromRemote({ facade });
  assert.equal(clubs.status, PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE);
  assert.doesNotMatch(JSON.stringify(clubs), /service_role|eyJhbGci/i);
  assert.match(clubs.error?.message || "", /công khai|khả dụng/i);
});

test("Public Portal HC ON — remote operational error is sanitized ERROR, no mock fill", async () => {
  const facade = {
    async listPublicClubs() {
      return fail({
        code: "PUBLIC_CATALOG_REMOTE_FAILED",
        message: "relation public_catalog_clubs does not exist",
      });
    },
  };
  const clubs = await loadPublicClubsFromRemote({ facade });
  assert.equal(clubs.status, PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.deepEqual(clubs.data, []);
  assert.equal(clubs.error?.message, PUBLIC_PORTAL_ERROR_USER_MESSAGE);
  assert.doesNotMatch(clubs.error?.message || "", /relation|postgres/i);
});

test("Public Portal HC ON — page loader never returns MIXED mock-on-empty", async () => {
  const facade = {
    async listPublicClubs() {
      return ok({ items: [], nextCursor: null });
    },
  };
  const result = await loadPublicClubsPageResult({
    env: HC_ON,
    hardCutover: true,
    facade,
  });
  assert.notEqual(result.source, PUBLIC_PORTAL_DATA_SOURCE.MIXED);
  assert.notEqual(result.source, PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.equal(result.status, PUBLIC_DATA_RESULT_STATUS.EMPTY);
});

test("Public Portal HC ON — home tournaments/stats/sponsors do not inject mock as real", () => {
  const sections = getPublicHomeSyncSections({ env: HC_ON, hardCutover: true });
  assert.equal(sections.tournaments.status, PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE);
  assert.deepEqual(sections.tournaments.data, []);
  assert.notEqual(sections.tournaments.source, PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.notEqual(sections.tournaments.source, PUBLIC_PORTAL_DATA_SOURCE.MIXED);
  assert.equal(sections.stats.status, PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE);
  assert.equal(sections.sponsors.status, PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE);
  assert.equal(sections.liveScores.status, PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE);
  assert.deepEqual(sections.stats.data, []);
});

test("Invalid public identifier page is wired under PublicLayout", () => {
  const router = readSrc("src/router.jsx");
  assert.ok(router.includes("/clubs/:publicId"));
  assert.ok(router.includes("/courts/:publicId"));
  assert.ok(router.includes("PublicCatalogNotFoundPage"));
  const page = readSrc("src/pages/public/PublicCatalogNotFoundPage.jsx");
  assert.ok(page.includes("PUBLIC_PORTAL_MISSING_ID_USER_MESSAGE"));
  assert.ok(page.includes("PublicUnavailableState"));
  assert.equal(page.includes("useClub("), false);
});

test("Public Portal HC OFF — controlled legacy/demo remains labeled non-durable", () => {
  const runtime = resolvePublicPortalRuntime({ env: HC_OFF, sourceMode: "local" });
  assert.equal(runtime.mode, PUBLIC_PORTAL_RUNTIME_MODE.LEGACY_DEMO);
  assert.equal(runtime.allowsMockFallback, true);
  assert.equal(runtime.isDemoMode, true);
  assert.equal(runtime.demoBanner, PUBLIC_PORTAL_LEGACY_DEMO_BANNER);
  assert.equal(assertPublicPortalLocalAuthorityAllowed(HC_OFF).ok, true);
  assert.equal(assertPublicPortalMockFallbackAllowed(HC_OFF).ok, true);

  const sections = getPublicHomeSyncSections({ env: HC_OFF, hardCutover: false });
  assert.equal(sections.sponsors.source, PUBLIC_PORTAL_DATA_SOURCE.MOCK);
  assert.equal(sections.sponsors.productionReady, false);
});

test("Public Portal HC OFF — demo-club public id is missing-scope, not cross-tenant fallback", () => {
  const runtime = resolvePublicPortalRuntime({
    env: HC_OFF,
    publicId: "demo-club",
  });
  assert.equal(runtime.mode, PUBLIC_PORTAL_RUNTIME_MODE.MISSING_SCOPE);
  assert.equal(runtime.publicId, null);
  assert.equal(runtime.allowsDemoClubFallback, false);
});

test("Invalid public identifier view state is MISSING_SCOPE", () => {
  const runtime = resolvePublicPortalRuntime({
    env: HC_OFF,
    publicId: "demo-club",
  });
  assert.equal(
    resolvePublicPortalViewState({ runtime, status: null }),
    PUBLIC_PORTAL_RUNTIME_MODE.MISSING_SCOPE
  );
});

test("View state distinguishes loading / empty / error / ready / legacy", () => {
  assert.equal(
    resolvePublicPortalViewState({ loading: true }),
    PUBLIC_PORTAL_RUNTIME_MODE.LOADING
  );
  assert.equal(
    resolvePublicPortalViewState({
      status: PUBLIC_DATA_RESULT_STATUS.EMPTY,
      data: [],
    }),
    PUBLIC_PORTAL_RUNTIME_MODE.CANONICAL_EMPTY
  );
  assert.equal(
    resolvePublicPortalViewState({
      status: PUBLIC_DATA_RESULT_STATUS.ERROR,
      data: [],
    }),
    PUBLIC_PORTAL_RUNTIME_MODE.ERROR
  );
  assert.equal(
    resolvePublicPortalViewState({
      status: PUBLIC_DATA_RESULT_STATUS.SUCCESS,
      source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
      data: [{ id: "1" }],
    }),
    PUBLIC_PORTAL_RUNTIME_MODE.CANONICAL_READY
  );
  assert.equal(
    resolvePublicPortalViewState({
      status: PUBLIC_DATA_RESULT_STATUS.SUCCESS,
      source: PUBLIC_PORTAL_DATA_SOURCE.MIXED,
      data: [{ id: "m1" }],
      runtime: resolvePublicPortalRuntime({ env: HC_OFF }),
    }),
    PUBLIC_PORTAL_RUNTIME_MODE.LEGACY_DEMO
  );
});

test("Sanitizer strips secrets and raw backend codes", () => {
  assert.equal(
    sanitizePublicPortalUserMessage(
      "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"
    ),
    PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE
  );
  assert.equal(
    sanitizePublicPortalUserMessage("PUBLIC_CATALOG_REMOTE_FAILED"),
    PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE
  );
  assert.equal(
    sanitizePublicPortalUserMessage({ userMessage: "Không tải được danh sách CLB." }),
    "Không tải được danh sách CLB."
  );
});

test("DTO map does not fabricate public counts", () => {
  const club = mapCatalogClubDtoToPortalCard({
    id: "c1",
    displayName: "Alpha",
    locationSummary: "Hà Nội",
  });
  assert.equal(club.members, null);
  assert.equal(club.tournaments, null);

  const court = mapCatalogCourtDtoToPortalCard({
    id: "ct1",
    displayName: "Court A",
    courtType: "indoor",
  });
  assert.equal(court.courtCount, null);
});

test("Vietnamese empty/unavailable/error copy is present and stable", () => {
  assert.match(PUBLIC_PORTAL_EMPTY_CLUBS_MESSAGE, /câu lạc bộ công khai/i);
  assert.match(PUBLIC_PORTAL_EMPTY_COURTS_MESSAGE, /sân công khai/i);
  assert.match(PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE, /hard cutover/i);
  assert.match(PUBLIC_PORTAL_ERROR_USER_MESSAGE, /Không tải được/i);
  assert.ok(PUBLIC_PORTAL_LEGACY_DEMO_BANNER.includes("local/demo"));
  assert.ok(PUBLIC_PORTAL_LEGACY_DEMO_BANNER.includes("minh họa"));
});

test("Anonymous public routes remain wired without private club context dependency", () => {
  const router = readSrc("src/router.jsx");
  assert.ok(router.includes('path="/clubs"'));
  assert.ok(router.includes('path="/courts"'));
  assert.ok(router.includes('path="/home"'));
  assert.ok(
    router.includes("PublicClubsPage") || router.includes("pages/public/ClubsPage")
  );
  assert.ok(
    router.includes("PublicCourtsPage") || router.includes("pages/public/CourtsPage")
  );

  const clubsPage = readSrc("src/pages/public/ClubsPage.jsx");
  const courtsPage = readSrc("src/pages/public/CourtsPage.jsx");
  const root = readSrc("src/pages/public/PublicRootPage.jsx");
  assert.equal(clubsPage.includes("useClub("), false);
  assert.equal(clubsPage.includes("activeClubId"), false);
  assert.equal(clubsPage.includes("ClubProvider"), false);
  assert.equal(courtsPage.includes("useClub("), false);
  assert.equal(courtsPage.includes("activeClubId"), false);
  assert.equal(courtsPage.includes("ClubProvider"), false);
  assert.ok(root.includes("PublicLoadingState"));
  assert.equal(/return null/.test(root), false);
});

test("Privacy: catalog DTO mapping never leaks tenant-private fields", () => {
  const club = mapCatalogClubDtoToPortalCard({
    id: "c1",
    displayName: "Public",
    ownerEmail: "a@b.c",
    tenantId: "t-1",
    financial: { balance: 9 },
  });
  for (const key of ["ownerEmail", "tenantId", "financial", "bookings"]) {
    assert.equal(Object.hasOwn(club, key), false, key);
  }
});

test("Deterministic loading termination wiring: pages always clear loading in finally", () => {
  const clubsPage = readSrc("src/pages/public/ClubsPage.jsx");
  const courtsPage = readSrc("src/pages/public/CourtsPage.jsx");
  assert.ok(clubsPage.includes(".finally("));
  assert.ok(courtsPage.includes(".finally("));
  assert.ok(clubsPage.includes("setLoading(false)"));
  assert.ok(courtsPage.includes("setLoading(false)"));
});

test("SEO titles remain public-page scoped", () => {
  const clubsPage = readSrc("src/pages/public/ClubsPage.jsx");
  const courtsPage = readSrc("src/pages/public/CourtsPage.jsx");
  const home = readSrc("src/pages/public/HomePage.jsx");
  assert.ok(clubsPage.includes('usePublicDocumentTitle("Câu lạc bộ")'));
  assert.ok(courtsPage.includes('usePublicDocumentTitle("Sân pickleball")'));
  assert.ok(home.includes('usePublicDocumentTitle("Trang chủ")'));
});

test("Route/menu public destinations stay on public catalog paths", () => {
  const header = readSrc("src/components/public/PublicHeader.jsx");
  assert.ok(header.includes("/clubs"));
  assert.ok(header.includes("/courts"));
  assert.ok(header.includes("/home"));
  assert.equal(header.includes("/finance"), false);
  assert.equal(header.includes("/crm"), false);
  assert.equal(header.includes("/billing"), false);
});
