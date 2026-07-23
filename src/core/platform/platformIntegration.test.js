/**
 * Platform Core Phase 2A — canonical public integration surface certification.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as publicSurface from "./index.js";
import * as contractLocal from "./contracts/index.js";
import { PLATFORM_CAPABILITY_MANIFEST } from "./capabilities.js";

const PLATFORM_DIR = path.dirname(fileURLToPath(import.meta.url));

const CONTRACT_EXPORT_NAMES = Object.freeze([
  "ok",
  "fail",
  "isOk",
  "isFail",
  "normalizeOpaqueId",
  "isOpaqueId",
  "OPAQUE_ID_ERROR",
  "nowIso",
  "parseIsoStrict",
  "ISO_INSTANT_ERROR",
  "createActorReference",
  "isActorReference",
  "ACTOR_REFERENCE_ERROR",
  "createSubjectReference",
  "isSubjectReference",
  "SUBJECT_REFERENCE_ERROR",
  "createSecurityContext",
  "isSecurityContext",
  "SECURITY_CONTEXT_ERROR",
  "createTraceContext",
  "isTraceContext",
  "TRACE_CONTEXT_ERROR",
  "createCommonEventEnvelope",
  "isCommonEventEnvelope",
  "COMMON_EVENT_ERROR",
  "createPlatformScope",
  "isPlatformScope",
  "PLATFORM_SCOPE_ERROR",
  "createAuthorizationDecision",
  "isAuthorizationDecision",
  "AUTHORIZATION_DECISION_ERROR",
  "createRoleCode",
  "isRoleCode",
  "ROLE_CODE_ERROR",
  "createPermissionCode",
  "isPermissionCode",
  "PERMISSION_CODE_ERROR",
  "createAuthorizationRequest",
  "isAuthorizationRequest",
  "AUTHORIZATION_REQUEST_ERROR",
  "createIdempotencyKey",
  "isIdempotencyKey",
  "IDEMPOTENCY_KEY_ERROR",
  "createOperationIdentity",
  "isOperationIdentity",
  "OPERATION_IDENTITY_ERROR",
  "createContractVersion",
  "isContractVersion",
  "CONTRACT_VERSION_ERROR",
  "createCompatibilityDecision",
  "isCompatibilityDecision",
  "COMPATIBILITY_DECISION_ERROR",
  "createPlatformErrorDescriptor",
  "isPlatformErrorDescriptor",
  "PLATFORM_ERROR_DESCRIPTOR_ERROR",
  "createIntegrationPortDescriptor",
  "isIntegrationPortDescriptor",
  "INTEGRATION_PORT_DESCRIPTOR_ERROR",
  "createPlatformCapabilityDescriptor",
  "isPlatformCapabilityDescriptor",
  "PLATFORM_CAPABILITY_DESCRIPTOR_ERROR",
]);

const LEGACY_SCAFFOLD_EXPORTS = Object.freeze([
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
]);

test("public integration entry point import succeeds", () => {
  assert.equal(typeof publicSurface, "object");
  assert.notEqual(publicSurface, null);
});

test("all Phase 1 contract APIs are exported from the public surface", () => {
  for (const name of CONTRACT_EXPORT_NAMES) {
    assert.equal(
      name in publicSurface,
      true,
      `public surface must export ${name}`
    );
    assert.notEqual(
      publicSurface[name],
      undefined,
      `public surface export ${name} must be defined`
    );
  }
});

test("public contract exports are the same references as contract-local exports", () => {
  for (const name of CONTRACT_EXPORT_NAMES) {
    assert.equal(
      publicSurface[name],
      contractLocal[name],
      `${name} must be the same reference as contracts/index.js`
    );
  }
});

test("public surface does not duplicate contract implementations", () => {
  const indexSource = fs.readFileSync(
    path.join(PLATFORM_DIR, "index.js"),
    "utf8"
  );
  assert.equal(
    /function\s+createActorReference\s*\(/.test(indexSource),
    false,
    "root index must not redefine createActorReference"
  );
  assert.equal(
    /function\s+ok\s*\(/.test(indexSource),
    false,
    "root index must not redefine ok"
  );
  assert.match(indexSource, /from\s+["']\.\/contracts\/index\.js["']/);
});

test("capability manifest is exported from the public surface", () => {
  assert.equal(
    publicSurface.PLATFORM_CAPABILITY_MANIFEST,
    PLATFORM_CAPABILITY_MANIFEST
  );
  assert.equal(Object.isFrozen(publicSurface.PLATFORM_CAPABILITY_MANIFEST), true);
  assert.ok(publicSurface.PLATFORM_CAPABILITY_MANIFEST.length >= 1);
});

test("legacy scaffold exports remain for backward compatibility", () => {
  for (const name of LEGACY_SCAFFOLD_EXPORTS) {
    assert.equal(
      typeof publicSurface[name],
      "function",
      `legacy scaffold export ${name} must remain`
    );
  }
});

test("integration surface modules have no Business Module imports", () => {
  const files = [
    "index.js",
    "capabilities.js",
    "contracts/index.js",
  ].map((rel) => path.join(PLATFORM_DIR, rel));

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.equal(
      /from\s+["'][^"']*src\/features\//.test(source),
      false,
      `${path.basename(filePath)} must not import src/features`
    );
    assert.equal(
      /from\s+["'][^"']*src\/auth\//.test(source),
      false,
      `${path.basename(filePath)} must not import src/auth`
    );
  }
});

test("integration surface has no Supabase, database, or network dependencies", () => {
  const files = ["index.js", "capabilities.js"].map((rel) =>
    path.join(PLATFORM_DIR, rel)
  );

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    assert.equal(/supabase/i.test(source), false, `${filePath} supabase`);
    assert.equal(/createClient/.test(source), false, `${filePath} createClient`);
    assert.equal(/fetch\s*\(/.test(source), false, `${filePath} fetch`);
    assert.equal(/localStorage/.test(source), false, `${filePath} localStorage`);
    assert.equal(/process\.env/.test(source), false, `${filePath} process.env`);
  }
});

test("integration surface does not create a mutable global registry", () => {
  const capabilitiesSource = fs.readFileSync(
    path.join(PLATFORM_DIR, "capabilities.js"),
    "utf8"
  );
  assert.equal(/globalThis/.test(capabilitiesSource), false);
  assert.equal(/registerCapability/.test(capabilitiesSource), false);
  assert.equal(/MutableRegistry/.test(capabilitiesSource), false);

  const snapshot = [...PLATFORM_CAPABILITY_MANIFEST];
  assert.equal(PLATFORM_CAPABILITY_MANIFEST.length, snapshot.length);
  assert.throws(() => {
    /** @type {any} */ (PLATFORM_CAPABILITY_MANIFEST).length = 0;
  }, TypeError);
});

test("no circular dependency between public surface, capabilities, and contracts", async () => {
  const contractsIndex = fs.readFileSync(
    path.join(PLATFORM_DIR, "contracts", "index.js"),
    "utf8"
  );
  assert.equal(
    /from\s+["']\.\.\/(?:index|capabilities)\.js["']/.test(contractsIndex),
    false,
    "contracts must not import public surface or capabilities"
  );

  const capabilitiesSource = fs.readFileSync(
    path.join(PLATFORM_DIR, "capabilities.js"),
    "utf8"
  );
  assert.equal(
    /from\s+["']\.\/index\.js["']/.test(capabilitiesSource),
    false,
    "capabilities must not import public surface"
  );

  // Live import graph already resolved at module load; re-import confirms stability.
  const again = await import("./index.js");
  assert.equal(again.createActorReference, publicSurface.createActorReference);
  assert.equal(again.PLATFORM_CAPABILITY_MANIFEST, PLATFORM_CAPABILITY_MANIFEST);
});
