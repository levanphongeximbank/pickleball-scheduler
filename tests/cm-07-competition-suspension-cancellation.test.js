import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as cm07 from "../src/features/competition-management/competition-suspension-cancellation/index.js";
import * as cmRoot from "../src/features/competition-management/index.js";
import {
  COMPETITION_SUSPENSION_CANCELLATION_PHASE,
  COMPETITION_LIFECYCLE_STATE,
  COMPETITION_LIFECYCLE_ACTION,
  COMPETITION_LIFECYCLE_ERROR_CODE,
  COMPETITION_LIFECYCLE_INITIAL_REVISION,
  COMPETITION_SUSPENSION_REASON_CODE,
  COMPETITION_CANCELLATION_REASON_CODE,
  COMPETITION_RESUME_REASON_CODE,
  COMPETITION_SUSPENSION_PUBLICATION_POLICY,
  COMPETITION_CANCELLATION_PUBLICATION_POLICY,
  COMPETITION_PUBLICATION_CONTEXT_PRESENCE,
  COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION,
  COMPETITION_LIFECYCLE_ACTOR_TYPE,
  COMPETITION_LIFECYCLE_INTENT_TYPE,
  COMPETITION_LIFECYCLE_INTENT_TYPE_VALUES,
  suspendCompetition,
  resumeCompetition,
  cancelCompetition,
  getCurrentCompetitionLifecycle,
  listCompetitionLifecycleHistory,
  evaluateCompetitionLifecycleActionCommand,
  createInMemoryCompetitionLifecycleRepository,
  projectLegacyTournamentLifecycleObservation,
  LEGACY_LIFECYCLE_COMPATIBILITY,
  projectCompetitionLifecycleState,
  clonePlain,
  deepFreeze,
} from "../src/features/competition-management/competition-suspension-cancellation/index.js";

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(
  __dirname,
  "../src/features/competition-management/competition-suspension-cancellation"
);

const NOW = "2026-07-24T12:00:00.000Z";
const LATER = "2026-07-25T12:00:00.000Z";
const REG_OPEN = "2026-08-01T00:00:00.000Z";
const REG_CLOSE = "2026-08-10T00:00:00.000Z";
const START = "2026-08-15T00:00:00.000Z";
const END = "2026-08-17T00:00:00.000Z";

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
    actorType: COMPETITION_LIFECYCLE_ACTOR_TYPE.USER,
    tenantId: "tenant-1",
    roleReference: "ORGANIZER",
    ...overrides,
  };
}

