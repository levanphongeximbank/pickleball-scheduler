import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as cm03 from "../src/features/competition-management/competition-versioning/index.js";
import * as cmRoot from "../src/features/competition-management/index.js";
import {
  COMPETITION_VERSIONING_PHASE,
  COMPETITION_VERSION_ERROR_CODE,
  CompetitionVersionError,
  COMPETITION_VERSION_STATE,
  COMPETITION_VERSION_INITIAL_NUMBER,
  COMPETITION_VERSION_CHANGE_TYPE,
  createCompetitionVersion,
  getCompetitionVersion,
  listCompetitionVersions,
  compareCompetitionVersionsCommand,
  compareCompetitionVersions,
  createCompetitionRestoreProposalCommand,
  createInMemoryCompetitionVersionRepository,
  createUnimplementedCompetitionVersionRepositoryPort,
  clonePlain,
  canonicalizeJson,
  buildVersionContentFromDefinition,
  computeVersionContentFingerprint,
  sortVersionDifferences,
} from "../src/features/competition-management/competition-versioning/index.js";

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
  COMPETITION_DEFINITION_STATUS,
  createDraftCompetitionDefinition,
  updateDraftCompetitionDefinition,
} from "../src/features/competition-management/competition-definition/index.js";

import {
  COMPETITION_TEMPLATE_INSTANTIATION_PHASE,
  selectCompetitionTemplate,
} from "../src/features/competition-management/template-instantiation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/competition-management/competition-versioning"
);

const NOW = "2026-07-24T00:00:00.000Z";
const REG_OPEN = "2026-08-01T00:00:00.000Z";
const REG_CLOSE = "2026-08-10T00:00:00.000Z";
const START = "2026-08-15T00:00:00.000Z";
const END = "2026-08-17T00:00:00.000Z";

function hasError(result, code) {
  return Boolean(result.errors?.some((e) => e.code === code));
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

function createRepo() {
  return createInMemoryCompetitionVersionRepository();
}

function createRootVersion(definition, repo, overrides = {}) {
  return createCompetitionVersion({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: null,
    expectedLatestVersionNumber: 0,
    createdAt: NOW,
    repository: repo,
    ...overrides,
  });
}

function createNextVersion(definition, repo, parentVersion, overrides = {}) {
  return createCompetitionVersion({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: parentVersion.versionId,
    expectedLatestVersionNumber: parentVersion.versionNumber,
    createdAt: NOW,
    repository: repo,
    ...overrides,
  });
}

test("1) valid root version creation", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createRootVersion(definition, repo);
  assert.equal(result.ok, true);
  assert.equal(result.value.versionNumber, COMPETITION_VERSION_INITIAL_NUMBER);
  assert.equal(result.value.parentVersionId, null);
  assert.equal(result.value.state, COMPETITION_VERSION_STATE.FROZEN);
  assert.equal(result.value.tenantId, "tenant-1");
  assert.equal(result.value.competitionId, "comp-1");
  assert.ok(result.value.contentFingerprint);
  assert.ok(Object.isFrozen(result.value));
});

test("2) valid next version creation (after updateDraft to bump revision)", () => {
  const repo = createRepo();
  let definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const updated = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Summer Open v2",
    updatedAt: NOW,
  });
  assert.equal(updated.ok, true);
  definition = updated.value;
  assert.equal(definition.revision, 2);

  const v2 = createNextVersion(definition, repo, v1.value);
  assert.equal(v2.ok, true);
  assert.equal(v2.value.versionNumber, 2);
  assert.equal(v2.value.parentVersionId, v1.value.versionId);
  assert.equal(v2.value.sourceDefinitionRevision, 2);
});

test("3) missing tenantId", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createCompetitionVersion({
    tenantId: undefined,
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: null,
    expectedLatestVersionNumber: 0,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_VERSION_ERROR_CODE.MISSING_TENANT));
});

test("4) missing competitionId", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: null,
    expectedLatestVersionNumber: 0,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_VERSION_ERROR_CODE.MISSING_COMPETITION));
});

test("5) tenant mismatch", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createCompetitionVersion({
    tenantId: "tenant-other",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: null,
    expectedLatestVersionNumber: 0,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_VERSION_ERROR_CODE.TENANT_MISMATCH));
});

test("6) competition mismatch", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-other",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: null,
    expectedLatestVersionNumber: 0,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_VERSION_ERROR_CODE.COMPETITION_MISMATCH));
});

