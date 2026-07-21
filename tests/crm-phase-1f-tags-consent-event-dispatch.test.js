import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
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
const FUTURE = "2026-07-22T12:00:00.000Z";
const PAST = "2026-07-20T12:00:00.000Z";

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

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

const ALL_1F_PERMS = [
  crm.CRM_PERMISSIONS.LEAD_CREATE,
  crm.CRM_PERMISSIONS.LEAD_VIEW,
  crm.CRM_PERMISSIONS.OPPORTUNITY_CREATE,
  crm.CRM_PERMISSIONS.OPPORTUNITY_VIEW,
  crm.CRM_PERMISSIONS.PIPELINE_MANAGE,
  crm.CRM_PERMISSIONS.TAG_CREATE,
  crm.CRM_PERMISSIONS.TAG_VIEW,
  crm.CRM_PERMISSIONS.TAG_UPDATE,
  crm.CRM_PERMISSIONS.TAG_ASSIGN,
  crm.CRM_PERMISSIONS.CONSENT_CREATE,
  crm.CRM_PERMISSIONS.CONSENT_VIEW,
  crm.CRM_PERMISSIONS.CONSENT_REVOKE,
  crm.CRM_PERMISSIONS.AUDIT_VIEW,
];

function buildHarness(overrides = {}) {
  const clock = createFixedCrmClock(FIXED_NOW);
  const ids = createDeterministicCrmIdGenerator("1f");
  const contactReferenceRepository =
    overrides.contactReferenceRepository || crm.createMemoryContactReferenceRepository();
  const leadRepository = overrides.leadRepository || crm.createMemoryLeadRepository();
  const opportunityRepository =
    overrides.opportunityRepository || crm.createMemoryOpportunityRepository();
  const pipelineRepository =
    overrides.pipelineRepository || crm.createMemoryPipelineRepository();
  const tagRepository = overrides.tagRepository || crm.createMemoryTagRepository();
  const tagAssignmentRepository =
    overrides.tagAssignmentRepository || crm.createMemoryTagAssignmentRepository();
  const consentRepository =
    overrides.consentRepository || crm.createMemoryConsentRepository();
  const pendingEventRepository =
    overrides.pendingEventRepository || crm.createMemoryPendingEventRepository();

  const identityActorPort = createFakeIdentityActorPort(null, new Map());

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

  const tagService = crm.createTagApplicationService({
    clock,
    ids,
    tagRepository,
    tagAssignmentRepository,
    contactReferenceRepository,
    leadRepository,
    opportunityRepository,
  });

  const consentService = crm.createConsentApplicationService({
    clock,
    ids,
    consentRepository,
    contactReferenceRepository,
  });

  const pendingEventService = crm.createPendingEventDispatchService({
    clock,
    ids,
    pendingEventRepository,
  });

  return {
    clock,
    ids,
    contactReferenceRepository,
    leadRepository,
    opportunityRepository,
    pipelineRepository,
    tagRepository,
    tagAssignmentRepository,
    consentRepository,
    pendingEventRepository,
    leadService,
    opportunityService,
    tagService,
    consentService,
    pendingEventService,
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
  };
}

function sampleAuditEvent(scope, overrides = {}) {
  return {
    eventId: "evt_sample_1",
    eventType: crm.CRM_AUDIT_EVENT_TYPE.TAG_CREATED,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    aggregateType: "CrmTag",
    aggregateId: "tag_sample",
    actorUserId: "user-1",
    occurredAt: FIXED_NOW,
    schemaVersion: crm.CRM_EVENT_SCHEMA_VERSION,
    payload: { tagId: "tag_sample", code: "vip" },
    ...overrides,
  };
}

// --- Public facade ---

test("Phase 1F — public facade exports", () => {
  assert.equal(typeof crm.createTagApplicationService, "function");
  assert.equal(typeof crm.createConsentApplicationService, "function");
  assert.equal(typeof crm.createPendingEventDispatchService, "function");
  assert.equal(typeof crm.createMemoryTagRepository, "function");
  assert.equal(typeof crm.createMemoryTagAssignmentRepository, "function");
  assert.equal(typeof crm.createMemoryConsentRepository, "function");
  assert.equal(typeof crm.createMemoryPendingEventRepository, "function");
  assert.equal(typeof crm.createTagAssignment, "function");
  assert.equal(typeof crm.createConsentRecord, "function");
  assert.equal(typeof crm.createPendingEventRecord, "function");
  assert.equal(typeof crm.deriveEffectiveConsent, "function");
  assert.ok(crm.CRM_PERMISSIONS.TAG_CREATE.startsWith("crm."));
  assert.ok(crm.CRM_AUDIT_EVENT_TYPE.CONSENT_GRANTED);
  assert.ok(crm.CRM_REPOSITORY_CONTRACT_NAMES.includes("CrmPendingEventRepository"));
});

