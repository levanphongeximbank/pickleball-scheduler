/**
 * Benchmark: baseline court assignment vs Court Global Optimizer.
 *
 * Usage: node scripts/benchmark-court-global-vs-baseline.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runCourtGlobalOptimizer,
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
} from "../src/features/competition-optimizer/index.js";
import { scheduleRowsToCourtAssignments } from "../src/features/competition-optimizer/court-assignment/courtCandidateGenerator.js";
import { computeCourtDefaultPenalty } from "../src/features/competition-optimizer/court-assignment/courtScoring.js";
import { buildScoreBreakdown } from "../src/features/private-pairing-rules/runtime/optimizationCandidateComparator.js";
import { matchupsToAssignments } from "../src/features/competition-optimizer/schedule-assignment/scheduleCandidateGenerator.js";
import { buildRoundsForTeamCount, buildFromRounds } from "../src/features/competition-optimizer/matchup-pairing/matchupCandidateGenerator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs/v5/qa-evidence/competition-optimizer-benchmark");

const TEAM_COUNTS = [3, 4, 5, 6];
const SEED_COUNT = 50;
const BENCHMARK_BUDGET = Object.freeze({
  maxInitialCandidates: 50,
  maxEvaluations: 1200,
  maxIterations: 300,
  maxDurationMs: 1200,
  stagnationLimit: 80,
});

function buildScheduleAssignments(teamCount) {
  const teamIds = Array.from({ length: teamCount }, (_, i) => `t${i + 1}`);
  const rounds = buildRoundsForTeamCount(teamCount);
  const matchups = buildFromRounds(teamIds, rounds, { groupId: "g1", idPrefix: "court" });
  return matchupsToAssignments(matchups, {
    baseScheduledAt: "2099-06-01T08:00:00.000Z",
    roundIntervalMinutes: 60,
  });
}

function buildCourts(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    id: `court-${i + 1}`,
    label: `Sân ${i + 1}`,
    active: true,
    isCentral: i === 0,
    capacity: 2,
  }));
}

function maxConcurrentMatches(assignments = []) {
  const bySlot = new Map();
  for (const row of assignments) {
    const key = String(row.slotIndex ?? row.scheduledAt ?? "");
    bySlot.set(key, (bySlot.get(key) || 0) + 1);
  }
  return Math.max(1, ...bySlot.values(), 1);
}

function evaluateBaseline(assignments, courts) {
  const defaultPenalty = computeCourtDefaultPenalty(assignments, courts);
  return {
    feasible: true,
    scoreBreakdown: buildScoreBreakdown({ defaultPenalty }),
  };
}

function runBenchmark() {
  const rows = [];
  let authorityRegressions = 0;
  let hardRegressions = 0;

  for (const teamCount of TEAM_COUNTS) {
    const scheduleAssignments = buildScheduleAssignments(teamCount);
    const courtCount = Math.max(
      teamCount <= 3 ? 1 : 2,
      maxConcurrentMatches(scheduleAssignments)
    );
    const courts = buildCourts(courtCount);
    const baseAssignments = scheduleRowsToCourtAssignments(scheduleAssignments, courts);
    let improved = 0;
    let notWorse = 0;
    let feasible = 0;

    for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
      const result = runCourtGlobalOptimizer({
        scheduleAssignments,
        courts,
        randomSeed: seed,
        budget: BENCHMARK_BUDGET,
      });
      if (result.ok) feasible += 1;
      else hardRegressions += 1;

      if (result.ok && result.baseline?.feasible) {
        if (isNotWorseThanBaseline(result.bestCandidate, result.baseline)) {
          notWorse += 1;
        } else {
          authorityRegressions += 1;
        }
        if (compareAuthorityCandidates(result.bestCandidate, result.baseline) < 0) {
          improved += 1;
        }
      }
    }

    rows.push({
      teamCount,
      courtCount: courts.length,
      seeds: SEED_COUNT,
      feasibleRate: feasible / SEED_COUNT,
      notWorseRate: notWorse / Math.max(1, feasible),
      improvedRate: improved / Math.max(1, feasible),
      baselinePenalty: evaluateBaseline(baseAssignments, courts).scoreBreakdown.totalPenalty,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    algorithm: "v6-court-global-optimizer-v1",
    seeds: SEED_COUNT,
    budget: BENCHMARK_BUDGET,
    authorityRegressions,
    hardRegressions,
    gate: {
      hardRuleRegressions: hardRegressions,
      authorityRegressions,
      pass: hardRegressions === 0 && authorityRegressions === 0,
    },
    rows,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, "COURT_GLOBAL_VS_BASELINE_REPORT.json");
  const mdPath = path.join(OUT_DIR, "COURT_GLOBAL_VS_BASELINE_REPORT.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    "# Court Global vs Baseline",
    "",
    `Generated: ${report.generatedAt}`,
    `- Gate: ${report.gate.pass ? "PASS" : "FAIL"}`,
    `- Hard regressions: ${hardRegressions}`,
    `- Authority regressions: ${authorityRegressions}`,
    "",
    "| Teams | Courts | Feasible | Not-worse | Improved | Baseline penalty |",
    "|------:|-------:|---------:|----------:|---------:|-----------------:|",
    ...rows.map(
      (row) =>
        `| ${row.teamCount} | ${row.courtCount} | ${(row.feasibleRate * 100).toFixed(1)}% | ${(row.notWorseRate * 100).toFixed(1)}% | ${(row.improvedRate * 100).toFixed(1)}% | ${row.baselinePenalty} |`
    ),
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, md);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  if (!report.gate.pass) process.exitCode = 1;
}

runBenchmark();
