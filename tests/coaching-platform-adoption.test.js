/**
 * Coaching & Training Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COACHING_PLATFORM_ADAPTER_ERROR,
  projectCoachingActor,
  projectCoachingSecurityContext,
  projectCoachingScope,
  projectCoachingSubject,
  projectCoachingPermission,
  projectCoachingAuthorizationRequest,
  projectCoachingOperation,
  projectCoachingVersion,
  projectCoachingCompatibility,
  projectCoachingEvent,
  projectCoachingError,
  projectCoachingCapability,
  listCoaches,
  loadCoachingStore,
} from "../src/features/coaching/index.js";
import {
  isOk,
  isFail,
  isActorReference,
  isPlatformScope,
  isSecurityContext,
  isSubjectReference,
  isPermissionCode,
  isAuthorizationRequest,
  isOperationIdentity,
  isContractVersion,
  isCompatibilityDecision,
  isCommonEventEnvelope,
  isPlatformErrorDescriptor,
  isPlatformCapabilityDescriptor,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(ROOT, "src/features/coaching/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("coaching platform imports only canonical public entry", () => {
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

test("coaching actor, scope, subject, and security context require explicit ids", () => {
  assert.equal(
    projectCoachingActor({}).error.code,
    COACHING_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectCoachingScope({}).error.code,
    COACHING_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED
  );
  assert.equal(
    projectCoachingSubject({}).error.code,
    COACHING_PLATFORM_ADAPTER_ERROR.SUBJECT_ID_REQUIRED
  );

  const actor = projectCoachingActor({ userId: "user-coach-1" });
  assert.equal(isOk(actor), true);
  assert.equal(isActorReference(actor.value), true);

  const scope = projectCoachingScope({
    tenantId: "tenant-coach-1",
    clubId: "club-coach-1",
  });
  assert.equal(isOk(scope), true);
  assert.equal(isPlatformScope(scope.value), true);

  const subject = projectCoachingSubject({ coachId: "coach-1" });
  assert.equal(isOk(subject), true);
  assert.equal(isSubjectReference(subject.value), true);

  const ctxInput = Object.freeze({
    userId: "user-coach-2",
    tenantId: "tenant-coach-2",
  });
  const ctx = projectCoachingSecurityContext(ctxInput);
  assert.equal(isOk(ctx), true);
  assert.equal(isSecurityContext(ctx.value), true);
  assert.deepEqual(ctxInput, {
    userId: "user-coach-2",
    tenantId: "tenant-coach-2",
  });
});

test("coaching permission, authorization request, operation, event, error, capability", () => {
  assert.equal(
    projectCoachingPermission({}).error.code,
    COACHING_PLATFORM_ADAPTER_ERROR.PERMISSION_REQUIRED
  );
  assert.equal(
    projectCoachingOperation({}).error.code,
    COACHING_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );

  const permission = projectCoachingPermission({
    permission: "coaching.schedule.write",
  });
  assert.equal(isOk(permission), true);
  assert.equal(isPermissionCode(permission.value), true);

  const securityContext = projectCoachingSecurityContext({
    userId: "user-coach-auth",
    tenantId: "tenant-coach-auth",
  });
  assert.equal(isOk(securityContext), true);

  const authReq = projectCoachingAuthorizationRequest({
    securityContext: securityContext.value,
    permissionCode: "coaching.schedule.write",
  });
  assert.equal(isOk(authReq), true);
  assert.equal(isAuthorizationRequest(authReq.value), true);

  const opInput = Object.freeze({
    operationId: "COACHING_MARK_ATTENDANCE:req-1",
  });
  const op = projectCoachingOperation(opInput);
  assert.equal(isOk(op), true);
  assert.equal(isOperationIdentity(op.value), true);
  assert.deepEqual(opInput, { operationId: "COACHING_MARK_ATTENDANCE:req-1" });

  const version = projectCoachingVersion({ version: "COACHING_EVENT_V1" });
  assert.equal(isOk(version), true);
  assert.equal(isContractVersion(version.value), true);

  const decision = projectCoachingCompatibility({
    compatible: true,
    decisionCode: "COMPATIBLE",
    currentVersion: "COACHING_EVENT_V1",
    requiredVersion: "COACHING_EVENT_V1",
  });
  assert.equal(isOk(decision), true);
  assert.equal(isCompatibilityDecision(decision.value), true);
  assert.equal(Object.isFrozen(decision.value), true);

  const envelope = projectCoachingEvent({
    eventId: "evt-coach-1",
    eventType: "COACHING_ATTENDANCE_MARKED",
    occurredAt: "2026-07-24T03:00:00.000Z",
    sourceModule: "Coaching",
    payloadVersion: "1",
    actor: { actorType: "USER", actorId: "user-coach-evt" },
    payload: Object.freeze({ classId: "class-evt" }),
    tenantId: "tenant-coach-evt",
  });
  assert.equal(isOk(envelope), true);
  assert.equal(isCommonEventEnvelope(envelope.value), true);
  assert.equal(Object.isFrozen(envelope.value), true);

  const error = projectCoachingError({
    code: "COACHING_ATTENDANCE_REJECTED",
    message: "Attendance rejected by Coaching domain",
    retryable: false,
  });
  assert.equal(isOk(error), true);
  assert.equal(isPlatformErrorDescriptor(error.value), true);

  const capability = projectCoachingCapability({
    capabilityCode: "COACHING_PUBLIC_FACADE",
    ownerModule: "Coaching",
    version: "1.0.0",
    status: "ADAPTER_AVAILABLE",
  });
  assert.equal(isOk(capability), true);
  assert.equal(isPlatformCapabilityDescriptor(capability.value), true);
});

test("coaching platform adapters generate no identifiers and avoid runtime behavior", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/Math\.random\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
    assert.equal(
      /listCoaches|loadCoachingStore|saveCoachingStore|markAttendance|createClass|assignCoach/.test(
        source
      ),
      false,
      name
    );
  }
});

test("coaching public exports remain compatible", () => {
  const barrel = fs.readFileSync(
    path.join(ROOT, "src/features/coaching/index.js"),
    "utf8"
  );
  assert.match(barrel, /projectCoachingActor/);
  assert.match(barrel, /from\s+["']\.\/platform\/index\.js["']/);
  assert.equal(typeof projectCoachingActor, "function");
  assert.equal(typeof listCoaches, "function");
  assert.equal(typeof loadCoachingStore, "function");
  assert.equal(isFail(projectCoachingActor(null)), true);
});
