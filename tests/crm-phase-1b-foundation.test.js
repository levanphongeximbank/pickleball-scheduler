import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FEATURE_STATUS } from "../src/config/v5Menu/menuBuilders.js";
import { CRM_MENU_ROOT } from "../src/config/v5Menu/crmMenu.js";
import { ROUTE_PERMISSIONS } from "../src/config/navigationConfig.js";
import { PERMISSIONS } from "../src/auth/permissions.js";

import * as crm from "../src/features/crm/index.js";
import {
  clearCrmCampaigns,
  clearCrmContactHistory,
  clearCrmMessages,
  clearCrmTemplates,
  createCampaign,
  createMessage,
  createTemplate,
  addContactHistory,
  listCampaigns,
  listContactHistory,
  listMessages,
  listTemplates,
} from "../src/features/crm/adapters/legacyLocalStorageCompat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SCOPE_A = Object.freeze({ tenantId: "tenant-a", venueId: "venue-a" });
const SCOPE_B = Object.freeze({ tenantId: "tenant-b", venueId: "venue-b" });

function mockLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
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

test("Phase 1B — public facade exports foundation API", () => {
  assert.equal(typeof crm.createLead, "function");
  assert.equal(typeof crm.createContactReference, "function");
  assert.equal(typeof crm.createOpportunity, "function");
  assert.equal(typeof crm.createInteraction, "function");
  assert.equal(typeof crm.createCrmTask, "function");
  assert.equal(typeof crm.authorizeCrm, "function");
  assert.equal(typeof crm.createMemoryLeadRepository, "function");
  assert.equal(typeof crm.validateCrmIntegrationEvent, "function");
  assert.ok(crm.CRM_PERMISSIONS.LEAD_CREATE.startsWith("crm."));
  assert.ok(crm.CRM_ERROR_CODES.MISSING_SCOPE);
  assert.ok(crm.LEGACY_CRM_COMPAT_CLASSIFICATION.crmMessageService);
  assert.equal(crm.LEGACY_CRM_COMPAT_CLASSIFICATION.crmMessageService, "COMPATIBILITY_ONLY");
});

test("Phase 1B — mandatory tenantId and venueId", () => {
  assert.throws(
    () => crm.createLead({ leadId: "l1", status: crm.LEAD_STATUS.NEW }),
    (err) => err.code === crm.CRM_ERROR_CODES.MISSING_SCOPE
  );
  assert.throws(
    () => crm.createTenantVenueScope({ tenantId: "t1" }),
    (err) => err.code === crm.CRM_ERROR_CODES.MISSING_SCOPE
  );
  assert.throws(
    () => crm.createTenantVenueScope({ venueId: "v1" }),
    (err) => err.code === crm.CRM_ERROR_CODES.MISSING_SCOPE
  );
  const scope = crm.createTenantVenueScope(SCOPE_A);
  assert.deepEqual(scope, SCOPE_A);
});

test("Phase 1B — invalid scope rejection", () => {
  const result = crm.requireCrmScope({});
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.MISSING_SCOPE);
});

test("Phase 1B — cross-tenant and cross-venue isolation in memory repos", () => {
  const leads = crm.createMemoryLeadRepository();
  leads.save(SCOPE_A, {
    leadId: "lead-1",
    status: crm.LEAD_STATUS.NEW,
    source: crm.LEAD_SOURCE.WEB,
  });

  assert.equal(leads.getById(SCOPE_B, "lead-1"), null);
  assert.equal(leads.list(SCOPE_B).length, 0);
  assert.equal(leads.list(SCOPE_A).length, 1);

  const otherVenue = { tenantId: SCOPE_A.tenantId, venueId: "venue-other" };
  assert.equal(leads.getById(otherVenue, "lead-1"), null);
});

test("Phase 1B — missing actor rejection", () => {
  const result = crm.authorizeCrm(null, crm.CRM_PERMISSIONS.LEAD_VIEW, SCOPE_A);
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.MISSING_ACTOR);
});

test("Phase 1B — missing permission rejection", () => {
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_VIEW]);
  const result = crm.authorizeCrm(actor, crm.CRM_PERMISSIONS.LEAD_CREATE, SCOPE_A);
  assert.equal(result.ok, false);
  assert.equal(result.code, crm.CRM_ERROR_CODES.FORBIDDEN_PERMISSION);
});

