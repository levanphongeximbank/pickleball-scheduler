/**
 * CORE-10 Phase 1H — Deterministic Candidate Source Contract.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as OptimizerPublic from "../src/features/competition-core/optimizer/index.js";

import {
  CANDIDATE_RANKING_FAILURE_CODE,
  OPTIMIZATION_FAILURE_CODE,
  CORE10_CANDIDATE_SOURCE_PORT_V1,
  OptimizerContractError,
  createCandidateBatch,
  createCandidateSourcePort,
  isCandidateSourcePort,
  createFixedCandidateSourcePort,
  serializeCanonical,
} from "../src/features/competition-core/optimizer/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPT_ROOT = path.join(ROOT, "src/features/competition-core/optimizer");
const ROOT_BARREL = path.join(ROOT, "src/features/competition-core/index.js");
const BATCH_FILE = path.join(OPT_ROOT, "contracts/candidateBatch.js");
const PORT_FILE = path.join(OPT_ROOT, "ports/candidateSourcePort.js");

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

function baseBatch(overrides = {}) {
  return {
    candidates: [
      {
        candidateId: "cand-b",
        assignments: [{ variableId: "var-a", valueId: "a1" }],
      },
      {
        candidateId: "cand-a",
        assignments: [{ variableId: "var-a", valueId: "a2" }],
      },
    ],
    decisionVariables: [
      { variableId: "var-a", domain: ["a1", "a2"], required: true },
    ],
    objectiveExecutionSpecs: [
      {
        objectiveId: "OBJ_A",
        objectiveVersion: "1",
        weight: 1,
        quantizeScale: 1,
      },
    ],
    authorityValues: [0],
    ...overrides,
  };
}

function assertContractError(fn, code) {
  assert.throws(fn, (err) => {
    assert.equal(err instanceof OptimizerContractError, true);
    assert.equal(err.code, code);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Candidate Batch
// ---------------------------------------------------------------------------

test("T01: createCandidateBatch creates a valid batch", () => {
  const batch = createCandidateBatch(baseBatch());
  assert.equal(batch.candidates.length, 2);
  assert.equal(batch.candidates[0].candidateId, "cand-b");
  assert.equal(batch.candidates[1].candidateId, "cand-a");
  assert.equal(batch.decisionVariables.length, 1);
  assert.equal(batch.objectiveExecutionSpecs.length, 1);
  assert.deepEqual([...batch.authorityValues], [0]);
});

test("T02: allows an empty candidates array", () => {
  const batch = createCandidateBatch(baseBatch({ candidates: [] }));
  assert.equal(batch.candidates.length, 0);
  assert.equal(Object.isFrozen(batch.candidates), true);
});

test("T03: rejects missing required fields", () => {
  assertContractError(
    () => createCandidateBatch({ candidates: [] }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertContractError(
    () =>
      createCandidateBatch({
        candidates: [],
        decisionVariables: [],
        objectiveExecutionSpecs: [],
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T04: rejects unknown top-level fields", () => {
  assertContractError(
    () => createCandidateBatch(baseBatch({ provenance: "x" })),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T05: rejects malformed candidate", () => {
  assertContractError(
    () =>
      createCandidateBatch(
        baseBatch({
          candidates: ["not-an-object"],
        })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertContractError(
    () =>
      createCandidateBatch(
        baseBatch({
          candidates: [{ candidateId: "c1", assignments: [], extra: 1 }],
        })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T06: rejects empty candidateId", () => {
  assertContractError(
    () =>
      createCandidateBatch(
        baseBatch({
          candidates: [{ candidateId: "  ", assignments: [] }],
        })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T07: rejects duplicate candidateId", () => {
  assertContractError(
    () =>
      createCandidateBatch(
        baseBatch({
          candidates: [
            { candidateId: "same", assignments: [] },
            { candidateId: "same", assignments: [] },
          ],
        })
      ),
    CANDIDATE_RANKING_FAILURE_CODE.DUPLICATE_CANDIDATE_ID
  );
});

test("T08: preserves structural duplicates with different IDs", () => {
  const assignments = [{ variableId: "var-a", valueId: "a1" }];
  const batch = createCandidateBatch(
    baseBatch({
      candidates: [
        { candidateId: "c1", assignments },
        { candidateId: "c2", assignments },
      ],
    })
  );
  assert.equal(batch.candidates.length, 2);
  assert.deepEqual(batch.candidates[0].assignments, batch.candidates[1].assignments);
  assert.notEqual(batch.candidates[0].candidateId, batch.candidates[1].candidateId);
});

test("T09: validates assignment structure", () => {
  assertContractError(
    () =>
      createCandidateBatch(
        baseBatch({
          candidates: [
            {
              candidateId: "c1",
              assignments: [{ variableId: "var-a" }],
            },
          ],
        })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
  assertContractError(
    () =>
      createCandidateBatch(
        baseBatch({
          candidates: [
            {
              candidateId: "c1",
              assignments: [{ variableId: "var-a", valueId: "a1", extra: true }],
            },
          ],
        })
      ),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T10: does not mutate caller input", () => {
  const input = baseBatch();
  const before = serializeCanonical(input);
  createCandidateBatch(input);
  assert.equal(serializeCanonical(input), before);
  assert.equal(Object.isFrozen(input), false);
  assert.equal(Object.isFrozen(input.candidates), false);
});

test("T11: clones nested arrays/objects", () => {
  const assignments = [{ variableId: "var-a", valueId: "a1" }];
  const input = baseBatch({
    candidates: [{ candidateId: "c1", assignments }],
  });
  const batch = createCandidateBatch(input);
  assert.notEqual(batch.candidates, input.candidates);
  assert.notEqual(batch.candidates[0].assignments, assignments);
  assert.notEqual(batch.decisionVariables, input.decisionVariables);
  assert.notEqual(batch.decisionVariables[0].domain, input.decisionVariables[0].domain);
  assert.notEqual(batch.authorityValues, input.authorityValues);
});

test("T12: freezes returned batch", () => {
  const batch = createCandidateBatch(baseBatch());
  assert.equal(Object.isFrozen(batch), true);
  assert.throws(() => {
    /** @type {any} */ (batch).candidates = [];
  });
});