test("7) invalid CompetitionDefinition rejection", () => {
  const repo = createRepo();
  const result = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition: { competitionId: "comp-1", tenantId: "tenant-1" },
    expectedDefinitionRevision: 1,
    expectedParentVersionId: null,
    expectedLatestVersionNumber: 0,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_VERSION_ERROR_CODE.INVALID_DEFINITION));
});

test("8) expected definition revision success", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createRootVersion(definition, repo, {
    expectedDefinitionRevision: definition.revision,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.sourceDefinitionRevision, 1);
});

test("9) stale definition revision rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createRootVersion(definition, repo, {
    expectedDefinitionRevision: 99,
  });
  assert.equal(result.ok, false);
  assert.ok(
    hasError(result, COMPETITION_VERSION_ERROR_CODE.STALE_DEFINITION_REVISION)
  );
});

test("10) root version has no parent", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createRootVersion(definition, repo);
  assert.equal(result.ok, true);
  assert.equal(result.value.parentVersionId, null);
  assert.equal(result.value.lineage.isRoot, true);
  assert.equal(result.value.lineage.parentVersionId, null);
});

test("11) next version requires explicit parent/latest expectation", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const missingParent = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedLatestVersionNumber: v1.value.versionNumber,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(missingParent.ok, false);
  assert.ok(
    hasError(missingParent, COMPETITION_VERSION_ERROR_CODE.MISSING_EXPECTED_PARENT)
  );

  const missingLatest = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: v1.value.versionId,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(missingLatest.ok, false);
  assert.ok(
    hasError(missingLatest, COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT)
  );
});

test("12) parent version not found", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: "missing-parent-id",
    expectedLatestVersionNumber: 1,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_VERSION_ERROR_CODE.PARENT_NOT_FOUND));
});

test("13) parent from another tenant rejection", () => {
  const repo = createRepo();
  const definitionT1 = createInternalDraft({ competitionId: "comp-shared" });
  const foreignRoot = createRootVersion(definitionT1, repo);
  assert.equal(foreignRoot.ok, true);

  const definitionT2 = createInternalDraft({
    tenantId: "tenant-2",
    competitionId: "comp-shared",
  });
  const result = createCompetitionVersion({
    tenantId: "tenant-2",
    competitionId: "comp-shared",
    definition: definitionT2,
    expectedDefinitionRevision: definitionT2.revision,
    expectedParentVersionId: foreignRoot.value.versionId,
    expectedLatestVersionNumber: 1,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(
    hasError(result, COMPETITION_VERSION_ERROR_CODE.PARENT_NOT_FOUND) ||
      hasError(result, COMPETITION_VERSION_ERROR_CODE.PARENT_TENANT_MISMATCH)
  );
});

test("14) parent from another competition rejection", () => {
  const repo = createRepo();
  const definitionA = createInternalDraft({ competitionId: "comp-a" });
  const rootA = createRootVersion(definitionA, repo);
  assert.equal(rootA.ok, true);

  const definitionB = createInternalDraft({ competitionId: "comp-b" });
  const result = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-b",
    definition: definitionB,
    expectedDefinitionRevision: definitionB.revision,
    expectedParentVersionId: rootA.value.versionId,
    expectedLatestVersionNumber: 1,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(
    hasError(result, COMPETITION_VERSION_ERROR_CODE.PARENT_NOT_FOUND) ||
      hasError(result, COMPETITION_VERSION_ERROR_CODE.STALE_PARENT_VERSION) ||
      hasError(result, COMPETITION_VERSION_ERROR_CODE.PARENT_COMPETITION_MISMATCH)
  );
});

test("15) stale parent rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const result = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: "wrong-parent-id",
    expectedLatestVersionNumber: v1.value.versionNumber,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(
    hasError(result, COMPETITION_VERSION_ERROR_CODE.STALE_PARENT_VERSION)
  );
});

test("16) monotonic version numbering", () => {
  const repo = createRepo();
  let definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const updated = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Rev 2",
    updatedAt: NOW,
  });
  definition = updated.value;
  const v2 = createNextVersion(definition, repo, v1.value);
  assert.equal(v2.ok, true);

  const updated2 = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Rev 3",
    updatedAt: NOW,
  });
  definition = updated2.value;
  const v3 = createNextVersion(definition, repo, v2.value);
  assert.equal(v3.ok, true);

  assert.deepEqual(
    [v1.value.versionNumber, v2.value.versionNumber, v3.value.versionNumber],
    [1, 2, 3]
  );
});