function baseAuthority(overrides = {}) {
  return {
    authorizationDecision: COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION.ALLOWED,
    authorizationPolicyId: "cm07-lifecycle-v1",
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

function suspendCmd(definition, repo, overrides = {}) {
  return {
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedLifecycleRevision: 0,
    actor: baseActor(),
    authority: baseAuthority(),
    reason: {
      code: COMPETITION_SUSPENSION_REASON_CODE.WEATHER,
      summary: "Venue unsafe due to weather",
    },
    effectiveAt: NOW,
    idempotencyKey: "suspend-1",
    publicationPolicy:
      COMPETITION_SUSPENSION_PUBLICATION_POLICY.KEEP_PUBLIC_WITH_SUSPENDED_NOTICE,
    publicationContext: absentPublication(),
    repository: repo,
    ...overrides,
  };
}

function resumeCmd(definition, repo, overrides = {}) {
  return {
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedLifecycleRevision: 1,
    actor: baseActor(),
    authority: baseAuthority(),
    reason: {
      code: COMPETITION_RESUME_REASON_CODE.CONDITIONS_CLEARED,
      summary: "Weather cleared; safe to continue",
    },
    effectiveAt: LATER,
    idempotencyKey: "resume-1",
    publicationContext: absentPublication(),
    repository: repo,
    ...overrides,
  };
}

function cancelCmd(definition, repo, overrides = {}) {
  return {
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    definition,
    expectedDefinitionRevision: definition.revision,
    expectedLifecycleRevision: 0,
    actor: baseActor(),
    authority: baseAuthority(),
    reason: {
      code: COMPETITION_CANCELLATION_REASON_CODE.ORGANIZER_DECISION,
      summary: "Organizer decided to cancel the event",
    },
    effectiveAt: NOW,
    idempotencyKey: "cancel-1",
    publicationPolicy:
      COMPETITION_CANCELLATION_PUBLICATION_POLICY.REQUEST_PERMANENT_WITHDRAWAL,
    publicationContext: absentPublication(),
    dataRetentionAcknowledged: true,
    repository: repo,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Phase / exports
// ---------------------------------------------------------------------------

test("CM-07 phase is dormant and does not claim foreign ownership", () => {
  assert.equal(COMPETITION_SUSPENSION_CANCELLATION_PHASE.id, "CM-07");
  assert.equal(COMPETITION_SUSPENSION_CANCELLATION_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMPETITION_SUSPENSION_CANCELLATION_PHASE.hasPersistence, false);
  assert.equal(COMPETITION_SUSPENSION_CANCELLATION_PHASE.hasMigration, false);
  assert.equal(COMPETITION_SUSPENSION_CANCELLATION_PHASE.ownsArchive, false);
  assert.equal(COMPETITION_SUSPENSION_CANCELLATION_PHASE.ownsMatchCancellation, false);
  assert.equal(COMPETITION_SUSPENSION_CANCELLATION_PHASE.ownsCore23Recovery, false);
  assert.equal(COMPETITION_SUSPENSION_CANCELLATION_PHASE.uncancelSupported, false);
  assert.equal(cmRoot.COMPETITION_SUSPENSION_CANCELLATION_PHASE.id, "CM-07");
  assert.equal(typeof cm07.suspendCompetition, "function");
  assert.equal(typeof cm07.resumeCompetition, "function");
  assert.equal(typeof cm07.cancelCompetition, "function");
  assert.equal(cm07.uncancelCompetition, undefined);
  assert.equal(Object.isFrozen(COMPETITION_LIFECYCLE_INTENT_TYPE_VALUES), true);
});

test("Initial ACTIVE projection when no lifecycle record", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const current = getCurrentCompetitionLifecycle({
    tenantId: definition.tenantId,
    competitionId: definition.competitionId,
    repository: repo,
  });
  assert.equal(current.ok, true);
  assert.equal(current.value.state, COMPETITION_LIFECYCLE_STATE.ACTIVE);
  assert.equal(current.value.revision, 0);
  assert.equal(current.value.hasLifecycleRecord, false);
  assert.equal(projectCompetitionLifecycleState(null), COMPETITION_LIFECYCLE_STATE.ACTIVE);
});

// ---------------------------------------------------------------------------
// Suspend
// ---------------------------------------------------------------------------

test("Valid suspend from ACTIVE creates revision 1 immutable record", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const before = clonePlain(definition);
  const result = suspendCompetition(suspendCmd(definition, repo));
  assert.equal(result.ok, true, result.ok ? "" : result.explanation?.summary);
  assert.equal(result.value.record.revision, COMPETITION_LIFECYCLE_INITIAL_REVISION);
  assert.equal(result.value.record.action, COMPETITION_LIFECYCLE_ACTION.SUSPEND);
  assert.equal(result.value.record.fromState, COMPETITION_LIFECYCLE_STATE.ACTIVE);
  assert.equal(result.value.record.toState, COMPETITION_LIFECYCLE_STATE.SUSPENDED);
  assert.equal(result.value.definitionMutated, false);
  assert.equal(result.value.publicationMutated, false);
  assert.equal(result.value.matchesCancelled, false);
  assert.equal(result.value.effectPlan.executed, false);
  assert.deepEqual(definition, before);
  assert.ok(Object.isFrozen(result.value.record));
});

test("Missing tenantId / competitionId rejected", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const noTenant = suspendCompetition(
    suspendCmd(definition, repo, { tenantId: "" })
  );
  assert.equal(noTenant.ok, false);
  assert.ok(hasError(noTenant, COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_TENANT));

  const noComp = suspendCompetition(
    suspendCmd(definition, repo, { competitionId: "   " })
  );
  assert.equal(noComp.ok, false);
  assert.ok(hasError(noComp, COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_COMPETITION));
});

test("Tenant / competition mismatch on definition rejected", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const badTenant = suspendCompetition(
    suspendCmd(definition, repo, {
      definition: { ...definition, tenantId: "other-tenant" },
    })
  );
  assert.equal(badTenant.ok, false);
  assert.ok(hasError(badTenant, COMPETITION_LIFECYCLE_ERROR_CODE.TENANT_MISMATCH));

  const badComp = suspendCompetition(
    suspendCmd(definition, repo, {
      definition: { ...definition, competitionId: "other-comp" },
    })
  );
  assert.equal(badComp.ok, false);
  assert.ok(hasError(badComp, COMPETITION_LIFECYCLE_ERROR_CODE.COMPETITION_MISMATCH));
});

