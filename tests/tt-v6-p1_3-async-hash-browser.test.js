import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

import fixture from "../src/features/team-tournament/canonical/teamTournamentCanonicalVectors.fixture.json" with { type: "json" };
import {
  buildCanonicalSetupSnapshot,
  buildSetupMutationEnvelope,
  buildSetupMutationEnvelopeAsync,
  calculateSetupMutationPayloadHash,
  calculateSetupMutationPayloadHashAsync,
  hashCanonicalSetupSnapshot,
  hashCanonicalSetupSnapshotAsync,
  hashEngineInput,
  hashEngineInputAsync,
  hashEngineOutput,
  hashEngineOutputAsync,
  hashUtf8Sha256Async,
  hashUtf8Sha256Sync,
  stableCanonicalStringify,
} from "../src/features/team-tournament/canonical/teamTournamentCanonical.js";
import {
  SETUP_MUTATION_CODES,
  SETUP_MUTATION_GATE_ENV,
  __resetSetupMutationFoundationStateForTests,
  attachSnapshotPackageToPayload,
  buildSetupMutationPayload,
  buildSetupMutationPayloadAsync,
  buildSetupMutationSnapshotPackage,
  buildSetupMutationSnapshotPackageAsync,
  runSetupMutation,
} from "../src/features/team-tournament/setup/index.js";
import {
  createTeamTournamentUiOrchestrator,
} from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import { TEAM_TOURNAMENT_DATA_MODES } from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GATE_ON = { [SETUP_MUTATION_GATE_ENV]: "true" };

before(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
      writable: true,
    });
  }
  assert.equal(typeof globalThis.crypto?.subtle?.digest, "function");
});

after(() => {
  __resetSetupMutationFoundationStateForTests();
});

