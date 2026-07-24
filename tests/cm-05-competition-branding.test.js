import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as cm05 from "../src/features/competition-management/competition-branding/index.js";
import * as cmRoot from "../src/features/competition-management/index.js";
import {
  COMPETITION_BRANDING_PHASE,
  COMPETITION_BRANDING_STATUS,
  COMPETITION_BRANDING_INITIAL_REVISION,
  COMPETITION_BRANDING_ERROR_CODE,
  COMPETITION_BRAND_ASSET_KIND,
  COMPETITION_BRAND_COLOR_FORMAT,
  COMPETITION_BRAND_SHORT_LABEL_MAX_LENGTH,
  COMPETITION_BRANDING_FINGERPRINT_ALGORITHM,
  createDraftCompetitionBranding,
  updateDraftCompetitionBranding,
  validateCompetitionBrandingCommand,
  compareCompetitionBrandingsCommand,
  projectCompetitionBrandingSnapshotCommand,
  evaluateCompetitionBrandingReadinessCommand,
  getCompetitionBranding,
  createInMemoryCompetitionBrandingRepository,
  createUnimplementedCompetitionBrandingRepositoryPort,
  validateCompetitionBrandingInput,
  normalizeBrandColor,
  contrastRatio,
  projectLegacyTournamentToBranding,
  LEGACY_BRANDING_COMPATIBILITY,
  clonePlain,
} from "../src/features/competition-management/competition-branding/index.js";

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
  COMPETITION_DEFINITION_STATUS,
  createDraftCompetitionDefinition,
} from "../src/features/competition-management/competition-definition/index.js";

import { COMPETITION_TEMPLATE_INSTANTIATION_PHASE } from "../src/features/competition-management/template-instantiation/index.js";
import { COMPETITION_VERSIONING_PHASE } from "../src/features/competition-management/competition-versioning/index.js";
import { COMPETITION_CONFIGURATION_PHASE } from "../src/features/competition-management/competition-configuration/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/competition-management/competition-branding"
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
  return createInMemoryCompetitionBrandingRepository();
}

function createEmptyBranding(definition, repo, overrides = {}) {
  return createDraftCompetitionBranding({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    assets: [],
    palette: null,
    repository: repo,
    ...overrides,
  });
}

const ACCESSIBLE_PALETTE = Object.freeze({
  primary: "#0F766E",
  secondary: "#134E4A",
  accent: "#F59E0B",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  textPrimary: "#0F172A",
  textSecondary: "#334155",
  border: "#CBD5E1",
});

const LOW_CONTRAST_PALETTE = Object.freeze({
  primary: "#0F766E",
  secondary: "#134E4A",
  accent: "#F59E0B",
  background: "#FFFFFF",
  surface: "#FFFFFF",
  textPrimary: "#EEEEEE",
});

function primaryLogo(tenantId = "tenant-1") {
  return {
    kind: COMPETITION_BRAND_ASSET_KIND.PRIMARY_LOGO,
    assetId: "asset-logo-1",
    tenantId,
    ownershipScope: "tenant",
    accessClassification: "public",
    objectKey: "competitions/comp-1/logo.png",
    mimeType: "image/png",
    width: 256,
    height: 256,
    altText: "Summer Open logo",
    contentHash: "abcdef0123456789",
    assetRevision: 1,
  };
}

test("1) valid empty branding draft", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createEmptyBranding(definition, repo);
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.revision, COMPETITION_BRANDING_INITIAL_REVISION);
  assert.equal(result.value.status, COMPETITION_BRANDING_STATUS.DRAFT);
  assert.deepEqual(result.value.assets, []);
  assert.equal(result.value.palette, null);
  assert.ok(Object.isFrozen(result.value));
});

test("2) valid populated branding", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionBranding({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    assets: [primaryLogo()],
    palette: ACCESSIBLE_PALETTE,
    typography: { tokenId: "brand.display", fallbackSemantics: "platform_default" },
    presentation: {
      shortLabel: "Summer",
      tagline: "Play with pride",
      lockupVariant: "logo_wordmark",
      themeModePreference: "light",
    },
    repository: repo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.assets[0].kind, "PRIMARY_LOGO");
  assert.equal(result.value.palette.primary, "#0F766E");
  assert.equal(result.value.presentation.shortLabel, "Summer");
  assert.equal(result.value.typography.tokenId, "brand.display");
});

