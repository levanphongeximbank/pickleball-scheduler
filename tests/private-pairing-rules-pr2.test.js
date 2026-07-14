import test from "node:test";
import assert from "node:assert/strict";

import { COMPETITION_CONSTRAINT_TYPE } from "../src/features/competition-core/constants/constraintType.js";
import { CONSTRAINT_SEVERITY } from "../src/features/competition-core/constants/constraintSeverity.js";
import {
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_CONSTRAINT_TYPE_VALUES,
  isPrivatePairingConstraintType,
  PRIVATE_PAIRING_SCOPE,
  RELATION_MODE,
  RULE_VISIBILITY,
  RULE_PRIORITY,
  REASON_CATEGORY,
  COMPETITION_CLASS,
  PRIVATE_PAIRING_VALIDATION_CODE,
  PRIVATE_PAIRING_CONFLICT_CODE,
  createPrivatePairingRule,
  validatePrivatePairingRule,
  detectPrivatePairingConflicts,
  mapLegacyTypeAndMode,
  mapLegacyFounderConstraint,
  LEGACY_TO_PRIVATE_PAIRING_TYPE,
  isPrivatePairingRulesEnabled,
  FEATURE_FLAG_KEYS,
} from "../src/features/private-pairing-rules/index.js";

function baseRule(overrides = {}) {
  return createPrivatePairingRule({
    id: "r1",
    ruleSetId: "set-1",
    ruleSetVersion: "1",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
    severity: CONSTRAINT_SEVERITY.SOFT,
    weight: 80,
    priority: RULE_PRIORITY.HIGH,
    primaryPlayerId: "A",
    targetPlayerIds: ["B"],
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: PRIVATE_PAIRING_SCOPE.CLUB,
    scopeId: "club-1",
    visibility: RULE_VISIBILITY.PRIVATE,
    reasonCategory: REASON_CATEGORY.PLAYER_REQUEST,
    reasonText: "request",
    active: true,
    ...overrides,
  });
}

test("canonical private pairing types are unique and subset of competition core", () => {
  assert.equal(
    PRIVATE_PAIRING_CONSTRAINT_TYPE_VALUES.size,
    Object.keys(PRIVATE_PAIRING_CONSTRAINT_TYPE).length
  );
  for (const value of PRIVATE_PAIRING_CONSTRAINT_TYPE_VALUES) {
    assert.equal(isPrivatePairingConstraintType(value), true);
    assert.ok(Object.values(COMPETITION_CONSTRAINT_TYPE).includes(value));
  }
  assert.equal(isPrivatePairingConstraintType("not_a_type"), false);
  assert.equal(isPrivatePairingConstraintType("prefer_teammate"), false);
});

test("legacy founder mappings resolve to canonical types without duplicates", () => {
  assert.equal(
    mapLegacyTypeAndMode("prefer_partner", "soft").constraintType,
    PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER
  );
  assert.equal(
    mapLegacyTypeAndMode("prefer_partner", "hard").constraintType,
    PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER
  );
  assert.equal(
    mapLegacyTypeAndMode("avoid_partner", "hard").constraintType,
    PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER
  );
  assert.equal(
    mapLegacyTypeAndMode("avoid_same_group", "soft").constraintType,
    PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP
  );
  assert.equal(
    mapLegacyTypeAndMode("prefer_teammate", "soft").constraintType,
    PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER
  );
  assert.equal(
    mapLegacyTypeAndMode("avoid_teammate", "soft").constraintType,
    PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER
  );

  const values = Object.values(LEGACY_TO_PRIVATE_PAIRING_TYPE);
  assert.equal(new Set(values).size > 0, true);

  const mapped = mapLegacyFounderConstraint({
    id: "legacy-1",
    type: "avoid_partner",
    mode: "hard",
    anchorPlayerId: "p1",
    targetPlayerIds: ["p2"],
    note: "family",
  });
  assert.equal(mapped.constraintType, PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER);
  assert.equal(mapped.severity, CONSTRAINT_SEVERITY.HARD);
  assert.equal(mapped.relationMode, RELATION_MODE.ANY_OF);
});

