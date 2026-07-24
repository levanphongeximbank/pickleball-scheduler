import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as cm06 from "../src/features/competition-management/competition-publication/index.js";
import * as cmRoot from "../src/features/competition-management/index.js";
import {
  COMPETITION_PUBLICATION_PHASE,
  COMPETITION_PUBLICATION_STATUS,
  COMPETITION_PUBLICATION_CHANNEL,
  COMPETITION_PUBLICATION_PROFILE_ID,
  COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE,
  COMPETITION_PUBLICATION_ERROR_CODE,
  COMPETITION_PUBLICATION_INITIAL_REVISION,
  COMPETITION_PUBLICATION_MANIFEST_SCHEMA_VERSION,
  COMPETITION_PUBLICATION_FINGERPRINT_ALGORITHM,
  COMPETITION_PUBLICATION_SEVERITY,
  COMPETITION_PUBLICATION_INTENT_TYPE,
  publishCompetitionPublication,
  republishCompetitionPublication,
  getCompetitionPublicationById,
  getCurrentCompetitionPublication,
  listCompetitionPublicationsCommand,
  evaluateCompetitionPublicationReadinessCommand,
  evaluateCompetitionPublicationReadiness,
  buildCompetitionPublicationManifest,
  buildCompetitionPublicationPlan,
  createInMemoryCompetitionPublicationRepository,
  projectLegacyTournamentPublicationObservation,
  LEGACY_PUBLICATION_COMPATIBILITY,
  validateSlug,
  clonePlain,
  deepFreeze,
  buildSourceReferences,
  getCompetitionPublicationProfile,
  getCompetitionPublicationChannelDescriptor,
} from "../src/features/competition-management/competition-publication/index.js";

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
  createCompetitionVersion,
  createInMemoryCompetitionVersionRepository,
  COMPETITION_VERSIONING_PHASE,
} from "../src/features/competition-management/competition-versioning/index.js";

import {
  createDraftCompetitionConfiguration,
  createInMemoryCompetitionConfigurationRepository,
  COMPETITION_CONFIGURATION_PHASE,
} from "../src/features/competition-management/competition-configuration/index.js";

import {
  createDraftCompetitionBranding,
  createInMemoryCompetitionBrandingRepository,
  COMPETITION_BRAND_ASSET_KIND,
  COMPETITION_BRANDING_PHASE,
  COMPETITION_BRANDING_ERROR_CODE,
  evaluateCompetitionBrandingReadiness,
} from "../src/features/competition-management/competition-branding/index.js";

import { COMPETITION_TEMPLATE_INSTANTIATION_PHASE } from "../src/features/competition-management/template-instantiation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/competition-management/competition-publication"
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
    visibility: COMPETITION_VISIBILITY.PUBLIC,
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

function createVersion(definition, versionRepo, overrides = {}) {
  const result = createCompetitionVersion({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedParentVersionId: null,
    expectedLatestVersionNumber: 0,
    createdAt: NOW,
    repository: versionRepo,
    ...overrides,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  return result.value;
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

function primaryLogo(overrides = {}) {
  return {
    kind: COMPETITION_BRAND_ASSET_KIND.PRIMARY_LOGO,
    assetId: "asset-logo-1",
    tenantId: "tenant-1",
    ownershipScope: "tenant",
    accessClassification: "public",
    objectKey: "competitions/comp-1/logo.png",
    mimeType: "image/png",
    width: 256,
    height: 256,
    altText: "Summer Open logo",
    contentHash: "abcdef0123456789",
    assetRevision: 1,
    ...overrides,
  };
}

function createReadyBranding(definition, brandingRepo, overrides = {}) {
  const result = createDraftCompetitionBranding({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    assets: [primaryLogo({ tenantId: definition.tenantId })],
    palette: ACCESSIBLE_PALETTE,
    repository: brandingRepo,
    ...overrides,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  return result.value;
}

function createEmptyBranding(definition, brandingRepo) {
  const result = createDraftCompetitionBranding({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    assets: [],
    palette: null,
    repository: brandingRepo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  return result.value;
}

function createReadyConfiguration(definition, configRepo, overrides = {}) {
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {},
    repository: configRepo,
    ...overrides,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  return result.value;
}

function createPublishBase(overrides = {}) {
  const definition = createInternalDraft(overrides.definitionOverrides);
  const versionRepo = createInMemoryCompetitionVersionRepository();
  const version = createVersion(definition, versionRepo);
  const brandingRepo = createInMemoryCompetitionBrandingRepository();
  const branding = createReadyBranding(definition, brandingRepo);
  const pubRepo = createInMemoryCompetitionPublicationRepository();
  return { definition, versionRepo, version, brandingRepo, branding, pubRepo };
}

function basePublishCommand(base, overrides = {}) {
  return {
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    channel: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL,
    profileId: COMPETITION_PUBLICATION_PROFILE_ID.CM06_STANDARD_V1,
    competitionVersion: base.version,
    expectedSourceVersionId: base.version.versionId,
    expectedSourceVersionNumber: base.version.versionNumber,
    definition: base.definition,
    expectedDefinitionRevision: base.definition.revision,
    configurationPresence: COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.ABSENT,
    configuration: null,
    expectedConfigurationRevision: null,
    branding: base.branding,
    expectedBrandingRevision: base.branding.revision,
    idempotencyKey: "pub-1",
    expectedCurrentPublicationRevision: 0,
    repository: base.pubRepo,
    ...overrides,
  };
}

function readinessCommand(base, overrides = {}) {
  return {
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    channel: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL,
    profileId: COMPETITION_PUBLICATION_PROFILE_ID.CM06_STANDARD_V1,
    competitionVersion: base.version,
    expectedSourceVersionId: base.version.versionId,
    expectedSourceVersionNumber: base.version.versionNumber,
    definition: base.definition,
    expectedDefinitionRevision: base.definition.revision,
    configurationPresence: COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.ABSENT,
    configuration: null,
    expectedConfigurationRevision: null,
    branding: base.branding,
    expectedBrandingRevision: base.branding.revision,
    ...overrides,
  };
}

/** Bumps the CM-01 definition, mints a new CM-03 version, and returns a ready-to-send republish command. */
function createRepublishScenario(base, overrides = {}) {
  const updated = updateDraftCompetitionDefinition(base.definition, {
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    name: "Summer Open v2",
    updatedAt: NOW,
  });
  assert.equal(updated.ok, true, updated.ok ? "" : updated.explanation?.summary);
  const definition2 = updated.value;

  const version2 = createVersion(definition2, base.versionRepo, {
    expectedParentVersionId: base.version.versionId,
    expectedLatestVersionNumber: base.version.versionNumber,
  });

  const command = {
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    channel: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL,
    profileId: COMPETITION_PUBLICATION_PROFILE_ID.CM06_STANDARD_V1,
    competitionVersion: version2,
    expectedSourceVersionId: version2.versionId,
    expectedSourceVersionNumber: version2.versionNumber,
    definition: definition2,
    expectedDefinitionRevision: definition2.revision,
    configurationPresence: COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.ABSENT,
    configuration: null,
    expectedConfigurationRevision: null,
    branding: base.branding,
    expectedBrandingRevision: base.branding.revision,
    idempotencyKey: "pub-2",
    expectedCurrentPublicationRevision: 1,
    repository: base.pubRepo,
    ...overrides,
  };

  return { definition2, version2, command };
}

/** Pure manifest builder used to prove determinism/exclusion properties without going through publish. */
function buildManifestForBase(base, overrides = {}) {
  const channel = overrides.channel || COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL;
  const configurationPresence =
    overrides.configurationPresence || COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.ABSENT;
  const configuration = overrides.configuration ?? null;
  const branding = overrides.branding || base.branding;
  const profile = getCompetitionPublicationProfile(COMPETITION_PUBLICATION_PROFILE_ID.CM06_STANDARD_V1);
  const channelDescriptor = getCompetitionPublicationChannelDescriptor(channel);
  const source = buildSourceReferences({
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    competitionVersion: base.version,
    configurationPresence,
    configuration,
    branding,
  });
  return buildCompetitionPublicationManifest({
    publicationId: overrides.publicationId || "cpub::tenant-1::comp-1::PUBLIC_PORTAL::1",
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    channel,
    revision: overrides.revision || 1,
    profileId: profile.id,
    profileVersion: profile.version,
    source,
    competitionVersion: base.version,
    configurationPresence,
    configuration,
    branding,
    channelDescriptor,
    publicReference: overrides.publicReference || null,
    clock: overrides.clock,
  });
}

// ---------------------------------------------------------------------------
// 1-13: source (CM-01 definition / CM-03 version) structural gates
// ---------------------------------------------------------------------------

test("1) valid publication source / first publish success", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.publication.status, COMPETITION_PUBLICATION_STATUS.PUBLISHED);
  assert.equal(result.value.publication.revision, 1);
  assert.ok(Object.isFrozen(result.value.publication));
});

test("2) missing tenantId", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base, { tenantId: undefined }));
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT));
});

