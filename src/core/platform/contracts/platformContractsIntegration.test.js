/**
 * Platform Core Phase 1 — contract-local barrel integration certification.
 *
 * Imports exclusively from ./index.js (canonical Phase 1 export).
 * Does not import implementation files directly.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ok,
  fail,
  isOk,
  isFail,
  normalizeOpaqueId,
  isOpaqueId,
  nowIso,
  parseIsoStrict,
  createActorReference,
  isActorReference,
  createSubjectReference,
  isSubjectReference,
  createSecurityContext,
  isSecurityContext,
  createTraceContext,
  isTraceContext,
  createCommonEventEnvelope,
  isCommonEventEnvelope,
  createPlatformScope,
  isPlatformScope,
  createAuthorizationDecision,
  isAuthorizationDecision,
  createRoleCode,
  isRoleCode,
  createPermissionCode,
  isPermissionCode,
  createAuthorizationRequest,
  isAuthorizationRequest,
  createIdempotencyKey,
  isIdempotencyKey,
  createOperationIdentity,
  isOperationIdentity,
  createContractVersion,
  isContractVersion,
  createCompatibilityDecision,
  isCompatibilityDecision,
  createPlatformErrorDescriptor,
  isPlatformErrorDescriptor,
  createIntegrationPortDescriptor,
  isIntegrationPortDescriptor,
  createPlatformCapabilityDescriptor,
  isPlatformCapabilityDescriptor,
} from "./index.js";

const CONSTRUCTOR_APIS = Object.freeze([
  ["ok", ok],
  ["fail", fail],
  ["normalizeOpaqueId", normalizeOpaqueId],
  ["nowIso", nowIso],
  ["parseIsoStrict", parseIsoStrict],
  ["createActorReference", createActorReference],
  ["createSubjectReference", createSubjectReference],
  ["createSecurityContext", createSecurityContext],
  ["createTraceContext", createTraceContext],
  ["createCommonEventEnvelope", createCommonEventEnvelope],
  ["createPlatformScope", createPlatformScope],
  ["createAuthorizationDecision", createAuthorizationDecision],
  ["createRoleCode", createRoleCode],
  ["createPermissionCode", createPermissionCode],
  ["createAuthorizationRequest", createAuthorizationRequest],
  ["createIdempotencyKey", createIdempotencyKey],
  ["createOperationIdentity", createOperationIdentity],
  ["createContractVersion", createContractVersion],
  ["createCompatibilityDecision", createCompatibilityDecision],
  ["createPlatformErrorDescriptor", createPlatformErrorDescriptor],
  ["createIntegrationPortDescriptor", createIntegrationPortDescriptor],
  ["createPlatformCapabilityDescriptor", createPlatformCapabilityDescriptor],
]);

const PREDICATE_APIS = Object.freeze([
  ["isOk", isOk],
  ["isFail", isFail],
  ["isOpaqueId", isOpaqueId],
  ["isActorReference", isActorReference],
  ["isSubjectReference", isSubjectReference],
  ["isSecurityContext", isSecurityContext],
  ["isTraceContext", isTraceContext],
  ["isCommonEventEnvelope", isCommonEventEnvelope],
  ["isPlatformScope", isPlatformScope],
  ["isAuthorizationDecision", isAuthorizationDecision],
  ["isRoleCode", isRoleCode],
  ["isPermissionCode", isPermissionCode],
  ["isAuthorizationRequest", isAuthorizationRequest],
  ["isIdempotencyKey", isIdempotencyKey],
  ["isOperationIdentity", isOperationIdentity],
  ["isContractVersion", isContractVersion],
  ["isCompatibilityDecision", isCompatibilityDecision],
  ["isPlatformErrorDescriptor", isPlatformErrorDescriptor],
  ["isIntegrationPortDescriptor", isIntegrationPortDescriptor],
  ["isPlatformCapabilityDescriptor", isPlatformCapabilityDescriptor],
]);

const CONTRACT_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * @returns {string[]}
 */
