import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as cm08 from "../src/features/competition-management/competition-archive/index.js";
import * as cmRoot from "../src/features/competition-management/index.js";
import {
  COMPETITION_ARCHIVE_PHASE,
  COMPETITION_ARCHIVE_STATE,
  COMPETITION_ARCHIVE_ACTION,
  COMPETITION_ARCHIVE_ERROR_CODE,
  COMPETITION_ARCHIVE_INITIAL_REVISION,
  COMPETITION_ARCHIVE_REASON_CODE,
  COMPETITION_UNARCHIVE_REASON_CODE,
  COMPETITION_ARCHIVE_POLICY_PROFILE,
  COMPETITION_PUBLICATION_CONTEXT_PRESENCE,
  COMPETITION_OPTIONAL_CONTEXT_PRESENCE,
  COMPETITION_ARCHIVE_AUTHORIZATION_DECISION,
  COMPETITION_ARCHIVE_ACTOR_TYPE,
  COMPETITION_ARCHIVE_INTENT_TYPE,
  COMPETITION_ARCHIVE_INTENT_TYPE_VALUES,
  COMPETITION_ARCHIVE_FINALIZATION_KIND,
  COMPETITION_ARCHIVE_FINGERPRINT_ALGORITHM,
  archiveCompetition,
  unarchiveCompetition,
  getCurrentCompetitionArchiveState,
  listCompetitionArchiveHistory,
  evaluateCompetitionArchiveEligibilityCommand,
  createInMemoryCompetitionArchiveRepository,
  projectLegacyTournamentArchiveObservation,
  LEGACY_ARCHIVE_COMPATIBILITY,
  projectCompetitionArchiveState,
  clonePlain,
  deepFreeze,
} from "../src/features/competition-management/competition-archive/index.js";

import {
  COMPETITION_TYPE,
  COMPETITION_SCOPE,
  COMPETITION_VISIBILITY,
  COMPETITION_OWNER_TYPE,
  COMPETITION_DEFINITION_STATUS,
  createDraftCompetitionDefinition,
  COMPETITION_DEFINITION_PHASE,
} from "../src/features/competition-management/competition-definition/index.js";

import { COMPETITION_TEMPLATE_INSTANTIATION_PHASE } from "../src/features/competition-management/template-instantiation/index.js";
import { COMPETITION_VERSIONING_PHASE } from "../src/features/competition-management/competition-versioning/index.js";
import { COMPETITION_CONFIGURATION_PHASE } from "../src/features/competition-management/competition-configuration/index.js";
import { COMPETITION_BRANDING_PHASE } from "../src/features/competition-management/competition-branding/index.js";
import { COMPETITION_PUBLICATION_PHASE } from "../src/features/competition-management/competition-publication/index.js";
import { COMPETITION_SUSPENSION_CANCELLATION_PHASE } from "../src/features/competition-management/competition-suspension-cancellation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/competition-management/competition-archive"
);

const NOW = "2026-07-24T12:00:00.000Z";
const LATER = "2026-07-25T12:00:00.000Z";
const REG_OPEN = "2026-08-01T00:00:00.000Z";
const REG_CLOSE = "2026-08-10T00:00:00.000Z";
const START = "2026-08-15T00:00:00.000Z";
const END = "2026-08-17T00:00:00.000Z";
const LIFECYCLE_RECORD_ID = "clife::tenant-1::comp-1::1";

function hasError(result, code) {
  return Boolean(result.errors?.some((e) => e.code === code));
}