test("17) duplicate version identity rejection (save same version twice via repository)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createRootVersion(definition, repo);
  assert.equal(created.ok, true);
  const dup = repo.saveVersion(created.value);
  assert.equal(dup.ok, false);
  assert.ok(hasError(dup, COMPETITION_VERSION_ERROR_CODE.DUPLICATE_VERSION));
});

test("18) idempotent retry returns same version", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const first = createRootVersion(definition, repo, {
    idempotencyKey: "idem-1",
  });
  assert.equal(first.ok, true);
  const retry = createRootVersion(definition, repo, {
    idempotencyKey: "idem-1",
  });
  assert.equal(retry.ok, true);
  assert.equal(retry.value.versionId, first.value.versionId);
  assert.equal(retry.value.contentFingerprint, first.value.contentFingerprint);
  assert.ok(
    retry.explanation.reasons.some((r) => String(r).includes("idempotent=true"))
  );
});

test("19) same idempotency key with different payload conflicts", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const first = createRootVersion(definition, repo, {
    idempotencyKey: "idem-conflict",
  });
  assert.equal(first.ok, true);

  const updated = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Different semantic content",
    updatedAt: NOW,
  });
  const conflict = createRootVersion(updated.value, repo, {
    idempotencyKey: "idem-conflict",
  });
  assert.equal(conflict.ok, false);
  assert.ok(
    hasError(conflict, COMPETITION_VERSION_ERROR_CODE.IDEMPOTENCY_CONFLICT)
  );
});

test("20-23) stable canonical snapshot and fingerprint semantics", () => {
  const definition = createInternalDraft();
  const contentA = buildVersionContentFromDefinition(definition);
  const contentB = buildVersionContentFromDefinition(clonePlain(definition));
  assert.equal(canonicalizeJson(contentA), canonicalizeJson(contentB));

  const fp1 = computeVersionContentFingerprint(contentA, definition.revision);
  const fp2 = computeVersionContentFingerprint(contentB, definition.revision);
  assert.equal(fp1, fp2);
  assert.ok(fp1.startsWith("cm03-"));

  const sameSemantic = computeVersionContentFingerprint(
    buildVersionContentFromDefinition(createInternalDraft()),
    1
  );
  assert.equal(sameSemantic, fp1);

  const changed = computeVersionContentFingerprint(
    buildVersionContentFromDefinition(
      createInternalDraft({ name: "Different Name" })
    ),
    1
  );
  assert.notEqual(changed, fp1);
});

test("24) input definition is not mutated", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const before = clonePlain(definition);
  const result = createRootVersion(definition, repo);
  assert.equal(result.ok, true);
  assert.deepEqual(definition, before);
});

test("25) stored snapshot is immutable/copy-safe", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createRootVersion(definition, repo);
  assert.equal(created.ok, true);
  assert.ok(Object.isFrozen(created.value));
  assert.ok(Object.isFrozen(created.value.content));

  const stored = repo.findVersionById({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    versionId: created.value.versionId,
  });
  assert.equal(stored.ok, true);
  assert.ok(Object.isFrozen(stored.value));
  assert.ok(Object.isFrozen(stored.value.content));

  const mutableClone = clonePlain(stored.value);
  mutableClone.content.name = "Mutated after read";
  const again = repo.findVersionById({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    versionId: created.value.versionId,
  });
  assert.equal(again.value.content.name, "Summer Open");
});

test("26) explicit templateId/templateVersion captured", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createRootVersion(definition, repo, {
    templateVersioned: {
      templateId: "cm-global-internal-tournament",
      templateVersion: 1,
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.content.templateVersioned, {
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
  });
});

test("27) CM-01 revision remains unchanged after create version", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const revisionBefore = definition.revision;
  const result = createRootVersion(definition, repo);
  assert.equal(result.ok, true);
  assert.equal(definition.revision, revisionBefore);
});

test("28) version lookup success", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createRootVersion(definition, repo);
  assert.equal(created.ok, true);
  const found = getCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    versionId: created.value.versionId,
    repository: repo,
  });
  assert.equal(found.ok, true);
  assert.equal(found.value.versionId, created.value.versionId);
});

test("29) version lookup tenant isolation", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createRootVersion(definition, repo);
  assert.equal(created.ok, true);
  const denied = getCompetitionVersion({
    tenantId: "tenant-other",
    competitionId: "comp-1",
    versionId: created.value.versionId,
    repository: repo,
  });
  assert.equal(denied.ok, false);
  assert.ok(hasError(denied, COMPETITION_VERSION_ERROR_CODE.VERSION_NOT_FOUND));
});

