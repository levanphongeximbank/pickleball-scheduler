import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_PERMISSION_MAP,
  COMPETITION_ACTION,
  COMPETITION_PERMISSION,
  mapActionToPermissions,
} from "../src/features/competition-core/role-permission/index.js";
import { TEAM_ROSTER_AUTH_ACTION } from "../src/features/competition-core/teams/ports/authorizationAdapterPort.js";
import { LINEUP_AUTH_ACTION } from "../src/features/competition-core/lineups/ports/lineupAuthorizationPort.js";

test("mapping — every Team auth action is mapped", () => {
  for (const action of Object.values(TEAM_ROSTER_AUTH_ACTION)) {
    const mapped = mapActionToPermissions(action);
    assert.equal(mapped.known, true, `unmapped team action ${action}`);
    assert.ok(mapped.requiredPermissions.length > 0);
    assert.equal(COMPETITION_ACTION[action] || action, action);
  }
});

test("mapping — every Lineup auth action is mapped", () => {
  for (const action of Object.values(LINEUP_AUTH_ACTION)) {
    const mapped = mapActionToPermissions(action);
    assert.equal(mapped.known, true, `unmapped lineup action ${action}`);
    assert.ok(mapped.requiredPermissions.length > 0);
  }
});

test("mapping — Team withdraw requires team.withdraw", () => {
  const mapped = mapActionToPermissions(COMPETITION_ACTION.TEAM_WITHDRAW);
  assert.deepEqual(mapped.requiredPermissions, [
    COMPETITION_PERMISSION.TEAM_WITHDRAW,
  ]);
});

test("mapping — Lineup submit accepts dual Identity namespaces", () => {
  const mapped = mapActionToPermissions(COMPETITION_ACTION.LINEUP_SUBMIT);
  assert.deepEqual(mapped.requiredPermissions, [
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
    COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT_V5,
  ]);
});

test("mapping — ACTION_PERMISSION_MAP covers COMPETITION_ACTION values", () => {
  for (const action of Object.values(COMPETITION_ACTION)) {
    assert.ok(
      ACTION_PERMISSION_MAP[action],
      `missing map row for ${action}`
    );
  }
});
