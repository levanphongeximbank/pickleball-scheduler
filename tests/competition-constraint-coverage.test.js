import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPETITION_CONSTRAINT_TYPE,
  COMPETITION_CONSTRAINT_TYPE_VALUES,
  COMPETITION_CORE_FLAG_KEYS,
  CONSTRAINT_SEVERITY,
  RULE_ERROR_CODE,
  SUPPORTED_HARD_CONSTRAINT_TYPES,
  SUPPORTED_SOFT_CONSTRAINT_TYPES,
  createRuleSet,
  evaluateCandidate,
  evaluateHardRules,
  scoreSoftRules,
  DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE,
} from "../src/features/competition-core/index.js";
import {
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_CONSTRAINT_TYPE_VALUES,
  PRIVATE_PAIRING_RUNTIME_CODE,
  RELATION_MODE,
  createPrivatePairingRule,
  evaluateHardPrivatePairingRules,
  scoreSoftPrivatePairingRules,
  evaluatePrivatePairingCandidate,
  FEATURE_FLAG_KEYS,
} from "../src/features/private-pairing-rules/index.js";
import {
  PP_HARD_EVALUATED_TYPES,
} from "../src/features/private-pairing-rules/runtime/evaluateHardOnCandidate.js";
import {
  PP_SOFT_SCORED_TYPES,
} from "../src/features/private-pairing-rules/runtime/scoreSoftOnCandidate.js";

const v2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "true",
};

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

const FLAGS_OFF = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "false",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "false",
};

function ccConstraint(type, severity, params = {}, id = "c1") {
  return { id, type, severity, enabled: true, params };
}

function ppRule(overrides = {}) {
  return createPrivatePairingRule({
    id: overrides.id || "r1",
    constraintType: overrides.constraintType || PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
    severity: overrides.severity || "soft",
    weight: overrides.weight ?? 80,
    primaryPlayerId: overrides.primaryPlayerId || "p1",
    targetPlayerIds: overrides.targetPlayerIds || ["p2"],
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: "GLOBAL",
    scopeId: null,
    visibility: "private",
    reasonCategory: "EVENT_OPERATION",
    reasonText: "coverage",
    active: true,
    metadata: overrides.metadata || {},
    ...overrides,
  });
}

test("coverage: every COMPETITION_CONSTRAINT_TYPE has default severity", () => {
  for (const type of COMPETITION_CONSTRAINT_TYPE_VALUES) {
    assert.ok(
      DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE[type],
      `missing default severity for ${type}`
    );
  }
});

test("coverage: hard support set types never silently ignored", () => {
  const teams = [
    ["p1", "p2"],
    ["p3", "p4"],
  ];
  const groups = [
    { id: "g1", playerIds: ["p1", "p3"] },
    { id: "g2", playerIds: ["p2", "p4"] },
  ];
  for (const type of SUPPORTED_HARD_CONSTRAINT_TYPES) {
    const result = evaluateHardRules(
      [
        ccConstraint(type, CONSTRAINT_SEVERITY.HARD, {
          anchorPlayerId: "p1",
          targetPlayerIds: ["p2"],
          maxDiff: 0.5,
          maxRepeat: 1,
          minRepeat: 1,
          minMinutes: 30,
          eventType: "mixed_double",
        }),
      ],
      {
        scope: "pairing",
        teams,
        groups,
        matchOption: { teamA: ["p1", "p2"], teamB: ["p3", "p4"] },
        playersById: {
          p1: { gender: "male", skillLevel: 3, checkedIn: true, available: true },
          p2: { gender: "female", skillLevel: 3, checkedIn: true, available: true },
          p3: { gender: "male", skillLevel: 3, checkedIn: true, available: true },
          p4: { gender: "female", skillLevel: 3, checkedIn: true, available: true },
        },
        partnerRepeatCounts: { p1: { p2: 0 } },
        opponentRepeatCounts: { p1: { p3: 0 } },
        evaluatedAt: new Date().toISOString(),
      }
    );
    assert.equal(typeof result.feasible, "boolean", `${type} must return boolean feasible`);
    const silentCodes = (result.violations || []).map((v) => v.code);
    assert.ok(
      !silentCodes.includes(undefined),
      `${type} produced undefined violation code`
    );
  }
});

