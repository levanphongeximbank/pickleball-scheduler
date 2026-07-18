import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createParticipantResolver,
  createLegacyParticipantAdapter,
  createParticipantIdentity,
  buildParticipantIdentityKey,
  PARTICIPANT_RUNTIME_ERROR_CODE,
  PARTICIPANT_ADAPTER_ID,
  registerParticipantCapabilityWave1,
  PARTICIPANT_CAPABILITY_MODULE_PATHS,
  PARTICIPANT_CAPABILITY_WAVE1_VERSION,
  RUNTIME_CAPABILITY,
  RUNTIME_EXECUTOR,
  RUNTIME_MODE,
  resolveRuntimeDecision,
  resolveShadowEligibility,
  resolveCapabilityExecutor,
  registerCapabilityExecutor,
  getShadowComparatorRegistration,
  getShadowNormalizerRegistration,
  getEligibilityAllowlistRegistration,
  resetCapabilityExecutorRegistryForTests,
  resetShadowComparatorRegistryForTests,
  resetShadowNormalizerRegistryForTests,
  resetEligibilityAllowlistRegistryForTests,
  isCapabilityExecutorRegistryEmpty,
  REGISTRY_REASON_CODE,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resetRegistries() {
  resetCapabilityExecutorRegistryForTests();
  resetShadowComparatorRegistryForTests();
  resetShadowNormalizerRegistryForTests();
  resetEligibilityAllowlistRegistryForTests();
}

test("3B Wave1: root exports ParticipantResolver public surface", () => {
  assert.equal(typeof createParticipantResolver, "function");
  assert.equal(typeof createLegacyParticipantAdapter, "function");
  assert.equal(typeof createParticipantIdentity, "function");
  assert.equal(typeof buildParticipantIdentityKey, "function");
  assert.equal(typeof PARTICIPANT_RUNTIME_ERROR_CODE.PARTICIPANT_NOT_FOUND, "string");
  assert.equal(PARTICIPANT_ADAPTER_ID.LEGACY, "LegacyParticipantAdapter");
});

test("3B Wave1: explicit registration is idempotent and Legacy-only", () => {
  resetRegistries();
  assert.equal(isCapabilityExecutorRegistryEmpty(), true);

  const first = registerParticipantCapabilityWave1();
  assert.equal(first.ok, true);
  assert.equal(first.version, PARTICIPANT_CAPABILITY_WAVE1_VERSION);
  assert.equal(first.capability, RUNTIME_CAPABILITY.PARTICIPANT);
  assert.equal(first.executor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(first.steps.every((s) => s.alreadyRegistered === false), true);

  const resolved = resolveCapabilityExecutor(RUNTIME_CAPABILITY.PARTICIPANT);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.value.executor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(
    resolved.value.modulePath,
    PARTICIPANT_CAPABILITY_MODULE_PATHS.executor
  );

  const cmp = getShadowComparatorRegistration(RUNTIME_CAPABILITY.PARTICIPANT);
  assert.equal(cmp.modulePath, PARTICIPANT_CAPABILITY_MODULE_PATHS.comparator);
  const norm = getShadowNormalizerRegistration(RUNTIME_CAPABILITY.PARTICIPANT);
  assert.equal(norm.modulePath, PARTICIPANT_CAPABILITY_MODULE_PATHS.normalizer);
  const allow = getEligibilityAllowlistRegistration(RUNTIME_CAPABILITY.PARTICIPANT);
  assert.ok(allow.operations.includes("resolve"));

  const second = registerParticipantCapabilityWave1();
  assert.equal(second.ok, true);
  assert.equal(second.steps.every((s) => s.alreadyRegistered === true), true);

  resetRegistries();
});

test("3B Wave1: import does not auto-register Participant capability", () => {
  resetRegistries();
  assert.equal(isCapabilityExecutorRegistryEmpty(), true);
  assert.equal(
    resolveCapabilityExecutor(RUNTIME_CAPABILITY.PARTICIPANT).ok,
    false
  );
});

test("3B Wave1: Production safety defaults remain Legacy-only / Shadow OFF", () => {
  resetRegistries();
  registerParticipantCapabilityWave1();
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(resolveShadowEligibility({}).eligible, false);
  resetRegistries();
});

test("3B Wave1: registration does not invoke Production resolve path", async () => {
  resetRegistries();
  registerParticipantCapabilityWave1();
  // Explicit factory still works independently of registry descriptors.
  const resolver = createParticipantResolver();
  const result = await resolver.resolve({
    competitionId: "comp-wave1",
    source: { id: "p-w1", name: "Wave1" },
  });
  assert.equal(result.ok, true);
  resetRegistries();
});

test("3B Wave1: official manifest includes Phase 3B test paths once", () => {
  const official = JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
  const phase = JSON.parse(
    readFileSync(
      path.join(ROOT, "scripts/ci/unit-test-files.phase-3b.json"),
      "utf8"
    )
  );
  for (const entry of phase) {
    const hits = official.filter((f) => f === entry);
    assert.equal(hits.length, 1, `expected exactly one ${entry}`);
  }
  assert.equal(
    official.includes(
      "tests/competition-core-participant-integrator-3b-wave1.test.js"
    ),
    true
  );
});

test("3B Wave1: divergent duplicate registration is rejected without overwrite", () => {
  resetRegistries();
  const first = registerParticipantCapabilityWave1();
  assert.equal(first.ok, true);

  const conflict = registerCapabilityExecutor({
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
    executor: RUNTIME_EXECUTOR.LEGACY,
    modulePath: "participants/runtime/OTHER.js",
    metadata: { phase: "conflict" },
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reasonCode, REGISTRY_REASON_CODE.DUPLICATE_REGISTRATION);

  const resolved = resolveCapabilityExecutor(RUNTIME_CAPABILITY.PARTICIPANT);
  assert.equal(resolved.ok, true);
  assert.equal(
    resolved.value.modulePath,
    PARTICIPANT_CAPABILITY_MODULE_PATHS.executor
  );

  const again = registerParticipantCapabilityWave1();
  assert.equal(again.ok, true);
  assert.equal(again.steps.every((s) => s.alreadyRegistered === true), true);
  resetRegistries();
});