test("Invalid definition / stale definition revision rejected", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const invalid = suspendCompetition(
    suspendCmd(definition, repo, { definition: null })
  );
  assert.equal(invalid.ok, false);
  assert.ok(hasError(invalid, COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_DEFINITION));

  const stale = suspendCompetition(
    suspendCmd(definition, repo, { expectedDefinitionRevision: 999 })
  );
  assert.equal(stale.ok, false);
  assert.ok(hasError(stale, COMPETITION_LIFECYCLE_ERROR_CODE.STALE_DEFINITION_REVISION));
});

test("Expected definition revision success path", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const result = suspendCompetition(suspendCmd(definition, repo));
  assert.equal(result.ok, true);
  assert.equal(
    result.value.record.source.sourceDefinitionRevision,
    definition.revision
  );
});

test("Suspension reason validation: unknown, OTHER detail, length, control chars", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();

  const unknown = suspendCompetition(
    suspendCmd(definition, repo, {
      reason: { code: "NOT_A_REAL_CODE", summary: "x" },
      idempotencyKey: "r1",
    })
  );
  assert.ok(hasError(unknown, COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_SUSPENSION_REASON));

  const otherShort = suspendCompetition(
    suspendCmd(definition, repo, {
      reason: {
        code: COMPETITION_SUSPENSION_REASON_CODE.OTHER,
        summary: "Other reason",
        detail: "short",
      },
      idempotencyKey: "r2",
    })
  );
  assert.ok(hasError(otherShort, COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_REASON_DETAIL));

  const tooLong = suspendCompetition(
    suspendCmd(definition, repo, {
      reason: { code: COMPETITION_SUSPENSION_REASON_CODE.SAFETY, summary: "x".repeat(281) },
      idempotencyKey: "r3",
    })
  );
  assert.ok(hasError(tooLong, COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_REASON_SUMMARY));

  const control = suspendCompetition(
    suspendCmd(definition, repo, {
      reason: {
        code: COMPETITION_SUSPENSION_REASON_CODE.SAFETY,
        summary: "bad\u0001summary",
      },
      idempotencyKey: "r4",
    })
  );
  assert.ok(hasError(control, COMPETITION_LIFECYCLE_ERROR_CODE.REASON_CONTROL_CHARACTERS));
});

test("Actor / authority validation", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();

  const missingActor = suspendCompetition(
    suspendCmd(definition, repo, { actor: null, idempotencyKey: "a1" })
  );
  assert.ok(hasError(missingActor, COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_ACTOR));

  const actorMismatch = suspendCompetition(
    suspendCmd(definition, repo, {
      actor: baseActor({ tenantId: "other" }),
      idempotencyKey: "a2",
    })
  );
  assert.ok(hasError(actorMismatch, COMPETITION_LIFECYCLE_ERROR_CODE.ACTOR_TENANT_MISMATCH));

  const denied = suspendCompetition(
    suspendCmd(definition, repo, {
      authority: baseAuthority({
        authorizationDecision: COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION.DENIED,
      }),
      idempotencyKey: "a3",
    })
  );
  assert.ok(hasError(denied, COMPETITION_LIFECYCLE_ERROR_CODE.AUTHORITY_DENIED));

  const missingRef = suspendCompetition(
    suspendCmd(definition, repo, {
      authority: {
        authorizationDecision: COMPETITION_LIFECYCLE_AUTHORIZATION_DECISION.ALLOWED,
        authorizationPolicyId: "p",
        authorizationPolicyVersion: "1",
      },
      idempotencyKey: "a4",
    })
  );
  assert.ok(
    hasError(missingRef, COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_AUTHORITY_REFERENCE)
  );
});

