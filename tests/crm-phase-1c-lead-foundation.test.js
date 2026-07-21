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
  createFakePlayerDirectory,
  createFakeVenueCustomerDirectory,
  createFixedCrmClock,
} from "../src/features/crm/testing/phase1cFakes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", venueId: "venue-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", venueId: "venue-b" });
const FIXED_NOW = "2026-07-21T09:00:00.000Z";

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

function buildService(overrides = {}) {
  const clock = createFixedCrmClock(FIXED_NOW);
  const ids = createDeterministicCrmIdGenerator("det");
  const venueCustomerDirectory = createFakeVenueCustomerDirectory([
    {
      customerId: "cust-1",
      tenantId: SCOPE_A.tenantId,
      venueId: SCOPE_A.venueId,
      displayName: "An",
      phone: "090",
    },
    {
      customerId: "cust-other-tenant",
      tenantId: SCOPE_B.tenantId,
      venueId: SCOPE_B.venueId,
      displayName: "Other",
    },
    {
      customerId: "cust-other-venue",
      tenantId: SCOPE_A.tenantId,
      venueId: "venue-other",
      displayName: "OtherVenue",
    },
  ]);
  const playerDirectory = createFakePlayerDirectory([
    {
      playerId: "player-1",
      tenantId: SCOPE_A.tenantId,
      venueId: SCOPE_A.venueId,
      displayName: "Player One",
    },
    {
      playerId: "player-other-tenant",
      tenantId: SCOPE_B.tenantId,
      venueId: SCOPE_B.venueId,
      displayName: "Other Tenant Player",
    },
    {
      playerId: "player-other-venue",
      tenantId: SCOPE_A.tenantId,
      venueId: "venue-other",
      displayName: "Other Venue Player",
    },
    {
      playerId: "player-no-scope",
      displayName: "No Scope Player",
    },
  ]);
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
  ]);

  const leadRepository = overrides.leadRepository || crm.createMemoryLeadRepository();
  const contactReferenceRepository =
    overrides.contactReferenceRepository || crm.createMemoryContactReferenceRepository();

  const service = crm.createLeadApplicationService({
    clock,
    ids,
    leadRepository,
    contactReferenceRepository,
    venueCustomerDirectory,
    playerDirectory,
    identityActorPort: createFakeIdentityActorPort(null, assignable),
    ...overrides,
  });

  return {
    service,
    clock,
    ids,
    playerDirectory,
    leadRepository,
    contactReferenceRepository,
  };
}

async function createContactThenLead(service, actor, leadExtras = {}) {
  const contact = await service.createContactReference(actor, {
    ...SCOPE_A,
    customerId: "cust-1",
  });
  assert.equal(contact.ok, true, contact.error);
  const lead = await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: contact.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.WEB,
    ...leadExtras,
  });
  return { contact, lead };
}

test("Phase 1C — public facade exports application service and preserves Phase 1B", () => {
  assert.equal(typeof crm.createLeadApplicationService, "function");
  assert.equal(typeof crm.createMemoryContactReferenceRepository, "function");
  assert.equal(typeof crm.createLead, "function");
  assert.equal(typeof crm.authorizeCrm, "function");
  assert.ok(crm.CRM_AUDIT_EVENT_TYPE.CONTACT_REFERENCE_CREATED);
  assert.equal(crm.CRM_EVENT_SCHEMA_VERSION, 1);
  assert.equal(typeof crm.createFixedCrmClock, "undefined");
});

test("Phase 1C — createLead success", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const { lead } = await createContactThenLead(service, actor, {
    status: crm.LEAD_STATUS.NEW,
    title: "Gói tháng",
  });
  assert.equal(lead.ok, true);
  assert.equal(lead.lead.source, crm.LEAD_SOURCE.WEB);
  assert.equal(lead.lead.ownerUserId, "user-1");
  assert.equal(lead.lead.createdAt, FIXED_NOW);
  assert.ok(lead.lead.contactRefId);
  assert.equal(lead.pendingApplicationEvents.length, 2);
  assert.equal(lead.pendingApplicationEvents[0].delivery, "pending");
  assert.equal(lead.pendingApplicationEvents[0].event.eventType, crm.CRM_AUDIT_EVENT_TYPE.LEAD_CREATED);
  assert.equal(
    lead.pendingApplicationEvents[1].event.eventType,
    crm.CRM_INTEGRATION_EVENT_TYPE.LEAD_CREATED
  );
});

test("Phase 1C — getLead success", async () => {
  const { service } = buildService();
  const creator = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE, crm.CRM_PERMISSIONS.LEAD_VIEW]);
  const { lead: created } = await createContactThenLead(service, creator, {
    source: crm.LEAD_SOURCE.PHONE,
  });
  const got = await service.getLead(creator, { ...SCOPE_A, leadId: created.lead.leadId });
  assert.equal(got.ok, true);
  assert.equal(got.lead.leadId, created.lead.leadId);
});

