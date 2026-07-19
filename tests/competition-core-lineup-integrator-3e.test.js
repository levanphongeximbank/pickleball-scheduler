import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createLineupResolver,
  createLegacyLineupAdapter,
  buildLineupIdentityKey,
  buildLineupSlotId,
  createLineupIdentity,
  LINEUP_RUNTIME_ERROR_CODE,
  LineupRuntimeError,
  isLineupRuntimeError,
  createLineupRuntimeError,
  LINEUP_ADAPTER_ID,
  LINEUP_SOURCE_TYPE,
  mapLegacyLineupToCompetitionLineup,
  createNoopLineupPolicy,
  resolveRuntimeDecision,
  resolveShadowEligibility,
  RUNTIME_MODE,
  RUNTIME_EXECUTOR,
} from "../src/features/competition-core/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function listJsFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith(".js") || name.endsWith(".jsx")) out.push(full);
  }
  return out;
}

function legacyLineup(overrides = {}) {
  return {
    matchupId: "mu-int-1",
    teamId: "team-int",
    status: "submitted",
    selections: {
      md: ["p-1", "p-2"],
      ms: ["p-3"],
    },
    submittedAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

test("3E Integrator: root exports approved Lineup Runtime public surface", () => {
  assert.equal(typeof createLineupResolver, "function");
  assert.equal(typeof createLegacyLineupAdapter, "function");
  assert.equal(typeof buildLineupIdentityKey, "function");
  assert.equal(typeof buildLineupSlotId, "function");
  assert.equal(typeof createLineupIdentity, "function");
  assert.equal(typeof LINEUP_RUNTIME_ERROR_CODE.LINEUP_NOT_FOUND, "string");
  assert.equal(typeof LineupRuntimeError, "function");
  assert.equal(typeof isLineupRuntimeError, "function");
  assert.equal(typeof createLineupRuntimeError, "function");
  assert.equal(LINEUP_ADAPTER_ID.LEGACY, "LEGACY_LINEUP");
  assert.equal(LINEUP_SOURCE_TYPE.LEGACY_LINEUP, "LEGACY_LINEUP");
  assert.equal(typeof mapLegacyLineupToCompetitionLineup, "function");
  assert.equal(typeof createNoopLineupPolicy, "function");
});

test("3E Integrator: root does not export persistence ports or private internals", async () => {
  const root = await import("../src/features/competition-core/index.js");
  const forbidden = [
    "LINEUP_PERSISTENCE_PORT_METHODS",
    "matchesLineupPersistencePort",
    "createNoopLineupPersistencePort",
    "createInMemoryLineupPersistencePort",
    "createLineupIdentityLookup",
    "requireLineupIdentity",
    "normalizeAndValidateLineup",
    "lineupResolveOk",
    "lineupResolveFail",
    "LINEUP_TRANSITION_MATRIX",
    "assertLineupTransitionAllowed",
    "LineupResolver",
    "LegacyLineupAdapter",
    "registerLineupCapability",
  ];
  for (const name of forbidden) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(root, name),
      false,
      `root must not export ${name}`
    );
  }
});

test("3E Integrator: createLineupResolver works through root import", async () => {
  const resolver = createLineupResolver();
  const source = legacyLineup();
  const result = await resolver.resolve({
    competitionId: "comp-int",
    source,
  });
  assert.equal(result.ok, true);
  assert.equal(result.lineup.teamId, "team-int");
  assert.equal(
    result.identity.key,
    buildLineupIdentityKey({
      competitionId: "comp-int",
      contextId: "mu-int-1",
      teamId: "team-int",
    })
  );
  assert.equal(result.diagnostics?.persistenceEnabled, false);
  assert.equal(source.teamId, "team-int");
});

test("3E Integrator: deterministic identities and slot ids", () => {
  const identity = createLineupIdentity({
    competitionId: "comp-a",
    contextId: "ctx-1",
    teamId: "team-1",
  });
  assert.equal(identity.key, "comp-a::LINEUP::ctx-1::team-1");
  assert.equal(
    buildLineupSlotId({
      lineupIdentityKey: identity.key,
      disciplineOrSideKey: "md",
      index: 0,
    }),
    "comp-a::LINEUP::ctx-1::team-1::md::0"
  );
  const other = createLineupIdentity({
    competitionId: "comp-b",
    contextId: "ctx-1",
    teamId: "team-1",
  });
  assert.notEqual(identity.key, other.key);
  assert.throws(() => {
    // @ts-expect-error frozen
    identity.key = "mutated";
  });
});

