/**
 * Ranking (VPR) Platform Core adoption certification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RANKING_PLATFORM_ADAPTER_ERROR,
  projectRankingActor,
  projectRankingSecurityContext,
  projectRankingScope,
  projectRankingSubject,
  projectRankingOperation,
  projectRankingVersion,
  projectRankingCompatibility,
  projectRankingEvent,
  projectRankingError,
  projectRankingCapability,
} from "../src/features/vpr-ranking/platform/index.js";
import { calculateVprPoints } from "../src/features/vpr-ranking/engines/vprCalculationEngine.js";
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
const PLATFORM_DIR = path.join(ROOT, "src/features/vpr-ranking/platform");

function readPlatformSources() {
  return fs
    .readdirSync(PLATFORM_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => ({
      name,
      source: fs.readFileSync(path.join(PLATFORM_DIR, name), "utf8"),
    }));
}

test("ranking platform imports only canonical public entry", () => {
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

test("ranking actor, scope, subject, and security context require explicit ids", () => {
  assert.equal(
    projectRankingActor({}).error.code,
    RANKING_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED
  );
  assert.equal(
    projectRankingScope({}).error.code,
    RANKING_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED
  );
  assert.equal(
    projectRankingSubject({}).error.code,
    RANKING_PLATFORM_ADAPTER_ERROR.SUBJECT_ID_REQUIRED
  );

  const actor = projectRankingActor({ actorUserId: "user-rank-1" });
  assert.equal(isOk(actor), true);
  assert.equal(isActorReference(actor.value), true);

  const scope = projectRankingScope({
    tenantId: "tenant-rank-1",
    clubId: "club-rank-1",
  });
  assert.equal(isOk(scope), true);
  assert.equal(isPlatformScope(scope.value), true);

  const subject = projectRankingSubject({ vprAthleteId: "athlete-1" });
  assert.equal(isOk(subject), true);
  assert.equal(isSubjectReference(subject.value), true);

  const ctxInput = Object.freeze({
    actorUserId: "user-rank-2",
    tenantId: "tenant-rank-2",
  });
  const ctx = projectRankingSecurityContext(ctxInput);
  assert.equal(isOk(ctx), true);
  assert.equal(isSecurityContext(ctx.value), true);
  assert.deepEqual(ctxInput, {
    actorUserId: "user-rank-2",
    tenantId: "tenant-rank-2",
  });
});

test("ranking operation, version, compatibility, event, error, capability", () => {
  assert.equal(
    projectRankingOperation({}).error.code,
    RANKING_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );

  const opInput = Object.freeze({
    operationId: "RANKING_RECALCULATE:req-1",
  });
  const op = projectRankingOperation(opInput);
  assert.equal(isOk(op), true);
  assert.equal(isOperationIdentity(op.value), true);
  assert.deepEqual(opInput, { operationId: "RANKING_RECALCULATE:req-1" });

  const version = projectRankingVersion({ version: "RANKING_EVENT_V1" });
  assert.equal(isOk(version), true);
  assert.equal(isContractVersion(version.value), true);

  const decision = projectRankingCompatibility({
    compatible: true,
    decisionCode: "COMPATIBLE",
    currentVersion: "RANKING_EVENT_V1",
    requiredVersion: "RANKING_EVENT_V1",
  });
  assert.equal(isOk(decision), true);
  assert.equal(isCompatibilityDecision(decision.value), true);
  assert.equal(Object.isFrozen(decision.value), true);

  const envelope = projectRankingEvent({
    eventId: "evt-rank-1",
    eventType: "RANKING_AWARDED",
    occurredAt: "2026-07-24T03:00:00.000Z",
    sourceModule: "Ranking",
    payloadVersion: "1",
    actor: { actorType: "USER", actorId: "user-rank-evt" },
    payload: Object.freeze({ vprAthleteId: "athlete-evt" }),
    tenantId: "tenant-rank-evt",
  });
  assert.equal(isOk(envelope), true);
  assert.equal(isCommonEventEnvelope(envelope.value), true);
  assert.equal(Object.isFrozen(envelope.value), true);

  const error = projectRankingError({
    code: "RANKING_AWARD_REJECTED",
    message: "Award rejected by Ranking domain",
    retryable: false,
  });
  assert.equal(isOk(error), true);
  assert.equal(isPlatformErrorDescriptor(error.value), true);

  const capability = projectRankingCapability({
    capabilityCode: "RANKING_PUBLIC_FACADE",
    ownerModule: "Ranking",
    version: "1.0.0",
    status: "ADAPTER_AVAILABLE",
  });
  assert.equal(isOk(capability), true);
  assert.equal(isPlatformCapabilityDescriptor(capability.value), true);
});

test("ranking platform adapters generate no identifiers and avoid runtime behavior", () => {
  for (const { name, source } of readPlatformSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/Math\.random\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
    assert.equal(
      /calculateVprPoints|awardVpr|publishRanking|recalculate|appendVprAuditLog/.test(
        source
      ),
      false,
      name
    );
  }
});

test("ranking public exports remain compatible", () => {
  const barrel = fs.readFileSync(
    path.join(ROOT, "src/features/vpr-ranking/index.js"),
    "utf8"
  );
  assert.match(barrel, /projectRankingActor/);
  assert.match(barrel, /from\s+["']\.\/platform\/index\.js["']/);
  assert.match(barrel, /vprCalculationEngine/);
  assert.equal(typeof projectRankingActor, "function");
  assert.equal(typeof calculateVprPoints, "function");
  assert.equal(isFail(projectRankingActor(null)), true);
});
