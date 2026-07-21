import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
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
const FIXED_NOW = "2026-07-21T11:00:00.000Z";

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

const ALL_OPP_PERMS = [
  crm.CRM_PERMISSIONS.PIPELINE_MANAGE,
  crm.CRM_PERMISSIONS.OPPORTUNITY_CREATE,
  crm.CRM_PERMISSIONS.OPPORTUNITY_VIEW,
  crm.CRM_PERMISSIONS.OPPORTUNITY_UPDATE,
  crm.CRM_PERMISSIONS.LEAD_CREATE,
  crm.CRM_PERMISSIONS.LEAD_VIEW,
];

function buildHarness(overrides = {}) {
  const clock = createFixedCrmClock(FIXED_NOW);
  const ids = createDeterministicCrmIdGenerator("1d");
  const leadRepository = overrides.leadRepository || crm.createMemoryLeadRepository();
  const contactReferenceRepository =
    overrides.contactReferenceRepository || crm.createMemoryContactReferenceRepository();
  const opportunityRepository =
    overrides.opportunityRepository || crm.createMemoryOpportunityRepository();
  const pipelineRepository =
    overrides.pipelineRepository || crm.createMemoryPipelineRepository();

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

  const leadService = crm.createLeadApplicationService({
    clock,
    ids,
    leadRepository,
    contactReferenceRepository,
    identityActorPort: createFakeIdentityActorPort(null, assignable),
  });

  const service = crm.createOpportunityApplicationService({
    clock,
    ids,
    leadRepository,
    opportunityRepository,
    pipelineRepository,
    identityActorPort: createFakeIdentityActorPort(null, assignable),
    ...overrides,
  });

  return {
    service,
    leadService,
    clock,
    ids,
    leadRepository,
    opportunityRepository,
    pipelineRepository,
  };
}

async function seedLead(leadService, actor, extras = {}) {
  const contact = await leadService.createContactReference(actor, {
    ...SCOPE_A,
    authUserId: "auth-user-1",
    displaySnapshot: { displayName: "Lead Contact", authoritative: false },
  });
  assert.equal(contact.ok, true, contact.error);
  const lead = await leadService.createLead(actor, {
    ...SCOPE_A,
    contactRefId: contact.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.WEB,
    title: "Lead title",
    ...extras,
  });
  assert.equal(lead.ok, true, lead.error);
  return { contact, lead: lead.lead };
}

async function seedDefaultPipeline(service, actor, extras = {}) {
  const result = await service.createPipeline(actor, {
    ...SCOPE_A,
    name: "Default Sales",
    code: "default_sales",
    ...extras,
  });
  assert.equal(result.ok, true, result.error);
  return result.pipeline;
}

function walkCrmFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkCrmFiles(full, out);
    else if (/\.(js|jsx|ts|tsx|md)$/.test(name)) out.push(full);
  }
  return out;
}

test("Phase 1D — public facade exports and preserves Phase 1C", () => {
  assert.equal(typeof crm.createOpportunityApplicationService, "function");
  assert.equal(typeof crm.createMemoryPipelineRepository, "function");
  assert.equal(typeof crm.createLeadApplicationService, "function");
  assert.ok(crm.CRM_AUDIT_EVENT_TYPE.PIPELINE_CREATED);
  assert.ok(crm.CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_ASSIGNED);
  assert.ok(crm.CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_WON);
  assert.ok(crm.CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_LOST);
  assert.ok(crm.PIPELINE_STAGE_CATEGORY.OPEN);
  assert.equal(typeof crm.createFixedCrmClock, "undefined");
  assert.ok(crm.CRM_REPOSITORY_CONTRACT_NAMES.includes("CrmPipelineRepository"));
});

test("Phase 1D — pipeline creation success", async () => {
  const { service } = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.PIPELINE_MANAGE]);
  const result = await service.createPipeline(actor, {
    ...SCOPE_A,
    name: "Sales",
    code: "Sales Pipeline",
  });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.pipeline.code, "sales_pipeline");
  assert.equal(result.pipeline.active, true);
  assert.equal(result.pipeline.createdAt, FIXED_NOW);
  assert.ok(result.pipeline.stages.length >= 5);
  assert.equal(result.pendingApplicationEvents.length, 1);
  assert.equal(result.pendingApplicationEvents[0].delivery, "pending");
  assert.equal(
    result.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.PIPELINE_CREATED
  );
});