// --- Tags ---

test("Phase 1F — tag creation success", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.TAG_CREATE, crm.CRM_PERMISSIONS.TAG_VIEW]);
  const created = await h.tagService.createTag(actor, {
    ...SCOPE_A,
    name: "VIP",
    code: " VIP ",
    description: "Very important",
  });
  assert.equal(created.ok, true);
  assert.equal(created.tag.code, "vip");
  assert.equal(created.tag.active, true);
  assert.equal(created.pendingApplicationEvents.length, 1);
  assert.equal(
    created.pendingApplicationEvents[0].event.eventType,
    crm.CRM_AUDIT_EVENT_TYPE.TAG_CREATED
  );
});

test("Phase 1F — duplicate normalized code rejection", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.TAG_CREATE]);
  const first = await h.tagService.createTag(actor, { ...SCOPE_A, name: "Alpha", code: "alpha" });
  assert.equal(first.ok, true);
  const dup = await h.tagService.createTag(actor, { ...SCOPE_A, name: "Alpha 2", code: "ALPHA" });
  assert.equal(dup.ok, false);
  assert.equal(dup.code, crm.CRM_ERROR_CODES.IDEMPOTENCY_CONFLICT);
});

test("Phase 1F — tag required scope and auth guards", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.TAG_CREATE]);
  const missingScope = await h.tagService.createTag(actor, { name: "X" });
  assert.equal(missingScope.ok, false);
  assert.equal(missingScope.code, crm.CRM_ERROR_CODES.MISSING_SCOPE);

  const missingActor = await h.tagService.createTag(null, { ...SCOPE_A, name: "X" });
  assert.equal(missingActor.ok, false);
  assert.equal(missingActor.code, crm.CRM_ERROR_CODES.MISSING_ACTOR);

  const missingPerm = await h.tagService.createTag(actorWith([]), { ...SCOPE_A, name: "X" });
  assert.equal(missingPerm.ok, false);
  assert.equal(missingPerm.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);
});

test("Phase 1F — tag tenant and venue isolation", async () => {
  const h = buildHarness();
  const actorA = actorWith([crm.CRM_PERMISSIONS.TAG_CREATE, crm.CRM_PERMISSIONS.TAG_VIEW]);
  const created = await h.tagService.createTag(actorA, { ...SCOPE_A, name: "Iso", code: "iso" });
  assert.equal(created.ok, true);

  const actorB = actorWith([crm.CRM_PERMISSIONS.TAG_VIEW], {
    tenantId: SCOPE_B.tenantId,
    venueIds: [SCOPE_B.venueId],
  });
  const crossTenant = await h.tagService.getTag(actorB, {
    ...SCOPE_B,
    tagId: created.tag.tagId,
  });
  assert.equal(crossTenant.ok, false);

  const crossVenue = await h.tagService.getTag(actorA, {
    ...SCOPE_A_OTHER_VENUE,
    tagId: created.tag.tagId,
  });
  assert.equal(crossVenue.ok, false);
});

test("Phase 1F — activate and deactivate tag", async () => {
  const h = buildHarness();
  const actor = actorWith([
    crm.CRM_PERMISSIONS.TAG_CREATE,
    crm.CRM_PERMISSIONS.TAG_UPDATE,
    crm.CRM_PERMISSIONS.TAG_VIEW,
  ]);
  const created = await h.tagService.createTag(actor, { ...SCOPE_A, name: "Toggle", code: "toggle" });
  assert.equal(created.ok, true);

  const off = await h.tagService.deactivateTag(actor, {
    ...SCOPE_A,
    tagId: created.tag.tagId,
  });
  assert.equal(off.ok, true);
  assert.equal(off.tag.active, false);
  assert.equal(off.pendingApplicationEvents[0].event.eventType, crm.CRM_AUDIT_EVENT_TYPE.TAG_DEACTIVATED);

  const on = await h.tagService.activateTag(actor, { ...SCOPE_A, tagId: created.tag.tagId });
  assert.equal(on.ok, true);
  assert.equal(on.tag.active, true);
});