function createDefinition(overrides = {}) {
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

function baseActor(overrides = {}) {
  return {
    actorId: "user-1",
    actorType: COMPETITION_ARCHIVE_ACTOR_TYPE.USER,
    tenantId: "tenant-1",
    roleReference: "ORGANIZER",
    ...overrides,
  };
}

function baseAuthority(overrides = {}) {
  return {
    authorizationDecision: COMPETITION_ARCHIVE_AUTHORIZATION_DECISION.ALLOWED,
    authorizationPolicyId: "cm08-archive-v1",
    authorizationPolicyVersion: "1",
    decisionReference: "authz-dec-1",
    decidedAt: NOW,
    ...overrides,
  };
}

function absentPublication() {
  return { presence: COMPETITION_PUBLICATION_CONTEXT_PRESENCE.ABSENT };
}

function presentPublication(overrides = {}) {
  return {
    presence: COMPETITION_PUBLICATION_CONTEXT_PRESENCE.PRESENT,
    publicationId: "cpub::tenant-1::comp-1::PUBLIC_PORTAL::1",
    publicationRevision: 1,
    tenantId: "tenant-1",
    competitionId: "comp-1",
    channel: "PUBLIC_PORTAL",
    ...overrides,
  };
}

function versionContext(overrides = {}) {
  return {
    competitionVersionId: "cver::tenant-1::comp-1::1",
    versionNumber: 1,
    tenantId: "tenant-1",
    competitionId: "comp-1",
    ...overrides,
  };
}

function cancelledLifecycle(overrides = {}) {
  return {
    state: "CANCELLED",
    lifecycleRecordId: LIFECYCLE_RECORD_ID,
    lifecycleRevision: 1,
    evidenceType: "CM07_TERMINAL_CANCEL",
    evidenceReference: LIFECYCLE_RECORD_ID,
    tenantId: "tenant-1",
    competitionId: "comp-1",
    ...overrides,
  };
}

function completedContext(overrides = {}) {
  return {
    completed: true,
    evidenceType: "EXPLICIT_COMPLETION_DECLARATION",
    evidenceReference: "completion-ref-1",
    completedAt: NOW,
    ...overrides,
  };
}

function archiveCmd(definition, repo, overrides = {}) {
  return {
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedArchiveRevision: 0,
    versionContext: versionContext(),
    configurationContext: { presence: COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT },
    brandingContext: { presence: COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT },
    publicationContext: absentPublication(),
    lifecycleContext: cancelledLifecycle(),
    archivePolicyProfile: COMPETITION_ARCHIVE_POLICY_PROFILE.CM08_STANDARD_FINALIZED_V1,
    reason: {
      code: COMPETITION_ARCHIVE_REASON_CODE.COMPETITION_CANCELLED,
      summary: "Competition cancelled; archiving per retention policy",
    },
    actor: baseActor(),
    authority: baseAuthority(),
    effectiveAt: NOW,
    idempotencyKey: "archive-1",
    retentionAcknowledged: true,
    repository: repo,
    ...overrides,
  };
}

function unarchiveCmd(definition, repo, overrides = {}) {
  return {
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedArchiveRevision: 1,
    publicationContext: absentPublication(),
    archivePolicyProfile: COMPETITION_ARCHIVE_POLICY_PROFILE.CM08_STANDARD_FINALIZED_V1,
    reason: {
      code: COMPETITION_UNARCHIVE_REASON_CODE.ARCHIVED_IN_ERROR,
      summary: "Archived in error; restoring competition visibility",
    },
    actor: baseActor(),
    authority: baseAuthority({ authorityScope: "ELEVATED_UNARCHIVE" }),
    effectiveAt: LATER,
    idempotencyKey: "unarchive-1",
    repository: repo,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Phase / exports
// ---------------------------------------------------------------------------

test("CM-08 phase is dormant and does not claim foreign ownership", () => {
  assert.equal(COMPETITION_ARCHIVE_PHASE.id, "CM-08");
  assert.equal(COMPETITION_ARCHIVE_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMPETITION_ARCHIVE_PHASE.hasPersistence, false);
  assert.equal(COMPETITION_ARCHIVE_PHASE.hasMigration, false);
  assert.equal(COMPETITION_ARCHIVE_PHASE.ownsArchive, true);
  assert.equal(COMPETITION_ARCHIVE_PHASE.ownsDelete, false);
  assert.equal(COMPETITION_ARCHIVE_PHASE.ownsPurge, false);
  assert.equal(COMPETITION_ARCHIVE_PHASE.ownsCore22Export, false);
  assert.equal(COMPETITION_ARCHIVE_PHASE.ownsCore23Recovery, false);
  assert.equal(COMPETITION_ARCHIVE_PHASE.productionEffectsExecuted, false);
  assert.equal(cmRoot.COMPETITION_ARCHIVE_PHASE.id, "CM-08");
  assert.equal(typeof cm08.archiveCompetition, "function");
  assert.equal(typeof cm08.unarchiveCompetition, "function");
  assert.equal(Object.isFrozen(COMPETITION_ARCHIVE_INTENT_TYPE_VALUES), true);
});

test("Initial UNARCHIVED projection revision 0 when no archive record", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const current = getCurrentCompetitionArchiveState({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    repository: repo,
  });
  assert.equal(current.ok, true);
  assert.equal(current.value.state, COMPETITION_ARCHIVE_STATE.UNARCHIVED);
  assert.equal(current.value.revision, 0);
  assert.equal(current.value.hasArchiveRecord, false);
  assert.equal(projectCompetitionArchiveState(null), COMPETITION_ARCHIVE_STATE.UNARCHIVED);
});

// ---------------------------------------------------------------------------
// Valid archive paths
// ---------------------------------------------------------------------------

test("Valid CANCELLED archive creates revision 1 immutable record", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const before = clonePlain(definition);
  const result = archiveCompetition(archiveCmd(definition, repo));
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.record.revision, COMPETITION_ARCHIVE_INITIAL_REVISION);
  assert.equal(result.value.record.action, COMPETITION_ARCHIVE_ACTION.ARCHIVE);
  assert.equal(result.value.record.fromState, COMPETITION_ARCHIVE_STATE.UNARCHIVED);
  assert.equal(result.value.record.toState, COMPETITION_ARCHIVE_STATE.ARCHIVED);
  assert.equal(result.value.record.previousRecordId, null);
  assert.equal(
    result.value.record.source.sourceFinalizationKind,
    COMPETITION_ARCHIVE_FINALIZATION_KIND.CANCELLED
  );
  assert.equal(result.value.definitionMutated, false);
  assert.equal(result.value.publicationMutated, false);
  assert.equal(result.value.lifecycleMutated, false);
  assert.equal(result.value.effectPlan.executed, false);
  assert.deepEqual(definition, before);
  assert.ok(Object.isFrozen(result.value.record));
});

test("Valid COMPLETED archive with explicit completion evidence", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const result = archiveCompetition(
    archiveCmd(definition, repo, {
      lifecycleContext: undefined,
      completionContext: completedContext(),
      reason: {
        code: COMPETITION_ARCHIVE_REASON_CODE.COMPETITION_COMPLETED,
        summary: "Competition completed; archiving results",
      },
      idempotencyKey: "archive-completed-1",
    })
  );
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.record.toState, COMPETITION_ARCHIVE_STATE.ARCHIVED);
  assert.equal(
    result.value.record.source.sourceFinalizationKind,
    COMPETITION_ARCHIVE_FINALIZATION_KIND.COMPLETED
  );
  assert.equal(
    result.value.record.source.sourceCompletionEvidenceReference,
    "completion-ref-1"
  );
});

