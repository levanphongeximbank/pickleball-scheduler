import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SEEDING_ERROR_CODE,
  ENTRY_TYPE,
  ELIGIBILITY_STATUS,
  PRIMARY_ORDERING_SOURCE,
  SORT_DIRECTION,
  MISSING_VALUE_BEHAVIOUR,
  FINALIZATION_STATE,
  LIFECYCLE_ACTION,
  LIFECYCLE_EVENT_TYPE,
  AUTHORIZATION_DECISION,
  MANUAL_OVERRIDE_MODE,
  SEEDING_STATE_TRANSITION_MATRIX,
  getSeedingStateTransitionDecision,
  validateSeedingStateTransition,
  createDraftSeedingResult,
  finalizeSeedingResult,
  supersedeSeedingResult,
  cancelSeedingResult,
  cloneSeedingResultWithLifecycle,
  isSeedingResultRepositoryPort,
  isSeedingLifecycleAuditPort,
  requireSeedingResultRepositoryPort,
  requireSeedingLifecycleAuditPort,
  CORE07_RESULT_REPOSITORY_PORT_VERSION,
  CORE07_LIFECYCLE_AUDIT_PORT_VERSION,
  createSeedingResolver,
  assignSeeds,
} from "../src/features/competition-core/seeding/index.js";
import { createCore07TestFingerprintStub } from "./helpers/core07FingerprintStub.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEEDING_ROOT = path.join(ROOT, "src/features/competition-core/seeding");
const fp = createCore07TestFingerprintStub();

function scope(extra = {}) {
  return {
    competitionId: "comp-1",
    competitionVersionId: null,
    divisionId: "div-open",
    categoryId: null,
    stageId: null,
    entryType: ENTRY_TYPE.ENTRY,
    ...extra,
  };
}

function policy(overrides = {}) {
  return {
    policyId: "pol-1e",
    policyVersion: "1",
    primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RANKING_POSITION,
    sortDirection: SORT_DIRECTION.ASC,
    missingValueBehaviour: MISSING_VALUE_BEHAVIOUR.SORT_LAST,
    tieBreakSequence: [PRIMARY_ORDERING_SOURCE.RATING_VALUE],
    seedNumberStart: 1,
    maximumSeededEntries: null,
    manualOverrideMode: MANUAL_OVERRIDE_MODE.ALLOW_PARTIAL,
    ...overrides,
  };
}

function candidate(id, rank, rating = 1000) {
  return {
    entryId: id,
    subjectRef: { kind: "ENTRY", id },
    entryType: ENTRY_TYPE.ENTRY,
    divisionId: "div-open",
    categoryId: null,
    eligibilityStatus: ELIGIBILITY_STATUS.ELIGIBLE,
    eligibilityReasonCodes: [],
    rankingPosition: rank,
    rankingScore: null,
    ratingValue: rating,
    registrationTimestamp: null,
    sourceMetadata: null,
    stableCanonicalId: id,
  };
}

function draftInput(extra = {}) {
  return {
    scope: scope(),
    candidates: [
      candidate("c", 3, 900),
      candidate("a", 1, 1100),
      candidate("b", 2, 1000),
    ],
    policy: policy(),
    manualOverrides: [],
    rankingRatingSnapshot: {
      snapshotId: "snap-1",
      checksum: "chk-1",
      completenessState: "COMPLETE",
      sourceSystem: "test",
      sourceVersion: "1",
    },
    deterministicContext: {
      effectiveAt: "2026-07-21T12:00:00.000Z",
      comparisonContractVersion: "core07-compare-v1",
    },
    requestId: "req-draft-1",
    resultId: "res-1",
    resultVersion: 1,
    generatedAt: "2026-07-21T12:00:00.000Z",
    fingerprintPort: fp,
    ...extra,
  };
}

function authDecision(action, extra = {}) {
  return {
    decisionId: extra.decisionId || `dec-${action}`,
    decision: extra.decision || AUTHORIZATION_DECISION.ALLOWED,
    lifecycleAction: action,
    actor: extra.actor || { id: "director-1" },
    scope: extra.scope || scope(),
    authorizationPolicyId: extra.authorizationPolicyId || "auth-pol-1",
    authorizationPolicyVersion: extra.authorizationPolicyVersion || "1",
    ...extra,
  };
}

function finalizeRequest(result, extra = {}) {
  return {
    requestId: extra.requestId || "fin-req-1",
    resultId: result.resultId,
    expectedResultVersion: result.resultVersion,
    expectedFingerprint: result.deterministicFingerprint,
    authorizationDecision: authDecision(LIFECYCLE_ACTION.FINALIZE, extra.auth),
    finalizedAt: extra.finalizedAt || "2026-07-21T13:00:00.000Z",
    idempotencyKey: extra.idempotencyKey || "idem-fin-1",
    correlationId: extra.correlationId || "corr-1",
    reason: extra.reason,
    eventId: extra.eventId,
    ...extra,
  };
}

function assignmentMap(result) {
  return result.orderedAssignments.map((a) => `${a.entryId}:${a.seedNumber}`);
}

