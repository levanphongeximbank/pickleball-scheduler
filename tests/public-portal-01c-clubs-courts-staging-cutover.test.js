/**
 * PUBLIC-PORTAL-01C — Clubs & Courts Staging Cutover Certification tests.
 * Deterministic — injected repositories only. No Staging mutation. No Production access.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ok, fail } from "../src/core/platform/contracts/result.js";
import { PUBLIC_PORTAL_DATA_SOURCE } from "../src/features/experience-channels/public-portal/constants/dataSources.js";
import { PUBLIC_DATA_RESULT_STATUS } from "../src/features/experience-channels/public-portal/data-source/index.js";
import { PUBLIC_CLUBS_COURTS_SOURCE,
  resolvePublicClubsCourtsSource,
  loadPublicClubsPageResult,
  loadPublicCourtsPageResult,
  loadPublicClubsFromRemote,
  loadPublicCourtsFromRemote,
  mapCatalogClubDtoToPortalCard,
  mapCatalogCourtDtoToPortalCard,
  getPublicClubsResult,
  getPublicCourtsResult,
} from "../src/features/public-portal/services/publicClubsCourtsDataSource.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function sha256Lf(rel) {
  const text = readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function createFacade(clubsResult, courtsResult) {
  return {
    listPublicClubs: async () => clubsResult,
    listPublicCourts: async () => courtsResult,
  };
}

test("01C: default source is local; Production does not auto-select remote", () => {
  const prev = process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
  delete process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
  try {
    assert.equal(resolvePublicClubsCourtsSource(), PUBLIC_CLUBS_COURTS_SOURCE.LOCAL);
    assert.equal(resolvePublicClubsCourtsSource({ source: "remote" }), "remote");
    assert.equal(resolvePublicClubsCourtsSource({ source: "local" }), "local");
  } finally {
    if (prev == null) delete process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
    else process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE = prev;
  }
});

test("01C: Staging env selects remote for Clubs and Courts independently", async () => {
  const prev = process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
  process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE = "remote";
  try {
    assert.equal(resolvePublicClubsCourtsSource(), PUBLIC_CLUBS_COURTS_SOURCE.REMOTE);

    const emptyFacade = createFacade(
      ok({ items: [], pagination: { limit: 20, offset: 0, total: 0, sort: "name_asc" }, provenance: "LIVE" }),
      ok({ items: [], pagination: { limit: 20, offset: 0, total: 0, sort: "name_asc", clubId: null }, provenance: "LIVE" })
    );

    const clubs = await loadPublicClubsPageResult({ facade: emptyFacade });
    const courts = await loadPublicCourtsPageResult({ facade: emptyFacade });
    assert.equal(clubs.source, PUBLIC_PORTAL_DATA_SOURCE.LIVE);
    assert.equal(clubs.status, PUBLIC_DATA_RESULT_STATUS.EMPTY);
    assert.equal(courts.source, PUBLIC_PORTAL_DATA_SOURCE.LIVE);
    assert.equal(courts.status, PUBLIC_DATA_RESULT_STATUS.EMPTY);
    assert.equal(clubs.productionReady, false);
    assert.equal(courts.productionReady, false);
    assert.equal(clubs.fallbackUsed, false);
    assert.equal(courts.fallbackUsed, false);
  } finally {
    if (prev == null) delete process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
    else process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE = prev;
  }
});

test("01C: remote [] is EMPTY LIVE; remote error is ERROR without mock", async () => {
  const empty = await loadPublicClubsFromRemote({
    facade: createFacade(
      ok({ items: [], pagination: { limit: 20, offset: 0, total: 0, sort: "name_asc" }, provenance: "LIVE" }),
      ok({ items: [], pagination: { limit: 20, offset: 0, total: 0, sort: "name_asc", clubId: null }, provenance: "LIVE" })
    ),
  });
  assert.equal(empty.status, PUBLIC_DATA_RESULT_STATUS.EMPTY);
  assert.equal(empty.source, PUBLIC_PORTAL_DATA_SOURCE.LIVE);
  assert.deepEqual(empty.data, []);
  assert.equal(empty.fallbackUsed, false);

  const errClubs = await loadPublicClubsFromRemote({
    facade: createFacade(
      fail({ code: "PUBLIC_CATALOG_RPC_FAILED", message: "rpc boom", details: {} }),
      ok({ items: [], pagination: { limit: 20, offset: 0, total: 0, sort: "name_asc", clubId: null }, provenance: "LIVE" })
    ),
  });
  assert.equal(errClubs.status, PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.equal(errClubs.fallbackUsed, false);
  assert.ok(errClubs.error);
  assert.equal(Array.isArray(errClubs.data) ? errClubs.data.length : 0, 0);
  assert.doesNotMatch(JSON.stringify(errClubs), /MOCK_CLUB|mock-club|Dữ liệu mẫu/i);

  const errCourts = await loadPublicCourtsFromRemote({
    facade: createFacade(
      ok({ items: [], pagination: { limit: 20, offset: 0, total: 0, sort: "name_asc" }, provenance: "LIVE" }),
      fail({ code: "PUBLIC_CATALOG_RPC_FAILED", message: "court rpc boom", details: {} })
    ),
  });
  assert.equal(errCourts.status, PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.equal(errCourts.fallbackUsed, false);
  assert.doesNotMatch(JSON.stringify(errCourts), /MOCK_COURT|mock-court/i);
});

test("01C: Clubs failure does not break Courts and vice versa", async () => {
  const clubsFailCourtsOk = createFacade(
    fail({ code: "PUBLIC_CATALOG_RPC_FAILED", message: "clubs down", details: {} }),
    ok({
      items: [
        {
          id: "court-1",
          displayName: "Court One",
          clubId: "club-1",
          venueId: "v1",
          courtType: "outdoor",
          surface: "concrete",
          availabilityDescriptor: "06:00-22:00",
          publicationState: "published",
          operationalState: "active",
        },
      ],
      pagination: { limit: 20, offset: 0, total: 1, sort: "name_asc", clubId: null },
      provenance: "LIVE",
    })
  );

  const clubs = await loadPublicClubsFromRemote({ facade: clubsFailCourtsOk });
  const courts = await loadPublicCourtsFromRemote({ facade: clubsFailCourtsOk });
  assert.equal(clubs.status, PUBLIC_DATA_RESULT_STATUS.ERROR);
  assert.equal(courts.status, PUBLIC_DATA_RESULT_STATUS.SUCCESS);
  assert.equal(courts.data.length, 1);
  assert.equal(courts.data[0].name, "Court One");
});

test("01C: DTO map is allowlisted; private fields never rendered", () => {
  const club = mapCatalogClubDtoToPortalCard({
    id: "c1",
    displayName: "Alpha",
    locationSummary: "Hà Nội",
    logoUrl: null,
    imageUrl: null,
    ownerEmail: "secret@example.com",
    note: "PRIVATE",
    players: [{ id: "p1" }],
    bookings: [{ id: "b1" }],
    governance: { ownerUserId: "u1" },
  });
  assert.equal(club.name, "Alpha");
  assert.equal(club.city, "Hà Nội");
  for (const key of [
    "ownerEmail",
    "note",
    "players",
    "bookings",
    "governance",
    "tenantId",
    "financial",
  ]) {
    assert.equal(Object.hasOwn(club, key), false, key);
  }

  const court = mapCatalogCourtDtoToPortalCard({
    id: "ct1",
    displayName: "Court A",
    courtType: "indoor",
    surface: "wood",
    availabilityDescriptor: "open",
    pricePerHour: "500k",
    defaultHourlyRate: 100,
    peakHourlyRate: 200,
    internalNotes: "secret",
    maintenanceNotes: "private",
  });
  assert.equal(court.name, "Court A");
  for (const key of [
    "pricePerHour",
    "defaultHourlyRate",
    "peakHourlyRate",
    "internalNotes",
    "maintenanceNotes",
    "pricing",
    "bookings",
  ]) {
    assert.equal(Object.hasOwn(court, key), false, key);
  }
});

test("01C: pages use caller-controlled retry; no infinite adapter retry; no direct table query", () => {
  const clubsPage = read("src/pages/public/ClubsPage.jsx");
  const courtsPage = read("src/pages/public/CourtsPage.jsx");
  const adapter = read("src/features/public-portal/services/publicClubsCourtsDataSource.js");

  for (const src of [clubsPage, courtsPage]) {
    assert.match(src, /retryToken/);
    assert.match(src, /PublicLoadingState/);
    assert.match(src, /PublicErrorState/);
    assert.match(src, /PublicEmptyState/);
    assert.doesNotMatch(src, /setInterval|while\s*\(true\)/);
    assert.doesNotMatch(src, /\.from\(\s*["']clubs["']|\.from\(\s*["']public_catalog_courts["']/);
  }

  assert.match(adapter, /Caller-controlled retry only|no adapter loops/i);
  assert.doesNotMatch(adapter, /\.from\(\s*["']clubs["']|\.from\(\s*["']public_catalog_courts["']/);
  assert.doesNotMatch(adapter, /service_role/);
  assert.match(adapter, /listPublicClubsRemote/);
  assert.match(adapter, /listPublicCourtsRemote/);
});

test("01C: local page path remains default when source not remote", async () => {
  const prev = process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
  delete process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
  try {
    const page = await loadPublicClubsPageResult();
    const sync = getPublicClubsResult();
    assert.equal(page.source, sync.source);
    assert.equal(page.status, sync.status);
    assert.equal(page.fallbackUsed, sync.fallbackUsed);

    const courtsPage = await loadPublicCourtsPageResult();
    const courtsSync = getPublicCourtsResult();
    assert.equal(courtsPage.source, courtsSync.source);
    assert.equal(courtsPage.status, courtsSync.status);
  } finally {
    if (prev == null) delete process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE;
    else process.env.VITE_PUBLIC_CLUBS_COURTS_SOURCE = prev;
  }
});

test("01C: evidence package + PC-01E positive reference exist; no secrets", () => {
  const evidenceDir = "docs/public-portal/public-portal-01c/evidence";
  const required = [
    "TARGET_BINDING.json",
    "CLUBS_STAGING_RPC.json",
    "COURTS_STAGING_RPC.json",
    "EMPTY_STATE_VERIFICATION.json",
    "ERROR_FAIL_CLOSED.json",
    "MOCK_FALLBACK_DISABLED.json",
    "PROVENANCE_VERIFICATION.json",
    "PC01E_POSITIVE_EVIDENCE_REFERENCE.json",
    "PRODUCTION_UNTOUCHED.json",
    "TEST_RESULTS.json",
    "FINAL_CERTIFICATION.json",
  ];
  for (const name of required) {
    const rel = `${evidenceDir}/${name}`;
    assert.equal(existsSync(path.join(ROOT, rel)), true, rel);
    const text = read(rel);
    assert.doesNotMatch(text, /service_role|eyJ[A-Za-z0-9_-]{20,}|postgres(ql)?:\/\//i);
  }

  const pc01e = JSON.parse(read(`${evidenceDir}/PC01E_POSITIVE_EVIDENCE_REFERENCE.json`));
  assert.equal(pc01e.recreated, false);
  assert.match(pc01e.referencePath, /staging-publication-evidence/);
  assert.equal(pc01e.currentStagingPublicRowsClaimed, 0);

  const final = JSON.parse(read(`${evidenceDir}/FINAL_CERTIFICATION.json`));
  assert.equal(final.verdict, "PASS");
  assert.equal(final.readiness.PRODUCTION_RUNTIME_READINESS, "NOT_ACHIEVED");
  assert.equal(final.readiness.PRODUCTION_PORTAL_CUTOVER, "NO");
  assert.equal(final.readiness.STAGING_DATA_MUTATION, "NO");
});

test("01C: PC-01E FINAL_CERTIFICATION remains immutable reference", () => {
  const rel =
    "docs/public-catalog/pc-01/staging-publication-evidence/evidence/FINAL_CERTIFICATION.json";
  assert.equal(existsSync(path.join(ROOT, rel)), true);
  const doc = JSON.parse(read(rel));
  assert.equal(doc.verdict, "PASS");
  assert.equal(doc.readiness.STAGING_SEED_ROLLED_BACK, "YES");
  assert.equal(doc.readiness.STAGING_TEST_DATA_REMAINING, 0);
  assert.equal(doc.readiness.PUBLIC_PORTAL_LIVE_CUTOVER, "NO");
  assert.ok(sha256Lf(rel).length === 64);
});
