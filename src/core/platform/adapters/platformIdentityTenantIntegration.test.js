/**
 * Cross-boundary Identity/Tenant ↔ Platform Core integration certification.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as publicSurface from "../index.js";
import * as adapters from "./index.js";
import { PLATFORM_CAPABILITY_MANIFEST } from "../capabilities.js";

const PLATFORM_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const ADAPTERS_DIR = path.dirname(fileURLToPath(import.meta.url));

const ADAPTER_EXPORT_NAMES = Object.freeze([
  "projectIdentityActor",
  "IDENTITY_ACTOR_ADAPTER_ERROR",
  "projectSecurityContext",
  "SECURITY_CONTEXT_ADAPTER_ERROR",
  "projectTenantScope",
  "TENANT_SCOPE_ADAPTER_ERROR",
  "projectPermissionCode",
  "PERMISSION_CODE_ADAPTER_ERROR",
  "projectAuthorizationRequest",
  "AUTHORIZATION_REQUEST_ADAPTER_ERROR",
  "projectAuthorizationDecision",
  "AUTHORIZATION_DECISION_ADAPTER_ERROR",
]);

const ADAPTER_CAPABILITY_CODES = Object.freeze([
  "IDENTITY_ACTOR_ADAPTER",
  "SECURITY_CONTEXT_ADAPTER",
  "TENANT_SCOPE_ADAPTER",
  "PERMISSION_CODE_ADAPTER",
  "AUTHORIZATION_REQUEST_ADAPTER",
  "AUTHORIZATION_DECISION_ADAPTER",
]);

test("19. public adapter exports are available on Platform Core surface", () => {
  for (const name of ADAPTER_EXPORT_NAMES) {
    assert.equal(name in publicSurface, true, `missing public export ${name}`);
    assert.equal(publicSurface[name], adapters[name]);
  }
});

test("18. capability manifest uniqueness includes adapters", () => {
  const codes = PLATFORM_CAPABILITY_MANIFEST.map((item) => item.capabilityCode);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of ADAPTER_CAPABILITY_CODES) {
    assert.equal(codes.includes(code), true, `missing ${code}`);
  }
});

test("20. legacy Platform Core scaffold compatibility", () => {
  for (const name of [
    "createTenantRecord",
    "createUserRecord",
    "assertTenantAccess",
    "canPerformAction",
    "getPermissionMatrix",
    "getRlsPolicyMatrix",
    "createAuditEvent",
    "createNotification",
    "createSubscription",
    "createSetting",
    "getCorePlatformSeed",
  ]) {
    assert.equal(typeof publicSurface[name], "function", name);
  }

  const seed = publicSurface.getCorePlatformSeed();
  assert.ok(Array.isArray(seed.roles));
  assert.ok(Array.isArray(seed.permissions));
});

test("cross-boundary flow: identity → security → request → decision", () => {
  const actor = publicSurface.projectIdentityActor({
    actorType: "USER",
    id: "integration-user-1",
  });
  assert.equal(actor.ok, true);

  const securityContext = publicSurface.projectSecurityContext({
    actor: actor.value,
    tenantId: "tenant-integration",
    requestId: "req-integration",
  });
  assert.equal(securityContext.ok, true);

  const scope = publicSurface.projectTenantScope({
    scopeType: "TENANT",
    tenantId: "tenant-integration",
  });
  assert.equal(scope.ok, true);

  const permission = publicSurface.projectPermissionCode("tournament.manage");
  assert.equal(permission.ok, true);

  const request = publicSurface.projectAuthorizationRequest({
    securityContext: securityContext.value,
    permissionCode: permission.value,
    scope: scope.value,
  });
  assert.equal(request.ok, true);
  assert.equal(request.value.securityContext, securityContext.value);
  assert.equal(request.value.scope, scope.value);

  const allow = publicSurface.projectAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
    scope: scope.value,
  });
  assert.equal(allow.ok, true);
  assert.equal(allow.value.allowed, true);

  const deny = publicSurface.projectAuthorizationDecision({
    ok: false,
    code: "FORBIDDEN",
    error: "not permitted",
    scope: scope.value,
  });
  assert.equal(deny.ok, true);
  assert.equal(deny.value.allowed, false);
  assert.equal(deny.value.decisionCode, "FORBIDDEN");
});

test("adapters do not introduce circular dependency with contracts", () => {
  const contractsIndex = fs.readFileSync(
    path.join(PLATFORM_DIR, "contracts", "index.js"),
    "utf8"
  );
  assert.equal(
    /from\s+["'][^"']*adapters[^"']*["']/.test(contractsIndex),
    false
  );

  const capabilitiesSource = fs.readFileSync(
    path.join(PLATFORM_DIR, "capabilities.js"),
    "utf8"
  );
  assert.equal(
    /from\s+["'][^"']*adapters[^"']*["']/.test(capabilitiesSource),
    false
  );

  const adapterIndex = fs.readFileSync(
    path.join(ADAPTERS_DIR, "index.js"),
    "utf8"
  );
  assert.equal(
    /from\s+["']\.\.\/index\.js["']/.test(adapterIndex),
    false,
    "adapters barrel must not import public platform index"
  );
});

test("adapter tree has no Date.now / randomUUID ID generation", () => {
  function walk(dir) {
    /** @type {string[]} */
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...walk(full));
      } else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) {
        out.push(full);
      }
    }
    return out;
  }

  for (const filePath of walk(ADAPTERS_DIR)) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.equal(/Date\.now\s*\(/.test(source), false, filePath);
    assert.equal(/randomUUID\s*\(/.test(source), false, filePath);
    assert.equal(/Math\.random\s*\(/.test(source), false, filePath);
  }
});
