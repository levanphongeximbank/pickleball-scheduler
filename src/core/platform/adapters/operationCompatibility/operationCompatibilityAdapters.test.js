/**
 * Operation/Compatibility adoption adapter certification tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  projectIdempotencyKey,
  projectOperationIdentity,
  projectContractVersion,
  projectCompatibilityDecision,
  IDEMPOTENCY_KEY_ADAPTER_ERROR,
  OPERATION_IDENTITY_ADAPTER_ERROR,
  CONTRACT_VERSION_ADAPTER_ERROR,
  COMPATIBILITY_DECISION_ADAPTER_ERROR,
} from "./index.js";
import {
  isIdempotencyKey,
  isOperationIdentity,
  isContractVersion,
  isCompatibilityDecision,
  projectIdentityActor,
  projectTenantScope,
  projectEventTraceContext,
  projectCommonEventEnvelope,
} from "../../index.js";

const ADAPTER_DIR = path.dirname(fileURLToPath(import.meta.url));

function readAdapterSources() {
  const files = fs
    .readdirSync(ADAPTER_DIR)
    .filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));
  return files.map((name) => ({
    name,
    source: fs.readFileSync(path.join(ADAPTER_DIR, name), "utf8"),
  }));
}

test("1. valid idempotency-key projection", () => {
  const result = projectIdempotencyKey("cmd-idem-001");
  assert.equal(result.ok, true);
  assert.equal(isIdempotencyKey(result.value), true);
  assert.equal(result.value, "cmd-idem-001");
});

test("2. invalid idempotency-key projection", () => {
  assert.equal(projectIdempotencyKey("").ok, false);
  assert.equal(projectIdempotencyKey("   ").ok, false);
  assert.equal(projectIdempotencyKey(42).ok, false);
  assert.equal(
    projectIdempotencyKey(null).error.code,
    IDEMPOTENCY_KEY_ADAPTER_ERROR.INVALID
  );
  assert.equal(
    projectIdempotencyKey({}).error.code,
    IDEMPOTENCY_KEY_ADAPTER_ERROR.KEY_REQUIRED
  );
});

test("3. idempotency key trimming", () => {
  const result = projectIdempotencyKey("  key-trim  ");
  assert.equal(result.ok, true);
  assert.equal(result.value, "key-trim");

  const wrapped = projectIdempotencyKey({ idempotencyKey: "  wrapped  " });
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.value, "wrapped");
});

test("4. no idempotency-key generation", () => {
  assert.equal(
    projectIdempotencyKey({}).error.code,
    IDEMPOTENCY_KEY_ADAPTER_ERROR.KEY_REQUIRED
  );
  const before = Date.now();
  const failed = projectIdempotencyKey({ key: undefined });
  const after = Date.now();
  assert.equal(failed.ok, false);
  const serialized = JSON.stringify(failed);
  assert.equal(serialized.includes(String(before)), false);
  assert.equal(serialized.includes(String(after)), false);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(serialized), false);
});

test("5. valid minimal operation identity", () => {
  const result = projectOperationIdentity({ operationId: "op-min-1" });
  assert.equal(result.ok, true);
  assert.equal(isOperationIdentity(result.value), true);
  assert.equal(result.value.operationId, "op-min-1");
  assert.equal("idempotencyKey" in result.value, false);
  assert.equal("correlationId" in result.value, false);
});

test("6. valid full operation identity", () => {
  const result = projectOperationIdentity({
    operationId: "op-full-1",
    idempotencyKey: "idem-full",
    correlationId: "corr-full",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.operationId, "op-full-1");
  assert.equal(result.value.idempotencyKey, "idem-full");
  assert.equal(result.value.correlationId, "corr-full");
});

test("7. explicit operationId required", () => {
  assert.equal(
    projectOperationIdentity({}).error.code,
    OPERATION_IDENTITY_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );
  assert.equal(
    projectOperationIdentity({
      idempotencyKey: "k",
      correlationId: "c",
    }).error.code,
    OPERATION_IDENTITY_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );
  assert.equal(
    projectOperationIdentity(null).error.code,
    OPERATION_IDENTITY_ADAPTER_ERROR.INVALID
  );
});

test("8. optional idempotency key preserved", () => {
  const result = projectOperationIdentity({
    operationId: "op-8",
    idempotencyKey: "  preserve-key  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.idempotencyKey, "preserve-key");
});

test("9. optional correlationId preserved", () => {
  const result = projectOperationIdentity({
    operationId: "op-9",
    correlationId: "corr-preserve",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.correlationId, "corr-preserve");
});

test("10. no operation ID generation", () => {
  assert.equal(
    projectOperationIdentity({}).error.code,
    OPERATION_IDENTITY_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );
  assert.equal(
    projectOperationIdentity({ operationId: undefined }).error.code,
    OPERATION_IDENTITY_ADAPTER_ERROR.OPERATION_ID_REQUIRED
  );
});

test("11. no correlation ID generation", () => {
  const result = projectOperationIdentity({ operationId: "op-no-corr" });
  assert.equal(result.ok, true);
  assert.equal("correlationId" in result.value, false);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(JSON.stringify(result.value)), false);
});

test("12. no duplicate detection", () => {
  const first = projectOperationIdentity({
    operationId: "op-dup",
    idempotencyKey: "same-key",
  });
  const second = projectOperationIdentity({
    operationId: "op-dup",
    idempotencyKey: "same-key",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value, second.value);
});

test("13. no persistence or locking", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(/localStorage/.test(source), false, name);
    assert.equal(/IndexedDB/.test(source), false, name);
    assert.equal(/createClient/.test(source), false, name);
    assert.equal(/\.persist\s*\(/.test(source), false, name);
    assert.equal(/\block\w*\s*\(/.test(source), false, name);
    assert.equal(/new\s+Map\s*\(/.test(source), false, name);
    assert.equal(/new\s+WeakMap\s*\(/.test(source), false, name);
    assert.equal(/new\s+Set\s*\(/.test(source), false, name);
  }
});

test("14. valid contract-version projection", () => {
  const result = projectContractVersion("1.0.0");
  assert.equal(result.ok, true);
  assert.equal(isContractVersion(result.value), true);
  assert.equal(result.value, "1.0.0");
});

test("15. version representation preserved", () => {
  const opaque = projectContractVersion("phase-1e-opaque");
  assert.equal(opaque.ok, true);
  assert.equal(opaque.value, "phase-1e-opaque");

  const wrapped = projectContractVersion({ contractVersion: "  v2-beta  " });
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.value, "v2-beta");
});

test("16. no semver parsing", () => {
  const result = projectContractVersion("10.20.30-legacy+build");
  assert.equal(result.ok, true);
  assert.equal(result.value, "10.20.30-legacy+build");
  assert.equal(typeof result.value, "string");
  assert.equal("major" in /** @type {object} */ (/** @type {unknown} */ (result)), false);
});