test("30) version lookup competition isolation", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createRootVersion(definition, repo);
  assert.equal(created.ok, true);
  const denied = getCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-other",
    versionId: created.value.versionId,
    repository: repo,
  });
  assert.equal(denied.ok, false);
  assert.ok(hasError(denied, COMPETITION_VERSION_ERROR_CODE.VERSION_NOT_FOUND));
});

test("31) version list stable ordering", () => {
  const repo = createRepo();
  let definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const u1 = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Rev 2",
    updatedAt: NOW,
  });
  definition = u1.value;
  const v2 = createNextVersion(definition, repo, v1.value);
  assert.equal(v2.ok, true);

  const listed = listCompetitionVersions({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(listed.ok, true);
  assert.deepEqual(
    listed.value.map((v) => v.versionNumber),
    [1, 2]
  );
});

test("32) empty version list", () => {
  const repo = createRepo();
  const listed = listCompetitionVersions({
    tenantId: "tenant-1",
    competitionId: "comp-empty",
    repository: repo,
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.value.length, 0);
});

test("33) compare equal versions", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createRootVersion(definition, repo);
  assert.equal(created.ok, true);
  const cmp = compareCompetitionVersionsCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    leftVersionId: created.value.versionId,
    rightVersionId: created.value.versionId,
    repository: repo,
  });
  assert.equal(cmp.ok, true);
  assert.equal(cmp.value.equal, true);
  assert.equal(cmp.value.differences.length, 0);
});

test("34) compare changed scalar field", () => {
  const repo = createRepo();
  let definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const updated = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Renamed Competition",
    updatedAt: NOW,
  });
  definition = updated.value;
  const v2 = createNextVersion(definition, repo, v1.value);
  assert.equal(v2.ok, true);

  const cmp = compareCompetitionVersionsCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    leftVersionId: v1.value.versionId,
    rightVersionId: v2.value.versionId,
    repository: repo,
  });
  assert.equal(cmp.ok, true);
  assert.equal(cmp.value.equal, false);
  assert.ok(
    cmp.value.contentDifferences.some(
      (d) =>
        d.path.includes("name") &&
        d.changeType === COMPETITION_VERSION_CHANGE_TYPE.CHANGED
    )
  );
});

test("35) compare added/removed reference", () => {
  const repo = createRepo();
  let definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const updated = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    venues: [{ venueId: "venue-1" }, { venueId: "venue-2" }],
    updatedAt: NOW,
  });
  assert.equal(updated.ok, true);
  definition = updated.value;
  const v2 = createNextVersion(definition, repo, v1.value);
  assert.equal(v2.ok, true);

  const cmp = compareCompetitionVersionsCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    leftVersionId: v1.value.versionId,
    rightVersionId: v2.value.versionId,
    repository: repo,
  });
  assert.equal(cmp.ok, true);
  assert.ok(
    cmp.value.contentDifferences.some(
      (d) => d.changeType === COMPETITION_VERSION_CHANGE_TYPE.ADDED
    )
  );
});

test("36) deterministic difference ordering", () => {
  const repo = createRepo();
  let definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const updated = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Z Last",
    description: "A First",
    updatedAt: NOW,
  });
  definition = updated.value;
  const v2 = createNextVersion(definition, repo, v1.value);
  assert.equal(v2.ok, true);

  const cmp = compareCompetitionVersionsCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    leftVersionId: v1.value.versionId,
    rightVersionId: v2.value.versionId,
    repository: repo,
  });
  assert.equal(cmp.ok, true);
  const paths = cmp.value.differences.map((d) => d.path);
  const sorted = sortVersionDifferences(cmp.value.differences).map((d) => d.path);
  assert.deepEqual(paths, sorted);
  for (let i = 1; i < paths.length; i += 1) {
    assert.ok(paths[i - 1].localeCompare(paths[i], "en") <= 0);
  }
});

test("37) cross-tenant compare rejection", () => {
  const repo = createRepo();
  const defT1 = createInternalDraft({ competitionId: "comp-cmp" });
  const defT2 = createInternalDraft({
    tenantId: "tenant-2",
    competitionId: "comp-cmp",
  });
  const left = createRootVersion(defT1, repo);
  const right = createRootVersion(defT2, repo);
  assert.equal(left.ok, true);
  assert.equal(right.ok, true);

  const cmp = compareCompetitionVersions({
    tenantId: "tenant-1",
    left: left.value,
    right: right.value,
  });
  assert.equal(cmp.ok, false);
  assert.ok(hasError(cmp, COMPETITION_VERSION_ERROR_CODE.CROSS_TENANT_DENIED));
});

