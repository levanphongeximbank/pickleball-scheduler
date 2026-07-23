import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as foundation from "../src/features/player-rating/foundation/index.js";
import {
  PLAYER_RATING_FOUNDATION_ERROR_CODE,
  PLAYER_RATING_VERIFICATION_ADJUSTMENT_PHASE,
  PLAYER_RATING_CAPABILITY,
  PLAYER_RATING_SOURCE_SCALE,
  ALLOWED_ADJUSTMENT_FIELDS,
  PlayerRatingFoundationError,
  adjustPlayerRating,
  createInMemoryRatingAdjustmentAuditAdapter,
  createInMemoryRatingCurrentStateAdapter,
  createInMemoryRatingHistoryAdapter,
  verifyPlayerRating,
} from "../src/features/player-rating/foundation/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VA_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation/verification-adjustment"
);
const FOUNDATION_ROOT = path.resolve(
  __dirname,
  "../src/features/player-rating/foundation"
);

const SCOPE = Object.freeze({ kind: "tenant", tenantId: "tenant-1" });
const SCOPE_OTHER = Object.freeze({ kind: "tenant", tenantId: "tenant-2" });
const T0 = "2026-07-20T00:00:00.000Z";
const T1 = "2026-07-21T00:00:00.000Z";
const T2 = "2026-07-22T00:00:00.000Z";

function expectCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof PlayerRatingFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

async function expectCodeAsync(fn, code) {
  await assert.rejects(fn, (err) => {
    assert.ok(err instanceof PlayerRatingFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

function readAllJsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAllJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function verifierActor(overrides = {}) {
  return {
    actorId: "actor-verify-1",
    actorType: "staff",
    capabilities: [PLAYER_RATING_CAPABILITY.VERIFY],
    tenantId: "tenant-1",
    reason: "manual verification review",
    correlationId: "corr-verify-1",
    operationId: "op-verify-1",
    occurredAt: T1,
    ...overrides,
  };
}

function adjusterActor(overrides = {}) {
  return {
    actorId: "actor-adjust-1",
    actorType: "staff",
    capabilities: [PLAYER_RATING_CAPABILITY.ADJUST],
    tenantId: "tenant-1",
    reason: "manual correction",
    correlationId: "corr-adjust-1",
    operationId: "op-adjust-1",
    occurredAt: T2,
    ...overrides,
  };
}

function baseState(overrides = {}) {
  return {
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    selfAssessedRating: 3.5,
    provisionalRating: 3.5,
    status: "provisional",
    source: "self_assessment",
    effectiveAt: T0,
    stateVersion: 1,
    sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0,
    ...overrides,
  };
}

async function createHarness(seedOverrides = {}) {
  const currentState = createInMemoryRatingCurrentStateAdapter();
  const history = createInMemoryRatingHistoryAdapter();
  const audit = createInMemoryRatingAdjustmentAuditAdapter();
  await currentState.seedCurrentState(baseState(seedOverrides));
  return { currentState, history, audit };
}

test("foundation exports Phase 1E verification/adjustment API", () => {
  const required = [
    "PLAYER_RATING_VERIFICATION_ADJUSTMENT_PHASE",
    "PLAYER_RATING_CAPABILITY",
    "ALLOWED_ADJUSTMENT_FIELDS",
    "verifyPlayerRating",
    "adjustPlayerRating",
    "authorizeRatingOperation",
    "createInMemoryRatingCurrentStateAdapter",
    "createInMemoryRatingAdjustmentAuditAdapter",
    "buildVerificationHistoryEntry",
    "buildAdjustmentHistoryEntry",
    "buildAdjustmentAuditEntry",
    "createRatingOperationIdentity",
  ];
  for (const name of required) {
    assert.ok(name in foundation, `missing export: ${name}`);
  }
  assert.equal(PLAYER_RATING_VERIFICATION_ADJUSTMENT_PHASE.id, "1E");
  assert.equal(
    PLAYER_RATING_VERIFICATION_ADJUSTMENT_PHASE.isProductionPersistence,
    false
  );
  assert.equal(PLAYER_RATING_VERIFICATION_ADJUSTMENT_PHASE.convertsScales, false);
  assert.equal(
    PLAYER_RATING_VERIFICATION_ADJUSTMENT_PHASE.hasMatchResultAlgorithm,
    false
  );
  assert.equal(
    PLAYER_RATING_VERIFICATION_ADJUSTMENT_PHASE.generatesIdsOrTimestamps,
    false
  );
  assert.deepEqual([...ALLOWED_ADJUSTMENT_FIELDS], [
    "selfAssessedRating",
    "provisionalRating",
    "verifiedRating",
  ]);
});

test("authorized verification succeeds with history and immutable result", async () => {
  const { currentState, history } = await createHarness();
  const result = await verifyPlayerRating(
    {
      playerId: "player-1",
      scope: SCOPE,
      ratingMode: "overall",
      verifiedRating: 4.0,
      expectedVersion: 1,
      actor: verifierActor(),
    },
    { currentStateAdapter: currentState, historyAdapter: history }
  );

  assert.equal(result.outcome, "accepted");
  assert.equal(result.verifiedRating, 4.0);
  assert.equal(result.beforeState.stateVersion, 1);
  assert.equal(result.afterState.stateVersion, 2);
  assert.equal(result.afterState.verifiedRating, 4.0);
  assert.equal(
    result.afterState.sourceScale,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0
  );
  assert.equal(result.sourceScale, result.beforeState.sourceScale);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.beforeState));
  assert.ok(Object.isFrozen(result.afterState));

  const listed = await history.listHistory("player-1", SCOPE, {
    ratingMode: "overall",
  });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].eventType, "PLAYER_RATING_VERIFIED");
  assert.equal(listed[0].eventId, "op-verify-1");
});