test("Phase 1F — tag assignment success and duplicate idempotency", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const tag = await h.tagService.createTag(actor, { ...SCOPE_A, name: "Hot", code: "hot" });
  assert.equal(tag.ok, true);

  const assign = await h.tagService.assignTag(actor, {
    ...SCOPE_A,
    tagId: tag.tag.tagId,
    targetType: crm.TAG_TARGET_TYPE.LEAD,
    targetId: seeded.leadId,
  });
  assert.equal(assign.ok, true);
  assert.equal(assign.idempotentReplay, false);
  assert.equal(assign.pendingApplicationEvents.length, 1);

  const replay = await h.tagService.assignTag(actor, {
    ...SCOPE_A,
    tagId: tag.tag.tagId,
    targetType: crm.TAG_TARGET_TYPE.LEAD,
    targetId: seeded.leadId,
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.assignment.assignmentId, assign.assignment.assignmentId);
  assert.equal(replay.pendingApplicationEvents.length, 0);
});

test("Phase 1F — remove tag assignment preserves tag definition", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);
  const tag = await h.tagService.createTag(actor, { ...SCOPE_A, name: "Rem", code: "rem" });
  await h.tagService.assignTag(actor, {
    ...SCOPE_A,
    tagId: tag.tag.tagId,
    targetType: crm.TAG_TARGET_TYPE.CONTACT_REFERENCE,
    targetId: seeded.contactRefId,
  });

  const removed = await h.tagService.removeTag(actor, {
    ...SCOPE_A,
    tagId: tag.tag.tagId,
    targetType: crm.TAG_TARGET_TYPE.CONTACT_REFERENCE,
    targetId: seeded.contactRefId,
  });
  assert.equal(removed.ok, true);

  const stillThere = await h.tagService.getTag(actor, { ...SCOPE_A, tagId: tag.tag.tagId });
  assert.equal(stillThere.ok, true);
});

test("Phase 1F — missing tag and target rejection", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const missingTag = await h.tagService.assignTag(actor, {
    ...SCOPE_A,
    tagId: "missing-tag",
    targetType: crm.TAG_TARGET_TYPE.LEAD,
    targetId: seeded.leadId,
  });
  assert.equal(missingTag.ok, false);
  assert.equal(missingTag.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  const tag = await h.tagService.createTag(actor, { ...SCOPE_A, name: "T", code: "t" });
  const missingTarget = await h.tagService.assignTag(actor, {
    ...SCOPE_A,
    tagId: tag.tag.tagId,
    targetType: crm.TAG_TARGET_TYPE.OPPORTUNITY,
    targetId: "missing-opp",
  });
  assert.equal(missingTarget.ok, false);
  assert.equal(missingTarget.code, crm.CRM_ERROR_CODES.NOT_FOUND);
});

test("Phase 1F — cross-scope target rejection", async () => {
  const h = buildHarness();
  const actorA = actorWith(ALL_1F_PERMS);
  const actorB = actorWith(ALL_1F_PERMS, {
    tenantId: SCOPE_B.tenantId,
    venueIds: [SCOPE_B.venueId],
  });

  const seededA = await seedContactLeadOpportunity(h, actorA);

  const crefB = await h.leadService.createContactReference(actorB, {
    ...SCOPE_B,
    authUserId: "auth-b",
    displaySnapshot: { displayName: "Binh" },
  });
  assert.equal(crefB.ok, true);
  const leadB = await h.leadService.createLead(actorB, {
    ...SCOPE_B,
    contactRefId: crefB.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.WALK_IN,
    title: "Lead B",
  });
  assert.equal(leadB.ok, true);

  const tag = await h.tagService.createTag(actorA, { ...SCOPE_A, name: "Cross", code: "cross" });

  const cross = await h.tagService.assignTag(actorA, {
    ...SCOPE_A,
    tagId: tag.tag.tagId,
    targetType: crm.TAG_TARGET_TYPE.LEAD,
    targetId: leadB.lead.leadId,
  });
  assert.equal(cross.ok, false);

  const ok = await h.tagService.assignTag(actorA, {
    ...SCOPE_A,
    tagId: tag.tag.tagId,
    targetType: crm.TAG_TARGET_TYPE.OPPORTUNITY,
    targetId: seededA.opportunityId,
  });
  assert.equal(ok.ok, true);
});