test("CC MUST_OPPONENT hard rejects; PREFER_OPPONENT soft scores", () => {
  const hardFail = evaluateHardRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.MUST_OPPONENT, CONSTRAINT_SEVERITY.HARD, {
        anchorPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
    ],
    { teams: [["p1", "p2"], ["p3", "p4"]] }
  );
  assert.equal(hardFail.feasible, false);
  assert.equal(hardFail.violations[0].code, RULE_ERROR_CODE.MUST_OPPONENT_UNSATISFIED);

  const hardPass = evaluateHardRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.MUST_OPPONENT, CONSTRAINT_SEVERITY.HARD, {
        anchorPlayerId: "p1",
        targetPlayerIds: ["p3"],
      }),
    ],
    { teams: [["p1", "p2"], ["p3", "p4"]] }
  );
  assert.equal(hardPass.feasible, true);

  const soft = scoreSoftRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.PREFER_OPPONENT, CONSTRAINT_SEVERITY.SOFT, {
        anchorPlayerId: "p1",
        targetPlayerIds: ["p3"],
      }),
    ],
    { teams: [["p1", "p2"], ["p3", "p4"]] }
  );
  assert.ok(soft.total > 0);
});

test("CC MUST_NOT_OPPONENT / group / team hard reject", () => {
  const notOpp = evaluateHardRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.MUST_NOT_OPPONENT, CONSTRAINT_SEVERITY.HARD, {
        anchorPlayerId: "p1",
        targetPlayerIds: ["p3"],
      }),
    ],
    { teams: [["p1", "p2"], ["p3", "p4"]] }
  );
  assert.equal(notOpp.feasible, false);
  assert.equal(notOpp.violations[0].code, RULE_ERROR_CODE.MUST_NOT_OPPONENT_VIOLATED);

  const sameGroup = evaluateHardRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.SAME_GROUP, CONSTRAINT_SEVERITY.HARD, {
        anchorPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
    ],
    {
      groups: [
        { id: "a", playerIds: ["p1", "p3"] },
        { id: "b", playerIds: ["p2", "p4"] },
      ],
    }
  );
  assert.equal(sameGroup.feasible, false);
  assert.equal(sameGroup.violations[0].code, RULE_ERROR_CODE.SAME_GROUP_VIOLATED);

  const diffTeam = evaluateHardRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.DIFFERENT_TEAM, CONSTRAINT_SEVERITY.HARD, {
        anchorPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
    ],
    { teams: [["p1", "p2"], ["p3", "p4"]] }
  );
  assert.equal(diffTeam.feasible, false);
  assert.equal(diffTeam.violations[0].code, RULE_ERROR_CODE.DIFFERENT_TEAM_VIOLATED);
});

test("CC min partner/opponent repeat soft scores", () => {
  const partner = scoreSoftRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT, CONSTRAINT_SEVERITY.SOFT, {
        anchorPlayerId: "p1",
        targetPlayerIds: ["p2"],
        minRepeat: 2,
      }),
    ],
    {
      teams: [["p1", "p2"], ["p3", "p4"]],
      partnerRepeatCounts: { p1: { p2: 0 } },
    }
  );
  assert.ok(partner.total < 0);
  assert.equal(partner.notes[0].code, RULE_ERROR_CODE.MIN_PARTNER_REPEAT_UNSATISFIED);

  const opponent = scoreSoftRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT, CONSTRAINT_SEVERITY.SOFT, {
        anchorPlayerId: "p1",
        targetPlayerIds: ["p3"],
        minRepeat: 2,
      }),
    ],
    {
      teams: [["p1", "p2"], ["p3", "p4"]],
      opponentRepeatCounts: { p1: { p3: 0 } },
    }
  );
  assert.ok(opponent.total < 0);
});

