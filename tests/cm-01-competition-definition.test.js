import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as cm01 from "../src/features/competition-management/competition-definition/index.js";
import * as cmRoot from "../src/features/competition-management/index.js";
import {
  COMPETITION_DEFINITION_PHASE,
  COMPETITION_DEFINITION_ERROR_CODE,
  CompetitionDefinitionError,
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_DEFINITION_STATUS,
  COMPETITION_DEFINITION_INITIAL_REVISION,
  COMPETITION_OWNER_TYPE,
  createDraftCompetitionDefinition,
  updateDraftCompetitionDefinition,
  assertSameTenantDefinition,
  validateCompetitionDefinitionInput,
  projectLegacyTournamentToCompetitionDefinition,
  LEGACY_TOURNAMENT_COMPATIBILITY,
  createUnimplementedCompetitionDefinitionRepositoryPort,
  sortFieldErrors,
  createFieldError,
  clonePlain,
} from "../src/features/competition-management/competition-definition/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/competition-management/competition-definition"
);

const NOW = "2026-07-24T00:00:00.000Z";
const REG_OPEN = "2026-08-01T00:00:00.000Z";
const REG_CLOSE = "2026-08-10T00:00:00.000Z";
const START = "2026-08-15T00:00:00.000Z";
const END = "2026-08-17T00:00:00.000Z";

function validCreate(overrides = {}) {
  return {
    competitionId: "comp-1",
    tenantId: "tenant-1",
    owner: {
      ownerId: "user-1",
      ownerType: COMPETITION_OWNER_TYPE.USER,
    },
    name: "Summer Open",
    description: "Club summer competition",
    competitionType: COMPETITION_TYPE.INTERNAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.CLUB,
    visibility: COMPETITION_VISIBILITY.CLUB,
    clubs: [{ clubId: "club-1" }],
    venues: [{ venueId: "venue-1" }],
    registrationWindow: { opensAt: REG_OPEN, closesAt: REG_CLOSE },
    plannedPeriod: { startsAt: START, endsAt: END },
    template: { templateId: "tmpl-1" },
    ruleSet: { ruleSetId: "rules-1" },
    createdAt: NOW,
    ...overrides,
  };
}

function createdDraft(overrides = {}) {
  const result = createDraftCompetitionDefinition(validCreate(overrides));
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  return result.value;
}

test("30) capability-local public exports + phase dormant", () => {
  const required = [
    "COMPETITION_DEFINITION_PHASE",
    "COMPETITION_DEFINITION_ERROR_CODE",
    "CompetitionDefinitionError",
    "createDraftCompetitionDefinition",
    "updateDraftCompetitionDefinition",
    "validateCompetitionDefinitionInput",
    "projectLegacyTournamentToCompetitionDefinition",
    "createUnimplementedCompetitionDefinitionRepositoryPort",
    "LEGACY_TOURNAMENT_COMPATIBILITY",
  ];
  for (const name of required) {
    assert.ok(name in cm01, `missing export: ${name}`);
    assert.ok(name in cmRoot, `missing root export: ${name}`);
  }
  assert.equal(COMPETITION_DEFINITION_PHASE.id, "CM-01");
  assert.equal(COMPETITION_DEFINITION_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMPETITION_DEFINITION_PHASE.hasPersistence, false);
  assert.equal(COMPETITION_DEFINITION_PHASE.hasUi, false);
  assert.equal(COMPETITION_DEFINITION_PHASE.hasMigration, false);
  assert.equal(COMPETITION_DEFINITION_PHASE.migrationApplied, false);
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "ARCHITECTURE.md")));
  assert.deepEqual(LEGACY_TOURNAMENT_COMPATIBILITY.writeCompatibility.includes("deferred"), true);
});

test("1) valid CompetitionDefinition creation", () => {
  const result = createDraftCompetitionDefinition(validCreate());
  assert.equal(result.ok, true);
  assert.equal(result.value.status, COMPETITION_DEFINITION_STATUS.DRAFT);
  assert.equal(result.value.name, "Summer Open");
  assert.equal(result.value.tenantId, "tenant-1");
  assert.equal(result.value.competitionType, COMPETITION_TYPE.INTERNAL_TOURNAMENT);
  assert.ok(Object.isFrozen(result.value));
});

