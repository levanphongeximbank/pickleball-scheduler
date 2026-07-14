import test from "node:test";
import assert from "node:assert/strict";

import { filterRuleSets, filterRules } from "../src/features/private-pairing-rules/ui/privatePairingAdminHelpers.js";
import * as adminApi from "../src/features/private-pairing-rules/ui/privatePairingAdminApi.js";
import { PRIVATE_PAIRING_RPC, PRIVATE_PAIRING_TABLES } from "../src/features/private-pairing-rules/constants/dbCodes.js";

test("PR-5 helpers filter rule sets by status and search", () => {
  const rows = [
    { id: "1", name: "Club A draft", status: "draft", scope_type: "CLUB", scope_id: "c1" },
    { id: "2", name: "Club A active", status: "active", scope_type: "CLUB", scope_id: "c1" },
    { id: "3", name: "Tournament X", status: "draft", scope_type: "TOURNAMENT", scope_id: "t1" },
  ];
  assert.equal(filterRuleSets(rows, { status: "active" }).length, 1);
  assert.equal(filterRuleSets(rows, { search: "tournament" }).length, 1);
  assert.equal(filterRuleSets(rows, { scopeType: "CLUB", status: "draft" }).length, 1);
});

test("PR-5 helpers filter rules by severity and player", () => {
  const rules = [
    {
      id: "r1",
      primaryPlayerId: "p1",
      constraintType: "AVOID_PARTNER",
      severity: "hard",
      targetPlayerIds: ["p2"],
      active: true,
    },
    {
      id: "r2",
      primaryPlayerId: "p3",
      constraintType: "PREFER_PARTNER",
      severity: "soft",
      targetPlayerIds: ["p4"],
      active: false,
      reasonText: "family",
    },
  ];
  assert.equal(filterRules(rules, { severity: "hard" }).length, 1);
  assert.equal(filterRules(rules, { activeOnly: true }).length, 1);
  assert.equal(filterRules(rules, { search: "family", activeOnly: false }).length, 1);
  assert.equal(filterRules(rules, { primaryPlayerId: "p1" }).length, 1);
});

test("PR-5 admin API surface is RPC-only (no table CRUD helpers)", () => {
  const exported = Object.keys(adminApi);
  assert.ok(exported.includes("listPrivatePairingRuleSets"));
  assert.ok(exported.includes("createPrivatePairingRule"));
  assert.ok(exported.includes("activatePrivatePairingRuleSetWithPreflight"));
  assert.ok(exported.includes("listPrivatePairingAuditLogs"));
  assert.ok(!exported.some((k) => /from\(|select\(|insert\(|update\(|delete\(/i.test(k)));
  assert.ok(PRIVATE_PAIRING_RPC.LIST_RULE_SETS);
  assert.ok(PRIVATE_PAIRING_TABLES.includes("private_pairing_rules"));
});
