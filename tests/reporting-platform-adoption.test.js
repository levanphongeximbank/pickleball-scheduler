/**
 * Reporting & Analytics Platform Core adoption certification.
 * Canonical module: src/features/dashboard-analytics.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  REPORTING_PLATFORM_ADAPTER_ERROR,
  projectReportingActor,
  projectReportingSecurityContext,
  projectReportingScope,
  projectReportingSubject,
  projectReportingOperation,
  projectReportingVersion,
  projectReportingCompatibility,
  projectReportingEvent,
  projectReportingError,
  projectReportingCapability,
} from "../src/features/dashboard-analytics/platform/index.js";
import {
  isOk,
  isFail,
  isActorReference,
  isPlatformScope,
  isSecurityContext,
  isSubjectReference,
  isOperationIdentity,
  isContractVersion,
  isCompatibilityDecision,
  isCommonEventEnvelope,
  isPlatformErrorDescriptor,
  isPlatformCapabilityDescriptor,
} from "../src/core/platform/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_DIR = path.join(ROOT, "src/features/dashboard-analytics/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("reporting platform imports only canonical public entry", () => {
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

test("reporting actor, scope, subject, and security context require explicit ids", () => {
  assert.equal(
    projectReportingActor({}).error.code,
    REPORTING_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectReportingScope({}).error.code,
    REPORTING_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED
  );
  assert.equal(
    projectReportingSubject({}).error.code,
    REPORTING_PLATFORM_ADAPTER_ERROR.SUBJECT_ID_REQUIRED
  );

  const actor = projectReportingActor({ userId: "user-report-1" });
  assert.equal(isOk(actor), true);
  assert.equal(isActorReference(actor.value), true);

  const scope = projectReportingScope({
    tenantId: "tenant-report-1",
    clubId: "club-report-1",
  });
  assert.equal(isOk(scope), true);
  assert.equal(isPlatformScope(scope.value), true);

  const subject = projectReportingSubject({ reportId: "report-1" });
  assert.equal(isOk(subject), true);
  assert.equal(isSubjectReference(subject.value), true);

  const ctxInput = Object.freeze({
    userId: "user-report-2",
    tenantId: "tenant-report-2",
  });
  const ctx = projectReportingSecurityContext(ctxInput);
  assert.equal(isOk(ctx), true);
  assert.equal(isSecurityContext(ctx.value), true);
  assert.deepEqual(ctxInput, {
    userId: "user-report-2",
    tenantId: "tenant-report-2",
  });
});

test("reporting operation, version, compatibility, event, error, capability", () => {
  assert.equal(
    projectReportingOperation({}).error.code,
    REPORTING_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );

  const opInput = Object.freeze({
    operationId: "REPORT_QUERY:req-1",
  });
  const op = projectReportingOperation(opInput);
  assert.equal(isOk(op), true);
  assert.equal(isOperationIdentity(op.value), true);
  assert.deepEqual(opInput, { operationId: "REPORT_QUERY:req-1" });

  const version = projectReportingVersion({ version: "REPORTING_EVENT_V1" });
  assert.equal(isOk(version), true);
  assert.equal(isContractVersion(version.value), true);

  const decision = projectReportingCompatibility({
    compatible: true,
    decisionCode: "COMPATIBLE",
    currentVersion: "REPORTING_EVENT_V1",
    requiredVersion: "REPORTING_EVENT_V1",
  });
  assert.equal(isOk(decision), true);
  assert.equal(isCompatibilityDecision(decision.value), true);
  assert.equal(Object.isFrozen(decision.value), true);

  const envelope = projectReportingEvent({
    eventId: "evt-report-1",
    eventType: "REPORT_REQUESTED",
    occurredAt: "2026-07-24T03:00:00.000Z",
    sourceModule: "Reporting",
    payloadVersion: "1",
    actor: { actorType: "USER", actorId: "user-report-evt" },
    payload: Object.freeze({ reportId: "report-evt" }),
    tenantId: "tenant-report-evt",
  });
  assert.equal(isOk(envelope), true);
  assert.equal(isCommonEventEnvelope(envelope.value), true);
  assert.equal(Object.isFrozen(envelope.value), true);

  const error = projectReportingError({
    code: "REPORTING_ACCESS_DENIED",
    message: "Access denied by Reporting domain",
    retryable: false,
  });
  assert.equal(isOk(error), true);
  assert.equal(isPlatformErrorDescriptor(error.value), true);

  const capability = projectReportingCapability({
    capabilityCode: "REPORTING_PUBLIC_FACADE",
    ownerModule: "Reporting",
    version: "1.0.0",
    status: "ADAPTER_AVAILABLE",
  });
  assert.equal(isOk(capability), true);
  assert.equal(isPlatformCapabilityDescriptor(capability.value), true);
});

test("reporting platform adapters generate no identifiers and avoid runtime behavior", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/Math\.random\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
    assert.equal(
      /getDashboardAnalytics|getDashboardSummary|resolveDashboardAccess|generateOperationalInsights|getRevenueAnalytics/.test(
        source
      ),
      false,
      name
    );
  }
});

test("reporting public exports remain compatible", () => {
  const barrel = fs.readFileSync(
    path.join(ROOT, "src/features/dashboard-analytics/index.js"),
    "utf8"
  );
  assert.match(barrel, /projectReportingActor/);
  assert.match(barrel, /from\s+["']\.\/platform\/index\.js["']/);
  assert.match(barrel, /resolveDashboardAccess/);
  assert.match(barrel, /getDashboardSummary/);
  assert.match(barrel, /DashboardAnalyticsView/);
  assert.equal(typeof projectReportingActor, "function");
  assert.equal(isFail(projectReportingActor(null)), true);
});
