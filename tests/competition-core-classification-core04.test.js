import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLASSIFICATION_SCHEMA_VERSION,
  CLASSIFICATION_ENTITY_KIND,
  CLASSIFICATION_ERROR_CODE,
  DEFINITION_STATUS,
  DIVISION_CATEGORY_LIFECYCLE,
  GENDER_CLASS,
  ACCESS_MODE,
  createCompetitionCategory,
  createCompetitionDivision,
  createCompetitionDivisionCategory,
  buildCategoryKey,
  buildDivisionKey,
  buildDivisionCategoryKey,
  normalizeClassificationCode,
  validateCompetitionCategory,
  validateCompetitionDivision,
  validateCompetitionDivisionCategory,
  assertDivisionAndCategoryAreSeparate,
  assertUniqueCategoryCodes,
  assertUniqueDivisionCodes,
  assertUniqueDivisionCategoryPairs,
  assertDivisionCategoryReferences,
  assertCanHardDelete,
  assertNotArchivedReadOnly,
  assertNoSilentEntryMigration,
  validateDefinitionTransition,
  validateDivisionCategoryTransition,
  evaluateOpenToDraftReferenceCheck,
  applyDivisionCategoryTransition,
  assertRegistrationAccepted,
  assertDivisionCategoryMutable,
  validateDivisionCategoryCapacity,
  enforceDivisionCategoryCapacity,
  sortClassificationList,
  gateDivisionCategoryRegistration,
  mapEventTypeToCategory,
  mapGroupToDivision,
  mapTtDisciplineToCategory,
  mapTtTeamGroupToDivision,
  mapEligibilityPortResult,
  requestEligibilityEvaluation,
  LEGACY_EVENT_TYPE,
  ELIGIBILITY_EVALUATION_PORT_METHODS,
} from "../src/features/competition-core/classification/index.js";

function clearReferenceSnapshot() {
  return {
    entryCount: 0,
    reservationCount: 0,
    drawCount: 0,
    matchCount: 0,
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLASSIFICATION_ROOT = path.join(
  __dirname,
  "..",
  "src",
  "features",
  "competition-core",
  "classification"
);

const TENANT = "tenant-a";
const COMPETITION = "comp-1";

function makeCategory(overrides = {}) {
  return createCompetitionCategory({
    id: "cat-1",
    tenantId: TENANT,
    competitionId: COMPETITION,
    code: "men_double",
    name: "Đôi nam",
    status: DEFINITION_STATUS.ACTIVE,
    ...overrides,
  });
}

function makeDivision(overrides = {}) {
  return createCompetitionDivision({
    id: "div-1",
    tenantId: TENANT,
    competitionId: COMPETITION,
    code: "group_a",
    name: "Bảng A",
    status: DEFINITION_STATUS.ACTIVE,
    ...overrides,
  });
}

function makeLane(overrides = {}) {
  return createCompetitionDivisionCategory({
    id: "lane-1",
    tenantId: TENANT,
    competitionId: COMPETITION,
    divisionId: "div-1",
    categoryId: "cat-1",
    divisionCode: "group_a",
    categoryCode: "men_double",
    name: "Bảng A / Đôi nam",
    lifecycleStatus: DIVISION_CATEGORY_LIFECYCLE.OPEN,
    capacity: { maxEntries: 16, maxWaitlist: 4, minEntriesToRun: 4 },
    ...overrides,
  });
}

test("factory: CompetitionCategory defaults and entityKind", () => {
  const cat = makeCategory();
  assert.equal(cat.entityKind, CLASSIFICATION_ENTITY_KIND.CATEGORY);
  assert.equal(cat.schemaVersion, CLASSIFICATION_SCHEMA_VERSION);
  assert.equal(cat.code, "men_double");
  assert.equal(cat.key, `${COMPETITION}|category|men_double`);
  assert.ok(cat.eligibilityDescriptor);
  assert.equal(typeof cat.displayOrder, "number");
});

test("factory: CompetitionDivision defaults and entityKind", () => {
  const div = makeDivision();
  assert.equal(div.entityKind, CLASSIFICATION_ENTITY_KIND.DIVISION);
  assert.equal(div.key, `${COMPETITION}|division|group_a`);
  assert.equal(div.sortOrder, div.displayOrder);
});

test("factory: CompetitionDivisionCategory defaults and entityKind", () => {
  const lane = makeLane();
  assert.equal(lane.entityKind, CLASSIFICATION_ENTITY_KIND.DIVISION_CATEGORY);
  assert.equal(lane.key, `${COMPETITION}|division-category|group_a|men_double`);
  assert.equal(lane.capacity.maxEntries, 16);
});

test("deterministic category key", () => {
  const a = buildCategoryKey(COMPETITION, "Men_Double");
  const b = buildCategoryKey(COMPETITION, "men_double");
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value, b.value);
  assert.equal(a.value, `${COMPETITION}|category|men_double`);
});

test("deterministic division key", () => {
  const a = buildDivisionKey(COMPETITION, "Group A");
  const b = buildDivisionKey(COMPETITION, "group_a");
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value, b.value);
});