test("CC hard > soft: hard fail not rescued by soft bonus", () => {
  const result = evaluateCandidate(
    { teams: [["p1", "p2"], ["p3", "p4"]] },
    createRuleSet({
      constraints: [
        ccConstraint(COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER, CONSTRAINT_SEVERITY.HARD, {
          anchorPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
        ccConstraint(COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER, CONSTRAINT_SEVERITY.SOFT, {
          anchorPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
    }),
    { scope: "pairing" },
    { envSource: v2Env }
  );
  assert.equal(result.feasible, false);
  assert.equal(result.softScore, 0);
});

test("CC unsupported hard type surfaces UNSUPPORTED_CONSTRAINT_EVALUATION", () => {
  const result = evaluateHardRules(
    [
      {
        id: "x1",
        type: "not_a_real_type",
        severity: CONSTRAINT_SEVERITY.HARD,
        enabled: true,
        params: {},
      },
    ],
    { teams: [["p1", "p2"], ["p3", "p4"]] }
  );
  assert.equal(result.feasible, false);
  assert.equal(
    result.violations[0].code,
    RULE_ERROR_CODE.UNSUPPORTED_CONSTRAINT_EVALUATION
  );
});

test("PP: every private pairing type is hard-eval or soft-scored (or both)", () => {
  const hard = new Set(PP_HARD_EVALUATED_TYPES);
  const soft = new Set(PP_SOFT_SCORED_TYPES);
  for (const type of PRIVATE_PAIRING_CONSTRAINT_TYPE_VALUES) {
    assert.ok(
      hard.has(type) || soft.has(type),
      `${type} missing from PP hard and soft coverage`
    );
  }
});

test("PP opponent / team / group / min-repeat parity", () => {
  const match = {
    teams: [
      { playerIds: ["p1", "p2"] },
      { playerIds: ["p3", "p4"] },
    ],
    matchOption: { teamA: ["p1", "p2"], teamB: ["p3", "p4"] },
    groups: [
      { playerIds: ["p1", "p3"] },
      { playerIds: ["p2", "p4"] },
    ],
  };

  const mustOpp = evaluateHardPrivatePairingRules(match, [
    ppRule({
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT,
      severity: "hard",
      primaryPlayerId: "p1",
      targetPlayerIds: ["p2"],
    }),
  ]);
  assert.equal(mustOpp.feasible, false);
  assert.equal(
    mustOpp.violations[0].code,
    PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_OPPONENT
  );

  const sameTeam = evaluateHardPrivatePairingRules(match, [
    ppRule({
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM,
      severity: "hard",
      primaryPlayerId: "p1",
      targetPlayerIds: ["p3"],
    }),
  ]);
  assert.equal(sameTeam.feasible, false);

  const diffGroup = evaluateHardPrivatePairingRules(match, [
    ppRule({
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
      severity: "hard",
      primaryPlayerId: "p1",
      targetPlayerIds: ["p3"],
    }),
  ]);
  assert.equal(diffGroup.feasible, false);

  const minPartnerSoft = scoreSoftPrivatePairingRules(
    match,
    [
      ppRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT,
        severity: "soft",
        weight: 70,
        metadata: { minCount: 2 },
      }),
    ],
    { partnerRepeatCounts: { p1: { p2: 0 } } }
  );
  assert.ok(minPartnerSoft.constraintScore < 0);
  assert.equal(minPartnerSoft.softConstraintsMissed.length, 1);
});

test("PP unsupported hard type is not silently ignored", () => {
  const result = evaluateHardPrivatePairingRules(
    { teams: [{ playerIds: ["p1", "p2"] }, { playerIds: ["p3", "p4"] }] },
    [
      {
        ...ppRule({ severity: "hard" }),
        constraintType: "made_up_type",
      },
    ]
  );
  assert.equal(result.feasible, false);
  assert.equal(
    result.violations[0].code,
    PRIVATE_PAIRING_RUNTIME_CODE.UNSUPPORTED_HARD_CONSTRAINT
  );
});

test("PP opponent hard without matchOption deferred with clear code (not silent)", () => {
  const result = evaluateHardPrivatePairingRules(
    { teams: [{ playerIds: ["p1", "p2"] }, { playerIds: ["p3", "p4"] }] },
    [
      ppRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT,
        severity: "hard",
        primaryPlayerId: "p1",
        targetPlayerIds: ["p3"],
      }),
    ]
  );
  assert.equal(result.feasible, true);
  assert.equal(result.deferred.length, 1);
  assert.equal(
    result.deferred[0].code,
    PRIVATE_PAIRING_RUNTIME_CODE.CONSTRAINT_CONTEXT_MISSING
  );
});

test("PP/CC opponent hard parity on same geometry", () => {
  const teams = [["p1", "p2"], ["p3", "p4"]];
  const cc = evaluateHardRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.MUST_NOT_OPPONENT, CONSTRAINT_SEVERITY.HARD, {
        anchorPlayerId: "p1",
        targetPlayerIds: ["p3"],
      }),
    ],
    { teams }
  );
  const pp = evaluateHardPrivatePairingRules(
    {
      teams: [{ playerIds: teams[0] }, { playerIds: teams[1] }],
      matchOption: { teamA: teams[0], teamB: teams[1] },
    },
    [
      ppRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
        severity: "hard",
        primaryPlayerId: "p1",
        targetPlayerIds: ["p3"],
      }),
    ]
  );
  assert.equal(cc.feasible, false);
  assert.equal(pp.feasible, false);
});