function createMemoryRepository(seed = {}) {
  /** @type {Map<string, object>} */
  const byId = new Map(seed.byId || []);
  /** @type {Map<string, object>} */
  const authoritative = new Map(seed.authoritative || []);
  return {
    contractVersion: CORE07_RESULT_REPOSITORY_PORT_VERSION,
    findByResultId(resultId) {
      return byId.get(String(resultId)) || null;
    },
    findAuthoritativeByScope(s) {
      const key = `${s.competitionId}|${s.divisionId}|${s.entryType}`;
      return authoritative.get(key) || null;
    },
    saveDraft(result) {
      byId.set(String(result.resultId), result);
      return result;
    },
    saveFinalized(result) {
      byId.set(String(result.resultId), result);
      const key = `${result.scope.competitionId}|${result.scope.divisionId}|${result.scope.entryType}`;
      authoritative.set(key, result);
      return result;
    },
    saveSuperseded(result) {
      byId.set(String(result.resultId), result);
      const key = `${result.scope.competitionId}|${result.scope.divisionId}|${result.scope.entryType}`;
      const current = authoritative.get(key);
      if (current && String(current.resultId) === String(result.resultId)) {
        authoritative.delete(key);
      }
      return result;
    },
    saveCancelled(result) {
      byId.set(String(result.resultId), result);
      return result;
    },
    _authoritative: authoritative,
    _byId: byId,
  };
}

function createMemoryAuditPort() {
  /** @type {object[]} */
  const stored = [];
  return {
    contractVersion: CORE07_LIFECYCLE_AUDIT_PORT_VERSION,
    appendLifecycleEvents(events) {
      stored.push(...events);
      return events;
    },
    _stored: stored,
  };
}

function makeDraft() {
  return createDraftSeedingResult(draftInput());
}

function makeFinalized(extra = {}) {
  const draft = makeDraft();
  return finalizeSeedingResult({
    result: draft,
    request: finalizeRequest(draft, extra),
  }).result;
}

// ─── Transition matrix ──────────────────────────────────────────────────────

test("1E matrix: complete transition matrix statically asserted", () => {
  const expected = {
    "DRAFT->FINALIZED": "ALLOWED",
    "DRAFT->CANCELLED": "ALLOWED",
    "DRAFT->SUPERSEDED": "REJECTED",
    "DRAFT->DRAFT": "REJECTED",
    "FINALIZED->FINALIZED": "IDEMPOTENT_ONLY",
    "FINALIZED->SUPERSEDED": "ALLOWED",
    "FINALIZED->CANCELLED": "REJECTED",
    "FINALIZED->DRAFT": "REJECTED",
    "SUPERSEDED->DRAFT": "REJECTED",
    "SUPERSEDED->FINALIZED": "REJECTED",
    "SUPERSEDED->SUPERSEDED": "REJECTED",
    "SUPERSEDED->CANCELLED": "REJECTED",
    "CANCELLED->DRAFT": "REJECTED",
    "CANCELLED->FINALIZED": "REJECTED",
    "CANCELLED->SUPERSEDED": "REJECTED",
    "CANCELLED->CANCELLED": "REJECTED",
  };
  assert.deepEqual({ ...SEEDING_STATE_TRANSITION_MATRIX }, expected);
  for (const [key, value] of Object.entries(expected)) {
    const [from, to] = key.split("->");
    assert.equal(getSeedingStateTransitionDecision(from, to), value);
  }
});

test("1E matrix: DRAFT → FINALIZED allowed", () => {
  assert.doesNotThrow(() =>
    validateSeedingStateTransition({
      fromState: FINALIZATION_STATE.DRAFT,
      toState: FINALIZATION_STATE.FINALIZED,
    })
  );
});

test("1E matrix: DRAFT → SUPERSEDED rejected", () => {
  assert.throws(
    () =>
      validateSeedingStateTransition({
        fromState: FINALIZATION_STATE.DRAFT,
        toState: FINALIZATION_STATE.SUPERSEDED,
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION
  );
});

test("1E matrix: SUPERSEDED and CANCELLED are terminal", () => {
  for (const from of [
    FINALIZATION_STATE.SUPERSEDED,
    FINALIZATION_STATE.CANCELLED,
  ]) {
    for (const to of Object.values(FINALIZATION_STATE)) {
      assert.throws(
        () => validateSeedingStateTransition({ fromState: from, toState: to }),
        (err) =>
          err.code === SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION ||
          err.code === SEEDING_ERROR_CODE.RESULT_FINALIZED
      );
    }
  }
});

// ─── Finalization ───────────────────────────────────────────────────────────

test("1E finalize: valid DRAFT finalizes; assignments and fingerprint unchanged", () => {
  const draft = makeDraft();
  const beforeAssign = assignmentMap(draft);
  const beforeFp = draft.deterministicFingerprint;
  const out = finalizeSeedingResult({
    result: draft,
    request: finalizeRequest(draft),
  });
  assert.equal(out.result.finalizationState, FINALIZATION_STATE.FINALIZED);
  assert.equal(out.transition.idempotent, false);
  assert.deepEqual(assignmentMap(out.result), beforeAssign);
  assert.equal(out.result.deterministicFingerprint, beforeFp);
  assert.equal(out.events[0].eventType, LIFECYCLE_EVENT_TYPE.RESULT_FINALIZED);
  assert.equal(out.events[0].previousState, FINALIZATION_STATE.DRAFT);
  assert.equal(out.events[0].nextState, FINALIZATION_STATE.FINALIZED);
  assert.equal(draft.finalizationState, FINALIZATION_STATE.DRAFT);
});

test("1E finalize: finalizedAt required", () => {
  const draft = makeDraft();
  const req = finalizeRequest(draft);
  delete req.finalizedAt;
  assert.throws(
    () => finalizeSeedingResult({ result: draft, request: req }),
    (err) => err.code === SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT
  );
});

test("1E finalize: missing / denied / scope-mismatched authorization fails", () => {
  const draft = makeDraft();
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: { ...finalizeRequest(draft), authorizationDecision: null },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED
  );
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: finalizeRequest(draft, {
          auth: { decision: AUTHORIZATION_DECISION.DENIED },
        }),
      }),
    (err) => err.code === SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED
  );
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: finalizeRequest(draft, {
          auth: { scope: scope({ competitionId: "other-comp" }) },
        }),
      }),
    (err) => err.code === SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED
  );
});