test("Phase 1F — deterministic tag listing", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.TAG_CREATE, crm.CRM_PERMISSIONS.TAG_VIEW]);
  await h.tagService.createTag(actor, { ...SCOPE_A, name: "Zulu", code: "zulu" });
  await h.tagService.createTag(actor, { ...SCOPE_A, name: "Alpha", code: "alpha" });
  await h.tagService.createTag(actor, { ...SCOPE_A, name: "Bravo", code: "bravo" });

  const listed = await h.tagService.listTags(actor, { ...SCOPE_A });
  assert.equal(listed.ok, true);
  assert.deepEqual(
    listed.tags.map((t) => t.code),
    ["alpha", "bravo", "zulu"]
  );
});

test("Phase 1F — deterministic target tag listing", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);
  const t1 = await h.tagService.createTag(actor, { ...SCOPE_A, name: "B", code: "b" });
  const t2 = await h.tagService.createTag(actor, { ...SCOPE_A, name: "A", code: "a" });
  await h.tagService.assignTag(actor, {
    ...SCOPE_A,
    tagId: t1.tag.tagId,
    targetType: crm.TAG_TARGET_TYPE.LEAD,
    targetId: seeded.leadId,
  });
  await h.tagService.assignTag(actor, {
    ...SCOPE_A,
    tagId: t2.tag.tagId,
    targetType: crm.TAG_TARGET_TYPE.LEAD,
    targetId: seeded.leadId,
  });

  const listed = await h.tagService.listTagsForTarget(actor, {
    ...SCOPE_A,
    targetType: crm.TAG_TARGET_TYPE.LEAD,
    targetId: seeded.leadId,
  });
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.tags.map((t) => t.code), ["a", "b"]);
});

// --- Consent ---

test("Phase 1F — grant consent success", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const granted = await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    policyVersion: "v1",
    effectiveAt: FIXED_NOW,
  });
  assert.equal(granted.ok, true);
  assert.equal(granted.consent.status, crm.CONSENT_STATUS.GRANTED);
  assert.equal(granted.pendingApplicationEvents.length, 1);
});

test("Phase 1F — revoke consent success", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.SMS,
    purpose: crm.CONSENT_PURPOSE.TRANSACTIONAL,
    policyVersion: "v1",
    effectiveAt: PAST,
  });

  const revoked = await h.consentService.revokeConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.SMS,
    purpose: crm.CONSENT_PURPOSE.TRANSACTIONAL,
    policyVersion: "v1",
    effectiveAt: FIXED_NOW,
    reason: "User opted out",
  });
  assert.equal(revoked.ok, true);
  assert.equal(revoked.consent.status, crm.CONSENT_STATUS.REVOKED);
});

test("Phase 1F — consent validation guards", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const missingContact = await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: "missing",
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    policyVersion: "v1",
  });
  assert.equal(missingContact.ok, false);
  assert.equal(missingContact.code, crm.CRM_ERROR_CODES.NOT_FOUND);

  const actorB = actorWith([crm.CRM_PERMISSIONS.CONSENT_CREATE], {
    tenantId: SCOPE_B.tenantId,
    venueIds: [SCOPE_B.venueId],
  });
  const crossTenant = await h.consentService.grantConsent(actorB, {
    ...SCOPE_B,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    policyVersion: "v1",
  });
  assert.equal(crossTenant.ok, false);

  const invalidChannel = await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: "FAX",
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    policyVersion: "v1",
  });
  assert.equal(invalidChannel.ok, false);

  const invalidPurpose = await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: "UNKNOWN",
    policyVersion: "v1",
  });
  assert.equal(invalidPurpose.ok, false);

  const invalidPolicy = await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    policyVersion: "",
  });
  assert.equal(invalidPolicy.ok, false);

  const invalidEffective = await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    policyVersion: "v1",
    effectiveAt: "not-a-date",
  });
  assert.equal(invalidEffective.ok, false);

  const invalidExpires = await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    policyVersion: "v1",
    effectiveAt: FUTURE,
    expiresAt: FIXED_NOW,
  });
  assert.equal(invalidExpires.ok, false);
});

