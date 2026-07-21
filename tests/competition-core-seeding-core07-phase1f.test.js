import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  SEEDING_ERROR_CODE,
  ENTRY_TYPE,
  ELIGIBILITY_STATUS,
  PRIMARY_ORDERING_SOURCE,
  SORT_DIRECTION,
  MISSING_VALUE_BEHAVIOUR,
  FINALIZATION_STATE,
  LIFECYCLE_ACTION,
  AUTHORIZATION_DECISION,
  MANUAL_OVERRIDE_MODE,
  createSeedingIntegrationFacade,
  projectAuthoritativeSeedingResult,
  mapAuthoritativeProjectionToDrawSeedRanking,
  compareLegacyAndCanonicalSeeding,
  createSeedingResolver,
  assignSeeds,
  createDraftSeedingResult,
  finalizeSeedingResult,
  supersedeSeedingResult,
  cancelSeedingResult,
} from "../src/features/competition-core/seeding/index.js";

import {
  createMemorySeedingResultRepository,
  createMemorySeedingLifecycleAudit,
} from "../src/features/competition-core/seeding/adapters/memory/index.js";

import {
  createEligibilityDecisionPortStub,
  createRuleEvaluationPortStub,
  createSnapshotProviderPortStub,
  createFingerprintPortStub,
} from "../src/features/competition-core/seeding/adapters/testing/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEEDING_ROOT = path.join(ROOT, "src/features/competition-core/seeding");
const require = createRequire(import.meta.url);

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