test("deterministic DivisionCategory key", () => {
  const a = buildDivisionCategoryKey(COMPETITION, "Group A", "MEN_DOUBLE");
  const b = buildDivisionCategoryKey(COMPETITION, "group_a", "men_double");
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value, b.value);
  assert.equal(a.value, `${COMPETITION}|division-category|group_a|men_double`);
});

test("normalized-code collision fails closed within competition", () => {
  const cats = [
    makeCategory({ id: "c1", code: "Men Double" }),
    makeCategory({ id: "c2", code: "men_double" }),
  ];
  const result = assertUniqueCategoryCodes(cats);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, CLASSIFICATION_ERROR_CODE.DUPLICATE_CATEGORY_CODE);
});

test("semantically equivalent codes normalize to the same value", () => {
  const variants = [
    "MEN_DOUBLE",
    "men-double",
    " men double ",
    "men__double",
    "men---double",
    "Men.Double",
    "men_double",
  ];
  const normalized = variants.map((v) => {
    const result = normalizeClassificationCode(v);
    assert.equal(result.ok, true, v);
    return result.value;
  });
  assert.ok(normalized.every((v) => v === "men_double"));

  const keys = variants.map((v) => buildCategoryKey(COMPETITION, v));
  assert.ok(keys.every((k) => k.ok && k.value === `${COMPETITION}|category|men_double`));

  const collision = assertUniqueCategoryCodes(
    variants.map((code, i) => makeCategory({ id: `c${i}`, code }))
  );
  assert.equal(collision.ok, false);
  assert.equal(collision.errors[0].code, CLASSIFICATION_ERROR_CODE.DUPLICATE_CATEGORY_CODE);
});

test("eligibility port public method is evaluateEligibility", () => {
  assert.deepEqual(ELIGIBILITY_EVALUATION_PORT_METHODS, ["evaluateEligibility"]);
  assert.equal(
    String(requestEligibilityEvaluation).includes("evaluateEvaluation"),
    false
  );
});

test("duplicate Division–Category combination prevented", () => {
  const lanes = [
    makeLane({ id: "l1" }),
    makeLane({ id: "l2" }),
  ];
  const result = assertUniqueDivisionCategoryPairs(lanes);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, CLASSIFICATION_ERROR_CODE.DUPLICATE_DIVISION_CATEGORY);
});

test("duplicate division codes prevented", () => {
  const result = assertUniqueDivisionCodes([
    makeDivision({ id: "d1", code: "group_a" }),
    makeDivision({ id: "d2", code: "GROUP_A" }),
  ]);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, CLASSIFICATION_ERROR_CODE.DUPLICATE_DIVISION_CODE);
});

test("tenant mismatch rejection", () => {
  const lane = makeLane();
  const division = makeDivision({ tenantId: "other-tenant" });
  const category = makeCategory();
  const result = assertDivisionCategoryReferences(lane, division, category);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.code === CLASSIFICATION_ERROR_CODE.CROSS_TENANT_REFERENCE)
  );
});

test("competition mismatch rejection", () => {
  const lane = makeLane();
  const division = makeDivision();
  const category = makeCategory({ competitionId: "other-comp" });
  const result = assertDivisionCategoryReferences(lane, division, category);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.code === CLASSIFICATION_ERROR_CODE.CROSS_COMPETITION_REFERENCE)
  );
});