// ---------------------------------------------------------------------------
// Identity / definition validation
// ---------------------------------------------------------------------------

test("Missing tenantId / competitionId rejected", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const noTenant = archiveCompetition(
    archiveCmd(definition, repo, { tenantId: "" })
  );
  assert.equal(noTenant.ok, false);
  assert.ok(hasError(noTenant, COMPETITION_ARCHIVE_ERROR_CODE.MISSING_TENANT));

  const noComp = archiveCompetition(
    archiveCmd(definition, repo, { competitionId: "   " })
  );
  assert.equal(noComp.ok, false);
  assert.ok(hasError(noComp, COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION));
});

test("Tenant / competition mismatch on definition rejected", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const badTenant = archiveCompetition(
    archiveCmd(definition, repo, {
      definition: { ...definition, tenantId: "other-tenant" },
    })
  );
  assert.equal(badTenant.ok, false);
  assert.ok(hasError(badTenant, COMPETITION_ARCHIVE_ERROR_CODE.TENANT_MISMATCH));

  const badComp = archiveCompetition(
    archiveCmd(definition, repo, {
      definition: { ...definition, competitionId: "other-comp" },
    })
  );
  assert.equal(badComp.ok, false);
  assert.ok(hasError(badComp, COMPETITION_ARCHIVE_ERROR_CODE.COMPETITION_MISMATCH));
});

test("Invalid definition / stale definition revision rejected", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const invalid = archiveCompetition(
    archiveCmd(definition, repo, { definition: null })
  );
  assert.equal(invalid.ok, false);
  assert.ok(hasError(invalid, COMPETITION_ARCHIVE_ERROR_CODE.INVALID_DEFINITION));

  const stale = archiveCompetition(
    archiveCmd(definition, repo, { expectedDefinitionRevision: 999 })
  );
  assert.equal(stale.ok, false);
  assert.ok(hasError(stale, COMPETITION_ARCHIVE_ERROR_CODE.STALE_DEFINITION_REVISION));
});

test("Expected definition revision success path", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const result = archiveCompetition(archiveCmd(definition, repo));
  assert.equal(result.ok, true);
  assert.equal(
    result.value.record.source.sourceDefinitionRevision,
    definition.revision
  );
});

// ---------------------------------------------------------------------------
// Version context
// ---------------------------------------------------------------------------

test("Missing competition version / version tenant-competition mismatch", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();

  const noVersion = archiveCompetition(
    archiveCmd(definition, repo, { versionContext: undefined, idempotencyKey: "v1" })
  );
  assert.ok(hasError(noVersion, COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION_VERSION));

  const tenantMismatch = archiveCompetition(
    archiveCmd(definition, repo, {
      versionContext: versionContext({ tenantId: "other-tenant" }),
      idempotencyKey: "v2",
    })
  );
  assert.ok(
    hasError(tenantMismatch, COMPETITION_ARCHIVE_ERROR_CODE.SOURCE_VERSION_TENANT_MISMATCH)
  );

  const compMismatch = archiveCompetition(
    archiveCmd(definition, repo, {
      versionContext: versionContext({ competitionId: "other-comp" }),
      idempotencyKey: "v3",
    })
  );
  assert.ok(
    hasError(compMismatch, COMPETITION_ARCHIVE_ERROR_CODE.SOURCE_VERSION_COMPETITION_MISMATCH)
  );
});

test("No implicit latest version — omit versionContext fails", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const absentPresence = archiveCompetition(
    archiveCmd(definition, repo, {
      versionContext: { presence: COMPETITION_OPTIONAL_CONTEXT_PRESENCE.ABSENT },
      idempotencyKey: "v-absent",
    })
  );
  assert.ok(
    hasError(absentPresence, COMPETITION_ARCHIVE_ERROR_CODE.MISSING_COMPETITION_VERSION)
  );
});

// ---------------------------------------------------------------------------
// Finalization / lifecycle / completion
// ---------------------------------------------------------------------------

test("Missing lifecycle and completion context rejected", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const missing = archiveCompetition(
    archiveCmd(definition, repo, {
      lifecycleContext: undefined,
      completionContext: undefined,
      idempotencyKey: "fin-missing",
    })
  );
  assert.ok(
    hasError(missing, COMPETITION_ARCHIVE_ERROR_CODE.MISSING_LIFECYCLE_OR_COMPLETION_CONTEXT)
  );
});

test("ACTIVE and SUSPENDED not archivable under STANDARD policy", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const baseLifecycle = {
    lifecycleRecordId: LIFECYCLE_RECORD_ID,
    lifecycleRevision: 1,
    tenantId: "tenant-1",
    competitionId: "comp-1",
  };

  const active = archiveCompetition(
    archiveCmd(definition, repo, {
      lifecycleContext: { ...baseLifecycle, state: "ACTIVE" },
      idempotencyKey: "lc-active",
    })
  );
  assert.ok(
    hasError(active, COMPETITION_ARCHIVE_ERROR_CODE.LIFECYCLE_STATE_NOT_ARCHIVABLE)
  );

  const suspended = archiveCompetition(
    archiveCmd(definition, repo, {
      lifecycleContext: { ...baseLifecycle, state: "SUSPENDED" },
      idempotencyKey: "lc-suspended",
    })
  );
  assert.ok(
    hasError(suspended, COMPETITION_ARCHIVE_ERROR_CODE.LIFECYCLE_STATE_NOT_ARCHIVABLE)
  );
});