test("1E finalize: resultId / version / fingerprint mismatch fails", () => {
  const draft = makeDraft();
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: { ...finalizeRequest(draft), resultId: "wrong" },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_REQUEST
  );
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: { ...finalizeRequest(draft), expectedResultVersion: 99 },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.RESULT_VERSION_MISMATCH
  );
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: {
          ...finalizeRequest(draft),
          expectedFingerprint: "wrong-fp",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.RESULT_FINGERPRINT_MISMATCH
  );
});

test("1E finalize: missing policy or snapshot provenance fails", () => {
  const draft = makeDraft();
  const noPolicy = cloneSeedingResultWithLifecycle(draft, {
    finalizationState: FINALIZATION_STATE.DRAFT,
    policyProvenance: {},
  });
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: noPolicy,
        request: finalizeRequest(noPolicy),
      }),
    (err) => err.code === SEEDING_ERROR_CODE.POLICY_REQUIRED
  );
  const noSnap = cloneSeedingResultWithLifecycle(draft, {
    finalizationState: FINALIZATION_STATE.DRAFT,
    snapshotProvenance: null,
  });
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: noSnap,
        request: finalizeRequest(noSnap),
      }),
    (err) => err.code === SEEDING_ERROR_CODE.SNAPSHOT_REQUIRED
  );
});

test("1E finalize: caller input unchanged; output immutable", () => {
  const draft = makeDraft();
  const snap = JSON.stringify(draft);
  const out = finalizeSeedingResult({
    result: draft,
    request: finalizeRequest(draft),
  });
  assert.equal(JSON.stringify(draft), snap);
  assert.throws(() => {
    out.result.finalizationState = FINALIZATION_STATE.DRAFT;
  });
  assert.throws(() => {
    out.result.orderedAssignments.push({ entryId: "x", seedNumber: 9 });
  });
  assert.throws(() => {
    out.events.push({});
  });
});

// ─── Idempotency ────────────────────────────────────────────────────────────

test("1E idempotency: identical request same logical result; no new appendable event", () => {
  const draft = makeDraft();
  const req = finalizeRequest(draft);
  const audit = createMemoryAuditPort();
  let appendCalls = 0;
  const countingAudit = {
    contractVersion: CORE07_LIFECYCLE_AUDIT_PORT_VERSION,
    appendLifecycleEvents(events) {
      appendCalls += 1;
      return audit.appendLifecycleEvents(events);
    },
    get _stored() {
      return audit._stored;
    },
  };

  const first = finalizeSeedingResult({
    result: draft,
    request: req,
    auditPort: countingAudit,
  });
  assert.equal(first.transition.idempotent, false);
  assert.equal(first.eventsToAppend.length, 1);
  assert.equal(first.lifecycleEvents.length, 1);
  assert.equal(appendCalls, 1);
  assert.equal(countingAudit._stored.length, 1);
  const priorJson = JSON.stringify(first.result);
  const priorEventId = first.lifecycleEvents[0].eventId;
  const storedSnap = JSON.stringify(countingAudit._stored);

  const second = finalizeSeedingResult({
    result: first.result,
    request: req,
    auditPort: countingAudit,
  });
  assert.equal(second.transition.idempotent, true);
  assert.equal(second.eventsToAppend.length, 0);
  assert.equal(second.lifecycleEvents.length, 1);
  assert.equal(second.lifecycleEvents[0].eventId, priorEventId);
  assert.equal(
    second.lifecycleEvents[0].eventType,
    LIFECYCLE_EVENT_TYPE.RESULT_FINALIZED
  );
  assert.equal(appendCalls, 1);
  assert.equal(countingAudit._stored.length, 1);
  assert.equal(JSON.stringify(countingAudit._stored), storedSnap);
  assert.equal(JSON.stringify(first.result), priorJson);
  assert.deepEqual(
    assignmentMap(second.result),
    assignmentMap(first.result)
  );
  assert.equal(
    second.result.deterministicFingerprint,
    first.result.deterministicFingerprint
  );
});