test("validation catches self-target, duplicates, empty targets, scope, time, weight", () => {
  assert.equal(
    validatePrivatePairingRule({ ...baseRule(), constraintType: "" }).errors[0].code,
    PRIVATE_PAIRING_VALIDATION_CODE.MISSING_CONSTRAINT_TYPE
  );

  assert.ok(
    validatePrivatePairingRule({
      ...baseRule(),
      constraintType: "unknown_type",
    }).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.UNSUPPORTED_CONSTRAINT_TYPE)
  );

  assert.ok(
    validatePrivatePairingRule({
      ...baseRule(),
      primaryPlayerId: "",
    }).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.MISSING_PRIMARY_PLAYER)
  );

  assert.ok(
    validatePrivatePairingRule({
      ...baseRule(),
      targetPlayerIds: [],
    }).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.EMPTY_TARGET_LIST)
  );

  assert.ok(
    validatePrivatePairingRule({
      ...baseRule(),
      primaryPlayerId: "A",
      targetPlayerIds: ["A"],
    }).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.SELF_TARGET_NOT_ALLOWED)
  );

  assert.ok(
    validatePrivatePairingRule({
      ...baseRule(),
      targetPlayerIds: ["B", "B"],
    }).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.DUPLICATE_TARGET)
  );

  assert.ok(
    validatePrivatePairingRule({
      ...baseRule(),
      weight: 0,
    }).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.INVALID_WEIGHT)
  );

  assert.ok(
    validatePrivatePairingRule({
      ...baseRule({
        severity: CONSTRAINT_SEVERITY.HARD,
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
        weight: 99,
        metadata: { simulateHardWithWeight: true },
      }),
    }).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.HARD_WEIGHT_SIMULATION_NOT_ALLOWED)
  );

  assert.ok(
    validatePrivatePairingRule({
      ...baseRule(),
      scopeType: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
      scopeId: null,
    }).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.SCOPE_ID_REQUIRED)
  );

  assert.ok(
    validatePrivatePairingRule({
      ...baseRule(),
      startAt: "2026-07-20T00:00:00.000Z",
      endAt: "2026-07-10T00:00:00.000Z",
    }).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.INVALID_TIME_RANGE)
  );

  assert.ok(
    validatePrivatePairingRule(
      {
        ...baseRule(),
        endAt: "2020-01-01T00:00:00.000Z",
      },
      { now: "2026-07-14T00:00:00.000Z" }
    ).errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.RULE_EXPIRED)
  );
});

test("validation supports ANY_OF and blocks ALL_OF exceeding capacity", () => {
  const anyOf = validatePrivatePairingRule(
    {
      ...baseRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        weight: null,
        relationMode: RELATION_MODE.ANY_OF,
        targetPlayerIds: ["B", "C", "D"],
      }),
    },
    { teamSize: 2 }
  );
  assert.equal(anyOf.ok, true);

  const allOf = validatePrivatePairingRule(
    {
      ...baseRule({
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        weight: null,
        relationMode: RELATION_MODE.ALL_OF,
        targetPlayerIds: ["B", "C"],
      }),
    },
    { teamSize: 2 }
  );
  assert.ok(
    allOf.errors.some((e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.ALL_OF_EXCEEDS_TEAM_CAPACITY)
  );
});

test("certified/official policy blocks personal private rules unless disclosed", () => {
  const blocked = validatePrivatePairingRule(baseRule(), {
    competitionClass: COMPETITION_CLASS.CERTIFIED,
  });
  assert.ok(
    blocked.errors.some(
      (e) => e.code === PRIVATE_PAIRING_VALIDATION_CODE.PRIVATE_RULE_NOT_ALLOWED_IN_CERTIFIED_EVENT
    )
  );

  const allowed = validatePrivatePairingRule(
    {
      ...baseRule({
        visibility: RULE_VISIBILITY.DISCLOSED,
        reasonText: "published in regulations",
      }),
    },
    {
      competitionClass: COMPETITION_CLASS.CERTIFIED,
      allowedByPublishedRules: true,
    }
  );
  assert.equal(allowed.ok, true);
});

test("conflict: must partner vs must not partner including reverse A-B/B-A", () => {
  const result = detectPrivatePairingConflicts([
    baseRule({
      id: "m1",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      primaryPlayerId: "A",
      targetPlayerIds: ["B"],
    }),
    baseRule({
      id: "m2",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      primaryPlayerId: "B",
      targetPlayerIds: ["A"],
    }),
  ]);
  assert.equal(result.ok, false);
  assert.ok(
    result.fatalConflicts.some(
      (item) => item.code === PRIVATE_PAIRING_CONFLICT_CODE.MUST_AND_MUST_NOT_PARTNER
    )
  );
});

test("conflict: must opponent vs must not opponent", () => {
  const result = detectPrivatePairingConflicts([
    baseRule({
      id: "o1",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      primaryPlayerId: "A",
      targetPlayerIds: ["B"],
    }),
    baseRule({
      id: "o2",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      primaryPlayerId: "A",
      targetPlayerIds: ["B"],
    }),
  ]);
  assert.equal(result.ok, false);
  assert.ok(
    result.fatalConflicts.some(
      (item) => item.code === PRIVATE_PAIRING_CONFLICT_CODE.MUST_AND_MUST_NOT_OPPONENT
    )
  );
});

