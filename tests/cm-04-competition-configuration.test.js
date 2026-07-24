import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as cm04 from "../src/features/competition-management/competition-configuration/index.js";
import * as cmRoot from "../src/features/competition-management/index.js";
import {
  COMPETITION_CONFIGURATION_PHASE,
  COMPETITION_CONFIGURATION_STATUS,
  COMPETITION_CONFIGURATION_STATUS_VALUES,
  COMPETITION_CONFIGURATION_INITIAL_REVISION,
  COMPETITION_CONFIGURATION_CAPABILITY_OWNER,
  COMPETITION_CONFIGURATION_ERROR_CODE,
  CompetitionConfigurationError,
  createDraftCompetitionConfiguration,
  updateDraftCompetitionConfiguration,
  applyTemplateConfigurationProposal,
  validateCompetitionConfigurationCommand,
  compareCompetitionConfigurationsCommand,
  projectCompetitionConfigurationSnapshotCommand,
  getCompetitionConfiguration,
  createCapabilityLocalConfigurationRepository,
  createInMemoryCompetitionConfigurationRepository,
  sortConfigurationDifferences,
  projectCompetitionConfigurationSnapshot,
  projectLegacyTournamentToConfigurationSections,
  createUnimplementedCompetitionConfigurationRepositoryPort,
  validateCompetitionConfigurationInput,
  clonePlain,
} from "../src/features/competition-management/competition-configuration/index.js";

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
  COMPETITION_DEFINITION_STATUS,
  createDraftCompetitionDefinition,
} from "../src/features/competition-management/competition-definition/index.js";

import {
  COMPETITION_TEMPLATE_INSTANTIATION_PHASE,
  COMPETITION_TEMPLATE_OWNERSHIP_TARGET,
  instantiateCompetitionTemplateCommand,
} from "../src/features/competition-management/template-instantiation/index.js";

import { COMPETITION_VERSIONING_PHASE } from "../src/features/competition-management/competition-versioning/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/competition-management/competition-configuration"
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

function createTeamDraft(overrides = {}) {
  return createInternalDraft({
    competitionType: COMPETITION_TYPE.TEAM_TOURNAMENT,
    ...overrides,
  });
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

function createRepo() {
  return createInMemoryCompetitionConfigurationRepository();
}

function createEmptyConfig(definition, repo, overrides = {}) {
  return createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {},
    repository: repo,
    ...overrides,
  });
}

function buildInstantiation(definition, overrides = {}) {
  return instantiateCompetitionTemplateCommand({
    tenantId: definition.tenantId,
    definition,
    templateId: "cm-global-internal-tournament",
    templateVersion: 1,
    expectedRevision: definition.revision,
    ...overrides,
  });
}

function tamperInstantiation(instantiationValue, mutate) {
  const cloned = clonePlain(instantiationValue);
  mutate(cloned);
  return cloned;
}

test("1) valid empty draft configuration", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createEmptyConfig(definition, repo);
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.revision, COMPETITION_CONFIGURATION_INITIAL_REVISION);
  assert.equal(result.value.status, COMPETITION_CONFIGURATION_STATUS.DRAFT);
  assert.deepEqual(result.value.sections, {});
  assert.ok(Object.isFrozen(result.value));
});

test("2) valid populated configuration (participant_mode individual + format)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      participant_mode: { sectionId: "participant_mode", participantMode: "individual" },
      format: { sectionId: "format", formatBlueprintId: "internal_tournament" },
    },
    repository: repo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.sections.participant_mode.participantMode, "individual");
  assert.equal(result.value.sections.format.formatBlueprintId, "internal_tournament");
});

test("3) missing tenantId", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: undefined,
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_TENANT));
});

test("4) missing competitionId", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: "tenant-1",
    competitionId: "",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.MISSING_COMPETITION));
});

test("5) tenant mismatch with definition", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: "tenant-other",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.TENANT_MISMATCH));
});

test("6) competition mismatch with definition", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: "tenant-1",
    competitionId: "comp-other",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.COMPETITION_MISMATCH));
});

test("7) non-draft definition rejection", () => {
  const repo = createRepo();
  const definition = {
    ...createInternalDraft(),
    status: COMPETITION_DEFINITION_STATUS.PUBLISHED,
  };
  const result = createDraftCompetitionConfiguration({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.NON_EDITABLE_DEFINITION));
});

test("8) expected definition revision success", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createEmptyConfig(definition, repo);
  assert.equal(result.ok, true);
  assert.equal(result.value.sourceDefinitionRevision, 1);
});

test("9) stale definition revision rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: 99,
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.STALE_DEFINITION_REVISION));
});