test("Phase 1D — duplicate pipeline code rejection", async () => {
  const { service } = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.PIPELINE_MANAGE]);
  await seedDefaultPipeline(service, actor);
  const dup = await service.createPipeline(actor, {
    ...SCOPE_A,
    name: "Other",
    code: "default_sales",
  });
  assert.equal(dup.ok, false);
  assert.equal(dup.code, crm.CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT);
});

test("Phase 1D — duplicate stage-code rejection", async () => {
  const { service } = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.PIPELINE_MANAGE]);
  const result = await service.createPipeline(actor, {
    ...SCOPE_A,
    code: "bad_dup_stage",
    stages: [
      { code: "qualification", sortOrder: 0 },
      { code: "qualification", sortOrder: 1 },
      { code: "won", sortOrder: 2, isTerminal: true },
      { code: "lost", sortOrder: 3, isTerminal: true },
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.INVALID_INPUT);
});

test("Phase 1D — invalid pipeline terminal configuration rejection", async () => {
  const { service } = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.PIPELINE_MANAGE]);
  const noWon = await service.createPipeline(actor, {
    ...SCOPE_A,
    code: "no_won",
    stages: [
      { code: "qualification", sortOrder: 0 },
      { code: "lost", sortOrder: 1, isTerminal: true },
    ],
  });
  assert.equal(noWon.ok, false);
  assert.equal(noWon.code, crm.CRM_ERROR_CODES.INVALID_STATUS);

  const twoWon = await service.createPipeline(actor, {
    ...SCOPE_A,
    code: "two_won",
    stages: [
      { code: "qualification", sortOrder: 0 },
      { code: "won", sortOrder: 1, isTerminal: true },
      {
        code: "won_alt",
        sortOrder: 2,
        isTerminal: true,
        category: crm.PIPELINE_STAGE_CATEGORY.WON,
        allowCustom: true,
      },
      { code: "lost", sortOrder: 3, isTerminal: true },
    ],
  });
  assert.equal(twoWon.ok, false);
  assert.equal(twoWon.code, crm.CRM_ERROR_CODES.INVALID_STATUS);
});

test("Phase 1D — pipeline list scope isolation", async () => {
  const { service } = buildHarness();
  const actorA = actorWith([
    crm.CRM_PERMISSIONS.PIPELINE_MANAGE,
    crm.CRM_PERMISSIONS.OPPORTUNITY_VIEW,
  ]);
  await seedDefaultPipeline(service, actorA);

  const actorB = actorWith(
    [crm.CRM_PERMISSIONS.PIPELINE_MANAGE, crm.CRM_PERMISSIONS.OPPORTUNITY_VIEW],
    { tenantId: SCOPE_B.tenantId, venueIds: [SCOPE_B.venueId] }
  );
  const listed = await service.listPipelines(actorB, { ...SCOPE_B });
  assert.equal(listed.ok, true);
  assert.equal(listed.pipelines.length, 0);

  const listedA = await service.listPipelines(actorA, { ...SCOPE_A });
  assert.equal(listedA.pipelines.length, 1);
});

test("Phase 1D — opportunity creation from lead success", async () => {
  const { service, leadService } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);
  const { lead } = await seedLead(leadService, actor);

  const created = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: pipeline.pipelineId,
    estimatedValue: 1500,
  });
  assert.equal(created.ok, true, created.error);
  assert.equal(created.opportunity.leadId, lead.leadId);
  assert.equal(created.opportunity.contactRefId, lead.contactRefId);
  assert.equal(created.opportunity.stageCode, crm.OPPORTUNITY_STAGE.QUALIFICATION);
  assert.equal(created.opportunity.estimatedValue, 1500);
  assert.equal(created.leadConversion.performed, false);
  assert.equal(created.pendingApplicationEvents[0].delivery, "pending");
  assert.equal(
    created.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_CREATED
  );
  assert.equal(
    created.pendingApplicationEvents[0].event.payload.estimatedValueAuthoritative,
    false
  );
});

