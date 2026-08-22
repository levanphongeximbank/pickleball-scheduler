/**
 * Focused tests — shared knockout admission execution closure (Phase B).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ADMISSION_SOURCE,
  CAPABILITY_STATE,
  COMPETITION_RULES_CAPABILITY_ID,
  CROSS_GROUP_RANKING_CRITERION,
  KNOCKOUT_ENTRY_ROUND,
  DIRECT_KNOCKOUT_ENTRY_SOURCE,
  assertFirstPlayableDirectEntryExecution,
  deriveKnockoutAdmissionPlan,
  resolveAdmissionSourcePrecedence,
  resolveCapabilityState,
  resolveEffectiveCompetitionRules,
  resolveWildcardRankingPolicy,
} from "../src/features/competition-core/competition-rules/index.js";
import {
  rankCrossGroupWildcardCandidates,
} from "../src/features/competition-core/standings/index.js";
import {
  applyGroupStageBypassPopulation,
  composeKnockoutAdmission,
  composeKnockoutStage,
  composePoolGrouping,
  isE2E02CompositionError,
  normalizeCompetitionUnitIdentity,
} from "../src/features/competition-engine/composition/index.js";
import { createPoolKnockoutFormatDefinition } from "../src/features/competition-engine/formats/poolKnockoutFormat.js";

function formatDef(overrides = {}) {
  return createPoolKnockoutFormatDefinition(overrides);
}

const baseAdmissionProfile = {
  tenantId: "t1",
  competitionId: "c1",
  groupStage: {
    groupStageEnabled: true,
    groupCount: 2,
  },
  qualification: {
    totalKnockoutSlots: 8,
    directQualifiersPerGroup: 2,
    directKnockoutEntryCount: 2,
  },
  knockout: { knockoutEnabled: true },
  knockoutAdmission: {
    groupStageBypass: {
      enabled: true,
      entrants: [{ entryId: "pair-direct-bypass-01" }],
    },
    directKnockoutEntry: {
      enabled: true,
      count: 2,
      sourceCategory: DIRECT_KNOCKOUT_ENTRY_SOURCE.MANUAL_BY_AUTHORIZED_ORGANIZER,
      targetStage: KNOCKOUT_ENTRY_ROUND.QUARTERFINAL,
      entrants: [
        {
          entryId: "pair-direct-bypass-01",
          targetStage: KNOCKOUT_ENTRY_ROUND.QUARTERFINAL,
        },
        {
          entryId: "entry-direct-plays-group",
          targetStage: KNOCKOUT_ENTRY_ROUND.QUARTERFINAL,
        },
      ],
    },
    bye: { byePolicy: "EXPLICIT_PLACEMENTS" },
  },
  crossGroupRanking: {
    criteria: [
      CROSS_GROUP_RANKING_CRITERION.WIN_PERCENTAGE,
      CROSS_GROUP_RANKING_CRITERION.POINT_DIFFERENTIAL_PER_MATCH,
      CROSS_GROUP_RANKING_CRITERION.POINTS_SCORED_PER_MATCH,
      CROSS_GROUP_RANKING_CRITERION.DRAW_LOTS,
    ],
    normalizeByMatchesPlayed: true,
  },
};

test("1. BYPASS entrant excluded from groups/matches/standings population", () => {
  const population = [
    "pair-direct-bypass-01",
    "g1-a",
    "g1-b",
    "g1-c",
    "g2-a",
    "g2-b",
    "g2-c",
    "entry-direct-plays-group",
  ];
  const derived = deriveKnockoutAdmissionPlan(baseAdmissionProfile, {
    competitionPopulationEntryIds: population,
  });
  assert.equal(derived.ok, true);
  const bypassed = applyGroupStageBypassPopulation({
    participants: population,
    knockoutAdmissionPlan: derived.knockoutAdmissionPlan,
  });
  assert.equal(
    bypassed.groupStageParticipantEntryIds.includes("pair-direct-bypass-01"),
    false
  );
  assert.ok(
    bypassed.groupStageBypassEntryIds.includes("pair-direct-bypass-01")
  );
  assert.ok(
    bypassed.competitionPopulationEntryIds.includes("pair-direct-bypass-01")
  );

  const grouping = composePoolGrouping({
    participants: population,
    format: createPoolKnockoutFormatDefinition({
      poolCount: 2,
      minParticipants: 4,
      maxParticipants: 32,
    }),
    competitionId: "c1",
    deterministicSeed: "seed-bypass-1",
    knockoutAdmissionPlan: derived.knockoutAdmissionPlan,
  });
  const allGrouped = grouping.groups.flatMap((g) => g.entryIds);
  assert.equal(allGrouped.includes("pair-direct-bypass-01"), false);
  assert.equal(grouping.groupStageBypass.applied, true);
});

test("2. DIRECT entrant not bypassed may still play group stage", () => {
  const population = [
    "pair-direct-bypass-01",
    "g1-a",
    "g1-b",
    "g1-c",
    "g2-a",
    "g2-b",
    "g2-c",
    "entry-direct-plays-group",
  ];
  const derived = deriveKnockoutAdmissionPlan(baseAdmissionProfile, {
    competitionPopulationEntryIds: population,
  });
  const bypassed = applyGroupStageBypassPopulation({
    participants: population,
    knockoutAdmissionPlan: derived.knockoutAdmissionPlan,
  });
  assert.ok(
    bypassed.groupStageParticipantEntryIds.includes("entry-direct-plays-group")
  );
});

test("3. DIRECT #1 does not consume GROUP_DIRECT; next eligible backfills", () => {
  const precedence = resolveAdmissionSourcePrecedence({
    directEntrants: [{ entryId: "star", effectiveTargetStage: "QUARTERFINAL" }],
    directKnockoutEntrySlots: 1,
    groupDirectSlotsPerGroup: 1,
    groupDirectQualifierSlots: 2,
    groupStandingsByGroup: [
      {
        groupId: "A",
        rows: [
          { entryId: "star", rank: 1 },
          { entryId: "a2", rank: 2 },
          { entryId: "a3", rank: 3 },
        ],
      },
      {
        groupId: "B",
        rows: [
          { entryId: "b1", rank: 1 },
          { entryId: "b2", rank: 2 },
        ],
      },
    ],
    wildcardSlots: 0,
    wildcardCandidates: [],
  });
  assert.equal(precedence.ok, true);
  assert.deepEqual(
    precedence.groupDirect.map((g) => g.entryId).sort(),
    ["a2", "b1"].sort()
  );
  assert.equal(
    precedence.groupDirect.some((g) => g.entryId === "star"),
    false
  );
});

test("4+5. DIRECT and GROUP_DIRECT excluded from wildcard candidate pool", () => {
  const precedence = resolveAdmissionSourcePrecedence({
    directEntrants: [{ entryId: "d1" }],
    directKnockoutEntrySlots: 1,
    groupDirectSlotsPerGroup: 1,
    groupDirectQualifierSlots: 1,
    groupStandingsByGroup: [
      {
        groupId: "A",
        rows: [
          { entryId: "g1", rank: 1 },
          { entryId: "w1", rank: 2 },
          { entryId: "w2", rank: 3 },
        ],
      },
    ],
    wildcardSlots: 1,
    wildcardCandidates: [
      { entryId: "d1", rank: 1 },
      { entryId: "g1", rank: 2 },
      { entryId: "w1", rank: 3 },
      { entryId: "w2", rank: 4 },
    ],
  });
  assert.equal(precedence.ok, true);
  assert.equal(precedence.wildcard.length, 1);
  assert.equal(precedence.wildcard[0].entryId, "w1");
  assert.equal(
    precedence.wildcard.some((w) => w.entryId === "d1" || w.entryId === "g1"),
    false
  );
});

test("6. Wildcard ranking with unequal matches uses normalized metrics", () => {
  const ranking = rankCrossGroupWildcardCandidates({
    rows: [
      {
        entryId: "few-matches",
        played: 2,
        wins: 2,
        scoreFor: 22,
        scoreAgainst: 10,
        groupId: "A",
      },
      {
        entryId: "many-matches",
        played: 5,
        wins: 4,
        scoreFor: 50,
        scoreAgainst: 40,
        groupId: "B",
      },
    ],
    criteria: [
      CROSS_GROUP_RANKING_CRITERION.WIN_PERCENTAGE,
      CROSS_GROUP_RANKING_CRITERION.POINT_DIFFERENTIAL_PER_MATCH,
    ],
    normalizeByMatchesPlayed: true,
    drawLotSeed: "norm-1",
  });
  assert.equal(ranking.ok, true);
  // 100% win rate beats 80% even with fewer absolute wins
  assert.equal(ranking.ranked[0].entryId, "few-matches");
  assert.ok(
    ranking.ranked[0].metrics.pointDifferentialPerMatch >
      ranking.ranked[1].metrics.pointDifferentialPerMatch ||
      ranking.ranked[0].metrics.winPercentage >
        ranking.ranked[1].metrics.winPercentage
  );
});

test("7. Wildcard deterministic final DRAW_LOTS tie", () => {
  const rows = [
    {
      entryId: "tie-a",
      played: 3,
      wins: 2,
      scoreFor: 30,
      scoreAgainst: 30,
      groupId: "A",
    },
    {
      entryId: "tie-b",
      played: 3,
      wins: 2,
      scoreFor: 30,
      scoreAgainst: 30,
      groupId: "B",
    },
  ];
  const a = rankCrossGroupWildcardCandidates({
    rows,
    criteria: [
      CROSS_GROUP_RANKING_CRITERION.WIN_PERCENTAGE,
      CROSS_GROUP_RANKING_CRITERION.DRAW_LOTS,
    ],
    normalizeByMatchesPlayed: true,
    drawLotSeed: "stable-seed-xyz",
  });
  const b = rankCrossGroupWildcardCandidates({
    rows,
    criteria: [
      CROSS_GROUP_RANKING_CRITERION.WIN_PERCENTAGE,
      CROSS_GROUP_RANKING_CRITERION.DRAW_LOTS,
    ],
    normalizeByMatchesPlayed: true,
    drawLotSeed: "stable-seed-xyz",
  });
  assert.equal(a.ok, true);
  assert.deepEqual(
    a.ranked.map((r) => r.entryId),
    b.ranked.map((r) => r.entryId)
  );
});

test("8. unresolvedSlotCount > 0 fails closed at execution", () => {
  const profile = {
    ...baseAdmissionProfile,
    qualification: {
      ...baseAdmissionProfile.qualification,
      directKnockoutEntryCount: 3,
    },
    knockoutAdmission: {
      ...baseAdmissionProfile.knockoutAdmission,
      directKnockoutEntry: {
        ...baseAdmissionProfile.knockoutAdmission.directKnockoutEntry,
        count: 3,
        // only 2 resolved entrants → unresolved=1
      },
    },
  };
  const derived = deriveKnockoutAdmissionPlan(profile, {
    competitionPopulationEntryIds: [
      "pair-direct-bypass-01",
      "entry-direct-plays-group",
      "g1-a",
      "g1-b",
      "g2-a",
      "g2-b",
    ],
  });
  assert.equal(derived.ok, true);
  assert.equal(
    derived.knockoutAdmissionPlan.directKnockoutEntry.unresolvedSlotCount,
    1
  );
  assert.throws(
    () =>
      composeKnockoutAdmission({
        knockoutAdmissionPlan: derived.knockoutAdmissionPlan,
        competitionRulesProfile: profile,
        standingsByGroup: [],
        directQualifiersPerGroup: 2,
      }),
    (err) =>
      isE2E02CompositionError(err) &&
      /unresolved DIRECT/i.test(err.message)
  );
});

test("9. later-stage targetStage fails closed / deferred", () => {
  const check = assertFirstPlayableDirectEntryExecution({
    entrants: [
      {
        entryId: "late",
        effectiveTargetStage: KNOCKOUT_ENTRY_ROUND.SEMIFINAL,
      },
    ],
    bracketWideEntryRound: KNOCKOUT_ENTRY_ROUND.QUARTERFINAL,
  });
  assert.equal(check.ok, false);
  assert.equal(check.deferred, true);

  const profile = {
    ...baseAdmissionProfile,
    knockoutAdmission: {
      ...baseAdmissionProfile.knockoutAdmission,
      groupStageBypass: { enabled: false, entrants: [] },
      directKnockoutEntry: {
        enabled: true,
        count: 1,
        sourceCategory: DIRECT_KNOCKOUT_ENTRY_SOURCE.MANUAL_BY_AUTHORIZED_ORGANIZER,
        targetStage: KNOCKOUT_ENTRY_ROUND.SEMIFINAL,
        entrants: [
          {
            entryId: "late",
            targetStage: KNOCKOUT_ENTRY_ROUND.SEMIFINAL,
          },
        ],
      },
    },
    qualification: {
      totalKnockoutSlots: 8,
      directQualifiersPerGroup: 3,
      directKnockoutEntryCount: 1,
    },
  };
  // Policy may accept later-stage as compatible with bracket, but execution defers
  const derived = deriveKnockoutAdmissionPlan(profile);
  if (derived.ok) {
    assert.throws(
      () =>
        composeKnockoutAdmission({
          knockoutAdmissionPlan: derived.knockoutAdmissionPlan,
          competitionRulesProfile: profile,
          standingsByGroup: [
            {
              groupId: "A",
              rows: [
                { entryId: "a1", rank: 1, played: 3, wins: 3, scoreFor: 33, scoreAgainst: 10 },
                { entryId: "a2", rank: 2, played: 3, wins: 2, scoreFor: 30, scoreAgainst: 20 },
                { entryId: "a3", rank: 3, played: 3, wins: 1, scoreFor: 20, scoreAgainst: 30 },
                { entryId: "a4", rank: 4, played: 3, wins: 0, scoreFor: 10, scoreAgainst: 33 },
              ],
            },
            {
              groupId: "B",
              rows: [
                { entryId: "b1", rank: 1, played: 3, wins: 3, scoreFor: 33, scoreAgainst: 10 },
                { entryId: "b2", rank: 2, played: 3, wins: 2, scoreFor: 30, scoreAgainst: 20 },
                { entryId: "b3", rank: 3, played: 3, wins: 1, scoreFor: 20, scoreAgainst: 30 },
              ],
            },
          ],
          directQualifiersPerGroup: 3,
          knockoutRequired: true,
        }),
      (err) => isE2E02CompositionError(err)
    );
  }
});

test("10+12. first-round DIRECT succeeds and slot equation holds", () => {
  const population = [
    "pair-direct-bypass-01",
    "entry-direct-plays-group",
    "a1",
    "a2",
    "a3",
    "b1",
    "b2",
    "b3",
    "b4",
  ];
  const profile = {
    ...baseAdmissionProfile,
    qualification: {
      totalKnockoutSlots: 8,
      directQualifiersPerGroup: 2,
      directKnockoutEntryCount: 2,
    },
  };
  const derived = deriveKnockoutAdmissionPlan(profile, {
    competitionPopulationEntryIds: population,
  });
  assert.equal(derived.ok, true);
  const plan = derived.knockoutAdmissionPlan;
  assert.equal(plan.directKnockoutEntrySlots, 2);
  assert.equal(plan.groupDirectQualifierSlots, 4);
  assert.equal(plan.wildcardSlots, 2);

  const admission = composeKnockoutAdmission({
    knockoutAdmissionPlan: plan,
    competitionRulesProfile: profile,
    deterministicSeed: "admit-10",
    standingsByGroup: [
      {
        groupId: "A",
        rows: [
          {
            entryId: "entry-direct-plays-group",
            rank: 1,
            played: 3,
            wins: 3,
            scoreFor: 33,
            scoreAgainst: 5,
          },
          {
            entryId: "a1",
            rank: 2,
            played: 3,
            wins: 2,
            scoreFor: 28,
            scoreAgainst: 20,
          },
          {
            entryId: "a2",
            rank: 3,
            played: 3,
            wins: 1,
            scoreFor: 20,
            scoreAgainst: 28,
          },
          {
            entryId: "a3",
            rank: 4,
            played: 3,
            wins: 0,
            scoreFor: 5,
            scoreAgainst: 33,
          },
        ],
      },
      {
        groupId: "B",
        rows: [
          {
            entryId: "b1",
            rank: 1,
            played: 3,
            wins: 3,
            scoreFor: 33,
            scoreAgainst: 5,
          },
          {
            entryId: "b2",
            rank: 2,
            played: 3,
            wins: 2,
            scoreFor: 28,
            scoreAgainst: 20,
          },
          {
            entryId: "b3",
            rank: 3,
            played: 3,
            wins: 1,
            scoreFor: 20,
            scoreAgainst: 28,
          },
          {
            entryId: "b4",
            rank: 4,
            played: 3,
            wins: 0,
            scoreFor: 5,
            scoreAgainst: 33,
          },
        ],
      },
    ],
    knockoutRequired: true,
  });

  assert.equal(admission.counts.direct, 2);
  assert.equal(admission.counts.groupDirect, 4);
  assert.equal(admission.counts.wildcard, 2);
  assert.equal(admission.counts.total, 8);
  assert.equal(admission.slotEquation.proven, true);
  assert.ok(
    admission.admitted.every(
      (a) =>
        a.admissionSource === ADMISSION_SOURCE.DIRECT ||
        a.admissionSource === ADMISSION_SOURCE.GROUP_DIRECT ||
        a.admissionSource === ADMISSION_SOURCE.WILDCARD
    )
  );
  // DIRECT #1 in group A did not consume GROUP_DIRECT
  const groupDirectIds = admission.admitted
    .filter((a) => a.admissionSource === ADMISSION_SOURCE.GROUP_DIRECT)
    .map((a) => a.entryId);
  assert.equal(groupDirectIds.includes("entry-direct-plays-group"), false);
  assert.ok(groupDirectIds.includes("a1"));
});

test("11. duplicate entryId across sources cannot survive composition", () => {
  // Force a malformed plan where same id appears as direct twice — precedence rejects
  const bad = resolveAdmissionSourcePrecedence({
    directEntrants: [
      { entryId: "dup" },
      { entryId: "dup" },
    ],
    directKnockoutEntrySlots: 2,
    groupDirectSlotsPerGroup: 0,
    groupDirectQualifierSlots: 0,
    wildcardSlots: 0,
  });
  assert.equal(bad.ok, false);
});

test("13. PAIR entryId remains one competition unit", () => {
  const unit = normalizeCompetitionUnitIdentity({
    entryId: "pair::alice-bob",
  });
  assert.equal(unit.entryId, "pair::alice-bob");
  assert.equal(unit.participantId, "pair::alice-bob");
  assert.throws(
    () =>
      normalizeCompetitionUnitIdentity({
        entryId: "pair::alice-bob",
        participantId: "person-alice",
      }),
    (err) => isE2E02CompositionError(err)
  );
});

test("14. TEAM entryId remains one competition unit", () => {
  const unit = normalizeCompetitionUnitIdentity({
    entryId: "team::hawks",
  });
  assert.equal(unit.entryId, "team::hawks");
  assert.equal(unit.participantId, "team::hawks");
});

test("15+16. first-round BYE unchanged and DIRECT ≠ BYE", () => {
  const qualifiers = [
    { participantId: "q1", seedNumber: 1 },
    { participantId: "q2", seedNumber: 2 },
    { participantId: "q3", seedNumber: 3 },
  ];
  const ko = composeKnockoutStage({
    format: formatDef({
      knockoutStage: {
        bracketSizePolicy: "POWER_OF_TWO",
        byePolicy: "EXPLICIT_PLACEMENTS",
      },
    }),
    qualification: { qualifiers },
    competitionId: "c-bye",
    tenantId: "t1",
    deterministicSeed: "bye-reg",
    poolStageComplete: true,
  });
  assert.ok(ko.byeCount >= 1);
  assert.equal(ko.byeMatchCount, ko.byeCount);
  // Admitted DIRECT field is not a bye placement
  const admissionCap = resolveCapabilityState(
    COMPETITION_RULES_CAPABILITY_ID.DIRECT_KNOCKOUT_ENTRY
  );
  const byeCap = resolveCapabilityState(
    COMPETITION_RULES_CAPABILITY_ID.KNOCKOUT_BYE
  );
  assert.equal(admissionCap.execution, CAPABILITY_STATE.PARTIAL);
  assert.equal(byeCap.execution, CAPABILITY_STATE.SUPPORTED);
  assert.notEqual(
    COMPETITION_RULES_CAPABILITY_ID.DIRECT_KNOCKOUT_ENTRY,
    COMPETITION_RULES_CAPABILITY_ID.KNOCKOUT_BYE
  );
});

test("bypass-only without DIRECT route fails closed when knockout required", () => {
  const profile = {
    tenantId: "t1",
    competitionId: "c1",
    groupStage: { groupStageEnabled: true, groupCount: 2 },
    qualification: {
      totalKnockoutSlots: 4,
      directQualifiersPerGroup: 2,
      directKnockoutEntryCount: 0,
    },
    knockout: { knockoutEnabled: true },
    knockoutAdmission: {
      groupStageBypass: {
        enabled: true,
        entrants: [{ entryId: "bypass-only" }],
      },
      directKnockoutEntry: {
        enabled: false,
        count: 0,
        entrants: [],
      },
    },
  };
  const derived = deriveKnockoutAdmissionPlan(profile, {
    competitionPopulationEntryIds: [
      "bypass-only",
      "a1",
      "a2",
      "b1",
      "b2",
    ],
  });
  assert.equal(derived.ok, true);
  assert.throws(
    () =>
      composeKnockoutAdmission({
        knockoutAdmissionPlan: derived.knockoutAdmissionPlan,
        competitionRulesProfile: profile,
        standingsByGroup: [
          {
            groupId: "A",
            rows: [
              { entryId: "a1", rank: 1, played: 1, wins: 1, scoreFor: 11, scoreAgainst: 5 },
              { entryId: "a2", rank: 2, played: 1, wins: 0, scoreFor: 5, scoreAgainst: 11 },
            ],
          },
          {
            groupId: "B",
            rows: [
              { entryId: "b1", rank: 1, played: 1, wins: 1, scoreFor: 11, scoreAgainst: 5 },
              { entryId: "b2", rank: 2, played: 1, wins: 0, scoreFor: 5, scoreAgainst: 11 },
            ],
          },
        ],
        knockoutRequired: true,
      }),
    (err) =>
      isE2E02CompositionError(err) && /bypass-only/i.test(err.message)
  );
});

test("capability truth: wildcard + bypass supported; DIRECT partial", () => {
  assert.equal(
    resolveCapabilityState(COMPETITION_RULES_CAPABILITY_ID.CROSS_GROUP_WILDCARD_RANKING)
      .execution,
    CAPABILITY_STATE.SUPPORTED
  );
  assert.equal(
    resolveCapabilityState(COMPETITION_RULES_CAPABILITY_ID.QUALIFICATION_WILDCARD)
      .execution,
    CAPABILITY_STATE.SUPPORTED
  );
  assert.equal(
    resolveCapabilityState(COMPETITION_RULES_CAPABILITY_ID.GROUP_STAGE_BYPASS)
      .execution,
    CAPABILITY_STATE.SUPPORTED
  );
  assert.equal(
    resolveCapabilityState(COMPETITION_RULES_CAPABILITY_ID.DIRECT_KNOCKOUT_ENTRY)
      .execution,
    CAPABILITY_STATE.PARTIAL
  );

  const policy = resolveWildcardRankingPolicy(baseAdmissionProfile, {
    requestAuthoritativeRanking: true,
  });
  assert.equal(policy.ok, true);
  assert.equal(policy.executionAvailable, true);

  const effective = resolveEffectiveCompetitionRules(baseAdmissionProfile);
  assert.equal(effective.ok, true);
  // wildcard demand no longer blocks feasible
  assert.equal(effective.feasible, true);
});
