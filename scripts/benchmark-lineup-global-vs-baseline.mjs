/**
 * Benchmark: LINEUP greedy/baseline vs Global Optimizer.
 *
 * Usage: node scripts/benchmark-lineup-global-vs-baseline.mjs
 * No merge. No deploy. No migration.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
  runLineupGlobalOptimizer,
  computeLineupFairnessMetrics,
} from "../src/features/competition-optimizer/index.js";
import { GENDER_REQUIREMENT } from "../src/features/team-tournament/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(
  ROOT,
  "docs/v5/qa-evidence/competition-optimizer-benchmark"
);

const TEAM_SIZES = [4, 6, 8, 12];
const SEED_COUNT = 100;
const BENCHMARK_BUDGET = Object.freeze({
  maxInitialCandidates: 60,
  maxEvaluations: 1200,
  maxIterations: 300,
  maxDurationMs: 1200,
  stagnationLimit: 80,
});

function buildDisciplines() {
  return [
    { id: "d-md", name: "MD", playerCount: 2, genderRequirement: GENDER_REQUIREMENT.MALE },
    { id: "d-wd", name: "WD", playerCount: 2, genderRequirement: GENDER_REQUIREMENT.FEMALE },
    { id: "d-xd", name: "XD", playerCount: 2, genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR },
  ];
}

function buildTeam(size) {
  const males = Math.ceil(size / 2);
  const females = size - males;
  const players = [];
  for (let i = 0; i < males; i += 1) {
    players.push({
      id: `m${size}-${i}`,
      gender: "male",
      ratingInternal: 5 - (i / Math.max(1, males - 1)) * 2.2,
    });
  }
  for (let i = 0; i < females; i += 1) {
    players.push({
      id: `f${size}-${i}`,
      gender: "female",
      ratingInternal: 4.8 - (i / Math.max(1, females - 1)) * 2.0,
    });
  }
  return {
    team: { id: `team-${size}`, name: `Team ${size}`, playerIds: players.map((p) => p.id) },
    players,
  };
}

function summarize(values) {
  if (!values.length) return { avg: null, median: null, best: null, worst: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    avg: sorted.reduce((s, v) => s + v, 0) / sorted.length,
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    best: sorted[0],
    worst: sorted[sorted.length - 1],
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fixtures = [];
  let authorityRegressions = 0;
  let hardRegressions = 0;

  for (const size of TEAM_SIZES) {
    const { team, players } = buildTeam(size);
    const disciplines = buildDisciplines();
    const rows = [];

    for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
      const global = runLineupGlobalOptimizer({
        team,
        disciplines,
        players,
        randomSeed: seed,
        allowReuse: players.length < 6,
        budget: BENCHMARK_BUDGET,
      });

      const baseline = global.baseline;
      if (baseline?.feasible && !global.ok) hardRegressions += 1;
      if (
        baseline?.feasible &&
        global.bestCandidate &&
        !isNotWorseThanBaseline(global.bestCandidate, baseline)
      ) {
        authorityRegressions += 1;
      }

      rows.push({
        seed,
        baselineFeasible: baseline?.feasible === true,
        globalFeasible: global.ok,
        baselineDefault: baseline?.scoreBreakdown?.defaultPenalty ?? null,
        globalDefault: global.scoreBreakdown?.defaultPenalty ?? null,
        baselineDurationMs: null,
        globalDurationMs: global.diagnostics?.durationMs ?? null,
        evaluated: global.diagnostics?.evaluatedCandidateCount ?? 0,
        cmp:
          baseline?.feasible && global.bestCandidate
            ? compareAuthorityCandidates(global.bestCandidate, baseline)
            : null,
      });
    }

    fixtures.push({
      teamSize: size,
      seedCount: SEED_COUNT,
      feasibleRate:
        rows.filter((r) => r.globalFeasible).length / Math.max(1, rows.length),
      defaultPenalty: summarize(
        rows.filter((r) => r.globalDefault != null).map((r) => r.globalDefault)
      ),
      durationMs: summarize(
        rows.filter((r) => r.globalDurationMs != null).map((r) => r.globalDurationMs)
      ),
      notWorseRate:
        rows.filter((r) => r.cmp != null && r.cmp <= 0).length /
        Math.max(1, rows.filter((r) => r.cmp != null).length),
      rows,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    algorithmVersion: "v6-lineup-global-optimizer-v1",
    seedCountPerFixture: SEED_COUNT,
    budget: BENCHMARK_BUDGET,
    authorityRegressions,
    hardRegressions,
    fixtures,
    gate: {
      hardRuleRegressions: hardRegressions,
      authorityRegressions,
      pass: hardRegressions === 0 && authorityRegressions === 0,
    },
  };

  const jsonPath = path.join(OUT_DIR, "LINEUP_GLOBAL_VS_BASELINE_REPORT.json");
  const mdPath = path.join(OUT_DIR, "LINEUP_GLOBAL_VS_BASELINE_REPORT.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const lines = [
    "# LINEUP Global Optimizer vs Baseline",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Seeds/fixture: ${SEED_COUNT}`,
    `- Hard regressions: ${hardRegressions}`,
    `- Authority regressions: ${authorityRegressions}`,
    `- Gate: ${report.gate.pass ? "PASS" : "FAIL"}`,
    "",
    "| Team size | Feasible rate | Not-worse rate | Avg default | Avg duration ms |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const fixture of fixtures) {
    lines.push(
      `| ${fixture.teamSize} | ${(fixture.feasibleRate * 100).toFixed(1)}% | ${(fixture.notWorseRate * 100).toFixed(1)}% | ${fixture.defaultPenalty.avg?.toFixed(2) ?? "—"} | ${fixture.durationMs.avg?.toFixed(1) ?? "—"} |`
    );
  }
  fs.writeFileSync(mdPath, `${lines.join("\n")}\n`);

  // Keep helper referenced for future metric extensions in JSON consumers.
  void computeLineupFairnessMetrics;
  console.log(JSON.stringify({ jsonPath, mdPath, gate: report.gate }, null, 2));
  if (!report.gate.pass) process.exitCode = 1;
}

main();