test("Phase 1B — CRM permission namespace", () => {
  for (const value of Object.values(crm.CRM_PERMISSIONS)) {
    assert.ok(value.startsWith("crm."), value);
    assert.ok(crm.isCrmPermission(value));
  }
  assert.equal(crm.isCrmPermission(PERMISSIONS.CUSTOMER_VIEW), false);
  assert.equal(crm.isCrmPermission("customer.view"), false);
});

test("Phase 1B — lead status / interaction type / task status validation", () => {
  assert.throws(
    () =>
      crm.createLead({
        ...SCOPE_A,
        leadId: "l2",
        status: "not-a-status",
      }),
    (err) => err.code === crm.CRM_ERROR_CODES.INVALID_STATUS
  );
  assert.ok(crm.isLeadStatus(crm.LEAD_STATUS.QUALIFIED));

  assert.throws(
    () =>
      crm.createInteraction({
        ...SCOPE_A,
        interactionId: "i1",
        type: "fax",
      }),
    (err) => err.code === crm.CRM_ERROR_CODES.INVALID_STATUS
  );
  assert.ok(crm.isInteractionType(crm.INTERACTION_TYPE.NOTE));

  assert.throws(
    () =>
      crm.createCrmTask({
        ...SCOPE_A,
        taskId: "t1",
        status: "waiting",
      }),
    (err) => err.code === crm.CRM_ERROR_CODES.INVALID_STATUS
  );
  assert.ok(crm.isCrmTaskStatus(crm.CRM_TASK_STATUS.OPEN));
});

test("Phase 1B — repository instance isolation", () => {
  const a = crm.createMemoryLeadRepository();
  const b = crm.createMemoryLeadRepository();
  a.save(SCOPE_A, { leadId: "only-a", status: crm.LEAD_STATUS.NEW, source: crm.LEAD_SOURCE.OTHER });
  assert.equal(a.list(SCOPE_A).length, 1);
  assert.equal(b.list(SCOPE_A).length, 0);
});

test("Phase 1B — ContactReference external-ID behavior", () => {
  const ref = crm.createContactReference({
    ...SCOPE_A,
    contactRefId: "cref-1",
    customerId: "cust-9",
    playerId: "player-9",
    authUserId: "auth-9",
    displaySnapshot: { displayName: "An", phone: "090", capturedAt: "2026-07-21T00:00:00.000Z" },
  });
  assert.equal(ref.customerId, "cust-9");
  assert.equal(ref.playerId, "player-9");
  assert.equal(ref.authUserId, "auth-9");
  assert.equal(ref.displaySnapshot.authoritative, false);

  const bare = crm.createContactReference({
    ...SCOPE_A,
    contactRefId: "cref-2",
  });
  assert.equal(bare.customerId, null);
  assert.equal(bare.playerId, null);
  assert.equal(bare.authUserId, null);
});

test("Phase 1B — event envelope validation", () => {
  const bad = crm.validateCrmAuditEvent({ eventType: crm.CRM_AUDIT_EVENT_TYPE.LEAD_CREATED });
  assert.equal(bad.ok, false);

  const ok = crm.validateCrmAuditEvent({
    eventId: "evt-1",
    eventType: crm.CRM_AUDIT_EVENT_TYPE.LEAD_CREATED,
    tenantId: SCOPE_A.tenantId,
    venueId: SCOPE_A.venueId,
    occurredAt: "2026-07-21T12:00:00.000Z",
    actorUserId: "user-1",
  });
  assert.equal(ok.ok, true);

  const integrationMissingKey = crm.validateCrmIntegrationEvent({
    eventId: "evt-2",
    eventType: crm.CRM_INTEGRATION_EVENT_TYPE.LEAD_CREATED,
    tenantId: SCOPE_A.tenantId,
    venueId: SCOPE_A.venueId,
    occurredAt: "2026-07-21T12:00:00.000Z",
  });
  assert.equal(integrationMissingKey.ok, false);

  const integrationOk = crm.validateCrmIntegrationEvent({
    eventId: "evt-3",
    eventType: crm.CRM_INTEGRATION_EVENT_TYPE.CAMPAIGN_LAUNCH_REQUESTED,
    tenantId: SCOPE_A.tenantId,
    venueId: SCOPE_A.venueId,
    occurredAt: "2026-07-21T12:00:00.000Z",
    idempotencyKey: "idem-1",
  });
  assert.equal(integrationOk.ok, true);
});