test("2) missing tenantId", () => {
  const result = createDraftCompetitionDefinition(
    validCreate({ tenantId: undefined })
  );
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].field, "tenantId");
  assert.equal(
    result.errors[0].code,
    COMPETITION_DEFINITION_ERROR_CODE.INVALID_IDENTIFIER
  );
});

test("3) missing owner/organizer", () => {
  const result = createDraftCompetitionDefinition(
    validCreate({ owner: undefined })
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.INVALID_OWNER_REFERENCE
    )
  );
});

test("4) empty canonical name", () => {
  const result = createDraftCompetitionDefinition(validCreate({ name: "   " }));
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.EMPTY_NAME)
  );
});

test("5) invalid competition type", () => {
  const result = createDraftCompetitionDefinition(
    validCreate({ competitionType: "weekly_ladder" })
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.INVALID_COMPETITION_TYPE
    )
  );
});

test("6) invalid scope", () => {
  const result = createDraftCompetitionDefinition(
    validCreate({ scope: "galaxy" })
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.INVALID_SCOPE
    )
  );
});

test("7) venue/club association conflict", () => {
  const openWithClub = createDraftCompetitionDefinition(
    validCreate({
      scope: COMPETITION_SCOPE.OPEN,
      clubs: [{ clubId: "club-1" }],
    })
  );
  assert.equal(openWithClub.ok, false);
  assert.ok(
    openWithClub.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.SCOPE_ASSOCIATION_CONFLICT
    )
  );

  const multiTooFew = createDraftCompetitionDefinition(
    validCreate({
      scope: COMPETITION_SCOPE.MULTI_CLUB,
      clubs: [{ clubId: "club-1" }],
    })
  );
  assert.equal(multiTooFew.ok, false);
});

test("8) valid registration window", () => {
  const result = createDraftCompetitionDefinition(validCreate());
  assert.equal(result.ok, true);
  assert.equal(result.value.registrationWindow.opensAt, REG_OPEN);
  assert.equal(result.value.registrationWindow.closesAt, REG_CLOSE);
});

test("9) invalid registration window", () => {
  const result = createDraftCompetitionDefinition(
    validCreate({
      registrationWindow: { opensAt: REG_CLOSE, closesAt: REG_OPEN },
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.INVALID_REGISTRATION_WINDOW
    )
  );
});

test("10) valid planned competition period", () => {
  const result = createDraftCompetitionDefinition(validCreate());
  assert.equal(result.ok, true);
  assert.equal(result.value.plannedPeriod.startsAt, START);
  assert.equal(result.value.plannedPeriod.endsAt, END);
});

test("11) invalid planned period", () => {
  const result = createDraftCompetitionDefinition(
    validCreate({
      plannedPeriod: { startsAt: END, endsAt: START },
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.INVALID_PLANNED_PERIOD
    )
  );
});

test("12) registration and planned period cross-validation", () => {
  const result = createDraftCompetitionDefinition(
    validCreate({
      registrationWindow: { opensAt: REG_OPEN, closesAt: START },
      plannedPeriod: { startsAt: REG_CLOSE, endsAt: END },
    })
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.REGISTRATION_PERIOD_CONFLICT
    )
  );
});

test("13) visibility validation", () => {
  const bad = createDraftCompetitionDefinition(
    validCreate({ visibility: "secret" })
  );
  assert.equal(bad.ok, false);
  assert.ok(
    bad.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.INVALID_VISIBILITY
    )
  );
  const good = createDraftCompetitionDefinition(
    validCreate({ visibility: COMPETITION_VISIBILITY.PUBLIC })
  );
  assert.equal(good.ok, true);
});

test("14) template reference validation", () => {
  const bad = createDraftCompetitionDefinition(
    validCreate({ template: { templateId: "" } })
  );
  assert.equal(bad.ok, false);
  assert.ok(
    bad.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.INVALID_TEMPLATE_REFERENCE
    )
  );
});

test("15) rule-set reference validation", () => {
  const bad = createDraftCompetitionDefinition(
    validCreate({ ruleSet: "not-an-object" })
  );
  assert.equal(bad.ok, false);
  assert.ok(
    bad.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.INVALID_RULE_SET_REFERENCE
    )
  );
});

test("16) stable initial revision", () => {
  const def = createdDraft();
  assert.equal(def.revision, COMPETITION_DEFINITION_INITIAL_REVISION);
  assert.equal(def.revision, 1);
});

