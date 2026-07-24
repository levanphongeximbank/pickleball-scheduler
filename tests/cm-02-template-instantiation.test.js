import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as cm02 from "../src/features/competition-management/template-instantiation/index.js";
import * as cmRoot from "../src/features/competition-management/index.js";
import {
  COMPETITION_TEMPLATE_INSTANTIATION_PHASE,
  COMPETITION_TEMPLATE_ERROR_CODE,
  CompetitionTemplateError,
  COMPETITION_TEMPLATE_SCOPE,
  COMPETITION_TEMPLATE_AVAILABILITY,
  COMPETITION_TEMPLATE_PARTICIPANT_MODE,
  COMPETITION_TEMPLATE_COMPATIBILITY_STATUS,
  COMPETITION_TEMPLATE_INSTANTIATION_STATUS,
  COMPETITION_TEMPLATE_INITIAL_VERSION,
  validateCompetitionTemplateDefinition,
  createInMemoryTemplateCatalog,
  createStaticCapabilityLocalCatalog,
  listAvailableCompetitionTemplates,
  getCompetitionTemplate,
  selectCompetitionTemplate,
  evaluateCompetitionTemplateCompatibilityCommand,
  instantiateCompetitionTemplateCommand,
  rejectImplicitTemplateSelection,
  evaluateTemplateCompatibility,
  instantiateCompetitionTemplate,
  projectLegacyPresetToCompetitionTemplateCandidate,
  LEGACY_TEMPLATE_COMPATIBILITY,
  createUnimplementedCompetitionTemplateCatalogPort,
  clonePlain,
  sortCompatibilityIssues,
  createCompatibilityIssue,
  COMPETITION_TEMPLATE_ISSUE_SEVERITY,
} from "../src/features/competition-management/template-instantiation/index.js";

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
  COMPETITION_DEFINITION_STATUS,
  createDraftCompetitionDefinition,
  updateDraftCompetitionDefinition,
} from "../src/features/competition-management/competition-definition/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/competition-management/template-instantiation"
);

const NOW = "2026-07-24T00:00:00.000Z";
const REG_OPEN = "2026-08-01T00:00:00.000Z";
const REG_CLOSE = "2026-08-10T00:00:00.000Z";
const START = "2026-08-15T00:00:00.000Z";
const END = "2026-08-17T00:00:00.000Z";

function validGlobalTemplate(overrides = {}) {
  return {
    templateId: "cm-test-global",
    templateVersion: COMPETITION_TEMPLATE_INITIAL_VERSION,
    templateScope: COMPETITION_TEMPLATE_SCOPE.GLOBAL,
    tenantId: null,
    name: "Test Global Template",
    description: "for tests",
    supportedCompetitionTypes: [COMPETITION_TYPE.INTERNAL_TOURNAMENT],
    supportedScopes: [COMPETITION_SCOPE.CLUB],
    participantMode: COMPETITION_TEMPLATE_PARTICIPANT_MODE.INDIVIDUAL,
    availability: COMPETITION_TEMPLATE_AVAILABILITY.AVAILABLE,
    requirements: {
      requiresVenue: false,
      requiresClub: true,
      allowedOwnerTypes: [],
      requiresRegistrationWindow: false,
      requiresPlannedPeriod: false,
      allowedVisibilities: [],
      requiredCapabilities: [],
    },
    defaults: {
      visibility: COMPETITION_VISIBILITY.CLUB,
      ruleSet: { ruleSetId: "competition-core-default" },
      divisionBlueprintId: null,
      formatBlueprintId: "internal_tournament",
      scheduleBlueprintId: null,
      scoringBlueprintId: null,
      standingsBlueprintId: null,
      registrationDefaults: null,
    },
    capabilityTags: ["test"],
    metadata: {},
    ...overrides,
  };
}

function validTenantTemplate(overrides = {}) {
  return validGlobalTemplate({
    templateId: "cm-test-tenant",
    templateScope: COMPETITION_TEMPLATE_SCOPE.TENANT,
    tenantId: "tenant-1",
    name: "Test Tenant Template",
    ...overrides,
  });
}