test("verification rejects missing actorId", async () => {
  const { currentState, history } = await createHarness();
  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 1,
          actor: verifierActor({ actorId: "" }),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_VERIFICATION
  );
});

test("verification rejects missing verify capability and does not trust isAdmin", async () => {
  const { currentState, history } = await createHarness();
  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 1,
          actor: verifierActor({
            capabilities: [],
            isAdmin: true,
          }),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_VERIFICATION
  );
});

test("verification rejects scope mismatch", async () => {
  const { currentState, history } = await createHarness();
  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 1,
          actor: verifierActor({ tenantId: "tenant-2" }),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED
  );
});

test("verification rejects missing current state", async () => {
  const currentState = createInMemoryRatingCurrentStateAdapter();
  const history = createInMemoryRatingHistoryAdapter();
  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-missing",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 1,
          actor: verifierActor(),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.CURRENT_STATE_NOT_FOUND
  );
});

test("verification requires canonical playerId", async () => {
  const { currentState, history } = await createHarness();
  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "   ",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 1,
          actor: verifierActor(),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.CANONICAL_PLAYER_ID_UNRESOLVED
  );
});

test("verification preserves scale and does not convert", async () => {
  const { currentState, history } = await createHarness();
  const result = await verifyPlayerRating(
    {
      playerId: "player-1",
      scope: SCOPE,
      ratingMode: "overall",
      verifiedSourceValue: 4.25,
      expectedVersion: 1,
      actor: verifierActor({ operationId: "op-verify-scale" }),
    },
    { currentStateAdapter: currentState, historyAdapter: history }
  );
  assert.equal(
    result.afterState.sourceScale,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V2_1_0_TO_8_0
  );
  assert.equal(result.verifiedRating, 4.25);
  assert.notEqual(
    result.afterState.sourceScale,
    PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0
  );
});

test("verification rejects scale mismatch when caller supplies incompatible sourceScale", async () => {
  const { currentState, history } = await createHarness();
  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 1,
          sourceScale: PLAYER_RATING_SOURCE_SCALE.PICK_VN_V5_1_5_TO_6_0,
          actor: verifierActor({ operationId: "op-verify-scale-mismatch" }),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SCALE_MISMATCH
  );
});

test("verification duplicate operationId replays without second apply", async () => {
  const { currentState, history } = await createHarness();
  const request = {
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    verifiedRating: 4.0,
    expectedVersion: 1,
    actor: verifierActor({ operationId: "op-verify-idem" }),
  };
  const first = await verifyPlayerRating(request, {
    currentStateAdapter: currentState,
    historyAdapter: history,
  });
  const second = await verifyPlayerRating(request, {
    currentStateAdapter: currentState,
    historyAdapter: history,
  });
  assert.deepEqual(second, first);
  const state = await currentState.getCurrentState("player-1", SCOPE, "overall");
  assert.equal(state.stateVersion, 2);
  const listed = await history.listHistory("player-1", SCOPE);
  assert.equal(listed.length, 1);
});

