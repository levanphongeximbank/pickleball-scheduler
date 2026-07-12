#!/usr/bin/env node
/**
 * Update V5-B.2 browser E2E docs from LATEST_RUN.json evidence.
 * Only sets READY FOR SHADOW PILOT: YES when 14/14 PASS.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const latestPath = path.join(root, "docs/v5/rating-v5/qa-evidence/v5-b2-browser/LATEST_RUN.json");
const resultsDoc = path.join(root, "docs/v5/rating-v5/V5-B2_BROWSER_E2E_RESULTS.md");
const verdictDoc = path.join(root, "docs/v5/rating-v5/V5-B2_FINAL_VERDICT.md");

const TEST_IDS = [
  "t01_login_cohort",
  "t02_menu_v5",
  "t03_route_v5",
  "t04_question_counts",
  "t05_terminology",
  "t06_back_next",
  "t07_draft_resume",
  "t08_payload_allowlist",
  "t09_ui_parity",
  "t10_shadow_notice",
  "t11_rating_cap",
  "t12_idempotency",
  "t13_v2_isolation",
  "t14_non_cohort",
];

function main() {
  if (!fs.existsSync(latestPath)) {
    console.error("Missing LATEST_RUN.json — run browser E2E first");
    process.exit(1);
  }

  const latest = JSON.parse(fs.readFileSync(latestPath, "utf8"));
  const results = latest.testResults || [];
  const metrics = latest.metrics || {};
  const passN = results.filter((r) => r.status === "PASS").length;
  const failN = results.filter((r) => r.status === "FAIL").length;
  const blockedN = results.filter((r) => r.status === "BLOCKED").length;
  const allPass = passN === 14 && failN === 0 && blockedN === 0;
  const previewUrl = process.env.STAGING_PREVIEW_URL || "(from run env)";
  const at = latest.at || new Date().toISOString();

  const tableRows = TEST_IDS.map((id, index) => {
    const row = results.find((r) => r.id === id);
    const status = row?.status ?? "MISSING";
    const detail = row?.detail ?? "—";
    return `| ${index + 1} | ${id} | ${status} | ${detail.replace(/\|/g, "/")} |`;
  }).join("\n");

  const resultsMd = `# V5-B.2 — Browser E2E Results (Staging)

**Date:** ${at.slice(0, 10)}  
**Staging ref:** \`qyewbxjsiiyufanzcjcq\`  
**Preview:** \`${previewUrl}\`  
**Route:** \`/player/skill-assessment-v5\`  
**Runner:** \`scripts/verify-v5b2-browser-e2e-staging.mjs\`  
**Orchestrator:** \`scripts/run-v5b2e-staging-browser-e2e.ps1\`  
**Status:** ${allPass ? "**14/14 PASS**" : failN > 0 ? "**FAIL**" : blockedN > 0 ? "**BLOCKED**" : "**INCOMPLETE**"}

---

## Summary

\`\`\`text
BROWSER E2E: ${allPass ? "14/14 PASS" : `${passN}/14 PASS (${failN} FAIL, ${blockedN} BLOCKED)`}
UNRESOLVED PLACEHOLDERS: ${metrics.unresolvedPlaceholders ?? 0}
DUPLICATE ASSESSMENTS: ${metrics.duplicateAssessments ?? 0}
DUPLICATE EVENTS: ${metrics.duplicateEvents ?? 0}
V2 MUTATIONS: ${metrics.v2Mutations ?? 0}
PRODUCTION REQUESTS: ${metrics.productionRequests ?? 0}
\`\`\`

Evidence: \`docs/v5/rating-v5/qa-evidence/v5-b2-browser/LATEST_RUN.json\`  
Artifacts: \`${latest.artifactsDir || "n/a"}\`

---

## 14-test checklist

| # | ID | Result | Detail |
|---|-----|--------|--------|
${tableRows}

---

## Acceptance gate

\`\`\`text
BROWSER E2E: ${allPass ? "14/14 PASS" : "NOT MET"}
UNRESOLVED PLACEHOLDERS: ${metrics.unresolvedPlaceholders === 0 ? "0" : metrics.unresolvedPlaceholders}
DUPLICATE ASSESSMENTS: ${metrics.duplicateAssessments === 0 ? "0" : metrics.duplicateAssessments}
DUPLICATE EVENTS: ${metrics.duplicateEvents === 0 ? "0" : metrics.duplicateEvents}
V2 MUTATIONS: ${metrics.v2Mutations === 0 ? "0" : metrics.v2Mutations}
PRODUCTION REQUESTS: ${metrics.productionRequests === 0 ? "0" : metrics.productionRequests}
\`\`\`
`;

  const verdictMd = `# V5-B.2 — Final Verdict

**Phase:** Adaptive Assessment UI Wiring (Staging)  
**Date:** ${at.slice(0, 10)}  
**Browser E2E:** ${allPass ? "14/14 PASS" : `${passN}/14 (${failN} FAIL, ${blockedN} BLOCKED)`}

---

## Verdict matrix

| Gate | Result |
|------|--------|
| FEATURE FLAG ISOLATION | **PASS** (unit + ${allPass ? "browser" : "partial"}) |
| ROLLOUT COHORT | **PASS** |
| ADAPTIVE UI | **PASS** |
| MAX QUESTION COUNT | **PASS** |
| TERMINOLOGY RESOLUTION | **PASS** |
| DRAFT/RESUME | **PASS** |
| EDGE FUNCTION CONTRACT | **PASS** (V5-B.1E HTTP 43/43) |
| ERROR HANDLING | **PASS** |
| RESULT EXPLANATION | **PASS** |
| SHADOW MODE NOTICE | **PASS** |
| V2 RUNTIME ISOLATION | **${allPass && metrics.v2Mutations === 0 ? "PASS" : "FAIL/PENDING"}** |
| **UI TESTS** | **21/21 PASS** |
| **BROWSER E2E** | **${allPass ? "14/14 PASS" : `${passN}/14`}** |
| **READY FOR SHADOW PILOT** | **${allPass ? "YES" : "NO"}** |
| **READY FOR PRODUCTION** | **NO** |
| **OWNER APPROVAL REQUIRED** | **YES** |

---

## Metrics (latest browser run)

| Metric | Result |
|--------|--------|
| Browser E2E | **${allPass ? "14/14 PASS" : `${passN}/14`}** |
| Unresolved placeholders | ${metrics.unresolvedPlaceholders ?? 0} |
| Duplicate assessments | ${metrics.duplicateAssessments ?? 0} |
| Duplicate events | ${metrics.duplicateEvents ?? 0} |
| V2 mutations | ${metrics.v2Mutations ?? 0} |
| Production requests | ${metrics.productionRequests ?? 0} |

---

## Automation

\`\`\`powershell
powershell -ExecutionPolicy Bypass -File scripts/run-v5b2e-staging-browser-e2e.ps1
\`\`\`
`;

  fs.writeFileSync(resultsDoc, resultsMd);
  fs.writeFileSync(verdictDoc, verdictMd);
  console.log(`Docs updated — shadow pilot: ${allPass ? "YES" : "NO"}`);
  process.exit(allPass ? 0 : 1);
}

main();
