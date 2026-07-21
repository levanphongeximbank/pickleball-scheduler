import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";
import { CRM_MENU_ROOT } from "../src/config/v5Menu/crmMenu.js";

import * as crm from "../src/features/crm/index.js";
import {
  createDeterministicCrmIdGenerator,
  createFakeIdentityActorPort,
  createFixedCrmClock,
} from "../src/features/crm/testing/phase1cFakes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", venueId: "venue-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", venueId: "venue-b" });
const SCOPE_A_OTHER_VENUE = Object.freeze({
  tenantId: "tenant-a",
  venueId: "venue-other",
});
const FIXED_NOW = "2026-07-21T12:00:00.000Z";
const FUTURE_DUE = "2026-07-22T12:00:00.000Z";
const PAST_DUE = "2026-07-20T12:00:00.000Z";

function actorWith(perms, extras = {}) {
  return {
    userId: "user-1",
    tenantId: SCOPE_A.tenantId,
    venueIds: [SCOPE_A.venueId],
    permissions: perms,
    authenticated: true,
    ...extras,
  };
}

const ALL_1E_PERMS = [
  crm.CRM_PERMISSIONS.LEAD_CREATE,
  crm.CRM_PERMISSIONS.LEAD_VIEW,
  crm.CRM_PERMISSIONS.OPPORTUNITY_CREATE,
  crm.CRM_PERMISSIONS.OPPORTUNITY_VIEW,
  crm.CRM_PERMISSIONS.PIPELINE_MANAGE,
  crm.CRM_PERMISSIONS.INTERACTION_CREATE,
  crm.CRM_PERMISSIONS.INTERACTION_VIEW,
  crm.CRM_PERMISSIONS.TASK_CREATE,
  crm.CRM_PERMISSIONS.TASK_VIEW,
  crm.CRM_PERMISSIONS.TASK_UPDATE,
  crm.CRM_PERMISSIONS.TASK_ASSIGN,
];

function buildHarness(overrides = {}) {
  const clock = createFixedCrmClock(FIXED_NOW);
  const ids = createDeterministicCrmIdGenerator("1e");
  const contactReferenceRepository =
    overrides.contactReferenceRepository || crm.createMemoryContactReferenceRepository();
  const leadRepository = overrides.leadRepository || crm.createMemoryLeadRepository();
  const opportunityRepository =
    overrides.opportunityRepository || crm.createMemoryOpportunityRepository();
  const pipelineRepository =
    overrides.pipelineRepository || crm.createMemoryPipelineRepository();
  const interactionRepository =
    overrides.interactionRepository || crm.createMemoryInteractionRepository();
  const taskRepository = overrides.taskRepository || crm.createMemoryTaskRepository();

  const assignable = new Map([
    [
      "owner-2",
      {
        userId: "owner-2",
        tenantId: SCOPE_A.tenantId,
        venueIds: [SCOPE_A.venueId],
        active: true,
      },
    ],
    [
      "owner-inactive",
      {
        userId: "owner-inactive",
        tenantId: SCOPE_A.tenantId,
        venueIds: [SCOPE_A.venueId],
        active: false,
      },
    ],
    [
      "owner-other-tenant",
      {
        userId: "owner-other-tenant",
        tenantId: SCOPE_B.tenantId,
        venueIds: [SCOPE_B.venueId],
        active: true,
      },
    ],
    [
      "owner-other-venue",
      {
        userId: "owner-other-venue",
        tenantId: SCOPE_A.tenantId,
        venueIds: ["venue-other"],
        active: true,
      },
    ],
  ]);

  const identityActorPort = createFakeIdentityActorPort(null, assignable);

  const leadService = crm.createLeadApplicationService({
    clock,
    ids,
    leadRepository,
    contactReferenceRepository,
    identityActorPort,
  });

  const opportunityService = crm.createOpportunityApplicationService({
    clock,
    ids,
    leadRepository,
    opportunityRepository,
    pipelineRepository,
    identityActorPort,
  });

  const interactionService = crm.createInteractionApplicationService({
    clock,
    ids,
    interactionRepository,
    contactReferenceRepository,
    leadRepository,
    opportunityRepository,
    ...overrides.interactionOverrides,
  });

  const taskService = crm.createTaskApplicationService({
    clock,
    ids,
    taskRepository,
    contactReferenceRepository,
    leadRepository,
    opportunityRepository,
    interactionRepository,
    identityActorPort,
    ...overrides.taskOverrides,
  });

  return {
    clock,
    ids,
    contactReferenceRepository,
    leadRepository,
    opportunityRepository,
    pipelineRepository,
    interactionRepository,
    taskRepository,
    leadService,
    opportunityService,
    interactionService,
    taskService,
    identityActorPort,
  };
}