test("3) missing tenantId", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionBranding({
    tenantId: undefined,
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT));
});

test("4) missing competitionId", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_BRANDING_ERROR_CODE.MISSING_COMPETITION));
});

test("5) tenant mismatch with definition", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionBranding({
    tenantId: "tenant-other",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_BRANDING_ERROR_CODE.TENANT_MISMATCH));
});

test("6) competition mismatch with definition", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-other",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_BRANDING_ERROR_CODE.COMPETITION_MISMATCH));
});

test("7) non-draft definition rejection", () => {
  const repo = createRepo();
  const definition = {
    ...createInternalDraft(),
    status: COMPETITION_DEFINITION_STATUS.PUBLISHED,
  };
  const result = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_BRANDING_ERROR_CODE.NON_EDITABLE_DEFINITION));
});

test("8) expected definition revision success", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createEmptyBranding(definition, repo);
  assert.equal(result.ok, true);
  assert.equal(result.value.sourceDefinitionRevision, 1);
});

test("9) stale definition revision rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 99,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_BRANDING_ERROR_CODE.STALE_DEFINITION_REVISION));
});

test("10) initial branding revision = 1", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createEmptyBranding(definition, repo);
  assert.equal(result.value.revision, 1);
});

test("11) successful update increments revision", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyBranding(definition, repo);
  assert.equal(created.ok, true);
  const updated = updateDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedBrandingRevision: 1,
    presentation: { shortLabel: "SO" },
    repository: repo,
  });
  assert.equal(updated.ok, true, updated.ok ? "" : updated.explanation?.summary);
  assert.equal(updated.value.revision, 2);
  assert.equal(updated.value.presentation.shortLabel, "SO");
});

test("12) stale branding revision rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  createEmptyBranding(definition, repo);
  const updated = updateDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedBrandingRevision: 9,
    presentation: { shortLabel: "X" },
    repository: repo,
  });
  assert.equal(updated.ok, false);
  assert.ok(hasError(updated, COMPETITION_BRANDING_ERROR_CODE.STALE_BRANDING_REVISION));
});

test("13) immutable tenant protection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  createEmptyBranding(definition, repo);
  const updated = updateDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedBrandingRevision: 1,
    newTenantId: "tenant-hack",
    presentation: { shortLabel: "X" },
    repository: repo,
  });
  assert.equal(updated.ok, false);
  assert.ok(hasError(updated, COMPETITION_BRANDING_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE));
});

test("14) immutable competitionId protection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  createEmptyBranding(definition, repo);
  const updated = updateDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedBrandingRevision: 1,
    newCompetitionId: "comp-hack",
    presentation: { shortLabel: "X" },
    repository: repo,
  });
  assert.equal(updated.ok, false);
  assert.ok(hasError(updated, COMPETITION_BRANDING_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE));
});

test("15) duplicate branding rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  assert.equal(createEmptyBranding(definition, repo).ok, true);
  const dup = createEmptyBranding(definition, repo);
  assert.equal(dup.ok, false);
  assert.ok(hasError(dup, COMPETITION_BRANDING_ERROR_CODE.DUPLICATE_BRANDING));
});

test("16) valid primary logo reference", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [primaryLogo()],
    palette: null,
    presentation: {},
  });
  assert.equal(validated.ok, true, validated.ok ? "" : validated.explanation?.summary);
});

test("17) missing asset identity", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [
      {
        kind: "PRIMARY_LOGO",
        tenantId: "tenant-1",
        ownershipScope: "tenant",
        altText: "Logo",
      },
    ],
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.MISSING_ASSET_IDENTITY));
});

test("18) asset tenant mismatch", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [primaryLogo("tenant-other")],
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.ASSET_OWNERSHIP_MISMATCH));
});

test("19) unsafe javascript URI rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [
      {
        ...primaryLogo(),
        referenceUri: "javascript:alert(1)",
      },
    ],
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI));
});

test("20) unsafe data URI rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [
      {
        ...primaryLogo(),
        referenceUri: "data:image/png;base64,aaaa",
      },
    ],
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI));
});

test("21) local file path rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [
      {
        ...primaryLogo(),
        referenceUri: "C:\\Users\\me\\logo.png",
      },
    ],
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI));
});

