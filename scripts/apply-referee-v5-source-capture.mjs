#!/usr/bin/env node
/**
 * Copy Referee V5 files from source tree to clean worktree per manifest.
 * Usage: node scripts/apply-referee-v5-source-capture.mjs <sourceRoot> <targetRoot>
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const [sourceRoot, targetRoot] = process.argv.slice(2);
if (!sourceRoot || !targetRoot) {
  console.error("Usage: node apply-referee-v5-source-capture.mjs <sourceRoot> <targetRoot>");
  process.exit(1);
}

const manifestPath = join(sourceRoot, "docs/v5/referee-v5/source-capture/REFEREE_V5_SOURCE_MANIFEST.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const included = manifest.entries.filter((e) => e.include_or_exclude === "INCLUDE");

let copied = 0;
for (const entry of included) {
  const rel = entry.relative_path;
  const src = join(sourceRoot, rel);
  const dest = join(targetRoot, rel);
  if (!existsSync(src)) {
    console.error("MISSING_SOURCE", rel);
    process.exitCode = 1;
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  copied += 1;
}

writeFileSync(
  join(targetRoot, "docs/v5/referee-v5/source-capture/_COPY_REPORT.json"),
  JSON.stringify({ copied, total: included.length, at: new Date().toISOString() }, null, 2),
);
console.log(JSON.stringify({ copied, total: included.length }));