test("10) initial configuration revision = 1", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createEmptyConfig(definition, repo);
  assert.equal(result.ok, true);
  assert.equal(result.value.revision, 1);
});

test("11) successful update increments revision", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  assert.equal(created.ok, true);
  const updated = updateDraftCompetitionConfiguration({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: created.value.revision,
    sections: {
      format: { sectionId: "format", formatBlueprintId: "internal_tournament" },
    },
    repository: repo,
  });
  assert.equal(updated.ok, true, updated.ok ? "" : updated.explanation?.summary);
  assert.equal(updated.value.revision, created.value.revision + 1);
  assert.equal(updated.value.sections.format.formatBlueprintId, "internal_tournament");
});

test("12) stale configuration revision rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  assert.equal(created.ok, true);
  const updated = updateDraftCompetitionConfiguration({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: 99,
    sections: {
      format: { sectionId: "format", formatBlueprintId: "internal_tournament" },
    },
    repository: repo,
  });
  assert.equal(updated.ok, false);
  assert.ok(hasError(updated, COMPETITION_CONFIGURATION_ERROR_CODE.STALE_CONFIGURATION_REVISION));
});

test("13) immutable tenant protection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  assert.equal(created.ok, true);
  const updated = updateDraftCompetitionConfiguration({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: created.value.revision,
    newTenantId: "tenant-other",
    repository: repo,
  });
  assert.equal(updated.ok, false);
  assert.ok(hasError(updated, COMPETITION_CONFIGURATION_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE));
});

test("14) immutable competitionId protection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  assert.equal(created.ok, true);
  const updated = updateDraftCompetitionConfiguration({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: created.value.revision,
    newCompetitionId: "comp-other",
    repository: repo,
  });
  assert.equal(updated.ok, false);
  assert.ok(hasError(updated, COMPETITION_CONFIGURATION_ERROR_CODE.IMMUTABLE_IDENTITY_UPDATE));
});

test("15) duplicate configuration rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const first = createEmptyConfig(definition, repo);
  assert.equal(first.ok, true);
  const second = createEmptyConfig(definition, repo);
  assert.equal(second.ok, false);
  assert.ok(hasError(second, COMPETITION_CONFIGURATION_ERROR_CODE.DUPLICATE_CONFIGURATION));
});

test("16) valid individual-mode configuration", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      participant_mode: { sectionId: "participant_mode", participantMode: "individual" },
    },
    repository: repo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.sections.participant_mode.participantMode, "individual");
});

test("17) valid team-mode configuration", () => {
  const repo = createRepo();
  const definition = createTeamDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      participant_mode: { sectionId: "participant_mode", participantMode: "team" },
      roster: {
        sectionId: "roster",
        rosterPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          referenceId: null,
          resolutionStatus: "deferred_unsupported",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.sections.participant_mode.participantMode, "team");
  assert.ok(result.value.sections.roster.rosterPolicyReference);
});

test("18) team-only section on individual competition rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      roster: {
        sectionId: "roster",
        rosterPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          referenceId: null,
          resolutionStatus: "deferred_unsupported",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT));
});

test("19) team participant mode on internal tournament rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      participant_mode: { sectionId: "participant_mode", participantMode: "team" },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.SECTION_COMPATIBILITY_FAILURE));
});

test("20) valid division reference (opaque_proposal)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      division: {
        sectionId: "division",
        divisionBlueprintReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_DIVISION,
          referenceId: "division-proposal-1",
          resolutionStatus: "opaque_proposal",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(
    result.value.sections.division.divisionBlueprintReference.resolutionStatus,
    "opaque_proposal"
  );
});

test("21) invalid/unknown division reference (bad capability owner)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      division: {
        sectionId: "division",
        divisionBlueprintReference: {
          capabilityOwner: "not_a_real_owner",
          referenceId: "division-proposal-1",
          resolutionStatus: "opaque_proposal",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE));
});

test("22) valid seeding/draw relationship (both opaque_proposal)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      seeding: {
        sectionId: "seeding",
        seedingPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_SEEDING,
          referenceId: "seed-1",
          resolutionStatus: "opaque_proposal",
        },
      },
      draw: {
        sectionId: "draw",
        drawPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_DRAW,
          referenceId: "draw-1",
          resolutionStatus: "opaque_proposal",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
});

test("23) invalid seeding/draw relationship (deferred seeding + resolved draw)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      seeding: {
        sectionId: "seeding",
        seedingPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          referenceId: null,
          resolutionStatus: "deferred_unsupported",
        },
      },
      draw: {
        sectionId: "draw",
        drawPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_DRAW,
          referenceId: "draw-1",
          resolutionStatus: "resolved_identity",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT));
});