async function seedContactLeadOpportunity(h, actor) {
  const cref = await h.leadService.createContactReference(actor, {
    ...SCOPE_A,
    authUserId: "auth-lan",
    displaySnapshot: { displayName: "Lan" },
  });
  assert.equal(cref.ok, true, cref.error);

  const lead = await h.leadService.createLead(actor, {
    ...SCOPE_A,
    contactRefId: cref.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.WALK_IN,
    title: "Lead Lan",
  });
  assert.equal(lead.ok, true);

  const pipe = await h.opportunityService.createPipeline(actor, {
    ...SCOPE_A,
    name: "Default",
    code: "default",
  });
  assert.equal(pipe.ok, true);

  const opp = await h.opportunityService.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.lead.leadId,
    pipelineId: pipe.pipeline.pipelineId,
    title: "Opp Lan",
  });
  assert.equal(opp.ok, true);

  return {
    contactRefId: cref.contactReference.contactRefId,
    leadId: lead.lead.leadId,
    opportunityId: opp.opportunity.opportunityId,
    pipelineId: pipe.pipeline.pipelineId,
  };
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Facade
// ---------------------------------------------------------------------------

test("Phase 1E — public facade exports", () => {
  assert.equal(typeof crm.createInteractionApplicationService, "function");
  assert.equal(typeof crm.createTaskApplicationService, "function");
  assert.equal(typeof crm.createMemoryInteractionRepository, "function");
  assert.equal(typeof crm.createMemoryTaskRepository, "function");
  assert.ok(crm.INTERACTION_DIRECTION.INBOUND);
  assert.ok(crm.INTERACTION_CHANNEL.PHONE);
  assert.ok(crm.CRM_TASK_PRIORITY.NORMAL);
  assert.equal(crm.CRM_TASK_STATUS.COMPLETED, "completed");
  assert.equal(crm.CRM_TASK_STATUS.DONE, crm.CRM_TASK_STATUS.COMPLETED);
  assert.ok(crm.CRM_PERMISSIONS.TASK_ASSIGN);
  assert.ok(crm.CRM_AUDIT_EVENT_TYPE.FOLLOW_UP_SCHEDULED);
  assert.ok(crm.CRM_AUDIT_EVENT_TYPE.TASK_COMPLETED);
  assert.equal(crm.createFixedCrmClock, undefined);
  assert.equal(crm.createFakeIdentityActorPort, undefined);
});

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

test("Phase 1E — interaction creation success + pending event", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const result = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    leadId: seeded.leadId,
    opportunityId: seeded.opportunityId,
    interactionType: crm.INTERACTION_TYPE.CALL,
    direction: crm.INTERACTION_DIRECTION.OUTBOUND,
    channel: crm.INTERACTION_CHANNEL.PHONE,
    summary: "Called about membership",
    outcome: "Interested",
  });

  assert.equal(result.ok, true);
  assert.equal(result.interaction.contactRefId, seeded.contactRefId);
  assert.equal(result.interaction.interactionType, crm.INTERACTION_TYPE.CALL);
  assert.equal(result.interaction.direction, crm.INTERACTION_DIRECTION.OUTBOUND);
  assert.equal(result.interaction.channel, crm.INTERACTION_CHANNEL.PHONE);
  assert.equal(result.interaction.summary, "Called about membership");
  assert.equal(result.interaction.recordedByActorId, "user-1");
  assert.equal(result.interaction.occurredAt, FIXED_NOW);
  assert.equal(result.interaction.createdAt, FIXED_NOW);
  assert.equal(result.notificationCreated, false);
  assert.equal(result.calendarEventCreated, false);
  assert.equal(result.financeRecordCreated, false);
  assert.equal(result.pendingApplicationEvents.length, 1);
  assert.equal(result.pendingApplicationEvents[0].delivery, "pending");
  assert.equal(
    result.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.INTERACTION_RECORDED
  );
});