function createInternalDraft(overrides = {}) {
  const result = createDraftCompetitionDefinition({
    competitionId: "comp-1",
    tenantId: "tenant-1",
    owner: { ownerId: "user-1", ownerType: COMPETITION_OWNER_TYPE.USER },
    name: "Summer Open",
    description: "Club summer competition",
    competitionType: COMPETITION_TYPE.INTERNAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.CLUB,
    visibility: COMPETITION_VISIBILITY.CLUB,
    clubs: [{ clubId: "club-1" }],
    venues: [{ venueId: "venue-1" }],
    registrationWindow: { opensAt: REG_OPEN, closesAt: REG_CLOSE },
    plannedPeriod: { startsAt: START, endsAt: END },
    template: null,
    ruleSet: null,
    createdAt: NOW,
    ...overrides,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  return result.value;
}

function createOfficialDraft(overrides = {}) {
  return createInternalDraft({
    competitionType: COMPETITION_TYPE.OFFICIAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.OPEN,
    visibility: COMPETITION_VISIBILITY.PUBLIC,
    clubs: [],
    ...overrides,
  });
}

test("40) capability-local public exports + phase dormant", () => {
  const required = [
    "COMPETITION_TEMPLATE_INSTANTIATION_PHASE",
    "COMPETITION_TEMPLATE_ERROR_CODE",
    "CompetitionTemplateError",
    "validateCompetitionTemplateDefinition",
    "listAvailableCompetitionTemplates",
    "getCompetitionTemplate",
    "selectCompetitionTemplate",
    "evaluateCompetitionTemplateCompatibilityCommand",
    "instantiateCompetitionTemplateCommand",
    "projectLegacyPresetToCompetitionTemplateCandidate",
    "createUnimplementedCompetitionTemplateCatalogPort",
    "LEGACY_TEMPLATE_COMPATIBILITY",
  ];
  for (const name of required) {
    assert.ok(name in cm02, `missing export: ${name}`);
    assert.ok(name in cmRoot, `missing root export: ${name}`);
  }
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.id, "CM-02");
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.hasPersistence, false);
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.hasUi, false);
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.hasMigration, false);
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.migrationApplied, false);
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "ARCHITECTURE.md")));
  assert.ok(
    LEGACY_TEMPLATE_COMPATIBILITY.writeCompatibility.includes("deferred")
  );
});

test("1) valid global template definition", () => {
  const result = validateCompetitionTemplateDefinition(validGlobalTemplate());
  assert.equal(result.ok, true);
  assert.equal(result.value.templateScope, COMPETITION_TEMPLATE_SCOPE.GLOBAL);
  assert.equal(result.value.tenantId, null);
  assert.ok(Object.isFrozen(result.value));
});

test("2) valid tenant template definition", () => {
  const result = validateCompetitionTemplateDefinition(validTenantTemplate());
  assert.equal(result.ok, true);
  assert.equal(result.value.templateScope, COMPETITION_TEMPLATE_SCOPE.TENANT);
  assert.equal(result.value.tenantId, "tenant-1");
});

test("3) missing templateId", () => {
  const result = validateCompetitionTemplateDefinition(
    validGlobalTemplate({ templateId: undefined })
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_ID
    )
  );
});

test("4) invalid template version", () => {
  const result = validateCompetitionTemplateDefinition(
    validGlobalTemplate({ templateVersion: 0 })
  );
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_VERSION
    )
  );
});

test("5) duplicate template identity/version", () => {
  const catalog = createInMemoryTemplateCatalog();
  const first = catalog.register(validGlobalTemplate());
  assert.equal(first.ok, true);
  const dup = catalog.register(validGlobalTemplate());
  assert.equal(dup.ok, false);
  assert.equal(
    dup.errors[0].code,
    COMPETITION_TEMPLATE_ERROR_CODE.DUPLICATE_TEMPLATE_IDENTITY
  );
});

test("6) tenant template isolation", () => {
  const catalog = createStaticCapabilityLocalCatalog();
  const denied = catalog.getByIdentity(
    "cm-tenant-club-cup",
    1,
    "tenant-other"
  );
  assert.equal(denied.ok, false);
  assert.equal(
    denied.errors[0].code,
    COMPETITION_TEMPLATE_ERROR_CODE.TENANT_TEMPLATE_DENIED
  );
  const allowed = catalog.getByIdentity("cm-tenant-club-cup", 1, "tenant-1");
  assert.equal(allowed.ok, true);
});

