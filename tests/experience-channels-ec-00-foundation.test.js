/**
 * EC-00 — Experience Channel Architecture & Ownership Foundation certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as ExperienceChannels from "../src/features/experience-channels/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("public facade exports foundation API", () => {
  for (const name of ExperienceChannels.EXPERIENCE_CHANNELS_PUBLIC_EXPORTS) {
    assert.ok(name in ExperienceChannels, `missing export: ${name}`);
  }
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_PHASE.id, "EC-00");
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_PHASE.wiredToRuntimeRouter, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_PHASE.wiredToMainEntrypoint, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_PHASE.wiredToProviderTree, false);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_PHASE.iosReleasePercent, 0);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_PHASE.androidReleasePercent, 0);
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_PHASE.nativeStoreRelease, false);
});

test("classification and visibility enums are canonical", () => {
  assert.equal(
    ExperienceChannels.isExperienceChannelClassification(
      ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.SAFE_CHANNEL_FOUNDATION
    ),
    true
  );
  assert.equal(ExperienceChannels.isExperienceChannelClassification("NOT_A_LABEL"), false);
  assert.equal(
    ExperienceChannels.isExperienceChannelVisibility(
      ExperienceChannels.EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC
    ),
    true
  );
  assert.equal(ExperienceChannels.isExperienceChannelVisibility("PRIVATE"), false);
});

test("channel IDs are unique and registry is deterministic", () => {
  const first = ExperienceChannels.listExperienceChannels();
  const second = ExperienceChannels.listExperienceChannels();
  assert.equal(first.length, ExperienceChannels.EXPERIENCE_CHANNEL_ID_VALUES.length);
  assert.equal(JSON.stringify(first), JSON.stringify(second));

  const ids = first.map((c) => c.channelId);
  assert.equal(new Set(ids).size, ids.length);

  for (const id of ExperienceChannels.EXPERIENCE_CHANNEL_ID_VALUES) {
    assert.ok(ExperienceChannels.getExperienceChannel(id), `missing channel ${id}`);
  }
});

test("route ownership namespaces do not conflict", () => {
  const routes = ExperienceChannels.listRouteOwnership();
  const namespaces = routes.map((r) => r.routeNamespace);
  assert.equal(new Set(namespaces).size, namespaces.length);
});

test("public channels are not tenant-private; platform-admin is not public", () => {
  for (const channel of ExperienceChannels.listExperienceChannels()) {
    if (channel.category === ExperienceChannels.EXPERIENCE_CHANNEL_CATEGORY.PUBLIC) {
      assert.equal(
        channel.visibility,
        ExperienceChannels.EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC
      );
      assert.notEqual(
        channel.visibility,
        ExperienceChannels.EXPERIENCE_CHANNEL_VISIBILITY.TENANT_SCOPED
      );
    }
    if (
      channel.category === ExperienceChannels.EXPERIENCE_CHANNEL_CATEGORY.PLATFORM_ADMIN ||
      channel.visibility === ExperienceChannels.EXPERIENCE_CHANNEL_VISIBILITY.PLATFORM_ADMIN
    ) {
      assert.notEqual(
        channel.visibility,
        ExperienceChannels.EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC
      );
    }
  }
});

test("Competition E2E-owned surfaces are not safe foundation", () => {
  const competition = ExperienceChannels.getExperienceChannel(
    ExperienceChannels.EXPERIENCE_CHANNEL_ID.COMPETITION_ENGINE_E2E
  );
  assert.ok(competition);
  assert.equal(
    competition.collisionClassification,
    ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.COMPETITION_E2E_OWNED
  );
  assert.notEqual(
    competition.collisionClassification,
    ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.SAFE_CHANNEL_FOUNDATION
  );
  assert.ok(String(competition.deferReason || "").length > 0);
});

test("deferred entries require deferReason", () => {
  for (const channel of ExperienceChannels.listExperienceChannels()) {
    const deferred =
      channel.collisionClassification ===
        ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED ||
      channel.implementationStatus ===
        ExperienceChannels.EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.DEFERRED;
    if (deferred) {
      assert.ok(
        String(channel.deferReason || "").trim().length > 0,
        `missing deferReason for ${channel.channelId}`
      );
    }
  }
});

test("future iOS/Android surfaces are metadata only", () => {
  for (const channel of ExperienceChannels.listExperienceChannels()) {
    const onlyFuture = channel.supportedSurfaces.every((s) =>
      ExperienceChannels.EXPERIENCE_CHANNEL_FUTURE_SURFACES.includes(s)
    );
    assert.equal(onlyFuture, false, `${channel.channelId} must not be future-only`);
  }
  assert.equal(ExperienceChannels.EXPERIENCE_CHANNELS_PHASE.nativeStoreRelease, false);
});

test("descriptors contain no executable business logic fields", () => {
  for (const channel of ExperienceChannels.listExperienceChannels()) {
    assert.equal(Object.isFrozen(channel), true);
    for (const value of Object.values(channel)) {
      assert.notEqual(typeof value, "function");
    }
  }
});

test("createExperienceChannelDescriptor rejects invalid input", () => {
  assert.throws(
    () =>
      ExperienceChannels.createExperienceChannelDescriptor({
        channelId: "not-a-real-channel",
        name: "X",
        category: ExperienceChannels.EXPERIENCE_CHANNEL_CATEGORY.PUBLIC,
        intendedAudience: "a",
        visibility: ExperienceChannels.EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
        supportedSurfaces: [ExperienceChannels.EXPERIENCE_CHANNEL_SURFACE.WEB],
        routeNamespace: "/",
        shellOwner: "none",
        providerDependency: ExperienceChannels.EXPERIENCE_PROVIDER_DEPENDENCY.OWNED,
        readiness: ExperienceChannels.EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED,
        implementationStatus:
          ExperienceChannels.EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.FOUNDATION_ONLY,
        collisionClassification:
          ExperienceChannels.EXPERIENCE_CHANNEL_CLASSIFICATION.SAFE_CHANNEL_FOUNDATION,
        ownerModule: "test",
      }),
    (err) => err && err.code === "INVALID_CHANNEL_ID"
  );
});

test("architecture certification passes", () => {
  const result = ExperienceChannels.certifyExperienceChannelRegistry();
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
  assert.ok(result.channelCount > 0);
});

test("foundation module is not imported by main/router (source scan)", () => {
  const main = readFileSync(path.join(ROOT, "src/main.jsx"), "utf8");
  const router = readFileSync(path.join(ROOT, "src/router.jsx"), "utf8");
  const app = readFileSync(path.join(ROOT, "src/App.jsx"), "utf8");
  assert.equal(main.includes("experience-channels"), false);
  assert.equal(router.includes("experience-channels"), false);
  assert.equal(app.includes("experience-channels"), false);
});

test("ownership snapshot includes high-collision and competition markers", () => {
  const snap = ExperienceChannels.getOwnershipSnapshot();
  assert.ok(snap.globalHighCollisionFiles.includes("src/main.jsx"));
  assert.ok(snap.globalHighCollisionFiles.includes("src/router.jsx"));
  assert.ok(
    snap.competitionE2eOwnedPathHints.some((p) => p.includes("competition-engine"))
  );
  assert.ok(snap.routes.length > 0);
  assert.ok(snap.shells.length > 0);
  assert.ok(snap.providers.length > 0);
});
