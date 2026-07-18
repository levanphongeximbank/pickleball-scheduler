import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as CompetitionCore from "../src/features/competition-core/index.js";
import {
  RUNTIME_CAPABILITY,
  RUNTIME_EXECUTOR,
  RUNTIME_MODE,
  resolveRuntimeDecision,
  resolveShadowEligibility,
  REGISTRY_REASON_CODE,
  createCapabilityExecutorRegistry,
  createShadowComparatorRegistry,
  createShadowNormalizerRegistry,
  registerCapabilityExecutor,
  resolveCapabilityExecutor,
  listCapabilityExecutorRegistrations,
  isCapabilityExecutorRegistryEmpty,
  resetCapabilityExecutorRegistryForTests,
  registerShadowComparator,
  resolveShadowComparator,
  resetShadowComparatorRegistryForTests,
  registerShadowNormalizer,
  resolveShadowNormalizer,
  resetShadowNormalizerRegistryForTests,
  registerEligibilityAllowlist,
  resolveEligibilityAllowlistsFromRegistry,
  getDefaultCapabilityAllowlist,
  getDefaultOperationAllowlist,
  resetEligibilityAllowlistRegistryForTests,
  CAPABILITY_EXECUTOR_REGISTRY_VERSION,
  SHADOW_COMPARATOR_REGISTRY_VERSION,
  SHADOW_NORMALIZER_REGISTRY_VERSION,
  SHADOW_ELIGIBILITY_ALLOWLIST_REGISTRY_VERSION,
} from "../src/features/competition-core/index.js";

import {
  validateSharedFileOwnership,
  COMPETITION_PROTECTED_FILES,
} from "../scripts/ci/competition-shared-file-ownership.mjs";
import { validatePhaseTestManifests } from "../scripts/ci/validate-phase-test-manifests.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resetSingletons() {
  resetCapabilityExecutorRegistryForTests();
  resetShadowComparatorRegistryForTests();
  resetShadowNormalizerRegistryForTests();
  resetEligibilityAllowlistRegistryForTests();
}

test("3A3 versions locked", () => {
  assert.equal(CAPABILITY_EXECUTOR_REGISTRY_VERSION, "3a3.0");
  assert.equal(SHADOW_COMPARATOR_REGISTRY_VERSION, "3a3.0");
  assert.equal(SHADOW_NORMALIZER_REGISTRY_VERSION, "3a3.0");
  assert.equal(SHADOW_ELIGIBILITY_ALLOWLIST_REGISTRY_VERSION, "3a3.0");
});

test("3A3 no import-time registrations on default singletons", () => {
  resetSingletons();
  assert.equal(isCapabilityExecutorRegistryEmpty(), true);
  assert.equal(listCapabilityExecutorRegistrations().length, 0);
});

test("3A3 capability registry: register / resolve / list deterministic", () => {
  const reg = createCapabilityExecutorRegistry();
  const a = reg.register({
    capability: RUNTIME_CAPABILITY.SEEDING,
    executor: RUNTIME_EXECUTOR.LEGACY,
    modulePath: "seed/runtime.js",
  });
  const b = reg.register({
    capability: RUNTIME_CAPABILITY.DRAW,
    executor: RUNTIME_EXECUTOR.LEGACY,
    modulePath: "draw/runtime.js",
  });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);

  const list = reg.list();
  assert.deepEqual(
    list.map((e) => e.capability),
    [RUNTIME_CAPABILITY.DRAW, RUNTIME_CAPABILITY.SEEDING]
  );

  const resolved = reg.resolve(RUNTIME_CAPABILITY.DRAW);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.value.modulePath, "draw/runtime.js");
});

test("3A3 capability registry: reject invalid / duplicate / unknown", () => {
  const reg = createCapabilityExecutorRegistry();
  const invalid = reg.register({
    capability: "not-a-capability",
    executor: RUNTIME_EXECUTOR.LEGACY,
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reasonCode, REGISTRY_REASON_CODE.INVALID_CAPABILITY_ID);

  assert.equal(
    reg.register({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      executor: RUNTIME_EXECUTOR.LEGACY,
    }).ok,
    true
  );
  const dup = reg.register({
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
    executor: RUNTIME_EXECUTOR.LEGACY,
  });
  assert.equal(dup.ok, false);
  assert.equal(dup.reasonCode, REGISTRY_REASON_CODE.DUPLICATE_REGISTRATION);

  const unknown = reg.resolve(RUNTIME_CAPABILITY.PUBLICATION);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reasonCode, REGISTRY_REASON_CODE.CAPABILITY_NOT_REGISTERED);
});

test("3A3 capability registry: freeze locks mutations", () => {
  const reg = createCapabilityExecutorRegistry();
  reg.register({
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
    executor: RUNTIME_EXECUTOR.LEGACY,
  });
  assert.equal(reg.freeze().ok, true);
  const locked = reg.register({
    capability: RUNTIME_CAPABILITY.REGISTRATION,
    executor: RUNTIME_EXECUTOR.LEGACY,
  });
  assert.equal(locked.ok, false);
  assert.equal(locked.reasonCode, REGISTRY_REASON_CODE.REGISTRY_LOCKED);
});

test("3A3 capability registry: isolated factory instances", () => {
  const a = createCapabilityExecutorRegistry();
  const b = createCapabilityExecutorRegistry();
  a.register({
    capability: RUNTIME_CAPABILITY.TEAM,
    executor: RUNTIME_EXECUTOR.LEGACY,
  });
  assert.equal(a.size(), 1);
  assert.equal(b.size(), 0);
});