test("24) valid match-format/scoring relationship", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      match_format: {
        sectionId: "match_format",
        matchFormatReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_FORMAT,
          referenceId: "format-1",
          resolutionStatus: "opaque_proposal",
        },
      },
      scoring: {
        sectionId: "scoring",
        scoringPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_SCORING,
          referenceId: "scoring-1",
          resolutionStatus: "opaque_proposal",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
});

test("25) invalid match-format/scoring (deferred format + resolved scoring)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      match_format: {
        sectionId: "match_format",
        matchFormatReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.DEFERRED,
          referenceId: null,
          resolutionStatus: "deferred_unsupported",
        },
      },
      scoring: {
        sectionId: "scoring",
        scoringPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_SCORING,
          referenceId: "scoring-1",
          resolutionStatus: "resolved_identity",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT));
});

test("26) valid schedule/court relationship", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      scheduling: {
        sectionId: "scheduling",
        schedulePolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_SCHEDULE,
          referenceId: "sched-1",
          resolutionStatus: "opaque_proposal",
        },
      },
      court_assignment: {
        sectionId: "court_assignment",
        courtAssignmentPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_COURT_ASSIGNMENT,
          referenceId: "court-1",
          resolutionStatus: "opaque_proposal",
        },
        venueScopeHint: "venue-1",
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.sections.court_assignment.venueScopeHint, "venue-1");
});

test("27) invalid venue/court scope relationship (venueScopeHint not in venues)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      court_assignment: {
        sectionId: "court_assignment",
        courtAssignmentPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_COURT_ASSIGNMENT,
          referenceId: "court-1",
          resolutionStatus: "opaque_proposal",
        },
        venueScopeHint: "venue-unknown",
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_SECTION_CONFLICT));
});

test("28) valid standings/tie-break reference", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      standings: {
        sectionId: "standings",
        standingsPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_STANDINGS,
          referenceId: "standings-1",
          resolutionStatus: "opaque_proposal",
        },
        tieBreakPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_STANDINGS,
          referenceId: "tiebreak-1",
          resolutionStatus: "opaque_proposal",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.ok(result.value.sections.standings.tieBreakPolicyReference);
});

test("29) unsupported capability reference rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      eligibility: {
        sectionId: "eligibility",
        eligibilityPolicyReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_ROSTER,
          referenceId: "x",
          resolutionStatus: "opaque_proposal",
        },
      },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.UNSUPPORTED_CAPABILITY_REFERENCE));
});

test("30-31) unknown section rejection (duplicate keys are structurally impossible in a JS object map)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      not_a_real_section: { sectionId: "not_a_real_section" },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.UNKNOWN_SECTION));
});

test("32) cross-section errors sorted deterministically", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      participant_mode: { sectionId: "participant_mode", participantMode: "team" },
      official_mode: { sectionId: "official_mode", officialMode: "official_open" },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  const relevant = result.errors.filter(
    (e) => e.code === COMPETITION_CONFIGURATION_ERROR_CODE.SECTION_COMPATIBILITY_FAILURE
  );
  assert.equal(relevant.length, 2);
  const fields = relevant.map((e) => e.field);
  assert.deepEqual(fields, ["sections.official_mode", "sections.participant_mode"]);
  const allFields = result.errors.map((e) => e.field);
  const sortedAllFields = [...allFields].sort((a, b) => a.localeCompare(b, "en"));
  assert.deepEqual(allFields, sortedAllFields);
});

test("33) no silent repair for invalid officialMode", () => {
  const repo = createRepo();
  const definition = createOfficialDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      official_mode: { sectionId: "official_mode", officialMode: "not_a_real_mode" },
    },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION));
});

test("34) no mutation on create", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const definitionBefore = clonePlain(definition);
  const sectionsInput = {
    format: { sectionId: "format", formatBlueprintId: "internal_tournament" },
  };
  const sectionsBefore = clonePlain(sectionsInput);
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: sectionsInput,
    repository: repo,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(definition, definitionBefore);
  assert.deepEqual(sectionsInput, sectionsBefore);
});

test("35) no mutation on update", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  assert.equal(created.ok, true);
  const definitionBefore = clonePlain(definition);
  const sectionsInput = {
    format: { sectionId: "format", formatBlueprintId: "internal_tournament" },
  };
  const sectionsBefore = clonePlain(sectionsInput);
  const updated = updateDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: created.value.revision,
    sections: sectionsInput,
    repository: repo,
  });
  assert.equal(updated.ok, true);
  assert.deepEqual(definition, definitionBefore);
  assert.deepEqual(sectionsInput, sectionsBefore);
});