test("3) missing competitionId", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base, { competitionId: "" }));
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.MISSING_COMPETITION));
});

test("4) tenant mismatch (definition vs command)", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base, { tenantId: "tenant-other" }));
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.TENANT_MISMATCH));
});

test("5) competition mismatch (definition vs command)", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { competitionId: "comp-other" })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.COMPETITION_MISMATCH));
});

test("6) invalid definition rejection", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { definition: { foo: "bar" } })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.INVALID_DEFINITION));
});

test("7) expected definition revision success", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.publication.source.sourceDefinitionRevision, base.definition.revision);
});

test("8) stale definition revision rejection", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { expectedDefinitionRevision: 99 })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.STALE_DEFINITION_REVISION));
});

test("9) source CompetitionVersion required (missing version)", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { competitionVersion: null })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.INVALID_COMPETITION_VERSION));
});

test("10) source version tenant mismatch", () => {
  const base = createPublishBase();
  const tamperedVersion = { ...clonePlain(base.version), tenantId: "tenant-other" };
  const result = publishCompetitionPublication(
    basePublishCommand(base, { competitionVersion: tamperedVersion })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.TENANT_MISMATCH));
});

test("11) source version competition mismatch", () => {
  const base = createPublishBase();
  const tamperedVersion = { ...clonePlain(base.version), competitionId: "comp-other" };
  const result = publishCompetitionPublication(
    basePublishCommand(base, { competitionVersion: tamperedVersion })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.COMPETITION_MISMATCH));
});

test("12) source definition revision mismatch", () => {
  const base = createPublishBase();
  const tamperedVersion = {
    ...clonePlain(base.version),
    sourceDefinitionRevision: base.definition.revision + 1,
  };
  const result = publishCompetitionPublication(
    basePublishCommand(base, { competitionVersion: tamperedVersion })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.STALE_DEFINITION_REVISION));
});

test("13) no implicit latest-version fallback", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { expectedSourceVersionId: null, expectedSourceVersionNumber: null })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.VERSION_SOURCE_MISMATCH));
});

// ---------------------------------------------------------------------------
// 14-18: CM-04 configuration (optional, explicit presence)
// ---------------------------------------------------------------------------

test("14) valid configuration snapshot PRESENT", () => {
  const base = createPublishBase();
  const configRepo = createInMemoryCompetitionConfigurationRepository();
  const config = createReadyConfiguration(base.definition, configRepo);
  const result = publishCompetitionPublication(
    basePublishCommand(base, {
      configurationPresence: COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.PRESENT,
      configuration: config,
      expectedConfigurationRevision: config.revision,
    })
  );
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.publication.source.sourceConfigurationRevision, config.revision);
  assert.ok(result.value.manifest.configuration);
});