test("22) signed URL/token canonical rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [
      {
        ...primaryLogo(),
        referenceUri:
          "https://cdn.example.com/logo.png?X-Amz-Signature=abc&token=secret",
      },
    ],
  });
  assert.equal(validated.ok, false);
  assert.ok(
    hasError(
      validated,
      COMPETITION_BRANDING_ERROR_CODE.SIGNED_OR_PRIVATE_ASSET_NOT_PUBLIC_SAFE
    )
  );
});

test("23) duplicate asset kind rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [
      primaryLogo(),
      { ...primaryLogo(), assetId: "asset-logo-2" },
    ],
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.DUPLICATE_ASSET_KIND));
});

test("24) unsupported asset kind rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [
      {
        ...primaryLogo(),
        kind: "SPONSOR_MARK",
      },
    ],
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.UNSUPPORTED_ASSET_KIND));
});

test("25) valid canonical color", () => {
  assert.equal(normalizeBrandColor("#0f766e"), "#0F766E");
  assert.equal(COMPETITION_BRAND_COLOR_FORMAT.supportsAlpha, false);
});

test("26) malformed color rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    palette: { ...ACCESSIBLE_PALETTE, primary: "#XYZ" },
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.INVALID_COLOR));
});

test("27) CSS injection color rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    palette: { ...ACCESSIBLE_PALETTE, primary: "var(--brand)" },
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.INVALID_COLOR));
});

test("28) deterministic color normalization", () => {
  assert.equal(normalizeBrandColor("  #a1b2c3  "), "#A1B2C3");
  assert.equal(normalizeBrandColor("#A1B2C3"), "#A1B2C3");
});

test("29) valid complete palette", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    palette: ACCESSIBLE_PALETTE,
  });
  assert.equal(validated.ok, true, validated.ok ? "" : validated.explanation?.summary);
});

test("30) incomplete required palette issue", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    palette: { primary: "#0F766E" },
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.INCOMPLETE_PALETTE));
});

test("31) accessible contrast pass", () => {
  const ratio = contrastRatio("#0F172A", "#FFFFFF");
  assert.ok(ratio > 4.5);
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    palette: ACCESSIBLE_PALETTE,
  });
  assert.equal(validated.ok, true);
  assert.equal(validated.value.accessibility.passed, true);
});

test("32) contrast failure", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    palette: LOW_CONTRAST_PALETTE,
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.CONTRAST_FAILURE));
});

test("33) no automatic color repair", () => {
  const before = clonePlain(LOW_CONTRAST_PALETTE);
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    palette: LOW_CONTRAST_PALETTE,
  });
  assert.equal(validated.ok, false);
  assert.deepEqual(LOW_CONTRAST_PALETTE, before);
});

test("34) required alt text success", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [primaryLogo()],
  });
  assert.equal(validated.ok, true);
});

test("35) missing alt text rejection", () => {
  const logo = { ...primaryLogo() };
  delete logo.altText;
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    assets: [logo],
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.MISSING_ALT_TEXT));
});

test("36) valid typography reference", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    typography: "brand.sans",
  });
  assert.equal(validated.ok, true);
  assert.equal(validated.value.typography.tokenId, "brand.sans");
});

test("37) unsafe/arbitrary CSS typography rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    typography: { tokenId: "x", css: "font-family: Arial", url: "url(x)" },
  });
  assert.equal(validated.ok, false);
  assert.ok(
    hasError(validated, COMPETITION_BRANDING_ERROR_CODE.INVALID_TYPOGRAPHY_REFERENCE)
  );
});

test("38) valid short label", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    presentation: { shortLabel: "Open 2026" },
  });
  assert.equal(validated.ok, true);
  assert.equal(validated.value.presentation.shortLabel, "Open 2026");
});

test("39) over-length short label rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    presentation: {
      shortLabel: "x".repeat(COMPETITION_BRAND_SHORT_LABEL_MAX_LENGTH + 1),
    },
  });
  assert.equal(validated.ok, false);
  assert.ok(
    hasError(validated, COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA)
  );
});

test("40) control character rejection", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    presentation: { shortLabel: "Bad\u0000Label" },
  });
  assert.equal(validated.ok, false);
  assert.ok(
    hasError(validated, COMPETITION_BRANDING_ERROR_CODE.INVALID_PRESENTATION_METADATA)
  );
});

test("41) canonical name remains unchanged", () => {
  const definition = createInternalDraft();
  const nameBefore = definition.name;
  const repo = createRepo();
  createDraftCompetitionBranding({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    presentation: { shortLabel: "SO" },
    repository: repo,
  });
  assert.equal(definition.name, nameBefore);
  const smuggle = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    name: "Hacked",
  });
  assert.equal(smuggle.ok, false);
  assert.ok(hasError(smuggle, COMPETITION_BRANDING_ERROR_CODE.CANONICAL_NAME_OWNERSHIP));
});