test("17) deterministic output", () => {
  const a = createDraftCompetitionDefinition(validCreate());
  const b = createDraftCompetitionDefinition(validCreate());
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(a.value, b.value);
  assert.deepEqual(a.explanation, b.explanation);
});

test("18) deterministic field error ordering", () => {
  const result = createDraftCompetitionDefinition({
    createdAt: NOW,
  });
  assert.equal(result.ok, false);
  const fields = result.errors.map((e) => e.field);
  const sorted = [...fields].sort((x, y) => x.localeCompare(y, "en"));
  assert.deepEqual(fields, sorted);

  const manual = sortFieldErrors([
    createFieldError("z", "B", "m2"),
    createFieldError("a", "A", "m1"),
    createFieldError("a", "B", "m0"),
  ]);
  assert.deepEqual(
    manual.map((e) => `${e.field}:${e.code}:${e.message}`),
    ["a:A:m1", "a:B:m0", "z:B:m2"]
  );
});

test("19) immutable identity protection", () => {
  const existing = createdDraft();
  const result = updateDraftCompetitionDefinition(existing, {
    competitionId: "comp-OTHER",
    tenantId: existing.tenantId,
    name: "Renamed",
    updatedAt: "2026-07-25T00:00:00.000Z",
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.IMMUTABLE_FIELD_CHANGE
    )
  );
});

test("20) tenant identity protection", () => {
  const existing = createdDraft();
  const result = updateDraftCompetitionDefinition(existing, {
    competitionId: existing.competitionId,
    tenantId: "tenant-OTHER",
    name: "Renamed",
    updatedAt: "2026-07-25T00:00:00.000Z",
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.CROSS_TENANT_DENIED
    )
  );
});

