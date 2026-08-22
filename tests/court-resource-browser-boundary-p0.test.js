/**
 * P0 regression: Node-only legacy booking migration tooling must not enter
 * browser-facing Court Resource barrels / gateway import graphs.
 *
 * Allowed: scripts/tests importing the leaf module (node:crypto).
 * Forbidden: browser-reachable barrels re-exporting or importing that leaf.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NODE_ONLY_LEAF =
  "src/features/court-resource/services/legacyBookingMigrationDryRun.js";

const BROWSER_FACING_ENTRYPOINTS = [
  "src/features/court-resource/index.js",
  "src/features/court-resource/legacy/index.js",
  "src/features/court-resource/services/courtResourceGateway.js",
];

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function importedModules(source) {
  return [...source.matchAll(/(?:import|export)\s+[^'"\n]*from\s+["']([^"']+)["']/g)].map(
    (match) => match[1]
  );
}

function resolveImport(fromRel, spec) {
  if (!spec.startsWith(".")) return null;
  const fromDir = path.posix.dirname(fromRel.replace(/\\/g, "/"));
  let resolved = path.posix.normalize(path.posix.join(fromDir, spec));
  if (!resolved.endsWith(".js") && !resolved.endsWith(".jsx") && !resolved.endsWith(".mjs")) {
    resolved = `${resolved}.js`;
  }
  return resolved;
}

/** BFS static import graph within court-resource (relative imports only). */
function collectCourtResourceGraph(entryRel) {
  const seen = new Set();
  const queue = [entryRel.replace(/\\/g, "/")];
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!rel.startsWith("src/features/court-resource/")) continue;
    let source;
    try {
      source = read(rel);
    } catch {
      continue;
    }
    for (const spec of importedModules(source)) {
      const next = resolveImport(rel, spec);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

test("Node-only migration leaf retains node:crypto (tooling stays Node)", () => {
  const source = read(NODE_ONLY_LEAF);
  assert.match(source, /from\s+["']node:crypto["']/);
  assert.match(source, /export\s+function\s+planLegacyBookingMigrationDryRun/);
});

test("Browser-facing barrels do not re-export or import legacyBookingMigrationDryRun", () => {
  for (const rel of BROWSER_FACING_ENTRYPOINTS) {
    const source = read(rel);
    for (const spec of importedModules(source)) {
      assert.doesNotMatch(
        spec,
        /legacyBookingMigrationDryRun/,
        `${rel} import ${spec}`
      );
    }
    assert.doesNotMatch(
      source,
      /(?:import|export)\s+\{[^}]*planLegacyBookingMigrationDryRun/,
      `${rel} must not named-import/export planLegacyBookingMigrationDryRun`
    );
  }
});

test("Browser entry graphs never reach node:crypto migration leaf", () => {
  for (const entry of BROWSER_FACING_ENTRYPOINTS) {
    const graph = collectCourtResourceGraph(entry);
    assert.equal(
      graph.has(NODE_ONLY_LEAF),
      false,
      `${entry} transitive graph must not include ${NODE_ONLY_LEAF}`
    );
  }
});

test("Node script still targets the leaf module directly", () => {
  const script = read("scripts/court-operations/batch10-staging-legacy-dry-run.mjs");
  assert.match(
    script,
    /from\s+["']\.\.\/\.\.\/src\/features\/court-resource\/services\/legacyBookingMigrationDryRun\.js["']/
  );
});