test("42) canonical description remains unchanged", () => {
  const definition = createInternalDraft();
  const descBefore = definition.description;
  const repo = createRepo();
  createEmptyBranding(definition, repo);
  assert.equal(definition.description, descBefore);
});

test("43) sponsor marks deferred (not applicable as owned feature)", () => {
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    sponsorMarks: [{ id: "s1", name: "Acme" }],
  });
  assert.equal(validated.ok, false);
  assert.ok(hasError(validated, COMPETITION_BRANDING_ERROR_CODE.SPONSOR_MARKS_DEFERRED));
  assert.equal(COMPETITION_BRANDING_PHASE.sponsorMarksDeferred, true);
});

test("44) duplicate sponsor mark rejection N/A — deferred ownership", () => {
  // Contract decision: sponsor marks deferred; duplicate path covered by SPONSOR_MARKS_DEFERRED.
  assert.equal(COMPETITION_BRANDING_PHASE.sponsorMarksDeferred, true);
});

test("45) sponsor commercial ownership not inferred", () => {
  assert.equal(COMPETITION_BRANDING_PHASE.sponsorMarksDeferred, true);
  const validated = validateCompetitionBrandingInput({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    revision: 1,
    status: "draft",
    sourceDefinitionRevision: 1,
    sponsorMarks: [],
  });
  assert.equal(validated.ok, true);
});

test("46) deterministic create output", () => {
  const definition = createInternalDraft();
  const a = createEmptyBranding(definition, createRepo());
  const b = createEmptyBranding(definition, createRepo());
  assert.deepEqual(a.value, b.value);
});

test("47) deterministic update output", () => {
  const definition = createInternalDraft();
  function run() {
    const repo = createRepo();
    createEmptyBranding(definition, repo);
    return updateDraftCompetitionBranding({
      tenantId: "tenant-1",
      competitionId: "comp-1",
      definition,
      expectedDefinitionRevision: 1,
      expectedBrandingRevision: 1,
      presentation: { shortLabel: "SO", tagline: "Go" },
      repository: repo,
    });
  }
  assert.deepEqual(run().value, run().value);
});

test("48) no mutation on create", () => {
  const definition = createInternalDraft();
  const cmd = {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 1,
    assets: [],
    presentation: { shortLabel: "  Trim Me  " },
  };
  const before = JSON.stringify(cmd);
  createDraftCompetitionBranding({ ...cmd, repository: createRepo() });
  assert.equal(JSON.stringify(cmd), before);
});

test("49) no mutation on update", () => {
  const definition = createInternalDraft();
  const repo = createRepo();
  createEmptyBranding(definition, repo);
  const cmd = {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 1,
    expectedBrandingRevision: 1,
    presentation: { shortLabel: "SO" },
  };
  const before = JSON.stringify(cmd);
  updateDraftCompetitionBranding({ ...cmd, repository: repo });
  assert.equal(JSON.stringify(cmd), before);
});

test("50) readiness complete", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 1,
    assets: [primaryLogo()],
    palette: ACCESSIBLE_PALETTE,
    repository: repo,
  });
  const readiness = evaluateCompetitionBrandingReadinessCommand({
    branding: created.value,
    profile: "publication_facing",
  });
  assert.equal(readiness.ok, true);
  assert.equal(readiness.value.ready, true);
  assert.equal(readiness.value.networkCallsPerformed, 0);
});

test("51) readiness missing required asset", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyBranding(definition, repo);
  const readiness = evaluateCompetitionBrandingReadinessCommand({
    branding: created.value,
    profile: "publication_facing",
  });
  assert.equal(readiness.ok, true);
  assert.equal(readiness.value.ready, false);
  assert.ok(readiness.value.issues.some((i) => i.path.includes("PRIMARY_LOGO")));
});

test("52) readiness deterministic issue ordering", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyBranding(definition, repo);
  const a = evaluateCompetitionBrandingReadinessCommand({
    branding: created.value,
    profile: "publication_facing",
  });
  const b = evaluateCompetitionBrandingReadinessCommand({
    branding: created.value,
    profile: "publication_facing",
  });
  assert.deepEqual(a.value.issues, b.value.issues);
});

