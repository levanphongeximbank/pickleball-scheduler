/**
 * Vertical-slice tests — shared CE admission-aware path (Phase B.1 remediation).
 * Calls composeIndividualPoolKnockout / createPoolKnockoutRuntimeComposition.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ADMISSION_SOURCE,
  CROSS_GROUP_RANKING_CRITERION,
  DIRECT_KNOCKOUT_ENTRY_SOURCE,
  KNOCKOUT_ENTRY_ROUND,
  deriveKnockoutAdmissionPlan,
} from "../src/features/competition-core/competition-rules/index.js";
import {
  assignSourceNeutralKnockoutSeeds,
  composeIndividualPoolKnockout,
  composeKnockoutAdmission,
  isE2E02CompositionError,
} from "../src/features/competition-engine/composition/index.js";
import { createPoolKnockoutFormatDefinition } from "../src/features/competition-engine/formats/poolKnockoutFormat.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const population = [
  "pair-bypass-01",
  "entry-direct-group",
  "a1",
  "a2",
  "a3",
  "b1",
  "b2",
  "b3",
  "b4",
];

const admissionProfile = {
  tenantId: "tenant-vs",
  competitionId: "comp-vs",
  groupStage: { groupStageEnabled: true, groupCount: 2 },
  qualification: {
    totalKnockoutSlots: 8,
    directQualifiersPerGroup: 2,
    directKnockoutEntryCount: 2,
  },
  knockout: { knockoutEnabled: true },
  knockoutAdmission: {
    groupStageBypass: {
      enabled: true,
      entrants: [{ entryId: "pair-bypass-01" }],
    },
    directKnockoutEntry: {
      enabled: true,
      count: 2,
      sourceCategory: DIRECT_KNOCKOUT_ENTRY_SOURCE.MANUAL_BY_AUTHORIZED_ORGANIZER,
      targetStage: KNOCKOUT_ENTRY_ROUND.QUARTERFINAL,
      entrants: [
        {
          entryId: "pair-bypass-01",
          targetStage: KNOCKOUT_ENTRY_ROUND.QUARTERFINAL,
        },
        {
          entryId: "entry-direct-group",
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
      CROSS_GROUP_RANKING_CRITERION.DRAW_LOTS,
    ],
    normalizeByMatchesPlayed: true,
  },
};

const standingsRows = [
  {
    groupId: "pool-1",
    rows: [
      {
        entryId: "entry-direct-group",
        rank: 1,
        played: 2,
        wins: 2,
        scoreFor: 22,
        scoreAgainst: 4,
        scoreDifference: 18,
      },
      {
        entryId: "a1",
        rank: 2,
        played: 2,
        wins: 1,
        scoreFor: 15,
        scoreAgainst: 12,
        scoreDifference: 3,
      },
      {
        entryId: "a2",
        rank: 3,
        played: 2,
        wins: 0,
        scoreFor: 8,
        scoreAgainst: 18,
        scoreDifference: -10,
      },
      {
        entryId: "a3",
        rank: 4,
        played: 1,
        wins: 0,
        scoreFor: 2,
        scoreAgainst: 11,
        scoreDifference: -9,
      },
    ],
  },
  {
    groupId: "pool-2",
    rows: [
      {
        entryId: "b1",
        rank: 1,
        played: 3,
        wins: 3,
        scoreFor: 33,
        scoreAgainst: 10,
        scoreDifference: 23,
      },
      {
        entryId: "b2",
        rank: 2,
        played: 3,
        wins: 2,
        scoreFor: 28,
        scoreAgainst: 20,
        scoreDifference: 8,
      },
      {
        entryId: "b3",
        rank: 3,
        played: 3,
        wins: 1,
        scoreFor: 20,
        scoreAgainst: 28,
        scoreDifference: -8,
      },
      {
        entryId: "b4",
        rank: 4,
        played: 3,
        wins: 0,
        scoreFor: 10,
        scoreAgainst: 33,
        scoreDifference: -23,
      },
    ],
  },
];

function participantsAsEntryIds() {
  return population.map((entryId) => ({ entryId }));
}

test("vertical slice: admission-aware composeIndividualPoolKnockout wires bypass + admission + KO", () => {
  const format = createPoolKnockoutFormatDefinition({
    poolCount: 2,
    minParticipants: 4,
    maxParticipants: 32,
    qualifiersPerPool: 2,
  });

  const composition = composeIndividualPoolKnockout({
    competitionId: "comp-vs",
    tenantId: "tenant-vs",
    participants: participantsAsEntryIds(),
    deterministicSeed: "vs-seed-1",
    format,
    competitionRulesProfile: admissionProfile,
    competitionPopulationEntryIds: population,
    competitionUnitKind: "PAIR",
    poolStandingsRows: standingsRows,
    poolStageComplete: true,
    includeKnockout: true,
  });

  assert.equal(composition.admissionAware, true);
  assert.ok(composition.stages.pool);
  assert.equal(
    composition.stages.pool.grouping.groupStageBypass.applied,
    true
  );
  const grouped = composition.stages.pool.grouping.groups.flatMap(
    (g) => g.entryIds || g.participantIds
  );
  assert.equal(grouped.includes("pair-bypass-01"), false);
  assert.ok(grouped.includes("entry-direct-group"));

  assert.ok(composition.stages.knockoutAdmission);
  const adm = composition.stages.knockoutAdmission;
  assert.equal(adm.counts.direct, 2);
  assert.equal(adm.counts.groupDirect, 4);
  assert.equal(adm.counts.wildcard, 2);
  assert.equal(adm.seeding.admissionSourceAffectsSeeding, false);

  const groupDirect = adm.admitted.filter(
    (a) => a.admissionSource === ADMISSION_SOURCE.GROUP_DIRECT
  );
  assert.equal(
    groupDirect.some((g) => g.entryId === "entry-direct-group"),
    false
  );
  assert.ok(groupDirect.some((g) => g.entryId === "a1"));

  assert.ok(composition.stages.knockout);
  assert.equal(composition.stages.knockout.qualifiers.length, 8);
  assert.ok(composition.stages.knockout.matchPlan);
});

test("vertical slice: runtime composition + organizer pass-through wiring present", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const runtimeSrc = readFileSync(
    join(
      here,
      "../src/features/competition-engine/application/createPoolKnockoutRuntimeComposition.js"
    ),
    "utf8"
  );
  const organizerSrc = readFileSync(
    join(
      here,
      "../src/features/competition-engine/operations/createOrganizerOperationsFacade.js"
    ),
    "utf8"
  );
  assert.match(runtimeSrc, /competitionRulesProfile:\s*input\.competitionRulesProfile/);
  assert.match(runtimeSrc, /knockoutAdmissionPlan:\s*input\.knockoutAdmissionPlan/);
  assert.match(
    runtimeSrc,
    /competitionPopulationEntryIds:\s*input\.competitionPopulationEntryIds/
  );
  assert.match(organizerSrc, /competitionRulesProfile:\s*command\.competitionRulesProfile/);
  assert.match(organizerSrc, /knockoutAdmissionPlan:\s*command\.knockoutAdmissionPlan/);
});

test("vertical slice: unknown standings / DIRECT outside population fail closed", () => {
  const derived = deriveKnockoutAdmissionPlan(admissionProfile, {
    competitionPopulationEntryIds: population,
  });
  assert.equal(derived.ok, true);

  assert.throws(
    () =>
      composeKnockoutAdmission({
        knockoutAdmissionPlan: derived.knockoutAdmissionPlan,
        competitionRulesProfile: admissionProfile,
        competitionPopulationEntryIds: population,
        standingsByGroup: [
          {
            groupId: "pool-1",
            rows: [
              {
                entryId: "unknown-outsider",
                rank: 1,
                played: 1,
                wins: 1,
                scoreFor: 11,
                scoreAgainst: 5,
              },
            ],
          },
        ],
      }),
    (err) =>
      isE2E02CompositionError(err) &&
      /outside canonical competition population/i.test(err.message)
  );
});

test("admissionSource does not create seed priority", () => {
  const setA = [
    { entryId: "x", admissionSource: ADMISSION_SOURCE.DIRECT },
    { entryId: "y", admissionSource: ADMISSION_SOURCE.GROUP_DIRECT },
    { entryId: "z", admissionSource: ADMISSION_SOURCE.WILDCARD },
  ];
  const setB = [
    { entryId: "x", admissionSource: ADMISSION_SOURCE.WILDCARD },
    { entryId: "y", admissionSource: ADMISSION_SOURCE.DIRECT },
    { entryId: "z", admissionSource: ADMISSION_SOURCE.GROUP_DIRECT },
  ];
  const seedsA = Object.fromEntries(
    assignSourceNeutralKnockoutSeeds(setA).map((r) => [r.entryId, r.seedNumber])
  );
  const seedsB = Object.fromEntries(
    assignSourceNeutralKnockoutSeeds(setB).map((r) => [r.entryId, r.seedNumber])
  );
  assert.deepEqual(seedsA, seedsB);
});

test("no-group DIRECT execution fails closed honestly", () => {
  const profile = {
    tenantId: "t1",
    competitionId: "c-nogroup",
    groupStage: { groupStageEnabled: false, groupCount: 0 },
    qualification: {
      totalKnockoutSlots: 4,
      directQualifiersPerGroup: 0,
      directKnockoutEntryCount: 2,
    },
    knockout: { knockoutEnabled: true },
    knockoutAdmission: {
      groupStageBypass: { enabled: false, entrants: [] },
      directKnockoutEntry: {
        enabled: true,
        count: 2,
        sourceCategory: DIRECT_KNOCKOUT_ENTRY_SOURCE.MANUAL_BY_AUTHORIZED_ORGANIZER,
        targetStage: KNOCKOUT_ENTRY_ROUND.SEMIFINAL,
        entrants: [
          { entryId: "d1", targetStage: KNOCKOUT_ENTRY_ROUND.SEMIFINAL },
          { entryId: "d2", targetStage: KNOCKOUT_ENTRY_ROUND.SEMIFINAL },
        ],
      },
    },
  };
  const derived = deriveKnockoutAdmissionPlan(profile, {
    competitionPopulationEntryIds: ["d1", "d2", "p3", "p4"],
  });
  assert.equal(derived.ok, true);
  assert.equal(derived.knockoutAdmissionPlan.groupStageEnabled, false);
  assert.throws(
    () =>
      composeKnockoutAdmission({
        knockoutAdmissionPlan: derived.knockoutAdmissionPlan,
        competitionRulesProfile: profile,
        competitionPopulationEntryIds: ["d1", "d2", "p3", "p4"],
        standingsByGroup: [],
      }),
    (err) =>
      isE2E02CompositionError(err) && /no-group/i.test(err.message)
  );
});

test("legacy path without admission profile remains compatible", () => {
  const format = createPoolKnockoutFormatDefinition({
    poolCount: 2,
    minParticipants: 8,
    qualifiersPerPool: 2,
  });
  const composition = composeIndividualPoolKnockout({
    competitionId: "legacy-comp",
    tenantId: "legacy-tenant",
    participants: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
    deterministicSeed: "legacy-seed",
    format,
    poolStandingsRows: [
      {
        groupId: "pool-1",
        rows: [
          { entryId: "p1", rank: 1, points: 9 },
          { entryId: "p2", rank: 2, points: 6 },
          { entryId: "p3", rank: 3, points: 3 },
          { entryId: "p4", rank: 4, points: 0 },
        ],
      },
      {
        groupId: "pool-2",
        rows: [
          { entryId: "p5", rank: 1, points: 9 },
          { entryId: "p6", rank: 2, points: 6 },
          { entryId: "p7", rank: 3, points: 3 },
          { entryId: "p8", rank: 4, points: 0 },
        ],
      },
    ],
    includeKnockout: true,
    poolStageComplete: true,
  });
  assert.equal(composition.admissionAware, false);
  assert.equal(composition.stages.knockoutAdmission, null);
  assert.ok(composition.stages.qualification.qualifiers.length >= 2);
  assert.ok(composition.stages.knockout);
});