test("CANCELLED lifecycle archivable under STANDARD policy", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const result = archiveCompetition(
    archiveCmd(definition, repo, { idempotencyKey: "lc-cancelled" })
  );
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
});

test("COMPLETED requires explicit evidence — completed:true without evidence fails", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const noEvidence = archiveCompetition(
    archiveCmd(definition, repo, {
      lifecycleContext: undefined,
      completionContext: { completed: true },
      idempotencyKey: "comp-no-evidence",
    })
  );
  assert.ok(
    hasError(noEvidence, COMPETITION_ARCHIVE_ERROR_CODE.COMPLETION_EVIDENCE_MISSING)
  );
});

test("Cancelled evidence mismatch when evidenceReference != lifecycleRecordId", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const mismatch = archiveCompetition(
    archiveCmd(definition, repo, {
      lifecycleContext: cancelledLifecycle({ evidenceReference: "wrong-ref" }),
      idempotencyKey: "ev-mismatch",
    })
  );
  assert.ok(
    hasError(mismatch, COMPETITION_ARCHIVE_ERROR_CODE.CANCELLATION_EVIDENCE_MISMATCH)
  );
});

// ---------------------------------------------------------------------------
// Publication context
// ---------------------------------------------------------------------------

test("Valid present publication; tenant mismatch; explicit ABSENT", () => {
  const definition = createDefinition();

  const repoPresent = createInMemoryCompetitionArchiveRepository();
  const withPresent = archiveCompetition(
    archiveCmd(definition, repoPresent, {
      publicationContext: presentPublication(),
      idempotencyKey: "pub-present",
    })
  );
  assert.equal(withPresent.ok, true, withPresent.ok ? "" : withPresent.explanation?.summary);
  assert.equal(
    withPresent.value.record.source.sourcePublicationPresence,
    COMPETITION_PUBLICATION_CONTEXT_PRESENCE.PRESENT
  );

  const repoTenant = createInMemoryCompetitionArchiveRepository();
  const tenantMismatch = archiveCompetition(
    archiveCmd(definition, repoTenant, {
      publicationContext: presentPublication({ tenantId: "other-tenant" }),
      idempotencyKey: "pub-tenant",
    })
  );
  assert.ok(hasError(tenantMismatch, COMPETITION_ARCHIVE_ERROR_CODE.TENANT_MISMATCH));

  const repoStale = createInMemoryCompetitionArchiveRepository();
  const staleRevision = archiveCompetition(
    archiveCmd(definition, repoStale, {
      publicationContext: presentPublication({ publicationRevision: 0 }),
      idempotencyKey: "pub-stale",
    })
  );
  assert.ok(
    hasError(staleRevision, COMPETITION_ARCHIVE_ERROR_CODE.STALE_PUBLICATION_REVISION)
  );

  const repoAbsent = createInMemoryCompetitionArchiveRepository();
  const absent = archiveCompetition(
    archiveCmd(definition, repoAbsent, {
      publicationContext: absentPublication(),
      idempotencyKey: "pub-absent",
    })
  );
  assert.equal(absent.ok, true, absent.ok ? "" : absent.explanation?.summary);
  assert.equal(
    absent.value.record.source.sourcePublicationPresence,
    COMPETITION_PUBLICATION_CONTEXT_PRESENCE.ABSENT
  );
});

// ---------------------------------------------------------------------------
// Archive policy
// ---------------------------------------------------------------------------

test("Valid policy; unknown policy; no hidden default when policy omitted", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();

  const valid = archiveCompetition(
    archiveCmd(definition, repo, { idempotencyKey: "pol-valid" })
  );
  assert.equal(valid.ok, true);

  const unknown = archiveCompetition(
    archiveCmd(definition, repo, {
      archivePolicyProfile: "NOT_A_REAL_POLICY",
      idempotencyKey: "pol-unknown",
    })
  );
  assert.ok(hasError(unknown, COMPETITION_ARCHIVE_ERROR_CODE.INVALID_ARCHIVE_POLICY));

  const noPolicy = archiveCompetition(
    archiveCmd(definition, repo, {
      archivePolicyProfile: undefined,
      idempotencyKey: "pol-none",
    })
  );
  assert.ok(hasError(noPolicy, COMPETITION_ARCHIVE_ERROR_CODE.INVALID_ARCHIVE_POLICY));
});

// ---------------------------------------------------------------------------
// Reason validation
// ---------------------------------------------------------------------------