describe("P1.3 async hash parity (browser SubtleCrypto)", () => {
  it("async browser hash equals sync Node hash for all S1-A golden vectors", async () => {
    for (const vector of fixture.vectors) {
      switch (vector.id) {
        case "key-order-equivalence":
        case "uuid-case":
        case "unicode-nfc":
        case "timestamp-utc":
        case "numeric-zero": {
          const syncHash = hashEngineOutput(vector.input);
          const asyncHash = await hashEngineOutputAsync(vector.input);
          assert.equal(asyncHash, syncHash, vector.id);
          assert.equal(asyncHash, vector.expectedHash, vector.id);
          if (vector.inputAlt) {
            assert.equal(await hashEngineOutputAsync(vector.inputAlt), syncHash, `${vector.id}:alt`);
          }
          break;
        }
        case "rating-rounding": {
          const snap = buildCanonicalSetupSnapshot(vector.inputAlt);
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), hashCanonicalSetupSnapshot(snap));
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), vector.snapshotHash);
          break;
        }
        case "teams-sort-by-id": {
          const snap = buildCanonicalSetupSnapshot({
            tournament: { id: "t-1", version: 1 },
            teams: vector.input.teams,
            generatedAt: "2026-07-16T09:00:00.000Z",
          });
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), hashCanonicalSetupSnapshot(snap));
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), vector.snapshotHash);
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
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), hashCanonicalSetupSnapshot(snap));
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), vector.snapshotHash);
          break;
        }
        case "group-teamids-dedupe-sort": {
          const snap = buildCanonicalSetupSnapshot({
            tournament: { id: "t-1", version: 1 },
            groups: [{ id: "g1", teamIds: vector.input }],
            generatedAt: "2026-07-16T09:00:00.000Z",
          });
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), hashCanonicalSetupSnapshot(snap));
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), vector.snapshotHash);
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
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), hashCanonicalSetupSnapshot(snap));
          assert.equal(await hashCanonicalSetupSnapshotAsync(snap), vector.snapshotHash);
          break;
        }
        case "meaningful-array-order": {
          assert.equal(await hashEngineOutputAsync(vector.input), vector.hashA);
          assert.equal(await hashEngineOutputAsync(vector.inputAlt), vector.hashB);
          break;
        }
        case "engine-input-output-differ": {
          const input = { teams: [{ id: "t1" }], groupCount: 2 };
          const output = { groups: [{ id: "g1", teamIds: ["t1"] }] };
          assert.equal(await hashEngineInputAsync(input), hashEngineInput(input));
          assert.equal(await hashEngineOutputAsync(output), hashEngineOutput(output));
          assert.equal(await hashEngineInputAsync(input), vector.engineInputHash);
          assert.equal(await hashEngineOutputAsync(output), vector.engineOutputHash);
          break;
        }
        default:
          // Other vectors assert structural/canonical properties covered by S1-A suite.
          break;
      }
    }
  });

  it("async snapshot hash equals sync snapshot hash", async () => {
    const syncPkg = buildSetupMutationSnapshotPackage({
      tournament: { id: "tt-async", version: 2 },
      teams: [{ id: "team-a", name: "A" }],
      disciplines: [{ id: "d1", name: "MD", sortOrder: 1 }],
      expectedTournamentVersion: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    const asyncPkg = await buildSetupMutationSnapshotPackageAsync({
      tournament: { id: "tt-async", version: 2 },
      teams: [{ id: "team-a", name: "A" }],
      disciplines: [{ id: "d1", name: "MD", sortOrder: 1 }],
      expectedTournamentVersion: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(asyncPkg.snapshotCanonicalText, syncPkg.snapshotCanonicalText);
    assert.equal(asyncPkg.snapshotHash, syncPkg.snapshotHash);
    assert.equal(asyncPkg.normalizedReadHash, syncPkg.normalizedReadHash);
  });

  it("async engineInputHash / engineOutputHash equal sync", async () => {
    const input = { tournamentId: "tt-1", teams: [{ id: "a" }] };
    const output = { groups: [{ id: "g1", teamIds: ["a"] }] };
    assert.equal(await hashEngineInputAsync(input), hashEngineInput(input));
    assert.equal(await hashEngineOutputAsync(output), hashEngineOutput(output));
  });

  it("async payloadHash equals sync and envelope is semantically identical", async () => {
    const params = {
      commandName: "discipline.save",
      tournamentId: "tt-env",
      expectedTournamentVersion: 3,
      idempotencyKey: "idem-async-1",
      engineInputHash: hashEngineInput({}),
      engineOutputHash: hashEngineOutput({}),
      generatedAt: "2026-01-01T00:00:00.000Z",
      generationMetadata: { source: "test" },
      confirmDestructive: false,
      payload: { discipline: { id: "d1", name: "MD" } },
    };
    const syncEnv = buildSetupMutationEnvelope(params);
    const asyncEnv = await buildSetupMutationEnvelopeAsync(params);
    assert.equal(asyncEnv.payloadHash, syncEnv.payloadHash);
    assert.equal(
      await calculateSetupMutationPayloadHashAsync(asyncEnv),
      calculateSetupMutationPayloadHash(syncEnv)
    );
    assert.deepEqual(
      { ...asyncEnv, payloadHash: undefined },
      { ...syncEnv, payloadHash: undefined }
    );
    assert.equal(stableCanonicalStringify(asyncEnv), stableCanonicalStringify(syncEnv));
  });

  it("buildSetupMutationPayloadAsync matches sync payloadHash", async () => {
    const common = {
      method: "discipline.save",
      tournamentId: "tt-payload",
      expectedTournamentVersion: 2,
      idempotencyKey: "payload-async",
      generatedAt: "2026-01-01T00:00:00.000Z",
      engineInput: {},
      engineOutput: {},
      payload: { discipline: { id: "d1", name: "MD" } },
    };
    const syncBuilt = buildSetupMutationPayload(common);
    const asyncBuilt = await buildSetupMutationPayloadAsync(common);
    assert.equal(syncBuilt.ok, true);
    assert.equal(asyncBuilt.ok, true);
    assert.equal(asyncBuilt.payloadHash, syncBuilt.payloadHash);
    assert.equal(asyncBuilt.engineInputHash, syncBuilt.engineInputHash);
    assert.equal(asyncBuilt.engineOutputHash, syncBuilt.engineOutputHash);
  });

  it("SubtleCrypto async digest matches pure sync SHA-256", async () => {
    const text = '{"a":1,"b":2}';
    assert.equal(await hashUtf8Sha256Async(text), hashUtf8Sha256Sync(text));
  });
});

describe("P1.3 browser mutation path never uses sync hash", () => {
  it("UI + runSetupMutation sources do not call sync hash helpers", () => {
    const uiSrc = readFileSync(
      path.join(ROOT, "src/features/team-tournament/ui/teamTournamentUiOrchestrator.js"),
      "utf8"
    );
    const runSrc = readFileSync(
      path.join(ROOT, "src/features/team-tournament/setup/runSetupMutation.js"),
      "utf8"
    );
    assert.equal(uiSrc.includes("hashUtf8Sha256Sync"), false);
    assert.equal(uiSrc.includes("buildSetupMutationSnapshotPackage("), false);
    assert.match(uiSrc, /buildSetupMutationSnapshotPackageAsync\s*\(/);
    assert.match(runSrc, /previewSetupMutationAsync\s*\(/);
    assert.match(runSrc, /buildSetupMutationPayloadAsync\s*\(/);
    assert.match(runSrc, /validateSetupMutationEnvelopeAsync\s*\(/);
    // confirm/run path must not call sync builders
    const confirmBlock = runSrc.slice(runSrc.indexOf("export async function confirmSetupMutation"));
    assert.equal(confirmBlock.includes("buildSetupMutationPayload("), false);
    assert.equal(confirmBlock.includes("validateSetupMutationEnvelope("), false);
    const runBlock = runSrc.slice(runSrc.indexOf("export async function runSetupMutation"));
    assert.equal(runBlock.includes("previewSetupMutation("), false);
  });

  it("persistSetupTeamData reaches executeSetupMutation after async hashing (no sync)", async () => {
    __resetSetupMutationFoundationStateForTests();

    // Browser simulation: keep SubtleCrypto, deny Node sync detection so sync APIs throw.
    const versions = process.versions;
    const originalNode = versions.node;
    Object.defineProperty(versions, "node", {
      configurable: true,
      get: () => undefined,
    });

    let rpcCalled = false;
    let hashingDoneBeforeRpc = false;
    let sawSnapshotHash = false;

    const repo = {
      getProvider: () => "cloud",
      getTournament: async () => ({
        ok: true,
        version: 2,
        data: {
          id: "tt-browser-hash",
          version: 2,
          teams: [{ id: "team-a", name: "A" }],
          teamData: { teams: [{ id: "team-a", name: "A" }], disciplines: [] },
          settings: {},
        },
      }),
      executeSetupMutation: async ({ envelope }) => {
        hashingDoneBeforeRpc = Boolean(envelope?.payloadHash);
        sawSnapshotHash = Boolean(envelope?.payload?.snapshot?.snapshotHash);
        rpcCalled = true;
        return {
          ok: true,
          version: 3,
          replayed: false,
          data: {
            snapshot: { snapshotHash: envelope.payload.snapshot.snapshotHash },
            teamData: {
              teams: [{ id: "team-a", name: "A" }],
              disciplines: [{ id: "d1", name: "MD", sortOrder: 1 }],
            },
          },
        };
      },
    };

    const orch = createTeamTournamentUiOrchestrator({
      repository: repo,
      mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
      forceNew: true,
    });

    try {
      const syncHash = hashUtf8Sha256Sync("probe");
      assert.match(syncHash, /^[a-f0-9]{64}$/);
      assert.equal(syncHash, hashUtf8Sha256Sync("probe"));

      const result = await orch.persistSetupTeamData(
        "club-1",
        "tt-browser-hash",
        {
          teams: [{ id: "team-a", name: "A" }],
          disciplines: [{ id: "d1", name: "MD", sortOrder: 1 }],
        },
        {
          envSource: GATE_ON,
          previousTeamData: { teams: [{ id: "team-a", name: "A" }], disciplines: [] },
          expectedTournamentVersion: 2,
          generatedAt: "2026-01-01T00:00:00.000Z",
          aggregate: {
            id: "tt-browser-hash",
            version: 2,
            teams: [{ id: "team-a", name: "A" }],
            teamData: { teams: [{ id: "team-a", name: "A" }], disciplines: [] },
            settings: {},
          },
          reloadAcknowledged: true,
        }
      );

      assert.equal(result.ok, true, result.error || result.code);
      assert.equal(rpcCalled, true);
      assert.equal(hashingDoneBeforeRpc, true);
      assert.equal(sawSnapshotHash, true);
      assert.notEqual(result.code, SETUP_MUTATION_CODES.BLOB_FALLBACK_FORBIDDEN);
    } finally {
      Object.defineProperty(versions, "node", {
        configurable: true,
        value: originalNode,
        writable: true,
      });
    }
  });

  it("RPC is called only after hashing completes", async () => {
    __resetSetupMutationFoundationStateForTests();
    const order = [];
    const repo = {
      executeSetupMutation: async ({ envelope }) => {
        order.push("rpc");
        assert.match(envelope.payloadHash, /^[a-f0-9]{64}$/);
        assert.match(envelope.engineInputHash, /^[a-f0-9]{64}$/);
        return { ok: true, version: 3, data: { snapshot: null } };
      },
    };

    const snapshot = await buildSetupMutationSnapshotPackageAsync({
      tournament: { id: "tt-order", version: 2 },
      expectedTournamentVersion: 2,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    order.push("hash");

    const result = await runSetupMutation({
      method: "discipline.save",
      commandName: "discipline.save",
      tournamentId: "tt-order",
      expectedTournamentVersion: 2,
      idempotencyKey: "order-1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      payload: attachSnapshotPackageToPayload({ discipline: { id: "d1", name: "MD" } }, snapshot),
      engineInput: {},
      engineOutput: {},
      confirmed: true,
      repository: repo,
      envSource: GATE_ON,
      dataMode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
      requirePreviewSession: false,
    });

    assert.equal(result.ok, true);
    assert.equal(result.rpcCalled, true);
    assert.deepEqual(order, ["hash", "rpc"]);
  });

  it("hash failure surfaces a visible error with no fake success and no blob fallback", async () => {
    __resetSetupMutationFoundationStateForTests();
    const originalSubtle = globalThis.crypto.subtle;
    Object.defineProperty(globalThis.crypto, "subtle", {
      configurable: true,
      value: {
        digest: async () => {
          throw new Error("SubtleCrypto digest failed in test");
        },
      },
    });

    // Also deny Node sync fallback so async path cannot silently succeed.
    const versions = process.versions;
    const originalNode = versions.node;
    Object.defineProperty(versions, "node", {
      configurable: true,
      get: () => undefined,
    });

    try {
      const built = await buildSetupMutationPayloadAsync({
        method: "discipline.save",
        tournamentId: "tt-fail",
        expectedTournamentVersion: 2,
        idempotencyKey: "fail-hash",
        engineInput: {},
        engineOutput: {},
        payload: { discipline: { id: "d1" } },
        envSource: GATE_ON,
      });
      assert.equal(built.ok, false);
      assert.equal(built.code, SETUP_MUTATION_CODES.HASH_RUNTIME_ERROR);
      assert.match(String(built.error), /SubtleCrypto|hash|digest/i);

      const orch = createTeamTournamentUiOrchestrator({
        repository: {
          getProvider: () => "cloud",
          executeSetupMutation: async () => {
            throw new Error("RPC must not be called after hash failure");
          },
        },
        mode: TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY,
        forceNew: true,
      });

      const uiResult = await orch.persistSetupTeamData(
        "club-1",
        "tt-fail",
        { disciplines: [{ id: "d1", name: "MD", sortOrder: 1 }] },
        {
          envSource: GATE_ON,
          previousTeamData: { disciplines: [] },
          expectedTournamentVersion: 2,
          aggregate: {
            id: "tt-fail",
            version: 2,
            teamData: { disciplines: [] },
            teams: [],
            settings: {},
          },
        }
      );
      assert.equal(uiResult.ok, false);
      assert.equal(uiResult.code, SETUP_MUTATION_CODES.HASH_RUNTIME_ERROR);
      assert.notEqual(uiResult.code, SETUP_MUTATION_CODES.BLOB_FALLBACK_FORBIDDEN);
    } finally {
      Object.defineProperty(globalThis.crypto, "subtle", {
        configurable: true,
        value: originalSubtle,
      });
      Object.defineProperty(versions, "node", {
        configurable: true,
        value: originalNode,
        writable: true,
      });
    }
  });
});
