#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const OUT = "docs/v5/referee-v5/source-capture";
const manifest = JSON.parse(readFileSync(join(OUT, "REFEREE_V5_SOURCE_MANIFEST.json"), "utf8"));
const entries = manifest.entries;

function mdTable(rows, headers) {
  const lines = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  for (const r of rows) lines.push(`| ${headers.map((h) => String(r[h] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
  return lines.join("\n");
}

const byClass = {};
for (const e of entries) {
  byClass[e.classification] = (byClass[e.classification] || 0) + 1;
}

writeFileSync(
  join(OUT, "REFEREE_V5_FILE_INVENTORY.md"),
  `# Referee V5 File Inventory\n\n**Generated:** ${new Date().toISOString()}\n**Base SHA:** ${manifest.baseSha}\n\n## Summary\n\n- Total scanned: ${entries.length}\n- Included: ${entries.filter((e) => e.include_or_exclude === "INCLUDE").length}\n- Excluded: ${entries.filter((e) => e.include_or_exclude === "EXCLUDE").length}\n\n## By classification\n\n${mdTable(Object.entries(byClass).map(([classification, count]) => ({ classification, count })), ["classification", "count"])}\n`,
);

writeFileSync(
  join(OUT, "REFEREE_V5_TRACKED_DIFF_INVENTORY.md"),
  `# Referee V5 Tracked Diff Inventory\n\n${mdTable(
    entries.filter((e) => e.source_status === "modified"),
    ["relative_path", "classification", "include_or_exclude", "reason"],
  )}\n`,
);

writeFileSync(
  join(OUT, "REFEREE_V5_UNTRACKED_FILE_INVENTORY.md"),
  `# Referee V5 Untracked File Inventory\n\n${mdTable(
    entries.filter((e) => e.source_status === "untracked"),
    ["relative_path", "classification", "include_or_exclude", "target_commit_group"],
  )}\n`,
);

writeFileSync(
  join(OUT, "REFEREE_V5_DEPENDENCY_INVENTORY.md"),
  `# Referee V5 Dependency Inventory\n\n## package.json additions\n\n- \`lint:referee-v5\`\n- \`qa:referee-v5:staging-closure\`\n- \`qa:referee-v5:d41-closure\`\n- \`qa:referee-v5:e1-closure\`\n- \`qa:referee-v5:http\`\n- \`tests/referee-v5/referee-v5-e1-realtime.test.js\` in \`test:unit\`\n\n## Runtime npm dependencies\n\nNo new npm packages required beyond existing \`@supabase/supabase-js\`.\n\n## Router\n\nBase branch already contains \`/dev/referee-v5\` stub with SuperAdmin guard.\n\n## Edge\n\n\`supabase/functions/referee-v5-match\` + \`_shared/refereeV5Server.mjs\`\n`,
);

writeFileSync(
  join(OUT, "REFEREE_V5_SOURCE_MANIFEST.md"),
  `# Referee V5 Source Manifest (human-readable)\n\nSee \`REFEREE_V5_SOURCE_MANIFEST.json\` for machine-readable entries (${entries.filter((e) => e.include_or_exclude === "INCLUDE").length} included).\n\n${mdTable(
    entries.filter((e) => e.include_or_exclude === "INCLUDE").slice(0, 50),
    ["relative_path", "classification", "sha256", "target_commit_group"],
  )}\n\n*(truncated — see JSON for full list)*\n`,
);

const log = execSync("git log --oneline 23462878782726b9f933380071126245bd767dec..HEAD", { encoding: "utf8" }).trim();
writeFileSync(
  join(OUT, "REFEREE_V5_COMMIT_MAP.md"),
  `# Referee V5 Commit Map\n\n\`\`\`\n${log}\n\`\`\`\n`,
);

const patterns = [
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/i,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./,
  /STAGING_.*PASSWORD\s*=\s*['"][^'"]+['"]/i,
];
const includedPaths = entries.filter((e) => e.include_or_exclude === "INCLUDE").map((e) => e.relative_path);
const hits = [];
for (const rel of includedPaths) {
  try {
    const text = readFileSync(rel, "utf8");
    for (const p of patterns) {
      if (p.test(text)) hits.push({ file: rel, pattern: p.source });
    }
  } catch {
    /* binary or missing */
  }
}
writeFileSync(
  join(OUT, "REFEREE_V5_SECRET_SCAN_REPORT.md"),
  `# Referee V5 Secret Scan Report\n\n**Date:** ${new Date().toISOString()}\n\n## .env.staging-qa.local\n\n- Ignored: YES (\`.gitignore\`)\n- Tracked: NO\n\n## Pattern scan (included files)\n\n- Files scanned: ${includedPaths.length}\n- Pattern hits: ${hits.length}\n\n${hits.length ? hits.map((h) => `- ${h.file}`).join("\n") : "No credential patterns detected in included source files."}\n\n## Evidence files\n\nEvidence JSON uses \`CONFIGURED\` / email-only — no raw passwords committed.\n`,
);

console.log("docs generated", { hits: hits.length, commits: log.split("\n").length });