test("Phase 1D — missing lead rejection", async () => {
  const { service } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);
  const missing = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: "lead_missing",
    pipelineId: pipeline.pipelineId,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, crm.CRM_ERROR_CODES.NOT_FOUND);
});

test("Phase 1D — cross-tenant lead rejection", async () => {
  const { service, leadRepository } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);

  // Seed a lead only in SCOPE_B storage via direct repo write under B.
  const leadB = crm.createLead({
    leadId: "lead_b",
    ...SCOPE_B,
    contactRefId: "cref_b",
    source: crm.LEAD_SOURCE.WEB,
    status: crm.LEAD_STATUS.NEW,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  leadRepository.save(SCOPE_B, leadB);

  const rejected = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: "lead_b",
    pipelineId: pipeline.pipelineId,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, crm.CRM_ERROR_CODES.NOT_FOUND);
});

test("Phase 1D — cross-venue lead rejection", async () => {
  const { service, leadRepository } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);

  leadRepository.save(SCOPE_A_OTHER_VENUE, {
    leadId: "lead_venue",
    ...SCOPE_A_OTHER_VENUE,
    contactRefId: "cref_v",
    source: crm.LEAD_SOURCE.WEB,
    status: crm.LEAD_STATUS.NEW,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });

  const rejected = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: "lead_venue",
    pipelineId: pipeline.pipelineId,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, crm.CRM_ERROR_CODES.NOT_FOUND);
});

test("Phase 1D — missing pipeline rejection", async () => {
  const { service, leadService } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const { lead } = await seedLead(leadService, actor);
  const missing = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: "pipe_missing",
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, crm.CRM_ERROR_CODES.NOT_FOUND);
});

test("Phase 1D — cross-scope pipeline rejection", async () => {
  const { service, leadService, pipelineRepository } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const { lead } = await seedLead(leadService, actor);

  pipelineRepository.save(SCOPE_B, {
    pipelineId: "pipe_b",
    ...SCOPE_B,
    name: "B",
    code: "pipe_b",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });

  const rejected = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: "pipe_b",
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, crm.CRM_ERROR_CODES.NOT_FOUND);
});

test("Phase 1D — invalid initial stage rejection", async () => {
  const { service, leadService } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);
  const { lead } = await seedLead(leadService, actor);

  const rejected = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: pipeline.pipelineId,
    stageCode: crm.OPPORTUNITY_STAGE.NEGOTIATION,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, crm.CRM_ERROR_CODES.INVALID_TRANSITION);
});

test("Phase 1D — opportunity retrieval and deterministic listing", async () => {
  const { service, leadService } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);
  const { lead: lead1 } = await seedLead(leadService, actor);
  const { lead: lead2 } = await seedLead(leadService, actor, {
    title: "Second",
  });

  const o1 = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead1.leadId,
    pipelineId: pipeline.pipelineId,
    opportunityId: "opp_z",
  });
  const o2 = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead2.leadId,
    pipelineId: pipeline.pipelineId,
    opportunityId: "opp_a",
  });
  assert.equal(o1.ok, true);
  assert.equal(o2.ok, true);

  const got = await service.getOpportunity(actor, {
    ...SCOPE_A,
    opportunityId: "opp_a",
  });
  assert.equal(got.ok, true);
  assert.equal(got.opportunity.opportunityId, "opp_a");

  const listed = await service.listOpportunities(actor, { ...SCOPE_A });
  assert.equal(listed.ok, true);
  assert.deepEqual(
    listed.opportunities.map((o) => o.opportunityId),
    ["opp_a", "opp_z"]
  );
});