test("36) deterministic create output", () => {
  const definition = createInternalDraft();
  const repoA = createRepo();
  const repoB = createRepo();
  const sections = {
    format: { sectionId: "format", formatBlueprintId: "internal_tournament" },
  };
  const a = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections,
    repository: repoA,
  });
  const b = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections,
    repository: repoB,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(a.value, b.value);
});

test("37) deterministic update output", () => {
  const definition = createInternalDraft();
  const repoA = createRepo();
  const repoB = createRepo();
  const createdA = createEmptyConfig(definition, repoA);
  const createdB = createEmptyConfig(definition, repoB);
  const sections = {
    format: { sectionId: "format", formatBlueprintId: "internal_tournament" },
  };
  const a = updateDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: createdA.value.revision,
    sections,
    repository: repoA,
  });
  const b = updateDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: createdB.value.revision,
    sections,
    repository: repoB,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(a.value, b.value);
});

test("38) valid CM-02 proposal application", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const instantiation = buildInstantiation(definition);
  assert.equal(instantiation.ok, true, instantiation.ok ? "" : instantiation.explanation?.summary);
  const applied = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: instantiation.value,
    repository: repo,
  });
  assert.equal(applied.ok, true, applied.ok ? "" : applied.explanation?.summary);
  assert.equal(applied.value.configuration.sections.format.formatBlueprintId, "internal_tournament");
  assert.equal(
    applied.value.configuration.sections.registration_policy.registrationDefaults.mode,
    "entry_approval"
  );
});

test("39) CM-02 proposal tenant mismatch", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const instantiation = buildInstantiation(definition);
  assert.equal(instantiation.ok, true);
  const tampered = tamperInstantiation(instantiation.value, (v) => {
    v.plan.tenantId = "tenant-mismatched";
  });
  const applied = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: tampered,
    repository: repo,
  });
  assert.equal(applied.ok, false);
  assert.ok(
    hasError(applied, COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_TENANT_MISMATCH)
  );
});

test("40) CM-02 proposal competition mismatch", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const instantiation = buildInstantiation(definition);
  assert.equal(instantiation.ok, true);
  const tampered = tamperInstantiation(instantiation.value, (v) => {
    v.plan.competitionId = "comp-mismatched";
  });
  const applied = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: tampered,
    repository: repo,
  });
  assert.equal(applied.ok, false);
  assert.ok(
    hasError(applied, COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_COMPETITION_MISMATCH)
  );
});

test("41) CM-02 proposal stale definition revision", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const instantiation = buildInstantiation(definition);
  assert.equal(instantiation.ok, true);
  const tampered = tamperInstantiation(instantiation.value, (v) => {
    v.plan.sourceDefinitionRevision = 99;
  });
  const applied = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: tampered,
    repository: repo,
  });
  assert.equal(applied.ok, false);
  assert.ok(hasError(applied, COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_STALE));
});

test("42) CM-02 proposal requires compatibility PASS", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const instantiation = buildInstantiation(definition);
  assert.equal(instantiation.ok, true);
  const tampered = tamperInstantiation(instantiation.value, (v) => {
    v.plan.compatibilityProof.status = "FAIL";
  });
  const applied = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: tampered,
    repository: repo,
  });
  assert.equal(applied.ok, false);
  assert.ok(
    hasError(applied, COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_INCOMPATIBLE)
  );
});

test("43) CM-02 proposal applies only CM-04-owned fragments", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const instantiation = buildInstantiation(definition);
  assert.equal(instantiation.ok, true);
  const applied = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: instantiation.value,
    repository: repo,
  });
  assert.equal(applied.ok, true);
  assert.deepEqual(
    Object.keys(applied.value.configuration.sections).sort(),
    ["format", "registration_policy"]
  );
  assert.ok(applied.value.definitionPatchProposals.length > 0);
  assert.ok(applied.value.coreOwnedProposals.length > 0);
  assert.ok(
    applied.value.definitionPatchProposals.every(
      (p) => p.ownershipTarget === COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CM01_DEFINITION
    )
  );
  assert.ok(
    applied.value.coreOwnedProposals.every((p) => String(p.ownershipTarget).startsWith("core_"))
  );
});