test("Phase 1B — authorize success path + prepareLeadDraft", () => {
  const actor = actorWith([crm.CRM_PERMISSIONS.LEAD_CREATE]);
  const auth = crm.authorizeCrm(actor, crm.CRM_PERMISSIONS.LEAD_CREATE, SCOPE_A);
  assert.equal(auth.ok, true);

  const draft = crm.prepareLeadDraft(actor, {
    ...SCOPE_A,
    leadId: "draft-1",
    status: crm.LEAD_STATUS.NEW,
    source: crm.LEAD_SOURCE.REFERRAL,
    title: "Gói tháng",
  });
  assert.equal(draft.ok, true);
  assert.equal(draft.lead.leadId, "draft-1");
});

test("Phase 1B — no demo-club fallback in new CRM foundation sources", () => {
  const files = [
    "src/features/crm/models/scope.js",
    "src/features/crm/authorization/crmAuthorize.js",
    "src/features/crm/authorization/scopeGuards.js",
    "src/features/crm/repositories/memory/scopedMemoryStore.js",
    "src/features/crm/services/prepareLeadDraft.js",
    "src/features/crm/index.js",
  ];
  const fallbackPattern = /\|\|\s*["']demo-club["']|activeClubId\s*\|\|\s*["']demo-club["']/;
  for (const rel of files) {
    const text = readFileSync(path.join(root, rel), "utf8");
    assert.equal(fallbackPattern.test(text), false, rel);
  }
});

test("Phase 1B — existing CRM localStorage compatibility remains intact", () => {
  globalThis.localStorage = mockLocalStorage();
  const club = "compat-club";
  clearCrmMessages(club);
  clearCrmTemplates(club);
  clearCrmCampaigns(club);
  clearCrmContactHistory(club);

  createMessage(club, { recipientName: "An", body: "hi", sendNow: true });
  createTemplate(club, { name: "Chào", body: "Xin chào" });
  createCampaign(club, { name: "Promo", targetGroup: "members" });
  addContactHistory(club, { customerName: "An", summary: "Gọi điện" });

  assert.equal(listMessages(club).length, 1);
  assert.equal(listTemplates(club).length, 1);
  assert.equal(listCampaigns(club).length, 1);
  assert.equal(listContactHistory(club).length, 1);

  clearCrmMessages(club);
  clearCrmTemplates(club);
  clearCrmCampaigns(club);
  clearCrmContactHistory(club);
});

test("Phase 1B — CRM routes remain available and menu PARTIAL for CRM paths", () => {
  const router = readFileSync(path.join(root, "src/router.jsx"), "utf8");
  for (const route of [
    "/crm/messages",
    "/crm/templates",
    "/crm/campaigns",
    "/crm/history",
    "/crm/reminders/booking",
  ]) {
    assert.ok(router.includes(`path="${route}"`), route);
  }

  const crmPathItems = CRM_MENU_ROOT.children.filter((item) =>
    String(item.path || "").startsWith("/crm/")
  );
  assert.ok(crmPathItems.length >= 5);
  for (const item of crmPathItems) {
    assert.equal(item.featureStatus, FEATURE_STATUS.PARTIAL, item.key);
    assert.ok(item.path.startsWith("/crm/"));
  }

  const notifications = CRM_MENU_ROOT.children.find((item) => item.key === "crm-notifications");
  assert.ok(notifications);
  assert.equal(notifications.featureStatus, FEATURE_STATUS.LIVE);
  assert.equal(notifications.path, "/mobile/notifications");

  assert.deepEqual(ROUTE_PERMISSIONS["/crm/templates"], [PERMISSIONS.CUSTOMER_VIEW]);
  assert.deepEqual(ROUTE_PERMISSIONS["/crm/messages"], [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
  ]);
});