test("38) cross-competition compare rejection", () => {
  const repo = createRepo();
  const defA = createInternalDraft({ competitionId: "comp-x" });
  const defB = createInternalDraft({ competitionId: "comp-y" });
  const left = createRootVersion(defA, repo);
  const right = createRootVersion(defB, repo);
  assert.equal(left.ok, true);
  assert.equal(right.ok, true);

  const cmp = compareCompetitionVersions({
    tenantId: "tenant-1",
    left: left.value,
    right: right.value,
  });
  assert.equal(cmp.ok, false);
  assert.ok(
    hasError(cmp, COMPETITION_VERSION_ERROR_CODE.CROSS_COMPETITION_COMPARE)
  );
});

test("39) restore proposal success", () => {
  const repo = createRepo();
  let definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const updated = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Drifted Name",
    updatedAt: NOW,
  });
  definition = updated.value;

  const proposal = createCompetitionRestoreProposalCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    sourceVersionId: v1.value.versionId,
    targetDefinition: definition,
    expectedTargetDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(proposal.ok, true);
  assert.equal(proposal.value.proposedReplacementFields.name, "Summer Open");
  assert.ok(proposal.value.fieldDifferences.length > 0);
});

test("40) restore proposal does not mutate target", () => {
  const repo = createRepo();
  let definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const updated = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Drifted Name",
    updatedAt: NOW,
  });
  definition = updated.value;
  const before = clonePlain(definition);

  const proposal = createCompetitionRestoreProposalCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    sourceVersionId: v1.value.versionId,
    targetDefinition: definition,
    expectedTargetDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(proposal.ok, true);
  assert.deepEqual(definition, before);
  void proposal;
});

test("41) restore proposal preserves immutable identity", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const target = createInternalDraft({
    owner: { ownerId: "user-other", ownerType: COMPETITION_OWNER_TYPE.USER },
    name: "Drifted Name",
  });
  const proposal = createCompetitionRestoreProposalCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    sourceVersionId: v1.value.versionId,
    targetDefinition: target,
    expectedTargetDefinitionRevision: target.revision,
    repository: repo,
  });
  assert.equal(proposal.ok, false);
  assert.ok(
    hasError(
      proposal,
      COMPETITION_VERSION_ERROR_CODE.IMMUTABLE_IDENTITY_RESTORE_CONFLICT
    )
  );
});

test("42) restore proposal rejects stale target revision", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const proposal = createCompetitionRestoreProposalCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    sourceVersionId: v1.value.versionId,
    targetDefinition: definition,
    expectedTargetDefinitionRevision: 99,
    repository: repo,
  });
  assert.equal(proposal.ok, false);
  assert.ok(
    hasError(proposal, COMPETITION_VERSION_ERROR_CODE.STALE_DEFINITION_REVISION)
  );
});

test("43) restore proposal does not execute persistence/runtime recovery (flags false)", () => {
  const repo = createRepo();
  let definition = createInternalDraft();
  const v1 = createRootVersion(definition, repo);
  assert.equal(v1.ok, true);

  const updated = updateDraftCompetitionDefinition(definition, {
    competitionId: definition.competitionId,
    tenantId: definition.tenantId,
    name: "Drifted Name",
    updatedAt: NOW,
  });
  definition = updated.value;

  const proposal = createCompetitionRestoreProposalCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    sourceVersionId: v1.value.versionId,
    targetDefinition: definition,
    expectedTargetDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(proposal.ok, true);
  assert.equal(proposal.value.executesPersistence, false);
  assert.equal(proposal.value.executesRuntimeRecovery, false);
  assert.equal(proposal.value.mutatesTarget, false);
  assert.equal(proposal.value.publishes, false);
});

test("44-46) no publication/audit/replay ownership", () => {
  assert.equal(COMPETITION_VERSIONING_PHASE.ownsPublicationStates, false);
  assert.equal(COMPETITION_VERSIONING_PHASE.ownsAuditPersistence, false);
  assert.equal(COMPETITION_VERSIONING_PHASE.ownsReplayOrRecoveryCheckpoints, false);

  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createRootVersion(definition, repo);
  assert.equal(created.ok, true);
  assert.equal(created.value.state, COMPETITION_VERSION_STATE.FROZEN);
  assert.ok(
    created.explanation.reasons.some((r) => String(r).includes("noPublicationOwnership=true"))
  );
  assert.ok(
    created.explanation.reasons.some((r) => String(r).includes("noAuditPersistence=true"))
  );
  assert.ok(
    created.explanation.reasons.some((r) =>
      String(r).includes("noReplayOrRecoveryCheckpoint=true")
    )
  );
});