test("7) global template availability", () => {
  const listed = listAvailableCompetitionTemplates({ tenantId: "tenant-1" });
  assert.equal(listed.ok, true);
  assert.ok(
    listed.value.some((t) => t.templateId === "cm-global-internal-tournament")
  );
  assert.ok(
    listed.value.some((t) => t.templateId === "cm-tenant-club-cup")
  );
  const other = listAvailableCompetitionTemplates({ tenantId: "tenant-2" });
  assert.equal(other.ok, true);
  assert.ok(
    other.value.some((t) => t.templateId === "cm-global-internal-tournament")
  );
  assert.ok(
    !other.value.some((t) => t.templateId === "cm-tenant-club-cup")
  );
});

test("8) disabled/unavailable template rejection", () => {
  const definition = createInternalDraft();
  const result = selectCompetitionTemplate({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-disabled-sample",
    templateVersion: 1,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_TEMPLATE_ERROR_CODE.TEMPLATE_UNAVAILABLE
    )
  );
});

test("9) explicit template lookup", () => {
  const result = getCompetitionTemplate({
    tenantId: "tenant-1",
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.templateId, "cm-global-internal-tournament");
});

test("10) no first-template fallback", () => {
  const definition = createInternalDraft();
  const result = selectCompetitionTemplate({
    tenantId: "tenant-1",
    definition,
    templateId: undefined,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    COMPETITION_TEMPLATE_ERROR_CODE.INVALID_TEMPLATE_ID
  );
  const implicit = rejectImplicitTemplateSelection("first in list");
  assert.equal(implicit.ok, false);
  assert.equal(
    implicit.errors[0].code,
    COMPETITION_TEMPLATE_ERROR_CODE.NO_IMPLICIT_TEMPLATE
  );
});

test("11) no inferred tenant", () => {
  const listed = listAvailableCompetitionTemplates({});
  assert.equal(listed.ok, false);
  assert.equal(
    listed.errors[0].code,
    COMPETITION_TEMPLATE_ERROR_CODE.INVALID_IDENTIFIER
  );
});

test("12) compatible competition type", () => {
  const definition = createInternalDraft();
  const result = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.status,
    COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.PASS
  );
});

test("13) incompatible competition type", () => {
  const definition = createInternalDraft({
    competitionType: COMPETITION_TYPE.DAILY_PLAY,
  });
  // daily_play + club scope with clubs — need valid CM-01 shape
  const daily = createDraftCompetitionDefinition({
    competitionId: "comp-daily",
    tenantId: "tenant-1",
    owner: { ownerId: "user-1", ownerType: COMPETITION_OWNER_TYPE.USER },
    name: "Daily",
    competitionType: COMPETITION_TYPE.DAILY_PLAY,
    scope: COMPETITION_SCOPE.CLUB,
    visibility: COMPETITION_VISIBILITY.CLUB,
    clubs: [{ clubId: "club-1" }],
    createdAt: NOW,
  });
  assert.equal(daily.ok, true);
  const result = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: daily.value,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.status,
    COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.FAIL
  );
  assert.ok(
    result.value.issues.some(
      (i) =>
        i.code === COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_COMPETITION_TYPE
    )
  );
  void definition;
});

test("14) compatible competition scope", () => {
  const definition = createInternalDraft();
  const result = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
  });
  assert.equal(result.value.status, COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.PASS);
});

test("15) incompatible competition scope", () => {
  const definition = createInternalDraft({
    scope: COMPETITION_SCOPE.TENANT,
    clubs: [],
  });
  // Fix: create properly via createDraft
  const tenantScoped = createDraftCompetitionDefinition({
    competitionId: "comp-tenant",
    tenantId: "tenant-1",
    owner: { ownerId: "user-1", ownerType: COMPETITION_OWNER_TYPE.USER },
    name: "Tenant Open",
    competitionType: COMPETITION_TYPE.INTERNAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.TENANT,
    visibility: COMPETITION_VISIBILITY.TENANT,
    clubs: [],
    createdAt: NOW,
  });
  assert.equal(tenantScoped.ok, true);
  const result = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: tenantScoped.value,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
  });
  assert.equal(
    result.value.status,
    COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.FAIL
  );
  assert.ok(
    result.value.issues.some(
      (i) =>
        i.code === COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_COMPETITION_SCOPE
    )
  );
  void definition;
});