test("missing tenantId / competitionId rejected by validators", () => {
  const cat = validateCompetitionCategory(
    createCompetitionCategory({ id: "x", code: "open_double", name: "Open" })
  );
  assert.equal(cat.ok, false);
  assert.ok(cat.errors.some((e) => e.code === CLASSIFICATION_ERROR_CODE.TENANT_ID_REQUIRED));
  assert.ok(cat.errors.some((e) => e.code === CLASSIFICATION_ERROR_CODE.COMPETITION_ID_REQUIRED));
});

test("OD-07: Division and Category remain separate", () => {
  const ok = assertDivisionAndCategoryAreSeparate(makeDivision(), makeCategory());
  assert.equal(ok.ok, true);

  const same = makeDivision();
  const collision = assertDivisionAndCategoryAreSeparate(same, same);
  assert.equal(collision.ok, false);

  // Second arg must be a Category kind — two Divisions fail closed
  const bothDivisions = assertDivisionAndCategoryAreSeparate(makeDivision(), makeDivision());
  assert.equal(bothDivisions.ok, false);
  assert.equal(
    bothDivisions.errors[0].code,
    CLASSIFICATION_ERROR_CODE.ENTITY_KIND_COLLISION
  );

  const swapped = assertDivisionAndCategoryAreSeparate(
    { ...makeDivision(), entityKind: CLASSIFICATION_ENTITY_KIND.CATEGORY },
    makeCategory()
  );
  assert.equal(swapped.ok, false);
});

test("lifecycle transitions: valid path DRAFT→OPEN→LOCKED→CLOSED→ARCHIVED", async () => {
  let from = DIVISION_CATEGORY_LIFECYCLE.DRAFT;
  for (const to of [
    DIVISION_CATEGORY_LIFECYCLE.OPEN,
    DIVISION_CATEGORY_LIFECYCLE.LOCKED,
    DIVISION_CATEGORY_LIFECYCLE.CLOSED,
    DIVISION_CATEGORY_LIFECYCLE.ARCHIVED,
  ]) {
    const result = await validateDivisionCategoryTransition(from, to);
    assert.equal(result.ok, true, `${from}→${to}`);
    from = to;
  }
});

test("lifecycle: OPEN→CLOSED allowed; LOCKED→OPEN forbidden", async () => {
  const openClosed = await validateDivisionCategoryTransition(
    DIVISION_CATEGORY_LIFECYCLE.OPEN,
    DIVISION_CATEGORY_LIFECYCLE.CLOSED
  );
  assert.equal(openClosed.ok, true);
  const lockedOpen = await validateDivisionCategoryTransition(
    DIVISION_CATEGORY_LIFECYCLE.LOCKED,
    DIVISION_CATEGORY_LIFECYCLE.OPEN
  );
  assert.equal(lockedOpen.ok, false);
  assert.equal(lockedOpen.errors[0].code, CLASSIFICATION_ERROR_CODE.INVALID_TRANSITION);
});

test("lifecycle: ARCHIVED cannot transition", async () => {
  const result = await validateDivisionCategoryTransition(
    DIVISION_CATEGORY_LIFECYCLE.ARCHIVED,
    DIVISION_CATEGORY_LIFECYCLE.OPEN
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, CLASSIFICATION_ERROR_CODE.INVALID_TRANSITION);
});