test("Phase 1E — interaction requires scope / actor / permission", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);
  const base = {
    contactRefId: seeded.contactRefId,
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "Note",
  };

  const missingActor = await h.interactionService.recordInteraction(null, {
    ...SCOPE_A,
    ...base,
  });
  assert.equal(missingActor.ok, false);
  assert.equal(missingActor.code, crm.CRM_ERROR_CODES.MISSING_ACTOR);

  const missingScope = await h.interactionService.recordInteraction(actor, {
    ...base,
  });
  assert.equal(missingScope.ok, false);
  assert.ok(
    [
      crm.CRM_ERROR_CODES.MISSING_SCOPE,
      crm.CRM_ERROR_CODES.INVALID_SCOPE,
    ].includes(missingScope.code)
  );

  const noPerm = await h.interactionService.recordInteraction(
    actorWith([crm.CRM_PERMISSIONS.INTERACTION_VIEW]),
    { ...SCOPE_A, ...base }
  );
  assert.equal(noPerm.ok, false);
  assert.equal(noPerm.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);
});

test("Phase 1E — interaction ContactReference / relationship validation", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const missingCref = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: "missing-cref",
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "x",
  });
  assert.equal(missingCref.ok, false);
  assert.equal(missingCref.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  // Cross-tenant ContactReference: seed in SCOPE_B then try from SCOPE_A actor fails on actor tenant.
  const actorB = actorWith(ALL_1E_PERMS, {
    userId: "user-b",
    tenantId: SCOPE_B.tenantId,
    venueIds: [SCOPE_B.venueId],
  });
  const crefB = await h.leadService.createContactReference(actorB, {
    ...SCOPE_B,
    authUserId: "auth-b",
    displaySnapshot: { displayName: "B" },
  });
  assert.equal(crefB.ok, true, crefB.error);

  const crossTenant = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: crefB.contactReference.contactRefId,
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "cross",
  });
  assert.equal(crossTenant.ok, false);
  assert.equal(crossTenant.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  // Cross-venue: create contact in other venue under same tenant.
  const actorOtherVenue = actorWith(ALL_1E_PERMS, {
    venueIds: [SCOPE_A.venueId, SCOPE_A_OTHER_VENUE.venueId],
  });
  const crefOtherVenue = await h.leadService.createContactReference(actorOtherVenue, {
    ...SCOPE_A_OTHER_VENUE,
    authUserId: "auth-other-venue",
    displaySnapshot: { displayName: "OtherVenue" },
  });
  assert.equal(crefOtherVenue.ok, true, crefOtherVenue.error);

  const crossVenue = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: crefOtherVenue.contactReference.contactRefId,
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "cross venue",
  });
  assert.equal(crossVenue.ok, false);
  assert.equal(crossVenue.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  // Same-contact lead/opportunity mismatch: second contact + lead
  const cref2 = await h.leadService.createContactReference(actor, {
    ...SCOPE_A,
    authUserId: "auth-other",
    displaySnapshot: { displayName: "Other" },
  });
  assert.equal(cref2.ok, true, cref2.error);
  const lead2 = await h.leadService.createLead(actor, {
    ...SCOPE_A,
    contactRefId: cref2.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.OTHER,
  });
  assert.equal(lead2.ok, true);

  const badLead = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    leadId: lead2.lead.leadId,
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "bad lead link",
  });
  assert.equal(badLead.ok, false);
  assert.equal(badLead.code, crm.CRM_ERROR_CODES.INVALID_INPUT);

  const badOpp = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    opportunityId: "missing-opp",
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "bad opp",
  });
  assert.equal(badOpp.ok, false);
  assert.equal(badOpp.code, crm.CRM_ERROR_CODES.NOT_FOUND);
});

test("Phase 1E — invalid interaction type / direction / channel", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);
  const base = {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    summary: "x",
  };

  const badType = await h.interactionService.recordInteraction(actor, {
    ...base,
    interactionType: "fax",
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
  });
  assert.equal(badType.ok, false);
  assert.equal(badType.code, crm.CRM_ERROR_CODES.INVALID_STATUS);

  const badDir = await h.interactionService.recordInteraction(actor, {
    ...base,
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: "sideways",
    channel: crm.INTERACTION_CHANNEL.OTHER,
  });
  assert.equal(badDir.ok, false);
  assert.equal(badDir.code, crm.CRM_ERROR_CODES.INVALID_STATUS);

  const badChannel = await h.interactionService.recordInteraction(actor, {
    ...base,
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: "carrier-pigeon",
  });
  assert.equal(badChannel.ok, false);
  assert.equal(badChannel.code, crm.CRM_ERROR_CODES.INVALID_STATUS);
});

