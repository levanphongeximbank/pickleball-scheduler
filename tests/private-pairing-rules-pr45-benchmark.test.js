import test from "node:test";
import assert from "node:assert/strict";

import {
  FEATURE_FLAG_KEYS,
  simulatePrivatePairing,
} from "../src/features/private-pairing-rules/index.js";

const MAPPED = "MAPPED";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_SIMULATION]: "true",
};

function players(n) {
  return Array.from({ length: n }, (_, index) => ({
    playerId: `bench-p${index + 1}`,
    displayName: `B${index + 1}`,
    rating: 3 + (index % 6) * 0.15,
    gender: index % 2 === 0 ? "Nam" : "Nữ",
    mappingStatus: MAPPED,
    membershipStatus: "active",
    status: "active",
    clubId: "club-bench",
    tenantId: "tenant-bench",
  }));
}

async function runBenchmark(count) {
  const started = Date.now();
  const result = await simulatePrivatePairing({
    players: players(count),
    rules: [],
    seed: 123,
    topN: 10,
    maxCandidates: 200,
    maxIterations: 400,
    timeoutMs: 2000,
    courtCount: Math.max(1, Math.floor(count / 4)),
    options: { matchMode: true },
    envSource: FLAGS_ON,
  });
  const wallMs = Date.now() - started;
  return {
    players: count,
    eligiblePlayers: result.summary.playersEligible,
    matchesGenerated: result.selectedCandidates[0]?.matches?.length || 0,
    candidatesGenerated: result.summary.candidatesGenerated,
    candidatesRejected: result.summary.candidatesRejected,
    candidatesRanked: result.summary.candidatesRanked,
    executionTimeMs: result.summary.executionTimeMs,
    wallMs,
    searchLimitReached: result.summary.searchLimitReached,
    ok: result.ok,
  };
}

test("benchmark 8/16/24/32 players completes under timeout", async () => {
  const rows = [];
  for (const n of [8, 16, 24, 32]) {
    const row = await runBenchmark(n);
    rows.push(row);
    assert.ok(row.wallMs < 2500, `players=${n} wallMs=${row.wallMs}`);
    assert.ok(row.eligiblePlayers === n);
    assert.ok(row.ok === true || row.searchLimitReached === true);
  }
  // eslint-disable-next-line no-console
  console.log("PR45_BENCHMARK_JSON=" + JSON.stringify(rows));
});
