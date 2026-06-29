import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  addPolicy,
  getPolicies,
  removePolicy,
  togglePolicy,
  addRule,
  getRules,
  toggleRule,
  removeRule,
} from "../src/ai/policy.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

let originalDateNow;

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  originalDateNow = Date.now;
  Date.now = () => 1000;
});

afterEach(() => {
  Date.now = originalDateNow;
});

test("addPolicy stores policy with defaults and getPolicies returns it", () => {
  addPolicy({
    type: "prefer_teammate",
    playerA: "p1",
    playerB: "p2",
  });

  const policies = getPolicies();

  assert.equal(policies.length, 1);
  assert.equal(policies[0].id, 1000);
  assert.equal(policies[0].enabled, true);
  assert.equal(policies[0].priority, "HIGH");
  assert.equal(policies[0].once, true);
});

test("togglePolicy flips enabled state and removePolicy deletes item", () => {
  addPolicy({ type: "prefer_teammate", playerA: "p1", playerB: "p2" });

  togglePolicy(1000);
  assert.equal(getPolicies()[0].enabled, false);

  removePolicy(1000);
  assert.deepEqual(getPolicies(), []);
});

test("rule APIs add, toggle, and remove correctly", () => {
  addRule({ type: "max_partner_repeat", maxTimes: 1, penalty: 12 });

  let rules = getRules();
  assert.equal(rules.length, 1);
  assert.equal(rules[0].enabled, true);

  toggleRule(1000);
  rules = getRules();
  assert.equal(rules[0].enabled, false);

  removeRule(1000);
  assert.deepEqual(getRules(), []);
});

test("toggle and remove operations are no-op for unknown ids", () => {
  addPolicy({ type: "prefer_teammate", playerA: "p1", playerB: "p2" });

  togglePolicy(9999);
  assert.equal(getPolicies().length, 1);

  removePolicy(9999);
  assert.equal(getPolicies().length, 1);
});