test("verification conflicting duplicate payload rejected", async () => {
  const { currentState, history } = await createHarness();
  await verifyPlayerRating(
    {
      playerId: "player-1",
      scope: SCOPE,
      ratingMode: "overall",
      verifiedRating: 4.0,
      expectedVersion: 1,
      actor: verifierActor({ operationId: "op-verify-conflict" }),
    },
    { currentStateAdapter: currentState, historyAdapter: history }
  );
  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.5,
          expectedVersion: 1,
          actor: verifierActor({ operationId: "op-verify-conflict" }),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_PAYLOAD_CONFLICT
  );
});

test("verification rejects stale expectedVersion", async () => {
  const { currentState, history } = await createHarness();
  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 99,
          actor: verifierActor({ operationId: "op-verify-stale" }),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_VERSION_CONFLICT
  );
});

test("authorized adjustment succeeds with history and audit", async () => {
  const { currentState, history, audit } = await createHarness();
  const result = await adjustPlayerRating(
    {
      playerId: "player-1",
      scope: SCOPE,
      ratingMode: "overall",
      targetField: "provisionalRating",
      newValue: 3.8,
      expectedVersion: 1,
      auditId: "audit-1",
      actor: adjusterActor(),
    },
    {
      currentStateAdapter: currentState,
      historyAdapter: history,
      auditAdapter: audit,
    }
  );

  assert.equal(result.outcome, "accepted");
  assert.equal(result.targetField, "provisionalRating");
  assert.equal(result.newValue, 3.8);
  assert.equal(result.afterState.provisionalRating, 3.8);
  assert.equal(result.beforeState.stateVersion, 1);
  assert.equal(result.afterState.stateVersion, 2);
  assert.ok(Object.isFrozen(result));

  const listed = await history.listHistory("player-1", SCOPE);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].eventType, "PLAYER_RATING_ADJUSTED");

  const audits = await audit.listAdjustmentAudits("player-1", SCOPE);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].auditId, "audit-1");
  assert.equal(audits[0].operationId, "op-adjust-1");
  assert.equal(audits[0].beforeState.provisionalRating, 3.5);
  assert.equal(audits[0].afterState.provisionalRating, 3.8);
});

test("adjustment rejects missing adjust capability", async () => {
  const { currentState, history, audit } = await createHarness();
  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "provisionalRating",
          newValue: 3.8,
          expectedVersion: 1,
          auditId: "audit-cap",
          actor: adjusterActor({ capabilities: [PLAYER_RATING_CAPABILITY.VERIFY] }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_MANUAL_ADJUSTMENT
  );
});