test("Archive reason validation: unknown, OTHER detail, length, control chars", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();

  const unknown = archiveCompetition(
    archiveCmd(definition, repo, {
      reason: { code: "NOT_A_REAL_CODE", summary: "x" },
      idempotencyKey: "r1",
    })
  );
  assert.ok(hasError(unknown, COMPETITION_ARCHIVE_ERROR_CODE.INVALID_ARCHIVE_REASON));

  const otherShort = archiveCompetition(
    archiveCmd(definition, repo, {
      reason: {
        code: COMPETITION_ARCHIVE_REASON_CODE.OTHER,
        summary: "Other reason",
        detail: "short",
      },
      idempotencyKey: "r2",
    })
  );
  assert.ok(hasError(otherShort, COMPETITION_ARCHIVE_ERROR_CODE.MISSING_REASON_DETAIL));

  const tooLong = archiveCompetition(
    archiveCmd(definition, repo, {
      reason: {
        code: COMPETITION_ARCHIVE_REASON_CODE.ORGANIZER_REQUEST,
        summary: "x".repeat(241),
      },
      idempotencyKey: "r3",
    })
  );
  assert.ok(hasError(tooLong, COMPETITION_ARCHIVE_ERROR_CODE.INVALID_REASON_SUMMARY));

  const control = archiveCompetition(
    archiveCmd(definition, repo, {
      reason: {
        code: COMPETITION_ARCHIVE_REASON_CODE.ORGANIZER_REQUEST,
        summary: "bad\u0001summary",
      },
      idempotencyKey: "r4",
    })
  );
  assert.ok(hasError(control, COMPETITION_ARCHIVE_ERROR_CODE.REASON_CONTROL_CHARACTERS));
});

// ---------------------------------------------------------------------------
// Actor / authority / retention / effectiveAt
// ---------------------------------------------------------------------------

test("Actor / authority validation", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();

  const missingActor = archiveCompetition(
    archiveCmd(definition, repo, { actor: null, idempotencyKey: "a1" })
  );
  assert.ok(hasError(missingActor, COMPETITION_ARCHIVE_ERROR_CODE.MISSING_ACTOR));

  const actorMismatch = archiveCompetition(
    archiveCmd(definition, repo, {
      actor: baseActor({ tenantId: "other" }),
      idempotencyKey: "a2",
    })
  );
  assert.ok(hasError(actorMismatch, COMPETITION_ARCHIVE_ERROR_CODE.ACTOR_TENANT_MISMATCH));

  const denied = archiveCompetition(
    archiveCmd(definition, repo, {
      authority: baseAuthority({
        authorizationDecision: COMPETITION_ARCHIVE_AUTHORIZATION_DECISION.DENIED,
      }),
      idempotencyKey: "a3",
    })
  );
  assert.ok(hasError(denied, COMPETITION_ARCHIVE_ERROR_CODE.AUTHORITY_DENIED));

  const missingRef = archiveCompetition(
    archiveCmd(definition, repo, {
      authority: {
        authorizationDecision: COMPETITION_ARCHIVE_AUTHORIZATION_DECISION.ALLOWED,
        authorizationPolicyId: "p",
        authorizationPolicyVersion: "1",
      },
      idempotencyKey: "a4",
    })
  );
  assert.ok(
    hasError(missingRef, COMPETITION_ARCHIVE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE)
  );
});

test("Missing retention acknowledgement rejected", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const noAck = archiveCompetition(
    archiveCmd(definition, repo, {
      retentionAcknowledged: false,
      idempotencyKey: "ret-ack",
    })
  );
  assert.ok(hasError(noAck, COMPETITION_ARCHIVE_ERROR_CODE.MISSING_RETENTION_ACK));
});

test("effectiveAt validation and clock fallback", () => {
  const definition = createDefinition();

  const badEff = archiveCompetition(
    archiveCmd(definition, createInMemoryCompetitionArchiveRepository(), {
      effectiveAt: "not-a-date",
      clock: null,
      idempotencyKey: "t1",
    })
  );
  assert.ok(hasError(badEff, COMPETITION_ARCHIVE_ERROR_CODE.INVALID_EFFECTIVE_TIME));

  const clockOk = archiveCompetition(
    archiveCmd(definition, createInMemoryCompetitionArchiveRepository(), {
      effectiveAt: undefined,
      clock: () => NOW,
      idempotencyKey: "t2",
    })
  );
  assert.equal(clockOk.ok, true, clockOk.ok ? "" : clockOk.explanation?.summary);
});

// ---------------------------------------------------------------------------
// Side-effect flags / effect plan / manifest
// ---------------------------------------------------------------------------

test("Archive does not mutate definition and sets production flags false", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const before = clonePlain(definition);
  const result = archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "flags" }));
  assert.equal(result.ok, true);
  assert.deepEqual(definition, before);
  assert.equal(result.value.deleted, false);
  assert.equal(result.value.purged, false);
  assert.equal(result.value.retentionExecuted, false);
  assert.equal(result.value.storageDeleted, false);
  assert.equal(result.value.publicRouteChanged, false);
  assert.equal(result.value.core22ExportCreated, false);
  assert.equal(result.value.core23RecoveryInvoked, false);
  assert.equal(result.value.productionEffectsExecuted, false);
});

test("Effect plan proposed only with archive intents; no DELETE_NOW or PURGE_NOW", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const result = archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "effects" }));
  assert.equal(result.ok, true);
  const types = result.value.effectPlan.intents.map((i) => i.type);
  assert.ok(types.includes(COMPETITION_ARCHIVE_INTENT_TYPE.CM01_ARCHIVED_STATUS_PATCH_INTENT));
  assert.ok(
    types.includes(COMPETITION_ARCHIVE_INTENT_TYPE.PUBLICATION_ARCHIVE_VISIBILITY_REVIEW_INTENT)
  );
  assert.equal(types.includes("DELETE_NOW"), false);
  assert.equal(types.includes("PURGE_NOW"), false);
  for (const intent of result.value.effectPlan.intents) {
    assert.equal(intent.executed, false);
    assert.equal(intent.proposedOnly, true);
  }
});

