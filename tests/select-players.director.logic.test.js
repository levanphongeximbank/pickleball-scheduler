import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLockToggleState,
  countEnabledItems,
  getPolicyTooltip,
  getRuleLabel,
  getRuleTooltip,
} from "../src/pages/selectPlayers.director.logic.js";

test("getRuleLabel returns expected labels by rule type", () => {
  assert.equal(getRuleLabel({ type: "team_level_diff_limit" }), "Giới hạn chênh lệch level");
  assert.equal(getRuleLabel({ type: "max_partner_repeat" }), "Giới hạn lặp đồng đội");
  assert.equal(getRuleLabel({ type: "max_opponent_repeat" }), "Giới hạn lặp đối thủ");
  assert.equal(getRuleLabel({ type: "custom_rule" }), "custom_rule");
});

test("getRuleTooltip uses defaults and custom values", () => {
  assert.match(getRuleTooltip({ type: "team_level_diff_limit" }), /0.5/);
  assert.match(
    getRuleTooltip({ type: "max_partner_repeat", maxTimes: 3, penalty: 20 }),
    /3 lần\. Penalty: 20/,
  );
  assert.match(
    getRuleTooltip({ type: "max_opponent_repeat", maxTimes: 4, penalty: 10 }),
    /4 lần\. Penalty: 10/,
  );
});

test("getPolicyTooltip handles prefer_teammate and fallback policy", () => {
  assert.match(getPolicyTooltip({ type: "prefer_teammate" }), /cùng đội/);
  assert.equal(getPolicyTooltip({ type: "other" }), "Policy do Director cấu hình.");
});

test("countEnabledItems counts all except explicitly disabled", () => {
  const count = countEnabledItems([
    { id: 1, enabled: true },
    { id: 2, enabled: false },
    { id: 3 },
  ]);

  assert.equal(count, 2);
});

test("buildLockToggleState toggles locked list predictably", () => {
  const lock = buildLockToggleState([1, 2], 3);
  assert.equal(lock.isLocked, true);
  assert.deepEqual(lock.nextLockedIds, [1, 2, 3]);

  const unlock = buildLockToggleState([1, 2, 3], 2);
  assert.equal(unlock.isLocked, false);
  assert.deepEqual(unlock.nextLockedIds, [1, 3]);
});