test("15) configuration tenant mismatch", () => {
  const base = createPublishBase();
  const configRepo = createInMemoryCompetitionConfigurationRepository();
  const config = createReadyConfiguration(base.definition, configRepo);
  const tampered = { ...clonePlain(config), tenantId: "tenant-other" };
  const result = publishCompetitionPublication(
    basePublishCommand(base, {
      configurationPresence: COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.PRESENT,
      configuration: tampered,
      expectedConfigurationRevision: tampered.revision,
    })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.TENANT_MISMATCH));
});

test("16) configuration competition mismatch", () => {
  const base = createPublishBase();
  const configRepo = createInMemoryCompetitionConfigurationRepository();
  const config = createReadyConfiguration(base.definition, configRepo);
  const tampered = { ...clonePlain(config), competitionId: "comp-other" };
  const result = publishCompetitionPublication(
    basePublishCommand(base, {
      configurationPresence: COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.PRESENT,
      configuration: tampered,
      expectedConfigurationRevision: tampered.revision,
    })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.COMPETITION_MISMATCH));
});

test("17) stale configuration revision", () => {
  const base = createPublishBase();
  const configRepo = createInMemoryCompetitionConfigurationRepository();
  const config = createReadyConfiguration(base.definition, configRepo);
  const result = publishCompetitionPublication(
    basePublishCommand(base, {
      configurationPresence: COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.PRESENT,
      configuration: config,
      expectedConfigurationRevision: config.revision + 5,
    })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.STALE_CONFIGURATION_REVISION));
});

test("18) explicit ABSENT when configuration optional", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.publication.source.sourceConfigurationRevision, null);
  assert.equal(result.value.manifest.configuration, null);
});

// ---------------------------------------------------------------------------
// 19-26: CM-05 branding (required for CM06_STANDARD_V1)
// ---------------------------------------------------------------------------

test("19) branding required profile success", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.publication.source.sourceBrandingRevision, base.branding.revision);
  assert.ok(result.value.publication.source.brandingFingerprint);
});

test("20) missing required branding rejection", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { branding: null, expectedBrandingRevision: null })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.MISSING_BRANDING));
});

test("21) branding tenant mismatch", () => {
  const base = createPublishBase();
  const tampered = { ...clonePlain(base.branding), tenantId: "tenant-other" };
  const result = publishCompetitionPublication(
    basePublishCommand(base, { branding: tampered, expectedBrandingRevision: tampered.revision })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.TENANT_MISMATCH));
});

test("22) branding competition mismatch", () => {
  const base = createPublishBase();
  const tampered = { ...clonePlain(base.branding), competitionId: "comp-other" };
  const result = publishCompetitionPublication(
    basePublishCommand(base, { branding: tampered, expectedBrandingRevision: tampered.revision })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.COMPETITION_MISMATCH));
});

test("23) stale branding revision", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { expectedBrandingRevision: base.branding.revision + 5 })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.STALE_BRANDING_REVISION));
});

test("24) branding readiness failure (empty branding / no logo)", () => {
  const base = createPublishBase();
  const emptyBrandingRepo = createInMemoryCompetitionBrandingRepository();
  const emptyBranding = createEmptyBranding(base.definition, emptyBrandingRepo);
  const result = publishCompetitionPublication(
    basePublishCommand(base, {
      branding: emptyBranding,
      expectedBrandingRevision: emptyBranding.revision,
    })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.BRANDING_NOT_READY));
});

test("25) unsafe asset reference rejection at the CM-05 boundary", () => {
  const base = createPublishBase();
  const repo = createInMemoryCompetitionBrandingRepository();
  const attempt = createDraftCompetitionBranding({
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    definition: base.definition,
    expectedDefinitionRevision: base.definition.revision,
    assets: [primaryLogo({ referenceUri: "javascript:alert(1)" })],
    palette: ACCESSIBLE_PALETTE,
    repository: repo,
  });
  assert.equal(attempt.ok, false);
  assert.ok(hasError(attempt, COMPETITION_BRANDING_ERROR_CODE.UNSAFE_ASSET_URI));
});

test("26) signed/private public asset rejection (via CM-06 readiness)", () => {
  const base = createPublishBase();
  const repo = createInMemoryCompetitionBrandingRepository();
  const privateBranding = createReadyBranding(base.definition, repo, {
    assets: [primaryLogo({ accessClassification: "private" })],
  });
  const result = publishCompetitionPublication(
    basePublishCommand(base, {
      branding: privateBranding,
      expectedBrandingRevision: privateBranding.revision,
    })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_BRANDING_ERROR_CODE.SIGNED_OR_PRIVATE_ASSET_NOT_PUBLIC_SAFE));
});

// ---------------------------------------------------------------------------
// 27-32: profile / channel / visibility compatibility
// ---------------------------------------------------------------------------

test("27) valid publication profile", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(result.ok, true);
  assert.equal(result.value.publication.profileId, COMPETITION_PUBLICATION_PROFILE_ID.CM06_STANDARD_V1);
});

test("28) unknown publication profile rejection", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base, { profileId: "NOT_A_PROFILE" }));
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.UNKNOWN_PROFILE));
});

test("29) valid publication channel (SHAREABLE_LINK)", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { channel: COMPETITION_PUBLICATION_CHANNEL.SHAREABLE_LINK })
  );
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.publication.channel, COMPETITION_PUBLICATION_CHANNEL.SHAREABLE_LINK);
});

test("30) unknown publication channel rejection", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base, { channel: "EMAIL_BLAST" }));
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.INVALID_CHANNEL));
});

test("31) visibility/channel compatibility success (SHAREABLE_LINK + club)", () => {
  const base = createPublishBase({ definitionOverrides: { visibility: COMPETITION_VISIBILITY.CLUB } });
  const result = publishCompetitionPublication(
    basePublishCommand(base, { channel: COMPETITION_PUBLICATION_CHANNEL.SHAREABLE_LINK })
  );
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
});