test("47) typed error stability (Object.values COMPETITION_VERSION_ERROR_CODE all start with CM03_)", () => {
  for (const code of Object.values(COMPETITION_VERSION_ERROR_CODE)) {
    assert.ok(
      String(code).startsWith("CM03_"),
      `expected CM03_ prefix for ${code}`
    );
  }
  const err = new CompetitionVersionError(
    COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT,
    "x"
  );
  assert.equal(err.code, "CM03_INVALID_CONTRACT");
});

test("48) capability-local public exports + root barrel exports COMPETITION_VERSIONING_PHASE", () => {
  const required = [
    "COMPETITION_VERSIONING_PHASE",
    "COMPETITION_VERSION_ERROR_CODE",
    "CompetitionVersionError",
    "createCompetitionVersion",
    "getCompetitionVersion",
    "listCompetitionVersions",
    "compareCompetitionVersionsCommand",
    "createCompetitionRestoreProposalCommand",
    "createInMemoryCompetitionVersionRepository",
    "createUnimplementedCompetitionVersionRepositoryPort",
    "compareCompetitionVersions",
    "createCompetitionRestoreProposal",
  ];
  for (const name of required) {
    assert.ok(name in cm03, `missing export: ${name}`);
    assert.ok(name in cmRoot, `missing root export: ${name}`);
  }
  assert.equal(COMPETITION_VERSIONING_PHASE.id, "CM-03");
  assert.equal(cmRoot.COMPETITION_VERSIONING_PHASE.id, "CM-03");
});

test("49) CM-01 regression: createDraft still works", () => {
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
  assert.equal(created.value.status, COMPETITION_DEFINITION_STATUS.DRAFT);
});

test("50) CM-02 regression: COMPETITION_TEMPLATE_INSTANTIATION_PHASE still on root barrel", () => {
  assert.equal(cmRoot.COMPETITION_TEMPLATE_INSTANTIATION_PHASE.id, "CM-02");
  assert.equal(
    COMPETITION_TEMPLATE_INSTANTIATION_PHASE.wiredToProductionRuntime,
    false
  );
  const definition = createInternalDraft();
  const selected = selectCompetitionTemplate({
    tenantId: "tenant-1",
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: definition.revision,
  });
  assert.equal(selected.ok, true);
  assert.equal(
    selected.value.reference.templateId,
    "cm-global-internal-tournament"
  );
});

test("51) no runtime/database write (phase flags)", () => {
  assert.equal(COMPETITION_VERSIONING_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMPETITION_VERSIONING_PHASE.hasPersistence, false);
  assert.equal(COMPETITION_VERSIONING_PHASE.repositoryMode, "capability-local-in-memory");
});

test("52) deterministic output across repeated runs", () => {
  const definition = createInternalDraft({ competitionId: "comp-det" });
  const repoA = createRepo();
  const repoB = createRepo();
  const a = createRootVersion(definition, repoA);
  const b = createRootVersion(definition, repoB);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.versionId, b.value.versionId);
  assert.equal(a.value.contentFingerprint, b.value.contentFingerprint);
});

test("53) ARCHITECTURE.md exists", () => {
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "ARCHITECTURE.md")));
});

test("54) unimplemented production port throws CM03_PORT_OPERATION_UNIMPLEMENTED", () => {
  const port = createUnimplementedCompetitionVersionRepositoryPort();
  assert.throws(
    () => port.saveVersion(),
    (err) =>
      err instanceof CompetitionVersionError &&
      err.code === COMPETITION_VERSION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
});

test("extra) missing expectedParentVersionId fails with MISSING_EXPECTED_PARENT", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedLatestVersionNumber: 0,
    createdAt: NOW,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(
    hasError(result, COMPETITION_VERSION_ERROR_CODE.MISSING_EXPECTED_PARENT)
  );
});

test("extra) repository required when omitted", () => {
  const definition = createInternalDraft();
  const result = createCompetitionVersion({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: null,
    expectedLatestVersionNumber: 0,
    createdAt: NOW,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_VERSION_ERROR_CODE.INVALID_CONTRACT));
  assert.ok(result.errors.some((e) => e.field === "repository"));
});
