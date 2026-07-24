/**
 * CRM Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CRM_PLATFORM_ADAPTER_ERROR,
  CRM_PERMISSIONS,
  projectCrmActor,
  projectCrmScope,
  projectCrmLeadSubject,
  projectCrmCustomerSubject,
  projectCrmPermission,
  projectCrmSecurityContext,
  projectCrmAuthorizationRequest,
  projectCrmAuthorizationDecision,
  projectCrmOperationIdentity,
  projectCrmEventEnvelope,
  projectCrmErrorDescriptor,
  projectCrmCapabilityDescriptor,
  authorizeCrm,
} from "../src/features/crm/index.js";
import {
  isOk,
  isFail,
  isActorReference,
  isPlatformScope,
  isSubjectReference,
  isPermissionCode,
  isSecurityContext,
  isAuthorizationRequest,
  isAuthorizationDecision,
  isOperationIdentity,
  isCommonEventEnvelope,
  isPlatformErrorDescriptor,
  isPlatformCapabilityDescriptor,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(ROOT, "src/features/crm/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("crm platform imports only canonical public entry", () => {
  for (const { name, source } of readPlatformSources()) {
    if (name === "index.js") continue;
    assert.match(
      source,
      /from\s+["']\.\.\/\.\.\/\.\.\/core\/platform\/index\.js["']/,
      name
    );
    assert.equal(/core\/platform\/contracts\//.test(source), false, name);
    assert.equal(/core\/platform\/adapters\//.test(source), false, name);
  }
});

test("crm actor, scope, and subjects require explicit identifiers", () => {
  assert.equal(
    projectCrmActor({}).error.code,
    CRM_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectCrmScope({ tenantId: "t1" }).error.code,
    CRM_PLATFORM_ADAPTER_ERROR.VENUE_ID_REQUIRED
  );
  assert.equal(
    projectCrmLeadSubject({}).error.code,
    CRM_PLATFORM_ADAPTER_ERROR.LEAD_ID_REQUIRED
  );
  assert.equal(
    projectCrmCustomerSubject({}).error.code,
    CRM_PLATFORM_ADAPTER_ERROR.CUSTOMER_ID_REQUIRED
  );

  const actor = projectCrmActor({ userId: "user-crm-1" });
  assert.equal(isOk(actor), true);
  assert.equal(isActorReference(actor.value), true);

  const scope = projectCrmScope({ tenantId: "tenant-crm-1", venueId: "venue-crm-1" });
  assert.equal(isOk(scope), true);
  assert.equal(isPlatformScope(scope.value), true);
  assert.equal(scope.value.scopeId, "venue-crm-1");
  assert.equal(scope.value.tenantId, "tenant-crm-1");

  const lead = projectCrmLeadSubject({ leadId: "lead-1" });
  assert.equal(isOk(lead), true);
  assert.equal(isSubjectReference(lead.value), true);
  assert.equal(lead.value.subjectType, "CRM_LEAD");

  const customer = projectCrmCustomerSubject({ customerId: "cust-1" });
  assert.equal(isOk(customer), true);
  assert.equal(customer.value.subjectType, "CRM_CUSTOMER");
});

test("crm permission and security context do not mutate input or evaluate auth", () => {
  const permissionInput = Object.freeze({ permission: CRM_PERMISSIONS.LEAD_VIEW });
  const permission = projectCrmPermission(permissionInput);
  assert.equal(isOk(permission), true);
  assert.equal(isPermissionCode(permission.value), true);
  assert.deepEqual(permissionInput, { permission: CRM_PERMISSIONS.LEAD_VIEW });

  const ctxInput = Object.freeze({
    userId: "user-crm-2",
    tenantId: "tenant-crm-2",
  });
  const ctx = projectCrmSecurityContext(ctxInput);
  assert.equal(isOk(ctx), true);
  assert.equal(isSecurityContext(ctx.value), true);
  assert.deepEqual(ctxInput, { userId: "user-crm-2", tenantId: "tenant-crm-2" });

  for (const { name, source } of readPlatformSources()) {
    assert.equal(/authorizeCrm|requireCrmActor|isCrmPermission/.test(source), false, name);
  }
});

test("crm authorization request and decision preserve resolved outcomes", () => {
  const securityContext = projectCrmSecurityContext({
    userId: "user-crm-3",
    tenantId: "tenant-crm-3",
  }).value;
  const scope = projectCrmScope({
    tenantId: "tenant-crm-3",
    venueId: "venue-crm-3",
  }).value;
  const subject = projectCrmLeadSubject({ leadId: "lead-3" }).value;

  const request = projectCrmAuthorizationRequest({
    securityContext,
    permissionCode: CRM_PERMISSIONS.LEAD_UPDATE,
    scope,
    subject,
  });
  assert.equal(isOk(request), true);
  assert.equal(isAuthorizationRequest(request.value), true);

  const allow = projectCrmAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(isOk(allow), true);
  assert.equal(isAuthorizationDecision(allow.value), true);
  assert.equal(allow.value.allowed, true);

  const deny = projectCrmAuthorizationDecision({
    allowed: false,
    decisionCode: "FORBIDDEN",
    reason: "missing crm.lead.update",
  });
  assert.equal(isOk(deny), true);
  assert.equal(deny.value.allowed, false);
});

test("crm operation, event, error, and capability projections", () => {
  const opInput = Object.freeze({ operationId: "crm.lead.create:req-1" });
  const op = projectCrmOperationIdentity(opInput);
  assert.equal(isOk(op), true);
  assert.equal(isOperationIdentity(op.value), true);
  assert.deepEqual(opInput, { operationId: "crm.lead.create:req-1" });

  const envelope = projectCrmEventEnvelope({
    eventId: "evt-crm-1",
    eventType: "crm.lead.created",
    occurredAt: "2026-07-24T02:00:00.000Z",
    sourceModule: "CRM",
    payloadVersion: "1",
    actor: { actorType: "USER", actorId: "user-crm-evt" },
    payload: Object.freeze({ leadId: "lead-evt" }),
    tenantId: "tenant-crm-evt",
  });
  assert.equal(isOk(envelope), true);
  assert.equal(isCommonEventEnvelope(envelope.value), true);

  const error = projectCrmErrorDescriptor({
    code: "CRM_FORBIDDEN_PERMISSION",
    message: "Missing CRM permission",
    retryable: false,
  });
  assert.equal(isOk(error), true);
  assert.equal(isPlatformErrorDescriptor(error.value), true);

  const capability = projectCrmCapabilityDescriptor({
    capabilityCode: "CRM_PUBLIC_FACADE",
    ownerModule: "CRM",
    version: "1.0.0",
    status: "ADAPTER_AVAILABLE",
  });
  assert.equal(isOk(capability), true);
  assert.equal(isPlatformCapabilityDescriptor(capability.value), true);
});

test("crm platform adapters generate no identifiers and avoid pipeline/business mutation", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/Math\.random\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
    assert.equal(
      /createLead|isAllowedStageTransition|inferStageCategory|detectDuplicate|assignLead/.test(
        source
      ),
      false,
      name
    );
  }
});

test("crm public exports remain compatible and module auth is unchanged", () => {
  const barrel = fs.readFileSync(
    path.join(ROOT, "src/features/crm/index.js"),
    "utf8"
  );
  assert.match(barrel, /projectCrmActor/);
  assert.match(barrel, /from\s+["']\.\/platform\/index\.js["']/);
  assert.equal(typeof projectCrmActor, "function");
  assert.equal(typeof authorizeCrm, "function");
  assert.equal(isFail(projectCrmActor(null)), true);

  const denied = authorizeCrm(
    { userId: "u1", tenantId: "t1", permissions: [], authenticated: true },
    CRM_PERMISSIONS.LEAD_CREATE,
    { tenantId: "t1", venueId: "v1" }
  );
  assert.equal(denied.ok, false);
});