test("32) visibility/channel incompatibility (PUBLIC_PORTAL + club visibility)", () => {
  const base = createPublishBase({ definitionOverrides: { visibility: COMPETITION_VISIBILITY.CLUB } });
  const result = publishCompetitionPublication(
    basePublishCommand(base, { channel: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.CHANNEL_VISIBILITY_REJECTED));
});

// ---------------------------------------------------------------------------
// 33-35: readiness purity
// ---------------------------------------------------------------------------

test("33) deterministic readiness issue ordering", () => {
  const base = createPublishBase();
  const emptyBrandingRepo = createInMemoryCompetitionBrandingRepository();
  const emptyBranding = createEmptyBranding(base.definition, emptyBrandingRepo);
  const cmd = readinessCommand(base, {
    branding: emptyBranding,
    expectedBrandingRevision: emptyBranding.revision,
  });
  const a = evaluateCompetitionPublicationReadinessCommand(cmd);
  const b = evaluateCompetitionPublicationReadinessCommand(cmd);
  assert.equal(a.ok, true);
  assert.equal(a.value.ready, false);
  assert.deepEqual(a.value.issues, b.value.issues);
});

test("34) readiness does not mutate inputs", () => {
  const base = createPublishBase();
  const cmd = readinessCommand(base);
  const before = JSON.stringify(cmd);
  evaluateCompetitionPublicationReadinessCommand(cmd);
  assert.equal(JSON.stringify(cmd), before);
});

test("35) readiness performs no network call", () => {
  const base = createPublishBase();
  const result = evaluateCompetitionPublicationReadinessCommand(readinessCommand(base));
  assert.equal(result.ok, true);
  assert.equal(result.value.ready, true);
  assert.equal(result.value.networkCallsPerformed, 0);
  assert.equal(result.value.published, false);
  // Also exercise the direct (non-command) readiness export for API parity.
  const direct = evaluateCompetitionPublicationReadiness(readinessCommand(base));
  assert.equal(direct.value.networkCallsPerformed, 0);
});

// ---------------------------------------------------------------------------
// 36-43: manifest determinism + exclusions
// ---------------------------------------------------------------------------

test("36) deterministic manifest", () => {
  const base = createPublishBase();
  const m1 = buildManifestForBase(base);
  const m2 = buildManifestForBase(base);
  assert.deepEqual(m1, m2);
  assert.equal(m1.fingerprint, m2.fingerprint);
  assert.equal(m1.schemaVersion, COMPETITION_PUBLICATION_MANIFEST_SCHEMA_VERSION);
  assert.equal(m1.fingerprintAlgorithm, COMPETITION_PUBLICATION_FINGERPRINT_ALGORITHM.id);
});

test("37) same semantic source produces same manifest fingerprint", () => {
  const base1 = createPublishBase();
  const base2 = createPublishBase();
  const m1 = buildManifestForBase(base1);
  const m2 = buildManifestForBase(base2);
  assert.equal(m1.fingerprint, m2.fingerprint);
});

test("38) changed semantic source produces a different manifest fingerprint", () => {
  const base = createPublishBase();
  const m1 = buildManifestForBase(base);
  const otherBrandingRepo = createInMemoryCompetitionBrandingRepository();
  const otherBranding = createReadyBranding(base.definition, otherBrandingRepo, {
    presentation: { shortLabel: "Changed" },
  });
  const m2 = buildManifestForBase(base, { branding: otherBranding });
  assert.notEqual(m1.fingerprint, m2.fingerprint);
});

test("39) manifest excludes secrets", () => {
  const base = createPublishBase();
  const manifest = buildManifestForBase(base);
  const json = JSON.stringify(manifest).toLowerCase();
  assert.equal(json.includes("secret"), false);
  assert.equal(json.includes("apikey"), false);
  assert.equal(json.includes("password"), false);
});

test("40) manifest excludes signed URL tokens", () => {
  const base = createPublishBase();
  const manifest = buildManifestForBase(base);
  const json = JSON.stringify(manifest);
  assert.equal(json.includes("X-Amz-Signature"), false);
  assert.equal(json.includes("token="), false);
});

test("41) manifest excludes binary/base64", () => {
  const base = createPublishBase();
  const manifest = buildManifestForBase(base);
  const json = JSON.stringify(manifest);
  assert.equal(json.includes("base64"), false);
  assert.equal(json.includes("data:image"), false);
});

test("42) manifest excludes UI state", () => {
  const base = createPublishBase();
  const manifest = buildManifestForBase(base);
  assert.equal(Object.hasOwn(manifest, "muiTheme"), false);
  assert.equal(Object.hasOwn(manifest, "cssVariables"), false);
});

test("43) manifest excludes runtime engine state", () => {
  const base = createPublishBase();
  const manifest = buildManifestForBase(base);
  assert.equal(Object.hasOwn(manifest, "engineState"), false);
  assert.equal(Object.hasOwn(manifest, "runtimeState"), false);
});

// ---------------------------------------------------------------------------
// 44-46: integration plan is proposal-only
// ---------------------------------------------------------------------------

function buildPlanForBase(base, overrides = {}) {
  const channel = overrides.channel || COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL;
  const channelDescriptor = getCompetitionPublicationChannelDescriptor(channel);
  return buildCompetitionPublicationPlan({
    publicationId: overrides.publicationId || "cpub::tenant-1::comp-1::PUBLIC_PORTAL::1",
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    channel,
    revision: overrides.revision || 1,
    manifestFingerprint: overrides.manifestFingerprint || "cm06-deadbeef",
    channelDescriptor,
    isRepublish: overrides.isRepublish || false,
  });
}

test("44) deterministic publication plan", () => {
  const base = createPublishBase();
  const p1 = buildPlanForBase(base);
  const p2 = buildPlanForBase(base);
  assert.deepEqual(p1, p2);
});

test("45) plan contains integration intents only (proposals, not executed)", () => {
  const base = createPublishBase();
  const plan = buildPlanForBase(base);
  assert.equal(plan.executed, false);
  assert.ok(plan.intents.length > 0);
  for (const intent of plan.intents) {
    assert.equal(intent.executed, false);
    assert.equal(intent.proposedOnly, true);
    assert.ok(Object.values(COMPETITION_PUBLICATION_INTENT_TYPE).includes(intent.type));
  }
});

test("46) plan performs no integration side effects (reasons)", () => {
  const base = createPublishBase();
  const plan = buildPlanForBase(base);
  assert.ok(plan.reasons.includes("noExecution"));
  assert.ok(plan.reasons.includes("noNetwork"));
  assert.ok(plan.reasons.includes("noProductionActivation"));
  assert.ok(plan.reasons.includes("noNotificationSent"));
  assert.ok(plan.reasons.includes("noAuditPersistence"));
});

// ---------------------------------------------------------------------------
// 47-59: first-publish record shape + non-ownership guarantees
// ---------------------------------------------------------------------------

test("47) valid first publication", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(result.ok, true);
  assert.equal(result.value.publication.previousPublicationId, null);
});