test("Phase 1C — listLeads success deterministic order", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE, crm.CRM_PERMISSIONS.LEAD_VIEW]);
  const c1 = await service.createContactReference(actor, { ...SCOPE_A, customerId: "cust-1" });
  const c2 = await service.createContactReference(actor, { ...SCOPE_A, customerId: "cust-1" });
  await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: c1.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.WEB,
    leadId: "lead-b",
  });
  await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: c2.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.WEB,
    leadId: "lead-a",
  });
  const listed = await service.listLeads(actor, SCOPE_A);
  assert.equal(listed.ok, true);
  assert.deepEqual(
    listed.leads.map((l) => l.leadId),
    ["lead-a", "lead-b"]
  );
});

test("Phase 1C — assignLead success", async () => {
  const { service } = buildService();
  const actor = actorWith([
    crm.CRM_PERMISSIONS.LEAD_CREATE,
    crm.CRM_PERMISSIONS.LEAD_ASSIGN,
  ]);
  const { lead: created } = await createContactThenLead(service, actor, {
    source: crm.LEAD_SOURCE.REFERRAL,
  });
  const assigned = await service.assignLead(actor, {
    ...SCOPE_A,
    leadId: created.lead.leadId,
    ownerUserId: "owner-2",
  });
  assert.equal(assigned.ok, true);
  assert.equal(assigned.lead.ownerUserId, "owner-2");
  assert.equal(assigned.lead.leadId, created.lead.leadId);
  assert.equal(assigned.pendingApplicationEvents[0].event.eventType, crm.CRM_AUDIT_EVENT_TYPE.LEAD_ASSIGNED);
});

test("Phase 1C — missing actor rejection", async () => {
  const { service } = buildService();
  const result = await service.createLead(null, {
    ...SCOPE_A,
    contactRefId: "cref-x",
    source: crm.LEAD_SOURCE.WEB,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.MISSING_ACTOR);
});

test("Phase 1C — missing tenant rejection", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createLead(actor, {
    venueId: SCOPE_A.venueId,
    contactRefId: "cref-x",
    source: crm.LEAD_SOURCE.WEB,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.MISSING_SCOPE);
});

test("Phase 1C — missing venue rejection", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createLead(actor, {
    tenantId: SCOPE_A.tenantId,
    contactRefId: "cref-x",
    source: crm.LEAD_SOURCE.WEB,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.MISSING_SCOPE);
});

test("Phase 1C — missing create permission rejection", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_VIEW]);
  const result = await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: "cref-x",
    source: crm.LEAD_SOURCE.WEB,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);
});

test("Phase 1C — missing view permission rejection", async () => {
  const { service } = buildService();
  const creator = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const { lead: created } = await createContactThenLead(service, creator);
  const viewer = actorWith([]);
  const result = await service.getLead(viewer, { ...SCOPE_A, leadId: created.lead.leadId });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);
});

test("Phase 1C — missing assign permission rejection", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const { lead: created } = await createContactThenLead(service, actor);
  const result = await service.assignLead(actor, {
    ...SCOPE_A,
    leadId: created.lead.leadId,
    ownerUserId: "owner-2",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);
});

test("Phase 1C — cross-tenant Lead access rejection", async () => {
  const { service } = buildService();
  const creator = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE, crm.CRM_PERMISSIONS.LEAD_VIEW]);
  const { lead: created } = await createContactThenLead(service, creator);
  const otherActor = actorWith([crm.CRM_PERMISSIONS.LEAD_VIEW], {
    userId: "user-b",
    tenantId: SCOPE_B.tenantId,
    venueIds: [SCOPE_B.venueId],
  });
  const result = await service.getLead(otherActor, {
    ...SCOPE_B,
    leadId: created.lead.leadId,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.NOT_FOUND);
});

test("Phase 1C — cross-venue Lead access rejection", async () => {
  const { service } = buildService();
  const creator = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE, crm.CRM_PERMISSIONS.LEAD_VIEW]);
  const { lead: created } = await createContactThenLead(service, creator);
  const otherVenueActor = actorWith([crm.CRM_PERMISSIONS.LEAD_VIEW], {
    venueIds: ["venue-other"],
  });
  const result = await service.getLead(otherVenueActor, {
    tenantId: SCOPE_A.tenantId,
    venueId: "venue-other",
    leadId: created.lead.leadId,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.NOT_FOUND);
});

test("Phase 1C — cross-tenant customer reference rejection", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createContactReference(actor, {
    ...SCOPE_A,
    customerId: "cust-other-tenant",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.FORBIDDEN_SCOPE);
});

test("Phase 1C — cross-venue customer reference rejection", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createContactReference(actor, {
    ...SCOPE_A,
    customerId: "cust-other-venue",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.FORBIDDEN_SCOPE);
});