test("lifecycle: OPEN→DRAFT requires checker + reason and no references", async () => {
  const missing = await validateDivisionCategoryTransition(
    DIVISION_CATEGORY_LIFECYCLE.OPEN,
    DIVISION_CATEGORY_LIFECYCLE.DRAFT,
    {}
  );
  assert.equal(missing.ok, false);
  assert.ok(
    missing.errors.some(
      (e) =>
        e.code === CLASSIFICATION_ERROR_CODE.AUDIT_REASON_REQUIRED ||
        e.code === CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_REQUIRED
    )
  );

  const emptyReason = await validateDivisionCategoryTransition(
    DIVISION_CATEGORY_LIFECYCLE.OPEN,
    DIVISION_CATEGORY_LIFECYCLE.DRAFT,
    {
      auditReason: "   ",
      referenceChecker: { getReferenceSnapshot: () => clearReferenceSnapshot() },
    }
  );
  assert.equal(emptyReason.ok, false);
  assert.equal(emptyReason.errors[0].code, CLASSIFICATION_ERROR_CODE.AUDIT_REASON_REQUIRED);

  const missingChecker = await validateDivisionCategoryTransition(
    DIVISION_CATEGORY_LIFECYCLE.OPEN,
    DIVISION_CATEGORY_LIFECYCLE.DRAFT,
    { auditReason: "reset" }
  );
  assert.equal(missingChecker.ok, false);
  assert.equal(
    missingChecker.errors[0].code,
    CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_REQUIRED
  );

  const throws = await validateDivisionCategoryTransition(
    DIVISION_CATEGORY_LIFECYCLE.OPEN,
    DIVISION_CATEGORY_LIFECYCLE.DRAFT,
    {
      auditReason: "reset",
      referenceChecker: {
        getReferenceSnapshot: () => {
          throw new Error("boom");
        },
      },
    }
  );
  assert.equal(throws.ok, false);
  assert.equal(throws.errors[0].code, CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_FAILED);

  const incomplete = await validateDivisionCategoryTransition(
    DIVISION_CATEGORY_LIFECYCLE.OPEN,
    DIVISION_CATEGORY_LIFECYCLE.DRAFT,
    {
      auditReason: "reset",
      referenceChecker: {
        getReferenceSnapshot: () => ({ entryCount: 0, reservationCount: 0 }),
      },
    }
  );
  assert.equal(incomplete.ok, false);
  assert.equal(
    incomplete.errors[0].code,
    CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_INCOMPLETE
  );

  const undefinedResult = await evaluateOpenToDraftReferenceCheck({
    getReferenceSnapshot: async () => undefined,
  });
  assert.equal(undefinedResult.ok, false);
  assert.equal(
    undefinedResult.errors[0].code,
    CLASSIFICATION_ERROR_CODE.REFERENCE_CHECK_INCOMPLETE
  );

  for (const [field, label] of [
    ["entryCount", "existing entry"],
    ["reservationCount", "existing reservation"],
    ["drawCount", "existing draw"],
    ["matchCount", "existing match"],
  ]) {
    const blocked = await validateDivisionCategoryTransition(
      DIVISION_CATEGORY_LIFECYCLE.OPEN,
      DIVISION_CATEGORY_LIFECYCLE.DRAFT,
      {
        auditReason: `blocked by ${label}`,
        referenceChecker: {
          getReferenceSnapshot: () => ({
            ...clearReferenceSnapshot(),
            [field]: 1,
          }),
        },
      }
    );
    assert.equal(blocked.ok, false, label);
    assert.equal(blocked.errors[0].code, CLASSIFICATION_ERROR_CODE.REFERENCED_ENTITY, label);
  }

  const allowed = await validateDivisionCategoryTransition(
    DIVISION_CATEGORY_LIFECYCLE.OPEN,
    DIVISION_CATEGORY_LIFECYCLE.DRAFT,
    {
      referenceChecker: {
        getReferenceSnapshot: async () => clearReferenceSnapshot(),
      },
      auditReason: "no entries yet",
    }
  );
  assert.equal(allowed.ok, true);
});

test("applyDivisionCategoryTransition increments revision", () => {
  const lane = makeLane({ revision: 2 });
  const next = applyDivisionCategoryTransition(lane, DIVISION_CATEGORY_LIFECYCLE.LOCKED, {
    actorId: "btc-1",
    auditReason: "freeze",
  });
  assert.equal(next.lifecycleStatus, DIVISION_CATEGORY_LIFECYCLE.LOCKED);
  assert.equal(next.revision, 3);
  assert.equal(next.audit.reason, "freeze");
});

test("OPEN registration acceptance", () => {
  const result = assertRegistrationAccepted(makeLane());
  assert.equal(result.ok, true);
});

test("DRAFT registration rejection", () => {
  const result = assertRegistrationAccepted(
    makeLane({ lifecycleStatus: DIVISION_CATEGORY_LIFECYCLE.DRAFT })
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, CLASSIFICATION_ERROR_CODE.NOT_OPEN);
});

test("LOCKED mutation rejection for capacity/eligibility/structural", () => {
  const lane = makeLane({ lifecycleStatus: DIVISION_CATEGORY_LIFECYCLE.LOCKED });
  assert.equal(assertDivisionCategoryMutable(lane, "capacity").ok, false);
  assert.equal(assertDivisionCategoryMutable(lane, "eligibility").ok, false);
  assert.equal(assertDivisionCategoryMutable(lane, "structural").ok, false);
  assert.equal(
    assertDivisionCategoryMutable(lane, "capacity").errors[0].code,
    CLASSIFICATION_ERROR_CODE.LOCKED
  );
});

