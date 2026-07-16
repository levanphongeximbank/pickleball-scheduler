import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  attachSnapshotPackageToPayload,
  buildSetupMutationPayload,
  buildSetupMutationSnapshotPackage,
} from "../src/features/team-tournament/setup/index.js";

const input = {
  tournament: { id: "tt-hash", version: 2 },
  teams: [{ id: "team-a", name: "A" }],
  disciplines: [{ id: "d1", name: "MD", sortOrder: 1 }],
  expectedTournamentVersion: 2,
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("P1.3 snapshot payload hashing", () => {
  it("builds deterministic snapshot hashes", () => {
    const first = buildSetupMutationSnapshotPackage(input);
    const second = buildSetupMutationSnapshotPackage(input);
    assert.equal(first.snapshotCanonicalText, second.snapshotCanonicalText);
    assert.equal(first.snapshotHash, second.snapshotHash);
  });

  it("recalculates payload hash after attaching a snapshot", () => {
    const payload = attachSnapshotPackageToPayload(
      { discipline: { id: "d1", name: "MD" } },
      buildSetupMutationSnapshotPackage(input)
    );
    const common = {
      method: "discipline.save",
      tournamentId: "tt-hash",
      expectedTournamentVersion: 2,
      idempotencyKey: "hash-rebuild",
      generatedAt: "2026-01-01T00:00:00.000Z",
      engineInput: {},
      engineOutput: {},
      payload,
    };
    const first = buildSetupMutationPayload(common);
    const second = buildSetupMutationPayload({ ...common, payload: { ...payload } });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(first.payloadHash, second.payloadHash);
    assert.match(first.payloadHash, /^[0-9a-f]{64}$/);
  });
});
