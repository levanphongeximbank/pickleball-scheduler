/**
 * E2E-02 — Individual Tournament Template & Pool + Knockout composition tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
  createDraftCompetitionDefinition,
} from "../src/features/competition-management/competition-definition/index.js";
import {
  COMPETITION_TEMPLATE_PARTICIPANT_MODE,
  createInMemoryTemplateCatalog,
} from "../src/features/competition-management/template-instantiation/index.js";
import {
  createIndividualPoolKnockoutTemplateDefinition,
  validateIndividualPoolKnockoutTemplate,
  getIndividualPoolKnockoutTemplateSeed,
  getImmutableIndividualPoolKnockoutTemplate,
  createPoolKnockoutFormatDefinition,
  validatePoolKnockoutFormatDefinition,
  composePoolGrouping,
  composePoolStage,
  composeQualificationAdvancement,
  composeKnockoutStage,
  composeIndividualPoolKnockout,
  instantiateIndividualPoolKnockoutTemplate,
  createPoolKnockoutRuntimeComposition,
  resolveIndividualPoolKnockoutTemplate,
  E2E02_TEMPLATE_ID,
  E2E02_TEMPLATE_VERSION,
  E2E02_FORMAT_ID,
  E2E02_ERROR_CODE,
  isE2E02CompositionError,
  createCompetitionRuntimePorts,
} from "../src/features/competition-engine/index.js";

const PARTICIPANTS_8 = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];

function format2x2(overrides = {}) {
  return createPoolKnockoutFormatDefinition({
    poolCount: 2,
    qualifiersPerPool: 2,
    ...overrides,
  });
}

function standingsFromGrouping(grouping) {
  return grouping.groups.map((g) => ({
    groupId: g.groupId,
    rows: g.participantIds.map((id, i) => ({
      entryId: id,
      rank: i + 1,
      points: 20 - i,
    })),
  }));
}

// --- Template ---

test("template — canonical creation, version, fingerprint, immutability", () => {
  const template = createIndividualPoolKnockoutTemplateDefinition();
  assert.equal(template.templateId, E2E02_TEMPLATE_ID);
  assert.equal(template.templateVersion, E2E02_TEMPLATE_VERSION);
  assert.equal(
    template.participantMode,
    COMPETITION_TEMPLATE_PARTICIPANT_MODE.INDIVIDUAL
  );

  const validated = validateIndividualPoolKnockoutTemplate(template);
  assert.equal(validated.ok, true);
  assert.ok(validated.fingerprint.startsWith("tpl:"));

  const { seed, fingerprint } = getImmutableIndividualPoolKnockoutTemplate();
  assert.equal(fingerprint, validated.fingerprint);
  assert.throws(() => {
    seed.templateId = "mutated";
  });

  const source = getIndividualPoolKnockoutTemplateSeed();
  assert.throws(() => {
    source.templateId = "mutated-source";
  });
  const again = getIndividualPoolKnockoutTemplateSeed();
  assert.equal(again.templateId, E2E02_TEMPLATE_ID);
});

test("template — invalid competition type / participant mode / missing refs", () => {
  const base = createIndividualPoolKnockoutTemplateDefinition();

  const badType = validateIndividualPoolKnockoutTemplate({
    ...base,
    supportedCompetitionTypes: [COMPETITION_TYPE.TEAM_TOURNAMENT],
    capabilityTags: [...base.capabilityTags],
    metadata: { ...base.metadata },
    defaults: { ...base.defaults },
    requirements: { ...base.requirements },
  });
  assert.equal(badType.ok, false);

  const badMode = validateIndividualPoolKnockoutTemplate({
    ...base,
    participantMode: "team",
    capabilityTags: [...base.capabilityTags],
    metadata: { ...base.metadata },
    defaults: { ...base.defaults },
    requirements: { ...base.requirements },
  });
  assert.equal(badMode.ok, false);

  const missingWorkflow = validateIndividualPoolKnockoutTemplate({
    ...base,
    capabilityTags: [...base.capabilityTags],
    defaults: { ...base.defaults },
    requirements: { ...base.requirements },
    metadata: {
      ...base.metadata,
      workflowId: "",
      seedingStrategyId: "",
    },
  });
  assert.equal(missingWorkflow.ok, false);
  assert.ok(
    missingWorkflow.errors.some(
      (e) =>
        e.code === E2E02_ERROR_CODE.MISSING_RULE_REFERENCE ||
        e.code === E2E02_ERROR_CODE.MISSING_WORKFLOW_REFERENCE
    )
  );
});

test("template instantiation — immutable, attaches format/workflow, rejects team type", () => {
  const result = instantiateIndividualPoolKnockoutTemplate({
    tenantId: "tenant-1",
    competitionId: "comp-inst-1",
    deterministicSeed: "seed-inst",
    formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
  });
  assert.equal(result.ok, true);
  assert.equal(result.templateId, E2E02_TEMPLATE_ID);
  assert.equal(result.formatId, E2E02_FORMAT_ID);
  assert.ok(result.compositionFingerprint);
  assert.equal(result.workflowReference.includes("pool-qualification-knockout"), true);
  assert.equal(result.immutable, true);

  const draft = createDraftCompetitionDefinition({
    competitionId: "comp-team",
    tenantId: "tenant-1",
    owner: { ownerType: COMPETITION_OWNER_TYPE.USER, ownerId: "u1" },
    name: "Team",
    competitionType: COMPETITION_TYPE.TEAM_TOURNAMENT,
    scope: COMPETITION_SCOPE.TENANT,
    visibility: COMPETITION_VISIBILITY.TENANT,
    venues: [{ venueId: "v1" }],
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(draft.ok, true);

  assert.throws(
    () =>
      instantiateIndividualPoolKnockoutTemplate({
        tenantId: "tenant-1",
        definition: draft.value,
        deterministicSeed: "seed-inst",
      }),
    (err) =>
      isE2E02CompositionError(err) &&
      err.code === E2E02_ERROR_CODE.INVALID_COMPETITION_TYPE
  );
});

// --- Format ---

test("format — identity, stage sequence, fingerprint, invalid pool sizing", () => {
  const format = format2x2();
  assert.equal(format.formatId, E2E02_FORMAT_ID);
  assert.deepEqual(format.stageSequence, ["POOL", "QUALIFICATION", "KNOCKOUT"]);
  assert.ok(format.configurationFingerprint.startsWith("fmt:"));

  const bad = validatePoolKnockoutFormatDefinition({
    ...format,
    poolStage: { ...format.poolStage, poolCount: 0 },
  });
  assert.equal(bad.ok, false);
});

// --- Pool stage ---

test("pool — valid grouping, deterministic, GROUP_RR, no duplicate/self", () => {
  const format = format2x2();
  const a = composePoolGrouping({
    participants: PARTICIPANTS_8,
    format,
    competitionId: "comp-pool",
    deterministicSeed: "seed-pool",
  });
  const b = composePoolGrouping({
    participants: PARTICIPANTS_8,
    format,
    competitionId: "comp-pool",
    deterministicSeed: "seed-pool",
  });
  assert.deepEqual(a.groups, b.groups);
  assert.equal(a.groups.length, 2);
  assert.ok(a.groups.every((g) => g.participantIds.length === 4));

  const stage = composePoolStage({
    participants: PARTICIPANTS_8,
    format,
    competitionId: "comp-pool",
    tenantId: "tenant-1",
    deterministicSeed: "seed-pool",
  });
  const played = stage.matchPlan.logicalMatches.filter((m) => m.isByeMatch !== true);
  assert.equal(played.length, 12);
  for (const m of played) {
    assert.notEqual(
      m.participantSlotA.participantId,
      m.participantSlotB.participantId
    );
  }
  assert.ok(stage.scheduleInput.logicalMatchKeys.length > 0);
  assert.ok(stage.courtAssignmentInput.matchRefs.length > 0);
});

test("pool — uneven counts allowed; invalid sizing / duplicates fail-closed", () => {
  const format = createPoolKnockoutFormatDefinition({
    poolCount: 3,
    qualifiersPerPool: 1,
    minParticipants: 7,
  });
  const stage = composePoolStage({
    participants: ["a", "b", "c", "d", "e", "f", "g"],
    format,
    competitionId: "comp-uneven",
    tenantId: "tenant-1",
    deterministicSeed: "seed-uneven",
  });
  assert.equal(stage.grouping.groups.length, 3);
  const sizes = stage.grouping.groups
    .map((g) => g.participantIds.length)
    .sort((x, y) => x - y);
  assert.deepEqual(sizes, [2, 2, 3]);
  assert.ok(stage.matchPlan.logicalMatches.length > 0);

  assert.throws(
    () =>
      composePoolGrouping({
        participants: ["a", "b", "c", "d", "e"],
        format: createPoolKnockoutFormatDefinition({
          poolCount: 3,
          minParticipants: 5,
        }),
        competitionId: "comp-singleton-pool",
        deterministicSeed: "x",
      }),
    (err) =>
      isE2E02CompositionError(err) &&
      err.code === E2E02_ERROR_CODE.INVALID_POOL_SIZING
  );

  assert.throws(
    () =>
      composePoolGrouping({
        participants: ["a", "b"],
        format: createPoolKnockoutFormatDefinition({ poolCount: 4 }),
        competitionId: "comp-bad",
        deterministicSeed: "x",
      }),
    (err) => isE2E02CompositionError(err)
  );

  assert.throws(
    () =>
      composePoolGrouping({
        participants: ["a", "b", "a", "c"],
        format: format2x2(),
        competitionId: "comp-dup",
        deterministicSeed: "x",
      }),
    (err) =>
      isE2E02CompositionError(err) &&
      err.code === E2E02_ERROR_CODE.DUPLICATE_PARTICIPANT
  );
});

// --- Qualification ---

test("qualification — top-N per pool, deterministic, unresolved tie fail-closed", () => {
  const format = format2x2();
  const pool = composePoolStage({
    participants: PARTICIPANTS_8,
    format,
    competitionId: "comp-q",
    tenantId: "tenant-1",
    deterministicSeed: "seed-q",
  });
  const rows = standingsFromGrouping(pool.grouping);
  const q1 = composeQualificationAdvancement({
    format,
    poolStage: pool,
    poolStandingsRows: rows,
    competitionId: "comp-q",
    poolStageComplete: true,
  });
  const q2 = composeQualificationAdvancement({
    format,
    poolStage: pool,
    poolStandingsRows: rows,
    competitionId: "comp-q",
    poolStageComplete: true,
  });
  assert.deepEqual(q1.qualifiers, q2.qualifiers);
  assert.equal(q1.qualifiers.length, 4);

  assert.throws(
    () =>
      composeQualificationAdvancement({
        format,
        poolStage: pool,
        poolStandingsRows: pool.grouping.groups.map((g) => ({
          groupId: g.groupId,
          rows: g.participantIds.map((id) => ({
            entryId: id,
            rank: 1,
            points: 10,
            tieBreakUnresolved: true,
          })),
        })),
        competitionId: "comp-q",
        poolStageComplete: true,
      }),
    (err) =>
      isE2E02CompositionError(err) && err.code === E2E02_ERROR_CODE.UNRESOLVED_TIE
  );
});

test("qualification — withdrawn excluded; incomplete pool rejected; global policy", () => {
  const format = format2x2();
  const pool = composePoolStage({
    participants: PARTICIPANTS_8,
    format,
    competitionId: "comp-q2",
    tenantId: "tenant-1",
    deterministicSeed: "seed-q2",
  });

  assert.throws(
    () =>
      composeQualificationAdvancement({
        format,
        poolStage: pool,
        poolStandingsRows: standingsFromGrouping(pool.grouping),
        competitionId: "comp-q2",
        poolStageComplete: false,
      }),
    (err) =>
      isE2E02CompositionError(err) &&
      err.code === E2E02_ERROR_CODE.POOL_STAGE_INCOMPLETE
  );

  const withWithdrawn = pool.grouping.groups.map((g) => ({
    groupId: g.groupId,
    rows: g.participantIds.map((id, i) => ({
      entryId: id,
      rank: i + 1,
      points: 10 - i,
      status: i === 0 ? "WITHDRAWN" : "ACTIVE",
    })),
  }));
  const q = composeQualificationAdvancement({
    format,
    poolStage: pool,
    poolStandingsRows: withWithdrawn,
    competitionId: "comp-q2",
    poolStageComplete: true,
  });
  assert.ok(q.qualifiers.every((x) => !withWithdrawn.some(
    (b) => b.rows[0].entryId === x.participantId && b.rows[0].status === "WITHDRAWN"
      ? b.groupId === x.groupId
      : false
  ) || x.poolRank >= 1));
  assert.equal(q.qualifiers.length, 4);
  for (const qualifier of q.qualifiers) {
    const block = withWithdrawn.find((b) => b.groupId === qualifier.groupId);
    assert.notEqual(block.rows[0].entryId, qualifier.participantId);
  }

  const globalFormat = createPoolKnockoutFormatDefinition({
    poolCount: 2,
    qualificationPolicy: "GLOBAL_TOP_N",
    globalQualifierCount: 3,
    qualifiersPerPool: 2,
  });
  const distinctGlobalRows = pool.grouping.groups.flatMap((g, gi) =>
    g.participantIds.map((id, i) => ({
      groupId: g.groupId,
      entryId: id,
      rank: i + 1,
      // Distinct points across all participants — no boundary tie.
      points: 100 - (gi * 10 + i),
    }))
  );
  const byGroup = new Map();
  for (const row of distinctGlobalRows) {
    if (!byGroup.has(row.groupId)) byGroup.set(row.groupId, []);
    byGroup.get(row.groupId).push(row);
  }
  const globalQ = composeQualificationAdvancement({
    format: globalFormat,
    poolStage: pool,
    poolStandingsRows: [...byGroup.entries()].map(([groupId, rows]) => ({
      groupId,
      rows,
    })),
    competitionId: "comp-q2",
    poolStageComplete: true,
  });
  assert.equal(globalQ.qualifiers.length, 3);
});

// --- Knockout ---

test("knockout — bracket size, byes, SE generation, incomplete pool rejection", () => {
  const format = format2x2();
  const pool = composePoolStage({
    participants: PARTICIPANTS_8,
    format,
    competitionId: "comp-ko",
    tenantId: "tenant-1",
    deterministicSeed: "seed-ko",
  });
  const qualification = composeQualificationAdvancement({
    format,
    poolStage: pool,
    poolStandingsRows: standingsFromGrouping(pool.grouping),
    competitionId: "comp-ko",
    poolStageComplete: true,
  });
  const ko = composeKnockoutStage({
    format,
    qualification,
    competitionId: "comp-ko",
    tenantId: "tenant-1",
    deterministicSeed: "seed-ko",
    poolStageComplete: true,
  });
  assert.equal(ko.bracketSize, 4);
  assert.equal(ko.byeCount, 0);
  assert.equal(ko.playedMatchCount, 3);
  assert.equal(ko.winnerAdvancementCompatible, true);

  assert.throws(
    () =>
      composeKnockoutStage({
        format,
        qualification,
        competitionId: "comp-ko",
        tenantId: "tenant-1",
        deterministicSeed: "seed-ko",
        poolStageComplete: false,
      }),
    (err) =>
      isE2E02CompositionError(err) &&
      err.code === E2E02_ERROR_CODE.POOL_STAGE_INCOMPLETE
  );

  assert.throws(
    () =>
      composeKnockoutStage({
        format,
        qualification: {
          qualifiers: [
            { participantId: "a", seedNumber: 1 },
            { participantId: "a", seedNumber: 2 },
          ],
        },
        competitionId: "comp-ko",
        tenantId: "tenant-1",
        deterministicSeed: "seed-ko",
      }),
    (err) =>
      isE2E02CompositionError(err) &&
      err.code === E2E02_ERROR_CODE.DUPLICATE_QUALIFIER
  );
});

test("knockout — odd qualifier count pads with byes", () => {
  const format = createPoolKnockoutFormatDefinition({
    poolCount: 3,
    qualifiersPerPool: 1,
    minParticipants: 6,
  });
  const participants = ["a1", "a2", "b1", "b2", "c1", "c2"];
  const pool = composePoolStage({
    participants,
    format,
    competitionId: "comp-odd",
    tenantId: "tenant-1",
    deterministicSeed: "seed-odd",
  });
  const qualification = composeQualificationAdvancement({
    format,
    poolStage: pool,
    poolStandingsRows: standingsFromGrouping(pool.grouping),
    competitionId: "comp-odd",
    poolStageComplete: true,
  });
  assert.equal(qualification.qualifiers.length, 3);
  const ko = composeKnockoutStage({
    format,
    qualification,
    competitionId: "comp-odd",
    tenantId: "tenant-1",
    deterministicSeed: "seed-odd",
  });
  assert.equal(ko.bracketSize, 4);
  assert.equal(ko.byeCount, 1);
  assert.ok(ko.byeMatchCount >= 1);
});

// --- Full composition + wiring ---

test("composition — full Pool→Qualification→Knockout deterministic fingerprint", () => {
  const format = format2x2();
  const pool = composePoolStage({
    participants: PARTICIPANTS_8,
    format,
    competitionId: "comp-full",
    tenantId: "tenant-1",
    deterministicSeed: "seed-full",
  });
  const rows = standingsFromGrouping(pool.grouping);
  const a = composeIndividualPoolKnockout({
    competitionId: "comp-full",
    tenantId: "tenant-1",
    participants: PARTICIPANTS_8,
    deterministicSeed: "seed-full",
    format,
    poolStandingsRows: rows,
    includeKnockout: true,
  });
  const b = composeIndividualPoolKnockout({
    competitionId: "comp-full",
    tenantId: "tenant-1",
    participants: PARTICIPANTS_8,
    deterministicSeed: "seed-full",
    format,
    poolStandingsRows: rows,
    includeKnockout: true,
  });
  assert.equal(a.compositionIdentifier, b.compositionIdentifier);
  assert.ok(a.stages.pool);
  assert.ok(a.stages.qualification);
  assert.ok(a.stages.knockout);
});

test("wiring — CM resolve/instantiate + E2E-01 ports fail-closed", () => {
  const resolved = resolveIndividualPoolKnockoutTemplate({
    tenantId: "tenant-1",
    catalog: createInMemoryTemplateCatalog(),
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.template.templateId, E2E02_TEMPLATE_ID);

  const ports = createCompetitionRuntimePorts({});
  assert.ok(ports.identityEvidencePort);
  assert.ok(ports.requireIntegrationContext);

  const pool = composePoolStage({
    participants: PARTICIPANTS_8,
    format: format2x2(),
    competitionId: "comp-wire",
    tenantId: "tenant-1",
    deterministicSeed: "seed-wire",
  });
  const runtime = createPoolKnockoutRuntimeComposition({
    tenantId: "tenant-1",
    competitionId: "comp-wire",
    participants: PARTICIPANTS_8,
    deterministicSeed: "seed-wire",
    formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
    poolStandingsRows: standingsFromGrouping(pool.grouping),
    includeKnockout: true,
    runtimePorts: ports,
    catalog: createInMemoryTemplateCatalog(),
  });
  assert.equal(runtime.runtimeReady, true);
  assert.equal(runtime.templateResolution.templateId, E2E02_TEMPLATE_ID);
  assert.ok(runtime.composition.stages.knockout);
  assert.equal(runtime.runtimePorts.hasIdentityEvidencePort, true);

  assert.throws(
    () =>
      createPoolKnockoutRuntimeComposition({
        tenantId: "",
        competitionId: "comp-wire",
        participants: PARTICIPANTS_8,
        deterministicSeed: "seed-wire",
        requireRuntimePorts: false,
      }),
    (err) =>
      isE2E02CompositionError(err) && err.code === E2E02_ERROR_CODE.MISSING_TENANT
  );

  assert.throws(
    () =>
      createPoolKnockoutRuntimeComposition({
        tenantId: "tenant-1",
        competitionId: "comp-wire",
        participants: PARTICIPANTS_8,
        deterministicSeed: "seed-wire",
        runtimePorts: {
          requireIntegrationContext: () => {
            const err = new Error("missing");
            err.code = "MISSING_TENANT";
            throw err;
          },
        },
      }),
    () => true
  );
});

test("wiring — does not mutate canonical template seed", () => {
  const before = getIndividualPoolKnockoutTemplateSeed();
  createPoolKnockoutRuntimeComposition({
    tenantId: "tenant-1",
    competitionId: "comp-nomut",
    participants: PARTICIPANTS_8,
    deterministicSeed: "seed-nomut",
    formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
    includeKnockout: false,
    requireRuntimePorts: false,
    catalog: createInMemoryTemplateCatalog(),
  });
  const after = getIndividualPoolKnockoutTemplateSeed();
  assert.equal(before.templateId, after.templateId);
  assert.equal(before.defaults.formatBlueprintId, after.defaults.formatBlueprintId);
});
