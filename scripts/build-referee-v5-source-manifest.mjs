#!/usr/bin/env node
/**
 * Read-only inventory + manifest for Referee V5 source capture.
 * Does not modify source files except writing docs under source-capture/.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative, posix } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "docs/v5/referee-v5/source-capture");

function sha256File(abs) {
  const buf = readFileSync(abs);
  return createHash("sha256").update(buf).digest("hex");
}

function classify(rel) {
  const p = rel.replace(/\\/g, "/");

  if (/\.env(\.|$)/i.test(p) || p.endsWith(".local")) return "SECRET_OR_LOCAL_ONLY";
  if (p.includes("node_modules/") || p.startsWith("dist/") || p.startsWith("coverage/")) return "GENERATED";

  if (p.startsWith("src/features/referee-v5/engines/")) return "REFEREE_RUNTIME_CORE";
  if (p.startsWith("src/features/referee-v5/domain/")) return "REFEREE_RUNTIME_CORE";
  if (p.startsWith("src/features/referee-v5/constants/") && !p.includes("realtime")) return "REFEREE_RUNTIME_CORE";
  if (p.startsWith("src/features/referee-v5/selectors/")) return "REFEREE_RUNTIME_CORE";
  if (p === "src/features/referee-v5/flags.js") return "REFEREE_RUNTIME_CORE";
  if (p === "src/features/referee-v5/index.js") return "REFEREE_RUNTIME_CORE";

  if (p.startsWith("src/features/referee-v5/components/")) return "REFEREE_UI";
  if (p.startsWith("src/features/referee-v5/hooks/useCourtVisualizer")) return "REFEREE_UI";
  if (p.startsWith("src/features/referee-v5/hooks/useRefereeMatchController")) return "REFEREE_UI";
  if (p.startsWith("src/features/referee-v5/hooks/useRefereeConfirmation")) return "REFEREE_UI";
  if (p.startsWith("src/features/referee-v5/styles/")) return "REFEREE_UI";
  if (p.startsWith("src/features/referee-v5/prototype/")) return "REFEREE_UI";
  if (p === "src/pages/dev/RefereeV5PreviewPage.jsx") return "REFEREE_UI";

  if (p.startsWith("src/features/referee-v5/persistence/")) return "REFEREE_PERSISTENCE";
  if (p.startsWith("src/features/referee-v5/adapters/")) return "REFEREE_PERSISTENCE";
  if (p.startsWith("src/features/referee-v5/services/")) return "REFEREE_PERSISTENCE";
  if (p.startsWith("src/features/referee-v5/server/")) return "REFEREE_PERSISTENCE";

  if (p.startsWith("src/features/referee-v5/realtime/")) return "REFEREE_REALTIME";
  if (p.startsWith("src/features/referee-v5/constants/realtime")) return "REFEREE_REALTIME";
  if (p.startsWith("src/features/referee-v5/hooks/useRefereeRealtime")) return "REFEREE_REALTIME";
  if (p.startsWith("src/features/referee-v5/hooks/useRefereeRemote")) return "REFEREE_REALTIME";

  if (p.startsWith("supabase/functions/referee-v5-match/")) return "REFEREE_EDGE";
  if (p === "supabase/functions/_shared/refereeV5Server.mjs") return "REFEREE_EDGE";
  if (p === "scripts/bundle-referee-v5-edge-shared.mjs") return "REFEREE_EDGE";
  if (p === "scripts/deploy-referee-v5-edge-staging.mjs") return "REFEREE_EDGE";

  if (p.startsWith("docs/v5/referee-v5/PHASE_V5")) return "REFEREE_DATABASE";
  if (p.startsWith("docs/v5/mcp-chunks/v5d1")) return "REFEREE_DATABASE";

  if (p.startsWith("tests/referee-v5/referee-v5-engine")) return "REFEREE_TEST";
  if (p.startsWith("tests/referee-v5/referee-v5-command")) return "REFEREE_TEST";
  if (p.startsWith("tests/referee-v5/testHelpers")) return "REFEREE_TEST";
  if (p.startsWith("tests/referee-v5/referee-v5-persistence")) return "REFEREE_TEST";
  if (p.startsWith("tests/referee-v5/referee-v5-d1")) return "REFEREE_TEST";
  if (p.startsWith("tests/referee-v5/referee-v5-e1")) return "REFEREE_TEST";
  if (p === "tests/ui/referee-v5-c.test.jsx") return "REFEREE_TEST";

  if (p.startsWith("scripts/verify-referee-v5")) return "REFEREE_QA_SCRIPT";
  if (p.startsWith("scripts/seed-referee-v5")) return "REFEREE_QA_SCRIPT";
  if (p === "scripts/referee-v5-staging-harness.mjs") return "REFEREE_QA_SCRIPT";
  if (p === "scripts/lint-referee-v5-scoped.mjs") return "REFEREE_QA_SCRIPT";
  if (p.startsWith("scripts/apply-phase-v5d")) return "REFEREE_QA_SCRIPT";
  if (p === "scripts/apply-phase-v5e1-staging.mjs") return "REFEREE_QA_SCRIPT";
  if (p === "scripts/verify-phase-v5d2-staging.mjs") return "REFEREE_QA_SCRIPT";
  if (p === "scripts/deploy-referee-v5-preview-staging.mjs") return "REFEREE_QA_SCRIPT";
  if (p === "scripts/ensure-staging-qa-password-env.mjs") return "REFEREE_QA_SCRIPT";

  if (p.startsWith("docs/v5/referee-v5/source-capture/_")) return "GENERATED";
  if (p === "scripts/build-referee-v5-source-manifest.mjs") return "REFEREE_QA_SCRIPT";
  if (p.startsWith("docs/v5/referee-v5/source-capture/")) return "REFEREE_DOCUMENTATION";
  if (p.startsWith("docs/v5/referee-v5/")) return "REFEREE_DOCUMENTATION";
  if (p.startsWith("docs/v5/qa-evidence/phase-v5d")) return "REFEREE_DOCUMENTATION";
  if (p.startsWith("docs/v5/qa-evidence/phase-v5e1")) return "REFEREE_DOCUMENTATION";
  if (p === "docs/v5/REFEREE_MODULE_CURRENT_STATE_AUDIT.md") return "REFEREE_DOCUMENTATION";

  if (p.startsWith("docs/v5/team-tournament/tt5-preparation/")) return "TEAM_TOURNAMENT";
  if (p.startsWith("docs/v5/team-tournament/TT5-A_")) return "TEAM_TOURNAMENT";
  if (p.startsWith("docs/v5/qa-evidence/phase-tt")) return "TEAM_TOURNAMENT";
  if (p.startsWith("docs/v5/mcp-chunks/tt")) return "TEAM_TOURNAMENT";
  if (p.startsWith("scripts/debug-tt")) return "TEAM_TOURNAMENT";
  if (p.startsWith("scripts/apply-v5a-rating") || p.startsWith("scripts/apply-v5b1p")) return "RATING_V5";
  if (p.startsWith("scripts/bundle-rating") || p.startsWith("scripts/deploy-v5b1e")) return "RATING_V5";
  if (p.startsWith("scripts/generate-rating") || p.startsWith("scripts/generate-v5-b0")) return "RATING_V5";
  if (p.startsWith("scripts/verify-v5a") || p.startsWith("scripts/verify-v5b1")) return "RATING_V5";
  if (p.startsWith("scripts/run-v5-benchmark")) return "RATING_V5";
  if (p.startsWith("scripts/predeploy-v5b1e")) return "RATING_V5";
  if (p.startsWith("scripts/inspect-rating")) return "RATING_V5";
  if (p.startsWith("scripts/generate-v5-data")) return "RATING_V5";
  if (p.startsWith("scripts/generate-v5-b0f")) return "RATING_V5";
  if (p.startsWith("supabase/functions/rating-v5")) return "RATING_V5";
  if (p === "supabase/functions/_shared/ratingV5Server.mjs") return "RATING_V5";
  if (p.startsWith("scripts/deploy-v5b2") || p.startsWith("scripts/probe-v5b2") || p.startsWith("scripts/run-v5b2e")) return "RATING_V5";
  if (p.startsWith("scripts/_probe") || p.startsWith("scripts/_debug")) return "UNRELATED";
  if (p.startsWith("scripts/lint-v5-scoped")) return "RATING_V5";
  if (p.startsWith("scripts/probe-preview") || p.startsWith("scripts/scan-preview")) return "UNRELATED";
  if (p.startsWith("scripts/debug-captain")) return "TEAM_TOURNAMENT";
  if (p === "scripts/staging-auth-resolve.mjs") return "REFEREE_QA_SCRIPT";
  if (p === "package-lock.json") return "SHARED_DEPENDENCY";
  if (p.startsWith("src/auth/menuAccess.js") || p.startsWith("src/config/navigationConfig.js")) return "UNRELATED";
  if (p.startsWith("supabase/.temp/")) return "GENERATED";

  return "UNKNOWN";
}

function commitGroup(classification, rel) {
  const map = {
    REFEREE_RUNTIME_CORE: "commit-1-domain",
    REFEREE_UI: "commit-2-ui",
    REFEREE_PERSISTENCE: "commit-3-persistence-edge",
    REFEREE_EDGE: "commit-3-persistence-edge",
    REFEREE_REALTIME: "commit-4-realtime",
    REFEREE_DATABASE: "commit-5-migrations",
    REFEREE_TEST: "commit-1-domain|commit-3|commit-4|commit-6",
    REFEREE_QA_SCRIPT: "commit-6-qa",
    REFEREE_DOCUMENTATION: "commit-7-docs",
    SHARED_DEPENDENCY: "commit-6-qa",
  };
  if (rel.includes("referee-v5-engine") || rel.includes("referee-v5-command") || rel.includes("testHelpers")) return "commit-1-domain";
  if (rel.includes("referee-v5-persistence") || rel.includes("referee-v5-d1")) return "commit-3-persistence-edge";
  if (rel.includes("referee-v5-e1")) return "commit-4-realtime";
  if (rel.includes("referee-v5-c.test")) return "commit-2-ui";
  if (classification === "REFEREE_TEST") return "commit-6-qa";
  return map[classification] || null;
}

function shouldInclude(classification, rel) {
  if (["SECRET_OR_LOCAL_ONLY", "GENERATED", "TEAM_TOURNAMENT", "RATING_V5", "UNRELATED", "UNKNOWN"].includes(classification)) {
    return false;
  }
  if (rel.replace(/\\/g, "/").startsWith("docs/v5/referee-v5/source-capture/_")) return false;
  return true;
}

function excludeReason(classification, rel) {
  if (classification === "SECRET_OR_LOCAL_ONLY") return "Secret or local-only file";
  if (classification === "GENERATED") return "Generated or temp artifact";
  if (classification === "TEAM_TOURNAMENT") return "Team Tournament scope";
  if (classification === "RATING_V5") return "Rating V5 scope";
  if (classification === "UNRELATED") return "Unrelated change on dirty tree";
  if (classification === "UNKNOWN") return "Role not determined — exclude pending review";
  if (rel.startsWith("docs/v5/referee-v5/source-capture/_")) return "Internal capture scratch";
  return null;
}

mkdirSync(OUT, { recursive: true });

const status = execSync("git status --short", { encoding: "utf8" });
const untracked = execSync("git ls-files --others --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const modified = [];
for (const line of status.split("\n")) {
  const m = line.match(/^.\s+(.+)$/);
  if (m && line.startsWith(" M") || line.startsWith("M ")) modified.push(m[1].trim());
}

const allPaths = new Set([...untracked, ...modified]);

const entries = [];
for (const rel of [...allPaths].sort()) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) continue;
  const classification = classify(rel);
  const include = shouldInclude(classification, rel);
  const sourceStatus = untracked.includes(rel) ? "untracked" : "modified";
  let sha256 = null;
  try {
    sha256 = sha256File(abs);
  } catch {
    sha256 = null;
  }
  entries.push({
    relative_path: rel.replace(/\\/g, "/"),
    classification,
    source_status: sourceStatus,
    sha256,
    include_or_exclude: include ? "INCLUDE" : "EXCLUDE",
    reason: include ? "Approved for Referee V5 source capture" : excludeReason(classification, rel),
    target_commit_group: include ? commitGroup(classification, rel.replace(/\\/g, "/")) : null,
  });
}

writeFileSync(join(OUT, "REFEREE_V5_SOURCE_MANIFEST.json"), JSON.stringify({ generatedAt: new Date().toISOString(), baseSha: "23462878782726b9f933380071126245bd767dec", entries }, null, 2));

const included = entries.filter((e) => e.include_or_exclude === "INCLUDE");
const excluded = entries.filter((e) => e.include_or_exclude === "EXCLUDE");
const unknown = entries.filter((e) => e.classification === "UNKNOWN");

console.log(JSON.stringify({ total: entries.length, included: included.length, excluded: excluded.length, unknown: unknown.length }));
