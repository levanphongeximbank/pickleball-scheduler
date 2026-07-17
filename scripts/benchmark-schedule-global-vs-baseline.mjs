/**
 * Benchmark: baseline schedule vs Schedule Global Optimizer.
 *
 * Usage: node scripts/benchmark-schedule-global-vs-baseline.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runScheduleGlobalOptimizer,
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
} from "../src/features/competition-optimizer/index.js";
import { matchupsToAssignments } from "../src/features/competition-optimizer/schedule-assignment/scheduleCandidateGenerator.js";
import { computeScheduleDefaultPenalty } from "../src/features/competition-optimizer/schedule-assignment/scheduleScoring.js";
import { buildScoreBreakdown } from "../src/features/private-pairing-rules/runtime/optimizationCandidateComparator.js";
import { buildRoundsForTeamCount, buildFromRounds } from "../src/features/competition-optimizer/matchup-pairing/matchupCandidateGenerator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs/v5/qa-evidence/competition-optimizer-benchmark");

const TEAM_COUNTS = [3, 4, 5, 6];
const SEED_COUNT = 50;
const BENCHMARK_BUDGET = Object.freeze({
  maxInitialCandidates: 60,
  maxEvaluations: 1500,
  maxIterations: 350,
  maxDurationMs: 1500,
  stagnationLimit: 90,
});

function buildMatchups(teamCount) {
  const teamIds = Array.from({ length: teamCount }, (_, i) => `t${i + 1}`);
  const rounds = buildRoundsForTeamCount(teamCount);
  return buildFromRounds(teamIds, rounds, { groupId: "g1", idPrefix: "sched" });
}

function evaluateBaseline(assignments) {
  const defaultPenalty = computeScheduleDefaultPenalty(assignments);
  return {
    feasible: true,
    scoreBreakdown: buildScoreBreakdown({ defaultPenalty }),
  };
}

function runBenchmark() {
  const rows = [];
  for (const teamCount of TEAM_COUNTS) {
    const matchups = buildMatchups(teamCount);
    const slotCount = [...new Set(matchups.map((m) => m.roundNumber))].length;
    const baseAssignments = matchupsToAssignments(matchups, {
      baseScheduledAt: "2099-06-01T08:00:00.000Z",
      roundIntervalMinutes: 60,
    });
    let improved = 0;
    let notWorse = 0;

    for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
      const result = runScheduleGlobalOptimizer({
        matchups,
        slotCount,
        baseScheduledAt: "2099-06-01T08:00:00.000Z",
        roundIntervalMinutes: 60,
        randomSeed: seed,
        budget: BENCHMARK_BUDGET,
      });
      if (result.ok && isNotWorseThanBaseline(result.bestCandidate, result.baseline)) {
        notWorse += 1;
      }
      if (
        result.ok &&
        compareAuthorityCandidates(result.bestCandidate, result.baseline) < 0
      ) {
        improved += 1;
      }
    }

    rows.push({
      teamCount,
      slotCount,
      seeds: SEED_COUNT,
      notWorseRate: notWorse / SEED_COUNT,
      improvedRate: improved / SEED_COUNT,
      baselinePenalty: evaluateBaseline(baseAssignments).scoreBreakdown.totalPenalty,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    algorithm: "v6-schedule-global-optimizer-v1",
    seeds: SEED_COUNT,
    budget: BENCHMARK_BUDGET,
    rows,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, "SCHEDULE_GLOBAL_VS_BASELINE_REPORT.json");
  const mdPath = path.join(OUT_DIR, "SCHEDULE_GLOBAL_VS_BASELINE_REPORT.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    "# Schedule Global vs Baseline",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| Teams | Slots | Not-worse | Improved | Baseline penalty |",
    "|------:|------:|----------:|---------:|-----------------:|",
    ...rows.map(
      (row) =>
        `| ${row.teamCount} | ${row.slotCount} | ${(row.notWorseRate * 100).toFixed(1)}% | ${(row.improvedRate * 100).toFixed(1)}% | ${row.baselinePenalty} |`
    ),
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, md);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

runBenchmark();