test("3A3 singleton registerCapabilityExecutor mirrors factory semantics", () => {
  resetSingletons();
  const ok = registerCapabilityExecutor({
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
    executor: RUNTIME_EXECUTOR.LEGACY,
    modulePath: "participants/runtime.js",
  });
  assert.equal(ok.ok, true);
  const resolved = resolveCapabilityExecutor(RUNTIME_CAPABILITY.PARTICIPANT);
  assert.equal(resolved.ok, true);
  resetSingletons();
});

test("3A3 comparator registry: register / resolve / duplicate / unknown", () => {
  const reg = createShadowComparatorRegistry();
  assert.equal(
    reg.register({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      modulePath: "participants/shadow/comparators/participant.js",
    }).ok,
    true
  );
  assert.equal(reg.resolve(RUNTIME_CAPABILITY.PARTICIPANT).ok, true);
  assert.equal(
    reg.register({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      modulePath: "x.js",
    }).reasonCode,
    REGISTRY_REASON_CODE.DUPLICATE_REGISTRATION
  );
  assert.equal(
    reg.resolve(RUNTIME_CAPABILITY.DRAW).reasonCode,
    REGISTRY_REASON_CODE.COMPARATOR_NOT_REGISTERED
  );
});

test("3A3 normalizer registry: register / resolve / no payload mutation", () => {
  const reg = createShadowNormalizerRegistry();
  const payload = { id: "1", nested: { a: 1 } };
  const before = JSON.stringify(payload);
  assert.equal(
    reg.register({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      modulePath: "participants/shadow/normalizers/participant.js",
    }).ok,
    true
  );
  assert.equal(reg.resolve(RUNTIME_CAPABILITY.PARTICIPANT).ok, true);
  assert.equal(JSON.stringify(payload), before);
  assert.equal(
    reg.resolve(RUNTIME_CAPABILITY.MATCH_GENERATION).reasonCode,
    REGISTRY_REASON_CODE.NORMALIZER_NOT_REGISTERED
  );
});

test("3A3 eligibility: empty deny; explicit allowlist does not wire Shadow", () => {
  resetSingletons();
  assert.deepEqual(getDefaultCapabilityAllowlist(), []);
  assert.deepEqual(getDefaultOperationAllowlist(), []);
  const empty = resolveEligibilityAllowlistsFromRegistry({
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
  });
  assert.deepEqual(empty.capabilityAllowlist, []);
  assert.equal(empty.eligibleByRegistry, false);

  assert.equal(
    registerEligibilityAllowlist({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      operations: ["resolve", "create"],
    }).ok,
    true
  );
  const resolved = resolveEligibilityAllowlistsFromRegistry({
    capability: RUNTIME_CAPABILITY.PARTICIPANT,
  });
  assert.deepEqual(resolved.capabilityAllowlist, [RUNTIME_CAPABILITY.PARTICIPANT]);
  assert.deepEqual(resolved.operationAllowlist, ["create", "resolve"]);
  assert.equal(resolved.eligibleByRegistry, true);

  // Not wired: resolveShadowEligibility still false by default
  assert.equal(resolveShadowEligibility({}).eligible, false);
  resetSingletons();
});

test("3A3 Production safety defaults unchanged", () => {
  resetSingletons();
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(resolveShadowEligibility({}).eligible, false);
});

test("3A3 public exports: existing symbols remain; new registry APIs available", () => {
  assert.equal(typeof CompetitionCore.resolveRuntimeDecision, "function");
  assert.equal(typeof CompetitionCore.resolveShadowEligibility, "function");
  assert.equal(typeof CompetitionCore.compareShadowResults, "function");
  assert.equal(typeof CompetitionCore.createCapabilityExecutorRegistry, "function");
  assert.equal(typeof CompetitionCore.REGISTRY_REASON_CODE, "object");
  assert.equal(CompetitionCore.RUNTIME_EXECUTOR.LEGACY, "LEGACY");
  assert.equal(CompetitionCore.RUNTIME_EXECUTOR.CANONICAL, undefined);
  // No capability business runtimes exported
  assert.equal(CompetitionCore.runParticipantRuntime, undefined);
  assert.equal(CompetitionCore.executeCanonicalParticipant, undefined);
});

test("3A3 shared-file ownership guard: capability phase blocked", () => {
  const result = validateSharedFileOwnership(
    [
      "src/features/competition-core/participants/runtime/x.js",
      "src/features/competition-core/index.js",
    ],
    "3b"
  );
  assert.equal(result.ok, false);
  assert.ok(result.violations.includes("src/features/competition-core/index.js"));
});

test("3A3 shared-file ownership guard: integrator phase allowed", () => {
  const result = validateSharedFileOwnership(
    [...COMPETITION_PROTECTED_FILES.slice(0, 3)],
    "3a3"
  );
  assert.equal(result.ok, true);
});

test("3A3 phase sub-manifest validation passes for 3a3", () => {
  const result = validatePhaseTestManifests("3a3");
  assert.equal(result.ok, true, result.errors.join("; "));
  const phase = JSON.parse(
    readFileSync(
      path.join(ROOT, "scripts/ci/unit-test-files.phase-3a3.json"),
      "utf8"
    )
  );
  const official = JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
  for (const entry of phase) {
    assert.ok(official.includes(entry), `missing from official: ${entry}`);
  }
});

test("3A3 singleton comparator/normalizer APIs", () => {
  resetSingletons();
  assert.equal(
    registerShadowComparator({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      modulePath: "p.js",
    }).ok,
    true
  );
  assert.equal(resolveShadowComparator(RUNTIME_CAPABILITY.PARTICIPANT).ok, true);
  assert.equal(
    registerShadowNormalizer({
      capability: RUNTIME_CAPABILITY.PARTICIPANT,
      modulePath: "n.js",
    }).ok,
    true
  );
  assert.equal(resolveShadowNormalizer(RUNTIME_CAPABILITY.PARTICIPANT).ok, true);
  resetSingletons();
});
