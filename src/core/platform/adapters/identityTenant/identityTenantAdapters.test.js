/**
 * Identity/Tenant adoption adapter certification tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  projectIdentityActor,
  projectSecurityContext,
  projectTenantScope,
  projectPermissionCode,
  projectAuthorizationRequest,
  projectAuthorizationDecision,
  IDENTITY_ACTOR_ADAPTER_ERROR,
  TENANT_SCOPE_ADAPTER_ERROR,
} from "./index.js";
import {
  isActorReference,
  isSecurityContext,
  isPlatformScope,
  isPermissionCode,
  isAuthorizationRequest,
  isAuthorizationDecision,
  createSubjectReference,
} from "../../index.js";

const ADAPTER_DIR = path.dirname(fileURLToPath(import.meta.url));

function readAdapterSources() {
  const files = fs
    .readdirSync(ADAPTER_DIR)
    .filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));
  return files.map((name) => ({
    name,
    source: fs.readFileSync(path.join(ADAPTER_DIR, name), "utf8"),
  }));
}

test("1. valid actor projection", () => {
  const result = projectIdentityActor({
    actorType: "USER",
    actorId: "user-123",
  });
  assert.equal(result.ok, true);
  assert.equal(isActorReference(result.value), true);
  assert.equal(result.value.actorType, "USER");
  assert.equal(result.value.actorId, "user-123");
  assert.equal(Object.isFrozen(result.value), true);
});

test("1b. valid actor projection from auth user id field", () => {
  const result = projectIdentityActor({
    actorType: "USER",
    id: "auth-user-9",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.actorId, "auth-user-9");
});

test("2. invalid actor projection", () => {
  assert.equal(projectIdentityActor(null).ok, false);
  assert.equal(projectIdentityActor({ actorId: "x" }).ok, false);
  assert.equal(
    projectIdentityActor({ actorType: "USER" }).error.code,
    IDENTITY_ACTOR_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectIdentityActor({ actorType: "  ", actorId: "x" }).error.code,
    IDENTITY_ACTOR_ADAPTER_ERROR.ACTOR_TYPE_REQUIRED
  );
});

test("3. security context with minimal input", () => {
  const result = projectSecurityContext({
    actor: { actorType: "USER", actorId: "u-1" },
  });
  assert.equal(result.ok, true);
  assert.equal(isSecurityContext(result.value), true);
  assert.equal(result.value.actor.actorId, "u-1");
  assert.equal("tenantId" in result.value, false);
  assert.equal("sessionId" in result.value, false);
  assert.equal("requestId" in result.value, false);
  assert.equal("correlationId" in result.value, false);
});

test("4. security context with all optional identifiers", () => {
  const result = projectSecurityContext({
    actor: { actorType: "USER", actorId: "u-2" },
    tenantId: "tenant-a",
    sessionId: "session-b",
    requestId: "request-c",
    correlationId: "corr-d",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantId, "tenant-a");
  assert.equal(result.value.sessionId, "session-b");
  assert.equal(result.value.requestId, "request-c");
  assert.equal(result.value.correlationId, "corr-d");
});

test("5. no auto-generated identifiers", () => {
  const before = Date.now();
  const result = projectSecurityContext({
    actor: { actorType: "USER", actorId: "fixed-id" },
  });
  const after = Date.now();
  assert.equal(result.ok, true);
  assert.equal(result.value.actor.actorId, "fixed-id");
  assert.equal("tenantId" in result.value, false);
  assert.equal("sessionId" in result.value, false);
  const serialized = JSON.stringify(result.value);
  assert.equal(serialized.includes(String(before)), false);
  assert.equal(serialized.includes(String(after)), false);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(serialized), false);
});

test("6. tenant scope without tenant/venue inference", () => {
  const minimal = projectTenantScope({ scopeType: "TENANT" });
  assert.equal(minimal.ok, true);
  assert.equal(isPlatformScope(minimal.value), true);
  assert.equal("tenantId" in minimal.value, false);
  assert.equal("scopeId" in minimal.value, false);

  const withVenueAliasInput = projectTenantScope({
    scopeType: "VENUE",
    scopeId: "venue-77",
    venueId: "venue-77",
  });
  assert.equal(withVenueAliasInput.ok, true);
  assert.equal(withVenueAliasInput.value.scopeId, "venue-77");
  assert.equal(
    "tenantId" in withVenueAliasInput.value,
    false,
    "venueId must not be inferred as tenantId"
  );

  assert.equal(
    projectTenantScope({ scopeId: "x" }).error.code,
    TENANT_SCOPE_ADAPTER_ERROR.SCOPE_TYPE_REQUIRED
  );
});

test("7. permission code case and separator preservation", () => {
  const dotted = projectPermissionCode("match.update");
  assert.equal(dotted.ok, true);
  assert.equal(isPermissionCode(dotted.value), true);
  assert.equal(dotted.value, "match.update");

  const mixed = projectPermissionCode("Match_Update");
  assert.equal(mixed.ok, true);
  assert.equal(mixed.value, "Match_Update");

  const wrapped = projectPermissionCode({ permission: "club.manage" });
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.value, "club.manage");
});

test("8. authorization request reference preservation", () => {
  const securityContext = projectSecurityContext({
    actor: { actorType: "USER", actorId: "u-req" },
    tenantId: "t-1",
  }).value;
  const scope = projectTenantScope({
    scopeType: "CLUB",
    scopeId: "club-1",
    tenantId: "t-1",
  }).value;
  const subject = createSubjectReference({
    subjectType: "MATCH",
    subjectId: "match-1",
  }).value;

  const result = projectAuthorizationRequest({
    securityContext,
    permissionCode: "match.update",
    scope,
    subject,
  });

  assert.equal(result.ok, true);
  assert.equal(isAuthorizationRequest(result.value), true);
  assert.equal(result.value.securityContext, securityContext);
  assert.equal(result.value.scope, scope);
  assert.equal(result.value.subject, subject);
  assert.equal(result.value.permissionCode, "match.update");
});

test("9. authorization decision projection for allow", () => {
  const fromAllowed = projectAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
  });
  assert.equal(fromAllowed.ok, true);
  assert.equal(isAuthorizationDecision(fromAllowed.value), true);
  assert.equal(fromAllowed.value.allowed, true);
  assert.equal(fromAllowed.value.decisionCode, "ALLOW");

  const fromAssertCan = projectAuthorizationDecision({ ok: true });
  assert.equal(fromAssertCan.ok, true);
  assert.equal(fromAssertCan.value.allowed, true);
  assert.equal(fromAssertCan.value.decisionCode, "ALLOW");
});

test("10. authorization decision projection for deny", () => {
  const fromAllowed = projectAuthorizationDecision({
    allowed: false,
    decisionCode: "FORBIDDEN",
    reason: "missing permission",
  });
  assert.equal(fromAllowed.ok, true);
  assert.equal(fromAllowed.value.allowed, false);
  assert.equal(fromAllowed.value.decisionCode, "FORBIDDEN");
  assert.equal(fromAllowed.value.reason, "missing permission");

  const fromAssertCan = projectAuthorizationDecision({
    ok: false,
    code: "FORBIDDEN",
    error: "Không có quyền",
  });
  assert.equal(fromAssertCan.ok, true);
  assert.equal(fromAssertCan.value.allowed, false);
  assert.equal(fromAssertCan.value.decisionCode, "FORBIDDEN");
  assert.equal(fromAssertCan.value.reason, "Không có quyền");
});

test("11. no evaluator invocation", () => {
  for (const { source } of readAdapterSources()) {
    assert.equal(/from\s+["'][^"']*\/rbac(?:\.js)?["']/.test(source), false);
    assert.equal(/from\s+["'][^"']*src\/auth["']/.test(source), false);
    assert.equal(/\brbac\.can\s*\(/.test(source), false);
    assert.equal(/\bassertCan\s*\(/.test(source), false);
    assert.equal(/\broleHasPermission\s*\(/.test(source), false);
    assert.equal(/\bcanAccessVenue\s*\(/.test(source), false);
    assert.equal(/\bcanAccessClub\s*\(/.test(source), false);
    assert.equal(/\bgetCurrentUser\s*\(/.test(source), false);
  }
});

test("12. no Supabase import", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(
      /from\s+["'][^"']*supabase[^"']*["']/i.test(source),
      false,
      name
    );
    assert.equal(/createClient\s*\(/.test(source), false, name);
    assert.equal(/@supabase\//.test(source), false, name);
  }
});

test("13. no localStorage access", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(/localStorage\./.test(source), false, name);
    assert.equal(/sessionStorage\./.test(source), false, name);
    assert.equal(/window\.localStorage/.test(source), false, name);
  }
});

test("14. no environment dependency", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
    assert.equal(/VITE_/.test(source), false, name);
  }
});

test("15. no Business Module import", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(/src\/features\//.test(source), false, name);
    assert.equal(/src\/auth\//.test(source), false, name);
    assert.equal(
      /from\s+["'][^"']*(?:finance|crm|competition-core|player-rating)/.test(
        source
      ),
      false,
      name
    );
  }
});

test("16. frozen Platform Core outputs", () => {
  const actor = projectIdentityActor({
    actorType: "USER",
    actorId: "freeze-1",
  }).value;
  const context = projectSecurityContext({ actor }).value;
  const scope = projectTenantScope({
    scopeType: "TENANT",
    tenantId: "t-freeze",
  }).value;
  const permission = projectPermissionCode("audit.read").value;
  const request = projectAuthorizationRequest({
    securityContext: context,
    permissionCode: permission,
    scope,
  }).value;
  const decision = projectAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
    scope,
  }).value;

  for (const value of [actor, context, scope, request, decision]) {
    assert.equal(Object.isFrozen(value), true);
  }
});

test("17. existing runtime input is not mutated", () => {
  const user = { actorType: "USER", id: "immutable-user", role: "STAFF" };
  const snapshot = JSON.stringify(user);
  const actorResult = projectIdentityActor(user);
  assert.equal(actorResult.ok, true);
  assert.equal(JSON.stringify(user), snapshot);

  const decisionInput = {
    ok: false,
    code: "FORBIDDEN",
    error: "denied",
    extra: { nested: true },
  };
  const decisionSnapshot = JSON.stringify(decisionInput);
  const decisionResult = projectAuthorizationDecision(decisionInput);
  assert.equal(decisionResult.ok, true);
  assert.equal(JSON.stringify(decisionInput), decisionSnapshot);
  assert.equal(decisionInput.extra.nested, true);
});