test("Phase 1C — missing external customer rejection", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createContactReference(actor, {
    ...SCOPE_A,
    customerId: "missing-cust",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.CONTACT_UNRESOLVED);
});

test("Phase 1C — invalid Lead source rejection", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const contact = await service.createContactReference(actor, {
    ...SCOPE_A,
    customerId: "cust-1",
  });
  const result = await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: contact.contactReference.contactRefId,
    source: "not-a-source",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.INVALID_STATUS);
});

test("Phase 1C — invalid Lead status rejection", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const contact = await service.createContactReference(actor, {
    ...SCOPE_A,
    customerId: "cust-1",
  });
  const result = await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: contact.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.WEB,
    status: "not-a-status",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.INVALID_STATUS);
});

test("Phase 1C — idempotency replay behavior", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const contact = await service.createContactReference(actor, {
    ...SCOPE_A,
    customerId: "cust-1",
  });
  const first = await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: contact.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.WEB,
    idempotencyKey: "idem-1",
  });
  const second = await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: contact.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.WEB,
    idempotencyKey: "idem-1",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.idempotentReplay, true);
  assert.equal(second.lead.leadId, first.lead.leadId);
  assert.equal(second.pendingApplicationEvents.length, 0);
});

test("Phase 1C — deterministic ID and timestamp behavior", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const contact = await service.createContactReference(actor, {
    ...SCOPE_A,
    customerId: "cust-1",
  });
  assert.equal(contact.contactReference.contactRefId, "cref_det_1");
  const lead = await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: contact.contactReference.contactRefId,
    source: crm.LEAD_SOURCE.BOOKING,
  });
  assert.equal(lead.lead.leadId, "lead_det_3");
  assert.equal(lead.lead.createdAt, FIXED_NOW);
  assert.equal(lead.auditEvent.occurredAt, FIXED_NOW);
});

test("Phase 1C — pending audit/integration envelopes on Lead creation", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const { lead } = await createContactThenLead(service, actor);
  const audit = lead.pendingApplicationEvents.find((e) => e.kind === "audit");
  const integration = lead.pendingApplicationEvents.find((e) => e.kind === "integration");
  assert.ok(audit);
  assert.equal(audit.delivery, "pending");
  assert.equal(audit.event.tenantId, SCOPE_A.tenantId);
  assert.equal(audit.event.schemaVersion, 1);
  assert.equal(crm.validateCrmIntegrationEvent(integration.event).ok, true);
});

test("Phase 1C — pending audit envelope on Lead assignment", async () => {
  const { service } = buildService();
  const actor = actorWith([
    crm.CRM_PERMISSIONS.LEAD_CREATE,
    crm.CRM_PERMISSIONS.LEAD_ASSIGN,
  ]);
  const { lead: created } = await createContactThenLead(service, actor);
  const assigned = await service.assignLead(actor, {
    ...SCOPE_A,
    leadId: created.lead.leadId,
    ownerUserId: "owner-2",
  });
  assert.equal(assigned.pendingApplicationEvents[0].event.payload.ownerUserId, "owner-2");
});

test("Phase 1C — repository instance isolation", async () => {
  const a = buildService();
  const b = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE, crm.CRM_PERMISSIONS.LEAD_VIEW]);
  await createContactThenLead(a.service, actor);
  const listedB = await b.service.listLeads(actor, SCOPE_A);
  assert.equal(listedB.ok, true);
  assert.equal(listedB.leads.length, 0);
});

test("Phase 1C — PlayerDirectoryPort receives tenantId venueId playerId", async () => {
  const { service, playerDirectory } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createContactReference(actor, {
    ...SCOPE_A,
    playerId: "player-1",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(playerDirectory.calls[0], {
    tenantId: SCOPE_A.tenantId,
    venueId: SCOPE_A.venueId,
    playerId: "player-1",
  });
});

test("Phase 1C — missing tenant scope in player resolution fails", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE], { tenantId: "" });
  // Actor without tenant fails at auth before directory; also test resolve helper path via empty command tenant.
  const result = await service.createContactReference(actor, {
    tenantId: "",
    venueId: SCOPE_A.venueId,
    playerId: "player-1",
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.code === crm.CRM_ERROR_CODES.MISSING_SCOPE ||
      result.code === crm.CRM_ERROR_CODES.MISSING_ACTOR
  );
});