test("effectiveAt and intendedResumeAt validation", () => {
  const definition = createDefinition();

  const badEff = suspendCompetition(
    suspendCmd(definition, createInMemoryCompetitionLifecycleRepository(), {
      effectiveAt: "not-a-date",
      clock: null,
      idempotencyKey: "t1",
    })
  );
  assert.ok(hasError(badEff, COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_EFFECTIVE_TIME));

  const clockOk = suspendCompetition(
    suspendCmd(definition, createInMemoryCompetitionLifecycleRepository(), {
      effectiveAt: undefined,
      clock: () => NOW,
      idempotencyKey: "t2",
    })
  );
  assert.equal(clockOk.ok, true, clockOk.ok ? "" : clockOk.explanation?.summary);

  const badResume = suspendCompetition(
    suspendCmd(definition, createInMemoryCompetitionLifecycleRepository(), {
      intendedResumeAt: "2026-07-20T00:00:00.000Z",
      idempotencyKey: "t3",
    })
  );
  assert.ok(
    hasError(badResume, COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_INTENDED_RESUME_TIME)
  );

  const goodResumeAt = suspendCompetition(
    suspendCmd(definition, createInMemoryCompetitionLifecycleRepository(), {
      intendedResumeAt: LATER,
      idempotencyKey: "t4",
    })
  );
  assert.equal(goodResumeAt.ok, true, goodResumeAt.ok ? "" : goodResumeAt.explanation?.summary);
  assert.equal(goodResumeAt.value.record.intendedResumeAt, LATER);
});

test("Suspend creates proposed effects only; KEEP_PUBLIC notice policy", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const result = suspendCompetition(suspendCmd(definition, repo));
  assert.equal(result.ok, true);
  const types = result.value.effectPlan.intents.map((i) => i.type);
  assert.ok(types.includes(COMPETITION_LIFECYCLE_INTENT_TYPE.PAUSE_REGISTRATION_INTENT));
  assert.ok(
    types.includes(COMPETITION_LIFECYCLE_INTENT_TYPE.PUBLICATION_SUSPENSION_NOTICE_INTENT)
  );
  assert.ok(
    types.includes(COMPETITION_LIFECYCLE_INTENT_TYPE.CM01_DEFINITION_STATUS_PATCH_PROPOSAL)
  );
  for (const intent of result.value.effectPlan.intents) {
    assert.equal(intent.executed, false);
    assert.equal(intent.executionStatus, "PROPOSED");
    assert.equal(intent.proposedOnly, true);
  }
});

test("REQUEST_TEMPORARY_WITHDRAWAL policy and no hidden default", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const withPolicy = suspendCompetition(
    suspendCmd(definition, repo, {
      publicationPolicy:
        COMPETITION_SUSPENSION_PUBLICATION_POLICY.REQUEST_TEMPORARY_WITHDRAWAL,
      publicationContext: presentPublication(),
      idempotencyKey: "p1",
    })
  );
  assert.equal(withPolicy.ok, true);
  const types = withPolicy.value.effectPlan.intents.map((i) => i.type);
  assert.ok(types.includes(COMPETITION_LIFECYCLE_INTENT_TYPE.PUBLICATION_WITHDRAWAL_INTENT));

  const noPolicy = suspendCompetition(
    suspendCmd(definition, repo, {
      publicationPolicy: undefined,
      idempotencyKey: "p2",
    })
  );
  assert.ok(
    hasError(noPolicy, COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_PUBLICATION_POLICY)
  );
});