test("53) readiness performs no network call", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyBranding(definition, repo);
  const readiness = evaluateCompetitionBrandingReadinessCommand({
    branding: created.value,
  });
  assert.equal(readiness.value.networkCallsPerformed, 0);
  assert.equal(readiness.value.storageChecked, false);
  assert.equal(readiness.value.published, false);
});

test("54) branding compare equal", () => {
  const definition = createInternalDraft();
  const left = createEmptyBranding(definition, createRepo()).value;
  const right = createEmptyBranding(definition, createRepo()).value;
  const cmp = compareCompetitionBrandingsCommand({
    tenantId: "tenant-1",
    left,
    right,
  });
  assert.equal(cmp.ok, true);
  assert.equal(cmp.value.equal, true);
});

test("55) branding compare changed scalar", () => {
  const definition = createInternalDraft();
  const left = createEmptyBranding(definition, createRepo()).value;
  const repo = createRepo();
  createEmptyBranding(definition, repo);
  const right = updateDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 1,
    expectedBrandingRevision: 1,
    presentation: { shortLabel: "SO" },
    repository: repo,
  }).value;
  const cmp = compareCompetitionBrandingsCommand({
    tenantId: "tenant-1",
    left,
    right,
  });
  assert.equal(cmp.ok, true);
  assert.equal(cmp.value.equal, false);
  assert.ok(cmp.value.differences.some((d) => d.path.includes("shortLabel")));
});

test("56) branding compare asset added/removed", () => {
  const definition = createInternalDraft();
  const left = createEmptyBranding(definition, createRepo()).value;
  const right = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 1,
    assets: [primaryLogo()],
    repository: createRepo(),
  }).value;
  const cmp = compareCompetitionBrandingsCommand({
    tenantId: "tenant-1",
    left,
    right,
  });
  assert.equal(cmp.ok, true);
  assert.ok(cmp.value.differences.some((d) => d.changeType === "ADDED"));
});

test("57) deterministic diff ordering", () => {
  const definition = createInternalDraft();
  const left = createEmptyBranding(definition, createRepo()).value;
  const right = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 1,
    assets: [primaryLogo()],
    presentation: { shortLabel: "SO", tagline: "Go" },
    repository: createRepo(),
  }).value;
  const a = compareCompetitionBrandingsCommand({ tenantId: "tenant-1", left, right });
  const b = compareCompetitionBrandingsCommand({ tenantId: "tenant-1", left, right });
  assert.deepEqual(a.value.differences, b.value.differences);
});

test("58) cross-tenant compare rejection", () => {
  const definition = createInternalDraft();
  const left = createEmptyBranding(definition, createRepo()).value;
  const otherDef = createInternalDraft({ tenantId: "tenant-2", competitionId: "comp-2" });
  const right = createEmptyBranding(otherDef, createRepo()).value;
  const cmp = compareCompetitionBrandingsCommand({
    tenantId: "tenant-1",
    left,
    right,
  });
  assert.equal(cmp.ok, false);
  assert.ok(hasError(cmp, COMPETITION_BRANDING_ERROR_CODE.CROSS_TENANT_DENIED));
});

test("59) cross-competition compare rejection", () => {
  const left = createEmptyBranding(createInternalDraft(), createRepo()).value;
  const right = createEmptyBranding(
    createInternalDraft({ competitionId: "comp-2" }),
    createRepo()
  ).value;
  const cmp = compareCompetitionBrandingsCommand({
    tenantId: "tenant-1",
    left,
    right,
  });
  assert.equal(cmp.ok, false);
  assert.ok(hasError(cmp, COMPETITION_BRANDING_ERROR_CODE.CROSS_COMPETITION_COMPARE));
});

test("60) snapshot deterministic", () => {
  const branding = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition: createInternalDraft(),
    expectedDefinitionRevision: 1,
    assets: [primaryLogo()],
    palette: ACCESSIBLE_PALETTE,
    repository: createRepo(),
  }).value;
  const a = projectCompetitionBrandingSnapshotCommand({ branding });
  const b = projectCompetitionBrandingSnapshotCommand({ branding });
  assert.equal(a.value.fingerprint, b.value.fingerprint);
  assert.equal(a.value.fingerprintAlgorithm, COMPETITION_BRANDING_FINGERPRINT_ALGORITHM.id);
});

