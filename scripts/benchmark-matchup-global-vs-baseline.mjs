/**
 * Benchmark: baseline RR matchups vs Matchup Global Optimizer.
 *
 * Usage: node scripts/benchmark-matchup-global-vs-baseline.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runMatchupGlobalOptimizer,
  compareAuthorityCandidates,
  isNotWorseThanBaseline,
} from "../src/features/competition-optimizer/index.js";
import { buildRoundsForTeamCount, buildFromRounds } from "../src/features/competition-optimizer/matchup-pairing/matchupCandidateGenerator.js";
import { computeMatchupDefaultPenalty } from "../src/features/competition-optimizer/matchup-pairing/matchupScoring.js";
import { buildScoreBreakdown } from "../src/features/private-pairing-rules/runtime/optimizationCandidateComparator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs/v5/qa-evidence/competition-optimizer-benchmark");

const TEAM_COUNTS = [3, 4, 5, 6];
const SEED_COUNT = 50;
const BENCHMARK_BUDGET = Object.freeze({
  maxInitialCandidates: 60,
  maxEvaluations: 1200,
  maxIterations: 300,
  maxDurationMs: 1200,
  stagnationLimit: 80,
});

function buildTeams(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Team ${i + 1}`,
    playerIds: [`p${i}a`, `p${i}b`],
    avgLevel: 3 + ((i * 17) % 20) / 10,
  }));
}

function baselinePlan(teamIds) {
  const rounds = buildRoundsForTeamCount(teamIds.length);
  return buildFromRounds(teamIds, rounds, { groupId: "g1", idPrefix: "base" });
}

function evaluateBaseline(matchups, teams) {
  const teamsById = Object.fromEntries(teams.map((team) => [team.id, team]));
  const defaultPenalty = computeMatchupDefaultPenalty(matchups, teamsById);
  return {
    feasible: true,
    scoreBreakdown: buildScoreBreakdown({ defaultPenalty }),
  };
}

function runBenchmark() {
  const rows = [];
  for (const teamCount of TEAM_COUNTS) {
    const teams = buildTeams(teamCount);
    const teamIds = teams.map((team) => team.id);
    const base = baselinePlan(teamIds);
    let improved = 0;
    let notWorse = 0;

    for (let seed = 1; seed <= SEED_COUNT; seed += 1) {
      const baseline = evaluateBaseline(base, teams);
      const result = runMatchupGlobalOptimizer({
        matchups: base,
        teams,
        teamIds,
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
      seeds: SEED_COUNT,
      notWorseRate: notWorse / SEED_COUNT,
      improvedRate: improved / SEED_COUNT,
      baselinePenalty: evaluateBaseline(base, teams).scoreBreakdown.totalPenalty,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    algorithm: "v6-matchup-global-optimizer-v1",
    seeds: SEED_COUNT,
    budget: BENCHMARK_BUDGET,
    rows,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, "MATCHUP_GLOBAL_VS_BASELINE_REPORT.json");
  const mdPath = path.join(OUT_DIR, "MATCHUP_GLOBAL_VS_BASELINE_REPORT.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    "# Matchup Global vs Baseline",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| Teams | Not-worse rate | Improved rate | Baseline penalty |",
    "|------:|---------------:|--------------:|-----------------:|",
    ...rows.map(
      (row) =>
        `| ${row.teamCount} | ${(row.notWorseRate * 100).toFixed(1)}% | ${(row.improvedRate * 100).toFixed(1)}% | ${row.baselinePenalty} |`
    ),
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, md);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

runBenchmark();