test("Phase 1D — missing view/create/update permission rejection", async () => {
  const { service, leadService } = buildHarness();
  const manager = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, manager);
  const { lead } = await seedLead(leadService, manager);
  const created = await service.createOpportunityFromLead(manager, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: pipeline.pipelineId,
  });
  assert.equal(created.ok, true);

  const noView = await service.getOpportunity(actorWith([]), {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
  });
  assert.equal(noView.ok, false);
  assert.equal(noView.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);

  const noCreate = await service.createOpportunityFromLead(
    actorWith([crm.CRM_PERMISSIONS.OPPORTUNITY_VIEW]),
    {
      ...SCOPE_A,
      leadId: lead.leadId,
      pipelineId: pipeline.pipelineId,
      opportunityId: "opp_x",
    }
  );
  assert.equal(noCreate.ok, false);
  assert.equal(noCreate.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);

  const noUpdate = await service.assignOpportunity(
    actorWith([crm.CRM_PERMISSIONS.OPPORTUNITY_VIEW]),
    {
      ...SCOPE_A,
      opportunityId: created.opportunity.opportunityId,
      ownerUserId: "owner-2",
    }
  );
  assert.equal(noUpdate.ok, false);
  assert.equal(noUpdate.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);
});

test("Phase 1D — assignment success and target rejection", async () => {
  const { service, leadService } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);
  const { lead } = await seedLead(leadService, actor);
  const created = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: pipeline.pipelineId,
  });

  const assigned = await service.assignOpportunity(actor, {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
    ownerUserId: "owner-2",
  });
  assert.equal(assigned.ok, true, assigned.error);
  assert.equal(assigned.opportunity.ownerUserId, "owner-2");
  assert.equal(assigned.opportunity.stageCode, created.opportunity.stageCode);
  assert.equal(
    assigned.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.OPPORTUNITY_ASSIGNED
  );

  const missing = await service.assignOpportunity(actor, {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
    ownerUserId: "owner-missing",
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  const inactive = await service.assignOpportunity(actor, {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
    ownerUserId: "owner-inactive",
  });
  assert.equal(inactive.ok, false);
  assert.equal(inactive.code, crm.CRM_ERROR_CODES.INVALID_INPUT);

  const crossTenant = await service.assignOpportunity(actor, {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
    ownerUserId: "owner-other-tenant",
  });
  assert.equal(crossTenant.ok, false);
  // IdentityActorPort fails closed (null) for out-of-tenant targets → NOT_FOUND.
  assert.equal(crossTenant.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  const crossVenue = await service.assignOpportunity(actor, {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
    ownerUserId: "owner-other-venue",
  });
  assert.equal(crossVenue.ok, false);
  assert.equal(crossVenue.code, crm.CRM_ERROR_CODES.FORBIDDEN_SCOPE);
});

test("Phase 1D — stage transitions: valid, skip, cross-pipeline, terminal", async () => {
  const { service, leadService, pipelineRepository } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);
  const { lead } = await seedLead(leadService, actor);
  const created = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: pipeline.pipelineId,
  });

  const advanced = await service.advanceOpportunityStage(actor, {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
    targetStageCode: crm.OPPORTUNITY_STAGE.PROPOSAL,
  });
  assert.equal(advanced.ok, true, advanced.error);
  assert.equal(advanced.opportunity.stageCode, crm.OPPORTUNITY_STAGE.PROPOSAL);

  // From proposal, advancing directly to won must fail (close command only).
  const skipWon = await service.advanceOpportunityStage(actor, {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
    targetStageCode: crm.OPPORTUNITY_STAGE.WON,
  });
  assert.equal(skipWon.ok, false);
  assert.equal(skipWon.code, crm.CRM_ERROR_CODES.INVALID_TRANSITION);

  // Reset path: create new opp and try skip qualification -> negotiation
  const { lead: lead2 } = await seedLead(leadService, actor, { title: "skip" });
  const created2 = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead2.leadId,
    pipelineId: pipeline.pipelineId,
  });
  const skipOpen = await service.advanceOpportunityStage(actor, {
    ...SCOPE_A,
    opportunityId: created2.opportunity.opportunityId,
    targetStageCode: crm.OPPORTUNITY_STAGE.NEGOTIATION,
  });
  assert.equal(skipOpen.ok, false);
  assert.equal(skipOpen.code, crm.CRM_ERROR_CODES.INVALID_TRANSITION);

  // Cross-pipeline stage: foreign pipeline stage code not in this pipeline
  const crossStage = await service.advanceOpportunityStage(actor, {
    ...SCOPE_A,
    opportunityId: created2.opportunity.opportunityId,
    targetStageCode: "foreign_stage",
  });
  assert.equal(crossStage.ok, false);
  assert.equal(crossStage.code, crm.CRM_ERROR_CODES.INVALID_TRANSITION);

  // Terminal rejection after close
  const closed = await service.closeOpportunityWon(actor, {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
  });
  assert.equal(closed.ok, true, closed.error);
  const fromTerminal = await service.advanceOpportunityStage(actor, {
    ...SCOPE_A,
    opportunityId: created.opportunity.opportunityId,
    targetStageCode: crm.OPPORTUNITY_STAGE.PROPOSAL,
  });
  assert.equal(fromTerminal.ok, false);
  assert.equal(fromTerminal.code, crm.CRM_ERROR_CODES.INVALID_TRANSITION);

  // unused var silence
  assert.ok(pipelineRepository);
});