test("61) snapshot immutable/copy-safe", () => {
  const branding = createEmptyBranding(createInternalDraft(), createRepo()).value;
  const snap = projectCompetitionBrandingSnapshotCommand({ branding });
  assert.ok(Object.isFrozen(snap.value));
  assert.throws(() => {
    snap.value.brandingRevision = 999;
  });
});

test("62) snapshot excludes signed URL tokens from fingerprint", () => {
  // Signed URIs are rejected at validation; fingerprint omits referenceUri.
  const branding = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition: createInternalDraft(),
    expectedDefinitionRevision: 1,
    assets: [
      {
        ...primaryLogo(),
        referenceUri: "https://cdn.example.com/logo.png",
      },
    ],
    repository: createRepo(),
  }).value;
  const brandingNoUri = createDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition: createInternalDraft(),
    expectedDefinitionRevision: 1,
    assets: [primaryLogo()],
    repository: createRepo(),
  }).value;
  const a = projectCompetitionBrandingSnapshotCommand({ branding });
  const b = projectCompetitionBrandingSnapshotCommand({ branding: brandingNoUri });
  assert.equal(a.value.fingerprint, b.value.fingerprint);
});

test("63) snapshot excludes binary/base64", () => {
  const branding = createEmptyBranding(createInternalDraft(), createRepo()).value;
  const snap = projectCompetitionBrandingSnapshotCommand({ branding });
  const json = JSON.stringify(snap.value);
  assert.equal(json.includes("base64"), false);
  assert.equal(json.includes("data:image"), false);
});

test("64) snapshot excludes UI state", () => {
  const branding = createEmptyBranding(createInternalDraft(), createRepo()).value;
  const snap = projectCompetitionBrandingSnapshotCommand({ branding });
  assert.equal(Object.hasOwn(snap.value, "muiTheme"), false);
  assert.equal(Object.hasOwn(snap.value, "cssVariables"), false);
  assert.equal(snap.value.explanation?.includes?.("runtime"), undefined);
});

test("65) repository tenant isolation", () => {
  const repo = createRepo();
  const def1 = createInternalDraft();
  createEmptyBranding(def1, repo);
  const found = getCompetitionBranding({
    tenantId: "tenant-2",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(found.ok, false);
  assert.ok(hasError(found, COMPETITION_BRANDING_ERROR_CODE.BRANDING_NOT_FOUND));
});

test("66) repository competition isolation", () => {
  const repo = createRepo();
  createEmptyBranding(createInternalDraft(), repo);
  const found = getCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-2",
    repository: repo,
  });
  assert.equal(found.ok, false);
  assert.ok(hasError(found, COMPETITION_BRANDING_ERROR_CODE.BRANDING_NOT_FOUND));
});

test("67) repository optimistic concurrency", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  createEmptyBranding(definition, repo);
  const ok = updateDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 1,
    expectedBrandingRevision: 1,
    presentation: { shortLabel: "A" },
    repository: repo,
  });
  assert.equal(ok.ok, true);
  const stale = updateDraftCompetitionBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 1,
    expectedBrandingRevision: 1,
    presentation: { shortLabel: "B" },
    repository: repo,
  });
  assert.equal(stale.ok, false);
  assert.ok(hasError(stale, COMPETITION_BRANDING_ERROR_CODE.STALE_BRANDING_REVISION));
});

test("68) legacy safe partial projection", () => {
  const projected = projectLegacyTournamentToBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: {
      name: "Summer Open",
      branding: {
        colors: { primary: "#0f766e", secondary: "#134e4a", accent: "#f59e0b", background: "#ffffff", surface: "#f8fafc", textPrimary: "#0f172a" },
        tagline: "Play",
      },
      settings: { regulations: { body: "x" } },
    },
  });
  assert.equal(projected.ok, true);
  assert.equal(projected.value.fullSafeMapping, false);
  assert.equal(projected.value.paletteProposal.primary, "#0F766E");
  assert.equal(projected.value.presentationProposal.tagline, "Play");
  assert.ok(
    projected.value.unsupportedFields.some(
      (f) => f.path === "settings.regulations"
    )
  );
});

test("69) legacy ambiguous mapping rejection/issue", () => {
  const projected = projectLegacyTournamentToBranding({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: {
      image: "https://cdn.example.com/x.png?token=abc",
      clubLogo: "https://club.example/logo.png",
    },
  });
  assert.equal(projected.ok, true);
  assert.ok(
    projected.value.issues.some(
      (i) => i.code === COMPETITION_BRANDING_ERROR_CODE.SIGNED_OR_PRIVATE_ASSET_NOT_PUBLIC_SAFE ||
        i.code === COMPETITION_BRANDING_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING
    )
  );
});