test("CLOSED registration rejection", () => {
  const result = assertRegistrationAccepted(
    makeLane({ lifecycleStatus: DIVISION_CATEGORY_LIFECYCLE.CLOSED })
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, CLASSIFICATION_ERROR_CODE.CLOSED);
});

test("ARCHIVED read-only behavior", () => {
  const def = assertNotArchivedReadOnly({ status: DEFINITION_STATUS.ARCHIVED });
  assert.equal(def.ok, false);
  assert.equal(def.errors[0].code, CLASSIFICATION_ERROR_CODE.ARCHIVED);
  const lane = assertDivisionCategoryMutable(
    makeLane({ lifecycleStatus: DIVISION_CATEGORY_LIFECYCLE.ARCHIVED }),
    "other"
  );
  assert.equal(lane.ok, false);
  assert.equal(lane.errors[0].code, CLASSIFICATION_ERROR_CODE.ARCHIVED);
});

test("DivisionCategory capacity enforcement", () => {
  const lane = makeLane({ capacity: { maxEntries: 2, maxWaitlist: 1 } });
  const accept = enforceDivisionCategoryCapacity(lane, { currentEntryCount: 1 });
  assert.equal(accept.ok, true);
  assert.equal(accept.value.disposition, "accept");

  const waitlist = enforceDivisionCategoryCapacity(lane, {
    currentEntryCount: 2,
    currentWaitlistCount: 0,
  });
  assert.equal(waitlist.ok, true);
  assert.equal(waitlist.value.disposition, "waitlist");

  const full = enforceDivisionCategoryCapacity(lane, {
    currentEntryCount: 2,
    currentWaitlistCount: 1,
  });
  assert.equal(full.ok, false);
  assert.equal(full.errors[0].code, CLASSIFICATION_ERROR_CODE.CAPACITY_REACHED);
});

test("DivisionCategory capacity invariants", () => {
  assert.equal(
    validateDivisionCategoryCapacity({ maxEntries: -1 }).errors[0].code,
    CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY
  );
  assert.equal(
    validateDivisionCategoryCapacity({ maxWaitlist: -2 }).errors[0].code,
    CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY
  );
  assert.equal(
    validateDivisionCategoryCapacity({ minEntriesToRun: -1 }).errors[0].code,
    CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY
  );
  assert.equal(
    validateDivisionCategoryCapacity({ maxEntries: 4, minEntriesToRun: 5 }).errors[0].code,
    CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY
  );
  assert.equal(
    validateDivisionCategoryCapacity({
      maxEntries: 8,
      quotaByParticipantType: { singles: -1 },
    }).errors[0].code,
    CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY
  );
  assert.equal(
    validateDivisionCategoryCapacity({
      maxEntries: 8,
      quotaByParticipantType: { "!!!": 1 },
    }).errors[0].code,
    CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY
  );
  assert.equal(
    validateDivisionCategoryCapacity({
      maxEntries: 8,
      quotaByParticipantType: { singles: 1.5 },
    }).errors[0].code,
    CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY
  );
  assert.equal(
    validateDivisionCategoryCapacity({ maxEntries: 3.2 }).errors[0].code,
    CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY
  );

  const quotaOverflow = validateDivisionCategoryCapacity({
    maxEntries: 10,
    quotaByParticipantType: { singles: 6, doubles: 6 },
  });
  assert.equal(quotaOverflow.ok, false);
  assert.equal(quotaOverflow.errors[0].code, CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY);

  const ok = validateDivisionCategoryCapacity({
    maxEntries: 10,
    maxWaitlist: 2,
    minEntriesToRun: 4,
    quotaByParticipantType: { singles: 4, doubles: 6 },
  });
  assert.equal(ok.ok, true);

  const nonIntUsage = enforceDivisionCategoryCapacity(
    makeLane({ capacity: { maxEntries: 8 } }),
    { currentEntryCount: 1.5 }
  );
  assert.equal(nonIntUsage.ok, false);
  assert.equal(nonIntUsage.errors[0].code, CLASSIFICATION_ERROR_CODE.INVALID_CAPACITY);
});