test("44) unknown proposal ownership target rejection", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const instantiation = buildInstantiation(definition);
  assert.equal(instantiation.ok, true);
  const tampered = tamperInstantiation(instantiation.value, (v) => {
    v.proposedFragments = [
      ...v.proposedFragments,
      { path: "configuration.mystery", value: "x", ownershipTarget: "totally_unknown_target" },
    ];
  });
  const applied = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: tampered,
    repository: repo,
  });
  assert.equal(applied.ok, false);
  assert.ok(
    hasError(applied, COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_OWNERSHIP_MISMATCH)
  );
});

test("45) explicit replacement required", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const instantiation = buildInstantiation(definition);
  const first = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: instantiation.value,
    repository: repo,
  });
  assert.equal(first.ok, true);
  const second = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: instantiation.value,
    repository: repo,
  });
  assert.equal(second.ok, false);
  assert.ok(
    hasError(second, COMPETITION_CONFIGURATION_ERROR_CODE.EXPLICIT_REPLACEMENT_REQUIRED)
  );
});

test("46) manual configuration not silently overwritten", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const manual = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      format: { sectionId: "format", formatBlueprintId: "manual_format" },
    },
    repository: repo,
  });
  assert.equal(manual.ok, true);
  const instantiation = buildInstantiation(definition);
  const applied = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: instantiation.value,
    repository: repo,
  });
  assert.equal(applied.ok, false);
  assert.ok(
    hasError(applied, COMPETITION_CONFIGURATION_ERROR_CODE.EXPLICIT_REPLACEMENT_REQUIRED)
  );
  const stillThere = getCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    repository: repo,
  });
  assert.equal(stillThere.ok, true);
  assert.equal(stillThere.value.sections.format.formatBlueprintId, "manual_format");
});

test("extra) explicit replacement of an existing configuration succeeds", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const manual = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      format: { sectionId: "format", formatBlueprintId: "manual_format" },
    },
    repository: repo,
  });
  assert.equal(manual.ok, true);
  const instantiation = buildInstantiation(definition);
  const applied = applyTemplateConfigurationProposal({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    instantiationResult: instantiation.value,
    replaceExistingConfiguration: true,
    expectedConfigurationRevision: manual.value.revision,
    repository: repo,
  });
  assert.equal(applied.ok, true, applied.ok ? "" : applied.explanation?.summary);
  assert.equal(applied.value.configuration.sections.format.formatBlueprintId, "internal_tournament");
});

test("47) configuration compare equal", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  const cmp = compareCompetitionConfigurationsCommand({
    tenantId: definition.tenantId,
    left: created.value,
    right: created.value,
  });
  assert.equal(cmp.ok, true);
  assert.equal(cmp.value.equal, true);
  assert.equal(cmp.value.differences.length, 0);
});

test("48) configuration compare changed scalar", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: { format: { sectionId: "format", formatBlueprintId: "internal_tournament" } },
    repository: repo,
  });
  assert.equal(created.ok, true);
  const updated = updateDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: created.value.revision,
    sections: { format: { sectionId: "format", formatBlueprintId: "daily_play" } },
    repository: repo,
  });
  assert.equal(updated.ok, true);
  const cmp = compareCompetitionConfigurationsCommand({
    tenantId: definition.tenantId,
    left: created.value,
    right: updated.value,
  });
  assert.equal(cmp.ok, true);
  assert.equal(cmp.value.equal, false);
  assert.ok(
    cmp.value.differences.some(
      (d) => d.path.endsWith("formatBlueprintId") && d.changeType === "CHANGED"
    )
  );
});

test("49) configuration compare added/removed section", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  const updated = updateDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: created.value.revision,
    sections: { format: { sectionId: "format", formatBlueprintId: "internal_tournament" } },
    repository: repo,
  });
  assert.equal(updated.ok, true);
  const cmp = compareCompetitionConfigurationsCommand({
    tenantId: definition.tenantId,
    left: created.value,
    right: updated.value,
  });
  assert.equal(cmp.ok, true);
  assert.ok(cmp.value.differences.some((d) => d.changeType === "ADDED"));
  const cmpReverse = compareCompetitionConfigurationsCommand({
    tenantId: definition.tenantId,
    left: updated.value,
    right: created.value,
  });
  assert.equal(cmpReverse.ok, true);
  assert.ok(cmpReverse.value.differences.some((d) => d.changeType === "REMOVED"));
});

test("50) deterministic diff ordering", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  const updated = updateDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: created.value.revision,
    sections: {
      format: { sectionId: "format", formatBlueprintId: "internal_tournament" },
      participant_mode: { sectionId: "participant_mode", participantMode: "individual" },
    },
    repository: repo,
  });
  assert.equal(updated.ok, true);
  const cmp = compareCompetitionConfigurationsCommand({
    tenantId: definition.tenantId,
    left: created.value,
    right: updated.value,
  });
  assert.equal(cmp.ok, true);
  const paths = cmp.value.differences.map((d) => d.path);
  const sorted = sortConfigurationDifferences(cmp.value.differences).map((d) => d.path);
  assert.deepEqual(paths, sorted);
});