test("48) initial publication revision = 1", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(result.value.publication.revision, COMPETITION_PUBLICATION_INITIAL_REVISION);
});

test("49) initial publication has no previous publication", () => {
  const base = createPublishBase();
  const before = getCurrentCompetitionPublication({
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    channel: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL,
    repository: base.pubRepo,
  });
  assert.equal(before.ok, true);
  assert.equal(before.value, null);
});

test("50) publication record immutable/copy-safe", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.ok(Object.isFrozen(result.value.publication));
  assert.throws(() => {
    result.value.publication.status = "HACKED";
  });
});

test("51) publish does not mutate the CM-01 definition", () => {
  const base = createPublishBase();
  const before = JSON.stringify(base.definition);
  publishCompetitionPublication(basePublishCommand(base));
  assert.equal(JSON.stringify(base.definition), before);
});

test("52) publish does not mutate the CM-04 configuration", () => {
  const base = createPublishBase();
  const configRepo = createInMemoryCompetitionConfigurationRepository();
  const config = createReadyConfiguration(base.definition, configRepo);
  const before = JSON.stringify(config);
  publishCompetitionPublication(
    basePublishCommand(base, {
      configurationPresence: COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.PRESENT,
      configuration: config,
      expectedConfigurationRevision: config.revision,
    })
  );
  assert.equal(JSON.stringify(config), before);
});

test("53) publish does not mutate the CM-05 branding", () => {
  const base = createPublishBase();
  const before = JSON.stringify(base.branding);
  publishCompetitionPublication(basePublishCommand(base));
  assert.equal(JSON.stringify(base.branding), before);
});

test("54) publish does not create a CompetitionVersion (version repo size unchanged)", () => {
  const base = createPublishBase();
  const sizeBefore = base.versionRepo.size();
  publishCompetitionPublication(basePublishCommand(base));
  assert.equal(base.versionRepo.size(), sizeBefore);
});

test("55) publish does not call Competition Core (phase flag)", () => {
  assert.equal(COMPETITION_PUBLICATION_PHASE.ownsCompetitionCoreExecution, false);
});

test("56) publish does not deploy (phase / reasons)", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.ok(result.explanation.reasons.includes("productionActivationNotPerformed"));
  assert.equal(COMPETITION_PUBLICATION_PHASE.wiredToProductionRuntime, false);
});

test("57) publish does not create a public route", () => {
  assert.equal(COMPETITION_PUBLICATION_PHASE.ownsPublicRouting, false);
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  const writeIntent = result.value.plan.intents.find(
    (i) => i.type === COMPETITION_PUBLICATION_INTENT_TYPE.PUBLIC_PORTAL_PROJECTION_WRITE
  );
  assert.equal(writeIntent.executed, false);
});

test("58) publish does not send notification", () => {
  assert.equal(COMPETITION_PUBLICATION_PHASE.ownsNotifications, false);
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.ok(result.explanation.reasons.includes("noNotificationSent"));
  const notifyIntent = result.value.plan.intents.find(
    (i) => i.type === COMPETITION_PUBLICATION_INTENT_TYPE.NOTIFICATION_INTENT
  );
  assert.equal(notifyIntent.executed, false);
});

test("59) publish does not write audit persistence", () => {
  assert.equal(COMPETITION_PUBLICATION_PHASE.ownsAuditPersistence, false);
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  assert.ok(result.explanation.reasons.includes("noAuditPersistence"));
});

// ---------------------------------------------------------------------------
// 60-62: idempotency + duplicate prevention
// ---------------------------------------------------------------------------

test("60) valid idempotent retry", () => {
  const base = createPublishBase();
  const cmd = basePublishCommand(base);
  const first = publishCompetitionPublication(cmd);
  assert.equal(first.ok, true);
  const second = publishCompetitionPublication(cmd);
  assert.equal(second.ok, true, second.ok ? "" : second.explanation?.summary);
  assert.equal(second.value.publication.publicationId, first.value.publication.publicationId);
  assert.ok(second.explanation.reasons.includes("idempotent=true"));
});

test("61) same idempotency key with changed payload conflicts", () => {
  const base = createPublishBase();
  const cmd = basePublishCommand(base);
  publishCompetitionPublication(cmd);
  const changed = { ...cmd, requestedPublicReference: "different-slug" };
  const result = publishCompetitionPublication(changed);
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.IDEMPOTENCY_CONFLICT));
});

test("62) duplicate publication prevention (second publish with expectedCurrent=0)", () => {
  const base = createPublishBase();
  const cmd = basePublishCommand(base);
  publishCompetitionPublication(cmd);
  const second = publishCompetitionPublication({ ...cmd, idempotencyKey: "pub-2" });
  assert.equal(second.ok, false);
  assert.ok(hasError(second, COMPETITION_PUBLICATION_ERROR_CODE.STALE_CURRENT_PUBLICATION_REVISION));
});