test("T13: freezes nested candidate structures", () => {
  const batch = createCandidateBatch(baseBatch());
  assert.equal(Object.isFrozen(batch.candidates), true);
  assert.equal(Object.isFrozen(batch.candidates[0]), true);
  assert.equal(Object.isFrozen(batch.candidates[0].assignments), true);
  assert.equal(Object.isFrozen(batch.candidates[0].assignments[0]), true);
  assert.equal(Object.isFrozen(batch.decisionVariables), true);
  assert.equal(Object.isFrozen(batch.decisionVariables[0]), true);
  assert.equal(Object.isFrozen(batch.decisionVariables[0].domain), true);
});

// ---------------------------------------------------------------------------
// Candidate Source Port
// ---------------------------------------------------------------------------

test("T14: creates a valid synchronous source port", () => {
  const port = createCandidateSourcePort({
    portId: "src-fixed-1",
    produce() {
      return baseBatch();
    },
  });
  assert.equal(port.portId, "src-fixed-1");
  assert.equal(port.portVersion, CORE10_CANDIDATE_SOURCE_PORT_V1);
  const batch = port.produce({ requestId: "r1" }, { note: "ctx" });
  assert.equal(batch.candidates.length, 2);
  assert.equal(Object.isFrozen(batch), true);
});

test("T15: isCandidateSourcePort returns true for valid port", () => {
  const port = createCandidateSourcePort({
    portId: "src-1",
    produce() {
      return baseBatch({ candidates: [] });
    },
  });
  assert.equal(isCandidateSourcePort(port), true);
  assert.equal(isCandidateSourcePort({ portId: "x", portVersion: "v", produce() {} }), false);
  assert.equal(isCandidateSourcePort(null), false);
});