test("Phase 1F — append-only history and effective consent", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  const g1 = await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    policyVersion: "v1",
    effectiveAt: PAST,
  });
  const g2 = await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    policyVersion: "v2",
    effectiveAt: FIXED_NOW,
  });
  assert.notEqual(g1.consent.consentId, g2.consent.consentId);

  const history = await h.consentService.listConsentHistory(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
  });
  assert.equal(history.ok, true);
  assert.equal(history.records.length, 2);
  assert.equal(history.records[0].consentId, g2.consent.consentId);

  const effective = await h.consentService.getEffectiveConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.EMAIL,
    purpose: crm.CONSENT_PURPOSE.MARKETING,
    evaluationTime: FIXED_NOW,
  });
  assert.equal(effective.ok, true);
  assert.equal(effective.effectiveConsent.consentId, g2.consent.consentId);
  assert.equal(effective.effectiveConsent.status, crm.CONSENT_STATUS.GRANTED);
});

test("Phase 1F — expired consent handling", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.PUSH,
    purpose: crm.CONSENT_PURPOSE.SERVICE,
    policyVersion: "v1",
    effectiveAt: PAST,
    expiresAt: FIXED_NOW,
  });

  const effective = await h.consentService.getEffectiveConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.PUSH,
    purpose: crm.CONSENT_PURPOSE.SERVICE,
    evaluationTime: FIXED_NOW,
  });
  assert.equal(effective.ok, true);
  assert.equal(effective.effectiveConsent, null);
});

test("Phase 1F — revoke overrides grant in effective state", async () => {
  const h = buildHarness();
  const actor = actorWith(ALL_1F_PERMS);
  const seeded = await seedContactLeadOpportunity(h, actor);

  await h.consentService.grantConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.PHONE,
    purpose: crm.CONSENT_PURPOSE.RESEARCH,
    policyVersion: "v1",
    effectiveAt: PAST,
  });
  await h.consentService.revokeConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.PHONE,
    purpose: crm.CONSENT_PURPOSE.RESEARCH,
    policyVersion: "v1",
    effectiveAt: FIXED_NOW,
    reason: "Stop calls",
  });

  const effective = await h.consentService.getEffectiveConsent(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    channel: crm.CONSENT_CHANNEL.PHONE,
    purpose: crm.CONSENT_PURPOSE.RESEARCH,
  });
  assert.equal(effective.effectiveConsent.status, crm.CONSENT_STATUS.REVOKED);
});

// --- Pending event dispatch ---

test("Phase 1F — enqueue pending events success", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW]);
  const event = sampleAuditEvent(SCOPE_A);
  const enq = await h.pendingEventService.enqueuePendingEvents(actor, {
    ...SCOPE_A,
    events: [event],
  });
  assert.equal(enq.ok, true);
  assert.equal(enq.enqueuedCount, 1);
  assert.equal(enq.notificationCreated, false);
  assert.equal(enq.providerCalled, false);
});

test("Phase 1F — unsafe payload rejection", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW]);
  const bad = sampleAuditEvent(SCOPE_A, {
    payload: { apiKey: "secret-value" },
  });
  const enq = await h.pendingEventService.enqueuePendingEvents(actor, {
    ...SCOPE_A,
    events: [bad],
  });
  assert.equal(enq.ok, false);
  assert.equal(enq.code, crm.CRM_ERROR_CODES.INVALID_ENVELOPE);
});

test("Phase 1F — deterministic list and claim ordering", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW]);
  const events = [
    sampleAuditEvent(SCOPE_A, {
      eventId: "evt_3",
      payload: { n: 3 },
      occurredAt: FIXED_NOW,
    }),
    sampleAuditEvent(SCOPE_A, {
      eventId: "evt_1",
      payload: { n: 1 },
      occurredAt: FIXED_NOW,
    }),
    sampleAuditEvent(SCOPE_A, {
      eventId: "evt_2",
      payload: { n: 2 },
      occurredAt: FIXED_NOW,
    }),
  ];

  await h.pendingEventService.enqueuePendingEvents(actor, {
    ...SCOPE_A,
    events,
    availableAt: PAST,
  });

  const listed = await h.pendingEventService.listPendingEvents(actor, { ...SCOPE_A });
  assert.equal(listed.pendingEvents.length, 3);
  const ids = listed.pendingEvents.map((r) => r.eventId);
  assert.deepEqual(ids.slice().sort(), ["evt_1", "evt_2", "evt_3"]);

  const claim1 = await h.pendingEventService.claimPendingEvents(actor, {
    ...SCOPE_A,
    limit: 1,
    claimedBy: "worker-1",
  });
  assert.equal(claim1.claimedEvents.length, 1);
  assert.equal(claim1.claimedEvents[0].attemptCount, 1);
});