// ---------------------------------------------------------------------------
// 63-70: republish lineage
// ---------------------------------------------------------------------------

test("63) valid republish", () => {
  const base = createPublishBase();
  const first = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(first.ok, true, first.ok ? "" : first.explanation?.summary);

  const scenario = createRepublishScenario(base);
  const second = republishCompetitionPublication(scenario.command);
  assert.equal(second.ok, true, second.ok ? "" : second.explanation?.summary);
  assert.equal(second.value.publication.revision, 2);
  assert.equal(second.value.publication.previousPublicationId, first.value.publication.publicationId);
});

test("64) republish requires explicit current publication", () => {
  const base = createPublishBase();
  const result = republishCompetitionPublication({
    ...basePublishCommand(base),
    idempotencyKey: "pub-x",
    expectedCurrentPublicationRevision: 1,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.MISSING_CURRENT_PUBLICATION_REFERENCE));
});

test("65) republish requires explicit new source version", () => {
  const base = createPublishBase();
  const first = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(first.ok, true);
  const result = republishCompetitionPublication({
    ...basePublishCommand(base),
    competitionVersion: null,
    expectedSourceVersionId: null,
    expectedSourceVersionNumber: null,
    idempotencyKey: "pub-2",
    expectedCurrentPublicationRevision: 1,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.INVALID_COMPETITION_VERSION));
});

test("66) republish rejects stale publication revision", () => {
  const base = createPublishBase();
  const first = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(first.ok, true);
  const scenario = createRepublishScenario(base, { expectedCurrentPublicationRevision: 99 });
  const result = republishCompetitionPublication(scenario.command);
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.STALE_CURRENT_PUBLICATION_REVISION));
});

test("67) republish links previous publication", () => {
  const base = createPublishBase();
  const first = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(first.ok, true);
  const scenario = createRepublishScenario(base);
  const second = republishCompetitionPublication(scenario.command);
  assert.equal(second.ok, true, second.ok ? "" : second.explanation?.summary);

  const prevLookup = getCompetitionPublicationById({
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    publicationId: first.value.publication.publicationId,
    repository: base.pubRepo,
  });
  assert.equal(prevLookup.ok, true);
  assert.equal(prevLookup.value.status, COMPETITION_PUBLICATION_STATUS.SUPERSEDED);
});

test("68) republish creates monotonic publication revision", () => {
  const base = createPublishBase();
  const first = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(first.ok, true);

  const scenario2 = createRepublishScenario(base);
  const second = republishCompetitionPublication(scenario2.command);
  assert.equal(second.ok, true, second.ok ? "" : second.explanation?.summary);
  assert.equal(second.value.publication.revision, 2);

  const updated3 = updateDraftCompetitionDefinition(scenario2.definition2, {
    tenantId: scenario2.definition2.tenantId,
    competitionId: scenario2.definition2.competitionId,
    name: "Summer Open v3",
    updatedAt: NOW,
  });
  assert.equal(updated3.ok, true, updated3.ok ? "" : updated3.explanation?.summary);
  const definition3 = updated3.value;
  const version3 = createVersion(definition3, base.versionRepo, {
    expectedParentVersionId: scenario2.version2.versionId,
    expectedLatestVersionNumber: scenario2.version2.versionNumber,
  });

  const third = republishCompetitionPublication({
    ...scenario2.command,
    competitionVersion: version3,
    expectedSourceVersionId: version3.versionId,
    expectedSourceVersionNumber: version3.versionNumber,
    definition: definition3,
    expectedDefinitionRevision: definition3.revision,
    idempotencyKey: "pub-3",
    expectedCurrentPublicationRevision: 2,
  });
  assert.equal(third.ok, true, third.ok ? "" : third.explanation?.summary);
  assert.equal(third.value.publication.revision, 3);
});

test("69) no implicit current/latest publication fallback (expectedCurrentPublicationRevision required)", () => {
  const base = createPublishBase();
  const first = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(first.ok, true);
  const scenario = createRepublishScenario(base);
  const { expectedCurrentPublicationRevision, ...withoutRevision } = scenario.command;
  void expectedCurrentPublicationRevision;
  const result = republishCompetitionPublication(withoutRevision);
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.MISSING_EXPECTED_CURRENT_REVISION));
});

test("70) same-source republish rejected as no-op/conflict", () => {
  const base = createPublishBase();
  const first = publishCompetitionPublication(basePublishCommand(base));
  assert.equal(first.ok, true);
  const result = republishCompetitionPublication({
    ...basePublishCommand(base),
    idempotencyKey: "pub-2",
    expectedCurrentPublicationRevision: 1,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.SAME_SOURCE_REPUBLISH));
});

// ---------------------------------------------------------------------------
// 71-75: read model / tenant isolation
// ---------------------------------------------------------------------------

test("71) publication list stable ordering", () => {
  const base = createPublishBase();
  publishCompetitionPublication(basePublishCommand(base));
  const scenario = createRepublishScenario(base);
  republishCompetitionPublication(scenario.command);

  const listed = listCompetitionPublicationsCommand({
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    repository: base.pubRepo,
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.value.length, 2);
  assert.equal(listed.value[0].revision, 1);
  assert.equal(listed.value[1].revision, 2);
});

test("72) current publication lookup success", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  const current = getCurrentCompetitionPublication({
    tenantId: base.definition.tenantId,
    competitionId: base.definition.competitionId,
    channel: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL,
    repository: base.pubRepo,
  });
  assert.equal(current.ok, true);
  assert.equal(current.value.publicationId, result.value.publication.publicationId);
});

test("73) current publication tenant isolation", () => {
  const base = createPublishBase();
  publishCompetitionPublication(basePublishCommand(base));
  const found = getCurrentCompetitionPublication({
    tenantId: "tenant-other",
    competitionId: base.definition.competitionId,
    channel: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL,
    repository: base.pubRepo,
  });
  assert.equal(found.ok, true);
  assert.equal(found.value, null);
});

