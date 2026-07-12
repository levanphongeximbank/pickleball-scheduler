#!/usr/bin/env node
/** Stage and commit one group from REFEREE_V5_SOURCE_MANIFEST.json */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const [group, message] = process.argv.slice(2);
if (!group || !message) {
  console.error("Usage: node referee-v5-commit-group.mjs <group> <message>");
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync("docs/v5/referee-v5/source-capture/REFEREE_V5_SOURCE_MANIFEST.json", "utf8"),
);
const paths = manifest.entries
  .filter((e) => e.include_or_exclude === "INCLUDE" && e.target_commit_group === group)
  .map((e) => e.relative_path);

if (!paths.length) {
  console.error("No paths for group", group);
  process.exit(1);
}

for (const p of paths) {
  execSync(`git add -- "${p.replace(/"/g, '\\"')}"`, { stdio: "inherit" });
}

console.log("STAGED", paths.length, "files for", group);
execSync("git diff --cached --name-status", { stdio: "inherit" });
execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: "inherit" });