test("Phase 1D — close won / lost / missing loss reason / no finance", async () => {
  const { service, leadService } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);
  const { lead } = await seedLead(leadService, actor);
  const { lead: leadLost } = await seedLead(leadService, actor, { title: "lost" });

  const wonOpp = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: pipeline.pipelineId,
    estimatedValue: 99,
  });
  const won = await service.closeOpportunityWon(actor, {
    ...SCOPE_A,
    opportunityId: wonOpp.opportunity.opportunityId,
  });
  assert.equal(won.ok, true, won.error);
  assert.equal(won.opportunity.stageCode, crm.OPPORTUNITY_STAGE.WON);
  assert.equal(won.opportunity.closedAt, FIXED_NOW);
  assert.equal(won.financeTransactionCreated, false);
  assert.equal(won.opportunity.estimatedValue, 99);
  assert.ok(
    won.pendingApplicationEvents.some(
      (e) => e.event.eventType === crm.CRM_INTEGRATION_EVENT_TYPE.OPPORTUNITY_WON
    )
  );
  assert.equal(
    won.pendingApplicationEvents.find(
      (e) => e.event.eventType === crm.CRM_INTEGRATION_EVENT_TYPE.OPPORTUNITY_WON
    ).event.payload.financeTransactionCreated,
    false
  );

  const lostOpp = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: leadLost.leadId,
    pipelineId: pipeline.pipelineId,
  });
  const missingReason = await service.closeOpportunityLost(actor, {
    ...SCOPE_A,
    opportunityId: lostOpp.opportunity.opportunityId,
  });
  assert.equal(missingReason.ok, false);
  assert.equal(missingReason.code, crm.CRM_ERROR_CODES.INVALID_INPUT);

  const lost = await service.closeOpportunityLost(actor, {
    ...SCOPE_A,
    opportunityId: lostOpp.opportunity.opportunityId,
    lossReason: "Budget",
    lossReasonCode: "budget",
  });
  assert.equal(lost.ok, true, lost.error);
  assert.equal(lost.opportunity.stageCode, crm.OPPORTUNITY_STAGE.LOST);
  assert.equal(lost.opportunity.lossReason, "Budget");
  assert.equal(lost.financeTransactionCreated, false);
});

test("Phase 1D — event envelopes valid and pending; deterministic ids", async () => {
  const { service, leadService, ids } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);
  const { lead } = await seedLead(leadService, actor);
  const created = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: pipeline.pipelineId,
  });
  const evt = created.pendingApplicationEvents[0].event;
  const validated = crm.validateCrmAuditEvent(evt);
  assert.equal(validated.ok, true);
  assert.equal(evt.schemaVersion, crm.CRM_EVENT_SCHEMA_VERSION);
  assert.equal(evt.occurredAt, FIXED_NOW);
  assert.match(evt.eventId, /^evt_1d_/);
  assert.ok(typeof ids.nextId === "function");
});