test("1E idempotency: different fingerprint / version / key / auth fail or distinct", () => {
  const draft = makeDraft();
  const first = finalizeSeedingResult({
    result: draft,
    request: finalizeRequest(draft),
  });
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: first.result,
        request: {
          ...finalizeRequest(first.result),
          expectedFingerprint: "other",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.RESULT_FINGERPRINT_MISMATCH
  );
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: first.result,
        request: {
          ...finalizeRequest(first.result),
          expectedResultVersion: 2,
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.RESULT_VERSION_MISMATCH
  );
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: first.result,
        request: {
          ...finalizeRequest(first.result),
          idempotencyKey: "different-key",
          requestId: "fin-req-other",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.RESULT_FINALIZED
  );
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: first.result,
        request: finalizeRequest(first.result, {
          auth: { decisionId: "dec-other-actor" },
        }),
      }),
    (err) => err.code === SEEDING_ERROR_CODE.RESULT_FINALIZED
  );
});

test("1E authoritative: finalize with no authoritative result succeeds", () => {
  const draft = makeDraft();
  const repo = createMemoryRepository();
  const out = finalizeSeedingResult({
    result: draft,
    request: finalizeRequest(draft),
    repositoryPort: repo,
  });
  assert.equal(out.result.finalizationState, FINALIZATION_STATE.FINALIZED);
  assert.equal(out.eventsToAppend.length, 1);
});

test("1E authoritative: finalize rejects different authoritative result", () => {
  const draft = makeDraft();
  const repo = createMemoryRepository();
  const other = {
    resultId: "other-auth",
    resultVersion: 9,
    finalizationState: FINALIZATION_STATE.FINALIZED,
    scope: scope(),
    deterministicFingerprint: "fp-other",
  };
  repo._authoritative.set("comp-1|div-open|ENTRY", other);
  const otherSnap = JSON.stringify(other);
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: finalizeRequest(draft),
        repositoryPort: repo,
      }),
    (err) => err.code === SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_CONFLICT
  );
  assert.equal(JSON.stringify(other), otherSnap);
});

test("1E authoritative: supersede accepts previous as current authoritative", () => {
  const prior = makeFinalized();
  const draft2 = createDraftSeedingResult(
    draftInput({ resultId: "res-2", resultVersion: 2, requestId: "r2" })
  );
  const replacement = cloneSeedingResultWithLifecycle(
    finalizeSeedingResult({
      result: draft2,
      request: finalizeRequest(draft2, {
        requestId: "fin-2",
        idempotencyKey: "idem-2",
      }),
    }).result,
    {
      finalizationState: FINALIZATION_STATE.FINALIZED,
      supersededResultId: prior.resultId,
    }
  );

  // Distinct object reference with same identity fields as prior.
  const authoritativeClone = {
    resultId: prior.resultId,
    resultVersion: prior.resultVersion,
    finalizationState: FINALIZATION_STATE.FINALIZED,
    scope: { ...prior.scope },
    deterministicFingerprint: prior.deterministicFingerprint,
  };
  assert.notEqual(authoritativeClone, prior);

  const repo = createMemoryRepository();
  repo._authoritative.set("comp-1|div-open|ENTRY", authoritativeClone);
  const authSnap = JSON.stringify(authoritativeClone);

  const out = supersedeSeedingResult({
    priorResult: prior,
    replacementResult: replacement,
    repositoryPort: repo,
    request: {
      requestId: "sup-auth-ok",
      priorResultId: prior.resultId,
      replacementResultId: replacement.resultId,
      authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
      supersededAt: "2026-07-21T16:00:00.000Z",
      idempotencyKey: "idem-sup-auth",
    },
  });
  assert.equal(out.result.finalizationState, FINALIZATION_STATE.SUPERSEDED);
  assert.equal(out.result.supersededByResultId, replacement.resultId);
  assert.equal(JSON.stringify(authoritativeClone), authSnap);
});