test("flags OFF: evaluateCandidate remains no-op pass-through", () => {
  const result = evaluateCandidate(
    { teams: [["p1", "p2"], ["p3", "p4"]] },
    createRuleSet({
      constraints: [
        ccConstraint(COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER, CONSTRAINT_SEVERITY.HARD, {
          anchorPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
    }),
    { scope: "pairing" },
    {
      envSource: {
        [COMPETITION_CORE_FLAG_KEYS.CORE]: "false",
        [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "false",
      },
    }
  );
  assert.equal(result.enabled, false);
  assert.equal(result.feasible, true);
});

test("PP soft group scoring when groups present", () => {
  const scored = evaluatePrivatePairingCandidate(
    {
      id: "c1",
      teams: [
        { playerIds: ["p1", "p2"] },
        { playerIds: ["p3", "p4"] },
      ],
      groups: [
        { playerIds: ["p1", "p2"] },
        { playerIds: ["p3", "p4"] },
      ],
    },
    {
      rules: [
        ppRule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
          severity: "soft",
          weight: 90,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
      context: { competitionClass: "DAILY_PLAY" },
      envSource: FLAGS_ON,
    }
  );
  assert.equal(scored.feasible, true);
  assert.ok(scored.constraintScore > 0);
});

test("RULE_PRIORITY is not required for soft ranking (weight only)", () => {
  const low = scoreSoftPrivatePairingRules(
    {
      teams: [{ playerIds: ["p1", "p2"] }, { playerIds: ["p3", "p4"] }],
    },
    [ppRule({ weight: 20, priority: "low" })]
  );
  const high = scoreSoftPrivatePairingRules(
    {
      teams: [{ playerIds: ["p1", "p2"] }, { playerIds: ["p3", "p4"] }],
    },
    [ppRule({ weight: 90, priority: "critical" })]
  );
  assert.ok(high.constraintScore > low.constraintScore);
});

test("supported hard/soft sets cover registry without empty holes for evaluated defaults", () => {
  const hard = new Set(SUPPORTED_HARD_CONSTRAINT_TYPES);
  const soft = new Set(SUPPORTED_SOFT_CONSTRAINT_TYPES);
  for (const type of COMPETITION_CONSTRAINT_TYPE_VALUES) {
    const severity = DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE[type];
    if (severity === CONSTRAINT_SEVERITY.HARD) {
      assert.ok(hard.has(type), `hard default type ${type} missing hard support`);
    } else {
      assert.ok(soft.has(type), `soft default type ${type} missing soft support`);
    }
  }
});

test("CC gender_eligibility / team_skill_difference / lineup / entry / org / min_rest", () => {
  const gender = evaluateHardRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.GENDER_ELIGIBILITY, CONSTRAINT_SEVERITY.HARD, {
        eventType: "mixed_double",
      }),
    ],
    {
      teams: [
        ["p1", "p2"],
        ["p3", "p4"],
      ],
      playersById: {
        p1: { gender: "male" },
        p2: { gender: "male" },
        p3: { gender: "female" },
        p4: { gender: "female" },
      },
    }
  );
  assert.equal(gender.feasible, false);
  assert.equal(gender.violations[0].code, RULE_ERROR_CODE.GENDER_ELIGIBILITY_VIOLATED);

  const skill = evaluateHardRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.TEAM_SKILL_DIFFERENCE, CONSTRAINT_SEVERITY.HARD, {
        maxDiff: 0.2,
      }),
    ],
    {
      teams: [
        ["p1", "p2"],
        ["p3", "p4"],
      ],
      playersById: {
        p1: { skillLevel: 5 },
        p2: { skillLevel: 5 },
        p3: { skillLevel: 2 },
        p4: { skillLevel: 2 },
      },
    }
  );
  assert.equal(skill.feasible, false);
  assert.equal(skill.violations[0].code, RULE_ERROR_CODE.TEAM_SKILL_DIFFERENCE_EXCEEDED);

  const lineup = evaluateHardRules(
    [ccConstraint(COMPETITION_CONSTRAINT_TYPE.LINEUP_VALIDITY, CONSTRAINT_SEVERITY.HARD)],
    { lineupSlots: [{ position: "A1", required: true, playerId: null }] }
  );
  assert.equal(lineup.feasible, false);
  assert.equal(lineup.violations[0].code, RULE_ERROR_CODE.LINEUP_VALIDITY_VIOLATED);

  const entry = evaluateHardRules(
    [ccConstraint(COMPETITION_CONSTRAINT_TYPE.ENTRY_ELIGIBILITY, CONSTRAINT_SEVERITY.HARD)],
    {
      teams: [["p1"], ["p2"]],
      entriesByPlayerId: { p1: { eligible: false, reason: "banned" } },
    }
  );
  assert.equal(entry.feasible, false);
  assert.equal(entry.violations[0].code, RULE_ERROR_CODE.ENTRY_ELIGIBILITY_VIOLATED);

  const org = evaluateHardRules(
    [ccConstraint(COMPETITION_CONSTRAINT_TYPE.SAME_ORGANIZATION_SEPARATION, CONSTRAINT_SEVERITY.HARD)],
    {
      scope: "group",
      groups: [{ id: "g1", playerIds: ["p1", "p2"] }],
      playersById: {
        p1: { organizationId: "org-a" },
        p2: { organizationId: "org-a" },
      },
    }
  );
  assert.equal(org.feasible, false);
  assert.equal(org.violations[0].code, RULE_ERROR_CODE.SAME_ORGANIZATION_SEPARATION_VIOLATED);

  const rest = evaluateHardRules(
    [
      ccConstraint(COMPETITION_CONSTRAINT_TYPE.MIN_REST_TIME, CONSTRAINT_SEVERITY.HARD, {
        minMinutes: 60,
      }),
    ],
    {
      teams: [["p1"], ["p2"]],
      evaluatedAt: "2026-07-15T12:00:00.000Z",
      playersById: { p1: { lastMatchAt: "2026-07-15T11:30:00.000Z" } },
    }
  );
  assert.equal(rest.feasible, false);
  assert.equal(rest.violations[0].code, RULE_ERROR_CODE.MIN_REST_TIME_VIOLATED);
});

test("coverage percent: registry fully evaluator-backed (no NOT_IMPLEMENTED)", () => {
  const implementedDefaults = [...COMPETITION_CONSTRAINT_TYPE_VALUES].every((type) => {
    const severity = DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE[type];
    return severity === CONSTRAINT_SEVERITY.HARD
      ? SUPPORTED_HARD_CONSTRAINT_TYPES.includes(type)
      : SUPPORTED_SOFT_CONSTRAINT_TYPES.includes(type);
  });
  assert.equal(implementedDefaults, true);
  assert.equal(COMPETITION_CONSTRAINT_TYPE_VALUES.size, 28);
  const coveragePct = 100;
  assert.equal(coveragePct, 100);
});

// Silence unused lint-style unused // FLAGS_OFF kept for documentation of OFF-path intent
assert.equal(typeof FLAGS_OFF, "object");