function listContractImplementationSources() {
  return fs
    .readdirSync(CONTRACT_DIR)
    .filter(
      (name) =>
        name.endsWith(".js") &&
        !name.endsWith(".test.js") &&
        name !== "index.js"
    )
    .map((name) => path.join(CONTRACT_DIR, name));
}

test("canonical barrel import succeeds and exposes required APIs as functions", () => {
  for (const [name, api] of CONSTRUCTOR_APIS) {
    assert.equal(typeof api, "function", `${name} must be a function`);
  }
  for (const [name, api] of PREDICATE_APIS) {
    assert.equal(typeof api, "function", `${name} must be a function`);
  }
});

test("cross-capability authorization chain via barrel exports", () => {
  const actorResult = createActorReference({
    actorType: "USER",
    actorId: "actor-integration-1",
  });
  assert.equal(actorResult.ok, true);
  assert.equal(isActorReference(actorResult.value), true);
  assert.equal(Object.isFrozen(actorResult.value), true);

  const securityResult = createSecurityContext({
    actor: actorResult.value,
    tenantId: "tenant-integration-1",
  });
  assert.equal(securityResult.ok, true);
  assert.equal(isSecurityContext(securityResult.value), true);
  assert.equal(Object.isFrozen(securityResult.value), true);

  const permissionResult = createPermissionCode("match.read");
  assert.equal(permissionResult.ok, true);
  assert.equal(isPermissionCode(permissionResult.value), true);

  const scopeResult = createPlatformScope({
    scopeType: "VENUE",
    scopeId: "venue-integration-1",
    tenantId: "tenant-integration-1",
  });
  assert.equal(scopeResult.ok, true);
  assert.equal(isPlatformScope(scopeResult.value), true);
  assert.equal(Object.isFrozen(scopeResult.value), true);

  const subjectResult = createSubjectReference({
    subjectType: "MATCH",
    subjectId: "match-integration-1",
  });
  assert.equal(subjectResult.ok, true);
  assert.equal(isSubjectReference(subjectResult.value), true);
  assert.equal(Object.isFrozen(subjectResult.value), true);

  const requestResult = createAuthorizationRequest({
    securityContext: securityResult.value,
    permissionCode: permissionResult.value,
    scope: scopeResult.value,
    subject: subjectResult.value,
  });
  assert.equal(requestResult.ok, true);
  assert.equal(isAuthorizationRequest(requestResult.value), true);
  assert.equal(Object.isFrozen(requestResult.value), true);

  const decisionResult = createAuthorizationDecision({
    allowed: true,
    decisionCode: "ALLOW",
    reason: "caller-provided decision",
    scope: scopeResult.value,
  });
  assert.equal(decisionResult.ok, true);
  assert.equal(isAuthorizationDecision(decisionResult.value), true);
  assert.equal(Object.isFrozen(decisionResult.value), true);
  assert.equal(decisionResult.value.allowed, true);
});

test("common event envelope chain via barrel exports", () => {
  const actorResult = createActorReference({
    actorType: "SERVICE",
    actorId: "svc-integration-1",
  });
  assert.equal(actorResult.ok, true);

  const subjectResult = createSubjectReference({
    subjectType: "TOURNAMENT",
    subjectId: "tournament-integration-1",
  });
  assert.equal(subjectResult.ok, true);

  const traceResult = createTraceContext({
    correlationId: "corr-integration-1",
    causationId: "cause-integration-1",
  });
  assert.equal(traceResult.ok, true);
  assert.equal(isTraceContext(traceResult.value), true);
  assert.equal(Object.isFrozen(traceResult.value), true);

  const occurredAtResult = parseIsoStrict("2026-07-24T03:00:00.000Z");
  assert.equal(occurredAtResult.ok, true);

  const envelopeResult = createCommonEventEnvelope({
    eventId: "evt-integration-1",
    eventType: "platform.integration.certified",
    occurredAt: occurredAtResult.value,
    sourceModule: "platform-core",
    payloadVersion: "1",
    actor: actorResult.value,
    subject: subjectResult.value,
    trace: traceResult.value,
    tenantId: "tenant-integration-1",
    payload: { certified: true },
  });
  assert.equal(envelopeResult.ok, true);
  assert.equal(isCommonEventEnvelope(envelopeResult.value), true);
  assert.equal(Object.isFrozen(envelopeResult.value), true);
  assert.equal(envelopeResult.value.tenantId, "tenant-integration-1");
  assert.deepEqual(envelopeResult.value.payload, { certified: true });
});

