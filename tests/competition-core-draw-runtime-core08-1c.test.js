/**
 * CORE-08 Phase 1C — generic constraint resolver hardening tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDrawResolver,
  createDrawPlacement,
  buildGroupIdentityKey,
  buildDrawIdentityKey,
  matchesConstraintResolver,
  DRAW_RUNTIME_ERROR_CODE,
  DRAW_MODE,
  DRAW_CERTIFICATION_ERROR_CODE,
  runConstraintGroupingAdapter,
  CONSTRAINT_GROUPING_ADAPTER_ID,
} from "../src/features/competition-core/draw-runtime/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_ROOT = path.join(
  ROOT,
  "src/features/competition-core/draw-runtime"
);
const ADAPTER_FILE = path.join(
  RUNTIME_ROOT,
  "adapters/constraintGroupingAdapter.js"
);

function seedCandidates(n = 8) {
  return Array.from({ length: n }, (_, i) => ({
    id: `e-${i + 1}`,
    entryId: `e-${i + 1}`,
    seedNumber: i + 1,
  }));
}

function baseRequest(overrides = {}) {
  return {
    competitionId: "comp-1c",
    contextId: "event-1c",
    drawMode: DRAW_MODE.SNAKE_GROUPS,
    groupCount: 4,
    candidates: seedCandidates(8),
    deterministicSeed: "core08-1c-seed",
    ...overrides,
  };
}

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

function swapTwoGroupPlacements(placements, refA, refB) {
  const a = placements.find(
    (p) => p.metadata && p.metadata.candidateReference === refA
  );
  const b = placements.find(
    (p) => p.metadata && p.metadata.candidateReference === refB
  );
  assert.ok(a && b, "swap targets must exist");
  const next = placements.map((p) => {
    if (p === a) {
      return createDrawPlacement({
        ...b,
        candidateIdentityKey: a.candidateIdentityKey,
        seedNumber: a.seedNumber,
        placementReason: a.placementReason,
        placementType: a.placementType,
        metadata: {
          ...(b.metadata || {}),
          candidateReference: refA,
        },
      });
    }
    if (p === b) {
      return createDrawPlacement({
        ...a,
        candidateIdentityKey: b.candidateIdentityKey,
        seedNumber: b.seedNumber,
        placementReason: b.placementReason,
        placementType: b.placementType,
        metadata: {
          ...(a.metadata || {}),
          candidateReference: refB,
        },
      });
    }
    return p;
  });
  return next;
}

// --- No-resolver compatibility ---

test("1C: without constraintResolver output matches Phase 3H baseline", async () => {
  const baseline = createDrawResolver();
  const hardened = createDrawResolver({});
  const request = baseRequest();
  const a = await baseline.resolve(request);
  const b = await hardened.resolve(request);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(b.diagnostics.constraintResolverInvoked, false);
  assert.deepEqual(
    a.placements.map((p) => [
      p.candidateIdentityKey,
      p.groupIdentityKey,
      p.positionNumber,
      p.seedNumber,
    ]),
    b.placements.map((p) => [
      p.candidateIdentityKey,
      p.groupIdentityKey,
      p.positionNumber,
      p.seedNumber,
    ])
  );
  assert.deepEqual(a.decisionTrace, b.decisionTrace);
});

test("1C: adapter empty constraints still snake via Phase 3H", async () => {
  const result = await runConstraintGroupingAdapter({
    competitionId: "c",
    contextId: "x",
    entries: seedCandidates(8).map((e) => ({ id: e.id, seedNumber: e.seedNumber })),
    groupCount: 4,
    constraints: [],
  });
  assert.equal(result.ok, true);
  assert.equal(result.target, "D_CONSTRAINT_GROUPING");
  assert.ok(result.diagnostics.calledPhase3h);
});

// --- Valid resolver ---

test("1C: resolver invoked exactly once with normalized canonical data", async () => {
  let calls = 0;
  /** @type {unknown} */
  let seen = null;
  const resolver = createDrawResolver({
    constraintResolver(input) {
      calls += 1;
      seen = input;
      return { ok: true, accepted: true };
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(result.diagnostics.constraintResolverCallCount, 1);
  assert.equal(result.diagnostics.constraintResolverInvoked, true);
  assert.ok(seen && typeof seen === "object");
  assert.equal(seen.competitionId, "comp-1c");
  assert.equal(seen.contextId, "event-1c");
  assert.equal(seen.drawMode, DRAW_MODE.SNAKE_GROUPS);
  assert.equal(seen.deterministicSeed, "core08-1c-seed");
  assert.equal(seen.placements.length, 8);
  assert.equal(seen.candidates.length, 8);
  assert.ok(Object.isFrozen(seen));
  assert.ok(Object.isFrozen(seen.placements));
  assert.ok(result.decisionTrace.includes("CONSTRAINT_RESOLVER"));
  assert.ok(result.decisionTrace.includes("CONSTRAINT_ACCEPTED"));
});

test("1C: resolver can return valid adjusted placement and is revalidated", async () => {
  const resolver = createDrawResolver({
    constraintResolver(input) {
      const adjusted = swapTwoGroupPlacements(
        [...input.placements],
        "e-3",
        "e-4"
      );
      return {
        ok: true,
        placements: adjusted,
        decisionTrace: ["SWAP:e-3<->e-4"],
      };
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.constraintOutcome, "ADJUSTED");
  assert.ok(result.decisionTrace.includes("CONSTRAINT_ADJUSTED"));
  assert.ok(result.decisionTrace.includes("SWAP:e-3<->e-4"));
  const byRef = Object.fromEntries(
    result.placements.map((p) => [
      p.metadata.candidateReference,
      p.metadata.groupNumber,
    ])
  );
  // After swap, e-3 and e-4 exchange groups relative to pure snake
  const baseline = await createDrawResolver().resolve(baseRequest());
  const baseByRef = Object.fromEntries(
    baseline.placements.map((p) => [
      p.metadata.candidateReference,
      p.metadata.groupNumber,
    ])
  );
  assert.equal(byRef["e-3"], baseByRef["e-4"]);
  assert.equal(byRef["e-4"], baseByRef["e-3"]);
  assert.equal(result.groups.length, 4);
});

test("1C: same deterministic input + resolver produce same output", async () => {
  const constraintResolver = (input) => ({
    ok: true,
    placements: swapTwoGroupPlacements([...input.placements], "e-1", "e-2"),
  });
  const a = await createDrawResolver({ constraintResolver }).resolve(
    baseRequest()
  );
  const b = await createDrawResolver({ constraintResolver }).resolve(
    baseRequest()
  );
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(
    a.placements.map((p) => [p.candidateIdentityKey, p.groupIdentityKey]),
    b.placements.map((p) => [p.candidateIdentityKey, p.groupIdentityKey])
  );
});

test("1C: port object { resolveConstraints } is accepted", async () => {
  let calls = 0;
  const resolver = createDrawResolver({
    constraintResolver: {
      resolveConstraints() {
        calls += 1;
        return { ok: true, accepted: true };
      },
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(matchesConstraintResolver({ resolveConstraints() {} }), true);
  assert.equal(matchesConstraintResolver(() => ({})), true);
  assert.equal(matchesConstraintResolver({}), false);
});

// --- Resolver failures ---

test("1C: malformed resolver output fails closed", async () => {
  const resolver = createDrawResolver({
    constraintResolver() {
      return null;
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_OUTPUT_INVALID
  );
});

test("1C: resolver typed throw returns typed failure", async () => {
  const { DrawRuntimeError } = await import(
    "../src/features/competition-core/draw-runtime/errors/DrawRuntimeError.js"
  );
  const resolver = createDrawResolver({
    constraintResolver() {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_RESOLUTION_FAILED,
        "cannot satisfy",
        { reason: "test" }
      );
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_RESOLUTION_FAILED
  );
  assert.equal(result.error.details.reason, "test");
});

test("1C: unknown candidates rejected", async () => {
  const resolver = createDrawResolver({
    constraintResolver(input) {
      const drawIdentityKey = input.drawIdentityKey;
      return {
        ok: true,
        placements: [
          ...input.placements.slice(0, -1),
          createDrawPlacement({
            drawIdentityKey,
            candidateIdentityKey: `${drawIdentityKey}::CANDIDATE::ghost`,
            groupIdentityKey: buildGroupIdentityKey({
              drawIdentityKey,
              groupNumber: 1,
            }),
            positionNumber: 9,
            metadata: { candidateReference: "ghost", groupNumber: 1 },
          }),
        ],
      };
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION
  );
});

test("1C: duplicate candidates rejected", async () => {
  const resolver = createDrawResolver({
    constraintResolver(input) {
      return {
        ok: true,
        placements: [...input.placements, input.placements[0]],
      };
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION
  );
});

test("1C: missing candidates rejected", async () => {
  const resolver = createDrawResolver({
    constraintResolver(input) {
      return { ok: true, placements: input.placements.slice(0, -1) };
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION
  );
});

test("1C: capacity overflow rejected", async () => {
  const resolver = createDrawResolver({
    constraintResolver(input) {
      const drawIdentityKey = input.drawIdentityKey;
      const g1 = buildGroupIdentityKey({ drawIdentityKey, groupNumber: 1 });
      return {
        ok: true,
        placements: input.placements.map((p, i) =>
          createDrawPlacement({
            ...p,
            groupIdentityKey: g1,
            positionNumber: i + 1,
            metadata: {
              ...(p.metadata || {}),
              groupNumber: 1,
            },
          })
        ),
      };
    },
  });
  const result = await resolver.resolve(
    baseRequest({ groupCount: 4, groupCapacity: 2 })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION
  );
});

test("1C: seed identity reassignment rejected", async () => {
  const resolver = createDrawResolver({
    constraintResolver(input) {
      return {
        ok: true,
        placements: input.placements.map((p) =>
          createDrawPlacement({
            ...p,
            seedNumber: (p.seedNumber || 0) + 10,
          })
        ),
      };
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION
  );
});

test("1C: manual placement violations rejected", async () => {
  const resolver = createDrawResolver({
    constraintResolver(input) {
      return {
        ok: true,
        placements: input.placements.map((p) => {
          if (p.metadata?.candidateReference !== "e-1") return p;
          return createDrawPlacement({
            ...p,
            groupIdentityKey: buildGroupIdentityKey({
              drawIdentityKey: input.drawIdentityKey,
              groupNumber: 2,
            }),
            metadata: { ...p.metadata, groupNumber: 2 },
          });
        }),
      };
    },
  });
  const result = await resolver.resolve(
    baseRequest({
      manualPlacements: [
        { candidateReference: "e-1", groupNumber: 1, positionNumber: 1 },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION
  );
});

test("1C: protected placement violations rejected", async () => {
  const resolver = createDrawResolver({
    constraintResolver(input) {
      return {
        ok: true,
        placements: input.placements.map((p) => {
          if (p.metadata?.candidateReference !== "e-2") return p;
          return createDrawPlacement({
            ...p,
            groupIdentityKey: buildGroupIdentityKey({
              drawIdentityKey: input.drawIdentityKey,
              groupNumber: 4,
            }),
            metadata: { ...p.metadata, groupNumber: 4 },
          });
        }),
      };
    },
  });
  const result = await resolver.resolve(
    baseRequest({
      protectedPlacements: [
        { candidateReference: "e-2", groupNumber: 3, positionNumber: 1 },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION
  );
});

test("1C: invalid group reference rejected", async () => {
  const resolver = createDrawResolver({
    constraintResolver(input) {
      return {
        ok: true,
        placements: input.placements.map((p, idx) =>
          idx === 0
            ? createDrawPlacement({
                ...p,
                groupIdentityKey: buildGroupIdentityKey({
                  drawIdentityKey: input.drawIdentityKey,
                  groupNumber: 99,
                }),
                metadata: { ...p.metadata, groupNumber: 99 },
              })
            : p
        ),
      };
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_INVARIANT_VIOLATION
  );
});

test("1C: fail-closed result envelope does not fall back to unconstrained", async () => {
  const resolver = createDrawResolver({
    constraintResolver() {
      return {
        ok: false,
        code: DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_RESOLUTION_FAILED,
        message: "unsatisfiable",
        details: { constraint: "demo" },
      };
    },
  });
  const result = await resolver.resolve(baseRequest());
  assert.equal(result.ok, false);
  assert.equal(result.placements.length, 0);
  assert.equal(
    result.error.code,
    DRAW_RUNTIME_ERROR_CODE.DRAW_CONSTRAINT_RESOLUTION_FAILED
  );
});

// --- Adapter behavior ---

test("1C adapter: non-empty constraints without resolver fail closed", async () => {
  const result = await runConstraintGroupingAdapter({
    competitionId: "c",
    contextId: "x",
    entries: seedCandidates(4).map((e) => ({ id: e.id, seedNumber: e.seedNumber })),
    groupCount: 2,
    constraints: [{ type: "avoid_same_group", anchorPlayerId: "p1" }],
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.code,
    DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_CONSTRAINTS_UNSUPPORTED
  );
});

test("1C adapter: non-empty constraints with resolver delegate to Phase 3H", async () => {
  let calls = 0;
  const result = await runConstraintGroupingAdapter(
    {
      competitionId: "c",
      contextId: "x",
      entries: seedCandidates(4).map((e) => ({
        id: e.id,
        seedNumber: e.seedNumber,
      })),
      groupCount: 2,
      constraints: [{ type: "avoid_same_group", anchorPlayerId: "p1" }],
    },
    {
      constraintResolver(input) {
        calls += 1;
        assert.ok(Array.isArray(input.context.constraints));
        assert.equal(input.context.constraints.length, 1);
        return { ok: true, accepted: true };
      },
    }
  );
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(result.diagnostics.calledPhase3h, true);
  assert.equal(
    result.canonical.diagnostics.constraintResolverInvoked,
    true
  );
  assert.equal(CONSTRAINT_GROUPING_ADAPTER_ID, "CORE08_CONSTRAINT_GROUPING_CERT");
});

test("1C adapter: no repair algorithm and no legacy constraint engine import", () => {
  const src = readFileSync(ADAPTER_FILE, "utf8");
  assert.doesNotMatch(src, /from\s+['"][^'"]*pairing-constraints/);
  assert.doesNotMatch(src, /from\s+['"][^'"]*constraintGroupEngine/);
  assert.doesNotMatch(src, /import\s*\{[^}]*assignGroupsWithConstraints/);
  assert.doesNotMatch(src, /function\s+repair/i);
  assert.match(src, /matchesConstraintResolver/);
});

// --- Architecture ---

test("1C architecture: no production/UI/DB/forbidden APIs in Phase 1C surface", () => {
  const files = [
    path.join(RUNTIME_ROOT, "DrawResolver.js"),
    path.join(RUNTIME_ROOT, "ports/constraintResolverPort.js"),
    path.join(RUNTIME_ROOT, "services/applyConstraintResolverHook.js"),
    path.join(RUNTIME_ROOT, "services/validateConstraintResolution.js"),
    ADAPTER_FILE,
  ];
  const forbidden = [
    /from\s+['"][^'"]*pages\//,
    /from\s+['"][^'"]*components\//,
    /from\s+['"][^'"]*supabase/,
    /from\s+['"]@mui\//,
    /from\s+['"][^'"]*pairing-constraints/,
    /from\s+['"][^'"]*team-tournament/,
    /from\s+['"][^'"]*tournament\/engines/,
    /Math\.random\s*\(/,
    /Date\.now\s*\(/,
    /new\s+Date\s*\(/,
    /localeCompare\s*\(/,
    /process\.env/,
  ];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.doesNotMatch(
        content,
        pattern,
        `${path.relative(ROOT, file)} matched ${pattern}`
      );
    }
  }
  // Phase 3H placement SSOT still owns snake etc.
  const assignGroups = readFileSync(
    path.join(RUNTIME_ROOT, "services/assignGroups.js"),
    "utf8"
  );
  assert.match(assignGroups, /export function assignSnakeGroups/);
  // Legacy adapter still present
  assert.ok(
    existsSync(path.join(RUNTIME_ROOT, "adapters/LegacyDrawAdapter.js"))
  );
});

test("1C architecture: draw-runtime tree still free of production engine imports", () => {
  const files = listJsFiles(RUNTIME_ROOT);
  assert.ok(files.length > 0);
  const pattern = /from\s+['"][^'"]*pairing-constraints/;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, pattern, path.relative(ROOT, file));
  }
});

test("1C: draw identity remains stable through constraint accept", async () => {
  const expected = buildDrawIdentityKey({
    competitionId: "comp-1c",
    contextId: "event-1c",
  });
  const result = await createDrawResolver({
    constraintResolver() {
      return { ok: true, accepted: true };
    },
  }).resolve(baseRequest());
  assert.equal(result.ok, true);
  assert.equal(result.identity.key, expected);
  assert.ok(result.placements.every((p) => p.drawIdentityKey === expected));
});