test("1E authoritative: supersede rejects third result; other-scope fails closed", () => {
  const prior = makeFinalized();
  const draft2 = createDraftSeedingResult(
    draftInput({ resultId: "res-2", resultVersion: 2, requestId: "r2" })
  );
  const replacement = cloneSeedingResultWithLifecycle(
    finalizeSeedingResult({
      result: draft2,
      request: finalizeRequest(draft2, {
        requestId: "fin-2",
        idempotencyKey: "idem-2",
      }),
    }).result,
    {
      finalizationState: FINALIZATION_STATE.FINALIZED,
      supersededResultId: prior.resultId,
    }
  );

  const conflictRepo = createMemoryRepository();
  conflictRepo._authoritative.set("comp-1|div-open|ENTRY", {
    resultId: "third-party",
    resultVersion: 7,
    finalizationState: FINALIZATION_STATE.FINALIZED,
    scope: scope(),
    deterministicFingerprint: "fp-third",
  });
  assert.throws(
    () =>
      supersedeSeedingResult({
        priorResult: prior,
        replacementResult: replacement,
        repositoryPort: conflictRepo,
        request: {
          requestId: "s-third",
          priorResultId: prior.resultId,
          replacementResultId: replacement.resultId,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
          supersededAt: "2026-07-21T16:00:00.000Z",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_CONFLICT
  );

  const scopeRepo = createMemoryRepository();
  scopeRepo.findAuthoritativeByScope = () => ({
    resultId: prior.resultId,
    resultVersion: prior.resultVersion,
    finalizationState: FINALIZATION_STATE.FINALIZED,
    scope: scope({ competitionId: "other-comp" }),
    deterministicFingerprint: prior.deterministicFingerprint,
  });
  assert.throws(
    () =>
      supersedeSeedingResult({
        priorResult: prior,
        replacementResult: replacement,
        repositoryPort: scopeRepo,
        request: {
          requestId: "s-scope",
          priorResultId: prior.resultId,
          replacementResultId: replacement.resultId,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
          supersededAt: "2026-07-21T16:00:00.000Z",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_CONFLICT
  );
});

test("1E authoritative: object-key order does not affect conflict decision", () => {
  const prior = makeFinalized();
  const draft2 = createDraftSeedingResult(
    draftInput({ resultId: "res-2", resultVersion: 2, requestId: "r2" })
  );
  const replacement = cloneSeedingResultWithLifecycle(
    finalizeSeedingResult({
      result: draft2,
      request: finalizeRequest(draft2, {
        requestId: "fin-2",
        idempotencyKey: "idem-2",
      }),
    }).result,
    {
      finalizationState: FINALIZATION_STATE.FINALIZED,
      supersededResultId: prior.resultId,
    }
  );
  const repo = createMemoryRepository();
  repo._authoritative.set("comp-1|div-open|ENTRY", {
    deterministicFingerprint: prior.deterministicFingerprint,
    scope: scope(),
    finalizationState: FINALIZATION_STATE.FINALIZED,
    resultVersion: prior.resultVersion,
    resultId: prior.resultId,
  });
  const a = supersedeSeedingResult({
    priorResult: prior,
    replacementResult: replacement,
    repositoryPort: repo,
    request: {
      supersededAt: "2026-07-21T16:00:00.000Z",
      requestId: "s-order-auth",
      priorResultId: prior.resultId,
      replacementResultId: replacement.resultId,
      authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
      idempotencyKey: "idem-order-auth",
    },
  });
  const b = supersedeSeedingResult({
    priorResult: prior,
    replacementResult: replacement,
    repositoryPort: repo,
    request: {
      authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
      replacementResultId: replacement.resultId,
      priorResultId: prior.resultId,
      idempotencyKey: "idem-order-auth",
      requestId: "s-order-auth",
      supersededAt: "2026-07-21T16:00:00.000Z",
    },
  });
  assert.equal(a.eventsToAppend[0].eventId, b.eventsToAppend[0].eventId);
  assert.equal(a.result.supersededByResultId, b.result.supersededByResultId);
});

test("1E matrix: FINALIZED → non-idempotent FINALIZED rejected", () => {
  const finalized = makeFinalized();
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: finalized,
        request: {
          ...finalizeRequest(finalized),
          idempotencyKey: "brand-new",
          requestId: "brand-new-req",
          auth: { decisionId: "dec-other" },
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.RESULT_FINALIZED
  );
});

// ─── Cancellation ───────────────────────────────────────────────────────────

test("1E cancel: valid DRAFT cancellation preserves assignments/fingerprint", () => {
  const draft = makeDraft();
  const before = assignmentMap(draft);
  const fpBefore = draft.deterministicFingerprint;
  const out = cancelSeedingResult({
    result: draft,
    request: {
      requestId: "cancel-1",
      resultId: draft.resultId,
      expectedResultVersion: draft.resultVersion,
      expectedFingerprint: draft.deterministicFingerprint,
      authorizationDecision: authDecision(LIFECYCLE_ACTION.CANCEL),
      cancelledAt: "2026-07-21T14:00:00.000Z",
      reason: "abandoned-draft",
      idempotencyKey: "idem-cancel-1",
    },
  });
  assert.equal(out.result.finalizationState, FINALIZATION_STATE.CANCELLED);
  assert.deepEqual(assignmentMap(out.result), before);
  assert.equal(out.result.deterministicFingerprint, fpBefore);
  assert.equal(out.events[0].eventType, LIFECYCLE_EVENT_TYPE.RESULT_CANCELLED);
  assert.equal(out.result.cancellationReason, "abandoned-draft");
  assert.equal(draft.finalizationState, FINALIZATION_STATE.DRAFT);
  assert.throws(() => {
    out.result.finalizationState = FINALIZATION_STATE.DRAFT;
  });
});

test("1E cancel: reason and authorization required; FINALIZED rejected", () => {
  const draft = makeDraft();
  assert.throws(
    () =>
      cancelSeedingResult({
        result: draft,
        request: {
          requestId: "c1",
          resultId: draft.resultId,
          expectedResultVersion: draft.resultVersion,
          expectedFingerprint: draft.deterministicFingerprint,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.CANCEL),
          cancelledAt: "2026-07-21T14:00:00.000Z",
          reason: "",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_REQUEST
  );
  assert.throws(
    () =>
      cancelSeedingResult({
        result: draft,
        request: {
          requestId: "c2",
          resultId: draft.resultId,
          expectedResultVersion: draft.resultVersion,
          expectedFingerprint: draft.deterministicFingerprint,
          authorizationDecision: null,
          cancelledAt: "2026-07-21T14:00:00.000Z",
          reason: "x",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED
  );
  const finalized = makeFinalized();
  assert.throws(
    () =>
      cancelSeedingResult({
        result: finalized,
        request: {
          requestId: "c3",
          resultId: finalized.resultId,
          expectedResultVersion: finalized.resultVersion,
          expectedFingerprint: finalized.deterministicFingerprint,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.CANCEL),
          cancelledAt: "2026-07-21T14:00:00.000Z",
          reason: "should-fail",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.RESULT_FINALIZED
  );
});

test("1E cancel: terminal-state cancellation rejected", () => {
  const draft = makeDraft();
  const cancelled = cancelSeedingResult({
    result: draft,
    request: {
      requestId: "c4",
      resultId: draft.resultId,
      expectedResultVersion: draft.resultVersion,
      expectedFingerprint: draft.deterministicFingerprint,
      authorizationDecision: authDecision(LIFECYCLE_ACTION.CANCEL),
      cancelledAt: "2026-07-21T14:00:00.000Z",
      reason: "done",
    },
  }).result;
  assert.throws(
    () =>
      cancelSeedingResult({
        result: cancelled,
        request: {
          requestId: "c5",
          resultId: cancelled.resultId,
          expectedResultVersion: cancelled.resultVersion,
          expectedFingerprint: cancelled.deterministicFingerprint,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.CANCEL),
          cancelledAt: "2026-07-21T15:00:00.000Z",
          reason: "again",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION
  );
});

// ─── Superseding ────────────────────────────────────────────────────────────

test("1E supersede: valid replacement marks prior SUPERSEDED", () => {
  const prior = makeFinalized();
  const priorAssign = assignmentMap(prior);
  const priorFp = prior.deterministicFingerprint;

  const draft2 = createDraftSeedingResult(
    draftInput({
      requestId: "req-draft-2",
      resultId: "res-2",
      resultVersion: 2,
      rankingRatingSnapshot: {
        snapshotId: "snap-2",
        checksum: "chk-2",
        completenessState: "COMPLETE",
        sourceSystem: "test",
        sourceVersion: "2",
      },
    })
  );
  const replacement = cloneSeedingResultWithLifecycle(
    finalizeSeedingResult({
      result: draft2,
      request: finalizeRequest(draft2, {
        requestId: "fin-req-2",
        idempotencyKey: "idem-fin-2",
      }),
    }).result,
    {
      finalizationState: FINALIZATION_STATE.FINALIZED,
      supersededResultId: prior.resultId,
    }
  );

  const priorJson = JSON.stringify(prior);
  const replJson = JSON.stringify(replacement);
  const out = supersedeSeedingResult({
    priorResult: prior,
    replacementResult: replacement,
    request: {
      requestId: "sup-1",
      priorResultId: prior.resultId,
      replacementResultId: replacement.resultId,
      authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
      supersededAt: "2026-07-21T16:00:00.000Z",
      idempotencyKey: "idem-sup-1",
    },
  });

  assert.equal(out.result.finalizationState, FINALIZATION_STATE.SUPERSEDED);
  assert.equal(out.result.supersededByResultId, replacement.resultId);
  assert.deepEqual(assignmentMap(out.result), priorAssign);
  assert.equal(out.result.deterministicFingerprint, priorFp);
  assert.equal(out.events[0].eventType, LIFECYCLE_EVENT_TYPE.RESULT_SUPERSEDED);
  assert.equal(JSON.stringify(prior), priorJson);
  assert.equal(JSON.stringify(replacement), replJson);
  assert.throws(() => {
    out.result.finalizationState = FINALIZATION_STATE.FINALIZED;
  });
});

test("1E supersede: preconditions fail closed", () => {
  const prior = makeFinalized();
  const draft2 = createDraftSeedingResult(
    draftInput({ resultId: "res-2", resultVersion: 2, requestId: "r2" })
  );
  const replacementDraftState = draft2;
  assert.throws(
    () =>
      supersedeSeedingResult({
        priorResult: prior,
        replacementResult: replacementDraftState,
        request: {
          requestId: "s1",
          priorResultId: prior.resultId,
          replacementResultId: draft2.resultId,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
          supersededAt: "2026-07-21T16:00:00.000Z",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION
  );

  const draftPrior = makeDraft();
  const replacement = cloneSeedingResultWithLifecycle(makeFinalized(), {
    finalizationState: FINALIZATION_STATE.FINALIZED,
    resultId: "res-2",
    resultVersion: 2,
    supersededResultId: prior.resultId,
  });
  assert.throws(
    () =>
      supersedeSeedingResult({
        priorResult: draftPrior,
        replacementResult: replacement,
        request: {
          requestId: "s2",
          priorResultId: draftPrior.resultId,
          replacementResultId: replacement.resultId,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
          supersededAt: "2026-07-21T16:00:00.000Z",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INVALID_STATE_TRANSITION
  );

  const replNoRef = makeFinalized();
  const repl2 = cloneSeedingResultWithLifecycle(replNoRef, {
    finalizationState: FINALIZATION_STATE.FINALIZED,
    resultId: "res-x",
    resultVersion: 2,
  });
  assert.throws(
    () =>
      supersedeSeedingResult({
        priorResult: prior,
        replacementResult: repl2,
        request: {
          requestId: "s3",
          priorResultId: prior.resultId,
          replacementResultId: repl2.resultId,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
          supersededAt: "2026-07-21T16:00:00.000Z",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.SUPERSEDE_REFERENCE_REQUIRED
  );

  const scopeMismatch = cloneSeedingResultWithLifecycle(makeFinalized(), {
    finalizationState: FINALIZATION_STATE.FINALIZED,
    resultId: "res-scope",
    resultVersion: 2,
    scope: scope({ competitionId: "other" }),
    supersededResultId: prior.resultId,
  });
  assert.throws(
    () =>
      supersedeSeedingResult({
        priorResult: prior,
        replacementResult: scopeMismatch,
        request: {
          requestId: "s4",
          priorResultId: prior.resultId,
          replacementResultId: scopeMismatch.resultId,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE, {
            scope: scope(),
          }),
          supersededAt: "2026-07-21T16:00:00.000Z",
        },
      }),
    (err) =>
      err.code === SEEDING_ERROR_CODE.SUPERSEDE_SCOPE_MISMATCH ||
      err.code === SEEDING_ERROR_CODE.FINALIZATION_UNAUTHORIZED
  );
});

test("1E supersede: authoritative conflict fails closed; key order irrelevant", () => {
  const prior = makeFinalized();
  const draft2 = createDraftSeedingResult(
    draftInput({ resultId: "res-2", resultVersion: 2, requestId: "r2" })
  );
  const replacement = cloneSeedingResultWithLifecycle(
    finalizeSeedingResult({
      result: draft2,
      request: finalizeRequest(draft2, {
        requestId: "fin-2",
        idempotencyKey: "idem-2",
      }),
    }).result,
    {
      finalizationState: FINALIZATION_STATE.FINALIZED,
      supersededResultId: prior.resultId,
    }
  );

  const conflictRepo = createMemoryRepository();
  conflictRepo._authoritative.set("comp-1|div-open|ENTRY", {
    resultId: "other-auth",
    finalizationState: FINALIZATION_STATE.FINALIZED,
    scope: scope(),
  });
  assert.throws(
    () =>
      supersedeSeedingResult({
        priorResult: prior,
        replacementResult: replacement,
        repositoryPort: conflictRepo,
        request: {
          requestId: "s-conflict",
          priorResultId: prior.resultId,
          replacementResultId: replacement.resultId,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
          supersededAt: "2026-07-21T16:00:00.000Z",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_CONFLICT
  );

  const reqA = {
    supersededAt: "2026-07-21T16:00:00.000Z",
    requestId: "s-order",
    priorResultId: prior.resultId,
    replacementResultId: replacement.resultId,
    authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
    idempotencyKey: "idem-order",
  };
  const reqB = {
    authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
    replacementResultId: replacement.resultId,
    priorResultId: prior.resultId,
    idempotencyKey: "idem-order",
    requestId: "s-order",
    supersededAt: "2026-07-21T16:00:00.000Z",
  };
  const a = supersedeSeedingResult({
    priorResult: prior,
    replacementResult: replacement,
    request: reqA,
  });
  const b = supersedeSeedingResult({
    priorResult: prior,
    replacementResult: replacement,
    request: reqB,
  });
  assert.equal(a.events[0].eventId, b.events[0].eventId);
  assert.equal(a.result.finalizationState, b.result.finalizationState);
  assert.equal(a.result.supersededByResultId, b.result.supersededByResultId);
});

test("1E supersede: supersededAt required", () => {
  const prior = makeFinalized();
  const replacement = cloneSeedingResultWithLifecycle(makeFinalized(), {
    finalizationState: FINALIZATION_STATE.FINALIZED,
    resultId: "res-2",
    resultVersion: 2,
    supersededResultId: prior.resultId,
  });
  assert.throws(
    () =>
      supersedeSeedingResult({
        priorResult: prior,
        replacementResult: replacement,
        request: {
          requestId: "s-missing-at",
          priorResultId: prior.resultId,
          replacementResultId: replacement.resultId,
          authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT
  );
});

// ─── Ports ──────────────────────────────────────────────────────────────────

test("1E ports: repository and audit contracts; failures map correctly", () => {
  assert.equal(
    isSeedingResultRepositoryPort(createMemoryRepository()),
    true
  );
  assert.equal(isSeedingResultRepositoryPort({}), false);
  assert.throws(
    () => requireSeedingResultRepositoryPort(null, true),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );
  assert.throws(
    () => requireSeedingResultRepositoryPort({ contractVersion: "x" }, true),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );

  const draft = makeDraft();
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: finalizeRequest(draft),
        requireRepositoryPort: true,
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );

  const throwingRepo = {
    ...createMemoryRepository(),
    findAuthoritativeByScope() {
      throw new Error("boom");
    },
  };
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: finalizeRequest(draft),
        repositoryPort: throwingRepo,
        checkAuthoritativeConflict: true,
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );

  assert.equal(isSeedingLifecycleAuditPort(createMemoryAuditPort()), true);
  assert.throws(
    () => requireSeedingLifecycleAuditPort(null, true),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );

  const throwingAudit = {
    contractVersion: CORE07_LIFECYCLE_AUDIT_PORT_VERSION,
    appendLifecycleEvents() {
      throw new Error("audit-down");
    },
  };
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: finalizeRequest(draft),
        auditPort: throwingAudit,
        requireAuditPort: true,
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );

  const badAudit = {
    contractVersion: CORE07_LIFECYCLE_AUDIT_PORT_VERSION,
    appendLifecycleEvents() {
      return [{ noEventId: true }];
    },
  };
  assert.throws(
    () =>
      finalizeSeedingResult({
        result: draft,
        request: finalizeRequest(draft),
        auditPort: badAudit,
        requireAuditPort: true,
      }),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );
});

test("1E ports: no hidden current time in finalize path", () => {
  const draft = makeDraft();
  const src = readFileSync(
    path.join(SEEDING_ROOT, "services/finalizeSeedingResult.js"),
    "utf8"
  );
  assert.equal(src.includes("Date.now"), false);
  assert.equal(src.includes("new Date("), false);
  const out = finalizeSeedingResult({
    result: draft,
    request: finalizeRequest(draft, {
      finalizedAt: "2020-01-01T00:00:00.000Z",
    }),
  });
  assert.equal(out.result.finalizedAt.value, "2020-01-01T00:00:00.000Z");
});

// ─── Boundaries ─────────────────────────────────────────────────────────────

test("1E boundary: no UI/Supabase/CORE-08/CORE-09/draw imports; root inactive; 3G preserved", () => {
  function walk(dir, acc = []) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full, acc);
      else if (name.endsWith(".js")) acc.push(full);
    }
    return acc;
  }
  const importRe =
    /(?:import|from)\s+['"][^'"]*(supabase|@mui|react|draw-runtime|match-generation|core-08|core-09|teamGroupSeedEngine|seedEngine|node:crypto)[^'"]*['"]/i;
  for (const file of walk(SEEDING_ROOT)) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      importRe.test(text),
      false,
      `${path.relative(ROOT, file)} has forbidden import`
    );
  }

  const rootIndex = path.join(
    ROOT,
    "src/features/competition-core/index.js"
  );
  assert.equal(existsSync(rootIndex), true);
  const rootText = readFileSync(rootIndex, "utf8");
  assert.equal(rootText.includes("competition-core/seeding"), false);
  assert.equal(/from\s+['"]\.\/seeding/.test(rootText), false);

  const resolver = createSeedingResolver();
  assert.equal(typeof resolver.resolve, "function");
  assert.equal(typeof assignSeeds, "function");
});

test("1E determinism: two full lifecycle runs identical", () => {
  function runOnce() {
    const draft = makeDraft();
    const finalized = finalizeSeedingResult({
      result: draft,
      request: finalizeRequest(draft),
    });
    const draft2 = createDraftSeedingResult(
      draftInput({ resultId: "res-2", resultVersion: 2, requestId: "r2" })
    );
    const replacement = cloneSeedingResultWithLifecycle(
      finalizeSeedingResult({
        result: draft2,
        request: finalizeRequest(draft2, {
          requestId: "fin-2",
          idempotencyKey: "idem-2",
        }),
      }).result,
      {
        finalizationState: FINALIZATION_STATE.FINALIZED,
        supersededResultId: finalized.result.resultId,
      }
    );
    const superseded = supersedeSeedingResult({
      priorResult: finalized.result,
      replacementResult: replacement,
      request: {
        requestId: "sup-det",
        priorResultId: finalized.result.resultId,
        replacementResultId: replacement.resultId,
        authorizationDecision: authDecision(LIFECYCLE_ACTION.SUPERSEDE),
        supersededAt: "2026-07-21T16:00:00.000Z",
        idempotencyKey: "idem-sup-det",
      },
    });
    return {
      finalizeState: finalized.result.finalizationState,
      finalizeEventId: finalized.events[0].eventId,
      supersedeState: superseded.result.finalizationState,
      supersedeEventId: superseded.events[0].eventId,
      supersededBy: superseded.result.supersededByResultId,
      fingerprint: superseded.result.deterministicFingerprint,
      assignments: assignmentMap(superseded.result),
    };
  }
  assert.deepEqual(runOnce(), runOnce());
});
