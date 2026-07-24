/**
 * Notification Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  NOTIFICATION_PLATFORM_ADAPTER_ERROR,
  projectNotificationActor,
  projectNotificationSecurityContext,
  projectNotificationScope,
  projectNotificationRecipient,
  projectNotificationOperation,
  projectNotificationIdempotencyKey,
  projectNotificationTrace,
  projectNotificationEvent,
  projectNotificationError,
  projectNotificationVersion,
  projectNotificationCompatibility,
  projectNotificationCapability,
  emitNotificationEvent,
  NOTIFICATION_COMPATIBILITY,
} from "../src/features/notifications/index.js";
import {
  isOk,
  isFail,
  isActorReference,
  isPlatformScope,
  isSecurityContext,
  isSubjectReference,
  isOperationIdentity,
  isIdempotencyKey,
  isTraceContext,
  isContractVersion,
  isCompatibilityDecision,
  isCommonEventEnvelope,
  isPlatformErrorDescriptor,
  isPlatformCapabilityDescriptor,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(ROOT, "src/features/notifications/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("notification platform imports only canonical public entry", () => {
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

test("notification actor, scope, recipient, and security context require explicit ids", () => {
  assert.equal(
    projectNotificationActor({}).error.code,
    NOTIFICATION_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectNotificationScope({}).error.code,
    NOTIFICATION_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED
  );
  assert.equal(
    projectNotificationRecipient({}).error.code,
    NOTIFICATION_PLATFORM_ADAPTER_ERROR.RECIPIENT_ID_REQUIRED
  );

  const actor = projectNotificationActor({ actorUserId: "user-notif-1" });
  assert.equal(isOk(actor), true);
  assert.equal(isActorReference(actor.value), true);

  const scope = projectNotificationScope({ tenantId: "tenant-notif-1" });
  assert.equal(isOk(scope), true);
  assert.equal(isPlatformScope(scope.value), true);

  const recipient = projectNotificationRecipient({ recipientId: "user-recv-1" });
  assert.equal(isOk(recipient), true);
  assert.equal(isSubjectReference(recipient.value), true);

  const ctxInput = Object.freeze({
    actorUserId: "user-notif-2",
    tenantId: "tenant-notif-2",
  });
  const ctx = projectNotificationSecurityContext(ctxInput);
  assert.equal(isOk(ctx), true);
  assert.equal(isSecurityContext(ctx.value), true);
  assert.deepEqual(ctxInput, {
    actorUserId: "user-notif-2",
    tenantId: "tenant-notif-2",
  });
});

test("notification operation identity and idempotency key require explicit values", () => {
  assert.equal(
    projectNotificationOperation({}).error.code,
    NOTIFICATION_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );
  assert.equal(
    projectNotificationIdempotencyKey({}).error.code,
    NOTIFICATION_PLATFORM_ADAPTER_ERROR.IDEMPOTENCY_KEY_REQUIRED
  );

  const opInput = Object.freeze({
    operationId: "EMIT_NOTIFICATION:req-1",
    idempotencyKey: "tenant:EVENT:entity:1",
  });
  const op = projectNotificationOperation(opInput);
  assert.equal(isOk(op), true);
  assert.equal(isOperationIdentity(op.value), true);
  assert.deepEqual(opInput, {
    operationId: "EMIT_NOTIFICATION:req-1",
    idempotencyKey: "tenant:EVENT:entity:1",
  });

  const key = projectNotificationIdempotencyKey({
    idempotencyKey: "tenant:EVENT:entity:2",
  });
  assert.equal(isOk(key), true);
  assert.equal(isIdempotencyKey(key.value), true);
});

test("notification trace, version, compatibility, event, error, capability", () => {
  const trace = projectNotificationTrace({
    correlationId: "corr-notif-1",
    causationId: "cause-notif-1",
  });
  assert.equal(isOk(trace), true);
  assert.equal(isTraceContext(trace.value), true);

  const version = projectNotificationVersion({ version: "NOTIFICATION_EVENT_V1" });
  assert.equal(isOk(version), true);
  assert.equal(isContractVersion(version.value), true);

  const decision = projectNotificationCompatibility({
    compatible: true,
    decisionCode: "COMPATIBLE",
    currentVersion: "NOTIFICATION_EVENT_V1",
    requiredVersion: "NOTIFICATION_EVENT_V1",
  });
  assert.equal(isOk(decision), true);
  assert.equal(isCompatibilityDecision(decision.value), true);
  assert.equal(Object.isFrozen(decision.value), true);

  const envelope = projectNotificationEvent({
    eventId: "evt-notif-1",
    eventType: "BOOKING_CREATED",
    occurredAt: "2026-07-24T02:00:00.000Z",
    sourceModule: "Notification",
    payloadVersion: "1",
    actor: { actorType: "USER", actorId: "user-notif-evt" },
    payload: Object.freeze({ bookingId: "book-1" }),
    tenantId: "tenant-notif-evt",
  });
  assert.equal(isOk(envelope), true);
  assert.equal(isCommonEventEnvelope(envelope.value), true);
  assert.equal(Object.isFrozen(envelope.value), true);

  const error = projectNotificationError({
    code: "NOTIFICATION_DELIVERY_FAILED",
    message: "Delivery rejected by Notification domain",
    retryable: false,
  });
  assert.equal(isOk(error), true);
  assert.equal(isPlatformErrorDescriptor(error.value), true);

  const capability = projectNotificationCapability({
    capabilityCode: "NOTIFICATION_PUBLIC_FACADE",
    ownerModule: "Notification",
    version: "1.0.0",
    status: "ADAPTER_AVAILABLE",
  });
  assert.equal(isOk(capability), true);
  assert.equal(isPlatformCapabilityDescriptor(capability.value), true);
});

test("notification platform adapters generate no identifiers and avoid runtime behavior", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/Math\.random\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
    assert.equal(
      /emitNotificationEvent|resolveNotificationRecipients|runNotificationWorkerOnce|renderTemplate|enqueueNotificationDelivery|buildNotificationIdempotencyKey|markNotificationRead/.test(
        source
      ),
      false,
      name
    );
  }
});

test("notification public exports remain compatible and Phase 2C remains paused", () => {
  const barrel = fs.readFileSync(
    path.join(ROOT, "src/features/notifications/index.js"),
    "utf8"
  );
  assert.match(barrel, /projectNotificationActor/);
  assert.match(barrel, /from\s+["']\.\/platform\/index\.js["']/);
  assert.equal(typeof projectNotificationActor, "function");
  assert.equal(typeof emitNotificationEvent, "function");
  assert.equal(isFail(projectNotificationActor(null)), true);

  assert.equal(NOTIFICATION_COMPATIBILITY.liveDeliveryEnabled, false);
  assert.equal(NOTIFICATION_COMPATIBILITY.productionWorkerBlocked, true);
  assert.equal(NOTIFICATION_COMPATIBILITY.productionSafetyPhase, "2B");

  const phase2cDoc = path.join(
    ROOT,
    "docs/NOTIFICATION-PHASE-2C-PRODUCTION-SCHEMA-ROLLOUT.md"
  );
  assert.equal(
    fs.existsSync(phase2cDoc),
    false,
    "Phase 2C rollout doc must not be introduced by this adoption wave"
  );
});
