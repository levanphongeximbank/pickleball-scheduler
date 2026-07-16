import test from "node:test";
import assert from "node:assert/strict";

import {
  hashCanonicalSetupSnapshot,
  hashEngineInput,
  hashEngineOutput,
  serializeCanonicalSetupSnapshot,
  buildCanonicalSetupSnapshot,
  compareSnapshotHashes,
  hashUtf8Sha256Async,
  hashUtf8Sha256Sync,
  isValidSha256Hex,
} from "../src/features/team-tournament/canonical/teamTournamentCanonical.js";

test("hash format is lowercase 64-char hex", () => {
  const hash = hashEngineOutput({ ok: true });
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(isValidSha256Hex(hash), true);
  assert.equal(isValidSha256Hex(hash.toUpperCase()), false);
});

test("hash stability across repeated serialization", () => {
  const snapshot = buildCanonicalSetupSnapshot({
    tournament: { id: "t-1", version: 2 },
    teams: [{ id: "team-a", playerIds: ["p1"] }],
    generatedAt: "2026-07-16T09:00:00.000Z",
  });
  const first = hashCanonicalSetupSnapshot(snapshot);
  const second = hashCanonicalSetupSnapshot(snapshot);
  assert.equal(first, second);
  assert.equal(first, hashUtf8Sha256Sync(serializeCanonicalSetupSnapshot(snapshot)));
});

test("semantic change detection changes snapshot hash", () => {
  const base = buildCanonicalSetupSnapshot({
    tournament: { id: "t-1", version: 1 },
    disciplines: [{ id: "d1", sortOrder: 1, name: "MD" }],
    generatedAt: "2026-07-16T09:00:00.000Z",
  });
  const changed = buildCanonicalSetupSnapshot({
    tournament: { id: "t-1", version: 1 },
    disciplines: [{ id: "d1", sortOrder: 1, name: "WD" }],
    generatedAt: "2026-07-16T09:00:00.000Z",
  });
  assert.notEqual(hashCanonicalSetupSnapshot(base), hashCanonicalSetupSnapshot(changed));
});

test("engine input hash differs from snapshot hash for same root object shape", () => {
  const input = { tournamentId: "t-1", teams: [{ id: "a" }] };
  const snapshot = buildCanonicalSetupSnapshot({
    tournament: { id: "t-1", version: 1 },
    teams: [{ id: "a" }],
    generatedAt: "2026-07-16T09:00:00.000Z",
  });
  assert.notEqual(hashEngineInput(input), hashCanonicalSetupSnapshot(snapshot));
});

test("compareSnapshotHashes reports mismatches", () => {
  const hashA = hashEngineOutput({ a: 1 });
  const hashB = hashEngineOutput({ a: 2 });
  const equal = compareSnapshotHashes(hashA, hashA);
  const different = compareSnapshotHashes(hashA, hashB);
  assert.equal(equal.equal, true);
  assert.equal(different.equal, false);
});

test("browser-safe async hashing matches sync hashing in Node", async () => {
  const text = serializeCanonicalSetupSnapshot(
    buildCanonicalSetupSnapshot({
      tournament: { id: "t-1", version: 1 },
      generatedAt: "2026-07-16T09:00:00.000Z",
    })
  );
  const asyncHash = await hashUtf8Sha256Async(text);
  const syncHash = hashCanonicalSetupSnapshot(
    buildCanonicalSetupSnapshot({
      tournament: { id: "t-1", version: 1 },
      generatedAt: "2026-07-16T09:00:00.000Z",
    })
  );
  assert.equal(asyncHash, syncHash);
});
