/**
 * Notification Platform Core architecture-boundary certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as notificationPlatform from "../src/features/notifications/platform/index.js";
import * as platform from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ADOPTED_PLATFORM_DIR = "src/features/notifications/platform";

const EXCLUDED_FEATURE_ROOTS = [
  "src/features/finance",
  "src/features/crm",
  "src/features/venue-court",
  "src/features/club",
  "src/features/player",
  "src/features/player-rating",
  "src/features/competition-core",
  "src/features/competition-management",
  "src/features/coaching",
  "src/features/public-portal",
  "src/features/vpr-ranking",
  "src/features/statistics",
];

function collectJsFiles(dir) {
  const abs = path.join(ROOT, dir);
  return fs
    .readdirSync(abs)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(abs, name), "utf8"),
    }));
}

function walkJsFiles(dirAbs, visitor) {
  const stack = [dirAbs];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith(".js")) continue;
      visitor(full, fs.readFileSync(full, "utf8"));
    }
  }
}

test("notification adopts Platform Core at a safe additive boundary", () => {
  assert.equal(typeof notificationPlatform.projectNotificationActor, "function");
  assert.equal(typeof notificationPlatform.projectNotificationRecipient, "function");
  assert.equal(typeof notificationPlatform.projectNotificationOperation, "function");
});

test("notification consumes only canonical Platform Core public entry", () => {
  for (const { name, source } of collectJsFiles(ADOPTED_PLATFORM_DIR)) {
    if (name === "index.js") continue;
    assert.equal(
      /core\/platform\/contracts\//.test(source),
      false,
      name
    );
    assert.equal(
      /core\/platform\/adapters\//.test(source),
      false,
      name
    );
    assert.match(source, /core\/platform\/index\.js/, name);
  }
});

test("Platform Core does not import Notification (no circular dependency)", () => {
  const platformRoot = path.join(ROOT, "src/core/platform");
  walkJsFiles(platformRoot, (full, source) => {
    assert.equal(
      /from\s+["'][^"']*features\/notifications[^"']*["']/.test(source),
      false,
      full
    );
    assert.equal(
      /require\s*\(\s*["'][^"']*features\/notifications[^"']*["']\s*\)/.test(source),
      false,
      full
    );
  });
});

test("notification adoption does not import excluded business modules", () => {
  const forbiddenFragments = [
    "features/finance",
    "features/crm",
    "features/venue-court",
    "features/club",
    "features/player/",
    "features/player-rating",
    "features/competition",
    "features/coaching",
  ];

  for (const { name, source } of collectJsFiles(ADOPTED_PLATFORM_DIR)) {
    for (const forbidden of forbiddenFragments) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${name} must not import ${forbidden}`
      );
    }
  }
});

test("notification adoption does not touch schema, SQL, Supabase, or deployment roots", () => {
  const forbiddenRoots = [
    "supabase",
    "migrations",
    "scripts/ci",
    ".github",
    "docs/",
  ];
  for (const { name, source } of collectJsFiles(ADOPTED_PLATFORM_DIR)) {
    for (const root of forbiddenRoots) {
      assert.equal(
        source.includes(root),
        false,
        `${name} must not reference ${root}`
      );
    }
    assert.equal(/\.sql\b/i.test(source), false, name);
  }

  for (const featureRoot of EXCLUDED_FEATURE_ROOTS) {
    assert.equal(
      fs.existsSync(path.join(ROOT, featureRoot)),
      true,
      `${featureRoot} must remain present (untouched by this wave)`
    );
  }
});

test("notification canonical projections succeed", () => {
  const actor = notificationPlatform.projectNotificationActor({
    actorUserId: "u-notif-wave",
  });
  const scope = notificationPlatform.projectNotificationScope({
    tenantId: "t-notif-wave",
  });
  const recipient = notificationPlatform.projectNotificationRecipient({
    recipientId: "r-notif-wave",
  });

  assert.equal(platform.isOk(actor), true);
  assert.equal(platform.isOk(scope), true);
  assert.equal(platform.isOk(recipient), true);
  assert.equal(platform.isActorReference(actor.value), true);
  assert.equal(platform.isPlatformScope(scope.value), true);
  assert.equal(platform.isSubjectReference(recipient.value), true);
});