test("Phase 1E — deterministic interaction id/timestamp + timeline order/filter + append-only", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const a = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "first",
    occurredAt: "2026-07-20T10:00:00.000Z",
    idempotencyKey: "ixn-a",
  });
  assert.equal(a.ok, true);
  assert.match(a.interaction.interactionId, /^ixn_1e_/);
  assert.equal(a.interaction.createdAt, FIXED_NOW);

  h.clock.setNow("2026-07-21T12:05:00.000Z");
  const b = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    interactionType: crm.INTERACTION_TYPE.CALL,
    direction: crm.INTERACTION_DIRECTION.INBOUND,
    channel: crm.INTERACTION_CHANNEL.PHONE,
    summary: "second same occurred",
    occurredAt: "2026-07-20T10:00:00.000Z",
  });
  assert.equal(b.ok, true);

  const c = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    interactionType: crm.INTERACTION_TYPE.EMAIL,
    direction: crm.INTERACTION_DIRECTION.OUTBOUND,
    channel: crm.INTERACTION_CHANNEL.EMAIL,
    summary: "latest",
    occurredAt: "2026-07-21T08:00:00.000Z",
  });
  assert.equal(c.ok, true);

  const listed = await h.interactionService.listInteractions(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.interactions.length, 3);
  assert.equal(listed.interactions[0].interactionId, c.interaction.interactionId);
  // same occurredAt: createdAt desc then interactionId asc
  assert.equal(listed.interactions[1].interactionId, b.interaction.interactionId);
  assert.equal(listed.interactions[2].interactionId, a.interaction.interactionId);

  const filtered = await h.interactionService.listInteractions(actor, {
    ...SCOPE_A,
    interactionType: crm.INTERACTION_TYPE.CALL,
    direction: crm.INTERACTION_DIRECTION.INBOUND,
    channel: crm.INTERACTION_CHANNEL.PHONE,
  });
  assert.equal(filtered.ok, true);
  assert.equal(filtered.interactions.length, 1);
  assert.equal(filtered.interactions[0].interactionId, b.interaction.interactionId);

  const range = await h.interactionService.listInteractions(actor, {
    ...SCOPE_A,
    occurredFrom: "2026-07-21T00:00:00.000Z",
    occurredTo: "2026-07-21T23:59:59.000Z",
  });
  assert.equal(range.ok, true);
  assert.equal(range.interactions.length, 1);

  // Append-only: no update API on service
  assert.equal(h.interactionService.updateInteraction, undefined);
  assert.equal(h.interactionService.deleteInteraction, undefined);
  assert.equal(typeof h.interactionRepository.update, "undefined");

  // Idempotent replay
  const replay = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "first",
    occurredAt: "2026-07-20T10:00:00.000Z",
    idempotencyKey: "ixn-a",
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.pendingApplicationEvents.length, 0);
  assert.equal(replay.interaction.interactionId, a.interaction.interactionId);
});

test("Phase 1E — failure leaves no partial interaction write", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const before = await h.interactionService.listInteractions(actor, { ...SCOPE_A });
  assert.equal(before.interactions.length, 0);

  const failed = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    leadId: "no-such-lead",
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "should not persist",
  });
  assert.equal(failed.ok, false);

  const after = await h.interactionService.listInteractions(actor, { ...SCOPE_A });
  assert.equal(after.interactions.length, 0);
});

// ---------------------------------------------------------------------------
// Tasks & follow-ups
// ---------------------------------------------------------------------------