test("16) venue requirement compatibility", () => {
  const withVenue = createInternalDraft({
    owner: { ownerId: "club-1", ownerType: COMPETITION_OWNER_TYPE.CLUB },
  });
  const pass = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: withVenue,
    templateId: "cm-tenant-club-cup",
    templateVersion: 1,
  });
  assert.equal(pass.value.status, COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.PASS);

  const noVenue = createDraftCompetitionDefinition({
    competitionId: "comp-nv",
    tenantId: "tenant-1",
    owner: { ownerId: "club-1", ownerType: COMPETITION_OWNER_TYPE.CLUB },
    name: "No Venue",
    competitionType: COMPETITION_TYPE.INTERNAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.CLUB,
    visibility: COMPETITION_VISIBILITY.CLUB,
    clubs: [{ clubId: "club-1" }],
    venues: [],
    createdAt: NOW,
  });
  assert.equal(noVenue.ok, true);
  const fail = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: noVenue.value,
    templateId: "cm-tenant-club-cup",
    templateVersion: 1,
  });
  assert.equal(fail.value.status, COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.FAIL);
  assert.ok(
    fail.value.issues.some(
      (i) =>
        i.code === COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_VENUE_REQUIREMENT
    )
  );
});

test("17) club requirement compatibility", () => {
  const catalog = createInMemoryTemplateCatalog();
  catalog.register(
    validGlobalTemplate({
      templateId: "needs-club",
      requirements: {
        requiresVenue: false,
        requiresClub: true,
        allowedOwnerTypes: [],
        requiresRegistrationWindow: false,
        requiresPlannedPeriod: false,
        allowedVisibilities: [],
        requiredCapabilities: [],
      },
    })
  );
  const withClub = createInternalDraft();
  const pass = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: withClub,
    templateId: "needs-club",
    templateVersion: 1,
    catalog,
  });
  assert.equal(pass.value.status, COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.PASS);

  const noClub = createDraftCompetitionDefinition({
    competitionId: "comp-nc",
    tenantId: "tenant-1",
    owner: { ownerId: "user-1", ownerType: COMPETITION_OWNER_TYPE.USER },
    name: "Tenant No Club",
    competitionType: COMPETITION_TYPE.INTERNAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.TENANT,
    visibility: COMPETITION_VISIBILITY.TENANT,
    clubs: [],
    createdAt: NOW,
  });
  assert.equal(noClub.ok, true);
  // Use a template that supports tenant scope but requires club
  const catalog2 = createInMemoryTemplateCatalog();
  catalog2.register(
    validGlobalTemplate({
      templateId: "needs-club-tenant",
      supportedScopes: [COMPETITION_SCOPE.TENANT],
      requirements: {
        requiresVenue: false,
        requiresClub: true,
        allowedOwnerTypes: [],
        requiresRegistrationWindow: false,
        requiresPlannedPeriod: false,
        allowedVisibilities: [],
        requiredCapabilities: [],
      },
    })
  );
  const fail = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: noClub.value,
    templateId: "needs-club-tenant",
    templateVersion: 1,
    catalog: catalog2,
  });
  assert.equal(fail.value.status, COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.FAIL);
  assert.ok(
    fail.value.issues.some(
      (i) =>
        i.code === COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_CLUB_REQUIREMENT
    )
  );
});

test("18) registration window compatibility", () => {
  const official = createOfficialDraft();
  const pass = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: official,
    templateId: "cm-global-official-tournament",
    templateVersion: 1,
  });
  assert.equal(pass.value.status, COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.PASS);

  const noReg = createDraftCompetitionDefinition({
    competitionId: "comp-or",
    tenantId: "tenant-1",
    owner: { ownerId: "org-1", ownerType: COMPETITION_OWNER_TYPE.ORGANIZATION },
    name: "Official No Reg",
    competitionType: COMPETITION_TYPE.OFFICIAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.OPEN,
    visibility: COMPETITION_VISIBILITY.PUBLIC,
    clubs: [],
    registrationWindow: null,
    plannedPeriod: { startsAt: START, endsAt: END },
    createdAt: NOW,
  });
  assert.equal(noReg.ok, true);
  const fail = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: noReg.value,
    templateId: "cm-global-official-tournament",
    templateVersion: 1,
  });
  assert.equal(fail.value.status, COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.FAIL);
  assert.ok(
    fail.value.issues.some(
      (i) =>
        i.code ===
        COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_REGISTRATION_WINDOW
    )
  );
});

