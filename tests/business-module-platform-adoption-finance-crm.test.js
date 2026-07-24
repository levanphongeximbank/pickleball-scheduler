/**
 * Cross-module Finance/CRM Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as finance from "../src/features/finance/platform/index.js";
import * as crm from "../src/features/crm/platform/index.js";
import * as platform from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ADOPTED_PLATFORM_DIRS = [
  "src/features/finance/platform",
  "src/features/crm/platform",
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

test("finance/crm adopts at least one safe target module", () => {
  const adopted = [
    typeof finance.projectFinanceActor === "function",
    typeof crm.projectCrmActor === "function",
  ].filter(Boolean);
  assert.ok(adopted.length >= 1);
  assert.equal(adopted.length, 2);
});

test("finance/crm modules consume only canonical Platform Core public entry", () => {
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

test("Platform Core remains dependency-only (no Finance/CRM imports)", () => {
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
        /from\s+["'][^"']*features\/(?:finance|crm)[^"']*["']/.test(source),
        false,
        full
      );
    }
  }
});

test("finance and CRM do not import each other merely for adoption", () => {
  for (const { name, source } of collectJsFiles("src/features/finance/platform")) {
    assert.equal(
      source.includes("features/crm"),
      false,
      `finance/platform/${name}`
    );
  }
  for (const { name, source } of collectJsFiles("src/features/crm/platform")) {
    assert.equal(
      source.includes("features/finance"),
      false,
      `crm/platform/${name}`
    );
  }
});

test("finance/crm adoption does not modify excluded module roots in this wave", () => {
  // Scope gate: platform adoption dirs for this wave are only finance + crm.
  assert.deepEqual([...ADOPTED_PLATFORM_DIRS].sort(), [
    "src/features/crm/platform",
    "src/features/finance/platform",
  ]);

  const forbiddenFeatureImports = [
    "features/venue-court",
    "features/club",
    "features/player/",
    "features/player-rating",
    "features/notification",
    "features/competition",
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
    }
  }
});

test("finance/crm canonical projections succeed across adopted modules", () => {
  const financeActor = finance.projectFinanceActor({ userId: "u-fin-wave" });
  const crmScope = crm.projectCrmScope({
    tenantId: "t-crm-wave",
    venueId: "v-crm-wave",
  });

  assert.equal(platform.isOk(financeActor), true);
  assert.equal(platform.isOk(crmScope), true);
  assert.equal(platform.isActorReference(financeActor.value), true);
  assert.equal(platform.isPlatformScope(crmScope.value), true);
});