test("operation identity with idempotency key via barrel exports", () => {
  const keyResult = createIdempotencyKey("idem-integration-1");
  assert.equal(keyResult.ok, true);
  assert.equal(isIdempotencyKey(keyResult.value), true);

  const identityResult = createOperationIdentity({
    operationId: "op-integration-1",
    idempotencyKey: keyResult.value,
    correlationId: "corr-op-1",
  });
  assert.equal(identityResult.ok, true);
  assert.equal(isOperationIdentity(identityResult.value), true);
  assert.equal(Object.isFrozen(identityResult.value), true);
  assert.equal(identityResult.value.idempotencyKey, "idem-integration-1");
});

test("compatibility decision with contract version via barrel exports", () => {
  const currentVersion = createContractVersion("1.0.0");
  assert.equal(currentVersion.ok, true);
  assert.equal(isContractVersion(currentVersion.value), true);

  const requiredVersion = createContractVersion("1.0.0");
  assert.equal(requiredVersion.ok, true);

  const decisionResult = createCompatibilityDecision({
    compatible: true,
    decisionCode: "COMPATIBLE",
    currentVersion: currentVersion.value,
    requiredVersion: requiredVersion.value,
    reason: "caller-provided compatibility",
  });
  assert.equal(decisionResult.ok, true);
  assert.equal(isCompatibilityDecision(decisionResult.value), true);
  assert.equal(Object.isFrozen(decisionResult.value), true);
});

test("descriptor contracts via barrel exports", () => {
  const portResult = createIntegrationPortDescriptor({
    portName: "authorizationDecisionPort",
    ownerModule: "platform-core",
    direction: "inbound",
    version: "1.0.0",
  });
  assert.equal(portResult.ok, true);
  assert.equal(isIntegrationPortDescriptor(portResult.value), true);
  assert.equal(Object.isFrozen(portResult.value), true);

  const capabilityResult = createPlatformCapabilityDescriptor({
    capabilityCode: "platform.contracts",
    ownerModule: "platform-core",
    version: "1.0.0",
    status: "certified",
  });
  assert.equal(capabilityResult.ok, true);
  assert.equal(isPlatformCapabilityDescriptor(capabilityResult.value), true);
  assert.equal(Object.isFrozen(capabilityResult.value), true);

  const errorResult = createPlatformErrorDescriptor({
    code: "PLATFORM_CONTRACT_INVALID",
    message: "Contract validation failed",
    category: "validation",
    field: "input",
    retryable: false,
  });
  assert.equal(errorResult.ok, true);
  assert.equal(isPlatformErrorDescriptor(errorResult.value), true);
  assert.equal(Object.isFrozen(errorResult.value), true);
});

test("result helpers and role/opaque primitives via barrel exports", () => {
  const success = ok({ value: 1 });
  assert.equal(isOk(success), true);
  assert.equal(isFail(success), false);

  const failure = fail({ code: "X", message: "y" });
  assert.equal(isFail(failure), true);
  assert.equal(isOk(failure), false);

  const opaque = normalizeOpaqueId("  opaque-1  ");
  assert.equal(opaque.ok, true);
  assert.equal(isOpaqueId(opaque.value), true);

  const role = createRoleCode("DIRECTOR");
  assert.equal(role.ok, true);
  assert.equal(isRoleCode(role.value), true);

  const instant = nowIso();
  assert.equal(typeof instant, "string");
  assert.equal(parseIsoStrict(instant).ok, true);
});

