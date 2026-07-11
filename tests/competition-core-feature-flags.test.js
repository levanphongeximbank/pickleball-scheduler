import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPETITION_CORE_FLAG_KEYS,
  getCompetitionCoreFeatureFlags,
  isCompetitionCoreEnabled,
  isDrawV2Enabled,
  isMatchmakingV2Enabled,
  isRatingV2Enabled,
  isConstraintsV2Enabled,
  isStandingsV2Enabled,
} from "../src/features/competition-core/config/featureFlags.js";
import { parseEnvBoolean } from "../src/features/competition-core/config/envReader.js";

const EMPTY_ENV = {};

test("all competition core feature flags default to false", () => {
  const flags = getCompetitionCoreFeatureFlags(EMPTY_ENV);
  assert.equal(flags.coreEnabled, false);
  assert.equal(flags.ratingV2Enabled, false);
  assert.equal(flags.constraintsV2Enabled, false);
  assert.equal(flags.drawV2Enabled, false);
  assert.equal(flags.matchmakingV2Enabled, false);
  assert.equal(flags.standingsV2Enabled, false);

  assert.equal(isCompetitionCoreEnabled(EMPTY_ENV), false);
  assert.equal(isRatingV2Enabled(EMPTY_ENV), false);
  assert.equal(isConstraintsV2Enabled(EMPTY_ENV), false);
  assert.equal(isDrawV2Enabled(EMPTY_ENV), false);
  assert.equal(isMatchmakingV2Enabled(EMPTY_ENV), false);
  assert.equal(isStandingsV2Enabled(EMPTY_ENV), false);
});

test("parseEnvBoolean handles true/false strings safely", () => {
  assert.equal(parseEnvBoolean("true"), true);
  assert.equal(parseEnvBoolean("TRUE"), true);
  assert.equal(parseEnvBoolean("false"), false);
  assert.equal(parseEnvBoolean("FALSE"), false);
  assert.equal(parseEnvBoolean(undefined), false);
  assert.equal(parseEnvBoolean("maybe"), false);
  assert.equal(parseEnvBoolean(1), true);
  assert.equal(parseEnvBoolean(0), false);
});

test("sub-flags require core flag enabled", () => {
  const env = {
    [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true",
    [COMPETITION_CORE_FLAG_KEYS.RATING_V2]: "true",
    [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "true",
  };

  assert.equal(isDrawV2Enabled(env), false);
  assert.equal(isRatingV2Enabled(env), false);
  assert.equal(isConstraintsV2Enabled(env), false);

  const enabledEnv = {
    [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
    [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "true",
    [COMPETITION_CORE_FLAG_KEYS.MATCHMAKING_V2]: "true",
    [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "true",
  };

  assert.equal(isCompetitionCoreEnabled(enabledEnv), true);
  assert.equal(isDrawV2Enabled(enabledEnv), true);
  assert.equal(isMatchmakingV2Enabled(enabledEnv), true);
  assert.equal(isConstraintsV2Enabled(enabledEnv), true);
  assert.equal(isStandingsV2Enabled(enabledEnv), false);
});

test("invalid env values resolve to false", () => {
  const env = {
    [COMPETITION_CORE_FLAG_KEYS.CORE]: "yes-but-not-true",
    [COMPETITION_CORE_FLAG_KEYS.DRAW_V2]: "enabled",
  };

  assert.equal(getCompetitionCoreFeatureFlags(env).coreEnabled, false);
  assert.equal(isDrawV2Enabled(env), false);
});