test("Phase 1E — task creation + follow-up scheduling", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const task = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    leadId: seeded.leadId,
    opportunityId: seeded.opportunityId,
    title: "Call back",
    priority: crm.CRM_TASK_PRIORITY.HIGH,
  });
  assert.equal(task.ok, true);
  assert.equal(task.task.status, crm.CRM_TASK_STATUS.OPEN);
  assert.equal(task.task.dueAt, null);
  assert.equal(task.notificationCreated, false);
  assert.equal(task.calendarEventCreated, false);
  assert.equal(task.financeRecordCreated, false);
  assert.equal(task.interactionCreated, false);
  assert.equal(task.leadUpdated, false);
  assert.equal(task.opportunityUpdated, false);
  assert.equal(
    task.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.TASK_CREATED
  );

  const ixn = await h.interactionService.recordInteraction(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    interactionType: crm.INTERACTION_TYPE.CALL,
    direction: crm.INTERACTION_DIRECTION.OUTBOUND,
    channel: crm.INTERACTION_CHANNEL.PHONE,
    summary: "Source call",
  });
  assert.equal(ixn.ok, true);

  const follow = await h.taskService.scheduleFollowUp(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    leadId: seeded.leadId,
    opportunityId: seeded.opportunityId,
    sourceInteractionId: ixn.interaction.interactionId,
    title: "Follow up call",
    dueAt: FUTURE_DUE,
  });
  assert.equal(follow.ok, true);
  assert.equal(follow.task.dueAt, FUTURE_DUE);
  assert.equal(follow.task.sourceInteractionId, ixn.interaction.interactionId);
  assert.equal(follow.interactionCreated, false);
  assert.equal(
    follow.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.FOLLOW_UP_SCHEDULED
  );

  const past = await h.taskService.scheduleFollowUp(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "Too late",
    dueAt: PAST_DUE,
  });
  assert.equal(past.ok, false);
  assert.equal(past.code, crm.CRM_ERROR_CODES.INVALID_INPUT);

  const missingDue = await h.taskService.scheduleFollowUp(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "No due",
  });
  assert.equal(missingDue.ok, false);
  assert.equal(missingDue.code, crm.CRM_ERROR_CODES.INVALID_INPUT);
});

test("Phase 1E — task auth / missing related / cross-scope", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const missingActor = await h.taskService.createTask(null, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "x",
  });
  assert.equal(missingActor.ok, false);
  assert.equal(missingActor.code, crm.CRM_ERROR_CODES.MISSING_ACTOR);

  const noPerm = await h.taskService.createTask(
    actorWith([crm.CRM_PERMISSIONS.TASK_VIEW]),
    { ...SCOPE_A, contactRefId: seeded.contactRefId, title: "x" }
  );
  assert.equal(noPerm.ok, false);
  assert.equal(noPerm.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);

  const missingRel = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: "missing",
    title: "x",
  });
  assert.equal(missingRel.ok, false);
  assert.equal(missingRel.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  const crossTenant = await h.taskService.createTask(actor, {
    ...SCOPE_B,
    contactRefId: seeded.contactRefId,
    title: "x",
  });
  assert.equal(crossTenant.ok, false);
  assert.equal(crossTenant.code, crm.CRM_ERROR_CODES.FORBIDDEN_SCOPE);

  const crossVenue = await h.taskService.createTask(actor, {
    ...SCOPE_A_OTHER_VENUE,
    contactRefId: seeded.contactRefId,
    title: "x",
  });
  assert.equal(crossVenue.ok, false);
  assert.equal(crossVenue.code, crm.CRM_ERROR_CODES.FORBIDDEN_SCOPE);
});

