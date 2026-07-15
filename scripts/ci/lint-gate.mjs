#!/usr/bin/env node
/**
 * Phase 44C.3 — Lint no-new gate (baseline-controlled).
 *
 * Problem: `eslint .` currently reports a large, pre-existing repository-wide debt
 * (errors + warnings). We must keep the Production CI gate GREEN and trustworthy
 * WITHOUT hiding NEW regressions, and WITHOUT any of the forbidden shortcuts:
 *   - no disabling lint
 *   - no `continue-on-error`
 *   - no global repo ignore
 *   - no lowering rule severity merely to go green
 *   - no wildcard suppression
 *
 * Mechanism (mirrors scripts/ci/ownership-lock.mjs):
 *   - The exact historical violations are recorded per (file, rule, severity) OCCURRENCE
 *     COUNT in scripts/ci/lint-baseline.json (deterministic, OS-independent — paths are
 *     normalised to forward slashes so a Windows-generated baseline matches Linux CI).
 *   - `check` (default) fails on any NEW or INCREASED (file, rule, severity) count beyond
 *     the recorded baseline. Pre-existing debt is permitted; new/changed code must be clean.
 *   - `--write` regenerates the baseline (used deliberately, reviewed in the diff).
 *
 * Exceptions policy: the baseline IS the explicit, reviewable exception record. It is
 * temporary debt to burn down — never grow. To silence a single unavoidable line, fix the
 * code or add a narrowly-scoped `// eslint-disable-next-line <rule> -- <reason/phase>` on
 * that exact line (which removes it from the report). Wildcard/file-wide/global suppression
 * is not allowed.
 *
 * Usage:
 *   node scripts/ci/lint-gate.mjs            # check; exit 1 on new/increased violations
 *   node scripts/ci/lint-gate.mjs --write    # (re)generate the baseline
 *   node scripts/ci/lint-gate.mjs --report   # print all current violations (no fail)
 */
import { ESLint } from "eslint";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE_PATH = path.join(ROOT, "scripts", "ci", "lint-baseline.json");

function toRel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/");
}

function sevLabel(severity) {
  return severity === 2 ? "error" : "warning";
}

/** Returns { counts: {fingerprint: n}, errors, warnings }. */
async function collect() {
  const eslint = new ESLint({ cwd: ROOT });
  const results = await eslint.lintFiles(["."]);
  const counts = {};
  let errors = 0;
  let warnings = 0;
  for (const r of results) {
    const rel = toRel(r.filePath);
    for (const m of r.messages) {
      const rule = m.ruleId || "(no-rule)";
      const sev = sevLabel(m.severity);
      if (sev === "error") errors += 1;
      else warnings += 1;
      const key = `${rel}::${rule}::${sev}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return { counts, errors, warnings };
}

function sortObject(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

const mode = process.argv.includes("--write")
  ? "write"
  : process.argv.includes("--report")
    ? "report"
    : "check";

const { counts, errors, warnings } = await collect();
const total = errors + warnings;

if (mode === "report") {
  const keys = Object.keys(counts).sort();
  console.log(`lint-gate: ${keys.length} current fingerprint(s), ${total} problem(s) (${errors} errors, ${warnings} warnings)`);
  for (const k of keys) console.log(`  - ${k}  x${counts[k]}`);
  process.exit(0);
}

if (mode === "write") {
  const baseline = {
    note:
      "Phase 44C.3 lint baseline — TEMPORARY DEBT only. `npm run lint:no-new` fails on any NEW or INCREASED (file, rule, severity) occurrence beyond these recorded counts. This is NOT a suppression list: no rule is disabled and no path is ignored; new/changed code must be clean. Burn-down policy: shrink these numbers over post-GA hardening, target 0. Refresh only via `npm run lint:baseline` and review the diff.",
    generatedAt: new Date().toISOString().slice(0, 10),
    generatedFrom: "eslint . (flat config eslint.config.js)",
    removalPhase: "post-GA lint burn-down (target 0)",
    totals: { problems: total, errors, warnings },
    violations: sortObject(counts),
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
  console.log(
    `lint-gate: baseline written — ${Object.keys(counts).length} fingerprint(s), ${total} problem(s) (${errors} errors, ${warnings} warnings) → ${toRel(BASELINE_PATH)}`
  );
  process.exit(0);
}

// check mode
if (!existsSync(BASELINE_PATH)) {
  console.error("lint-gate: FAIL — baseline missing. Run `npm run lint:baseline` first.");
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const base = baseline.violations || {};

const introduced = [];
for (const [key, n] of Object.entries(counts)) {
  const allowed = base[key] || 0;
  if (n > allowed) introduced.push({ key, count: n, allowed, delta: n - allowed });
}
const resolved = Object.keys(base).filter((k) => (counts[k] || 0) < base[k]);

introduced.sort((a, b) => a.key.localeCompare(b.key));

if (introduced.length > 0) {
  console.error(`\nlint-gate: FAIL — ${introduced.length} new/increased lint violation(s) beyond the recorded baseline:\n`);
  for (const v of introduced) {
    console.error(`  + ${v.key}  (now ${v.count}, baseline ${v.allowed}, +${v.delta})`);
  }
  console.error(`\nFix the new violation(s). Do NOT edit the baseline to hide them.`);
  console.error(
    `If a single occurrence is truly unavoidable, add a narrowly-scoped\n` +
      `\`// eslint-disable-next-line <rule> -- <reason/phase>\` on that exact line (no wildcard/file-wide/global suppression).`
  );
  process.exit(1);
}

console.log(
  `lint-gate: OK — 0 new lint violations (baseline: ${baseline.totals?.problems ?? "?"} problems = ` +
    `${baseline.totals?.errors ?? "?"} errors + ${baseline.totals?.warnings ?? "?"} warnings` +
    `${resolved.length ? `; ${resolved.length} baseline fingerprint(s) improved — consider \`npm run lint:baseline\`` : ""}).`
);
process.exit(0);
