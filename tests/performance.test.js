import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { runPairingEngine } from "../src/ai/pairing.js";
import {
  PERF_BASELINES_MS,
  PERF_SCENARIOS,
} from "./performance.baselines.js";

function createPlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    level: 2.5 + (index % 10) * 0.1,
  }));
}

function createCourts(courtCount) {
  const players = createPlayers(courtCount * 4);
  const courts = [];

  for (let i = 0; i < courtCount; i++) {
    courts.push({
      id: i + 1,
      players: players.slice(i * 4, i * 4 + 4),
    });
  }

  return courts;
}

for (const scenario of PERF_SCENARIOS) {
  test(`performance: runPairingEngine handles ${scenario.courtCount} courts`, () => {
    const courts = createCourts(scenario.courtCount);

    const start = performance.now();
    const result = runPairingEngine(courts, {
      history: {},
      policies: [],
      rules: [],
    });
    const durationMs = performance.now() - start;

    assert.equal(result.length, 3);
    assert.ok(
      durationMs <= PERF_BASELINES_MS[scenario.name],
      `${scenario.name} exceeded baseline: ${durationMs.toFixed(2)}ms > ${PERF_BASELINES_MS[scenario.name]}ms`
    );
  });
}