test("Manifest fingerprint deterministic; version change alters fingerprint; excludes secrets", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const a = archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "fp1" }));
  const repo2 = createInMemoryCompetitionArchiveRepository();
  const b = archiveCompetition(archiveCmd(definition, repo2, { idempotencyKey: "fp2" }));
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.manifest.fingerprint, b.value.manifest.fingerprint);
  assert.equal(
    a.value.manifest.fingerprintAlgorithm,
    COMPETITION_ARCHIVE_FINGERPRINT_ALGORITHM.id
  );

  const repo3 = createInMemoryCompetitionArchiveRepository();
  const c = archiveCompetition(
    archiveCmd(definition, repo3, {
      idempotencyKey: "fp3",
      versionContext: versionContext({ versionNumber: 2 }),
    })
  );
  assert.equal(c.ok, true);
  assert.notEqual(a.value.manifest.fingerprint, c.value.manifest.fingerprint);

  const manifestJson = JSON.stringify(a.value.manifest);
  for (const secret of ["accessToken", "password", "secret", "token"]) {
    assert.equal(manifestJson.includes(secret), false, `manifest must not include ${secret}`);
  }
  assert.equal(a.value.record.actor.token, undefined);
});

// ---------------------------------------------------------------------------
// Idempotency / concurrency / history
// ---------------------------------------------------------------------------

test("Idempotent retry; semantic conflict; history length stays 1", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const a = archiveCompetition(archiveCmd(definition, repo));
  const b = archiveCompetition(archiveCmd(definition, repo));
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(b.value.replayed, true);
  assert.equal(a.value.record.recordId, b.value.record.recordId);

  const conflict = archiveCompetition(
    archiveCmd(definition, repo, {
      reason: {
        code: COMPETITION_ARCHIVE_REASON_CODE.COMPETITION_CANCELLED,
        summary: "Different reason same key",
      },
    })
  );
  assert.ok(hasError(conflict, COMPETITION_ARCHIVE_ERROR_CODE.IDEMPOTENCY_CONFLICT));

  const history = listCompetitionArchiveHistory({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(history.value.records.length, 1);
});

test("Already archived rejection; stale archive revision; failed command no increment", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const first = archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "arch-first" }));
  assert.equal(first.ok, true);

  const again = archiveCompetition(
    archiveCmd(definition, repo, {
      expectedArchiveRevision: 1,
      idempotencyKey: "arch-second",
    })
  );
  assert.ok(hasError(again, COMPETITION_ARCHIVE_ERROR_CODE.ALREADY_ARCHIVED));

  const stale = archiveCompetition(
    archiveCmd(definition, repo, {
      expectedArchiveRevision: 0,
      idempotencyKey: "arch-stale",
      reason: {
        code: COMPETITION_ARCHIVE_REASON_CODE.COMPETITION_CANCELLED,
        summary: "Stale revision attempt",
      },
    })
  );
  assert.ok(hasError(stale, COMPETITION_ARCHIVE_ERROR_CODE.STALE_ARCHIVE_REVISION));

  const repo2 = createInMemoryCompetitionArchiveRepository();
  const failed = archiveCompetition(
    archiveCmd(definition, repo2, {
      retentionAcknowledged: false,
      idempotencyKey: "arch-fail",
    })
  );
  assert.equal(failed.ok, false);
  const current = getCurrentCompetitionArchiveState({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo2,
  });
  assert.equal(current.value.revision, 0);
});

test("History linear and deterministic; prior record immutable", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const archived = archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "hist-1" }));
  assert.equal(archived.ok, true);

  const unarchived = unarchiveCompetition(
    unarchiveCmd(definition, repo, { idempotencyKey: "hist-2" })
  );
  assert.equal(unarchived.ok, true, unarchived.ok ? "" : unarchived.explanation?.summary);

  const history = listCompetitionArchiveHistory({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(history.value.records.length, 2);
  assert.equal(history.value.records[0].revision, 1);
  assert.equal(history.value.records[1].revision, 2);

  const firstClone = clonePlain(history.value.records[0]);
  firstClone.toState = "HACKED";
  assert.equal(history.value.records[0].toState, COMPETITION_ARCHIVE_STATE.ARCHIVED);
  assert.equal(history.value.records[0].fingerprint, archived.value.record.fingerprint);
});

test("Current state lookup after archive and unarchive", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  assert.equal(
    archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "cur-1" })).ok,
    true
  );
  const archived = getCurrentCompetitionArchiveState({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(archived.value.state, COMPETITION_ARCHIVE_STATE.ARCHIVED);
  assert.equal(archived.value.revision, 1);

  assert.equal(
    unarchiveCompetition(unarchiveCmd(definition, repo, { idempotencyKey: "cur-2" })).ok,
    true
  );
  const unarchived = getCurrentCompetitionArchiveState({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(unarchived.value.state, COMPETITION_ARCHIVE_STATE.UNARCHIVED);
  assert.equal(unarchived.value.revision, 2);
});

test("Tenant and competition isolation; cross-tenant findArchiveRecord fail-closed", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  assert.equal(
    archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "iso-1" })).ok,
    true
  );

  const otherTenant = getCurrentCompetitionArchiveState({
    tenantId: "tenant-2",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(otherTenant.ok, true);
  assert.equal(otherTenant.value.hasArchiveRecord, false);
  assert.equal(otherTenant.value.state, COMPETITION_ARCHIVE_STATE.UNARCHIVED);

  const otherComp = listCompetitionArchiveHistory({
    tenantId: "tenant-1",
    competitionId: "comp-2",
    repository: repo,
  });
  assert.equal(otherComp.ok, true);
  assert.equal(otherComp.value.records.length, 0);

  const cross = repo.findArchiveRecord({
    tenantId: "tenant-2",
    competitionId: "comp-1",
    recordId: "carch::tenant-1::comp-1::1",
  });
  assert.equal(cross.ok, false);
  assert.ok(hasError(cross, COMPETITION_ARCHIVE_ERROR_CODE.CROSS_TENANT_ACCESS));
});