test("conflict: must partner vs must opponent", () => {
  const result = detectPrivatePairingConflicts([
    baseRule({
      id: "p1",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
    }),
    baseRule({
      id: "p2",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
    }),
  ]);
  assert.ok(
    result.fatalConflicts.some(
      (item) => item.code === PRIVATE_PAIRING_CONFLICT_CODE.PARTNER_AND_OPPONENT_CONFLICT
    )
  );
});

test("conflict: partner chain and capacity; ANY_OF is not ALL_OF", () => {
  const chain = detectPrivatePairingConflicts(
    [
      baseRule({
        id: "c1",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        weight: null,
        primaryPlayerId: "A",
        targetPlayerIds: ["B"],
      }),
      baseRule({
        id: "c2",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        weight: null,
        primaryPlayerId: "B",
        targetPlayerIds: ["C"],
      }),
    ],
    { teamSize: 2 }
  );
  assert.ok(
    chain.fatalConflicts.some(
      (item) =>
        item.code === PRIVATE_PAIRING_CONFLICT_CODE.IMPOSSIBLE_PARTNER_CHAIN ||
        item.code === PRIVATE_PAIRING_CONFLICT_CODE.TEAM_CAPACITY_EXCEEDED
    )
  );

  const anyOf = detectPrivatePairingConflicts(
    [
      baseRule({
        id: "a1",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        weight: null,
        relationMode: RELATION_MODE.ANY_OF,
        primaryPlayerId: "A",
        targetPlayerIds: ["B", "C", "D"],
      }),
    ],
    { teamSize: 2 }
  );
  assert.equal(anyOf.ok, true);
  assert.equal(
    anyOf.fatalConflicts.some(
      (item) => item.code === PRIVATE_PAIRING_CONFLICT_CODE.TEAM_CAPACITY_EXCEEDED
    ),
    false
  );
});

test("soft-soft warning; hard-soft override warning; different scope/time no conflict", () => {
  const soft = detectPrivatePairingConflicts([
    baseRule({ id: "s1", constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER }),
    baseRule({ id: "s2", constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER }),
  ]);
  assert.equal(soft.ok, true);
  assert.ok(
    soft.warnings.some(
      (item) => item.code === PRIVATE_PAIRING_CONFLICT_CODE.SOFT_SOFT_OPPOSITE_PREFERENCE
    )
  );

  const hardSoft = detectPrivatePairingConflicts([
    baseRule({
      id: "h1",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
    }),
    baseRule({
      id: "h2",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
      severity: CONSTRAINT_SEVERITY.SOFT,
    }),
  ]);
  assert.ok(
    hardSoft.warnings.some(
      (item) => item.code === PRIVATE_PAIRING_CONFLICT_CODE.HARD_RULE_OVERRIDES_SOFT_RULE
    )
  );

  const scoped = detectPrivatePairingConflicts([
    baseRule({
      id: "t1",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      scopeType: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
      scopeId: "tour-a",
    }),
    baseRule({
      id: "t2",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      scopeType: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
      scopeId: "tour-b",
    }),
  ]);
  assert.equal(scoped.ok, true);

  const timed = detectPrivatePairingConflicts([
    baseRule({
      id: "d1",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      startAt: "2026-01-01T00:00:00.000Z",
      endAt: "2026-01-31T00:00:00.000Z",
    }),
    baseRule({
      id: "d2",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      startAt: "2026-02-01T00:00:00.000Z",
      endAt: "2026-02-28T00:00:00.000Z",
    }),
  ]);
  assert.equal(timed.ok, true);

  const overlapTime = detectPrivatePairingConflicts([
    baseRule({
      id: "e1",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      startAt: "2026-01-01T00:00:00.000Z",
      endAt: "2026-01-31T00:00:00.000Z",
    }),
    baseRule({
      id: "e2",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
      startAt: "2026-01-15T00:00:00.000Z",
      endAt: "2026-02-15T00:00:00.000Z",
    }),
  ]);
  assert.equal(overlapTime.ok, false);
});

test("conflict detector is deterministic and does not mutate input", () => {
  const input = [
    baseRule({
      id: "z2",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
    }),
    baseRule({
      id: "z1",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
      severity: CONSTRAINT_SEVERITY.HARD,
      weight: null,
    }),
  ];
  const frozen = JSON.parse(JSON.stringify(input));
  const first = detectPrivatePairingConflicts(input);
  const second = detectPrivatePairingConflicts([...input].reverse());
  assert.deepEqual(first.fatalConflicts, second.fatalConflicts);
  assert.deepEqual(input, frozen);
});

test("feature flags default OFF", () => {
  assert.equal(isPrivatePairingRulesEnabled({}), false);
  assert.equal(
    isPrivatePairingRulesEnabled({ [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true" }),
    true
  );
});
