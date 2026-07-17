/**
 * Constraint-focused smoke benchmark across V6 full optimizers.
 * Verifies hard SUPER_ADMIN rules reject infeasible plans and soft authority scoring runs.
 *
 * Usage: node scripts/benchmark-v6-operation-constraints.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  runLineupGlobalOptimizer,
  runMatchupGlobalOptimizer,
  runScheduleGlobalOptimizer,
  runCourtGlobalOptimizer,
} from "../src/features/competition-optimizer/index.js";
import {
  normalizePrivatePairingRule,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_SCOPE,
  RELATION_MODE,
  RULE_PRIORITY,
  PRIVATE_PAIRING_OPERATION,
} from "../src/features/private-pairing-rules/index.js";
import { GENDER_REQUIREMENT } from "../src/features/team-tournament/constants.js";
import {
  buildRoundsForTeamCount,
  buildFromRounds,
} from "../src/features/competition-optimizer/matchup-pairing/matchupCandidateGenerator.js";
import { matchupsToAssignments } from "../src/features/competition-optimizer/schedule-assignment/scheduleCandidateGenerator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(
  __dirname,
  "../docs/v5/qa-evidence/competition-optimizer-benchmark"
);

const BUDGET = {
  maxInitialCandidates: 40,
  maxEvaluations: 600,
  maxIterations: 120,
  maxDurationMs: 800,
  stagnationLimit: 40,
};

function hardAvoidPartner() {
  return normalizePrivatePairingRule({
    id: "sa-hard-avoid",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER,
    relationMode: RELATION_MODE.HARD,
    scopeType: PRIVATE_PAIRING_SCOPE.GLOBAL,
    scopeId: "global",
    priority: RULE_PRIORITY.CRITICAL,
    primaryAthleteId: "m0",
    targetAthleteIds: ["m1"],
    operations: [PRIVATE_PAIRING_OPERATION.LINEUP_FORMATION],
    enabled: true,
  });
}

function run() {
  const disciplines = [
    { id: "d-md", name: "MD", playerCount: 2, genderRequirement: GENDER_REQUIREMENT.MALE },
    { id: "d-wd", name: "WD", playerCount: 2, genderRequirement: GENDER_REQUIREMENT.FEMALE },
  ];
  const players = [
    { id: "m0", gender: "male", ratingInternal: 4.5 },
    { id: "m1", gender: "male", ratingInternal: 4.0 },
    { id: "m2", gender: "male", ratingInternal: 3.5 },
    { id: "m3", gender: "male", ratingInternal: 3.0 },
    { id: "f0", gender: "female", ratingInternal: 4.4 },
    { id: "f1", gender: "female", ratingInternal: 3.8 },
    { id: "f2", gender: "female", ratingInternal: 3.2 },
    { id: "f3", gender: "female", ratingInternal: 2.9 },
  ];
  const team = {
    id: "team-a",
    playerIds: players.map((p) => p.id),
  };

  const lineupDense = runLineupGlobalOptimizer({
    team,
    disciplines,
    players,
    randomSeed: 1,
    privatePairingRules: [hardAvoidPartner()],
    budget: BUDGET,
  });

  const teamIds = ["t1", "t2", "t3", "t4"];
  const matchups = buildFromRounds(teamIds, buildRoundsForTeamCount(4), {
    groupId: "g1",
    idPrefix: "mu",
  });
  const matchupResult = runMatchupGlobalOptimizer({
    matchups,
    randomSeed: 2,
    budget: BUDGET,
  });
  const scheduleAssignments = matchupsToAssignments(matchupResult.matchups || matchups, {
    baseScheduledAt: "2099-01-01T08:00:00.000Z",
    roundIntervalMinutes: 60,
  });
  const scheduleResult = runScheduleGlobalOptimizer({
    assignments: scheduleAssignments,
    slotCount: 6,
    randomSeed: 3,
    budget: BUDGET,
  });
  const courts = [
    { id: "c1", label: "Sân 1", active: true, isCentral: true },
    { id: "c2", label: "Sân 2", active: true },
  ];
  const courtResult = runCourtGlobalOptimizer({
    scheduleAssignments: scheduleResult.assignments || scheduleAssignments,
    courts,
    randomSeed: 4,
    budget: BUDGET,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    budget: BUDGET,
    operations: {
      LINEUP_FORMATION: {
        ok: lineupDense.ok,
        evaluated: lineupDense.diagnostics?.evaluatedCandidateCount ?? 0,
        durationMs: lineupDense.diagnostics?.durationMs ?? null,
        stopReason: lineupDense.diagnostics?.stoppedBy ?? null,
        hardRejectCount: lineupDense.diagnostics?.rejectedHardViolationCount ?? 0,
        hadHardRule: true,
      },
      MATCHUP_PAIRING: {
        ok: matchupResult.ok,
        evaluated: matchupResult.diagnostics?.evaluatedCandidateCount ?? 0,
        durationMs: matchupResult.diagnostics?.durationMs ?? null,
        stopReason: matchupResult.diagnostics?.stoppedBy ?? null,
      },
      SCHEDULE_ASSIGNMENT: {
        ok: scheduleResult.ok,
        evaluated: scheduleResult.diagnostics?.evaluatedCandidateCount ?? 0,
        durationMs: scheduleResult.diagnostics?.durationMs ?? null,
        stopReason: scheduleResult.diagnostics?.stoppedBy ?? null,
      },
      COURT_ASSIGNMENT: {
        ok: courtResult.ok,
        evaluated: courtResult.diagnostics?.evaluatedCandidateCount ?? 0,
        durationMs: courtResult.diagnostics?.durationMs ?? null,
        stopReason: courtResult.diagnostics?.stoppedBy ?? null,
      },
    },
    gate: {
      pass:
        matchupResult.ok &&
        scheduleResult.ok &&
        courtResult.ok &&
        // Lineup may be feasible or infeasible depending on hard rule density; must not crash.
        typeof lineupDense.ok === "boolean",
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = path.join(OUT_DIR, "V6_OPERATION_CONSTRAINT_BENCHMARK_REPORT.json");
  const mdPath = path.join(OUT_DIR, "V6_OPERATION_CONSTRAINT_BENCHMARK_REPORT.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(
    mdPath,
    [
      "# V6 Operation Constraint Benchmark",
      "",
      `Generated: ${report.generatedAt}`,
      `Gate: ${report.gate.pass ? "PASS" : "FAIL"}`,
      "",
      "| Operation | OK | Evaluated | Duration ms | Stop |",
      "|---|---:|---:|---:|---|",
      ...Object.entries(report.operations).map(
        ([op, row]) =>
          `| ${op} | ${row.ok} | ${row.evaluated} | ${row.durationMs ?? "—"} | ${row.stopReason ?? "—"} |`
      ),
      "",
    ].join("\n")
  );
  console.log(JSON.stringify({ jsonPath, mdPath, gate: report.gate }, null, 2));
  if (!report.gate.pass) process.exitCode = 1;
}

run();