test("Phase 1C — missing venue scope in player resolution fails", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createContactReference(actor, {
    tenantId: SCOPE_A.tenantId,
    venueId: "",
    playerId: "player-1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.MISSING_SCOPE);
});

test("Phase 1C — cross-tenant returned player fails", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createContactReference(actor, {
    ...SCOPE_A,
    playerId: "player-other-tenant",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.FORBIDDEN_SCOPE);
});

test("Phase 1C — cross-venue returned player fails", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createContactReference(actor, {
    ...SCOPE_A,
    playerId: "player-other-venue",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.FORBIDDEN_SCOPE);
});

test("Phase 1C — returned player without scope fails", async () => {
  const { service } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createContactReference(actor, {
    ...SCOPE_A,
    playerId: "player-no-scope",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.CONTACT_UNRESOLVED);
});

test("Phase 1C — createLead requires existing ContactReference (no silent dual write)", async () => {
  const { service, contactReferenceRepository } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createLead(actor, {
    ...SCOPE_A,
    customerId: "cust-1",
    source: crm.LEAD_SOURCE.WEB,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.INVALID_INPUT);
  assert.equal(contactReferenceRepository.list(SCOPE_A).length, 0);
});

test("Phase 1C — Lead creation failure leaves no partial aggregate write", async () => {
  const { service, leadRepository, contactReferenceRepository } = buildService();
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const contact = await service.createContactReference(actor, {
    ...SCOPE_A,
    customerId: "cust-1",
  });
  const beforeContacts = contactReferenceRepository.list(SCOPE_A).length;
  const result = await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: contact.contactReference.contactRefId,
    source: "bad-source",
  });
  assert.equal(result.ok, false);
  assert.equal(leadRepository.list(SCOPE_A).length, 0);
  assert.equal(contactReferenceRepository.list(SCOPE_A).length, beforeContacts);
});

test("Phase 1C — invalid envelope before write leaves no Lead", async () => {
  const brokenIds = {
    nextId() {
      return "";
    },
  };
  const { service, leadRepository, contactReferenceRepository } = buildService({
    ids: brokenIds,
  });
  // Seed a contact via repository directly so createLead can resolve it.
  const seeded = contactReferenceRepository.save(SCOPE_A, {
    contactRefId: "cref-seed",
    tenantId: SCOPE_A.tenantId,
    venueId: SCOPE_A.venueId,
    customerId: "cust-1",
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const result = await service.createLead(actor, {
    ...SCOPE_A,
    contactRefId: seeded.contactRefId,
    source: crm.LEAD_SOURCE.WEB,
    leadId: "lead-seed",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.INVALID_ENVELOPE);
  assert.equal(leadRepository.list(SCOPE_A).length, 0);
});

test("Phase 1C — inactive assignment target rejected", async () => {
  const { service } = buildService();
  const actor = actorWith([
    crm.CRM_PERMISSIONS.LEAD_CREATE,
    crm.CRM_PERMISSIONS.LEAD_ASSIGN,
  ]);
  const { lead: created } = await createContactThenLead(service, actor);
  const result = await service.assignLead(actor, {
    ...SCOPE_A,
    leadId: created.lead.leadId,
    ownerUserId: "owner-inactive",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.INVALID_INPUT);
});

test("Phase 1C — CRM menu remains PARTIAL", () => {
  const crmPathItems = CRM_MENU_ROOT.children.filter((item) =>
    String(item.path || "").startsWith("/crm/")
  );
  assert.ok(crmPathItems.length >= 5);
  for (const item of crmPathItems) {
    assert.equal(item.featureStatus, FEATURE_STATUS.PARTIAL, item.key);
  }
});

test("Phase 1C — static scan: no best-effort compensation or unscoped player getById", () => {
  const phase1cSources = [
    "src/features/crm/services/leadApplicationService.js",
    "src/features/crm/services/resolveContactReferences.js",
    "src/features/crm/services/eventEmitHelpers.js",
    "src/features/crm/testing/phase1cFakes.js",
    "src/features/crm/contracts/ports.js",
  ];
  const badPatterns = [
    /compensating delete/i,
    /best-effort/i,
    /playerDirectory\.getById\(\s*playerId\s*\)/,
    /playerDirectory\.getById\(\s*[a-zA-Z_][\w]*\s*\)/,
  ];
  for (const rel of phase1cSources) {
    const text = readFileSync(path.join(root, rel), "utf8");
    for (const pattern of badPatterns) {
      assert.equal(pattern.test(text), false, `${rel} matched ${pattern}`);
    }
    assert.equal(/\|\|\s*["']demo-club["']/.test(text), false, rel);
  }

  // Positive: scoped call form must exist in resolver.
  const resolver = readFileSync(
    path.join(root, "src/features/crm/services/resolveContactReferences.js"),
    "utf8"
  );
  assert.match(resolver, /playerDirectory\.getById\(\s*scope\s*,\s*playerId\s*\)/);

  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".md")) {
        const text = readFileSync(full, "utf8");
        assert.equal(/compensating delete/i.test(text), false, full);
        assert.equal(/best-effort compensating/i.test(text), false, full);
      }
    }
  }
  walk(path.join(root, "docs/crm/phase-1c"));
});