test("51) cross-tenant compare rejection", () => {
  const repoA = createRepo();
  const repoB = createRepo();
  const defA = createInternalDraft({ tenantId: "tenant-1", competitionId: "comp-cmp" });
  const defB = createInternalDraft({ tenantId: "tenant-2", competitionId: "comp-cmp" });
  const left = createEmptyConfig(defA, repoA);
  const right = createEmptyConfig(defB, repoB);
  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  const cmp = compareCompetitionConfigurationsCommand({
    tenantId: "tenant-1",
    left: left.value,
    right: right.value,
  });
  assert.equal(cmp.ok, false);
  assert.ok(hasError(cmp, COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_TENANT_DENIED));
});

test("52) cross-competition compare rejection", () => {
  const repo = createRepo();
  const defA = createInternalDraft({ competitionId: "comp-x" });
  const defB = createInternalDraft({ competitionId: "comp-y" });
  const left = createEmptyConfig(defA, repo);
  const right = createEmptyConfig(defB, repo);
  assert.equal(left.ok, true);
  assert.equal(right.ok, true);
  const cmp = compareCompetitionConfigurationsCommand({
    tenantId: "tenant-1",
    left: left.value,
    right: right.value,
  });
  assert.equal(cmp.ok, false);
  assert.ok(hasError(cmp, COMPETITION_CONFIGURATION_ERROR_CODE.CROSS_COMPETITION_COMPARE));
});

test("53) snapshot deterministic", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  const snap1 = projectCompetitionConfigurationSnapshotCommand({ configuration: created.value });
  const snap2 = projectCompetitionConfigurationSnapshotCommand({ configuration: created.value });
  assert.equal(snap1.ok, true);
  assert.equal(snap2.ok, true);
  assert.equal(snap1.value.fingerprint, snap2.value.fingerprint);
  assert.deepEqual(snap1.value, snap2.value);
});

test("54) snapshot immutable/copy-safe", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  const snap = projectCompetitionConfigurationSnapshot({ configuration: created.value });
  assert.equal(snap.ok, true);
  assert.ok(Object.isFrozen(snap.value));
  assert.ok(Object.isFrozen(snap.value.sections));
  assert.throws(() => {
    snap.value.configurationId = "hacked";
  });
});

test("55) snapshot excludes UI state (metadata.uiWizardState rejected)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    metadata: { uiWizardState: { step: 2 } },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT));
});

test("56) snapshot excludes runtime engine state (metadata.engineRuntime rejected)", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const result = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    metadata: { engineRuntime: { matchId: "m1" } },
    repository: repo,
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT));
});

test("57) snapshot preserves stable references", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: {
      division: {
        sectionId: "division",
        divisionBlueprintReference: {
          capabilityOwner: COMPETITION_CONFIGURATION_CAPABILITY_OWNER.CORE_DIVISION,
          referenceId: "division-proposal-1",
          resolutionStatus: "opaque_proposal",
        },
      },
    },
    repository: repo,
  });
  assert.equal(created.ok, true);
  const snap = projectCompetitionConfigurationSnapshot({ configuration: created.value });
  assert.equal(snap.ok, true);
  assert.equal(
    snap.value.sections.division.divisionBlueprintReference.referenceId,
    "division-proposal-1"
  );
});

test("58) repository tenant isolation", () => {
  const repo = createRepo();
  const defA = createInternalDraft({ tenantId: "tenant-1", competitionId: "comp-shared" });
  const created = createEmptyConfig(defA, repo);
  assert.equal(created.ok, true);
  const lookup = repo.findConfiguration({ tenantId: "tenant-2", competitionId: "comp-shared" });
  assert.equal(lookup.ok, false);
  assert.ok(hasError(lookup, COMPETITION_CONFIGURATION_ERROR_CODE.CONFIGURATION_NOT_FOUND));
});

test("59) repository competition isolation", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  assert.equal(created.ok, true);
  const lookup = repo.findConfiguration({ tenantId: "tenant-1", competitionId: "comp-other" });
  assert.equal(lookup.ok, false);
  assert.ok(hasError(lookup, COMPETITION_CONFIGURATION_ERROR_CODE.CONFIGURATION_NOT_FOUND));
});