test("Publication context tenant mismatch / stale revision", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const mismatch = suspendCompetition(
    suspendCmd(definition, repo, {
      publicationContext: presentPublication({ tenantId: "other" }),
      idempotencyKey: "pub1",
    })
  );
  assert.ok(hasError(mismatch, COMPETITION_LIFECYCLE_ERROR_CODE.TENANT_MISMATCH));

  const stalePub = suspendCompetition(
    suspendCmd(definition, repo, {
      publicationContext: presentPublication({ publicationRevision: 0 }),
      idempotencyKey: "pub2",
    })
  );
  assert.ok(
    hasError(stalePub, COMPETITION_LIFECYCLE_ERROR_CODE.STALE_PUBLICATION_REVISION)
  );
});

test("Already suspended / cancelled suspend rejection; failed command does not increment", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  assert.equal(suspendCompetition(suspendCmd(definition, repo)).ok, true);

  const again = suspendCompetition(
    suspendCmd(definition, repo, {
      expectedLifecycleRevision: 1,
      idempotencyKey: "suspend-2",
    })
  );
  assert.ok(hasError(again, COMPETITION_LIFECYCLE_ERROR_CODE.ALREADY_SUSPENDED));

  const current = getCurrentCompetitionLifecycle({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(current.value.revision, 1);

  const repo2 = createInMemoryCompetitionLifecycleRepository();
  assert.equal(cancelCompetition(cancelCmd(definition, repo2)).ok, true);
  const suspendCancelled = suspendCompetition(
    suspendCmd(definition, repo2, {
      expectedLifecycleRevision: 1,
      idempotencyKey: "s-after-c",
    })
  );
  assert.ok(
    hasError(suspendCancelled, COMPETITION_LIFECYCLE_ERROR_CODE.CANCELLED_TERMINAL)
  );
});

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

test("Valid resume from SUSPENDED increments revision and links previous", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const suspended = suspendCompetition(suspendCmd(definition, repo));
  assert.equal(suspended.ok, true);

  const resumed = resumeCompetition(resumeCmd(definition, repo));
  assert.equal(resumed.ok, true, resumed.ok ? "" : resumed.explanation?.summary);
  assert.equal(resumed.value.record.revision, 2);
  assert.equal(resumed.value.record.toState, COMPETITION_LIFECYCLE_STATE.ACTIVE);
  assert.equal(
    resumed.value.record.previousRecordId,
    suspended.value.record.recordId
  );
  assert.equal(resumed.value.core23Invoked, false);
  const types = resumed.value.effectPlan.intents.map((i) => i.type);
  assert.ok(
    types.includes(
      COMPETITION_LIFECYCLE_INTENT_TYPE.PUBLICATION_RESTORE_OR_REPUBLISH_REVIEW_INTENT
    )
  );
  assert.ok(
    types.includes(COMPETITION_LIFECYCLE_INTENT_TYPE.REGISTRATION_RESUME_REVIEW_INTENT)
  );
});

test("Resume from ACTIVE / CANCELLED rejected; resume effectiveAt validation", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();

  const fromActive = resumeCompetition(
    resumeCmd(definition, repo, { expectedLifecycleRevision: 0 })
  );
  assert.ok(hasError(fromActive, COMPETITION_LIFECYCLE_ERROR_CODE.NOT_SUSPENDED));

  assert.equal(suspendCompetition(suspendCmd(definition, repo)).ok, true);
  const early = resumeCompetition(
    resumeCmd(definition, repo, {
      effectiveAt: "2026-07-23T00:00:00.000Z",
      idempotencyKey: "resume-early",
    })
  );
  assert.ok(hasError(early, COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_EFFECTIVE_TIME));

  const repo2 = createInMemoryCompetitionLifecycleRepository();
  assert.equal(cancelCompetition(cancelCmd(definition, repo2)).ok, true);
  const fromCancel = resumeCompetition(
    resumeCmd(definition, repo2, {
      expectedLifecycleRevision: 1,
      idempotencyKey: "resume-cancelled",
    })
  );
  assert.ok(hasError(fromCancel, COMPETITION_LIFECYCLE_ERROR_CODE.CANCELLED_TERMINAL));
});

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

