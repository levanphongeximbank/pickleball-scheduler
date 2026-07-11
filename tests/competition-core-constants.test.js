import test from "node:test";
import assert from "node:assert/strict";

import {
  DRAW_MODE,
  DRAW_MODE_VALUES,
  COMPETITION_RATING_STATUS,
  COMPETITION_RATING_STATUS_VALUES,
  RATING_SOURCE_VALUES,
  CONSTRAINT_SEVERITY_VALUES,
  COMPETITION_CONSTRAINT_TYPE_VALUES,
  COMPETITION_ENGINE_TYPE_VALUES,
  ENGINE_RUN_STATUS_VALUES,
  RATING_ELIGIBILITY_STATUS,
  RATING_ELIGIBILITY_STATUS_VALUES,
  isDrawMode,
} from "../src/features/competition-core/constants/index.js";

function assertUniqueValues(valuesSet, label) {
  const values = [...valuesSet];
  assert.equal(values.length, new Set(values).size, `${label} must not contain duplicate values`);
}

test("DRAW_MODE contains expected canonical values", () => {
  assert.equal(DRAW_MODE.PURE_RANDOM, "pure_random");
  assert.equal(DRAW_MODE.CONSTRAINED_RANDOM, "constrained_random");
  assert.equal(DRAW_MODE.SKILL_CONTROLLED, "skill_controlled");
  assert.equal(DRAW_MODE.MANUAL, "manual");
  assertUniqueValues(DRAW_MODE_VALUES, "DRAW_MODE");
});

test("rating and constraint constants are frozen sets", () => {
  assertUniqueValues(COMPETITION_RATING_STATUS_VALUES, "COMPETITION_RATING_STATUS");
  assertUniqueValues(RATING_SOURCE_VALUES, "RATING_SOURCE");
  assertUniqueValues(CONSTRAINT_SEVERITY_VALUES, "CONSTRAINT_SEVERITY");
  assertUniqueValues(COMPETITION_CONSTRAINT_TYPE_VALUES, "COMPETITION_CONSTRAINT_TYPE");
  assertUniqueValues(COMPETITION_ENGINE_TYPE_VALUES, "COMPETITION_ENGINE_TYPE");
  assertUniqueValues(ENGINE_RUN_STATUS_VALUES, "ENGINE_RUN_STATUS");
  assertUniqueValues(RATING_ELIGIBILITY_STATUS_VALUES, "RATING_ELIGIBILITY_STATUS");
});

test("isDrawMode validates known values only", () => {
  assert.equal(isDrawMode("pure_random"), true);
  assert.equal(isDrawMode("open"), false);
  assert.equal(isDrawMode(""), false);
  assert.equal(isDrawMode(null), false);
});

test("COMPETITION_RATING_STATUS does not reuse Pick_VN database enum keys", () => {
  assert.ok(COMPETITION_RATING_STATUS.PROVISIONAL);
  assert.ok(RATING_ELIGIBILITY_STATUS.ELIGIBLE);
  assert.equal(COMPETITION_RATING_STATUS_VALUES.has("self_declared"), false);
});