test("60) repository optimistic concurrency", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repo);
  assert.equal(created.ok, true);
  const stale = updateDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: 99,
    sections: { format: { sectionId: "format", formatBlueprintId: "internal_tournament" } },
    repository: repo,
  });
  assert.equal(stale.ok, false);
  assert.ok(hasError(stale, COMPETITION_CONFIGURATION_ERROR_CODE.STALE_CONFIGURATION_REVISION));
});

test("61) legacy safe projection success (officialMode)", () => {
  const result = projectLegacyTournamentToConfigurationSections({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { officialMode: "official_open" },
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.sections.official_mode.officialMode, "official_open");
});

test("62) legacy ambiguous mapping rejection (teamTournamentSettings)", () => {
  const result = projectLegacyTournamentToConfigurationSections({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { teamTournamentSettings: { rosterSize: 8 } },
  });
  assert.equal(result.ok, false);
  assert.ok(hasError(result, COMPETITION_CONFIGURATION_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING));
});

test("63) typed error stability (all codes start with CM04_)", () => {
  for (const code of Object.values(COMPETITION_CONFIGURATION_ERROR_CODE)) {
    assert.ok(String(code).startsWith("CM04_"), `expected CM04_ prefix for ${code}`);
  }
  const err = new CompetitionConfigurationError(
    COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_CONTRACT,
    "x"
  );
  assert.equal(err.code, "CM04_INVALID_CONTRACT");
});

test("64) capability-local public exports + phase dormant + ARCHITECTURE.md exists", () => {
  const required = [
    "COMPETITION_CONFIGURATION_PHASE",
    "COMPETITION_CONFIGURATION_ERROR_CODE",
    "CompetitionConfigurationError",
    "createDraftCompetitionConfiguration",
    "updateDraftCompetitionConfiguration",
    "applyTemplateConfigurationProposal",
    "validateCompetitionConfigurationCommand",
    "compareCompetitionConfigurationsCommand",
    "projectCompetitionConfigurationSnapshotCommand",
    "getCompetitionConfiguration",
    "createCapabilityLocalConfigurationRepository",
    "createInMemoryCompetitionConfigurationRepository",
    "compareCompetitionConfigurations",
    "projectCompetitionConfigurationSnapshot",
    "projectLegacyTournamentToConfigurationSections",
    "createUnimplementedCompetitionConfigurationRepositoryPort",
  ];
  for (const name of required) {
    assert.ok(name in cm04, `missing export: ${name}`);
    assert.ok(name in cmRoot, `missing root export: ${name}`);
  }
  assert.equal(COMPETITION_CONFIGURATION_PHASE.id, "CM-04");
  assert.equal(COMPETITION_CONFIGURATION_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMPETITION_CONFIGURATION_PHASE.hasPersistence, false);
  assert.equal(COMPETITION_CONFIGURATION_PHASE.hasUi, false);
  assert.equal(COMPETITION_CONFIGURATION_PHASE.repositoryMode, "capability-local-in-memory");
  assert.equal(cmRoot.COMPETITION_CONFIGURATION_PHASE.id, "CM-04");
  assert.ok(fs.existsSync(path.join(MODULE_ROOT, "ARCHITECTURE.md")));
});

test("65) CM-01 regression: createDraft still works", () => {
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

test("66) CM-02 regression: phase still on root barrel", () => {
  assert.equal(cmRoot.COMPETITION_TEMPLATE_INSTANTIATION_PHASE.id, "CM-02");
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.wiredToProductionRuntime, false);
  const definition = createInternalDraft();
  const instantiation = buildInstantiation(definition);
  assert.equal(instantiation.ok, true);
  assert.equal(instantiation.value.plan.selectedTemplate.templateId, "cm-global-internal-tournament");
});

test("67) CM-03 regression: phase still on root barrel", () => {
  assert.equal(cmRoot.COMPETITION_VERSIONING_PHASE.id, "CM-03");
  assert.equal(COMPETITION_VERSIONING_PHASE.wiredToProductionRuntime, false);
});

test("68) no database/runtime write (phase flags)", () => {
  assert.equal(COMPETITION_CONFIGURATION_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMPETITION_CONFIGURATION_PHASE.hasPersistence, false);
  assert.equal(COMPETITION_CONFIGURATION_PHASE.hasMigration, false);
  assert.equal(COMPETITION_CONFIGURATION_PHASE.migrationAuthored, false);
  assert.equal(COMPETITION_CONFIGURATION_PHASE.migrationApplied, false);
});

test("69) no publication ownership", () => {
  assert.equal(COMPETITION_CONFIGURATION_PHASE.ownsPublicationStates, false);
  assert.deepEqual([...COMPETITION_CONFIGURATION_STATUS_VALUES], ["draft", "locked"]);
  assert.ok(!COMPETITION_CONFIGURATION_STATUS_VALUES.includes("published"));
});

test("70) repeated execution produces stable output", () => {
  const definition = createInternalDraft({ competitionId: "comp-stable" });
  const repoA = createRepo();
  const repoB = createRepo();
  const sections = {
    participant_mode: { sectionId: "participant_mode", participantMode: "individual" },
    format: { sectionId: "format", formatBlueprintId: "internal_tournament" },
  };
  const a = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections,
    repository: repoA,
  });
  const b = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections,
    repository: repoB,
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(a.value, b.value);
  const snapA = projectCompetitionConfigurationSnapshot({ configuration: a.value });
  const snapB = projectCompetitionConfigurationSnapshot({ configuration: b.value });
  assert.equal(snapA.value.fingerprint, snapB.value.fingerprint);
});

