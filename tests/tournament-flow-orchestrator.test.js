import test from "node:test";
import assert from "node:assert/strict";

import { ANIMATION_MODES } from "../src/components/tournament/animation/animationUtils.js";
import {
  ANIMATION_TO_FLOW_KEY,
  FLOW_MODES,
  getFlowStepLabel,
  getFlowStepState,
  isGuidedFlow,
  resolveGuidedPipeline,
  resolveOfficialOpenPipeline,
} from "../src/components/tournament/animation/shared/tournamentFlowConfig.js";
import { isGuidedFlowMode } from "../src/components/tournament/animation/shared/tournamentFlowHelpers.js";

test("resolveGuidedPipeline includes bracket by default", () => {
  const pipeline = resolveGuidedPipeline();
  assert.deepEqual(pipeline, [
    ANIMATION_MODES.PAIRING_REVEAL,
    ANIMATION_MODES.SNAKE_GROUP,
    ANIMATION_MODES.GROUP_MATCH_PAIRING,
    ANIMATION_MODES.BRACKET_REVEAL,
  ]);
});

test("resolveGuidedPipeline can skip bracket step", () => {
  const pipeline = resolveGuidedPipeline({ includeBracket: false });
  assert.equal(pipeline.length, 3);
  assert.equal(pipeline.includes(ANIMATION_MODES.BRACKET_REVEAL), false);
});

test("resolveOfficialOpenPipeline starts with random draw", () => {
  const pipeline = resolveOfficialOpenPipeline({ includeBracket: false });
  assert.deepEqual(pipeline, [
    ANIMATION_MODES.RANDOM_DRAW,
    ANIMATION_MODES.GROUP_MATCH_PAIRING,
  ]);
});

test("getFlowStepState marks completed steps", () => {
  assert.equal(getFlowStepState("match_pairing", "pairing"), "done");
  assert.equal(getFlowStepState("match_pairing", "match_pairing"), "active");
  assert.equal(getFlowStepState("match_pairing", "bracket"), "pending");
});

test("animation modes map to flow keys", () => {
  assert.equal(ANIMATION_TO_FLOW_KEY[ANIMATION_MODES.PAIRING_REVEAL], "pairing");
  assert.equal(ANIMATION_TO_FLOW_KEY[ANIMATION_MODES.RANDOM_DRAW], "draw");
  assert.equal(ANIMATION_TO_FLOW_KEY[ANIMATION_MODES.BRACKET_REVEAL], "bracket");
});

test("guided flow helpers", () => {
  assert.equal(isGuidedFlow(FLOW_MODES.GUIDED), true);
  assert.equal(isGuidedFlowMode(FLOW_MODES.GUIDED), true);
  assert.equal(isGuidedFlow(FLOW_MODES.STANDALONE), false);
  assert.equal(getFlowStepLabel("bracket"), "Sơ đồ thi đấu");
});