// ---------------------------------------------------------------------------
// Unarchive
// ---------------------------------------------------------------------------

test("Unarchive success with elevated authority increments revision and links previous", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const archived = archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "un-1" }));
  assert.equal(archived.ok, true);

  const unarchived = unarchiveCompetition(unarchiveCmd(definition, repo));
  assert.equal(unarchived.ok, true, unarchived.ok ? "" : unarchived.explanation?.summary);
  assert.equal(unarchived.value.record.revision, 2);
  assert.equal(unarchived.value.record.toState, COMPETITION_ARCHIVE_STATE.UNARCHIVED);
  assert.equal(
    unarchived.value.record.previousRecordId,
    archived.value.record.recordId
  );
  assert.equal(unarchived.value.versionMutated, false);
  assert.equal(unarchived.value.core23RecoveryInvoked, false);
  assert.equal(unarchived.value.productionEffectsExecuted, false);
  const types = unarchived.value.effectPlan.intents.map((i) => i.type);
  assert.ok(types.includes(COMPETITION_ARCHIVE_INTENT_TYPE.PUBLICATION_RESTORE_REVIEW_INTENT));
  assert.equal(types.includes("DELETE_NOW"), false);
  assert.equal(types.includes("PURGE_NOW"), false);
});

test("Unarchive from UNARCHIVED rejects; unarchive without elevated rejects", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();

  const fromUnarchived = unarchiveCompetition(unarchiveCmd(definition, repo));
  assert.ok(hasError(fromUnarchived, COMPETITION_ARCHIVE_ERROR_CODE.NOT_ARCHIVED));

  assert.equal(
    archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "un-2" })).ok,
    true
  );
  const noElevated = unarchiveCompetition(
    unarchiveCmd(definition, repo, {
      authority: baseAuthority(),
      idempotencyKey: "un-3",
    })
  );
  assert.ok(
    hasError(noElevated, COMPETITION_ARCHIVE_ERROR_CODE.ELEVATED_AUTHORITY_REQUIRED)
  );
});

test("Unarchive accepts elevated:true with scopes marker", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  assert.equal(
    archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "un-4" })).ok,
    true
  );
  const result = unarchiveCompetition(
    unarchiveCmd(definition, repo, {
      authority: baseAuthority({
        elevated: true,
        scopes: ["ELEVATED_UNARCHIVE"],
      }),
      idempotencyKey: "un-5",
    })
  );
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
});

// ---------------------------------------------------------------------------
// Boundary / legacy / regression
// ---------------------------------------------------------------------------

test("No delete/purge command exports on archive facade", () => {
  assert.equal(archiveCompetition.deleteCompetition, undefined);
  assert.equal(unarchiveCompetition.deleteCompetition, undefined);
  assert.equal(cm08.deleteCompetition, undefined);
  assert.equal(cm08.purgeCompetition, undefined);
  assert.equal(cm08.purgeNow, undefined);
});

test("Legacy projector: archived observation; deleted/hidden/cancelled/completed not auto archive", () => {
  const archived = projectLegacyTournamentArchiveObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { status: "archived", archivedAt: NOW, archivedBy: "user-1" },
  });
  assert.equal(archived.ok, true);
  assert.equal(archived.value.observedArchivedFlag, true);
  assert.equal(archived.value.isCanonicalArchiveRecord, false);
  assert.equal(archived.value.provenance, "LEGACY_UNVERIFIED");

  const deleted = projectLegacyTournamentArchiveObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { status: "active", deletedAt: NOW },
  });
  assert.equal(deleted.value.claims.deletionIsArchive, false);
  assert.ok(
    deleted.value.issues.some(
      (i) => i.code === COMPETITION_ARCHIVE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING
    )
  );

  const hidden = projectLegacyTournamentArchiveObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { status: "active", hidden: true },
  });
  assert.equal(hidden.value.claims.hiddenIsArchive, false);

  const cancelled = projectLegacyTournamentArchiveObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { status: "cancelled" },
  });
  assert.equal(cancelled.value.claims.cancelledIsArchive, false);

  const completed = projectLegacyTournamentArchiveObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { status: "completed" },
  });
  assert.equal(completed.value.claims.completedIsArchive, false);
  assert.equal(LEGACY_ARCHIVE_COMPATIBILITY.isCanonicalArchiveRecord, false);
});

test("Typed error code stability (CM08_ prefix)", () => {
  for (const code of Object.values(COMPETITION_ARCHIVE_ERROR_CODE)) {
    assert.ok(String(code).startsWith("CM08_"));
  }
});

