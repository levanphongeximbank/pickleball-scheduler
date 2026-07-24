/**
 * Cross-module Platform Core Business Adoption Wave 1 certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as venueCourt from "../src/features/venue-court/platform/index.js";
import * as club from "../src/features/club/platform/index.js";
import * as player from "../src/features/player/platform/index.js";
import * as playerRating from "../src/features/player-rating/foundation/platform/index.js";
import * as platform from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ADOPTED_PLATFORM_DIRS = [
  "src/features/venue-court/platform",
  "src/features/club/platform",
  "src/features/player/platform",
  "src/features/player-rating/foundation/platform",
];

function collectJsFiles(dir) {
  const abs = path.join(ROOT, dir);
  return fs
    .readdirSync(abs)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      moduleDir: dir,
      name,
      source: fs.readFileSync(path.join(abs, name), "utf8"),
    }));
}

test("wave 1 adopts at least three stable target modules", () => {
  const adopted = [
    typeof venueCourt.projectVenueCourtTenantScope === "function",
    typeof club.projectClubActor === "function",
    typeof player.projectPlayerSubject === "function",
    typeof playerRating.projectPlayerRatingSubject === "function",
  ].filter(Boolean);
  assert.ok(adopted.length >= 3);
  assert.equal(adopted.length, 4);
});

test("wave 1 modules consume only canonical Platform Core public entry", () => {
  for (const dir of ADOPTED_PLATFORM_DIRS) {
    for (const { name, source } of collectJsFiles(dir)) {
      if (name === "index.js") continue;
      assert.equal(
        /core\/platform\/contracts\//.test(source),
        false,
        `${dir}/${name}`
      );
      assert.equal(
        /core\/platform\/adapters\//.test(source),
        false,
        `${dir}/${name}`
      );
      assert.match(source, /core\/platform\/index\.js/, `${dir}/${name}`);
    }
  }
});

test("wave 1 Platform Core remains dependency-only (no business module imports)", () => {
  const platformRoot = path.join(ROOT, "src/core/platform");
  const stack = [platformRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      const source = fs.readFileSync(full, "utf8");
      assert.equal(
        /from\s+["'][^"']*features\/(?:venue-court|club|player|player-rating)[^"']*["']/.test(
          source
        ),
        false,
        full
      );
    }
  }
});

test("wave 1 modules do not import each other merely for adoption", () => {
  const forbiddenPairs = [
    ["venue-court/platform", "features/club"],
    ["venue-court/platform", "features/player"],
    ["venue-court/platform", "features/player-rating"],
    ["club/platform", "features/venue-court"],
    ["club/platform", "features/player"],
    ["club/platform", "features/player-rating"],
    ["player/platform", "features/venue-court"],
    ["player/platform", "features/club"],
    ["player/platform", "features/player-rating"],
    ["player-rating/foundation/platform", "features/venue-court"],
    ["player-rating/foundation/platform", "features/club"],
    ["player-rating/foundation/platform", "features/player/"],
  ];

  for (const dir of ADOPTED_PLATFORM_DIRS) {
    for (const { name, source, moduleDir } of collectJsFiles(dir)) {
      for (const [ownerHint, forbidden] of forbiddenPairs) {
        if (!moduleDir.includes(ownerHint)) continue;
        assert.equal(
          source.includes(forbidden),
          false,
          `${moduleDir}/${name} must not import ${forbidden}`
        );
      }
    }
  }
});

test("wave 1 does not duplicate Platform Core contract constructors", () => {
  for (const dir of ADOPTED_PLATFORM_DIRS) {
    for (const { name, source } of collectJsFiles(dir)) {
      if (name === "index.js") continue;
      assert.equal(
        /function\s+createActorReference|function\s+createSubjectReference|function\s+createPlatformScope|function\s+createOperationIdentity/.test(
          source
        ),
        false,
        `${dir}/${name}`
      );
    }
  }
});

test("wave 1 canonical projections succeed across adopted modules", () => {
  const venueScope = venueCourt.projectVenueCourtTenantScope({
    tenantId: "t-wave",
  });
  const clubActor = club.projectClubActor({ userId: "u-wave" });
  const playerSubject = player.projectPlayerSubject({ playerId: "p-wave" });
  const ratingOp = playerRating.projectPlayerRatingOperationIdentity({
    operationId: "op-wave",
  });

  assert.equal(platform.isOk(venueScope), true);
  assert.equal(platform.isOk(clubActor), true);
  assert.equal(platform.isOk(playerSubject), true);
  assert.equal(platform.isOk(ratingOp), true);
});