test("Phase 1E — assignment target validation + assign success", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const created = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "Assign me",
  });
  assert.equal(created.ok, true);

  const inactive = await h.taskService.assignTask(actor, {
    ...SCOPE_A,
    taskId: created.task.taskId,
    assignedToActorId: "owner-inactive",
  });
  assert.equal(inactive.ok, false);
  assert.equal(inactive.code, crm.CRM_ERROR_CODES.INVALID_INPUT);

  const otherTenant = await h.taskService.assignTask(actor, {
    ...SCOPE_A,
    taskId: created.task.taskId,
    assignedToActorId: "owner-other-tenant",
  });
  assert.equal(otherTenant.ok, false);
  // IdentityActorPort fails closed (unresolved) for cross-tenant targets.
  assert.equal(otherTenant.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  const otherVenue = await h.taskService.assignTask(actor, {
    ...SCOPE_A,
    taskId: created.task.taskId,
    assignedToActorId: "owner-other-venue",
  });
  assert.equal(otherVenue.ok, false);
  assert.equal(otherVenue.code, crm.CRM_ERROR_CODES.FORBIDDEN_SCOPE);

  const missing = await h.taskService.assignTask(actor, {
    ...SCOPE_A,
    taskId: created.task.taskId,
    assignedToActorId: "ghost",
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  const ok = await h.taskService.assignTask(actor, {
    ...SCOPE_A,
    taskId: created.task.taskId,
    assignedToActorId: "owner-2",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.task.assignedToActorId, "owner-2");
  assert.equal(
    ok.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.TASK_ASSIGNED
  );
});

test("Phase 1E — reschedule / start / complete / cancel lifecycle", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const t1 = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "Open complete",
    dueAt: FUTURE_DUE,
  });
  assert.equal(t1.ok, true);

  const rescheduled = await h.taskService.rescheduleTask(actor, {
    ...SCOPE_A,
    taskId: t1.task.taskId,
    dueAt: "2026-07-23T12:00:00.000Z",
  });
  assert.equal(rescheduled.ok, true);
  assert.equal(rescheduled.task.dueAt, "2026-07-23T12:00:00.000Z");
  assert.equal(
    rescheduled.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.TASK_RESCHEDULED
  );

  const completedOpen = await h.taskService.completeTask(actor, {
    ...SCOPE_A,
    taskId: t1.task.taskId,
  });
  assert.equal(completedOpen.ok, true);
  assert.equal(completedOpen.task.status, crm.CRM_TASK_STATUS.COMPLETED);
  assert.equal(completedOpen.task.completedAt, FIXED_NOW);
  assert.ok(completedOpen.task.startedAt);

  const reopen = await h.taskService.startTask(actor, {
    ...SCOPE_A,
    taskId: t1.task.taskId,
  });
  assert.equal(reopen.ok, false);
  assert.equal(reopen.code, crm.CRM_ERROR_CODES.INVALID_TRANSITION);

  const t2 = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "In progress path",
  });
  const started = await h.taskService.startTask(actor, {
    ...SCOPE_A,
    taskId: t2.task.taskId,
  });
  assert.equal(started.ok, true);
  assert.equal(started.task.status, crm.CRM_TASK_STATUS.IN_PROGRESS);
  assert.equal(started.task.startedAt, FIXED_NOW);
  assert.equal(
    started.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.TASK_STARTED
  );

  const completedIp = await h.taskService.completeTask(actor, {
    ...SCOPE_A,
    taskId: t2.task.taskId,
  });
  assert.equal(completedIp.ok, true);
  assert.equal(completedIp.task.status, crm.CRM_TASK_STATUS.COMPLETED);

  const t3 = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "Cancel me",
  });
  const missingReason = await h.taskService.cancelTask(actor, {
    ...SCOPE_A,
    taskId: t3.task.taskId,
  });
  assert.equal(missingReason.ok, false);
  assert.equal(missingReason.code, crm.CRM_ERROR_CODES.INVALID_INPUT);

  const cancelled = await h.taskService.cancelTask(actor, {
    ...SCOPE_A,
    taskId: t3.task.taskId,
    cancellationReason: "Customer declined",
  });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.task.status, crm.CRM_TASK_STATUS.CANCELLED);
  assert.equal(cancelled.task.cancelledAt, FIXED_NOW);
  assert.equal(cancelled.task.cancellationReason, "Customer declined");
  assert.equal(
    cancelled.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.TASK_CANCELLED
  );

  const cancelAgain = await h.taskService.cancelTask(actor, {
    ...SCOPE_A,
    taskId: t3.task.taskId,
    cancellationReason: "again",
  });
  assert.equal(cancelAgain.ok, false);
  assert.equal(cancelAgain.code, crm.CRM_ERROR_CODES.INVALID_TRANSITION);
});

test("Phase 1E — deterministic task listing + overdue filter", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const overdue = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "Overdue",
    dueAt: PAST_DUE,
    assignedToActorId: "owner-2",
  });
  assert.equal(overdue.ok, true);

  const future = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "Future",
    dueAt: FUTURE_DUE,
  });
  assert.equal(future.ok, true);

  const noDue = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "No due",
  });
  assert.equal(noDue.ok, true);

  const done = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "Done soon",
    dueAt: PAST_DUE,
  });
  await h.taskService.completeTask(actor, {
    ...SCOPE_A,
    taskId: done.task.taskId,
  });

  const listed = await h.taskService.listTasks(actor, { ...SCOPE_A });
  assert.equal(listed.ok, true);
  // non-terminal first: overdue, future, noDue, then terminal done
  assert.equal(listed.tasks[0].taskId, overdue.task.taskId);
  assert.equal(listed.tasks[1].taskId, future.task.taskId);
  assert.equal(listed.tasks[2].taskId, noDue.task.taskId);
  assert.equal(listed.tasks[3].status, crm.CRM_TASK_STATUS.COMPLETED);

  const overdueOnly = await h.taskService.listTasks(actor, {
    ...SCOPE_A,
    overdueOnly: true,
  });
  assert.equal(overdueOnly.ok, true);
  assert.equal(overdueOnly.tasks.length, 1);
  assert.equal(overdueOnly.tasks[0].taskId, overdue.task.taskId);

  const byAssignee = await h.taskService.listTasks(actor, {
    ...SCOPE_A,
    assignedToActorId: "owner-2",
  });
  assert.equal(byAssignee.ok, true);
  assert.equal(byAssignee.tasks.length, 1);
});