test("21) draft update success", () => {
  const existing = createdDraft();
  const result = updateDraftCompetitionDefinition(existing, {
    competitionId: existing.competitionId,
    tenantId: existing.tenantId,
    name: "Summer Open Updated",
    description: "Updated desc",
    updatedAt: "2026-07-25T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.name, "Summer Open Updated");
  assert.equal(result.value.revision, 2);
  assert.equal(result.value.status, COMPETITION_DEFINITION_STATUS.DRAFT);
  assert.equal(result.value.createdAt, existing.createdAt);
});

test("22) non-draft update rejection", () => {
  const published = {
    ...createdDraft(),
    status: COMPETITION_DEFINITION_STATUS.PUBLISHED,
  };
  const result = updateDraftCompetitionDefinition(published, {
    competitionId: published.competitionId,
    tenantId: published.tenantId,
    name: "Nope",
    updatedAt: "2026-07-25T00:00:00.000Z",
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.NOT_DRAFT)
  );
});

test("23) cross-tenant rejection", () => {
  const def = createdDraft();
  const read = assertSameTenantDefinition(def, "tenant-OTHER");
  assert.equal(read.ok, false);
  assert.equal(
    read.errors[0].code,
    COMPETITION_DEFINITION_ERROR_CODE.CROSS_TENANT_DENIED
  );
});

test("24) no silent repair", () => {
  const result = createDraftCompetitionDefinition(
    validCreate({
      competitionType: "DAILY_PLAY", // wrong case / not allowlisted value
      name: "",
    })
  );
  assert.equal(result.ok, false);
  // Must not coerce to daily_play or invent a default name.
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.INVALID_COMPETITION_TYPE
    )
  );
  assert.ok(
    result.errors.some((e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.EMPTY_NAME)
  );
});

test("25) legacy compatibility projection success", () => {
  const legacy = {
    id: "tournament-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    name: "Legacy Cup",
    mode: COMPETITION_TYPE.TEAM_TOURNAMENT,
    status: "draft",
    createdAt: NOW,
    updatedAt: NOW,
    settings: {
      registration: { opensAt: REG_OPEN, closesAt: REG_CLOSE },
    },
  };
  const result = projectLegacyTournamentToCompetitionDefinition(legacy, {
    owner: { ownerId: "org-1", ownerType: COMPETITION_OWNER_TYPE.ORGANIZATION },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.competitionId, "tournament-1");
  assert.equal(result.value.competitionType, COMPETITION_TYPE.TEAM_TOURNAMENT);
  assert.equal(result.value.clubs[0].clubId, "club-1");
  assert.equal(result.value.visibility, COMPETITION_VISIBILITY.PRIVATE);
});

test("26) legacy ambiguity rejection", () => {
  const ambiguous = projectLegacyTournamentToCompetitionDefinition(
    {
      id: "a",
      competitionId: "b",
      tenantId: "tenant-1",
      clubId: "club-1",
      name: "X",
      mode: COMPETITION_TYPE.DAILY_PLAY,
      status: "draft",
      createdAt: NOW,
    },
    { owner: { ownerId: "u1", ownerType: COMPETITION_OWNER_TYPE.USER } }
  );
  assert.equal(ambiguous.ok, false);
  assert.ok(
    ambiguous.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.LEGACY_INCOMPATIBLE
    )
  );

  const noTenant = projectLegacyTournamentToCompetitionDefinition(
    {
      id: "a",
      clubId: "club-1",
      name: "X",
      mode: COMPETITION_TYPE.DAILY_PLAY,
      status: "draft",
      createdAt: NOW,
    },
    { owner: { ownerId: "u1", ownerType: COMPETITION_OWNER_TYPE.USER } }
  );
  assert.equal(noTenant.ok, false);
});

test("27) no UI-specific state in canonical output", () => {
  const result = createDraftCompetitionDefinition(
    validCreate({
      formDirty: true,
      selectedTab: 2,
      uiWizardStep: "courts",
      matchScores: [{ a: 11 }],
      paymentStatus: "paid",
      notificationQueued: true,
    })
  );
  assert.equal(result.ok, true);
  assert.equal("formDirty" in result.value, false);
  assert.equal("selectedTab" in result.value, false);
  assert.equal("uiWizardStep" in result.value, false);
  assert.equal("matchScores" in result.value, false);
  assert.equal("paymentStatus" in result.value, false);
  assert.equal("notificationQueued" in result.value, false);
});

test("28) no mutation of input objects", () => {
  const input = validCreate();
  const before = clonePlain(input);
  const result = createDraftCompetitionDefinition(input);
  assert.equal(result.ok, true);
  assert.deepEqual(input, before);

  const existing = createdDraft();
  const existingBefore = clonePlain(existing);
  const cmd = {
    competitionId: existing.competitionId,
    tenantId: existing.tenantId,
    name: "Mutcheck",
    updatedAt: "2026-07-25T00:00:00.000Z",
  };
  const cmdBefore = clonePlain(cmd);
  const updated = updateDraftCompetitionDefinition(existing, cmd);
  assert.equal(updated.ok, true);
  assert.deepEqual(existing, existingBefore);
  assert.deepEqual(cmd, cmdBefore);
});

test("29) stable typed error codes", () => {
  const codes = Object.values(COMPETITION_DEFINITION_ERROR_CODE);
  assert.ok(codes.length > 10);
  for (const code of codes) {
    assert.match(code, /^CM01_/);
  }
  const err = new CompetitionDefinitionError(
    COMPETITION_DEFINITION_ERROR_CODE.NOT_DRAFT,
    "test",
    { status: "published" }
  );
  assert.equal(err.name, "CompetitionDefinitionError");
  assert.equal(err.code, COMPETITION_DEFINITION_ERROR_CODE.NOT_DRAFT);

  const port = createUnimplementedCompetitionDefinitionRepositoryPort();
  assert.throws(
    () => port.saveDraftForTenant("tenant-1", {}),
    (e) =>
      e instanceof CompetitionDefinitionError &&
      e.code === COMPETITION_DEFINITION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
});

test("owner immutable on update + validateCompetitionDefinitionInput mirror", () => {
  const existing = createdDraft();
  const ownerChange = updateDraftCompetitionDefinition(existing, {
    competitionId: existing.competitionId,
    tenantId: existing.tenantId,
    owner: { ownerId: "other", ownerType: COMPETITION_OWNER_TYPE.USER },
    updatedAt: "2026-07-25T00:00:00.000Z",
  });
  assert.equal(ownerChange.ok, false);
  assert.ok(
    ownerChange.errors.some(
      (e) => e.code === COMPETITION_DEFINITION_ERROR_CODE.IMMUTABLE_FIELD_CHANGE
    )
  );

  const direct = validateCompetitionDefinitionInput({
    ...existing,
    name: "Direct",
  });
  assert.equal(direct.ok, true);
});