test("17. no default version", () => {
  assert.equal(
    projectContractVersion({}).error.code,
    CONTRACT_VERSION_ADAPTER_ERROR.VERSION_REQUIRED
  );
  assert.equal(
    projectContractVersion(null).error.code,
    CONTRACT_VERSION_ADAPTER_ERROR.INVALID
  );
});

test("18. valid compatible decision", () => {
  const result = projectCompatibilityDecision({
    compatible: true,
    decisionCode: "COMPATIBLE",
  });
  assert.equal(result.ok, true);
  assert.equal(isCompatibilityDecision(result.value), true);
  assert.equal(result.value.compatible, true);
  assert.equal(result.value.decisionCode, "COMPATIBLE");
});

test("19. valid incompatible decision", () => {
  const result = projectCompatibilityDecision({
    compatible: false,
    decisionCode: "INCOMPATIBLE",
    reason: "major mismatch",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.compatible, false);
  assert.equal(result.value.decisionCode, "INCOMPATIBLE");
  assert.equal(result.value.reason, "major mismatch");
});

test("20. strict boolean compatibility", () => {
  assert.equal(
    projectCompatibilityDecision({
      compatible: "true",
      decisionCode: "X",
    }).ok,
    false
  );
  assert.equal(
    projectCompatibilityDecision({
      compatible: 1,
      decisionCode: "X",
    }).ok,
    false
  );
  assert.equal(
    projectCompatibilityDecision({
      decisionCode: "X",
    }).error.code,
    COMPATIBILITY_DECISION_ADAPTER_ERROR.COMPATIBLE_REQUIRED
  );
});

test("21. current version projection", () => {
  const result = projectCompatibilityDecision({
    compatible: true,
    decisionCode: "OK",
    currentVersion: "  1.2.3  ",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.currentVersion, "1.2.3");
});

test("22. required version projection", () => {
  const result = projectCompatibilityDecision({
    compatible: false,
    decisionCode: "NEEDS_UPGRADE",
    requiredVersion: "2.0.0",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.requiredVersion, "2.0.0");
});

test("23. no version comparison", () => {
  const lower = projectCompatibilityDecision({
    compatible: true,
    decisionCode: "CALLER_SAYS_OK",
    currentVersion: "0.0.1",
    requiredVersion: "9.9.9",
  });
  assert.equal(lower.ok, true);
  assert.equal(lower.value.compatible, true);
  assert.equal(lower.value.currentVersion, "0.0.1");
  assert.equal(lower.value.requiredVersion, "9.9.9");
});

test("24. no compatibility inference", () => {
  assert.equal(
    projectCompatibilityDecision({
      decisionCode: "MISSING_FLAG",
      currentVersion: "1.0.0",
      requiredVersion: "1.0.0",
    }).error.code,
    COMPATIBILITY_DECISION_ADAPTER_ERROR.COMPATIBLE_REQUIRED
  );
  assert.equal(
    projectCompatibilityDecision({
      compatible: true,
    }).error.code,
    COMPATIBILITY_DECISION_ADAPTER_ERROR.DECISION_CODE_REQUIRED
  );
});

test("25. no migration execution", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(/\bmigrate\w*\s*\(/.test(source), false, name);
    assert.equal(/\brunMigration\s*\(/.test(source), false, name);
    assert.equal(/\bupgrade\w*\s*\(/.test(source), false, name);
    assert.equal(/from\s+["']semver["']/.test(source), false, name);
    assert.equal(/require\s*\(\s*["']semver["']\s*\)/.test(source), false, name);
  }
});

test("26-30. no Date.now, randomUUID, database, headers, env", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(/Date\.now\s*\(/.test(source), false, name);
    assert.equal(/randomUUID\s*\(/.test(source), false, name);
    assert.equal(/Math\.random\s*\(/.test(source), false, name);
    assert.equal(/createClient\s*\(/.test(source), false, name);
    assert.equal(/supabase/i.test(source), false, name);
    assert.equal(/localStorage\./.test(source), false, name);
    assert.equal(/sessionStorage\./.test(source), false, name);
    assert.equal(/process\.env/.test(source), false, name);
    assert.equal(/import\.meta\.env/.test(source), false, name);
    assert.equal(/headers\s*\[/.test(source), false, name);
    assert.equal(/getHeader\s*\(/.test(source), false, name);
    assert.equal(/Idempotency-Key/.test(source), false, name);
    assert.equal(/req\.headers/.test(source), false, name);
    assert.equal(/AsyncLocalStorage/.test(source), false, name);
  }
});

test("31. input objects are not mutated", () => {
  const keyInput = { idempotencyKey: "  k1  ", extra: { nested: true } };
  const keySnapshot = JSON.stringify(keyInput);
  assert.equal(projectIdempotencyKey(keyInput).ok, true);
  assert.equal(JSON.stringify(keyInput), keySnapshot);

  const opInput = {
    operationId: "op-m",
    idempotencyKey: "ik",
    correlationId: "ck",
    extra: 1,
  };
  const opSnapshot = JSON.stringify(opInput);
  assert.equal(projectOperationIdentity(opInput).ok, true);
  assert.equal(JSON.stringify(opInput), opSnapshot);

  const versionInput = { version: "  3.0  ", keep: true };
  const versionSnapshot = JSON.stringify(versionInput);
  assert.equal(projectContractVersion(versionInput).ok, true);
  assert.equal(JSON.stringify(versionInput), versionSnapshot);

  const decisionInput = {
    compatible: false,
    decisionCode: "NO",
    currentVersion: "1",
    requiredVersion: "2",
    reason: "x",
    meta: { a: 1 },
  };
  const decisionSnapshot = JSON.stringify(decisionInput);
  assert.equal(projectCompatibilityDecision(decisionInput).ok, true);
  assert.equal(JSON.stringify(decisionInput), decisionSnapshot);
});

test("32. canonical output immutability is preserved", () => {
  const key = projectIdempotencyKey("frozen-key").value;
  const identity = projectOperationIdentity({
    operationId: "op-frozen",
    idempotencyKey: "ik-frozen",
    correlationId: "corr-frozen",
  }).value;
  const version = projectContractVersion("1.0.0").value;
  const decision = projectCompatibilityDecision({
    compatible: true,
    decisionCode: "OK",
    currentVersion: "1.0.0",
  }).value;

  assert.equal(typeof key, "string");
  assert.equal(Object.isFrozen(identity), true);
  assert.equal(typeof version, "string");
  assert.equal(Object.isFrozen(decision), true);
  assert.throws(() => {
    /** @type {any} */ (identity).operationId = "mutated";
  }, TypeError);
  assert.throws(() => {
    /** @type {any} */ (decision).compatible = false;
  }, TypeError);
});

test("33. public adapter exports exist via barrel", () => {
  assert.equal(typeof projectIdempotencyKey, "function");
  assert.equal(typeof projectOperationIdentity, "function");
  assert.equal(typeof projectContractVersion, "function");
  assert.equal(typeof projectCompatibilityDecision, "function");
});

test("35. Identity/Tenant adapters remain available", () => {
  const actor = projectIdentityActor({
    actorType: "USER",
    id: "op-compat-user",
  });
  assert.equal(actor.ok, true);
  const scope = projectTenantScope({ scopeType: "TENANT", tenantId: "t-op" });
  assert.equal(scope.ok, true);
});

test("36. Event/Audit adapters remain available", () => {
  const trace = projectEventTraceContext({ correlationId: "corr-op" });
  assert.equal(trace.ok, true);
  const envelope = projectCommonEventEnvelope({
    eventId: "evt-op",
    eventType: "operation.projected",
    occurredAt: "2026-07-24T00:00:00.000Z",
    sourceModule: "platform-core",
    payloadVersion: "1.0.0",
    actor: { actorType: "SYSTEM", actorId: "platform" },
    payload: { ok: true },
  });
  assert.equal(envelope.ok, true);
});

test("38. no Business Module import", () => {
  for (const { name, source } of readAdapterSources()) {
    assert.equal(/src\/features\//.test(source), false, name);
    assert.equal(/src\/auth\//.test(source), false, name);
    assert.equal(
      /from\s+["'][^"']*(?:finance|crm|competition-core|player-rating|notifications)/.test(
        source
      ),
      false,
      name
    );
  }
});

test("invalid nested idempotency key on operation identity", () => {
  assert.equal(
    projectOperationIdentity({
      operationId: "op-bad-key",
      idempotencyKey: "   ",
    }).error.code,
    OPERATION_IDENTITY_ADAPTER_ERROR.IDEMPOTENCY_KEY_INVALID
  );
});

test("invalid nested versions on compatibility decision", () => {
  assert.equal(
    projectCompatibilityDecision({
      compatible: true,
      decisionCode: "OK",
      currentVersion: "   ",
    }).error.code,
    COMPATIBILITY_DECISION_ADAPTER_ERROR.CURRENT_VERSION_INVALID
  );
  assert.equal(
    projectCompatibilityDecision({
      compatible: true,
      decisionCode: "OK",
      requiredVersion: 12,
    }).error.code,
    COMPATIBILITY_DECISION_ADAPTER_ERROR.REQUIRED_VERSION_INVALID
  );
});