test("eligibility port structured rejection (Core-04 does not evaluate)", async () => {
  const port = {
    evaluateEligibility: async () => ({
      decision: "rejected",
      rejectionCodes: ["AGE_TOO_YOUNG"],
      ruleEvaluationRefs: ["rule:age-1"],
    }),
  };
  const raw = await requestEligibilityEvaluation(port, {
    tenantId: TENANT,
    competitionId: COMPETITION,
    divisionCategoryId: "lane-1",
    participantOrEntryRef: { kind: "entry", id: "e1" },
  });
  const mapped = mapEligibilityPortResult(raw);
  assert.equal(mapped.ok, false);
  assert.equal(mapped.errors[0].code, CLASSIFICATION_ERROR_CODE.ELIGIBILITY_REJECTED);
  assert.deepEqual(mapped.errors[0].metadata.rejectionCodes, ["AGE_TOO_YOUNG"]);
});

test("registration gate: OPEN + capacity + eligibility port", async () => {
  const lane = makeLane();
  const ok = await gateDivisionCategoryRegistration(lane, {
    currentEntryCount: 0,
    eligibilityPort: {
      evaluateEligibility: async () => ({ decision: "accepted", rejectionCodes: [] }),
    },
    eligibilityRequest: {
      tenantId: TENANT,
      competitionId: COMPETITION,
      divisionCategoryId: lane.id,
      participantOrEntryRef: { kind: "entry", id: "e1" },
    },
  });
  assert.equal(ok.ok, true);

  const rejected = await gateDivisionCategoryRegistration(lane, {
    currentEntryCount: 0,
    eligibilityPort: {
      evaluateEligibility: async () => ({
        decision: "rejected",
        rejectionCodes: ["GENDER_NOT_ALLOWED"],
      }),
    },
    eligibilityRequest: {
      tenantId: TENANT,
      competitionId: COMPETITION,
      divisionCategoryId: lane.id,
      participantOrEntryRef: { kind: "entry", id: "e2" },
    },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].code, CLASSIFICATION_ERROR_CODE.ELIGIBILITY_REJECTED);
});

test("no eligibility evaluation inside Core-04 source", () => {
  const forbidden = [
    "getPlayerGenderKey",
    "getPlayerRatingInternal",
    "checkPlayerEligibility",
    "birthYear",
    "calculateAge",
  ];
  /** @type {string[]} */
  const hits = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith(".js")) continue;
      const text = readFileSync(full, "utf8");
      for (const token of forbidden) {
        if (text.includes(token)) {
          hits.push(`${path.relative(CLASSIFICATION_ROOT, full)}:${token}`);
        }
      }
    }
  }
  walk(CLASSIFICATION_ROOT);
  assert.deepEqual(hits, []);
});

test("referenced entity hard-delete rejection", () => {
  const result = assertCanHardDelete({ hasReferences: true });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, CLASSIFICATION_ERROR_CODE.REFERENCED_ENTITY);
  assert.equal(assertCanHardDelete({ hasReferences: false }).ok, true);
});

test("no silent entry migration", () => {
  const silent = assertNoSilentEntryMigration({
    fromDivisionCategoryId: "lane-1",
    toDivisionCategoryId: "lane-2",
  });
  assert.equal(silent.ok, false);
  assert.equal(silent.errors[0].code, CLASSIFICATION_ERROR_CODE.SILENT_MIGRATION_FORBIDDEN);

  const explicit = assertNoSilentEntryMigration({
    fromDivisionCategoryId: "lane-1",
    toDivisionCategoryId: "lane-2",
    explicitMigration: true,
  });
  assert.equal(explicit.ok, true);
});

test("deterministic list ordering", () => {
  const sorted = sortClassificationList([
    makeCategory({ id: "c2", code: "b_code", displayOrder: 2 }),
    makeCategory({ id: "c1", code: "a_code", displayOrder: 1 }),
    makeCategory({ id: "c3", code: "a_code", displayOrder: 1 }),
  ]);
  assert.deepEqual(
    sorted.map((x) => x.id),
    ["c1", "c3", "c2"]
  );
});