test("Valid cancel from ACTIVE and from SUSPENDED; terminal semantics", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const cancelled = cancelCompetition(cancelCmd(definition, repo));
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.value.record.toState, COMPETITION_LIFECYCLE_STATE.CANCELLED);
  assert.equal(cancelled.value.archived, false);
  assert.equal(cancelled.value.deleted, false);
  assert.equal(cancelled.value.matchesCancelled, false);
  const types = cancelled.value.effectPlan.intents.map((i) => i.type);
  assert.ok(
    types.includes(
      COMPETITION_LIFECYCLE_INTENT_TYPE.PERMANENT_PUBLICATION_WITHDRAWAL_INTENT
    )
  );
  assert.ok(
    types.includes(COMPETITION_LIFECYCLE_INTENT_TYPE.ARCHIVE_ELIGIBILITY_REVIEW_INTENT)
  );

  const again = cancelCompetition(
    cancelCmd(definition, repo, {
      expectedLifecycleRevision: 1,
      idempotencyKey: "cancel-2",
    })
  );
  assert.ok(hasError(again, COMPETITION_LIFECYCLE_ERROR_CODE.ALREADY_CANCELLED));

  const repo2 = createInMemoryCompetitionLifecycleRepository();
  assert.equal(suspendCompetition(suspendCmd(definition, repo2)).ok, true);
  const fromSuspended = cancelCompetition(
    cancelCmd(definition, repo2, {
      expectedLifecycleRevision: 1,
      idempotencyKey: "cancel-from-s",
    })
  );
  assert.equal(fromSuspended.ok, true);
  assert.equal(fromSuspended.value.record.fromState, COMPETITION_LIFECYCLE_STATE.SUSPENDED);
});

test("Invalid cancellation reason; missing retention ack", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const bad = cancelCompetition(
    cancelCmd(definition, repo, {
      reason: { code: "NOPE", summary: "x" },
      idempotencyKey: "c-bad",
    })
  );
  assert.ok(hasError(bad, COMPETITION_LIFECYCLE_ERROR_CODE.INVALID_CANCELLATION_REASON));

  const noAck = cancelCompetition(
    cancelCmd(definition, repo, {
      dataRetentionAcknowledged: false,
      idempotencyKey: "c-ack",
    })
  );
  assert.ok(hasError(noAck, COMPETITION_LIFECYCLE_ERROR_CODE.MISSING_DATA_RETENTION_ACK));
});

// ---------------------------------------------------------------------------
// Concurrency / idempotency / history
// ---------------------------------------------------------------------------

