import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  mapDbRuleToCanonical,
  setPrivatePairingRpcClientForTests,
  getActivePrivatePairingRulesForScope,
  getPrivatePairingRuleSet,
  createPrivatePairingRuleSet,
  loadActivePrivatePairingRulesForRuntime,
  activatePrivatePairingRuleSetWithPreflight,
  computeRuleSetContentHashFromDbRules,
  resolveActivePrivatePairingRules,
  runPrivatePairingRuntime,
} from "../src/features/private-pairing-rules/index.js";
import { PRIVATE_PAIRING_DB_CODE } from "../src/features/private-pairing-rules/constants/dbCodes.js";
import { activatePrivatePairingRuleSet } from "../src/features/private-pairing-rules/repository/privatePairingRulesRepository.js";

const FLAGS_ON = {
  VITE_PRIVATE_PAIRING_RULES_ENABLED: "true",
  VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED: "true",
};

const FLAGS_OFF = {
  VITE_PRIVATE_PAIRING_RULES_ENABLED: "false",
  VITE_UNIFIED_CONSTRAINT_ENGINE_ENABLED: "false",
};

function mockClient(handler) {
  return {
    rpc: async (name, args) => handler(name, args),
  };
}

beforeEach(() => {
  setPrivatePairingRpcClientForTests(null);
});