test("CM-01..CM-07 phase regression still exported from root", () => {
  assert.equal(COMPETITION_DEFINITION_PHASE.id, "CM-01");
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.id, "CM-02");
  assert.equal(COMPETITION_VERSIONING_PHASE.id, "CM-03");
  assert.equal(COMPETITION_CONFIGURATION_PHASE.id, "CM-04");
  assert.equal(COMPETITION_BRANDING_PHASE.id, "CM-05");
  assert.equal(COMPETITION_PUBLICATION_PHASE.id, "CM-06");
  assert.equal(COMPETITION_SUSPENSION_CANCELLATION_PHASE.id, "CM-07");
  assert.equal(cmRoot.COMPETITION_DEFINITION_PHASE.id, "CM-01");
  assert.equal(cmRoot.COMPETITION_PUBLICATION_PHASE.id, "CM-06");
  assert.equal(cmRoot.COMPETITION_SUSPENSION_CANCELLATION_PHASE.id, "CM-07");
  const d = createDefinition({ competitionId: "comp-reg" });
  assert.equal(d.status, COMPETITION_DEFINITION_STATUS.DRAFT);
});

test("No database/runtime write markers in CM-08 module", () => {
  function walk(dir) {
    /** @type {string[]} */
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...walk(full));
      else if (entry.name.endsWith(".js")) files.push(full);
    }
    return files;
  }
  const forbidden = [
    "supabase.from(",
    "db.push",
    "DELETE FROM",
    "purgeNow",
    "createClient",
    "applyMigration",
    "localStorage",
  ];
  for (const file of walk(MODULE_ROOT)) {
    const text = fs.readFileSync(file, "utf8");
    for (const token of forbidden) {
      assert.equal(
        text.includes(token),
        false,
        `${path.relative(MODULE_ROOT, file)} must not contain ${token}`
      );
    }
  }
});

test("Repeated execution stable output across different competitions", () => {
  const definition1 = createDefinition({ competitionId: "comp-a" });
  const definition2 = createDefinition({ competitionId: "comp-b" });

  const repoA1 = createInMemoryCompetitionArchiveRepository();
  const repoA2 = createInMemoryCompetitionArchiveRepository();
  const repoB1 = createInMemoryCompetitionArchiveRepository();
  const repoB2 = createInMemoryCompetitionArchiveRepository();

  const cmdFor = (definition, repo, idempotencyKey) =>
    archiveCmd(definition, repo, {
      competitionId: definition.competitionId,
      versionContext: versionContext({
        competitionId: definition.competitionId,
        competitionVersionId: `cver::tenant-1::${definition.competitionId}::1`,
      }),
      lifecycleContext: cancelledLifecycle({
        competitionId: definition.competitionId,
        lifecycleRecordId: `clife::tenant-1::${definition.competitionId}::1`,
        evidenceReference: `clife::tenant-1::${definition.competitionId}::1`,
      }),
      idempotencyKey,
    });

  const a1 = archiveCompetition(cmdFor(definition1, repoA1, "det-a"));
  const a2 = archiveCompetition(cmdFor(definition1, repoA2, "det-a"));
  const b1 = archiveCompetition(cmdFor(definition2, repoB1, "det-b"));
  const b2 = archiveCompetition(cmdFor(definition2, repoB2, "det-b"));

  assert.equal(a1.ok, true);
  assert.equal(a2.ok, true);
  assert.equal(b1.ok, true);
  assert.equal(b2.ok, true);

  assert.deepEqual(
    a1.value.effectPlan.intents.map((i) => i.type),
    a2.value.effectPlan.intents.map((i) => i.type)
  );
  assert.deepEqual(
    b1.value.effectPlan.intents.map((i) => i.type),
    b2.value.effectPlan.intents.map((i) => i.type)
  );
  assert.equal(a1.value.manifest.fingerprintAlgorithm, COMPETITION_ARCHIVE_FINGERPRINT_ALGORITHM.id);
  assert.equal(b1.value.manifest.fingerprintAlgorithm, COMPETITION_ARCHIVE_FINGERPRINT_ALGORITHM.id);
  assert.notEqual(a1.value.record.fingerprint, b1.value.record.fingerprint);
});

test("Eligibility evaluator without mutation", () => {
  const definition = createDefinition();
  const eligible = evaluateCompetitionArchiveEligibilityCommand({
    action: COMPETITION_ARCHIVE_ACTION.ARCHIVE,
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    publicationContext: absentPublication(),
    versionContext: versionContext(),
    lifecycleContext: cancelledLifecycle(),
    archivePolicyProfile: COMPETITION_ARCHIVE_POLICY_PROFILE.CM08_STANDARD_FINALIZED_V1,
    retentionAcknowledged: true,
    actor: baseActor(),
    authority: baseAuthority(),
    reason: {
      code: COMPETITION_ARCHIVE_REASON_CODE.COMPETITION_CANCELLED,
      summary: "Competition cancelled; eligibility check only",
    },
    currentRecord: null,
  });
  assert.equal(eligible.ok, true, eligible.ok ? "" : eligible.explanation?.summary);
  assert.equal(eligible.value.toState, COMPETITION_ARCHIVE_STATE.ARCHIVED);
});

test("Record copy-safe / deepFreeze; UI state excluded", () => {
  const repo = createInMemoryCompetitionArchiveRepository();
  const definition = createDefinition();
  const result = archiveCompetition(archiveCmd(definition, repo, { idempotencyKey: "freeze" }));
  assert.equal(result.ok, true);
  assert.throws(() => {
    result.value.record.toState = "HACKED";
  });
  assert.equal(result.value.record.ui, undefined);
  assert.equal(result.value.record.selectedTab, undefined);
  const frozen = deepFreeze({ a: 1 });
  assert.ok(Object.isFrozen(frozen));
});