test("74) current publication competition isolation", () => {
  const base = createPublishBase();
  publishCompetitionPublication(basePublishCommand(base));
  const found = getCurrentCompetitionPublication({
    tenantId: base.definition.tenantId,
    competitionId: "comp-other",
    channel: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL,
    repository: base.pubRepo,
  });
  assert.equal(found.ok, true);
  assert.equal(found.value, null);
});

test("75) cross-tenant access rejection (getCompetitionPublicationById)", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base));
  const lookup = getCompetitionPublicationById({
    tenantId: "tenant-other",
    competitionId: base.definition.competitionId,
    publicationId: result.value.publication.publicationId,
    repository: base.pubRepo,
  });
  assert.equal(lookup.ok, false);
  assert.ok(hasError(lookup, COMPETITION_PUBLICATION_ERROR_CODE.PUBLICATION_NOT_FOUND));
});

// ---------------------------------------------------------------------------
// 76-80: public reference / slug safety
// ---------------------------------------------------------------------------

test("76) valid public reference/slug", () => {
  assert.equal(validateSlug("summer-open").value, "summer-open");
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { requestedPublicReference: "summer-open" })
  );
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.publication.publicReference.slug, "summer-open");
});

test("77) path traversal slug rejection", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { requestedPublicReference: "../../etc" })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG));
});

test("78) protocol/query/fragment slug rejection", () => {
  const r1 = publishCompetitionPublication(
    basePublishCommand(createPublishBase(), { requestedPublicReference: "https://evil.com" })
  );
  assert.equal(r1.ok, false);
  assert.ok(hasError(r1, COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG));

  const r2 = publishCompetitionPublication(
    basePublishCommand(createPublishBase(), { requestedPublicReference: "slug?x=1" })
  );
  assert.equal(r2.ok, false);
  assert.ok(hasError(r2, COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG));

  const r3 = publishCompetitionPublication(
    basePublishCommand(createPublishBase(), { requestedPublicReference: "slug#frag" })
  );
  assert.equal(r3.ok, false);
  assert.ok(hasError(r3, COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG));
});

test("79) control-character slug rejection", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { requestedPublicReference: "bad\u0000slug" })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.INVALID_SLUG));
});

test("80) duplicate public reference rejection", () => {
  const base = createPublishBase();
  const first = publishCompetitionPublication(
    basePublishCommand(base, { requestedPublicReference: "summer-open" })
  );
  assert.equal(first.ok, true, first.ok ? "" : first.explanation?.summary);

  const definition2 = createInternalDraft({ competitionId: "comp-2" });
  const versionRepo2 = createInMemoryCompetitionVersionRepository();
  const version2 = createVersion(definition2, versionRepo2);
  const brandingRepo2 = createInMemoryCompetitionBrandingRepository();
  const branding2 = createReadyBranding(definition2, brandingRepo2);

  const second = publishCompetitionPublication({
    tenantId: definition2.tenantId,
    competitionId: definition2.competitionId,
    channel: COMPETITION_PUBLICATION_CHANNEL.PUBLIC_PORTAL,
    profileId: COMPETITION_PUBLICATION_PROFILE_ID.CM06_STANDARD_V1,
    competitionVersion: version2,
    expectedSourceVersionId: version2.versionId,
    expectedSourceVersionNumber: version2.versionNumber,
    definition: definition2,
    expectedDefinitionRevision: definition2.revision,
    configurationPresence: COMPETITION_PUBLICATION_CONFIGURATION_PRESENCE.ABSENT,
    configuration: null,
    expectedConfigurationRevision: null,
    branding: branding2,
    expectedBrandingRevision: branding2.revision,
    idempotencyKey: "pub-1",
    expectedCurrentPublicationRevision: 0,
    requestedPublicReference: "summer-open",
    repository: base.pubRepo,
  });
  assert.equal(second.ok, false);
  assert.ok(hasError(second, COMPETITION_PUBLICATION_ERROR_CODE.DUPLICATE_PUBLIC_REFERENCE));
});

// ---------------------------------------------------------------------------
// 81-83: legacy read-only observation
// ---------------------------------------------------------------------------

test("81) legacy publication observation success", () => {
  const result = projectLegacyTournamentPublicationObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: {
      isPublic: true,
      publishedAt: NOW,
      slug: "legacy-open",
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.observedPublicFlag, true);
  assert.equal(result.value.isCanonicalPublication, false);
  assert.equal(result.value.provenance, "LEGACY_UNVERIFIED");
});

test("82) legacy ambiguous mapping rejection / issues", () => {
  const result = projectLegacyTournamentPublicationObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: {
      isPublic: true,
      public: false,
    },
  });
  assert.equal(result.ok, true);
  assert.ok(
    result.value.issues.some((i) => i.code === COMPETITION_PUBLICATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING)
  );
  assert.equal(result.value.observedPublicFlag, null);
});

test("83) legacy public flag not treated as canonical publication", () => {
  const result = projectLegacyTournamentPublicationObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { isPublic: true },
  });
  assert.equal(result.value.isCanonicalPublication, false);
  assert.equal(result.value.fullSafeMapping, false);
  assert.equal(LEGACY_PUBLICATION_COMPATIBILITY.isCanonicalPublication, false);
  assert.equal(LEGACY_PUBLICATION_COMPATIBILITY.writesLegacy, false);
});

// ---------------------------------------------------------------------------
// 84-94: ownership boundaries / phase flags / regressions
// ---------------------------------------------------------------------------

test("84) no suspension/cancellation ownership (phase flag)", () => {
  assert.equal(COMPETITION_PUBLICATION_PHASE.ownsSuspensionOrArchiveStates, false);
});

test("85) no archive ownership", () => {
  assert.equal(COMPETITION_PUBLICATION_PHASE.ownsSuspensionOrArchiveStates, false);
  assert.ok(!Object.values(COMPETITION_PUBLICATION_STATUS).includes("ARCHIVED"));
});