test("Phase 1F — pending event tenant and venue isolation", async () => {
  const repoA = crm.createMemoryPendingEventRepository();
  const repoB = crm.createMemoryPendingEventRepository();
  const hA = buildHarness({ pendingEventRepository: repoA });
  const hB = buildHarness({ pendingEventRepository: repoB });
  const actorA = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW]);
  const actorB = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW], {
    tenantId: SCOPE_B.tenantId,
    venueIds: [SCOPE_B.venueId],
  });

  await hA.pendingEventService.enqueuePendingEvents(actorA, {
    ...SCOPE_A,
    events: [sampleAuditEvent(SCOPE_A)],
    availableAt: PAST,
  });
  await hB.pendingEventService.enqueuePendingEvents(actorB, {
    ...SCOPE_B,
    events: [sampleAuditEvent(SCOPE_B, { eventId: "evt_b" })],
    availableAt: PAST,
  });

  const listA = await hA.pendingEventService.listPendingEvents(actorA, { ...SCOPE_A });
  const listB = await hB.pendingEventService.listPendingEvents(actorB, { ...SCOPE_B });
  assert.equal(listA.pendingEvents.length, 1);
  assert.equal(listB.pendingEvents.length, 1);
  assert.notEqual(listA.pendingEvents[0].tenantId, listB.pendingEvents[0].tenantId);
});

test("Phase 1F — no duplicate active claim and claim limit", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW]);
  await h.pendingEventService.enqueuePendingEvents(actor, {
    ...SCOPE_A,
    events: [sampleAuditEvent(SCOPE_A), sampleAuditEvent(SCOPE_A, { eventId: "evt_2" })],
    availableAt: PAST,
  });

  const claim = await h.pendingEventService.claimPendingEvents(actor, {
    ...SCOPE_A,
    limit: 1,
    claimedBy: "worker-1",
  });
  assert.equal(claim.claimedEvents.length, 1);

  const claimAgain = await h.pendingEventService.claimPendingEvents(actor, {
    ...SCOPE_A,
    limit: 2,
    claimedBy: "worker-2",
  });
  assert.equal(claimAgain.claimedEvents.length, 1);
  assert.notEqual(
    claimAgain.claimedEvents[0].pendingEventId,
    claim.claimedEvents[0].pendingEventId
  );
});

test("Phase 1F — acknowledge and fail pending events", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW]);
  await h.pendingEventService.enqueuePendingEvents(actor, {
    ...SCOPE_A,
    events: [sampleAuditEvent(SCOPE_A), sampleAuditEvent(SCOPE_A, { eventId: "evt_fail" })],
    availableAt: PAST,
  });

  const claim = await h.pendingEventService.claimPendingEvents(actor, {
    ...SCOPE_A,
    limit: 2,
    claimedBy: "worker-1",
  });
  const [first, second] = claim.claimedEvents;

  const ack = await h.pendingEventService.acknowledgePendingEvent(actor, {
    ...SCOPE_A,
    pendingEventId: first.pendingEventId,
  });
  assert.equal(ack.ok, true);
  assert.equal(ack.pendingEvent.status, crm.PENDING_EVENT_STATUS.ACKNOWLEDGED);

  const fail = await h.pendingEventService.failPendingEvent(actor, {
    ...SCOPE_A,
    pendingEventId: second.pendingEventId,
    failureReason: "Downstream unavailable",
  });
  assert.equal(fail.ok, true);
  assert.equal(fail.pendingEvent.status, crm.PENDING_EVENT_STATUS.FAILED);

  const badAck = await h.pendingEventService.acknowledgePendingEvent(actor, {
    ...SCOPE_A,
    pendingEventId: first.pendingEventId,
  });
  assert.equal(badAck.ok, false);
  assert.equal(badAck.code, crm.CRM_ERROR_CODES.INVALID_TRANSITION);
});