test("T16: rejects missing produce", () => {
  assertContractError(
    () => createCandidateSourcePort({ portId: "src-1" }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T17: rejects non-function produce", () => {
  assertContractError(
    () =>
      createCandidateSourcePort({
        portId: "src-1",
        produce: "nope",
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T18: rejects unknown port fields", () => {
  assertContractError(
    () =>
      createCandidateSourcePort({
        portId: "src-1",
        produce() {
          return baseBatch({ candidates: [] });
        },
        strategy: "greedy",
      }),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T19: validates returned Candidate Batch", () => {
  const port = createCandidateSourcePort({
    portId: "src-1",
    produce() {
      return { candidates: [] };
    },
  });
  assertContractError(
    () => port.produce({}, {}),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T20: rejects Promise return", async () => {
  const port = createCandidateSourcePort({
    portId: "src-1",
    produce() {
      return Promise.resolve(baseBatch({ candidates: [] }));
    },
  });
  assertContractError(
    () => port.produce({}, {}),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T21: rejects generic thenable return", () => {
  const port = createCandidateSourcePort({
    portId: "src-1",
    produce() {
      return { then() {} };
    },
  });
  assertContractError(
    () => port.produce({}, {}),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T22: preserves thrown OptimizerContractError; wraps other throws", () => {
  const contractPort = createCandidateSourcePort({
    portId: "src-1",
    produce() {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE,
        "domain boom",
        {}
      );
    },
  });
  assertContractError(
    () => contractPort.produce({}, {}),
    OPTIMIZATION_FAILURE_CODE.INVALID_CANDIDATE
  );

  const wrapPort = createCandidateSourcePort({
    portId: "src-2",
    produce() {
      throw new Error("unexpected");
    },
  });
  assertContractError(
    () => wrapPort.produce({}, {}),
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );
});

test("T23: prevents raw mutable source output from escaping", () => {
  const raw = baseBatch({
    candidates: [{ candidateId: "c1", assignments: [{ variableId: "var-a", valueId: "a1" }] }],
  });
  const port = createCandidateSourcePort({
    portId: "src-1",
    produce() {
      return raw;
    },
  });
  const batch = port.produce({}, {});
  assert.notEqual(batch, raw);
  assert.notEqual(batch.candidates, raw.candidates);
  raw.candidates[0].candidateId = "mutated";
  assert.equal(batch.candidates[0].candidateId, "c1");
});

test("T24: repeated produce calls return equivalent deterministic structure", () => {
  const port = createCandidateSourcePort({
    portId: "src-1",
    produce() {
      return baseBatch();
    },
  });
  const a = port.produce({ n: 1 }, { k: "v" });
  const b = port.produce({ n: 1 }, { k: "v" });
  assert.equal(serializeCanonical(a), serializeCanonical(b));
  assert.notEqual(a, b);
});

test("T25: caller/source mutation after produce does not change prior output", () => {
  const mutableAssignments = [{ variableId: "var-a", valueId: "a1" }];
  const mutable = baseBatch({
    candidates: [{ candidateId: "c1", assignments: mutableAssignments }],
  });
  const port = createCandidateSourcePort({
    portId: "src-1",
    produce() {
      return mutable;
    },
  });
  const first = port.produce({}, {});
  const fingerprint = serializeCanonical(first);
  mutable.candidates[0].candidateId = "changed";
  mutableAssignments[0].valueId = "a2";
  mutable.authorityValues.push(9);
  assert.equal(serializeCanonical(first), fingerprint);
  assert.equal(first.candidates[0].candidateId, "c1");
  assert.equal(first.candidates[0].assignments[0].valueId, "a1");
});

// ---------------------------------------------------------------------------
// Fixed source helper
// ---------------------------------------------------------------------------

test("T26: fixed source returns a valid frozen Candidate Batch", () => {
  const port = createFixedCandidateSourcePort({
    portId: "fixed-1",
    batch: baseBatch({ candidates: [] }),
  });
  assert.equal(isCandidateSourcePort(port), true);
  const batch = port.produce({}, {});
  assert.equal(Object.isFrozen(batch), true);
  assert.equal(batch.candidates.length, 0);
});

test("T27: fixed source repeated calls are deterministic", () => {
  const port = createFixedCandidateSourcePort({
    portId: "fixed-1",
    batch: baseBatch(),
  });
  const a = port.produce({ x: 1 }, null);
  const b = port.produce({ x: 2 }, { different: true });
  assert.equal(serializeCanonical(a), serializeCanonical(b));
  assert.notEqual(a, b);
});

test("T28: mutation of original fixed input does not affect output", () => {
  const input = baseBatch({
    candidates: [{ candidateId: "c1", assignments: [{ variableId: "var-a", valueId: "a1" }] }],
  });
  const port = createFixedCandidateSourcePort({
    portId: "fixed-1",
    batch: input,
  });
  const before = serializeCanonical(port.produce({}, {}));
  input.candidates[0].candidateId = "mutated";
  input.candidates[0].assignments[0].valueId = "a2";
  assert.equal(serializeCanonical(port.produce({}, {})), before);
});

// ---------------------------------------------------------------------------
// Boundary / regression guards
// ---------------------------------------------------------------------------

test("T29: no Math.random usage in Phase 1H sources", () => {
  for (const file of [BATCH_FILE, PORT_FILE]) {
    const src = readFileSync(file, "utf8");
    assert.equal(src.includes("Math.random"), false, file);
  }
});

test("T30: no Date/timer usage in Phase 1H sources", () => {
  for (const file of [BATCH_FILE, PORT_FILE]) {
    const src = readFileSync(file, "utf8");
    for (const banned of [
      "Date.now",
      "new Date",
      "setTimeout",
      "setInterval",
      "performance.now",
      "process.hrtime",
    ]) {
      assert.equal(src.includes(banned), false, `${file}:${banned}`);
    }
  }
});

test("T31: no sibling CORE imports in Phase 1H sources", () => {
  for (const file of [BATCH_FILE, PORT_FILE]) {
    const src = readFileSync(file, "utf8");
    for (const banned of [
      "competition-core/constraints",
      "competition-core/match-generation",
      "competition-core/scheduling",
      "competition-core/court-assignment",
      "competition-core/referee-assignment",
      "competition-core/registration-eligibility",
      "competition-core/lineups",
    ]) {
      assert.equal(src.includes(banned), false, `${file}:${banned}`);
    }
  }
});

test("T32: root competition-core barrel unchanged for Phase 1H symbols", () => {
  const root = readFileSync(ROOT_BARREL, "utf8");
  assert.equal(root.includes("createCandidateBatch"), false);
  assert.equal(root.includes("createCandidateSourcePort"), false);
  assert.equal(root.includes("CORE10_CANDIDATE_SOURCE_PORT_V1"), false);
  assert.equal(root.includes("createFixedCandidateSourcePort"), false);
});

test("T33: capability version and exports are capability-local", () => {
  assert.equal(CORE10_CANDIDATE_SOURCE_PORT_V1, "CORE10_CANDIDATE_SOURCE_PORT_V1");
  assert.equal(
    OptimizerPublic.CORE10_CANDIDATE_SOURCE_PORT_V1,
    "CORE10_CANDIDATE_SOURCE_PORT_V1"
  );
  assert.equal(
    OptimizerPublic.CORE10_IDENTITY.candidateSourcePortV1,
    "CORE10_CANDIDATE_SOURCE_PORT_V1"
  );
  assert.equal(typeof OptimizerPublic.createCandidateBatch, "function");
  assert.equal(typeof OptimizerPublic.createCandidateSourcePort, "function");
  assert.equal(typeof OptimizerPublic.isCandidateSourcePort, "function");
  assert.equal(typeof OptimizerPublic.createFixedCandidateSourcePort, "function");
});

test("T34: Phase 1H sources stay within optimizer capability tree", () => {
  const files = listJsFiles(path.join(OPT_ROOT, "ports")).concat(
    listJsFiles(path.join(OPT_ROOT, "contracts"))
  );
  assert.equal(files.some((f) => f.endsWith("candidateSourcePort.js")), true);
  assert.equal(files.some((f) => f.endsWith("candidateBatch.js")), true);
  const portSrc = readFileSync(PORT_FILE, "utf8");
  assert.equal(portSrc.includes("optimizeSuppliedCandidates"), false);
  assert.equal(portSrc.includes("async function"), false);
  assert.equal(portSrc.includes(" await "), false);
});

test("T35: does not reorder caller candidate order", () => {
  const batch = createCandidateBatch(
    baseBatch({
      candidates: [
        { candidateId: "z", assignments: [] },
        { candidateId: "a", assignments: [] },
        { candidateId: "m", assignments: [] },
      ],
    })
  );
  assert.deepEqual(
    batch.candidates.map((c) => c.candidateId),
    ["z", "a", "m"]
  );
});
