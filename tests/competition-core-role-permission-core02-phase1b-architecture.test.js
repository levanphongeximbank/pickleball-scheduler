import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const MODULE_ROOT = path.join(
  ROOT,
  "src",
  "features",
  "competition-core",
  "role-permission"
);

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

test("architecture — no client RBAC helper imports in CORE-02 module", () => {
  const files = listJsFiles(MODULE_ROOT);
  assert.ok(files.length > 0);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(
      src,
      /auth\/rbac|from ['"].*\/rbac(\.js)?['"]/,
      `${path.relative(ROOT, file)} must not import client RBAC helper`
    );
  }
});

test("architecture — no Identity admin/UI/SQL or React imports", () => {
  const files = listJsFiles(MODULE_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /features\/identity\/(pages|components|admin)/);
    assert.doesNotMatch(src, /@supabase\/|supabaseClient/);
    assert.doesNotMatch(src, /from ['"]react['"]|from ['"]@mui\//);
    assert.doesNotMatch(src, /domain\/clubStorage/);
    assert.doesNotMatch(src, /court-assignment/);
  }
});

test("architecture — historical participant core-02 docs untouched by module path", () => {
  const participantDoc = path.join(
    ROOT,
    "docs",
    "competition-engine",
    "core-02",
    "00_PARTICIPANT_ENTRY_FOUNDATION.md"
  );
  const ownerDoc = path.join(
    ROOT,
    "docs",
    "competition-engine",
    "core-02-role-permission",
    "00_OWNERSHIP_BOUNDARY.md"
  );
  assert.ok(readFileSync(participantDoc, "utf8").includes("Participant"));
  assert.ok(readFileSync(ownerDoc, "utf8").includes("Role & Permission"));
});

test("architecture — phase CI manifest lists CORE-02 Phase 1B tests only", () => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(ROOT, "scripts", "ci", "unit-test-files.phase-core02-1b.json"),
      "utf8"
    )
  );
  assert.ok(Array.isArray(manifest));
  assert.ok(manifest.length >= 5);
  for (const entry of manifest) {
    assert.match(entry, /role-permission-core02-phase1b/);
  }
});

test("architecture — root competition-core barrel does not yet export CORE-02", () => {
  const barrel = readFileSync(
    path.join(ROOT, "src", "features", "competition-core", "index.js"),
    "utf8"
  );
  assert.doesNotMatch(barrel, /role-permission/);
});
