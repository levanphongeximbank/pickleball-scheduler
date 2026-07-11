import test from "node:test";
import assert from "node:assert/strict";

import { resolveKFactor, DEFAULT_K_FACTOR_TIERS } from "../src/features/competition-core/rating/index.js";

test("resolveKFactor uses tier defaults", () => {
  assert.equal(resolveKFactor(0), 40);
  assert.equal(resolveKFactor(9), 40);
  assert.equal(resolveKFactor(10), 32);
  assert.equal(resolveKFactor(49), 32);
  assert.equal(resolveKFactor(50), 20);
  assert.equal(resolveKFactor(200), 20);
});

test("resolveKFactor respects custom tiers", () => {
  const custom = [{ maxMatches: 5, kFactor: 50 }, { maxMatches: null, kFactor: 10 }];
  assert.equal(resolveKFactor(3, custom), 50);
  assert.equal(resolveKFactor(99, custom), 10);
});

test("DEFAULT_K_FACTOR_TIERS has three tiers", () => {
  assert.equal(DEFAULT_K_FACTOR_TIERS.length, 3);
});