test("Stale lifecycle revision rejected; linear history; fingerprints", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const first = suspendCompetition(suspendCmd(definition, repo));
  assert.equal(first.ok, true);

  const stale = suspendCompetition(
    suspendCmd(definition, repo, {
      expectedLifecycleRevision: 0,
      idempotencyKey: "stale-key",
      reason: {
        code: COMPETITION_SUSPENSION_REASON_CODE.SAFETY,
        summary: "Different attempt",
      },
    })
  );
  assert.ok(hasError(stale, COMPETITION_LIFECYCLE_ERROR_CODE.STALE_LIFECYCLE_REVISION));

  const history = listCompetitionLifecycleHistory({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(history.ok, true);
  assert.equal(history.value.records.length, 1);

  assert.equal(resumeCompetition(resumeCmd(definition, repo)).ok, true);
  const history2 = listCompetitionLifecycleHistory({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(history2.value.records.length, 2);
  assert.equal(history2.value.records[0].revision, 1);
  assert.equal(history2.value.records[1].revision, 2);
  // Prior record immutable / unchanged
  assert.equal(history2.value.records[0].fingerprint, first.value.record.fingerprint);
});

test("Idempotent retry returns same result; conflict on semantic change", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const a = suspendCompetition(suspendCmd(definition, repo));
  const b = suspendCompetition(suspendCmd(definition, repo));
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(b.value.replayed, true);
  assert.equal(a.value.record.recordId, b.value.record.recordId);
  assert.equal(a.value.record.fingerprint, b.value.record.fingerprint);

  const conflict = suspendCompetition(
    suspendCmd(definition, repo, {
      reason: {
        code: COMPETITION_SUSPENSION_REASON_CODE.SAFETY,
        summary: "Different reason same key",
      },
    })
  );
  assert.ok(hasError(conflict, COMPETITION_LIFECYCLE_ERROR_CODE.IDEMPOTENCY_CONFLICT));

  const history = listCompetitionLifecycleHistory({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(history.value.records.length, 1);
});

test("Tenant and competition isolation on current/history queries", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  assert.equal(suspendCompetition(suspendCmd(definition, repo)).ok, true);

  const otherTenant = getCurrentCompetitionLifecycle({
    tenantId: "tenant-2",
    competitionId: "comp-1",
    repository: repo,
  });
  assert.equal(otherTenant.ok, true);
  assert.equal(otherTenant.value.hasLifecycleRecord, false);
  assert.equal(otherTenant.value.state, COMPETITION_LIFECYCLE_STATE.ACTIVE);

  const otherComp = listCompetitionLifecycleHistory({
    tenantId: "tenant-1",
    competitionId: "comp-2",
    repository: repo,
  });
  assert.equal(otherComp.ok, true);
  assert.equal(otherComp.value.records.length, 0);

  const cross = repo.findLifecycleRecord({
    tenantId: "tenant-2",
    competitionId: "comp-1",
    recordId: `clife::tenant-1::comp-1::1`,
  });
  assert.equal(cross.ok, false);
  assert.ok(hasError(cross, COMPETITION_LIFECYCLE_ERROR_CODE.CROSS_TENANT_ACCESS));
});

test("Deterministic fingerprint changes with semantic change; excludes secrets", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const a = suspendCompetition(suspendCmd(definition, repo, { idempotencyKey: "fp1" }));
  const repo2 = createInMemoryCompetitionLifecycleRepository();
  const b = suspendCompetition(
    suspendCmd(definition, repo2, {
      idempotencyKey: "fp2",
      reason: {
        code: COMPETITION_SUSPENSION_REASON_CODE.SAFETY,
        summary: "Different summary for fingerprint",
      },
    })
  );
  assert.notEqual(a.value.record.fingerprint, b.value.record.fingerprint);
  assert.equal(a.value.record.actor.token, undefined);
  assert.equal(JSON.stringify(a.value.record).includes("accessToken"), false);
});

test("Effect plan deterministic across repeated execution", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const a = suspendCompetition(suspendCmd(definition, repo, { idempotencyKey: "det1" }));
  const repo2 = createInMemoryCompetitionLifecycleRepository();
  const b = suspendCompetition(suspendCmd(definition, repo2, { idempotencyKey: "det1" }));
  assert.deepEqual(
    a.value.effectPlan.intents.map((i) => i.type),
    b.value.effectPlan.intents.map((i) => i.type)
  );
});

test("Eligibility evaluator without mutation", () => {
  const eligible = evaluateCompetitionLifecycleActionCommand({
    action: COMPETITION_LIFECYCLE_ACTION.SUSPEND,
    tenantId: "tenant-1",
    competitionId: "comp-1",
    currentRecord: null,
  });
  assert.equal(eligible.ok, true);
  assert.equal(eligible.value.toState, COMPETITION_LIFECYCLE_STATE.SUSPENDED);
});

// ---------------------------------------------------------------------------
// Legacy projector
// ---------------------------------------------------------------------------

test("Legacy cancelled / paused observation; deletion and match-cancel not cancellation", () => {
  const cancelled = projectLegacyTournamentLifecycleObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { status: "cancelled", cancelReason: "rain" },
  });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.value.observedCancelledFlag, true);
  assert.equal(cancelled.value.isCanonicalLifecycleRecord, false);
  assert.equal(cancelled.value.provenance, "LEGACY_UNVERIFIED");

  const paused = projectLegacyTournamentLifecycleObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { status: "paused" },
  });
  assert.equal(paused.ok, true);
  assert.equal(paused.value.observedPausedFlag, true);
  assert.ok(paused.value.issues.length > 0);

  const deleted = projectLegacyTournamentLifecycleObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { status: "active", deleted: true },
  });
  assert.equal(deleted.value.claims.deletionIsCancellation, false);
  assert.ok(
    deleted.value.issues.some(
      (i) => i.code === COMPETITION_LIFECYCLE_ERROR_CODE.AMBIGUOUS_LEGACY_MAPPING
    )
  );

  const matchCancel = projectLegacyTournamentLifecycleObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: {
      status: "active",
      matches: [{ status: "cancelled" }],
    },
  });
  assert.equal(matchCancel.value.claims.matchCancelIsCompetitionCancel, false);
  assert.equal(LEGACY_LIFECYCLE_COMPATIBILITY.isCanonicalLifecycleRecord, false);
});