test("adjustment requires reason and explicit target value", async () => {
  const { currentState, history, audit } = await createHarness();
  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "provisionalRating",
          newValue: 3.8,
          expectedVersion: 1,
          auditId: "audit-reason",
          actor: adjusterActor({ reason: "" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );

  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "provisionalRating",
          expectedVersion: 1,
          auditId: "audit-value",
          actor: adjusterActor({ operationId: "op-adjust-value" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );
});

test("adjustment rejects unsupported target fields including calculated and display", async () => {
  const { currentState, history, audit } = await createHarness();
  for (const targetField of ["calculatedRating", "displayRating", "confidence"]) {
    await expectCodeAsync(
      () =>
        adjustPlayerRating(
          {
            playerId: "player-1",
            scope: SCOPE,
            ratingMode: "overall",
            targetField,
            newValue: 9,
            expectedVersion: 1,
            auditId: `audit-${targetField}`,
            actor: adjusterActor({ operationId: `op-${targetField}` }),
          },
          {
            currentStateAdapter: currentState,
            historyAdapter: history,
            auditAdapter: audit,
          }
        ),
      PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_FIELD_NOT_ALLOWED
    );
  }
});

test("adjustment rejects identity, scope, and mode mutation", async () => {
  const { currentState, history, audit } = await createHarness();
  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "selfAssessedRating",
          newValue: 3.2,
          expectedVersion: 1,
          auditId: "audit-id-mut",
          nextPlayerId: "player-2",
          actor: adjusterActor({ operationId: "op-id-mut" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );

  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "selfAssessedRating",
          newValue: 3.2,
          expectedVersion: 1,
          auditId: "audit-scope-mut",
          nextScope: SCOPE_OTHER,
          actor: adjusterActor({ operationId: "op-scope-mut" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED
  );

  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "selfAssessedRating",
          newValue: 3.2,
          expectedVersion: 1,
          auditId: "audit-mode-mut",
          nextRatingMode: "singles",
          actor: adjusterActor({ operationId: "op-mode-mut" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.INVALID_RATING_CONTRACT
  );
});

test("adjustment rejects scale mismatch and stale version", async () => {
  const { currentState, history, audit } = await createHarness();
  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "verifiedRating",
          newValue: 4.1,
          expectedVersion: 1,
          auditId: "audit-scale",
          sourceScale: PLAYER_RATING_SOURCE_SCALE.COMPETITION_ELO_APPROX_1500,
          actor: adjusterActor({ operationId: "op-scale" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SCALE_MISMATCH
  );

  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "verifiedRating",
          newValue: 4.1,
          expectedVersion: 7,
          auditId: "audit-stale",
          actor: adjusterActor({ operationId: "op-stale" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_VERSION_CONFLICT
  );
});

test("adjustment duplicate operationId replays; conflicting payload rejected", async () => {
  const { currentState, history, audit } = await createHarness();
  const request = {
    playerId: "player-1",
    scope: SCOPE,
    ratingMode: "overall",
    targetField: "selfAssessedRating",
    newValue: 3.1,
    expectedVersion: 1,
    auditId: "audit-idem",
    actor: adjusterActor({ operationId: "op-adjust-idem" }),
  };
  const first = await adjustPlayerRating(request, {
    currentStateAdapter: currentState,
    historyAdapter: history,
    auditAdapter: audit,
  });
  const second = await adjustPlayerRating(request, {
    currentStateAdapter: currentState,
    historyAdapter: history,
    auditAdapter: audit,
  });
  assert.deepEqual(second, first);
  assert.equal((await history.listHistory("player-1", SCOPE)).length, 1);
  assert.equal((await audit.listAdjustmentAudits("player-1", SCOPE)).length, 1);

  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          ...request,
          newValue: 3.9,
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_PAYLOAD_CONFLICT
  );
});

test("validation failure leaves current state, history, and audit unchanged", async () => {
  const { currentState, history, audit } = await createHarness();
  const before = await currentState.getCurrentState("player-1", SCOPE, "overall");

  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "displayRating",
          newValue: 99,
          expectedVersion: 1,
          auditId: "audit-atomic",
          actor: adjusterActor({ operationId: "op-atomic-fail" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_FIELD_NOT_ALLOWED
  );

  await expectCodeAsync(
    () =>
      verifyPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          verifiedRating: 4.0,
          expectedVersion: 1,
          actor: verifierActor({
            operationId: "op-atomic-unauth",
            capabilities: [],
          }),
        },
        { currentStateAdapter: currentState, historyAdapter: history }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.UNAUTHORIZED_VERIFICATION
  );

  const after = await currentState.getCurrentState("player-1", SCOPE, "overall");
  assert.deepEqual(after, before);
  assert.equal((await history.listHistory("player-1", SCOPE)).length, 0);
  assert.equal((await audit.listAdjustmentAudits("player-1", SCOPE)).length, 0);
});

test("duplicate/preflight conflict leaves adapters unchanged after prior success", async () => {
  const { currentState, history, audit } = await createHarness();
  await adjustPlayerRating(
    {
      playerId: "player-1",
      scope: SCOPE,
      ratingMode: "overall",
      targetField: "provisionalRating",
      newValue: 3.7,
      expectedVersion: 1,
      auditId: "audit-preflight",
      actor: adjusterActor({ operationId: "op-preflight" }),
    },
    {
      currentStateAdapter: currentState,
      historyAdapter: history,
      auditAdapter: audit,
    }
  );
  const stateAfterSuccess = await currentState.getCurrentState(
    "player-1",
    SCOPE,
    "overall"
  );

  await expectCodeAsync(
    () =>
      adjustPlayerRating(
        {
          playerId: "player-1",
          scope: SCOPE,
          ratingMode: "overall",
          targetField: "provisionalRating",
          newValue: 3.9,
          expectedVersion: 1,
          auditId: "audit-preflight-2",
          actor: adjusterActor({ operationId: "op-preflight" }),
        },
        {
          currentStateAdapter: currentState,
          historyAdapter: history,
          auditAdapter: audit,
        }
      ),
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_PAYLOAD_CONFLICT
  );

  assert.deepEqual(
    await currentState.getCurrentState("player-1", SCOPE, "overall"),
    stateAfterSuccess
  );
  assert.equal((await history.listHistory("player-1", SCOPE)).length, 1);
  assert.equal((await audit.listAdjustmentAudits("player-1", SCOPE)).length, 1);
});

test("separate adapter instances have isolated state", async () => {
  const a = createInMemoryRatingCurrentStateAdapter();
  const b = createInMemoryRatingCurrentStateAdapter();
  await a.seedCurrentState(baseState({ playerId: "player-a" }));
  assert.equal(await b.getCurrentState("player-a", SCOPE, "overall"), null);

  const auditA = createInMemoryRatingAdjustmentAuditAdapter();
  const auditB = createInMemoryRatingAdjustmentAuditAdapter();
  await auditA.recordAdjustmentAudit({
    auditId: "a1",
    operationId: "o1",
    playerId: "player-a",
    scope: SCOPE,
    ratingMode: "overall",
    actorId: "actor",
    reason: "r",
    beforeState: { v: 1 },
    afterState: { v: 2 },
    occurredAt: T1,
    correlationId: "c1",
  });
  assert.equal((await auditB.listAdjustmentAudits("player-a", SCOPE)).length, 0);
});

test("Phase 1E boundary scan — no forbidden imports or generators", () => {
  const files = readAllJsFiles(VA_ROOT);
  assert.ok(files.length > 0);
  const joined = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");

  assert.equal(joined.includes("supabase"), false);
  assert.equal(joined.includes("localStorage"), false);
  assert.equal(joined.includes("Date.now"), false);
  assert.equal(joined.includes("Math.random"), false);
  assert.equal(joined.includes("crypto.randomUUID"), false);
  assert.equal(joined.includes("new Date("), false);
  assert.equal(joined.includes("features/competition-core"), false);
  assert.equal(joined.includes("features/vpr-ranking"), false);
  assert.equal(joined.includes("features/player/"), false);
  assert.equal(joined.includes("features/club/"), false);
  assert.equal(joined.includes("features/identity/"), false);
  assert.equal(joined.includes("features/auth"), false);

  // No Elo / hidden rating formula markers in Phase 1E workflows.
  assert.equal(/\belo\b/i.test(joined), false);
  assert.equal(joined.includes("SELECT "), false);
  assert.equal(joined.includes("CREATE TABLE"), false);

  const foundationFiles = readAllJsFiles(FOUNDATION_ROOT);
  const vaRelative = foundationFiles.filter((f) => f.includes(`${path.sep}verification-adjustment${path.sep}`));
  assert.equal(vaRelative.length, files.length);
});

test("error codes include Phase 1E narrow additions", () => {
  assert.equal(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.CURRENT_STATE_NOT_FOUND,
    "PLAYER_RATING_CURRENT_STATE_NOT_FOUND"
  );
  assert.equal(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_VERSION_CONFLICT,
    "PLAYER_RATING_VERSION_CONFLICT"
  );
  assert.equal(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_PAYLOAD_CONFLICT,
    "PLAYER_RATING_OPERATION_PAYLOAD_CONFLICT"
  );
  assert.equal(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_SCALE_MISMATCH,
    "PLAYER_RATING_SCALE_MISMATCH"
  );
  assert.equal(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_FIELD_NOT_ALLOWED,
    "PLAYER_RATING_ADJUSTMENT_FIELD_NOT_ALLOWED"
  );
  assert.equal(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.ADJUSTMENT_AUDIT_DUPLICATE,
    "PLAYER_RATING_ADJUSTMENT_AUDIT_DUPLICATE"
  );
  expectCode(() => {
    throw new PlayerRatingFoundationError(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_DUPLICATE,
      "duplicate"
    );
  }, PLAYER_RATING_FOUNDATION_ERROR_CODE.RATING_OPERATION_DUPLICATE);
});
