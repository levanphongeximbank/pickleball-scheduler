/**
 * CORE-20 Competition Audit Event Log — Phase 1B focused certification tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WORKFLOW_EVENT_TYPE,
  buildWorkflowEventId,
  createWorkflowEvent,
  createWorkflowPayloadFingerprint,
} from "../src/features/competition-core/workflow/index.js";

import {
  CORE20_ENGINE_ID,
  COMPETITION_AUDIT_EVENT_VERSION,
  COMPETITION_AUDIT_SCHEMA_VERSION,
  COMPETITION_AUDIT_EVENT_SCHEMA_V1,
  AUDIT_EVENT_TYPE,
  ACTOR_KIND,
  SUBJECT_TYPE,
  AUDIT_ERROR_CODE,
  AuditError,
  createCompetitionAuditEvent,
  buildCompetitionAuditEventId,
  createActorReference,
  createSubjectReference,
  createCompetitionScope,
  createAuditQueryCriteria,
  matchAuditQuery,
  validateAuditEvent,
  createAuditContentFingerprint,
  sanitizeAuditPayload,
  pickAllowlistedPayload,
  PROHIBITED_AUDIT_KEYS,
  fromWorkflowEvent,
  fromWorkflowEventChain,
  WORKFLOW_SAFE_PAYLOAD_ALLOWLIST,
  createInMemoryCompetitionAuditSinkPort,
  createNullCompetitionAuditSinkPort,
  assertNextSequence,
  buildOrderingKey,
  CORE19_WORKFLOW_SOURCE,
} from "../src/features/competition-core/audit/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT_ROOT = path.join(ROOT, "src/features/competition-core/audit");
const WORKFLOW_ROOT = path.join(ROOT, "src/features/competition-core/workflow");
const IDENTITY_AUDIT = path.join(
  ROOT,
  "src/features/identity/services/auditService.js"
);
const OCCURRED_AT = "2026-07-23T10:00:00.000Z";
const COMPETITION_ID = "comp-core20-1";

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

function sampleWorkflowEvent(overrides = {}) {
  const base = {
    eventType: WORKFLOW_EVENT_TYPE.TRANSITION_AUTHORIZED,
    occurredAt: OCCURRED_AT,
    workflowInstanceId: "wf-inst-1",
    definitionId: "wf-def-1",
    definitionVersion: "1.0.0",
    transitionId: "t-draft-to-ready",
    fromStepId: "step-draft",
    toStepId: "step-ready",
    fromStatus: "DRAFT",
    toStatus: "READY",
    idempotencyKey: "idem-1",
    actorId: "user-1",
    actorType: "ORGANIZER",
    correlationId: "corr-1",
    reasonCode: "AUTHORIZED",
    payload: { operation: "transition", reason: "ok", secretToken: "nope" },
  };
  const merged = { ...base, ...overrides };
  if (!merged.eventId) {
    merged.eventId = buildWorkflowEventId({
      ...merged,
      sequence: overrides.sequenceSegment || "1",
    });
  }
  if (!merged.payloadFingerprint) {
    merged.payloadFingerprint = createWorkflowPayloadFingerprint(
      merged.payload || {}
    );
  }
  return createWorkflowEvent(merged);
}

describe("CORE-20 Phase 1B — Competition Audit Event Log", () => {
  it("01. public barrel exports canonical surface", async () => {
    const mod = await import(
      "../src/features/competition-core/audit/index.js"
    );
    assert.equal(mod.CORE20_ENGINE_ID, CORE20_ENGINE_ID);
    assert.equal(typeof mod.createCompetitionAuditEvent, "function");
    assert.equal(typeof mod.fromWorkflowEvent, "function");
    assert.equal(typeof mod.fromWorkflowEventChain, "function");
    assert.equal(typeof mod.validateAuditEvent, "function");
    assert.equal(typeof mod.createInMemoryCompetitionAuditSinkPort, "function");
    assert.ok(mod.AUDIT_EVENT_TYPE.WORKFLOW_TRANSITION_AUTHORIZED);
    assert.ok(mod.AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT);
  });

  it("02. creates immutable CompetitionAuditEvent with required fields", () => {
    const event = createCompetitionAuditEvent({
      eventType: AUDIT_EVENT_TYPE.WORKFLOW_TRANSITION_AUTHORIZED,
      source: CORE19_WORKFLOW_SOURCE,
      occurredAt: OCCURRED_AT,
      competitionScope: { competitionId: COMPETITION_ID },
      streamKey: "workflow:wf-inst-1",
      sequence: 1,
      actor: { actorKind: ACTOR_KIND.USER, actorId: "user-1" },
      subject: {
        subjectType: SUBJECT_TYPE.WORKFLOW,
        subjectId: "wf-inst-1",
      },
      correlationId: "corr-1",
      beforeSummary: { status: "DRAFT" },
      afterSummary: { status: "READY" },
    });

    assert.equal(event.schemaId, COMPETITION_AUDIT_EVENT_SCHEMA_V1);
    assert.equal(event.schemaId, "competition-core.audit-event.v1");
    assert.equal(event.eventVersion, COMPETITION_AUDIT_EVENT_VERSION);
    assert.equal(COMPETITION_AUDIT_SCHEMA_VERSION, 1);
    assert.equal(
      COMPETITION_AUDIT_EVENT_SCHEMA_V1,
      `competition-core.audit-event.v${COMPETITION_AUDIT_SCHEMA_VERSION}`
    );
    // schema version and eventVersion are independent constants (both may be 1).
    assert.equal(typeof COMPETITION_AUDIT_SCHEMA_VERSION, "number");
    assert.equal(typeof COMPETITION_AUDIT_EVENT_VERSION, "number");
    assert.notEqual(
      "COMPETITION_AUDIT_SCHEMA_VERSION",
      "COMPETITION_AUDIT_EVENT_VERSION"
    );
    assert.equal(event.competitionScope.competitionId, COMPETITION_ID);
    assert.equal(event.sequence, 1);
    assert.ok(event.integrityMetadata.contentFingerprint);
    assert.throws(() => {
      /** @type {{ sequence: number }} */ (event).sequence = 99;
    });
  });

  it("03. rejects missing occurredAt / invalid sequence / invalid eventType", () => {
    assert.throws(
      () =>
        createCompetitionAuditEvent({
          eventType: AUDIT_EVENT_TYPE.WORKFLOW_PAUSED,
          source: CORE19_WORKFLOW_SOURCE,
          competitionScope: { competitionId: COMPETITION_ID },
          streamKey: "s1",
          sequence: 1,
          actor: { actorKind: ACTOR_KIND.SYSTEM },
          subject: { subjectType: SUBJECT_TYPE.WORKFLOW, subjectId: "w1" },
        }),
      (err) => err instanceof AuditError && err.code === AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT
    );

    assert.throws(
      () =>
        createCompetitionAuditEvent({
          eventType: AUDIT_EVENT_TYPE.WORKFLOW_PAUSED,
          source: CORE19_WORKFLOW_SOURCE,
          occurredAt: OCCURRED_AT,
          competitionScope: { competitionId: COMPETITION_ID },
          streamKey: "s1",
          sequence: 0,
          actor: { actorKind: ACTOR_KIND.SYSTEM },
          subject: { subjectType: SUBJECT_TYPE.WORKFLOW, subjectId: "w1" },
        }),
      (err) =>
        err instanceof AuditError &&
        err.code === AUDIT_ERROR_CODE.AUDIT_INVALID_SEQUENCE
    );

    assert.throws(
      () =>
        createCompetitionAuditEvent({
          eventType: "NOT_A_TYPE",
          source: CORE19_WORKFLOW_SOURCE,
          occurredAt: OCCURRED_AT,
          competitionScope: { competitionId: COMPETITION_ID },
          streamKey: "s1",
          sequence: 1,
          actor: { actorKind: ACTOR_KIND.SYSTEM },
          subject: { subjectType: SUBJECT_TYPE.WORKFLOW, subjectId: "w1" },
        }),
      (err) => err instanceof AuditError
    );
  });

  it("04. actor/subject references are reference-only", () => {
    const actor = createActorReference({
      actorType: "ORGANIZER",
      actorId: "u-9",
    });
    assert.equal(actor.actorKind, ACTOR_KIND.USER);
    assert.equal(actor.actorId, "u-9");
    assert.equal("email" in actor, false);

    const subject = createSubjectReference({
      subjectType: SUBJECT_TYPE.MATCH,
      subjectId: "match-1",
      competitionId: COMPETITION_ID,
    });
    assert.equal(subject.subjectType, SUBJECT_TYPE.MATCH);
  });

  it("05. redaction strips prohibited keys and marks paths", () => {
    const { sanitized, redactionMetadata } = sanitizeAuditPayload({
      operation: "pause",
      password: "secret",
      nested: { token: "abc", ok: 1 },
    });
    assert.equal(sanitized.password, "[REDACTED]");
    assert.equal(sanitized.nested.token, "[REDACTED]");
    assert.equal(sanitized.nested.ok, 1);
    assert.equal(redactionMetadata.redacted, true);
    assert.ok(redactionMetadata.paths.includes("password"));
    assert.ok(PROHIBITED_AUDIT_KEYS.includes("password"));
  });

  it("06. allowlist pick excludes non-allowlisted and prohibited keys", () => {
    const picked = pickAllowlistedPayload(
      {
        operation: "restart",
        restartMode: "FROM_STEP",
        password: "x",
        arbitraryBlob: { huge: true },
      },
      WORKFLOW_SAFE_PAYLOAD_ALLOWLIST
    );
    assert.equal(picked.operation, "restart");
    assert.equal(picked.restartMode, "FROM_STEP");
    assert.equal(picked.password, undefined);
    assert.equal(picked.arbitraryBlob, undefined);
  });

  it("07. fromWorkflowEvent maps CORE-19 domain event → audit envelope", () => {
    const domain = sampleWorkflowEvent();
    const audit = fromWorkflowEvent(domain, {
      competitionScope: { competitionId: COMPETITION_ID },
      sequence: 1,
    });

    assert.equal(audit.eventId, domain.eventId);
    assert.equal(
      audit.eventType,
      AUDIT_EVENT_TYPE.WORKFLOW_TRANSITION_AUTHORIZED
    );
    assert.deepEqual(audit.source, CORE19_WORKFLOW_SOURCE);
    assert.equal(audit.subject.subjectType, SUBJECT_TYPE.WORKFLOW);
    assert.equal(audit.subject.subjectId, domain.workflowInstanceId);
    assert.equal(audit.actor.actorKind, ACTOR_KIND.USER);
    assert.equal(audit.correlationId, "corr-1");
    assert.equal(audit.beforeSummary.status, "DRAFT");
    assert.equal(audit.afterSummary.status, "READY");
    assert.equal(
      audit.integrityMetadata.domainPayloadFingerprint,
      domain.payloadFingerprint
    );
    assert.equal(audit.safePayload.operation, "transition");
    assert.equal(audit.safePayload.secretToken, undefined);
    assert.equal(audit.explanationMetadata.idempotencyKey, domain.idempotencyKey);
    assert.ok(
      audit.evidenceReferences.some(
        (r) => r.kind === "workflow.payloadFingerprint"
      )
    );
  });

  it("08. fromWorkflowEvent requires competitionScope and sequence", () => {
    const domain = sampleWorkflowEvent();
    assert.throws(
      () => fromWorkflowEvent(domain, { sequence: 1 }),
      (err) =>
        err instanceof AuditError &&
        err.code === AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID
    );
    assert.throws(
      () =>
        fromWorkflowEvent(domain, {
          competitionScope: { competitionId: COMPETITION_ID },
        }),
      (err) =>
        err instanceof AuditError &&
        err.code === AUDIT_ERROR_CODE.AUDIT_ADAPTER_INPUT_INVALID
    );
  });

  it("09. fromWorkflowEventChain sets causation chain + shared correlation", () => {
    const e1 = sampleWorkflowEvent({
      eventType: WORKFLOW_EVENT_TYPE.TRANSITION_AUTHORIZED,
      sequenceSegment: "1",
    });
    const e2 = sampleWorkflowEvent({
      eventType: WORKFLOW_EVENT_TYPE.TRANSITION_STARTED,
      sequenceSegment: "2",
      payload: { operation: "transition" },
    });
    const e3 = sampleWorkflowEvent({
      eventType: WORKFLOW_EVENT_TYPE.TRANSITION_COMPLETED,
      sequenceSegment: "3",
      payload: { operation: "transition" },
    });

    const chain = fromWorkflowEventChain([e1, e2, e3], {
      competitionScope: { competitionId: COMPETITION_ID },
    });

    assert.equal(chain.length, 3);
    assert.equal(chain[0].causationId, null);
    assert.equal(chain[1].causationId, chain[0].eventId);
    assert.equal(chain[2].causationId, chain[1].eventId);
    assert.equal(chain[0].sequence, 1);
    assert.equal(chain[1].sequence, 2);
    assert.equal(chain[2].sequence, 3);
    assert.equal(chain[0].correlationId, "corr-1");
    assert.equal(chain[2].correlationId, "corr-1");
  });

  it("10. integrity fingerprint validates; tamper fails", () => {
    const event = createCompetitionAuditEvent({
      eventType: AUDIT_EVENT_TYPE.WORKFLOW_COMPLETED,
      source: CORE19_WORKFLOW_SOURCE,
      occurredAt: OCCURRED_AT,
      competitionScope: { competitionId: COMPETITION_ID },
      streamKey: "workflow:wf-1",
      sequence: 1,
      actor: { actorKind: ACTOR_KIND.SYSTEM },
      subject: { subjectType: SUBJECT_TYPE.WORKFLOW, subjectId: "wf-1" },
    });
    validateAuditEvent(event);

    const tampered = {
      ...event,
      reason: "tampered",
      integrityMetadata: { ...event.integrityMetadata },
    };
    assert.throws(
      () => validateAuditEvent(tampered),
      (err) =>
        err instanceof AuditError &&
        err.code === AUDIT_ERROR_CODE.AUDIT_INTEGRITY_MISMATCH
    );
  });

  it("11. in-memory sink enforces ordering and duplicate eventId", async () => {
    const sink = createInMemoryCompetitionAuditSinkPort();
    const domain1 = sampleWorkflowEvent({ sequenceSegment: "1" });
    const audit1 = fromWorkflowEvent(domain1, {
      competitionScope: { competitionId: COMPETITION_ID },
      sequence: 1,
    });
    await sink.append(audit1);

    assert.equal(sink.getLastSequence(COMPETITION_ID, audit1.streamKey), 1);

    await assert.rejects(
      () => sink.append(audit1),
      (err) =>
        err instanceof AuditError &&
        err.code === AUDIT_ERROR_CODE.AUDIT_DUPLICATE_EVENT_ID
    );

    const domain2 = sampleWorkflowEvent({
      eventType: WORKFLOW_EVENT_TYPE.TRANSITION_STARTED,
      sequenceSegment: "2",
    });
    await assert.rejects(
      () =>
        sink.append(
          fromWorkflowEvent(domain2, {
            competitionScope: { competitionId: COMPETITION_ID },
            sequence: 3,
          })
        ),
      (err) =>
        err instanceof AuditError &&
        err.code === AUDIT_ERROR_CODE.AUDIT_ORDERING_VIOLATION
    );

    const audit2 = fromWorkflowEvent(domain2, {
      competitionScope: { competitionId: COMPETITION_ID },
      sequence: 2,
      causationId: audit1.eventId,
    });
    await sink.append(audit2);
    assert.equal(sink.getEvents().length, 2);
  });

  it("12. query criteria filters by type / correlation / stream", async () => {
    const sink = createInMemoryCompetitionAuditSinkPort();
    const chain = fromWorkflowEventChain(
      [
        sampleWorkflowEvent({
          eventType: WORKFLOW_EVENT_TYPE.TRANSITION_AUTHORIZED,
          sequenceSegment: "1",
        }),
        sampleWorkflowEvent({
          eventType: WORKFLOW_EVENT_TYPE.TRANSITION_COMPLETED,
          sequenceSegment: "2",
        }),
      ],
      { competitionScope: { competitionId: COMPETITION_ID } }
    );
    for (const ev of chain) {
      await sink.append(ev);
    }

    const rows = await sink.query({
      competitionScope: { competitionId: COMPETITION_ID },
      eventTypes: [AUDIT_EVENT_TYPE.WORKFLOW_TRANSITION_COMPLETED],
      correlationId: "corr-1",
    });
    assert.equal(rows.length, 1);
    assert.equal(
      rows[0].eventType,
      AUDIT_EVENT_TYPE.WORKFLOW_TRANSITION_COMPLETED
    );

    const criteria = createAuditQueryCriteria({
      competitionScope: { competitionId: COMPETITION_ID },
      streamKey: chain[0].streamKey,
    });
    const matched = matchAuditQuery(sink.getEvents(), criteria);
    assert.equal(matched.length, 2);
  });

  it("13. null sink is fail-closed; ordering helpers work", async () => {
    const nullSink = createNullCompetitionAuditSinkPort();
    await assert.rejects(() => nullSink.append({}), (err) => err instanceof AuditError);

    assert.equal(
      buildOrderingKey(COMPETITION_ID, "workflow:x"),
      `${COMPETITION_ID}|workflow:x`
    );
    assert.doesNotThrow(() => assertNextSequence(null, 1));
    assert.throws(() => assertNextSequence(1, 3));
  });

  it("14. deterministic event id helper is stable", () => {
    const a = buildCompetitionAuditEventId({
      eventType: AUDIT_EVENT_TYPE.WORKFLOW_FAILED,
      competitionId: COMPETITION_ID,
      streamKey: "workflow:w",
      sequence: 1,
      subjectId: "w",
      occurredAt: OCCURRED_AT,
    });
    const b = buildCompetitionAuditEventId({
      eventType: AUDIT_EVENT_TYPE.WORKFLOW_FAILED,
      competitionId: COMPETITION_ID,
      streamKey: "workflow:w",
      sequence: 1,
      subjectId: "w",
      occurredAt: OCCURRED_AT,
    });
    assert.equal(a, b);
    assert.ok(a.startsWith("competition-audit:"));
  });

  it("15. content fingerprint is deterministic for same envelope", () => {
    const partial = {
      eventType: AUDIT_EVENT_TYPE.WORKFLOW_PAUSED,
      source: CORE19_WORKFLOW_SOURCE,
      occurredAt: OCCURRED_AT,
      competitionScope: { competitionId: COMPETITION_ID },
      streamKey: "workflow:wf-p",
      sequence: 1,
      actor: { actorKind: ACTOR_KIND.SYSTEM },
      subject: { subjectType: SUBJECT_TYPE.WORKFLOW, subjectId: "wf-p" },
      eventId: "fixed-event-id",
    };
    const e1 = createCompetitionAuditEvent(partial);
    const e2 = createCompetitionAuditEvent(partial);
    assert.equal(
      e1.integrityMetadata.contentFingerprint,
      e2.integrityMetadata.contentFingerprint
    );
    assert.equal(
      createAuditContentFingerprint(e1),
      e1.integrityMetadata.contentFingerprint
    );
  });

  it("16. maps all CORE-19 WORKFLOW_EVENT_TYPE values", () => {
    for (const type of Object.values(WORKFLOW_EVENT_TYPE)) {
      const domain = sampleWorkflowEvent({
        eventType: type,
        sequenceSegment: type,
        toStatus: type.includes("FAILED")
          ? "FAILED"
          : type.includes("COMPLETED")
            ? "COMPLETED"
            : type.includes("PAUSED")
              ? "PAUSED"
              : "READY",
        fromStatus: "RUNNING",
      });
      const audit = fromWorkflowEvent(domain, {
        competitionScope: { competitionId: COMPETITION_ID },
        sequence: 1,
      });
      assert.ok(String(audit.eventType).startsWith("WORKFLOW."));
    }
  });

  it("17. audit module does not modify CORE-19 workflow sources", () => {
    const files = listJsFiles(WORKFLOW_ROOT);
    assert.ok(files.length > 0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("competition-core/audit"), false);
      assert.equal(/from\s+['"][^'"]*\/audit(\/|['"])/.test(text), false);
    }
  });

  it("18. audit module does not import Platform Identity auditService", () => {
    const files = listJsFiles(AUDIT_ROOT);
    assert.ok(files.length > 0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("identity/services/auditService"), false);
      assert.equal(/writeAuditLog\s*\(/.test(text), false);
      assert.equal(/from\s+['"][^'"]*identity[^'"]*['"]/.test(text), false);
      assert.equal(/from\s+['"][^'"]*core\/platform[^'"]*['"]/.test(text), false);
    }
    assert.equal(existsSync(IDENTITY_AUDIT), true);
  });

  it("19. competitionScope factory requires competitionId", () => {
    assert.throws(() => createCompetitionScope({}), (err) => err instanceof AuditError);
    const scope = createCompetitionScope({
      competitionId: COMPETITION_ID,
      clubId: "club-1",
    });
    assert.equal(scope.clubId, "club-1");
  });

  it("20. RuntimeAuditEvent is not used as canonical input", () => {
    const files = listJsFiles(AUDIT_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("runtime-control/contracts/auditEvents"), false);
      assert.equal(text.includes("createRuntimeAuditEvent"), false);
    }
  });
});