test("19) planned period compatibility", () => {
  const noPeriod = createDraftCompetitionDefinition({
    competitionId: "comp-np",
    tenantId: "tenant-1",
    owner: { ownerId: "org-1", ownerType: COMPETITION_OWNER_TYPE.ORGANIZATION },
    name: "Official No Period",
    competitionType: COMPETITION_TYPE.OFFICIAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.OPEN,
    visibility: COMPETITION_VISIBILITY.PUBLIC,
    clubs: [],
    registrationWindow: { opensAt: REG_OPEN, closesAt: REG_CLOSE },
    plannedPeriod: null,
    createdAt: NOW,
  });
  assert.equal(noPeriod.ok, true);
  const fail = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: noPeriod.value,
    templateId: "cm-global-official-tournament",
    templateVersion: 1,
  });
  assert.equal(fail.value.status, COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.FAIL);
  assert.ok(
    fail.value.issues.some(
      (i) =>
        i.code === COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_PLANNED_PERIOD
    )
  );
});

test("20) visibility compatibility", () => {
  const privateOfficial = createDraftCompetitionDefinition({
    competitionId: "comp-pv",
    tenantId: "tenant-1",
    owner: { ownerId: "org-1", ownerType: COMPETITION_OWNER_TYPE.ORGANIZATION },
    name: "Official Private",
    competitionType: COMPETITION_TYPE.OFFICIAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.OPEN,
    visibility: COMPETITION_VISIBILITY.PRIVATE,
    clubs: [],
    registrationWindow: { opensAt: REG_OPEN, closesAt: REG_CLOSE },
    plannedPeriod: { startsAt: START, endsAt: END },
    createdAt: NOW,
  });
  assert.equal(privateOfficial.ok, true);
  const fail = evaluateCompetitionTemplateCompatibilityCommand({
    tenantId: "tenant-1",
    definition: privateOfficial.value,
    templateId: "cm-global-official-tournament",
    templateVersion: 1,
  });
  assert.equal(fail.value.status, COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.FAIL);
  assert.ok(
    fail.value.issues.some(
      (i) => i.code === COMPETITION_TEMPLATE_ERROR_CODE.INCOMPATIBLE_VISIBILITY
    )
  );
});

test("21) existing template reference conflict", () => {
  const definition = createInternalDraft({
    template: { templateId: "other-template" },
  });
  const result = selectCompetitionTemplate({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_TEMPLATE_ERROR_CODE.REPLACE_INTENT_REQUIRED
    )
  );
});

test("22) explicit replacement success", () => {
  const definition = createInternalDraft({
    template: { templateId: "other-template" },
  });
  const result = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    replaceIntent: true,
    expectedRevision: definition.revision,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, COMPETITION_TEMPLATE_INSTANTIATION_STATUS.SUCCESS);
  assert.equal(
    result.value.definitionPatch.template.templateId,
    "cm-global-internal-tournament"
  );
  assert.ok(
    result.value.explanation.reasons.some((r) =>
      r.includes("replaceIntent")
    )
  );
});

test("23) missing replace intent rejection", () => {
  const definition = createInternalDraft({
    template: { templateId: "other-template" },
  });
  const result = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: definition.revision,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_TEMPLATE_ERROR_CODE.REPLACE_INTENT_REQUIRED
    )
  );
});

test("24) draft definition requirement", () => {
  const definition = createInternalDraft();
  const result = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: definition.revision,
  });
  assert.equal(result.ok, true);
  assert.equal(definition.status, COMPETITION_DEFINITION_STATUS.DRAFT);
});