test("71) unimplemented port throws CM04_PORT_OPERATION_UNIMPLEMENTED", () => {
  const port = createUnimplementedCompetitionConfigurationRepositoryPort();
  assert.throws(
    () => port.createConfiguration(),
    (err) =>
      err instanceof CompetitionConfigurationError &&
      err.code === COMPETITION_CONFIGURATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  assert.throws(
    () => port.findConfiguration(),
    (err) =>
      err instanceof CompetitionConfigurationError &&
      err.code === COMPETITION_CONFIGURATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  assert.throws(
    () => port.saveConfigurationWithExpectedRevision(),
    (err) =>
      err instanceof CompetitionConfigurationError &&
      err.code === COMPETITION_CONFIGURATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
});

test("72) locked configuration cannot update", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const lockedCandidate = validateCompetitionConfigurationInput(
    {
      tenantId: definition.tenantId,
      competitionId: definition.competitionId,
      revision: 1,
      status: COMPETITION_CONFIGURATION_STATUS.LOCKED,
      sourceDefinitionRevision: definition.revision,
      competitionType: definition.competitionType,
      scope: definition.scope,
      sections: {},
      metadata: {},
    },
    { requireEditableStatus: false, definition }
  );
  assert.equal(lockedCandidate.ok, true);
  const saved = repo.createConfiguration(lockedCandidate.value);
  assert.equal(saved.ok, true);

  const attemptUpdate = updateDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: 1,
    sections: { format: { sectionId: "format", formatBlueprintId: "internal_tournament" } },
    repository: repo,
  });
  assert.equal(attemptUpdate.ok, false);
  assert.ok(
    hasError(attemptUpdate, COMPETITION_CONFIGURATION_ERROR_CODE.NON_EDITABLE_CONFIGURATION)
  );
});

test("73) no-op update returns unchanged revision", () => {
  const repo = createRepo();
  const definition = createInternalDraft();
  const created = createDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    sections: { format: { sectionId: "format", formatBlueprintId: "internal_tournament" } },
    repository: repo,
  });
  assert.equal(created.ok, true);
  const noop = updateDraftCompetitionConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedConfigurationRevision: created.value.revision,
    sections: { format: { sectionId: "format", formatBlueprintId: "internal_tournament" } },
    repository: repo,
  });
  assert.equal(noop.ok, true, noop.ok ? "" : noop.explanation?.summary);
  assert.equal(noop.value.revision, created.value.revision);
  assert.ok(noop.explanation.reasons.includes(COMPETITION_CONFIGURATION_ERROR_CODE.NO_OP));
});

test("extra) validateCompetitionConfigurationCommand query-only validation", () => {
  const definition = createInternalDraft();
  const result = validateCompetitionConfigurationCommand({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    configuration: {
      configurationId: `cc::${definition.tenantId}::${definition.competitionId}`,
      tenantId: definition.tenantId,
      competitionId: definition.competitionId,
      revision: 1,
      status: COMPETITION_CONFIGURATION_STATUS.DRAFT,
      sourceDefinitionRevision: definition.revision,
      competitionType: definition.competitionType,
      scope: definition.scope,
      sections: {},
      metadata: {},
    },
  });
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
});

test("extra) createCapabilityLocalConfigurationRepository produces an independent repository", () => {
  const repoA = createCapabilityLocalConfigurationRepository();
  const repoB = createCapabilityLocalConfigurationRepository();
  const definition = createInternalDraft();
  const created = createEmptyConfig(definition, repoA);
  assert.equal(created.ok, true);
  const lookupInOther = repoB.findConfiguration({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
  });
  assert.equal(lookupInOther.ok, false);
});
