import test from "node:test";
import assert from "node:assert/strict";

import { TOURNAMENT_LEVEL } from "../src/models/tournament/constants.js";
import { VPR_PLACEMENT } from "../src/features/vpr-ranking/constants/vprPlacements.js";
import {
  calculateVprPoints,
  lookupBasePoints,
  resolveParticipantMultiplier,
} from "../src/features/vpr-ranking/engines/vprCalculationEngine.js";
import { DEFAULT_VPR_POINT_TABLE } from "../src/features/vpr-ranking/constants/defaultPointConfig.js";
import { resetVprLocalStoreForTests } from "../src/features/vpr-ranking/storage/vprLocalStore.js";

test("participant multiplier v1 is always 1.0", () => {
  assert.equal(resolveParticipantMultiplier(8), 1.0);
  assert.equal(resolveParticipantMultiplier(128), 1.0);
});

test("lookupBasePoints returns seeded champion certified points", () => {
  assert.equal(
    lookupBasePoints(TOURNAMENT_LEVEL.CERTIFIED, VPR_PLACEMENT.CHAMPION, DEFAULT_VPR_POINT_TABLE),
    150
  );
  assert.equal(
    lookupBasePoints(TOURNAMENT_LEVEL.VPT_FINALS, VPR_PLACEMENT.CHAMPION, DEFAULT_VPR_POINT_TABLE),
    2000
  );
});

test("calculateVprPoints returns 0 for non-VPR levels", () => {
  assert.equal(
    calculateVprPoints({
      tournamentLevel: TOURNAMENT_LEVEL.COMMUNITY,
      placement: VPR_PLACEMENT.CHAMPION,
    }),
    0
  );
});

test("calculateVprPoints uses config table from local store", () => {
  resetVprLocalStoreForTests();
  assert.equal(
    calculateVprPoints({
      tournamentLevel: TOURNAMENT_LEVEL.VPT_500,
      placement: VPR_PLACEMENT.RUNNER_UP,
    }),
    300
  );
});