describe("PR-4 private pairing — repository adapter", () => {
  it("does not query when feature flag is OFF", async () => {
    let called = false;
    setPrivatePairingRpcClientForTests(
      mockClient(async () => {
        called = true;
        return { data: { ok: true }, error: null };
      })
    );

    const result = await getActivePrivatePairingRulesForScope(
      { scopeType: "CLUB", scopeId: "club-1" },
      FLAGS_OFF
    );
    assert.equal(called, false);
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
    assert.deepEqual(result.rules, []);
  });

  it("createRuleSet returns FEATURE_DISABLED when flag OFF", async () => {
    const result = await createPrivatePairingRuleSet(
      { name: "x", scopeType: "CLUB", scopeId: "c1" },
      FLAGS_OFF
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, PRIVATE_PAIRING_DB_CODE.FEATURE_DISABLED);
  });

  it("maps DB rows to canonical PR-2 contract", () => {
    const rule = mapDbRuleToCanonical(
      {
        id: "r1",
        rule_set_id: "rs1",
        constraint_type: "must_partner",
        severity: "hard",
        weight: null,
        priority: "high",
        primary_player_id: "p1",
        target_player_ids: ["p2"],
        relation_mode: "ANY_OF",
        visibility: "private",
        reason_category: "OTHER",
        reason_text: "note",
        active: true,
        metadata: {},
      },
      { id: "rs1", version: 3, scope_type: "CLUB", scope_id: "club-1" }
    );
    assert.equal(rule.constraintType, "must_partner");
    assert.equal(rule.severity, "hard");
    assert.equal(rule.ruleSetVersion, "3");
    assert.equal(rule.scopeType, "CLUB");
    assert.deepEqual(rule.targetPlayerIds, ["p2"]);
  });

  it("loads active rules and normalizes for runtime", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(async () => ({
        data: {
          ok: true,
          rule_set: {
            id: "rs-active",
            version: 2,
            scope_type: "CLUB",
            scope_id: "club-1",
            status: "active",
          },
          rules: [
            {
              id: "rule-1",
              rule_set_id: "rs-active",
              constraint_type: "must_not_partner",
              severity: "hard",
              primary_player_id: "A",
              target_player_ids: ["B"],
              relation_mode: "ANY_OF",
              visibility: "private",
              reason_category: "OTHER",
              reason_text: "avoid duo",
              active: true,
            },
          ],
        },
        error: null,
      }))
    );

    const loaded = await loadActivePrivatePairingRulesForRuntime(
      { scopeType: "CLUB", scopeId: "club-1" },
      FLAGS_ON
    );
    assert.equal(loaded.ok, true);
    assert.equal(loaded.rules.length, 1);

    const resolved = resolveActivePrivatePairingRules({
      rules: loaded.rules,
      context: {
        contextTime: new Date().toISOString(),
        clubId: "club-1",
        defaultScopeType: "CLUB",
        defaultScopeId: "club-1",
      },
    });
    assert.equal(resolved.rules.length, 1);

    const runtime = runPrivatePairingRuntime({
      players: [
        { id: "A", level: 3 },
        { id: "B", level: 3 },
        { id: "C", level: 3 },
        { id: "D", level: 3 },
      ],
      rules: loaded.rules,
      seed: 11,
      envSource: FLAGS_ON,
      context: {
        teamSize: 2,
        clubId: "club-1",
        defaultScopeType: "CLUB",
        defaultScopeId: "club-1",
      },
    });
    assert.equal(runtime.ok, true);
  });

  it("blocks activate when PR-2 reports fatal conflicts", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(async (name) => {
        if (name === "private_pairing_get_rule_set") {
          return {
            data: {
              ok: true,
              rule_set: {
                id: "rs1",
                version: 1,
                status: "draft",
                scope_type: "CLUB",
                scope_id: "club-1",
              },
              rules: [
                {
                  id: "r1",
                  constraint_type: "must_partner",
                  severity: "hard",
                  primary_player_id: "A",
                  target_player_ids: ["B"],
                  relation_mode: "ANY_OF",
                  visibility: "private",
                  reason_category: "OTHER",
                  reason_text: "must",
                  active: true,
                },
                {
                  id: "r2",
                  constraint_type: "must_not_partner",
                  severity: "hard",
                  primary_player_id: "A",
                  target_player_ids: ["B"],
                  relation_mode: "ANY_OF",
                  visibility: "private",
                  reason_category: "OTHER",
                  reason_text: "must not",
                  active: true,
                },
              ],
            },
            error: null,
          };
        }
        throw new Error(`unexpected rpc ${name}`);
      })
    );

    const result = await activatePrivatePairingRuleSetWithPreflight(
      { ruleSetId: "rs1", reason: "go-live" },
      FLAGS_ON
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, PRIVATE_PAIRING_DB_CODE.RULE_SET_CONFLICT);
  });

  it("passes content hash + preflightOk only when clear", async () => {
    const dbRules = [
      {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        constraint_type: "prefer_partner",
        severity: "soft",
        weight: 40,
        primary_player_id: "A",
        relation_mode: "ANY_OF",
        visibility: "private",
        target_player_ids: ["B"],
        active: true,
      },
    ];
    const expectedHash = await computeRuleSetContentHashFromDbRules(dbRules);
    let activateArgs = null;

    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        if (name === "private_pairing_get_rule_set") {
          return {
            data: {
              ok: true,
              rule_set: {
                id: "rs1",
                version: 1,
                status: "draft",
                scope_type: "CLUB",
                scope_id: "club-1",
              },
              rules: [
                {
                  ...dbRules[0],
                  rule_set_id: "rs1",
                  reason_category: "OTHER",
                  reason_text: "prefer",
                  priority: "medium",
                },
              ],
            },
            error: null,
          };
        }
        if (name === "private_pairing_activate_rule_set") {
          activateArgs = args;
          return { data: { ok: true, rule_set: { id: "rs1", status: "active" } }, error: null };
        }
        throw new Error(`unexpected rpc ${name}`);
      })
    );

    const result = await activatePrivatePairingRuleSetWithPreflight(
      { ruleSetId: "rs1", reason: "activate" },
      FLAGS_ON
    );
    assert.equal(result.ok, true);
    assert.equal(activateArgs.p_preflight_ok, true);
    assert.equal(activateArgs.p_content_hash, expectedHash);
  });

  it("rejects direct activate without preflight flag", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(async () => ({
        data: {
          ok: false,
          code: PRIVATE_PAIRING_DB_CODE.RULE_SET_CONFLICT,
          message: "preflight_ok required",
        },
        error: null,
      }))
    );
    const result = await activatePrivatePairingRuleSet(
      {
        ruleSetId: "rs1",
        reason: "x",
        preflightOk: false,
        contentHash: "abc",
      },
      FLAGS_ON
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, PRIVATE_PAIRING_DB_CODE.RULE_SET_CONFLICT);
  });

  it("getPrivatePairingRuleSet preserves dbRules for hashing", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(async () => ({
        data: {
          ok: true,
          rule_set: { id: "rs1", version: 1, scope_type: "CLUB", scope_id: "c1" },
          rules: [
            {
              id: "r1",
              constraint_type: "must_partner",
              severity: "hard",
              primary_player_id: "A",
              target_player_ids: ["B"],
              relation_mode: "ANY_OF",
              visibility: "private",
              active: true,
            },
          ],
        },
        error: null,
      }))
    );
    const result = await getPrivatePairingRuleSet("rs1", FLAGS_ON);
    assert.equal(result.ok, true);
    assert.equal(result.dbRules[0].constraint_type, "must_partner");
    assert.equal(result.rules[0].constraintType, "must_partner");
  });
});