test("constructors return Result shapes and do not invent identifiers", () => {
  const actor = createActorReference({
    actorType: "USER",
    actorId: "fixed-actor-id",
  });
  assert.equal(actor.ok, true);
  assert.equal(actor.value.actorId, "fixed-actor-id");

  const rejected = createActorReference({
    actorType: "USER",
    actorId: "",
  });
  assert.equal(rejected.ok, false);
  assert.equal(typeof rejected.error.code, "string");

  const event = createCommonEventEnvelope({
    eventId: "fixed-event-id",
    eventType: "platform.integration.fixed",
    occurredAt: "2026-07-24T03:00:00.000Z",
    sourceModule: "platform-core",
    payloadVersion: "1",
    actor: actor.value,
    payload: {},
  });
  assert.equal(event.ok, true);
  assert.equal(event.value.eventId, "fixed-event-id");

  const identity = createOperationIdentity({
    operationId: "fixed-operation-id",
  });
  assert.equal(identity.ok, true);
  assert.equal(identity.value.operationId, "fixed-operation-id");
  assert.equal("idempotencyKey" in identity.value, false);
});

test("contract directory has no business-module imports, persistence, or evaluators", () => {
  const sources = [
    path.join(CONTRACT_DIR, "index.js"),
    ...listContractImplementationSources(),
  ];

  for (const sourcePath of sources) {
    const source = fs.readFileSync(sourcePath, "utf8");
    const base = path.basename(sourcePath);

    assert.equal(
      /from\s+["'][^"']*src\/features\//.test(source),
      false,
      `${base} must not import src/features`
    );
    assert.equal(
      /from\s+["'][^"']*\/features\//.test(source),
      false,
      `${base} must not import features modules`
    );
    assert.equal(
      /from\s+["'][^"']*src\/auth\//.test(source) ||
        /from\s+["'][^"']*\/auth\//.test(source),
      false,
      `${base} must not import auth runtime`
    );
    assert.equal(
      /supabase|createClient|from\s+["'][^"']*database/i.test(source),
      false,
      `${base} must not include persistence/database/Supabase`
    );
    assert.equal(
      /evaluateAuthorization|checkPermission|hasPermission|policyEngine|runtimeEvaluator/.test(
        source
      ),
      false,
      `${base} must not include runtime evaluator/policy engine`
    );
    assert.equal(
      source.includes("randomUUID"),
      false,
      `${base} must not call randomUUID`
    );

    // nowIso intentionally uses Date; other contracts must not invent time-based IDs.
    if (base !== "isoClock.js") {
      assert.equal(
        source.includes("Date.now"),
        false,
        `${base} must not use Date.now`
      );
    }
  }
});

test("contract-local index remains the implementation source of truth", () => {
  const indexSource = fs.readFileSync(
    path.join(CONTRACT_DIR, "index.js"),
    "utf8"
  );
  assert.match(indexSource, /createActorReference/);
  assert.match(indexSource, /createAuthorizationRequest/);
  assert.match(indexSource, /createPlatformCapabilityDescriptor/);
  assert.equal(
    /from\s+["'][^"']*src\/core\/platform(?:\/index)?\.js["']/.test(indexSource),
    false,
    "contract-local index must not import the root platform barrel"
  );
  assert.equal(
    /export\s+\*\s+from\s+["']\.\.\/index\.js["']/.test(indexSource),
    false,
    "contract-local index must not re-export the root platform barrel"
  );

  const rootPlatformIndex = path.join(CONTRACT_DIR, "..", "index.js");
  assert.equal(fs.existsSync(rootPlatformIndex), true);
  const rootSource = fs.readFileSync(rootPlatformIndex, "utf8");
  assert.equal(
    /from\s+["']\.\/contracts(?:\/index)?\.js["']/.test(rootSource),
    true,
    "Phase 2A root platform barrel must re-export contracts"
  );
  assert.equal(
    /PLATFORM_CAPABILITY_MANIFEST/.test(rootSource),
    true,
    "Phase 2A root platform barrel must export capability manifest"
  );
  assert.equal(
    /from\s+["']\.\/capabilities\.js["']/.test(rootSource),
    true,
    "Phase 2A root platform barrel must export capabilities module"
  );
});