test("Phase 1E — idempotency + failure leaves no partial task write", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1E_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const first = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "Idem",
    idempotencyKey: "task-key-1",
  });
  assert.equal(first.ok, true);

  const replay = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    title: "Idem",
    idempotencyKey: "task-key-1",
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.task.taskId, first.task.taskId);
  assert.equal(replay.pendingApplicationEvents.length, 0);

  const before = await h.taskService.listTasks(actor, { ...SCOPE_A });
  const countBefore = before.tasks.length;

  const failed = await h.taskService.createTask(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    leadId: "missing-lead",
    title: "Should fail",
  });
  assert.equal(failed.ok, false);

  const after = await h.taskService.listTasks(actor, { ...SCOPE_A });
  assert.equal(after.tasks.length, countBefore);
});

test("Phase 1E — repository instance + tenant/venue isolation", async () => {
  const a = crm.createMemoryInteractionRepository();
  const b = crm.createMemoryInteractionRepository();
  const interaction = crm.createInteraction({
    ...SCOPE_A,
    interactionId: "ixn-iso",
    contactRefId: "cref-1",
    interactionType: crm.INTERACTION_TYPE.NOTE,
    direction: crm.INTERACTION_DIRECTION.INTERNAL,
    channel: crm.INTERACTION_CHANNEL.OTHER,
    summary: "iso",
    occurredAt: FIXED_NOW,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  a.create(SCOPE_A, interaction);
  assert.equal(a.list(SCOPE_A).length, 1);
  assert.equal(b.list(SCOPE_A).length, 0);
  assert.equal(a.list(SCOPE_B).length, 0);
  assert.equal(a.list(SCOPE_A_OTHER_VENUE).length, 0);

  const ta = crm.createMemoryTaskRepository();
  const tb = crm.createMemoryTaskRepository();
  const task = crm.createCrmTask({
    ...SCOPE_A,
    taskId: "task-iso",
    contactRefId: "cref-1",
    title: "iso",
    status: crm.CRM_TASK_STATUS.OPEN,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  ta.create(SCOPE_A, task);
  assert.equal(ta.list(SCOPE_A).length, 1);
  assert.equal(tb.list(SCOPE_A).length, 0);
  assert.equal(ta.list(SCOPE_B).length, 0);
});

test("Phase 1E — CRM menu remains PARTIAL", () => {
  const items = [];
  function collect(node) {
    if (!node) return;
    if (node.path || node.to) items.push(node);
    for (const child of node.children || node.items || []) collect(child);
  }
  collect(CRM_MENU_ROOT);
  const crmItems = items.filter(
    (item) =>
      String(item.path || item.to || "").startsWith("/crm") ||
      String(item.id || "").includes("crm")
  );
  assert.ok(crmItems.length > 0);
  for (const item of crmItems) {
    if (item.featureStatus) {
      assert.equal(item.featureStatus, FEATURE_STATUS.PARTIAL);
    }
  }
});

test("Phase 1E — no other workstream files modified in CRM phase-1e tree walk sanity", () => {
  const crmFiles = walkFiles(path.join(root, "src", "features", "crm"));
  assert.ok(crmFiles.some((f) => f.includes("interactionApplicationService.js")));
  assert.ok(crmFiles.some((f) => f.includes("taskApplicationService.js")));

  // Guard: Phase 1E docs are markdown only (no SQL migration artifacts).
  const docs = walkFiles(path.join(root, "docs", "crm", "phase-1e"));
  assert.ok(docs.every((f) => f.endsWith(".md")));
  assert.equal(
    docs.some((f) => f.endsWith(".sql")),
    false
  );
});