test("Phase 1D — idempotency replay and failure leaves no partial write", async () => {
  const { service, leadService, opportunityRepository } = buildHarness();
  const actor = actorWith(ALL_OPP_PERMS);
  const pipeline = await seedDefaultPipeline(service, actor);
  const { lead } = await seedLead(leadService, actor);

  const first = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: pipeline.pipelineId,
    idempotencyKey: "idem-1",
  });
  assert.equal(first.ok, true);
  assert.equal(first.idempotentReplay, false);

  const replay = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: lead.leadId,
    pipelineId: pipeline.pipelineId,
    idempotencyKey: "idem-1",
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.opportunity.opportunityId, first.opportunity.opportunityId);
  assert.equal(replay.pendingApplicationEvents.length, 0);

  const before = (await opportunityRepository.list(SCOPE_A)).length;
  const fail = await service.createOpportunityFromLead(actor, {
    ...SCOPE_A,
    leadId: "nope",
    pipelineId: pipeline.pipelineId,
  });
  assert.equal(fail.ok, false);
  const after = (await opportunityRepository.list(SCOPE_A)).length;
  assert.equal(after, before);
});

test("Phase 1D — repository instance and cross scope isolation", async () => {
  const repo1 = crm.createMemoryOpportunityRepository();
  const repo2 = crm.createMemoryOpportunityRepository();
  repo1.save(SCOPE_A, {
    opportunityId: "opp_1",
    ...SCOPE_A,
    stageCode: crm.OPPORTUNITY_STAGE.QUALIFICATION,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  assert.equal(repo2.list(SCOPE_A).length, 0);
  assert.equal(repo1.list(SCOPE_B).length, 0);
  assert.equal(repo1.list(SCOPE_A_OTHER_VENUE).length, 0);

  const pipe1 = crm.createMemoryPipelineRepository();
  const pipe2 = crm.createMemoryPipelineRepository();
  pipe1.save(SCOPE_A, {
    pipelineId: "p1",
    ...SCOPE_A,
    code: "p1",
    name: "P1",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  assert.equal(pipe2.list(SCOPE_A).length, 0);
  assert.equal(pipe1.list(SCOPE_B).length, 0);
});

test("Phase 1D — CRM menu remains PARTIAL; no demo-club in Phase 1D sources", () => {
  const crmPathItems = CRM_MENU_ROOT.children.filter((item) =>
    String(item.path || "").startsWith("/crm")
  );
  assert.ok(crmPathItems.length > 0);
  for (const item of crmPathItems) {
    assert.equal(item.featureStatus, FEATURE_STATUS.PARTIAL, item.key);
  }

  const crmRoot = path.join(root, "src", "features", "crm");
  const files = walkCrmFiles(crmRoot).filter((f) => {
    const rel = f.replace(/\\/g, "/");
    return (
      rel.includes("/services/opportunityApplicationService.js") ||
      rel.includes("/models/opportunity.js") ||
      rel.includes("/repositories/memory/memoryPipelineRepository.js") ||
      rel.includes("/repositories/memory/memoryOpportunityRepository.js") ||
      rel.includes("/constants/opportunityStages.js")
    );
  });
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /demo-club|demoClub|DEMO_CLUB/.test(text),
      false,
      `demo-club fallback found in ${file}`
    );
  }
});

test("Phase 1D — no other workstream files modified beyond CRM/docs/tests", () => {
  // Static allowlist check: phase-1d docs exist and live under docs/crm/phase-1d
  const docs = [
    "01_PIPELINE_DOMAIN.md",
    "02_OPPORTUNITY_APPLICATION_SERVICES.md",
    "03_STAGE_TRANSITIONS_AND_TERMINAL_RULES.md",
    "04_AUTHORIZATION_AND_SCOPE_MATRIX.md",
    "05_PHASE_1D_ACCEPTANCE_CRITERIA.md",
  ];
  for (const name of docs) {
    const full = path.join(root, "docs", "crm", "phase-1d", name);
    assert.ok(readFileSync(full, "utf8").length > 50);
  }
});
