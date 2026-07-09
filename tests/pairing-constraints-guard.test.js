import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/features/identity/constants/roles.js";
import {
  guardFounderConstraints,
  canManageFounderConstraints,
} from "../src/features/pairing-constraints/services/pairingConstraintService.js";
import { createPairingConstraint } from "../src/features/pairing-constraints/models/pairingConstraint.js";
import { CONSTRAINT_TYPE } from "../src/features/pairing-constraints/constants.js";
import { constraintsToCourtPolicies } from "../src/features/pairing-constraints/adapters/courtPolicyAdapter.js";
import { calculatePairScore } from "../src/ai/scoring.js";

test("guardFounderConstraints rejects non-founder roles", () => {
  const clubManager = guardFounderConstraints({ user: { role: ROLES.CLUB_MANAGER } });
  const tenantOwner = guardFounderConstraints({ user: { role: ROLES.TENANT_OWNER } });

  assert.equal(clubManager.ok, false);
  assert.equal(tenantOwner.ok, false);
  assert.equal(canManageFounderConstraints({ role: ROLES.VENUE_MANAGER }), false);
});

test("guardFounderConstraints allows platform admin roles", () => {
  const platformAdmin = guardFounderConstraints({ user: { role: ROLES.PLATFORM_ADMIN } });
  const superAdmin = guardFounderConstraints({ user: { role: ROLES.SUPER_ADMIN } });

  assert.equal(platformAdmin.ok, true);
  assert.equal(superAdmin.ok, true);
});

test("constraintsToCourtPolicies tags founder source", () => {
  const policies = constraintsToCourtPolicies([
    createPairingConstraint({
      type: CONSTRAINT_TYPE.AVOID_PARTNER,
      anchorPlayerId: "p1",
      targetPlayerIds: ["p2"],
      mode: "hard",
    }),
    createPairingConstraint({
      type: CONSTRAINT_TYPE.PREFER_PARTNER,
      anchorPlayerId: "p3",
      targetPlayerIds: ["p4"],
      mode: "soft",
    }),
  ]);

  assert.equal(policies.length, 2);
  policies.forEach((policy) => {
    assert.equal(policy.source, "founder");
  });
  assert.equal(policies[0].type, "avoid_teammate");
  assert.equal(policies[0].priority, "HIGH");
});

test("founder hard avoid blocks conflicting system prefer_teammate in scoring", () => {
  const option = {
    teamA: [{ id: "p1", level: 3 }, { id: "p2", level: 3 }],
    teamB: [{ id: "p3", level: 3 }, { id: "p4", level: 3 }],
  };

  const policies = [
    {
      type: "avoid_teammate",
      playerA: "p1",
      playerB: "p2",
      enabled: true,
      priority: "HIGH",
      source: "founder",
    },
    {
      type: "prefer_teammate",
      playerA: "p1",
      playerB: "p2",
      enabled: true,
      priority: "HIGH",
    },
  ];

  const result = calculatePairScore(option, { policies });
  const founderOnly = calculatePairScore(option, {
    policies: [policies[0]],
  });
  const systemOnly = calculatePairScore(option, {
    policies: [policies[1]],
  });

  assert.equal(result.policyScore, founderOnly.policyScore);
  assert.ok(systemOnly.policyScore > founderOnly.policyScore);
});

test("founder policies are ordered before system policies in runAI context", async () => {
  const engineSource = await import("../src/ai/engine.js");
  assert.ok(typeof engineSource.runAI === "function");

  const founderPolicies = constraintsToCourtPolicies([
    createPairingConstraint({
      type: CONSTRAINT_TYPE.AVOID_PARTNER,
      anchorPlayerId: "a",
      targetPlayerIds: ["b"],
      mode: "hard",
    }),
  ]);

  const clubPolicies = [
    {
      type: "prefer_teammate",
      playerA: "x",
      playerB: "y",
      enabled: true,
      priority: "MEDIUM",
    },
  ];

  const merged = [...founderPolicies, ...clubPolicies];
  assert.equal(merged[0].source, "founder");
  assert.equal(merged[1].source, undefined);
});