test("25) non-draft rejection", () => {
  const definition = {
    ...createInternalDraft(),
    status: COMPETITION_DEFINITION_STATUS.PUBLISHED,
  };
  const result = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: definition.revision,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.code === COMPETITION_TEMPLATE_ERROR_CODE.NOT_DRAFT)
  );
});

test("26) cross-tenant rejection", () => {
  const definition = createInternalDraft();
  const result = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-other",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: definition.revision,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_TEMPLATE_ERROR_CODE.CROSS_TENANT_DENIED
    )
  );
});

test("27) expected revision success", () => {
  const definition = createInternalDraft();
  const result = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.plan.sourceDefinitionRevision, 1);
  assert.equal(result.value.plan.expectedOutputRevision, 2);
});

test("28) stale revision rejection", () => {
  const definition = createInternalDraft();
  const result = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: 99,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some(
      (e) => e.code === COMPETITION_TEMPLATE_ERROR_CODE.STALE_REVISION
    )
  );
});

test("29) deterministic compatibility issue ordering", () => {
  const issues = sortCompatibilityIssues([
    createCompatibilityIssue(
      "z.field",
      "CM02_B",
      "second",
      COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
    ),
    createCompatibilityIssue(
      "a.field",
      "CM02_A",
      "first",
      COMPETITION_TEMPLATE_ISSUE_SEVERITY.ERROR
    ),
  ]);
  assert.equal(issues[0].field, "a.field");
  assert.equal(issues[1].field, "z.field");
});

test("30) deterministic instantiation plan", () => {
  const definition = createInternalDraft();
  const a = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: 1,
  });
  const b = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: 1,
  });
  assert.equal(a.ok, true);
  assert.equal(a.value.plan.planId, b.value.plan.planId);
});

test("31) stable output for equal input", () => {
  const definition = createInternalDraft();
  const a = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: 1,
  });
  const b = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: 1,
  });
  assert.deepEqual(a.value.definitionPatch, b.value.definitionPatch);
  assert.deepEqual(a.value.plan.patches, b.value.plan.patches);
});

test("32) no mutation of template", () => {
  const catalog = createStaticCapabilityLocalCatalog();
  const lookup = catalog.getByIdentity(
    "cm-global-internal-tournament",
    1,
    "tenant-1"
  );
  assert.equal(lookup.ok, true);
  const before = clonePlain(lookup.value);
  const definition = createInternalDraft();
  instantiateCompetitionTemplate(lookup.value, definition, {
    tenantId: "tenant-1",
    expectedRevision: 1,
  });
  assert.deepEqual(lookup.value, before);
});

test("33) no mutation of CompetitionDefinition", () => {
  const definition = createInternalDraft();
  const before = clonePlain(definition);
  instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: 1,
  });
  assert.deepEqual(definition, before);
  assert.equal(definition.template, null);
});

test("34) instantiation returns patch/proposal only", () => {
  const definition = createInternalDraft();
  const result = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: 1,
  });
  assert.equal(result.ok, true);
  assert.ok(result.value.definitionPatch);
  assert.ok(result.value.proposedFragments.length > 0);
  assert.equal(definition.template, null);
  assert.ok(
    result.value.explanation.reasons.some((r) =>
      r.includes("no persistence write")
    )
  );
});

test("35) no runtime/database write", () => {
  const port = createUnimplementedCompetitionTemplateCatalogPort();
  assert.throws(
    () => port.saveTemplateForTenant(),
    (err) =>
      err instanceof CompetitionTemplateError &&
      err.code === COMPETITION_TEMPLATE_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  assert.equal(
    COMPETITION_TEMPLATE_INSTANTIATION_PHASE.wiredToProductionRuntime,
    false
  );
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.hasPersistence, false);
});

test("36) legacy mapping success", () => {
  const modeMap = projectLegacyPresetToCompetitionTemplateCandidate({
    mode: "internal_tournament",
  });
  assert.equal(modeMap.ok, true);
  assert.equal(modeMap.value.templateId, "cm-global-internal-tournament");

  const mlp = projectLegacyPresetToCompetitionTemplateCandidate({
    mode: "team_tournament",
    formatPreset: "mlp_4",
  });
  assert.equal(mlp.ok, true);
  assert.equal(mlp.value.templateId, "cm-global-team-tournament-mlp4");
});

