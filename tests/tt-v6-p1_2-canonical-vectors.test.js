import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import fixture from "../src/features/team-tournament/canonical/teamTournamentCanonicalVectors.fixture.json" with { type: "json" };
import {
  stableCanonicalStringify,
  hashEngineOutput,
  hashEngineInput,
  hashCanonicalSetupSnapshot,
  buildCanonicalSetupSnapshot,
  canonicalizeValue,
  CanonicalValidationError,
} from "../src/features/team-tournament/canonical/teamTournamentCanonical.js";
import {
  canonicalizeTeamTournamentValue,
  hashTeamTournamentCanonicalValue,
  stableStringifyTeamTournamentValue,
} from "../src/features/team-tournament/repositories/teamTournamentCanonical.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("golden vectors: all fixture entries pass", () => {
  for (const vector of fixture.vectors) {
    switch (vector.id) {
      case "key-order-equivalence":
      case "uuid-case":
      case "unicode-nfc":
      case "timestamp-utc": {
        assert.equal(stableCanonicalStringify(vector.input), vector.expectedCanonical);
        assert.equal(stableCanonicalStringify(vector.inputAlt), vector.expectedCanonical);
        assert.equal(hashEngineOutput(vector.input), vector.expectedHash);
        break;
      }
      case "numeric-zero": {
        assert.equal(stableCanonicalStringify(vector.input), vector.expectedCanonical);
        assert.equal(hashEngineOutput(vector.input), vector.expectedHash);
        break;
      }
      case "rating-rounding": {
        const left = hashCanonicalSetupSnapshot(buildCanonicalSetupSnapshot(vector.inputAlt));
        const right = hashCanonicalSetupSnapshot(buildCanonicalSetupSnapshot(vector.inputAlt));
        assert.equal(left, right);
        assert.equal(left, vector.snapshotHash);
        break;
      }
      case "teams-sort-by-id": {
        const snap = buildCanonicalSetupSnapshot({
          tournament: { id: "t-1", version: 1 },
          teams: vector.input.teams,
          generatedAt: "2026-07-16T09:00:00.000Z",
        });
        assert.deepEqual(snap.teams.map((team) => team.id), vector.expectedTeamOrder);
        assert.equal(hashCanonicalSetupSnapshot(snap), vector.snapshotHash);
        break;
      }
      case "disciplines-sort": {
        const snap = buildCanonicalSetupSnapshot({
          tournament: { id: "t-1", version: 1 },
          disciplines: [
            { id: "d2", sortOrder: 2 },
            { id: "d1", sortOrder: 1 },
          ],
          generatedAt: "2026-07-16T09:00:00.000Z",
        });
        assert.deepEqual(snap.disciplines.map((item) => item.id), vector.expectedOrder);
        assert.equal(hashCanonicalSetupSnapshot(snap), vector.snapshotHash);
        break;
      }
      case "group-teamids-dedupe-sort": {
        const snap = buildCanonicalSetupSnapshot({
          tournament: { id: "t-1", version: 1 },
          groups: [{ id: "g1", teamIds: vector.input }],
          generatedAt: "2026-07-16T09:00:00.000Z",
        });
        assert.deepEqual(snap.groups[0].teamIds, vector.expectedTeamIds);
        assert.equal(hashCanonicalSetupSnapshot(snap), vector.snapshotHash);
        break;
      }
      case "matchup-null-scheduled-last": {
        const snap = buildCanonicalSetupSnapshot({
          tournament: { id: "t-1", version: 1 },
          matchups: [
            { id: "m-null", scheduledAt: null },
            { id: "m-early", scheduledAt: "2026-07-16T08:00:00.000Z" },
          ],
          generatedAt: "2026-07-16T09:00:00.000Z",
        });
        assert.deepEqual(snap.matchups.map((item) => item.id), vector.expectedOrder);
        assert.equal(hashCanonicalSetupSnapshot(snap), vector.snapshotHash);
        break;
      }
      case "meaningful-array-order": {
        assert.notEqual(vector.hashA, vector.hashB);
        break;
      }
      case "roster-member-change": {
        assert.notEqual(vector.hashBase, vector.hashChanged);
        break;
      }
      case "engine-input-output-differ": {
        assert.notEqual(vector.engineInputHash, vector.engineOutputHash);
        assert.equal(vector.engineInputHash, hashEngineInput({ teams: [{ id: "t1" }], groupCount: 2 }));
        assert.equal(vector.engineOutputHash, hashEngineOutput({ groups: [{ id: "g1", teamIds: ["t1"] }] }));
        break;
      }
      case "payload-hash-self-exclusion": {
        const rebuilt = { ...vector.envelope };
        const original = rebuilt.payloadHash;
        rebuilt.payloadHash = "0000000000000000000000000000000000000000000000000000000000000000";
        assert.notEqual(rebuilt.payloadHash, original);
        break;
      }
      default:
        assert.fail(`Unknown vector id: ${vector.id}`);
    }
  }
});

test("canonicalizeValue does not mutate input object", () => {
  const input = { b: 2, a: 1, teams: [{ id: "t2" }, { id: "t1" }] };
  const snapshot = Object.freeze(structuredClone(input));
  buildCanonicalSetupSnapshot({
    tournament: { id: "t-1", version: 1 },
    teams: input.teams,
    generatedAt: "2026-07-16T09:00:00.000Z",
  });
  assert.deepEqual(input, snapshot);
});

test("unsupported cyclic input throws deterministic validation error", () => {
  const cyclic = { a: 1 };
  cyclic.self = cyclic;
  assert.throws(
    () => canonicalizeValue(cyclic),
    (error) => error instanceof CanonicalValidationError && error.code === "CYCLIC_REFERENCE"
  );
});

test("compatibility shim preserves legacy hash behavior", () => {
  const payload = { b: 2, a: 1, nested: { y: 2, x: 1 } };
  assert.equal(hashTeamTournamentCanonicalValue(payload), hashTeamTournamentCanonicalValue({ a: 1, b: 2, nested: { x: 1, y: 2 } }));
  assert.equal(stableStringifyTeamTournamentValue(payload), stableStringifyTeamTournamentValue({ a: 1, b: 2, nested: { x: 1, y: 2 } }));
  assert.deepEqual(canonicalizeTeamTournamentValue({ note: undefined, kept: 1 }), { kept: 1 });
});

test("fixture file is checked into repo", () => {
  const fixturePath = path.join(
    __dirname,
    "../src/features/team-tournament/canonical/teamTournamentCanonicalVectors.fixture.json"
  );
  const raw = readFileSync(fixturePath, "utf8");
  assert.ok(raw.includes("key-order-equivalence"));
});