test("Ambiguous legacy status issues; malformed legacy rejected", () => {
  const amb = projectLegacyTournamentLifecycleObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: { status: "weird-status" },
  });
  assert.equal(amb.ok, true);
  assert.ok(amb.value.issues.length > 0);

  const bad = projectLegacyTournamentLifecycleObservation({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    legacyTournament: null,
  });
  assert.equal(bad.ok, false);
  assert.ok(hasError(bad, COMPETITION_LIFECYCLE_ERROR_CODE.MALFORMED_LEGACY_LIFECYCLE));
});

// ---------------------------------------------------------------------------
// Boundary / contamination / regression
// ---------------------------------------------------------------------------

test("No uncancel export; no CM-08/CORE ownership in module source", () => {
  assert.equal("uncancelCompetition" in cm07, false);
  const src = fs.readFileSync(path.join(MODULE_ROOT, "application/commands.js"), "utf8");
  assert.equal(src.includes("tournamentService"), false);
  assert.equal(src.includes("supabase"), false);
  assert.equal(src.includes("from \"../../../competition-core"), false);
});

test("Typed error code stability (CM07_ prefix)", () => {
  for (const code of Object.values(COMPETITION_LIFECYCLE_ERROR_CODE)) {
    assert.ok(String(code).startsWith("CM07_"));
  }
});

test("CM-01..CM-06 phase regression still exported from root", () => {
  assert.equal(COMPETITION_DEFINITION_PHASE.id, "CM-01");
  assert.equal(COMPETITION_TEMPLATE_INSTANTIATION_PHASE.id, "CM-02");
  assert.equal(COMPETITION_VERSIONING_PHASE.id, "CM-03");
  assert.equal(COMPETITION_CONFIGURATION_PHASE.id, "CM-04");
  assert.equal(COMPETITION_BRANDING_PHASE.id, "CM-05");
  assert.equal(COMPETITION_PUBLICATION_PHASE.id, "CM-06");
  assert.equal(cmRoot.COMPETITION_DEFINITION_PHASE.id, "CM-01");
  assert.equal(cmRoot.COMPETITION_PUBLICATION_PHASE.id, "CM-06");
  assert.equal(cmRoot.COMPETITION_SUSPENSION_CANCELLATION_PHASE.id, "CM-07");
  // CM-01 create still works after CM-07 export
  const d = createDefinition({ competitionId: "comp-reg" });
  assert.equal(d.status, COMPETITION_DEFINITION_STATUS.DRAFT);
});

test("No database/runtime write markers in CM-07 module", () => {
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
    "createClient",
    ".from(",
    "db.push",
    "applyMigration",
    "fetch(",
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

test("Record copy-safe / deepFreeze; UI state excluded", () => {
  const repo = createInMemoryCompetitionLifecycleRepository();
  const definition = createDefinition();
  const result = suspendCompetition(suspendCmd(definition, repo));
  assert.equal(result.ok, true);
  assert.throws(() => {
    result.value.record.toState = "HACKED";
  });
  assert.equal(result.value.record.ui, undefined);
  assert.equal(result.value.record.selectedTab, undefined);
  const frozen = deepFreeze({ a: 1 });
  assert.ok(Object.isFrozen(frozen));
});