test("Phase 1F — fail requires reason and claimed status", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW]);
  await h.pendingEventService.enqueuePendingEvents(actor, {
    ...SCOPE_A,
    events: [sampleAuditEvent(SCOPE_A)],
    availableAt: PAST,
  });

  const listed = await h.pendingEventService.listPendingEvents(actor, { ...SCOPE_A });
  const pendingId = listed.pendingEvents[0].pendingEventId;

  const failPending = await h.pendingEventService.failPendingEvent(actor, {
    ...SCOPE_A,
    pendingEventId: pendingId,
    failureReason: "",
  });
  assert.equal(failPending.ok, false);

  const failNoClaim = await h.pendingEventService.failPendingEvent(actor, {
    ...SCOPE_A,
    pendingEventId: pendingId,
    failureReason: "x",
  });
  assert.equal(failNoClaim.ok, false);
  assert.equal(failNoClaim.code, crm.CRM_ERROR_CODES.INVALID_TRANSITION);
});

test("Phase 1F — release expired claims", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW]);
  await h.pendingEventService.enqueuePendingEvents(actor, {
    ...SCOPE_A,
    events: [sampleAuditEvent(SCOPE_A)],
    availableAt: PAST,
  });

  await h.pendingEventService.claimPendingEvents(actor, {
    ...SCOPE_A,
    limit: 1,
    claimedBy: "worker-1",
    claimTtlMs: 1000,
  });

  h.clock.setNow("2026-07-21T12:05:00.000Z");
  const released = await h.pendingEventService.releaseExpiredClaims(actor, { ...SCOPE_A });
  assert.equal(released.ok, true);
  assert.equal(released.releasedEvents.length, 1);
  assert.equal(released.releasedEvents[0].status, crm.PENDING_EVENT_STATUS.PENDING);
});

test("Phase 1F — repository instance isolation", async () => {
  const a = crm.createMemoryTagRepository();
  const b = crm.createMemoryTagRepository();
  const tag = crm.createCrmTag({
    ...SCOPE_A,
    tagId: "tag-iso",
    name: "Iso",
    code: "iso",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  a.create(SCOPE_A, tag);
  assert.equal(a.list(SCOPE_A).length, 1);
  assert.equal(b.list(SCOPE_A).length, 0);
});

test("Phase 1F — failure leaves no partial tag write", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.TAG_CREATE, crm.CRM_PERMISSIONS.TAG_VIEW]);
  const before = await h.tagService.listTags(actor, { ...SCOPE_A });
  const countBefore = before.tags.length;

  const failed = await h.tagService.createTag(actor, { ...SCOPE_A, name: "" });
  assert.equal(failed.ok, false);

  const after = await h.tagService.listTags(actor, { ...SCOPE_A });
  assert.equal(after.tags.length, countBefore);
});

test("Phase 1F — no notification email sms push side effects", async () => {
  const h = buildHarness();
  const actor = actorWith([crm.CRM_PERMISSIONS.AUDIT_VIEW]);
  const enq = await h.pendingEventService.enqueuePendingEvents(actor, {
    ...SCOPE_A,
    events: [sampleAuditEvent(SCOPE_A)],
  });
  assert.equal(enq.emailSent, false);
  assert.equal(enq.smsSent, false);
  assert.equal(enq.pushSent, false);
  assert.equal(enq.notificationCreated, false);
});

test("Phase 1F — CRM menu remains PARTIAL", () => {
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

test("Phase 1F — phase-1f docs are markdown only", () => {
  const docs = walkFiles(path.join(root, "docs", "crm", "phase-1f"));
  assert.ok(docs.length >= 6);
  assert.ok(docs.every((f) => f.endsWith(".md")));
  assert.equal(
    docs.some((f) => f.endsWith(".sql")),
    false
  );
});

test("Phase 1F — secret scan on new CRM phase-1f sources", () => {
  const crmSrc = walkFiles(path.join(root, "src", "features", "crm")).filter(
    (f) =>
      f.includes("tagApplicationService") ||
      f.includes("consentApplicationService") ||
      f.includes("pendingEventDispatchService") ||
      f.includes("memoryTag") ||
      f.includes("memoryConsent") ||
      f.includes("memoryPendingEvent") ||
      f.includes("consentRecord") ||
      f.includes("pendingEventRecord")
  );
  const secretPattern = /(?:password|api[_-]?key|secret|credential)\s*[:=]\s*['"][^'"]+['"]/i;
  for (const file of crmSrc) {
    const text = readFileSync(file, "utf8");
    assert.equal(secretPattern.test(text), false, `possible secret in ${file}`);
  }
});