test("37) legacy ambiguous mapping rejection", () => {
  const custom = projectLegacyPresetToCompetitionTemplateCandidate({
    mode: "team_tournament",
    formatPreset: "custom",
  });
  assert.equal(custom.ok, false);
  assert.equal(
    custom.errors[0].code,
    COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_AMBIGUOUS
  );

  const sub = projectLegacyPresetToCompetitionTemplateCandidate({
    mode: "official_open",
  });
  assert.equal(sub.ok, false);
  assert.equal(
    sub.errors[0].code,
    COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_AMBIGUOUS
  );
});

test("38) unknown legacy mode rejection", () => {
  const unknown = projectLegacyPresetToCompetitionTemplateCandidate({
    mode: "weekly_ladder",
  });
  assert.equal(unknown.ok, false);
  assert.equal(
    unknown.errors[0].code,
    COMPETITION_TEMPLATE_ERROR_CODE.LEGACY_UNKNOWN
  );
});

test("39) typed error code stability", () => {
  assert.equal(
    COMPETITION_TEMPLATE_ERROR_CODE.TEMPLATE_NOT_FOUND,
    "CM02_TEMPLATE_NOT_FOUND"
  );
  assert.equal(
    COMPETITION_TEMPLATE_ERROR_CODE.REPLACE_INTENT_REQUIRED,
    "CM02_REPLACE_INTENT_REQUIRED"
  );
  assert.equal(
    COMPETITION_TEMPLATE_ERROR_CODE.STALE_REVISION,
    "CM02_STALE_REVISION"
  );
  const err = new CompetitionTemplateError(
    COMPETITION_TEMPLATE_ERROR_CODE.INVALID_CONTRACT,
    "x"
  );
  assert.equal(err.code, "CM02_INVALID_CONTRACT");
});

test("41) CM-01 regression for create/update definition", () => {
  const created = createDraftCompetitionDefinition({
    competitionId: "comp-reg",
    tenantId: "tenant-1",
    owner: { ownerId: "user-1", ownerType: COMPETITION_OWNER_TYPE.USER },
    name: "Regression",
    competitionType: COMPETITION_TYPE.INTERNAL_TOURNAMENT,
    scope: COMPETITION_SCOPE.CLUB,
    visibility: COMPETITION_VISIBILITY.CLUB,
    clubs: [{ clubId: "club-1" }],
    createdAt: NOW,
  });
  assert.equal(created.ok, true);
  const updated = updateDraftCompetitionDefinition(created.value, {
    competitionId: "comp-reg",
    tenantId: "tenant-1",
    name: "Regression Updated",
    updatedAt: NOW,
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.value.revision, 2);
  assert.equal(updated.value.name, "Regression Updated");
});

test("42) template reference attached only after compatibility PASS", () => {
  const definition = createInternalDraft();
  const fail = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-official-tournament",
    templateVersion: 1,
    expectedRevision: 1,
  });
  assert.equal(fail.ok, false);
  assert.equal(fail.value, undefined);
  assert.ok(!fail.definitionPatch);

  const pass = instantiateCompetitionTemplateCommand({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: 1,
  });
  assert.equal(pass.ok, true);
  assert.equal(
    pass.value.definitionPatch.template.templateId,
    "cm-global-internal-tournament"
  );
  // CM-01 still unchanged until consumer applies patch
  assert.equal(definition.template, null);
});

test("extra) missing template not found", () => {
  const result = getCompetitionTemplate({
    tenantId: "tenant-1",
    templateId: "does-not-exist",
    templateVersion: 1,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.errors[0].code,
    COMPETITION_TEMPLATE_ERROR_CODE.TEMPLATE_NOT_FOUND
  );
});

test("extra) evaluateTemplateCompatibility does not mutate", () => {
  const catalog = createStaticCapabilityLocalCatalog();
  const tmpl = catalog.getByIdentity(
    "cm-global-internal-tournament",
    1,
    "tenant-1"
  ).value;
  const definition = createInternalDraft();
  const tBefore = clonePlain(tmpl);
  const dBefore = clonePlain(definition);
  evaluateTemplateCompatibility(tmpl, definition, { tenantId: "tenant-1" });
  assert.deepEqual(tmpl, tBefore);
  assert.deepEqual(definition, dBefore);
});