test("86) typed error stability (CM06_* string literals)", () => {
  assert.equal(COMPETITION_PUBLICATION_ERROR_CODE.MISSING_TENANT, "CM06_MISSING_TENANT");
  assert.equal(
    COMPETITION_PUBLICATION_ERROR_CODE.STALE_CURRENT_PUBLICATION_REVISION,
    "CM06_STALE_CURRENT_PUBLICATION_REVISION"
  );
  assert.equal(COMPETITION_PUBLICATION_ERROR_CODE.SAME_SOURCE_REPUBLISH, "CM06_SAME_SOURCE_REPUBLISH");
});

test("87) capability-local public exports / phase", () => {
  assert.equal(cmRoot.COMPETITION_PUBLICATION_PHASE.id, "CM-06");
  assert.equal(typeof cmRoot.publishCompetitionPublication, "function");
  assert.equal(typeof cm06.republishCompetitionPublication, "function");
  assert.equal(COMPETITION_PUBLICATION_PHASE.repositoryMode, "capability-local-in-memory");
});

test("88) CM-01 regression — definition create still works", () => {
  const definition = createInternalDraft();
  assert.equal(definition.revision, 1);
  assert.equal(definition.tenantId, "tenant-1");
  assert.equal(definition.status, COMPETITION_DEFINITION_STATUS.DRAFT);
});

test("89) CM-02 regression — phase still dormant", () => {
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.id, "CM-02");
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.wiredToProductionRuntime, false);
});

test("90) CM-03 regression — phase still dormant", () => {
  assert.equal(COMPETITION_VERSIONING_PHASE.id, "CM-03");
  assert.equal(COMPETITION_VERSIONING_PHASE.wiredToProductionRuntime, false);
});

test("91) CM-04 regression — phase still dormant", () => {
  assert.equal(COMPETITION_CONFIGURATION_PHASE.id, "CM-04");
  assert.equal(COMPETITION_CONFIGURATION_PHASE.wiredToProductionRuntime, false);
});

test("92) CM-05 regression — phase still dormant", () => {
  assert.equal(COMPETITION_BRANDING_PHASE.id, "CM-05");
  assert.equal(COMPETITION_BRANDING_PHASE.wiredToProductionRuntime, false);
  assert.equal(typeof evaluateCompetitionBrandingReadiness, "function");
});

test("93) combined CM root exposes the CM-06 phase and API", () => {
  assert.equal(cmRoot.COMPETITION_PUBLICATION_PHASE.id, "CM-06");
  assert.equal(typeof cmRoot.evaluateCompetitionPublicationReadinessCommand, "function");
  assert.equal(typeof cmRoot.createInMemoryCompetitionPublicationRepository, "function");
});

test("94) no database/runtime write (phase flags)", () => {
  assert.equal(COMPETITION_PUBLICATION_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMPETITION_PUBLICATION_PHASE.hasPersistence, false);
  assert.equal(COMPETITION_PUBLICATION_PHASE.hasMigration, false);
  assert.equal(COMPETITION_PUBLICATION_PHASE.migrationApplied, false);
});

// ---------------------------------------------------------------------------
// 95-100: determinism, additional gates, module shape
// ---------------------------------------------------------------------------

test("95) repeated execution produces stable output", () => {
  const run = () => {
    const base = createPublishBase();
    const result = publishCompetitionPublication(basePublishCommand(base));
    assert.equal(result.ok, true);
    return result.value.publication;
  };
  const r1 = run();
  const r2 = run();
  const r3 = run();
  assert.deepEqual(r1, r2);
  assert.deepEqual(r2, r3);
});

test("96) missing profile id rejection", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base, { profileId: undefined }));
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.MISSING_PROFILE_ID));
});

test("97) missing idempotency key", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(basePublishCommand(base, { idempotencyKey: undefined }));
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.MISSING_IDEMPOTENCY_KEY));
});

test("98) external lifecycle block SUSPENDED", () => {
  const base = createPublishBase();
  const result = publishCompetitionPublication(
    basePublishCommand(base, { externalLifecycleBlock: { status: "SUSPENDED" } })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.EXTERNAL_LIFECYCLE_BLOCKED));
});

test("99) SHAREABLE_LINK + PRIVATE visibility rejected", () => {
  const base = createPublishBase({
    definitionOverrides: { visibility: COMPETITION_VISIBILITY.PRIVATE },
  });
  const result = publishCompetitionPublication(
    basePublishCommand(base, { channel: COMPETITION_PUBLICATION_CHANNEL.SHAREABLE_LINK })
  );
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_PUBLICATION_ERROR_CODE.CHANNEL_VISIBILITY_REJECTED));
});

test("100) module files exist (index.js + ARCHITECTURE.md)", () => {
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "index.js")));
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "ARCHITECTURE.md")));
});

// ---------------------------------------------------------------------------
// Extra: readiness severity export sanity (imported for completeness)
// ---------------------------------------------------------------------------

test("readiness issue severity values are the CM-06 enum", () => {
  const base = createPublishBase();
  const emptyBrandingRepo = createInMemoryCompetitionBrandingRepository();
  const emptyBranding = createEmptyBranding(base.definition, emptyBrandingRepo);
  const result = evaluateCompetitionPublicationReadinessCommand(
    readinessCommand(base, { branding: emptyBranding, expectedBrandingRevision: emptyBranding.revision })
  );
  assert.equal(result.ok, true);
  for (const issue of result.value.issues) {
    assert.ok(Object.values(COMPETITION_PUBLICATION_SEVERITY).includes(issue.severity));
  }
});

test("deepFreeze helper is re-exported and functional", () => {
  const frozen = deepFreeze({ a: { b: 1 } });
  assert.ok(Object.isFrozen(frozen));
  assert.ok(Object.isFrozen(frozen.a));
});
