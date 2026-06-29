import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDefaultPolicy,
  buildDefaultRule,
  formatPolicyLabel,
  validatePolicyDraft,
} from "../src/pages/selectPlayers.director.manager.logic.js";

test("buildDefaultRule uses config defaults", () => {
  const rule = buildDefaultRule("max_partner_repeat");

  assert.equal(rule.type, "max_partner_repeat");
  assert.equal(rule.maxTimes, 1);
  assert.equal(rule.penalty, 12);
  assert.equal(rule.enabled, true);
});

test("buildDefaultPolicy creates prefer_teammate policy", () => {
  const policy = buildDefaultPolicy("prefer_teammate", "p1", "p2");

  assert.equal(policy.type, "prefer_teammate");
  assert.equal(policy.playerA, "p1");
  assert.equal(policy.playerB, "p2");
});

test("formatPolicyLabel shows player names when available", () => {
  const label = formatPolicyLabel(
    { type: "prefer_teammate", playerA: 1, playerB: 2 },
    [
      { id: 1, name: "An" },
      { id: 2, name: "Binh" },
    ]
  );

  assert.equal(label, "An + Binh");
});

test("validatePolicyDraft requires two distinct players", () => {
  assert.equal(
    validatePolicyDraft({ type: "prefer_teammate", playerA: "p1", playerB: "p2" }),
    null
  );
  assert.match(
    validatePolicyDraft({ type: "prefer_teammate", playerA: "p1", playerB: "p1" }),
    /khác nhau/
  );
});
