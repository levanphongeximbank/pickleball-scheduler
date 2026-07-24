/**
 * Cross-module Low-Risk Wave 2 Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as ranking from "../src/features/vpr-ranking/platform/index.js";
import * as reporting from "../src/features/dashboard-analytics/platform/index.js";
import * as coaching from "../src/features/coaching/platform/index.js";
import * as platform from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ADOPTED_PLATFORM_DIRS = [
  "src/features/vpr-ranking/platform",
  "src/features/dashboard-analytics/platform",
  "src/features/coaching/platform",
];

const EXCLUDED_FEATURE_ROOTS = [
  "src/features/finance",
  "src/features/crm",
  "src/features/notifications",
  "src/features/venue-court",
  "src/features/club",
  "src/features/player",
  "src/features/player-rating",
  "src/features/competition-core",
  "src/features/competition-management",
  "src/features/public-portal",
  "src/features/statistics",
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

test("wave 2 adopts at least three real stable target modules", () => {
  const adopted = [
    typeof ranking.projectRankingActor === "function",
    typeof reporting.projectReportingActor === "function",
    typeof coaching.projectCoachingActor === "function",
  ].filter(Boolean);
  assert.ok(adopted.length >= 3);
  assert.equal(adopted.length, 3);

  // News & Public Content remains deferred (mock-only; no fake module created).
  assert.equal(
    fs.existsSync(path.join(ROOT, "src/features/news")),
    false,
    "must not create a fake news Business Module"
  );
  assert.equal(
    fs.existsSync(path.join(ROOT, "src/features/news/platform")),
    false
  );
});

test("wave 2 modules consume only canonical Platform Core public entry", () => {
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

test("wave 2 Platform Core remains dependency-only (no circular imports)", () => {
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
        /from\s+["'][^"']*features\/(?:vpr-ranking|dashboard-analytics|coaching)[^"']*["']/.test(
          source
        ),
        false,
        full
      );
    }
  }
});

test("wave 2 modules do not import each other merely for adoption", () => {
  const forbiddenPairs = [
    ["vpr-ranking/platform", "features/dashboard-analytics"],
    ["vpr-ranking/platform", "features/coaching"],
    ["dashboard-analytics/platform", "features/vpr-ranking"],
    ["dashboard-analytics/platform", "features/coaching"],
    ["coaching/platform", "features/vpr-ranking"],
    ["coaching/platform", "features/dashboard-analytics"],
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

test("wave 2 does not modify excluded modules or duplicate Platform Core", () => {
  assert.deepEqual([...ADOPTED_PLATFORM_DIRS].sort(), [
    "src/features/coaching/platform",
    "src/features/dashboard-analytics/platform",
    "src/features/vpr-ranking/platform",
  ]);

  for (const featureRoot of EXCLUDED_FEATURE_ROOTS) {
    assert.equal(
      fs.existsSync(path.join(ROOT, featureRoot)),
      true,
      `${featureRoot} must remain present (untouched by this wave)`
    );
  }

  const forbiddenFeatureImports = [
    "features/finance",
    "features/crm",
    "features/notification",
    "features/venue-court",
    "features/club",
    "features/player/",
    "features/player-rating",
    "features/competition",
    "features/public-portal",
    "features/statistics",
  ];

  for (const dir of ADOPTED_PLATFORM_DIRS) {
    for (const { name, source } of collectJsFiles(dir)) {
      for (const forbidden of forbiddenFeatureImports) {
        assert.equal(
          source.includes(forbidden),
          false,
          `${dir}/${name} must not import ${forbidden}`
        );
      }
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

test("wave 2 canonical projections succeed across adopted modules", () => {
  const rankingActor = ranking.projectRankingActor({
    actorUserId: "u-wave2-rank",
  });
  const reportingScope = reporting.projectReportingScope({
    tenantId: "t-wave2-report",
  });
  const coachingSubject = coaching.projectCoachingSubject({
    studentId: "s-wave2-coach",
  });

  assert.equal(platform.isOk(rankingActor), true);
  assert.equal(platform.isOk(reportingScope), true);
  assert.equal(platform.isOk(coachingSubject), true);
  assert.equal(platform.isActorReference(rankingActor.value), true);
  assert.equal(platform.isPlatformScope(reportingScope.value), true);
  assert.equal(platform.isSubjectReference(coachingSubject.value), true);
});