test("70) no platform/tenant/venue/club brand inference", () => {
  const branding = createEmptyBranding(createInternalDraft(), createRepo()).value;
  assert.equal(branding.metadata.inferredFromPlatform, false);
  assert.equal(branding.metadata.inferredFromTenant, false);
  assert.equal(branding.metadata.inferredFromVenue, false);
  assert.equal(branding.metadata.inferredFromClub, false);
  assert.equal(LEGACY_BRANDING_COMPATIBILITY.fullSafeMapping, false);
});

test("71) no upload/storage call (port unimplemented)", () => {
  const port = createUnimplementedCompetitionBrandingRepositoryPort();
  assert.throws(() => port.createBranding({}), (err) => {
    assert.equal(err.code, COMPETITION_BRANDING_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED);
    return true;
  });
  assert.equal(COMPETITION_BRANDING_PHASE.ownsUploadStorage, false);
});

test("72) no production/runtime write", () => {
  assert.equal(COMPETITION_BRANDING_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMPETITION_BRANDING_PHASE.hasPersistence, false);
  assert.equal(COMPETITION_BRANDING_PHASE.hasMigration, false);
});

test("73) no publication ownership", () => {
  assert.equal(COMPETITION_BRANDING_PHASE.ownsPublicationStates, false);
  const readiness = evaluateCompetitionBrandingReadinessCommand({
    branding: createEmptyBranding(createInternalDraft(), createRepo()).value,
  });
  assert.equal(readiness.value.published, false);
});

test("74) typed error stability", () => {
  assert.equal(COMPETITION_BRANDING_ERROR_CODE.MISSING_TENANT, "CM05_MISSING_TENANT");
  assert.equal(COMPETITION_BRANDING_ERROR_CODE.CONTRAST_FAILURE, "CM05_CONTRAST_FAILURE");
});

test("75) capability-local public exports", () => {
  assert.equal(cmRoot.COMPETITION_BRANDING_PHASE.id, "CM-05");
  assert.equal(typeof cmRoot.createDraftCompetitionBranding, "function");
  assert.equal(typeof cm05.projectCompetitionBrandingSnapshot, "function");
  assert.equal(COMPETITION_BRANDING_PHASE.ownsBranding, true);
});

test("76) CM-01 regression — definition create still works", () => {
  const definition = createInternalDraft();
  assert.equal(definition.name, "Summer Open");
  assert.equal(definition.revision, 1);
});

test("77) CM-02 regression — phase still dormant", () => {
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.id, "CM-02");
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.wiredToProductionRuntime, false);
});

test("78) CM-03 regression — phase still dormant", () => {
  assert.equal(COMPETITION_VERSIONING_PHASE.id, "CM-03");
  assert.equal(COMPETITION_VERSIONING_PHASE.wiredToProductionRuntime, false);
});

test("79) CM-04 regression — phase still dormant and does not own branding", () => {
  assert.equal(COMPETITION_CONFIGURATION_PHASE.id, "CM-04");
  assert.equal(COMPETITION_CONFIGURATION_PHASE.ownsBranding, false);
  assert.equal(COMPETITION_CONFIGURATION_PHASE.wiredToProductionRuntime, false);
});

test("80) repeated execution produces stable output", () => {
  const definition = createInternalDraft();
  const runs = Array.from({ length: 3 }, () => {
    const repo = createRepo();
    return createDraftCompetitionBranding({
      tenantId: "tenant-1",
      competitionId: "comp-1",
      definition,
      expectedDefinitionRevision: 1,
      assets: [primaryLogo()],
      palette: ACCESSIBLE_PALETTE,
      presentation: { shortLabel: "SO", tagline: "Go" },
      repository: repo,
    }).value;
  });
  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
});

test("module files exist", () => {
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "index.js")));
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "ARCHITECTURE.md")));
});

test("validateCompetitionBrandingCommand wrapper", () => {
  const definition = createInternalDraft();
  const result = validateCompetitionBrandingCommand({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 1,
    branding: {
      revision: 1,
      status: "draft",
      sourceDefinitionRevision: 1,
      assets: [],
    },
  });
  assert.equal(result.ok, true);
});
