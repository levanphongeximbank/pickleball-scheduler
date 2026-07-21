/**
 * CORE-06 Phase 1D — deterministic random & missing-lineup policy tests.
 * Isolated domain only — no Production wiring.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  buildLineupIdentityKey,
  createDeterministicLineupRandomPort,
  createInMemoryLineupIdempotencyPort,
  createPermissiveLineupRandomPolicy,
  createFixedStrategyLineupRandomPolicy,
  createLineupPolicyResult,
  createMissingLineupResolver,
  composeCanonicalSeed,
  normalizeSeed,
  canonicalizeJsonValue,
  fingerprintValue,
  fingerprintSeed,
  fingerprintSelection,
  selectLineupDeterministic,
  LINEUP_RANDOM_ALGORITHM,
  CANONICAL_SEED_FIELDS,
  MISSING_LINEUP_OUTCOME,
  MISSING_LINEUP_POLICY,
  LINEUP_RUNTIME_ERROR_CODE,
} from "../src/features/competition-core/lineups/index.js";
import { PARTICIPANT_REFERENCE_KIND } from "../src/features/competition-core/participants/enums/identityKinds.js";
import { createCompetitionRosterMember } from "../src/features/competition-core/participants/contracts/teamRosterLineup.js";
import { createParticipantReference } from "../src/features/competition-core/participants/contracts/identity.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LINEUPS_ROOT = path.join(ROOT, "src/features/competition-core/lineups");
const TT_LINEUP_RANDOM = path.join(
  ROOT,
  "src/features/team-tournament/engines/lineupRandomEngine.js"
);

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

function person(id) {
  return createParticipantReference({
    kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
    id,
  });
}

function rosterWith(playerIds, overrides = {}) {
  return {
    id: "roster:team-1",
    competitionId: "comp-1",
    teamId: "team-1",
    version: 1,
    members: playerIds.map((id) =>
      createCompetitionRosterMember({
        id: `rm:team-1:PLAYER_PROFILE:${id}`,
        rosterId: "roster:team-1",
        person: person(id),
      })
    ),
    ...overrides,
  };
}

function slotTemplate(keys = ["md:0", "md:1"]) {
  return {
    slots: keys.map((k) => {
      const [disciplineOrSideKey, indexStr] = k.split(":");
      return {
        disciplineOrSideKey,
        index: Number(indexStr),
      };
    }),
  };
}

function baseRequest(overrides = {}) {
  const lineupIdentityKey = buildLineupIdentityKey({
    competitionId: "comp-1",
    contextId: "mu-1",
    teamId: "team-1",
  });
  return {
    seed: "owner-seed-alpha",
    lineupIdentityKey,
    rosterSnapshot: rosterWith(["p-1", "p-2", "p-3", "p-4"]),
    slotTemplate: slotTemplate(["md:0", "md:1"]),
    policy: createPermissiveLineupRandomPolicy(),
    scope: {
      tenantId: "tenant-1",
      competitionId: "comp-1",
      teamId: "team-1",
      rosterId: "roster:team-1",
      rosterVersion: 1,
      contextId: "mu-1",
    },
    actor: { actorId: "sys-1", actorRole: "SYSTEM" },
    source: "CORE06_PHASE_1D_TEST",
    ...overrides,
  };
}

test("1D: same input and seed produce identical lineup", () => {
  const a = selectLineupDeterministic(baseRequest());
  const b = selectLineupDeterministic(baseRequest());
  assert.equal(a.ok, true);
  assert.deepEqual(a.selectedSlots, b.selectedSlots);
  assert.equal(a.selectionFingerprint, b.selectionFingerprint);
});

test("1D: different roster input order produces identical lineup", () => {
  const a = selectLineupDeterministic(
    baseRequest({
      rosterSnapshot: rosterWith(["p-1", "p-2", "p-3", "p-4"]),
    })
  );
  const b = selectLineupDeterministic(
    baseRequest({
      rosterSnapshot: rosterWith(["p-4", "p-3", "p-2", "p-1"]),
    })
  );
  assert.equal(a.ok, true);
  assert.deepEqual(a.selectedSlots, b.selectedSlots);
  assert.equal(a.inputFingerprint, b.inputFingerprint);
});

test("1D: different object key order produces identical fingerprints", () => {
  const left = fingerprintValue({ b: 2, a: { z: 1, y: 0 }, c: [3, 1] });
  const right = fingerprintValue({ c: [3, 1], a: { y: 0, z: 1 }, b: 2 });
  assert.equal(left, right);
  assert.deepEqual(
    canonicalizeJsonValue({ b: 1, a: 2 }),
    canonicalizeJsonValue({ a: 2, b: 1 })
  );
});

test("1D: different seed can produce a different deterministic result", () => {
  const a = selectLineupDeterministic(baseRequest({ seed: "seed-A" }));
  const b = selectLineupDeterministic(baseRequest({ seed: "seed-B" }));
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const same =
    JSON.stringify(a.selectedSlots) === JSON.stringify(b.selectedSlots);
  // Not required that every pair differs, but these seeds must differ for this roster.
  assert.equal(same, false);
  assert.notEqual(a.seedFingerprint, b.seedFingerprint);
});

test("1D: missing seed fails closed", () => {
  const r = selectLineupDeterministic(baseRequest({ seed: "" }));
  assert.equal(r.ok, false);
  assert.equal(r.code, LINEUP_RUNTIME_ERROR_CODE.MISSING_SEED);
  assert.equal(r.resolution?.outcome, MISSING_LINEUP_OUTCOME.BLOCKED);
});

test("1D: empty roster fails closed", () => {
  const r = selectLineupDeterministic(
    baseRequest({
      rosterSnapshot: {
        id: "roster:team-1",
        members: [],
      },
    })
  );
  assert.equal(r.ok, false);
  assert.equal(r.code, LINEUP_RUNTIME_ERROR_CODE.EMPTY_ROSTER);
});

test("1D: duplicate roster identities fail closed", () => {
  const roster = rosterWith(["p-1", "p-2"]);
  roster.members.push(
    createCompetitionRosterMember({
      id: "rm-dup",
      rosterId: "roster:team-1",
      person: person("p-1"),
    })
  );
  const r = selectLineupDeterministic(baseRequest({ rosterSnapshot: roster }));
  assert.equal(r.ok, false);
  assert.equal(r.code, LINEUP_RUNTIME_ERROR_CODE.DUPLICATE_ROSTER_MEMBER);
});

test("1D: invalid slot template fails closed", () => {
  const r = selectLineupDeterministic(
    baseRequest({ slotTemplate: { slots: [] } })
  );
  assert.equal(r.ok, false);
  assert.equal(r.code, LINEUP_RUNTIME_ERROR_CODE.INVALID_SLOT_TEMPLATE);
});

test("1D: insufficient candidates produce explicit blocked resolution", () => {
  const r = selectLineupDeterministic(
    baseRequest({
      rosterSnapshot: rosterWith(["p-1"]),
      slotTemplate: slotTemplate(["md:0", "md:1"]),
    })
  );
  assert.equal(r.ok, false);
  assert.equal(
    r.code,
    LINEUP_RUNTIME_ERROR_CODE.INSUFFICIENT_ELIGIBLE_PARTICIPANTS
  );
  assert.equal(r.resolution?.outcome, MISSING_LINEUP_OUTCOME.BLOCKED);
  assert.ok(
    r.resolution?.reasonCodes.includes(
      LINEUP_RUNTIME_ERROR_CODE.INSUFFICIENT_ELIGIBLE_PARTICIPANTS
    )
  );
});

test("1D: selected participants are always roster members", () => {
  const rosterIds = new Set(["p-1", "p-2", "p-3", "p-4"]);
  const r = selectLineupDeterministic(baseRequest());
  assert.equal(r.ok, true);
  for (const slot of r.selectedSlots) {
    assert.ok(rosterIds.has(slot.person.id));
    assert.equal(slot.person.kind, PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE);
  }
});

test("1D: injected policy filters ineligible candidates", () => {
  const policy = {
    id: "FILTER_P1",
    decideMissingStrategy: () => MISSING_LINEUP_POLICY.RANDOM,
    filterEligible(candidate) {
      return candidate.person.id !== "p-1" && candidate.person.id !== "p-2";
    },
    allowsDuplicateParticipants: () => false,
  };
  const r = selectLineupDeterministic(baseRequest({ policy }));
  assert.equal(r.ok, true);
  for (const slot of r.selectedSlots) {
    assert.ok(slot.person.id === "p-3" || slot.person.id === "p-4");
  }
});

test("1D: injected policy can reject a proposed selection", () => {
  const policy = {
    id: "REJECT_ALL",
    decideMissingStrategy: () => MISSING_LINEUP_POLICY.RANDOM,
    filterEligible: () => true,
    validateSlotAssignment: () =>
      createLineupPolicyResult({
        ok: false,
        code: LINEUP_RUNTIME_ERROR_CODE.UNSATISFIABLE_POLICY,
        message: "rejected",
      }),
    allowsDuplicateParticipants: () => false,
  };
  const r = selectLineupDeterministic(baseRequest({ policy }));
  assert.equal(r.ok, false);
  assert.equal(r.code, LINEUP_RUNTIME_ERROR_CODE.UNSATISFIABLE_POLICY);
});

test("1D: randomization blocked when policy disallows it", async () => {
  const resolver = createMissingLineupResolver();
  const r = await resolver.resolveMissingLineup(
    baseRequest({
      policy: createFixedStrategyLineupRandomPolicy(
        MISSING_LINEUP_POLICY.BLOCKED
      ),
    })
  );
  assert.equal(r.ok, false);
  assert.equal(r.code, LINEUP_RUNTIME_ERROR_CODE.RANDOMIZATION_NOT_ALLOWED);
  assert.equal(r.resolution?.outcome, MISSING_LINEUP_OUTCOME.BLOCKED);
});

test("1D: MANUAL_PENDING outcome", async () => {
  const resolver = createMissingLineupResolver();
  const r = await resolver.resolveMissingLineup(
    baseRequest({
      policy: createFixedStrategyLineupRandomPolicy(
        MISSING_LINEUP_POLICY.MANUAL_PENDING
      ),
    })
  );
  assert.equal(r.ok, true);
  assert.equal(r.selectedSlots.length, 0);
  assert.equal(r.resolution?.outcome, MISSING_LINEUP_OUTCOME.MANUAL_PENDING);
  assert.equal(
    r.code,
    LINEUP_RUNTIME_ERROR_CODE.MANUAL_RESOLUTION_REQUIRED
  );
});

test("1D: FORFEIT_PENDING outcome", async () => {
  const resolver = createMissingLineupResolver();
  const r = await resolver.resolveMissingLineup(
    baseRequest({
      policy: createFixedStrategyLineupRandomPolicy(
        MISSING_LINEUP_POLICY.FORFEIT_PENDING
      ),
    })
  );
  assert.equal(r.ok, true);
  assert.equal(r.resolution?.outcome, MISSING_LINEUP_OUTCOME.FORFEIT_PENDING);
  assert.equal(r.code, LINEUP_RUNTIME_ERROR_CODE.FORFEIT_REVIEW_REQUIRED);
  assert.equal(r.resolution?.details?.lifecycleAutoTransition, false);
});

test("1D: RANDOMIZED outcome", async () => {
  const port = createDeterministicLineupRandomPort();
  const r = await port.selectLineup(baseRequest());
  assert.equal(r.ok, true);
  assert.equal(r.deterministic, true);
  assert.equal(r.resolution?.outcome, MISSING_LINEUP_OUTCOME.RANDOMIZED);
  assert.equal(r.resolution?.details?.lifecycleAutoTransition, false);
  assert.ok(r.selectedSlots.length >= 2);
});

test("1D: BLOCKED outcome with reason code", () => {
  const r = selectLineupDeterministic(baseRequest({ seed: "   " }));
  assert.equal(r.resolution?.outcome, MISSING_LINEUP_OUTCOME.BLOCKED);
  assert.ok(Array.isArray(r.resolution?.reasonCodes));
  assert.ok(r.resolution.reasonCodes.length > 0);
});

test("1D: same idempotency key and payload return the same resolution", async () => {
  const idem = createInMemoryLineupIdempotencyPort();
  const port = createDeterministicLineupRandomPort({ idempotency: idem });
  const req = baseRequest({ idempotencyKey: "idem-1" });
  const a = await port.selectLineup(req);
  const b = await port.selectLineup(req);
  assert.equal(a.ok, true);
  assert.deepEqual(a.selectedSlots, b.selectedSlots);
  assert.equal(a.selectionFingerprint, b.selectionFingerprint);
});

test("1D: same idempotency key with different payload fails closed", async () => {
  const idem = createInMemoryLineupIdempotencyPort();
  const port = createDeterministicLineupRandomPort({ idempotency: idem });
  const a = await port.selectLineup(
    baseRequest({ idempotencyKey: "idem-2", seed: "seed-1" })
  );
  assert.equal(a.ok, true);
  const b = await port.selectLineup(
    baseRequest({ idempotencyKey: "idem-2", seed: "seed-2" })
  );
  assert.equal(b.ok, false);
  assert.equal(b.code, LINEUP_RUNTIME_ERROR_CODE.LINEUP_IDEMPOTENCY_CONFLICT);
});

test("1D: input arrays and objects are not mutated", () => {
  const members = ["p-1", "p-2", "p-3", "p-4"];
  const roster = rosterWith(members);
  const template = slotTemplate(["wd:1", "md:0"]);
  const rosterJson = JSON.stringify(roster);
  const templateJson = JSON.stringify(template);
  const memberOrder = roster.members.map((m) => m.person.id);
  selectLineupDeterministic(
    baseRequest({ rosterSnapshot: roster, slotTemplate: template })
  );
  assert.equal(JSON.stringify(roster), rosterJson);
  assert.equal(JSON.stringify(template), templateJson);
  assert.deepEqual(
    roster.members.map((m) => m.person.id),
    memberOrder
  );
});

test("1D: algorithm identifier and version are returned", () => {
  const r = selectLineupDeterministic(baseRequest());
  assert.equal(r.algorithmId, LINEUP_RANDOM_ALGORITHM.id);
  assert.equal(r.algorithmVersion, LINEUP_RANDOM_ALGORITHM.version);
  assert.equal(r.algorithmId, "CORE06_LINEUP_SEEDED_FISHER_YATES");
  assert.equal(r.algorithmVersion, "1.0.0");
});

test("1D: input, seed and output fingerprints are stable", () => {
  const a = selectLineupDeterministic(baseRequest());
  const b = selectLineupDeterministic(baseRequest());
  assert.equal(a.seedFingerprint, b.seedFingerprint);
  assert.equal(a.inputFingerprint, b.inputFingerprint);
  assert.equal(a.selectionFingerprint, b.selectionFingerprint);
  assert.equal(a.seedFingerprint, fingerprintSeed(a.normalizedSeed));
  assert.equal(
    a.selectionFingerprint,
    fingerprintSelection(a.selectedSlots)
  );
});

test("1D: canonical seed composition is documented and stable", () => {
  assert.deepEqual(CANONICAL_SEED_FIELDS, [
    "tenantId",
    "competitionId",
    "contextId",
    "teamId",
    "rosterVersion",
    "lineupIdentityKey",
    "revisionOrCommandId",
    "ownerSeed",
  ]);
  const composed = composeCanonicalSeed({
    tenantId: "t1",
    competitionId: "c1",
    contextId: "x1",
    teamId: "team-1",
    rosterVersion: 3,
    lineupIdentityKey: "c1::LINEUP::x1::team-1",
    revisionOrCommandId: "cmd-9",
    ownerSeed: "owner",
  });
  const again = composeCanonicalSeed({
    ownerSeed: "owner",
    teamId: "team-1",
    tenantId: "t1",
    competitionId: "c1",
    contextId: "x1",
    rosterVersion: 3,
    lineupIdentityKey: "c1::LINEUP::x1::team-1",
    revisionOrCommandId: "cmd-9",
  });
  assert.equal(composed, again);
  assert.equal(normalizeSeed(composed), composed);
  assert.throws(
    () => composeCanonicalSeed({ ownerSeed: "" }),
    (err) => err.code === LINEUP_RUNTIME_ERROR_CODE.MISSING_SEED
  );
});

test("1D: NFC seed normalization is deterministic", () => {
  const nfc = "e\u0301".normalize("NFC");
  const nfd = "e\u0301".normalize("NFD");
  assert.notEqual(nfc, nfd);
  assert.equal(normalizeSeed(nfd), normalizeSeed(nfc));
});

test("1D: no Math.random / Date.now in CORE-06 Phase 1D implementation", () => {
  const files = listJsFiles(LINEUPS_ROOT);
  assert.ok(files.length > 0);
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(
      content,
      /Math\.random\s*\(/,
      `Math.random in ${path.relative(ROOT, file)}`
    );
    assert.doesNotMatch(
      content,
      /Date\.now\s*\(/,
      `Date.now in ${path.relative(ROOT, file)}`
    );
  }
});

test("1D: no Production wiring introduced", () => {
  const callerRoots = [
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/components"),
    path.join(ROOT, "src/features/team-tournament"),
  ];
  const banned = [
    /createDeterministicLineupRandomPort/,
    /createMissingLineupResolver/,
    /selectLineupDeterministic/,
    /competition-core\/lineups\/random/,
  ];
  for (const dir of callerRoots) {
    if (!existsSync(dir)) continue;
    for (const file of listJsFiles(dir)) {
      const content = readFileSync(file, "utf8");
      for (const re of banned) {
        assert.doesNotMatch(
          content,
          re,
          `Production wiring: ${path.relative(ROOT, file)}`
        );
      }
    }
  }
});

test("1D: Team Tournament V6 lineupRandomEngine unchanged (parity reference)", () => {
  assert.ok(existsSync(TT_LINEUP_RANDOM));
  const status = execFileSync(
    "git",
    ["status", "--porcelain", "--", "src/features/team-tournament"],
    { cwd: ROOT, encoding: "utf8" }
  );
  assert.equal(status.trim(), "");
  const content = readFileSync(TT_LINEUP_RANDOM, "utf8");
  // Parity note: TT still uses Math.random — CORE-06 intentionally does not.
  assert.match(content, /Math\.random/);
  assert.match(content, /randomizeMissingLineups/);
});

test("1D: Phase 1D docs exist", () => {
  const doc = path.join(
    ROOT,
    "docs/competition-engine/core-06/10_PHASE_1D_DETERMINISTIC_RANDOM.md"
  );
  assert.ok(existsSync(doc));
  const text = readFileSync(doc, "utf8");
  assert.match(text, /CORE06_LINEUP_SEEDED_FISHER_YATES/);
  assert.match(text, /ownerSeed/);
  assert.match(text, /Math\.random/);
});