test("3E Integrator: typed LineupRuntimeError via root export", () => {
  const err = createLineupRuntimeError(
    LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
    "smoke",
    { competitionId: "c" }
  );
  assert.equal(isLineupRuntimeError(err), true);
  assert.equal(err.code, LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP);
});

test("3E Integrator: lineups modules do not import Team/Registration/Participant Runtime", () => {
  const lineupsRoot = path.join(ROOT, "src/features/competition-core/lineups");
  for (const file of listJsFiles(lineupsRoot)) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /participants\/runtime/);
    assert.doesNotMatch(content, /registrations\//);
    assert.doesNotMatch(content, /from\s+['"][^'"]*\/teams\//);
  }
});

test("3E Integrator: root import introduces no circular dependency (lineups re-export resolves)", async () => {
  const root = await import("../src/features/competition-core/index.js");
  const lineups = await import("../src/features/competition-core/lineups/index.js");
  assert.equal(root.createLineupResolver, lineups.createLineupResolver);
  assert.equal(root.buildLineupSlotId, lineups.buildLineupSlotId);
});

test("3E Integrator: Production safety — Legacy only, Shadow OFF, persistence OFF", async () => {
  const decision = resolveRuntimeDecision({});
  assert.equal(decision.selectedMode, RUNTIME_MODE.LEGACY_ONLY);
  assert.equal(decision.selectedExecutor, RUNTIME_EXECUTOR.LEGACY);
  assert.equal(decision.shadowAllowed, false);
  assert.equal(decision.canonicalAllowed, false);
  assert.equal(resolveShadowEligibility({}).eligible, false);

  const resolver = createLineupResolver();
  const result = await resolver.resolve({
    competitionId: "comp-safe",
    source: legacyLineup({ matchupId: "mu-safe" }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics?.persistenceEnabled, false);
});

test("3E Integrator: no Production page/API callers of Lineup Runtime", () => {
  const callerRoots = [
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/components"),
    path.join(ROOT, "src/features/team-tournament"),
    path.join(ROOT, "src/features/individual-tournament"),
  ];
  const patterns = [
    /competition-core\/lineups/,
    /createLineupResolver/,
  ];
  for (const dir of callerRoots) {
    if (!existsSync(dir)) continue;
    for (const file of listJsFiles(dir)) {
      const content = readFileSync(file, "utf8");
      for (const pattern of patterns) {
        assert.doesNotMatch(
          content,
          pattern,
          `Production caller in ${path.relative(ROOT, file)}`
        );
      }
    }
  }
});

test("3E Integrator: official manifest includes Phase 3E paths once", () => {
  const official = JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
  const required = [
    "tests/competition-core-lineup-runtime-3e.test.js",
    "tests/competition-core-lineup-runtime-3e-architecture.test.js",
    "tests/competition-core-lineup-integrator-3e.test.js",
  ];
  for (const entry of required) {
    assert.equal(
      official.filter((f) => f === entry).length,
      1,
      `expected exactly one ${entry}`
    );
  }
});

test("3E Integrator: no runtime-control LINEUP registration or feature-flag enablement", () => {
  const indexPath = path.join(ROOT, "src/features/competition-core/index.js");
  const content = readFileSync(indexPath, "utf8");
  assert.match(content, /from "\.\/lineups\/index\.js"/);
  assert.doesNotMatch(content, /registerLineupCapability/);

  const flags = readFileSync(
    path.join(ROOT, "src/features/competition-core/config/featureFlags.js"),
    "utf8"
  );
  assert.doesNotMatch(flags, /LINEUP_RUNTIME_V2|LINEUP_V2_ENABLED/);
});

test("3E Integrator: createNoopLineupPolicy via root is structural no-op", () => {
  const policy = createNoopLineupPolicy();
  assert.equal(typeof policy.validateSlots, "function");
  assert.equal(typeof policy.assertTransition, "function");
  const adapter = createLegacyLineupAdapter();
  assert.equal(adapter.id, LINEUP_ADAPTER_ID.LEGACY);
});
