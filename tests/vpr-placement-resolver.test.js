import test from "node:test";
import assert from "node:assert/strict";

import {
  EVENT_TYPE,
  MATCH_STAGE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
} from "../src/models/tournament/constants.js";
import { VPR_PLACEMENT } from "../src/features/vpr-ranking/constants/vprPlacements.js";
import { VPR_CATEGORY } from "../src/features/vpr-ranking/constants/vprCategories.js";
import { resolvePlacementsPerCategory } from "../src/features/vpr-ranking/engines/placementResolver.js";

test("resolvePlacementsPerCategory maps final match to champion and runner_up", () => {
  const tournament = {
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    events: [
      {
        id: "ev1",
        eventType: EVENT_TYPE.MEN_SINGLE,
        entries: [
          { id: "e1", playerIds: ["p1"], name: "A" },
          { id: "e2", playerIds: ["p2"], name: "B" },
        ],
        matches: [
          {
            id: "m1",
            stage: MATCH_STAGE.FINAL,
            status: MATCH_STATUS.COMPLETED,
            entryAId: "e1",
            entryBId: "e2",
            winnerId: "e1",
            loserId: "e2",
          },
        ],
      },
    ],
  };

  const blocks = resolvePlacementsPerCategory(tournament);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].category, VPR_CATEGORY.MEN_SINGLE);

  const placements = blocks[0].placements;
  const champion = placements.find((row) => row.placement === VPR_PLACEMENT.CHAMPION);
  const runnerUp = placements.find((row) => row.placement === VPR_PLACEMENT.RUNNER_UP);
  assert.equal(champion.entry.playerIds[0], "p1");
  assert.equal(runnerUp.entry.playerIds[0], "p2");
});
