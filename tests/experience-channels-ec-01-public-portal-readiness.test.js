/**
 * EC-01 — Public Portal Channel Readiness Certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as ExperienceChannels from "../src/features/experience-channels/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("EC-01 phase exports certification façade without runtime wiring", () => {
  for (const name of ExperienceChannels.PUBLIC_PORTAL_READINESS_PUBLIC_EXPORTS) {
    assert.ok(name in ExperienceChannels, `missing export: ${name}`);
  }
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC01_PHASE.id, "EC-01");
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC01_PHASE.wiredToRuntimeRouter, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC01_PHASE.wiredToMainEntrypoint, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC01_PHASE.wiredToProviderTree, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC01_PHASE.uiRemediationInScope, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC01_PHASE.nativeStoreRelease, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC01_PHASE.iosReleasePercent, 0);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_EC01_PHASE.androidReleasePercent, 0);
  // EC-00 phase remains the foundation marker
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_PHASE.id, "EC-00");
});

test("public portal surface IDs are unique and registry is deterministic", () => {
  const first = ExperienceChannels.listPublicPortalSurfaces();
  const second = ExperienceChannels.listPublicPortalSurfaces();
  assert.equal(first.length, ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID_VALUES.length);
  assert.equal(JSON.stringify(first), JSON.stringify(second));

  const ids = first.map((s) => s.surfaceId);
  assert.equal(new Set(ids).size, ids.length);

  const routes = first.map((s) => s.routePattern);
  assert.equal(new Set(routes).size, routes.length);

  for (const id of ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID_VALUES) {
    assert.ok(ExperienceChannels.getPublicPortalSurface(id), `missing surface ${id}`);
  }
});

test("every EC-01 certified surface is PUBLIC visibility under public-portal owner", () => {
  for (const surface of ExperienceChannels.listPublicPortalSurfaces()) {
    assert.equal(
      surface.visibility,
      ExperienceChannels.EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC
    );
    assert.equal(
      surface.ownerChannelId,
      ExperienceChannels.EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL
    );
    assert.equal(Object.isFrozen(surface), true);
    for (const value of Object.values(surface)) {
      assert.notEqual(typeof value, "function");
    }
  }
});

test("mock/preview surfaces are not production-ready", () => {
  for (const surface of ExperienceChannels.listPublicPortalSurfaces()) {
    if (
      surface.dataSource === ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK ||
      surface.dataSource === ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.PREVIEW
    ) {
      assert.notEqual(
        surface.overallReadiness,
        ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED,
        `${surface.surfaceId} mock/preview must not be IMPLEMENTED`
      );
    }
    if (
      surface.dataSource === ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MIXED ||
      surface.dataSource === ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN
    ) {
      assert.ok(
        String(surface.dataSourceNotes || "").trim().length > 0,
        `${surface.surfaceId} MIXED/UNKNOWN requires notes`
      );
    }
  }
});

test("Competition E2E-owned / boundary surfaces are not safe for remediation", () => {
  for (const surface of ExperienceChannels.listPublicPortalSurfaces()) {
    if (
      surface.competitionOwnershipMarker ===
        ExperienceChannels.PUBLIC_PORTAL_COMPETITION_MARKER.COMPETITION_E2E_OWNED ||
      surface.collisionClassification ===
        ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.COMPETITION_E2E_OWNED
    ) {
      assert.equal(surface.safeForRemediation, false);
    }
  }

  for (const boundary of ExperienceChannels.listPublicPortalBoundaryMarkers()) {
    assert.equal(boundary.safeForRemediation, false);
    assert.ok(String(boundary.deferReason || "").trim().length > 0);
    assert.notEqual(
      boundary.ownerChannelId,
      ExperienceChannels.EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL
    );
  }

  const athletes = ExperienceChannels.getPublicPortalBoundaryMarker(
    ExperienceChannels.PUBLIC_PORTAL_BOUNDARY_ID.ATHLETES_DIRECTORY
  );
  assert.ok(athletes);
  assert.equal(athletes.ownerChannelId, ExperienceChannels.EXPERIENCE_CHANNEL_ID.PLAYER);

  const tournamentPublic = ExperienceChannels.getPublicPortalBoundaryMarker(
    ExperienceChannels.PUBLIC_PORTAL_BOUNDARY_ID.TOURNAMENT_PUBLIC_VIEW
  );
  assert.ok(tournamentPublic);
  assert.equal(
    tournamentPublic.ownerChannelId,
    ExperienceChannels.EXPERIENCE_CHANNEL_ID.TOURNAMENT_OPS
  );
  assert.equal(
    tournamentPublic.collisionClassification,
    ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED
  );
});

test("deferred surfaces require deferReason; a11y/responsive gates prevent false IMPLEMENTED", () => {
  for (const surface of ExperienceChannels.listPublicPortalSurfaces()) {
    const deferred =
      surface.collisionClassification ===
        ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED ||
      surface.overallReadiness === ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.DEFERRED;
    if (deferred) {
      assert.ok(String(surface.deferReason || "").trim().length > 0);
    }
    if (
      surface.overallReadiness === ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED
    ) {
      assert.notEqual(
        surface.accessibilityState,
        ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.NOT_VERIFIED
      );
      assert.notEqual(
        surface.responsiveState,
        ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.NOT_VERIFIED
      );
    }
  }
});

test("iOS/Android metadata are not native implementation claims", () => {
  const shared = ExperienceChannels.getPublicPortalSharedReadinessEvidence();
  assert.equal(shared.pwa.nativeStoreRelease, false);
  assert.equal(shared.pwa.iosReleasePercent, 0);
  assert.equal(shared.pwa.androidReleasePercent, 0);
  assert.equal(shared.pwa.remediableInEc01, false);
  assert.equal(shared.seo.remediableInEc01, false);
});

test("createPublicPortalSurfaceDescriptor rejects non-public visibility", () => {
  assert.throws(
    () =>
      ExperienceChannels.createPublicPortalSurfaceDescriptor({
        surfaceId: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_HOME,
        routePattern: "/home",
        ownerChannelId: ExperienceChannels.EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
        visibility: ExperienceChannels.EXPERIENCE_CHANNEL_VISIBILITY.AUTHENTICATED,
        collisionClassification:
          ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
        dataSource: ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.LIVE,
        authenticationDependency:
          ExperienceChannels.PUBLIC_PORTAL_AUTH_DEPENDENCY.NONE,
        tenantDependency: ExperienceChannels.PUBLIC_PORTAL_TENANT_DEPENDENCY.NONE,
        competitionOwnershipMarker:
          ExperienceChannels.PUBLIC_PORTAL_COMPETITION_MARKER.NONE,
        responsiveState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        accessibilityState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        seoState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.MISSING,
        loadingStateReadiness: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        errorStateReadiness: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        emptyStateReadiness: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        offlinePwaState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        testCoverageState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.MISSING,
        overallReadiness: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        safeForRemediation: false,
      }),
    (err) => err && err.code === "PUBLIC_VISIBILITY_REQUIRED"
  );
});

test("createPublicPortalSurfaceDescriptor rejects mock as IMPLEMENTED", () => {
  assert.throws(
    () =>
      ExperienceChannels.createPublicPortalSurfaceDescriptor({
        surfaceId: ExperienceChannels.PUBLIC_PORTAL_SURFACE_ID.PUBLIC_NEWS,
        routePattern: "/news",
        ownerChannelId: ExperienceChannels.EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
        visibility: ExperienceChannels.EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
        collisionClassification:
          ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.MOCK_OR_PREVIEW,
        dataSource: ExperienceChannels.PUBLIC_PORTAL_DATA_SOURCE.MOCK,
        authenticationDependency:
          ExperienceChannels.PUBLIC_PORTAL_AUTH_DEPENDENCY.NONE,
        tenantDependency: ExperienceChannels.PUBLIC_PORTAL_TENANT_DEPENDENCY.NONE,
        competitionOwnershipMarker:
          ExperienceChannels.PUBLIC_PORTAL_COMPETITION_MARKER.NONE,
        responsiveState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        accessibilityState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        seoState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.MISSING,
        loadingStateReadiness: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        errorStateReadiness: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        emptyStateReadiness: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        offlinePwaState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.PARTIAL,
        testCoverageState: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.MISSING,
        overallReadiness: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED,
        safeForRemediation: false,
      }),
    (err) => err && err.code === "MOCK_NOT_PRODUCTION_READY"
  );
});

test("public portal readiness certification passes", () => {
  const result = ExperienceChannels.certifyPublicPortalReadiness();
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
  assert.equal(result.phase, "EC-01");
  assert.equal(result.surfaceCount, 7);
  assert.equal(result.boundaryCount, 2);
});

test("EC-00 adjacent certification still passes", () => {
  const result = ExperienceChannels.certifyExperienceChannelRegistry();
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
});

test("EC-01 module is not imported by main/router/App (source scan)", () => {
  const main = readFileSync(path.join(ROOT, "src/main.jsx"), "utf8");
  const router = readFileSync(path.join(ROOT, "src/router.jsx"), "utf8");
  const app = readFileSync(path.join(ROOT, "src/App.jsx"), "utf8");
  assert.equal(main.includes("experience-channels"), false);
  assert.equal(router.includes("experience-channels"), false);
  assert.equal(app.includes("experience-channels"), false);
  assert.equal(main.includes("public-portal/"), false);
  assert.equal(router.includes("certifyPublicPortalReadiness"), false);
});

test("reuses EC-00 PUBLIC_PORTAL channel and classifications (no second channel registry)", () => {
  const channel = ExperienceChannels.getExperienceChannel(
    ExperienceChannels.EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL
  );
  assert.ok(channel);
  assert.equal(
    channel.collisionClassification,
    ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE
  );
  assert.equal(
    ExperienceChannels.isExperienceChannelClassification(
      ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.MOCK_OR_PREVIEW
    ),
    true
  );
  // Surface inventory is nested under experience-channels — not a parallel top-level registry module
  assert.ok(
    ExperienceChannels.listPublicPortalSurfaces().every(
      (s) => s.ownerChannelId === ExperienceChannels.EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL
    )
  );
});