function policy(extra = {}) {
  return {
    policyId: "pol-1f",
    policyVersion: "1",
    primaryOrderingSource: PRIMARY_ORDERING_SOURCE.RANKING_POSITION,
    sortDirection: SORT_DIRECTION.ASC,
    missingValueBehaviour: MISSING_VALUE_BEHAVIOUR.SORT_LAST,
    tieBreakSequence: [PRIMARY_ORDERING_SOURCE.RATING_VALUE],
    seedNumberStart: 1,
    maximumSeededEntries: null,
    manualOverrideMode: MANUAL_OVERRIDE_MODE.ALLOW_PARTIAL,
    ...extra,
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

function auth(action = LIFECYCLE_ACTION.FINALIZE, extra = {}) {
  return {
    decisionId: extra.decisionId || `dec-${action}`,
    decision: AUTHORIZATION_DECISION.ALLOWED,
    lifecycleAction: action,
    actor: { id: "director-1", secretToken: "do-not-leak" },
    scope: scope(),
    authorizationPolicyId: "auth-pol",
    authorizationPolicyVersion: "1",
    ...extra,
  };
}

function eligibilityMap(entries) {
  /** @type {Record<string, object>} */
  const out = {};
  for (const [id, status] of Object.entries(entries)) {
    out[id] = {
      decisionId: `elig-${id}`,
      entryId: id,
      status,
      reasonCodes: status === ELIGIBILITY_STATUS.INELIGIBLE ? ["X"] : [],
      decisionVersion: "1",
      policyOrRuleProvenance: "elig-pol-v1",
      evaluatedAt: "2026-07-21T12:00:00.000Z",
      sourceModule: "test-eligibility",
      sourceVersion: "1",
      scope: scope(),
    };
  }
  return out;
}

function defaultSnapshot(extra = {}) {
  return {
    snapshotId: "snap-1f",
    sourceSystem: "test",
    sourceVersion: "1",
    capturedAt: "2026-07-21T11:00:00.000Z",
    effectiveAt: "2026-07-21T12:00:00.000Z",
    subjectValues: [
      { entryId: "a", rankingPosition: 1, ratingValue: 1100 },
      { entryId: "b", rankingPosition: 2, ratingValue: 1000 },
      { entryId: "c", rankingPosition: 3, ratingValue: 900 },
    ],
    completenessState: "COMPLETE",
    checksum: "chk-1f",
    scopeRef: scope(),
    ...extra,
  };
}

function buildFacade(extraPorts = {}) {
  const fingerprintPort = createFingerprintPortStub();
  const eligibilityPort = createEligibilityDecisionPortStub({
    decisionsByEntryId: eligibilityMap({
      a: ELIGIBILITY_STATUS.ELIGIBLE,
      b: ELIGIBILITY_STATUS.ELIGIBLE,
      c: ELIGIBILITY_STATUS.ELIGIBLE,
    }),
  });
  const snapshotProviderPort = createSnapshotProviderPortStub({
    snapshot: defaultSnapshot(),
  });
  const repositoryPort = createMemorySeedingResultRepository();
  const auditPort = createMemorySeedingLifecycleAudit();
  return {
    facade: createSeedingIntegrationFacade({
      defaultPorts: {
        fingerprintPort,
        eligibilityPort,
        snapshotProviderPort,
        repositoryPort,
        auditPort,
        ...extraPorts,
      },
    }),
    fingerprintPort,
    eligibilityPort,
    snapshotProviderPort,
    repositoryPort,
    auditPort,
  };
}

function draftRequest(extra = {}) {
  return {
    requestId: "req-1f",
    resultId: "res-1f",
    resultVersion: 1,
    seedingScope: scope(),
    candidates: [
      candidate("c", 3, 900),
      candidate("a", 1, 1100),
      candidate("b", 2, 1000),
    ],
    policy: policy(),
    deterministicContext: {
      effectiveAt: "2026-07-21T12:00:00.000Z",
      comparisonContractVersion: "core07-compare-v1",
    },
    generatedAt: "2026-07-21T12:00:00.000Z",
    ...extra,
  };
}

function assignmentMap(result) {
  return result.orderedAssignments.map((a) => `${a.entryId}:${a.seedNumber}`);
}

function walkJs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkJs(full, acc);
    else if (name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

function readSeeding(rel) {
  return readFileSync(path.join(SEEDING_ROOT, rel), "utf8");
}

// ─── Condition 1: canonical export boundary ─────────────────────────────────

test("1F export boundary: canonical barrel excludes memory/testing; subpaths work; no fallback", () => {
  const barrel = readSeeding("index.js");
  assert.equal(barrel.includes("createMemorySeedingResultRepository"), false);
  assert.equal(barrel.includes("createMemorySeedingLifecycleAudit"), false);
  assert.equal(barrel.includes("createEligibilityDecisionPortStub"), false);
  assert.equal(barrel.includes("createRuleEvaluationPortStub"), false);
  assert.equal(barrel.includes("createSnapshotProviderPortStub"), false);
  assert.equal(barrel.includes("createFingerprintPortStub"), false);
  assert.equal(
    /export\s*\{[^}]*createMemorySeeding/s.test(barrel) ||
      /from\s+['"]\.\/adapters\/memory/.test(barrel),
    false
  );
  assert.equal(
    /export\s*\{[^}]*createEligibilityDecisionPortStub/s.test(barrel) ||
      /from\s+['"]\.\/adapters\/testing/.test(barrel),
    false
  );

  const adaptersBarrel = readSeeding("adapters/index.js");
  assert.equal(/from\s+['"]\.\/memory\//.test(adaptersBarrel), false);
  assert.equal(/from\s+['"]\.\/testing\//.test(adaptersBarrel), false);

  const mem = require("../src/features/competition-core/seeding/adapters/memory/index.js");
  const tst = require("../src/features/competition-core/seeding/adapters/testing/index.js");
  assert.equal(typeof mem.createMemorySeedingResultRepository, "function");
  assert.equal(typeof mem.createMemorySeedingLifecycleAudit, "function");
  assert.equal(typeof tst.createEligibilityDecisionPortStub, "function");
  assert.equal(typeof tst.createRuleEvaluationPortStub, "function");
  assert.equal(typeof tst.createSnapshotProviderPortStub, "function");
  assert.equal(typeof tst.createFingerprintPortStub, "function");

  const facadeSrc = readSeeding("integration/createSeedingIntegrationFacade.js");
  assert.equal(facadeSrc.includes("createMemorySeeding"), false);
  assert.equal(facadeSrc.includes("createEligibilityDecisionPortStub"), false);
  assert.match(facadeSrc, /fingerprintPort:\s*pick\("fingerprintPort"\)\s*\|\|\s*null/);

  const bare = createSeedingIntegrationFacade({});
  assert.throws(
    () => bare.generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );
});

// ─── Group A — Integration facade ───────────────────────────────────────────

test("1F facade: generate DRAFT via Phase 1D; finalize/read/project; inputs unchanged", () => {
  const { facade, repositoryPort, auditPort } = buildFacade();
  const raw = draftRequest();
  const snap = JSON.stringify(raw);
  const drafted = facade.generateDraftSeedingResult(raw);
  assert.equal(JSON.stringify(raw), snap);
  assert.equal(drafted.result.finalizationState, FINALIZATION_STATE.DRAFT);
  assert.deepEqual(assignmentMap(drafted.result), ["a:1", "b:2", "c:3"]);
  assert.equal(typeof createDraftSeedingResult, "function");

  const finalized = facade.finalizeAuthoritativeSeedingResult({
    result: drafted.result,
    request: {
      requestId: "fin-1f",
      resultId: drafted.result.resultId,
      expectedResultVersion: drafted.result.resultVersion,
      expectedFingerprint: drafted.result.deterministicFingerprint,
      authorizationDecision: auth(LIFECYCLE_ACTION.FINALIZE),
      finalizedAt: "2026-07-21T13:00:00.000Z",
      idempotencyKey: "idem-1f",
    },
  });
  assert.equal(finalized.result.finalizationState, FINALIZATION_STATE.FINALIZED);
  assert.equal(finalized.eventsToAppend.length, 1);
  assert.equal(auditPort._debug.size(), 1);
  assert.equal(typeof finalizeSeedingResult, "function");

  const loaded = facade.getAuthoritativeSeedingResult({ seedingScope: scope() });
  assert.equal(loaded.result.resultId, "res-1f");

  const projected = facade.projectAuthoritativeSeedingForDraw({
    seedingScope: scope(),
  });
  assert.equal(
    projected.projection.fingerprint,
    finalized.result.deterministicFingerprint
  );
  assert.deepEqual(
    projected.seedRanking.map((r) => `${r.entryId}:${r.seedNumber}`),
    ["a:1", "b:2", "c:3"]
  );
  assert.equal(repositoryPort._debug.authoritativeSize(), 1);
});

test("1F facade: cancel DRAFT via Phase 1E; missing repository fails closed", () => {
  const { facade } = buildFacade();
  const drafted = facade.generateDraftSeedingResult(draftRequest());
  assert.equal(typeof cancelSeedingResult, "function");
  const cancelled = facade.cancelDraftSeedingResult({
    result: drafted.result,
    request: {
      requestId: "cancel-1f",
      resultId: drafted.result.resultId,
      expectedResultVersion: drafted.result.resultVersion,
      expectedFingerprint: drafted.result.deterministicFingerprint,
      authorizationDecision: auth(LIFECYCLE_ACTION.CANCEL),
      cancelledAt: "2026-07-21T14:00:00.000Z",
      reason: "abandoned",
    },
  });
  assert.equal(cancelled.result.finalizationState, FINALIZATION_STATE.CANCELLED);

  const bare = createSeedingIntegrationFacade({
    defaultPorts: { fingerprintPort: createFingerprintPortStub() },
  });
  assert.throws(
    () => bare.getAuthoritativeSeedingResult({ seedingScope: scope() }),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );
});

test("1F facade: supersede through lifecycle service + repository", () => {
  const { facade } = buildFacade();
  assert.equal(typeof supersedeSeedingResult, "function");
  const d1 = facade.generateDraftSeedingResult(draftRequest());
  const f1 = facade.finalizeAuthoritativeSeedingResult({
    result: d1.result,
    request: {
      requestId: "fin-a",
      resultId: d1.result.resultId,
      expectedResultVersion: d1.result.resultVersion,
      expectedFingerprint: d1.result.deterministicFingerprint,
      authorizationDecision: auth(LIFECYCLE_ACTION.FINALIZE),
      finalizedAt: "2026-07-21T13:00:00.000Z",
      idempotencyKey: "idem-a",
    },
  });
  const d2 = facade.generateDraftSeedingResult(
    draftRequest({ requestId: "req-2", resultId: "res-2", resultVersion: 2 })
  );
  const f2 = facade.finalizeAuthoritativeSeedingResult({
    result: d2.result,
    requireRepositoryPort: false,
    ports: { repositoryPort: null },
    request: {
      requestId: "fin-b",
      resultId: d2.result.resultId,
      expectedResultVersion: d2.result.resultVersion,
      expectedFingerprint: d2.result.deterministicFingerprint,
      authorizationDecision: auth(LIFECYCLE_ACTION.FINALIZE, {
        decisionId: "dec-fin-b",
      }),
      finalizedAt: "2026-07-21T13:30:00.000Z",
      idempotencyKey: "idem-b",
    },
  });
  const replacement = Object.freeze({
    ...f2.result,
    supersededResultId: f1.result.resultId,
  });
  const superseded = facade.supersedeAuthoritativeSeedingResult({
    priorResult: f1.result,
    replacementResult: replacement,
    request: {
      requestId: "sup-1f",
      priorResultId: f1.result.resultId,
      replacementResultId: f2.result.resultId,
      authorizationDecision: auth(LIFECYCLE_ACTION.SUPERSEDE),
      supersededAt: "2026-07-21T15:00:00.000Z",
      idempotencyKey: "idem-sup",
    },
  });
  assert.equal(superseded.result.finalizationState, FINALIZATION_STATE.SUPERSEDED);
  const authNow = facade.getAuthoritativeSeedingResult({ seedingScope: scope() });
  assert.equal(authNow.result.resultId, "res-2");
});

test("1F facade: no duplicated allocation/lifecycle; port exception maps INTERNAL_PORT_FAILURE", () => {
  const facadeSrc = readSeeding("integration/createSeedingIntegrationFacade.js");
  assert.match(facadeSrc, /createDraftSeedingResult/);
  assert.match(facadeSrc, /finalizeSeedingResult/);
  assert.match(facadeSrc, /supersedeSeedingResult/);
  assert.match(facadeSrc, /cancelSeedingResult/);
  assert.equal(facadeSrc.includes("allocateSeedNumbers("), false);
  assert.equal(facadeSrc.includes("SEEDING_STATE_TRANSITION_MATRIX"), false);

  const facade = createSeedingIntegrationFacade({
    defaultPorts: {
      fingerprintPort: createFingerprintPortStub(),
      eligibilityPort: createEligibilityDecisionPortStub({
        throwError: new Error("elig-down"),
      }),
      snapshotProviderPort: createSnapshotProviderPortStub(),
    },
  });
  assert.throws(
    () => facade.generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );
});

// ─── Group B — Eligibility ──────────────────────────────────────────────────

test("1F eligibility: ELIGIBLE accepted; INELIGIBLE excluded; provenance retained", () => {
  const eligibilityPort = createEligibilityDecisionPortStub({
    decisionsByEntryId: eligibilityMap({
      a: ELIGIBILITY_STATUS.ELIGIBLE,
      b: ELIGIBILITY_STATUS.INELIGIBLE,
      c: ELIGIBILITY_STATUS.ELIGIBLE,
    }),
  });
  const facade = createSeedingIntegrationFacade({
    defaultPorts: {
      fingerprintPort: createFingerprintPortStub(),
      eligibilityPort,
      snapshotProviderPort: createSnapshotProviderPortStub({
        snapshot: defaultSnapshot({ subjectValues: [] }),
      }),
      repositoryPort: createMemorySeedingResultRepository(),
    },
  });
  const out = facade.generateDraftSeedingResult(draftRequest());
  assert.ok(out.result.orderedAssignments.every((a) => a.entryId !== "b"));
  assert.ok(out.result.excludedEntries.some((e) => e.entryId === "b"));
  assert.ok(out.eligibilityDecisions.a);
  assert.equal(out.eligibilityDecisions.a.sourceModule, "test-eligibility");
  assert.equal(out.eligibilityDecisions.a.sourceVersion, "1");
});

test("1F eligibility: UNKNOWN/missing/scope/entry mismatch fail closed; no noop fallback", () => {
  const fingerprintPort = createFingerprintPortStub();
  const basePorts = {
    fingerprintPort,
    snapshotProviderPort: createSnapshotProviderPortStub(),
  };

  const unknownPort = createEligibilityDecisionPortStub({
    decisionsByEntryId: eligibilityMap({
      a: ELIGIBILITY_STATUS.UNKNOWN,
      b: ELIGIBILITY_STATUS.ELIGIBLE,
      c: ELIGIBILITY_STATUS.ELIGIBLE,
    }),
  });
  assert.throws(
    () =>
      createSeedingIntegrationFacade({
        defaultPorts: { ...basePorts, eligibilityPort: unknownPort },
      }).generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.ELIGIBILITY_REQUIRED
  );

  const missingPort = createEligibilityDecisionPortStub({
    decisionsByEntryId: eligibilityMap({
      a: ELIGIBILITY_STATUS.ELIGIBLE,
      c: ELIGIBILITY_STATUS.ELIGIBLE,
    }),
  });
  assert.throws(
    () =>
      createSeedingIntegrationFacade({
        defaultPorts: { ...basePorts, eligibilityPort: missingPort },
      }).generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.ELIGIBILITY_REQUIRED
  );

  const scopeMismatch = createEligibilityDecisionPortStub({
    decisionsByEntryId: {
      a: {
        ...eligibilityMap({ a: ELIGIBILITY_STATUS.ELIGIBLE }).a,
        scope: scope({ competitionId: "other" }),
      },
      b: eligibilityMap({ b: ELIGIBILITY_STATUS.ELIGIBLE }).b,
      c: eligibilityMap({ c: ELIGIBILITY_STATUS.ELIGIBLE }).c,
    },
  });
  assert.throws(
    () =>
      createSeedingIntegrationFacade({
        defaultPorts: { ...basePorts, eligibilityPort: scopeMismatch },
      }).generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.ELIGIBILITY_DECISION_MISMATCH
  );

  const entryMismatch = createEligibilityDecisionPortStub({
    decisionsByEntryId: {
      a: {
        ...eligibilityMap({ a: ELIGIBILITY_STATUS.ELIGIBLE }).a,
        entryId: "zzz",
      },
      b: eligibilityMap({ b: ELIGIBILITY_STATUS.ELIGIBLE }).b,
      c: eligibilityMap({ c: ELIGIBILITY_STATUS.ELIGIBLE }).c,
    },
  });
  assert.throws(
    () =>
      createSeedingIntegrationFacade({
        defaultPorts: { ...basePorts, eligibilityPort: entryMismatch },
      }).generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.ELIGIBILITY_DECISION_MISMATCH
  );

  const applySrc = readSeeding("integration/applyIntegrationPorts.js");
  assert.equal(applySrc.includes("eligible !== false"), false);
  assert.match(applySrc, /ELIGIBILITY_STATUS\.UNKNOWN/);
  assert.match(applySrc, /Missing required eligibility decision/);
});

// ─── Group C — Rule evaluation ──────────────────────────────────────────────

test("1F rules: valid accepted; missing/denied/empty version fail; no constraints import", () => {
  const { facade } = buildFacade();
  assert.throws(
    () =>
      facade.generateDraftSeedingResult(
        draftRequest({ requireRuleEvaluation: true })
      ),
    (err) => err.code === SEEDING_ERROR_CODE.RULE_EVALUATION_REQUIRED
  );

  const withRules = createSeedingIntegrationFacade({
    defaultPorts: {
      fingerprintPort: createFingerprintPortStub(),
      eligibilityPort: createEligibilityDecisionPortStub({
        decisionsByEntryId: eligibilityMap({
          a: ELIGIBILITY_STATUS.ELIGIBLE,
          b: ELIGIBILITY_STATUS.ELIGIBLE,
          c: ELIGIBILITY_STATUS.ELIGIBLE,
        }),
      }),
      ruleEvaluationPort: createRuleEvaluationPortStub({
        resultsByEntryId: {
          a: { hardPass: false, reasonCodes: ["RULE_DENIED"], softWarnings: [] },
          b: { hardPass: true, reasonCodes: [], softWarnings: [] },
          c: { hardPass: true, reasonCodes: [], softWarnings: [] },
        },
      }),
      snapshotProviderPort: createSnapshotProviderPortStub({
        snapshot: defaultSnapshot({ subjectValues: [] }),
      }),
      repositoryPort: createMemorySeedingResultRepository(),
    },
  });
  const out = withRules.generateDraftSeedingResult(
    draftRequest({ requireRuleEvaluation: true })
  );
  assert.ok(out.result.orderedAssignments.every((a) => a.entryId !== "a"));
  assert.equal(out.ruleProvenance.ruleSetId, "rules-1");
  assert.equal(out.ruleProvenance.ruleSetVersion, "1");

  let capturedScope = null;
  const scopeSpyPort = {
    contractVersion: "core07-rule-evaluation-port-v1",
    evaluateSeedingRules(input) {
      capturedScope = input.seedingScope;
      return {
        ok: true,
        ruleSetId: "rules-1",
        ruleSetVersion: "1",
        resultsByEntryId: {},
        decisionId: "rule-dec-1",
        evaluatedAt: "2026-07-21T12:00:00.000Z",
      };
    },
  };
  createSeedingIntegrationFacade({
    defaultPorts: {
      fingerprintPort: createFingerprintPortStub(),
      eligibilityPort: createEligibilityDecisionPortStub({
        decisionsByEntryId: eligibilityMap({
          a: ELIGIBILITY_STATUS.ELIGIBLE,
          b: ELIGIBILITY_STATUS.ELIGIBLE,
          c: ELIGIBILITY_STATUS.ELIGIBLE,
        }),
      }),
      ruleEvaluationPort: scopeSpyPort,
      snapshotProviderPort: createSnapshotProviderPortStub({
        snapshot: defaultSnapshot({ subjectValues: [] }),
      }),
    },
  }).generateDraftSeedingResult(draftRequest({ requireRuleEvaluation: true }));
  assert.equal(capturedScope.competitionId, "comp-1");

  const emptyVersionPort = {
    contractVersion: "core07-rule-evaluation-port-v1",
    evaluateSeedingRules() {
      return {
        ok: true,
        ruleSetId: "rules-1",
        ruleSetVersion: "",
        resultsByEntryId: {},
        decisionId: "rule-dec-empty",
        evaluatedAt: "2026-07-21T12:00:00.000Z",
      };
    },
  };
  assert.throws(
    () =>
      createSeedingIntegrationFacade({
        defaultPorts: {
          fingerprintPort: createFingerprintPortStub(),
          eligibilityPort: createEligibilityDecisionPortStub({
            decisionsByEntryId: eligibilityMap({
              a: ELIGIBILITY_STATUS.ELIGIBLE,
              b: ELIGIBILITY_STATUS.ELIGIBLE,
              c: ELIGIBILITY_STATUS.ELIGIBLE,
            }),
          }),
          ruleEvaluationPort: emptyVersionPort,
          snapshotProviderPort: createSnapshotProviderPortStub(),
        },
      }).generateDraftSeedingResult(draftRequest({ requireRuleEvaluation: true })),
    (err) => err.code === SEEDING_ERROR_CODE.RULE_EVALUATION_REQUIRED
  );

  const applySrc = readSeeding("integration/applyIntegrationPorts.js");
  assert.match(applySrc, /seedingScope:\s*args\.scope/);
  assert.match(applySrc, /ruleSetVersion/);
  assert.equal(applySrc.includes("constraints/"), false);
  assert.equal(applySrc.includes("evaluateConstraint"), false);

  assert.throws(
    () =>
      createSeedingIntegrationFacade({
        defaultPorts: {
          fingerprintPort: createFingerprintPortStub(),
          eligibilityPort: createEligibilityDecisionPortStub({
            decisionsByEntryId: eligibilityMap({
              a: ELIGIBILITY_STATUS.ELIGIBLE,
              b: ELIGIBILITY_STATUS.ELIGIBLE,
              c: ELIGIBILITY_STATUS.ELIGIBLE,
            }),
          }),
          ruleEvaluationPort: createRuleEvaluationPortStub({
            throwError: new Error("rules-down"),
          }),
          snapshotProviderPort: createSnapshotProviderPortStub(),
        },
      }).generateDraftSeedingResult(draftRequest({ requireRuleEvaluation: true })),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );
});

// ─── Group D — Snapshot provider ────────────────────────────────────────────

test("1F snapshot: complete/missing/scope/partial/provenance; no ranking recalc or Date.now", () => {
  let capturedEntryIds = null;
  const coveragePort = {
    contractVersion: "core07-snapshot-provider-port-v1",
    getSnapshot(input) {
      capturedEntryIds = (input.entryIds || []).slice().sort();
      return defaultSnapshot({
        subjectValues: (input.entryIds || []).map((id, i) => ({
          entryId: id,
          rankingPosition: i + 1,
          ratingValue: 1000 - i,
        })),
        scopeRef: input.seedingScope,
      });
    },
  };
  const { facade } = buildFacade({ snapshotProviderPort: coveragePort });
  const out = facade.generateDraftSeedingResult(draftRequest());
  assert.deepEqual(capturedEntryIds, ["a", "b", "c"]);
  assert.equal(out.snapshotProvenance.snapshotId, "snap-1f");
  assert.equal(out.snapshotProvenance.sourceSystem, "test");
  assert.equal(out.snapshotProvenance.sourceVersion, "1");

  assert.throws(
    () =>
      createSeedingIntegrationFacade({
        defaultPorts: {
          fingerprintPort: createFingerprintPortStub(),
          eligibilityPort: createEligibilityDecisionPortStub({
            decisionsByEntryId: eligibilityMap({
              a: ELIGIBILITY_STATUS.ELIGIBLE,
              b: ELIGIBILITY_STATUS.ELIGIBLE,
              c: ELIGIBILITY_STATUS.ELIGIBLE,
            }),
          }),
        },
      }).generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.SNAPSHOT_REQUIRED
  );

  assert.throws(
    () =>
      createSeedingIntegrationFacade({
        defaultPorts: {
          fingerprintPort: createFingerprintPortStub(),
          eligibilityPort: createEligibilityDecisionPortStub({
            decisionsByEntryId: eligibilityMap({
              a: ELIGIBILITY_STATUS.ELIGIBLE,
              b: ELIGIBILITY_STATUS.ELIGIBLE,
              c: ELIGIBILITY_STATUS.ELIGIBLE,
            }),
          }),
          snapshotProviderPort: createSnapshotProviderPortStub({
            snapshot: defaultSnapshot({
              scopeRef: scope({ competitionId: "other" }),
            }),
          }),
        },
      }).generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.SNAPSHOT_SCOPE_MISMATCH
  );

  const partial = createSeedingIntegrationFacade({
    defaultPorts: {
      fingerprintPort: createFingerprintPortStub(),
      eligibilityPort: createEligibilityDecisionPortStub({
        decisionsByEntryId: eligibilityMap({
          a: ELIGIBILITY_STATUS.ELIGIBLE,
          b: ELIGIBILITY_STATUS.ELIGIBLE,
          c: ELIGIBILITY_STATUS.ELIGIBLE,
        }),
      }),
      snapshotProviderPort: createSnapshotProviderPortStub({
        snapshot: defaultSnapshot({
          completenessState: "PARTIAL",
          subjectValues: [{ entryId: "a", rankingPosition: 1 }],
        }),
      }),
    },
  });
  assert.throws(
    () => partial.generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.SNAPSHOT_INCOMPLETE
  );
  const okPartial = partial.generateDraftSeedingResult(
    draftRequest({ allowPartialSnapshot: true })
  );
  assert.equal(okPartial.result.finalizationState, FINALIZATION_STATE.DRAFT);

  assert.throws(
    () =>
      createSeedingIntegrationFacade({
        defaultPorts: {
          fingerprintPort: createFingerprintPortStub(),
          eligibilityPort: createEligibilityDecisionPortStub({
            decisionsByEntryId: eligibilityMap({
              a: ELIGIBILITY_STATUS.ELIGIBLE,
              b: ELIGIBILITY_STATUS.ELIGIBLE,
              c: ELIGIBILITY_STATUS.ELIGIBLE,
            }),
          }),
          snapshotProviderPort: createSnapshotProviderPortStub({
            throwError: new Error("snap-down"),
          }),
        },
      }).generateDraftSeedingResult(draftRequest()),
    (err) => err.code === SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE
  );

  const applySrc = readSeeding("integration/applyIntegrationPorts.js");
  assert.equal(applySrc.includes("Date.now"), false);
  assert.equal(applySrc.includes("Math.random"), false);
  assert.equal(applySrc.includes("rankingPosition ="), false);
  assert.equal(applySrc.includes("ratingValue ="), false);
  const facadeSrc = readSeeding("integration/createSeedingIntegrationFacade.js");
  assert.equal(facadeSrc.includes("Date.now"), false);
});

// ─── Group E/F — Memory adapters ────────────────────────────────────────────

test("1F memory repository: isolation, immutability, conflict, supersede, no storage APIs", () => {
  const a = createMemorySeedingResultRepository();
  const b = createMemorySeedingResultRepository();
  const { facade } = buildFacade();
  const drafted = facade.generateDraftSeedingResult(draftRequest());
  const finalized = facade.finalizeAuthoritativeSeedingResult({
    result: drafted.result,
    ports: { repositoryPort: a, auditPort: createMemorySeedingLifecycleAudit() },
    request: {
      requestId: "fin-mem",
      resultId: drafted.result.resultId,
      expectedResultVersion: drafted.result.resultVersion,
      expectedFingerprint: drafted.result.deterministicFingerprint,
      authorizationDecision: auth(LIFECYCLE_ACTION.FINALIZE),
      finalizedAt: "2026-07-21T13:00:00.000Z",
      idempotencyKey: "idem-mem",
    },
  });
  assert.equal(a._debug.authoritativeSize(), 1);
  assert.equal(b._debug.authoritativeSize(), 0);

  const otherScopeDraft = facade.generateDraftSeedingResult(
    draftRequest({
      requestId: "req-scope-b",
      resultId: "res-scope-b",
      seedingScope: scope({ competitionId: "comp-2" }),
      ports: {
        repositoryPort: a,
        fingerprintPort: createFingerprintPortStub(),
        eligibilityPort: createEligibilityDecisionPortStub({
          decisionsByEntryId: {
            a: {
              ...eligibilityMap({ a: ELIGIBILITY_STATUS.ELIGIBLE }).a,
              scope: scope({ competitionId: "comp-2" }),
            },
            b: {
              ...eligibilityMap({ b: ELIGIBILITY_STATUS.ELIGIBLE }).b,
              scope: scope({ competitionId: "comp-2" }),
            },
            c: {
              ...eligibilityMap({ c: ELIGIBILITY_STATUS.ELIGIBLE }).c,
              scope: scope({ competitionId: "comp-2" }),
            },
          },
        }),
        snapshotProviderPort: createSnapshotProviderPortStub({
          snapshot: defaultSnapshot({
            snapshotId: "snap-scope-b",
            scopeRef: scope({ competitionId: "comp-2" }),
          }),
        }),
      },
    })
  );
  facade.finalizeAuthoritativeSeedingResult({
    result: otherScopeDraft.result,
    ports: { repositoryPort: a },
    request: {
      requestId: "fin-scope-b",
      resultId: otherScopeDraft.result.resultId,
      expectedResultVersion: otherScopeDraft.result.resultVersion,
      expectedFingerprint: otherScopeDraft.result.deterministicFingerprint,
      authorizationDecision: auth(LIFECYCLE_ACTION.FINALIZE, {
        decisionId: "dec-scope-b",
        scope: scope({ competitionId: "comp-2" }),
      }),
      finalizedAt: "2026-07-21T13:10:00.000Z",
      idempotencyKey: "idem-scope-b",
    },
  });
  assert.equal(a.findAuthoritativeByScope(scope()).resultId, finalized.result.resultId);
  assert.equal(
    a.findAuthoritativeByScope(scope({ competitionId: "comp-2" })).resultId,
    "res-scope-b"
  );

  const companion = Object.freeze({
    ...finalized.result,
    resultId: "other",
  });
  a.saveFinalized(companion);
  assert.equal(a.findAuthoritativeByScope(scope()).resultId, finalized.result.resultId);

  const otherDrafted = facade.generateDraftSeedingResult(
    draftRequest({
      requestId: "req-other",
      resultId: "res-other",
      resultVersion: 2,
      ports: {
        repositoryPort: a,
        fingerprintPort: createFingerprintPortStub(),
        eligibilityPort: createEligibilityDecisionPortStub({
          decisionsByEntryId: eligibilityMap({
            a: ELIGIBILITY_STATUS.ELIGIBLE,
            b: ELIGIBILITY_STATUS.ELIGIBLE,
            c: ELIGIBILITY_STATUS.ELIGIBLE,
          }),
        }),
        snapshotProviderPort: createSnapshotProviderPortStub({
          snapshot: defaultSnapshot({ snapshotId: "snap-other" }),
        }),
      },
    })
  );
  assert.throws(
    () =>
      facade.finalizeAuthoritativeSeedingResult({
        result: otherDrafted.result,
        ports: { repositoryPort: a },
        request: {
          requestId: "fin-conflict",
          resultId: otherDrafted.result.resultId,
          expectedResultVersion: otherDrafted.result.resultVersion,
          expectedFingerprint: otherDrafted.result.deterministicFingerprint,
          authorizationDecision: auth(LIFECYCLE_ACTION.FINALIZE, {
            decisionId: "dec-conflict",
          }),
          finalizedAt: "2026-07-21T13:00:00.000Z",
          idempotencyKey: "idem-conflict",
        },
      }),
    (err) => err.code === SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_CONFLICT
  );

  const read = a.findAuthoritativeByScope(scope());
  assert.throws(() => {
    read.finalizationState = FINALIZATION_STATE.DRAFT;
  });
  a.saveFinalized(finalized.result);
  assert.equal(a.findAuthoritativeByScope(scope()).resultId, finalized.result.resultId);

  const memSrc = readSeeding("adapters/memory/createMemorySeedingResultRepository.js");
  assert.equal(memSrc.includes("localStorage"), false);
  assert.equal(memSrc.includes("sessionStorage"), false);
  assert.equal(memSrc.includes("supabase"), false);
  assert.equal(memSrc.includes("globalThis."), false);
  assert.match(memSrc, /createMemorySeedingResultRepository\(\)/);
});

test("1F memory audit: isolation, idempotent eventId, stable order, immutable, no hidden time", () => {
  const audit = createMemorySeedingLifecycleAudit();
  const event1 = {
    eventId: "e1",
    eventType: "RESULT_FINALIZED",
    resultId: "r1",
    occurredAt: "2026-07-21T13:00:00.000Z",
  };
  const event2 = {
    eventId: "e2",
    eventType: "RESULT_CANCELLED",
    resultId: "r1",
    occurredAt: "2026-07-21T14:00:00.000Z",
  };
  audit.appendLifecycleEvents([event1, event2]);
  audit.appendLifecycleEvents([{ ...event1, eventType: "MUTATED" }]);
  assert.equal(audit._debug.size(), 2);
  assert.equal(audit.listEvents().length, 2);
  assert.deepEqual(
    audit.listEvents().map((e) => e.eventId),
    ["e1", "e2"]
  );
  assert.equal(audit.listEvents()[0].eventType, "RESULT_FINALIZED");
  assert.throws(() => {
    audit.listEvents()[0].eventType = "X";
  });
  const other = createMemorySeedingLifecycleAudit();
  assert.equal(other._debug.size(), 0);

  const auditSrc = readSeeding("adapters/memory/createMemorySeedingLifecycleAudit.js");
  assert.equal(auditSrc.includes("Date.now"), false);
  assert.equal(auditSrc.includes("new Date("), false);
  assert.equal(auditSrc.includes("globalThis."), false);
});

// ─── Group G — Authoritative projection ─────────────────────────────────────

test("1F projection: FINALIZED only; preserves fields; immutable; no secrets", () => {
  const { facade } = buildFacade();
  const drafted = facade.generateDraftSeedingResult(draftRequest());
  const draftClone = JSON.stringify(drafted.result);
  assert.throws(
    () => projectAuthoritativeSeedingResult(drafted.result),
    (err) => err.code === SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_NOT_FINALIZED
  );
  assert.equal(JSON.stringify(drafted.result), draftClone);

  const finalized = facade.finalizeAuthoritativeSeedingResult({
    result: drafted.result,
    request: {
      requestId: "fin-p",
      resultId: drafted.result.resultId,
      expectedResultVersion: drafted.result.resultVersion,
      expectedFingerprint: drafted.result.deterministicFingerprint,
      authorizationDecision: auth(LIFECYCLE_ACTION.FINALIZE),
      finalizedAt: "2026-07-21T13:00:00.000Z",
      idempotencyKey: "idem-p",
    },
  });
  const inputClone = JSON.stringify(finalized.result);
  const projection = projectAuthoritativeSeedingResult(finalized.result);
  assert.equal(JSON.stringify(finalized.result), inputClone);
  assert.equal(projection.fingerprint, finalized.result.deterministicFingerprint);
  assert.equal(projection.assignments[0].entryId, "a");
  assert.equal(projection.assignments[0].seedNumber, 1);
  assert.ok(projection.assignments[0].assignmentSource);
  assert.ok(projection.policyProvenance);
  assert.ok(projection.snapshotProvenance);
  assert.equal(projection.finalizationActor, undefined);
  assert.equal(projection.finalizationAuthorization, undefined);
  assert.equal(JSON.stringify(projection).includes("do-not-leak"), false);
  assert.throws(() => {
    projection.assignments.push({ entryId: "x", seedNumber: 9 });
  });

  assert.throws(
    () =>
      projectAuthoritativeSeedingResult({
        ...finalized.result,
        finalizationState: FINALIZATION_STATE.SUPERSEDED,
      }),
    (err) => err.code === SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_NOT_FINALIZED
  );
  assert.throws(
    () =>
      projectAuthoritativeSeedingResult({
        ...finalized.result,
        finalizationState: FINALIZATION_STATE.CANCELLED,
      }),
    (err) => err.code === SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_NOT_FINALIZED
  );
});

// ─── Group H — CORE-08 boundary ─────────────────────────────────────────────

test("1F CORE-08 boundary: neutral ranking map; no CORE-08/domain draw import; no mutation", () => {
  const { facade } = buildFacade();
  const drafted = facade.generateDraftSeedingResult(draftRequest());
  const finalized = facade.finalizeAuthoritativeSeedingResult({
    result: drafted.result,
    request: {
      requestId: "fin-08",
      resultId: drafted.result.resultId,
      expectedResultVersion: drafted.result.resultVersion,
      expectedFingerprint: drafted.result.deterministicFingerprint,
      authorizationDecision: auth(LIFECYCLE_ACTION.FINALIZE),
      finalizedAt: "2026-07-21T13:00:00.000Z",
      idempotencyKey: "idem-08",
    },
  });
  const projection = projectAuthoritativeSeedingResult(finalized.result);
  const before = JSON.stringify(projection);
  const ranking = mapAuthoritativeProjectionToDrawSeedRanking(projection);
  assert.equal(JSON.stringify(projection), before);
  assert.deepEqual(
    ranking.map((r) => `${r.entryId}:${r.seedNumber}:${r.rank}`),
    ["a:1:1", "b:2:2", "c:3:3"]
  );
  assert.equal(projection.fingerprint, finalized.result.deterministicFingerprint);

  for (const file of walkJs(path.join(SEEDING_ROOT, "domain"))) {
    const text = readFileSync(file, "utf8");
    assert.equal(/draw-runtime|match-generation|grouping/i.test(text), false);
  }
  const integ = readSeeding("integration/projectAuthoritativeSeedingResult.js");
  assert.equal(integ.includes("draw-runtime"), false);
  assert.equal(integ.includes("core-08"), false);
  assert.equal(integ.includes("seedNumber +"), false);

  const rootText = readFileSync(
    path.join(ROOT, "src/features/competition-core/index.js"),
    "utf8"
  );
  assert.equal(/from\s+['"]\.\/seeding/.test(rootText), false);
});

// ─── Group I — Shadow comparison ────────────────────────────────────────────

test("1F shadow: equal/mismatch/eligibility/stable/permutation; legacy authoritative; no cutover", () => {
  const canonical = [
    { entryId: "b", seedNumber: 2 },
    { entryId: "a", seedNumber: 1 },
  ];
  const legacy = [
    { entryId: "a", seedNumber: 1 },
    { entryId: "b", seedNumber: 2 },
  ];
  const rawCanon = JSON.stringify(canonical);
  const rawLegacy = JSON.stringify(legacy);
  const equal = compareLegacyAndCanonicalSeeding({
    canonicalAssignments: canonical,
    legacyAssignments: legacy,
  });
  assert.equal(JSON.stringify(canonical), rawCanon);
  assert.equal(JSON.stringify(legacy), rawLegacy);
  assert.equal(equal.equal, true);
  assert.equal(equal.differences.length, 0);
  assert.equal(equal.metadata.legacyRemainsAuthoritative, true);
  assert.equal(equal.metadata.productionWrites, false);
  assert.equal(equal.metadata.featureActivation, false);
  assert.equal(equal.metadata.recommendCutover, undefined);
  assert.equal(equal.metadata.automaticCutover, undefined);
  assert.match(equal.metadata.note, /Owner-approved migration/);

  const mismatch = compareLegacyAndCanonicalSeeding({
    canonicalAssignments: [
      { entryId: "a", seedNumber: 1 },
      { entryId: "b", seedNumber: 3 },
      { entryId: "c", seedNumber: 2 },
    ],
    legacyAssignments: [
      { entryId: "a", seedNumber: 1 },
      { entryId: "b", seedNumber: 2 },
      { entryId: "d", seedNumber: 4, eligibilityStatus: "ELIGIBLE" },
    ],
  });
  assert.equal(mismatch.equal, false);
  const codes = mismatch.differences.map((d) => d.code);
  assert.ok(codes.includes("SEED_NUMBER_MISMATCH"));
  assert.ok(codes.includes("ENTRY_ONLY_IN_CANONICAL"));
  assert.ok(codes.includes("ENTRY_ONLY_IN_LEGACY"));
  assert.deepEqual(codes, [...codes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));

  const r1 = compareLegacyAndCanonicalSeeding({
    canonicalAssignments: [
      { entryId: "b", seedNumber: 2, eligibilityStatus: "ELIGIBLE" },
      { entryId: "a", seedNumber: 1, eligibilityStatus: "INELIGIBLE" },
    ],
    legacyAssignments: [
      { entryId: "a", seedNumber: 1, eligibilityStatus: "ELIGIBLE" },
      { entryId: "b", seedNumber: 2, eligibilityStatus: "ELIGIBLE" },
    ],
  });
  const r2 = compareLegacyAndCanonicalSeeding({
    legacyAssignments: [
      { entryId: "b", seedNumber: 2, eligibilityStatus: "ELIGIBLE" },
      { entryId: "a", seedNumber: 1, eligibilityStatus: "ELIGIBLE" },
    ],
    canonicalAssignments: [
      { entryId: "a", seedNumber: 1, eligibilityStatus: "INELIGIBLE" },
      { entryId: "b", seedNumber: 2, eligibilityStatus: "ELIGIBLE" },
    ],
  });
  assert.deepEqual(r1.differences, r2.differences);
  assert.ok(r1.differences.some((d) => d.code === "ELIGIBILITY_MISMATCH"));

  const shadowSrc = readSeeding("integration/compareLegacyAndCanonicalSeeding.js");
  assert.equal(shadowSrc.includes("seedEngine"), false);
  assert.equal(shadowSrc.includes("teamGroupSeed"), false);
  assert.equal(shadowSrc.includes("supabase"), false);
});

// ─── Group J + determinism ──────────────────────────────────────────────────

test("1F determinism: two full integration runs identical", () => {
  function runOnce() {
    const { facade, auditPort } = buildFacade();
    const drafted = facade.generateDraftSeedingResult(draftRequest());
    const finalized = facade.finalizeAuthoritativeSeedingResult({
      result: drafted.result,
      request: {
        requestId: "fin-det",
        resultId: drafted.result.resultId,
        expectedResultVersion: drafted.result.resultVersion,
        expectedFingerprint: drafted.result.deterministicFingerprint,
        authorizationDecision: auth(LIFECYCLE_ACTION.FINALIZE),
        finalizedAt: "2026-07-21T13:00:00.000Z",
        idempotencyKey: "idem-det",
      },
    });
    const projected = facade.projectAuthoritativeSeedingForDraw({
      seedingScope: scope(),
    });
    const shadow = compareLegacyAndCanonicalSeeding({
      canonicalAssignments: finalized.result.orderedAssignments.map((a) => ({
        entryId: a.entryId,
        seedNumber: a.seedNumber,
      })),
      legacyAssignments: [
        { entryId: "a", seedNumber: 1 },
        { entryId: "b", seedNumber: 2 },
        { entryId: "c", seedNumber: 3 },
      ],
    });
    return {
      resultId: finalized.result.resultId,
      assignments: assignmentMap(finalized.result),
      fingerprint: finalized.result.deterministicFingerprint,
      policyProvenance: finalized.result.policyProvenance,
      snapshotProvenance: finalized.result.snapshotProvenance,
      eventIds: auditPort.listEvents().map((e) => e.eventId),
      projection: projected.seedRanking.map((r) => `${r.entryId}:${r.seedNumber}`),
      shadowDiffs: shadow.differences,
    };
  }
  assert.deepEqual(runOnce(), runOnce());
});

test("1F boundary: no UI/Supabase/CORE-01/03/08/09; root inactive; 3G preserved; no RNG/time", () => {
  const importRe =
    /(?:import|from)\s+['"][^'"]*(supabase|@mui|react|draw-runtime|match-generation|constraints\/|node:crypto)[^'"]*['"]/i;
  for (const file of walkJs(SEEDING_ROOT)) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      importRe.test(text),
      false,
      `${path.relative(ROOT, file)} has forbidden import`
    );
    if (file.includes(`${path.sep}integration${path.sep}`)) {
      assert.equal(text.includes("Date.now"), false, file);
      assert.equal(text.includes("Math.random"), false, file);
    }
  }
  const rootText = readFileSync(
    path.join(ROOT, "src/features/competition-core/index.js"),
    "utf8"
  );
  assert.equal(/from\s+['"]\.\/seeding/.test(rootText), false);
  assert.equal(typeof createSeedingResolver().resolve, "function");
  assert.equal(typeof assignSeeds, "function");
  assert.equal(existsSync(path.join(SEEDING_ROOT, "integration")), true);

  const facSrc = readSeeding("integration/createSeedingIntegrationFacade.js");
  assert.equal(facSrc.includes("VITE_"), false);
  assert.equal(facSrc.includes("featureFlag"), false);
  assert.equal(facSrc.includes("createMemorySeeding"), false);
});
