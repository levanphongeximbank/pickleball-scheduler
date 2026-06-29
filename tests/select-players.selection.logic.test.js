import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAutoCourtSelection,
  collectIds,
  toggleSelectionByChecked,
} from "../src/pages/selectPlayers.selection.logic.js";

test("collectIds extracts id list from objects", () => {
  const ids = collectIds([{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.deepEqual(ids, [1, 2, 3]);
});

test("toggleSelectionByChecked adds and removes ids", () => {
  assert.deepEqual(toggleSelectionByChecked([1, 2], 3, true), [1, 2, 3]);
  assert.deepEqual(toggleSelectionByChecked([1, 2, 3], 2, false), [1, 3]);
});

test("toggleSelectionByChecked does not duplicate existing id", () => {
  assert.deepEqual(toggleSelectionByChecked([1, 2], 2, true), [1, 2]);
});

test("buildAutoCourtSelection selects all active courts when over capacity", () => {
  const selection = buildAutoCourtSelection({
    selectedPlayersCount: 18,
    maxPlayers: 16,
    activeCourts: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    requiredCourts: 4,
  });

  assert.deepEqual(selection, [1, 2, 3, 4]);
});

test("buildAutoCourtSelection selects only required courts when capacity is enough", () => {
  const selection = buildAutoCourtSelection({
    selectedPlayersCount: 9,
    maxPlayers: 16,
    activeCourts: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    requiredCourts: 3,
  });

  assert.deepEqual(selection, [1, 2, 3]);
});