test("EVENT_TYPE legacy mapping including open_double", () => {
  const mixed = mapEventTypeToCategory({
    eventType: LEGACY_EVENT_TYPE.MIXED_DOUBLE,
    tenantId: TENANT,
    competitionId: COMPETITION,
    id: "ev-1",
  });
  assert.equal(mixed.ok, true);
  assert.equal(mixed.value.genderClass, GENDER_CLASS.MIXED);
  assert.equal(mixed.value.code, "mixed_double");

  const open = mapEventTypeToCategory({
    eventType: "open_double",
    tenantId: TENANT,
    competitionId: COMPETITION,
    id: "ev-2",
  });
  assert.equal(open.ok, true);
  assert.equal(open.value.genderClass, GENDER_CLASS.OPEN);
  assert.equal(open.value.access, ACCESS_MODE.OPEN);
});

test("unknown legacy EVENT_TYPE warning", () => {
  const result = mapEventTypeToCategory({
    eventType: "quads_open",
    tenantId: TENANT,
    competitionId: COMPETITION,
  });
  assert.equal(result.ok, true);
  assert.ok(result.warnings.length >= 1);
  assert.equal(result.warnings[0].code, CLASSIFICATION_ERROR_CODE.MAPPING_UNSUPPORTED);
});

test("TT mixed discipline mapping", () => {
  const result = mapTtDisciplineToCategory({
    categoryType: "mixed",
    genderRequirement: "mixed_pair",
    name: "Mixed 1",
    tenantId: TENANT,
    competitionId: COMPETITION,
    id: "disc-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.genderClass, GENDER_CLASS.MIXED);
  assert.equal(result.value.applicability.mixed, true);
  assert.equal(result.value.applicability.team, true);
});

test("group-to-Division mapping", () => {
  const result = mapGroupToDivision({
    id: "g1",
    label: "A",
    tenantId: TENANT,
    tournamentId: COMPETITION,
    eventId: "ev-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.entityKind, CLASSIFICATION_ENTITY_KIND.DIVISION);
  assert.equal(result.value.code, "a");
});

test("TT team group mapping", () => {
  const result = mapTtTeamGroupToDivision({
    id: "tg-1",
    name: "Group B",
    tenantId: TENANT,
    competitionId: COMPETITION,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.code, "group_b");
});

test("validate entities with matching deterministic keys", () => {
  assert.equal(validateCompetitionCategory(makeCategory()).ok, true);
  assert.equal(validateCompetitionDivision(makeDivision()).ok, true);
  assert.equal(validateCompetitionDivisionCategory(makeLane()).ok, true);
});

test("definition transition ACTIVE→ARCHIVED ok; ARCHIVED→ACTIVE forbidden", () => {
  assert.equal(
    validateDefinitionTransition(DEFINITION_STATUS.ACTIVE, DEFINITION_STATUS.ARCHIVED).ok,
    true
  );
  assert.equal(
    validateDefinitionTransition(DEFINITION_STATUS.ARCHIVED, DEFINITION_STATUS.ACTIVE).ok,
    false
  );
});

test("normalizeClassificationCode rejects invalid characters", () => {
  const bad = normalizeClassificationCode("men/double");
  assert.equal(bad.ok, false);
  assert.equal(bad.errors[0].code, CLASSIFICATION_ERROR_CODE.INVALID_CODE);
});

test("no imports from Player, Rating, UI pages or Team Tournament engines", () => {
  const forbiddenPatterns = [
    /from\s+["'].*features\/player/,
    /from\s+["'].*pick-vn-rating/,
    /from\s+["'].*pages\//,
    /from\s+["'].*team-tournament\/engines/,
    /from\s+["'].*eligibilityEngine/,
  ];
  /** @type {string[]} */
  const hits = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!full.endsWith(".js")) continue;
      const text = readFileSync(full, "utf8");
      for (const re of forbiddenPatterns) {
        if (re.test(text)) {
          hits.push(`${path.relative(CLASSIFICATION_ROOT, full)}:${re}`);
        }
      }
    }
  }
  walk(CLASSIFICATION_ROOT);
  assert.deepEqual(hits, []);
});

test("participants/contracts/divisionCategory.js left unchanged (not imported by Core-04)", () => {
  const text = readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "features",
      "competition-core",
      "participants",
      "contracts",
      "divisionCategory.js"
    ),
    "utf8"
  );
  assert.ok(text.includes("createCompetitionDivision"));
  // Core-04 local index must not re-export participant stubs via relative import into participants
  const localIndex = readFileSync(path.join(CLASSIFICATION_ROOT, "index.js"), "utf8");
  assert.equal(localIndex.includes("participants/contracts/divisionCategory"), false);
});
