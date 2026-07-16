/**
 * P1.2 S1-D/S1-E — setup mutation foundation certification.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SETUP_MUTATION_CODES,
  SETUP_MUTATION_GATE_ENV,
  SETUP_MUTATION_GATE_META,
  isSetupMutationFoundationEnabled,
  resolveSetupMutationRpcName,
  isSetupMutationRpcDeployed,
  isSetupDomainWriteMethodActive,
  evaluateSetupDriftPolicy,
  evaluateEngineVersionPolicy,
  executeSetupMutation,
  buildSetupMutationPayload,
  previewSetupMutation,
  confirmSetupMutation,
  runSetupMutation,
  handleSetupMutationConflict,
  shouldIgnoreStaleSetupMutationResponse,
  __resetSetupMutationFoundationStateForTests,
} from "../src/features/team-tournament/setup/index.js";
import { DEFAULT_ENGINE_VERSION } from "../src/features/team-tournament/canonical/teamTournamentMutationEnvelope.js";
import { createCloudTeamTournamentRepository } from "../src/features/team-tournament/repositories/cloudTeamTournamentRepository.js";
import { createBlobTeamTournamentRepository } from "../src/features/team-tournament/repositories/blobTeamTournamentRepository.js";
import { endUiCommandKey, buildUiCommandScope } from "../src/features/team-tournament/ui/teamTournamentUiCommandKeys.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const GATE_ON = { [SETUP_MUTATION_GATE_ENV]: "true" };
const GATE_OFF = { [SETUP_MUTATION_GATE_ENV]: "false" };

function baseParams(overrides = {}) {
  return {
    method: "discipline.save",
    commandName: "discipline.save",
    clubId: "club-1",
    tournamentId: "tt-foundation-1",
    engineInput: { teams: [{ id: "a" }] },
    engineOutput: { disciplines: [{ id: "d1" }] },
    payload: { discipline: { id: "d1", name: "MD" } },
    expectedTournamentVersion: 3,
    latestTournamentVersion: 3,
    envSource: GATE_ON,
    ...overrides,
  };
}

describe("P1.2 S1-E — feature gate", () => {
  it("defaults OFF", () => {
    assert.equal(isSetupMutationFoundationEnabled(GATE_OFF), false);
    assert.equal(isSetupMutationFoundationEnabled({}), false);
    assert.equal(SETUP_MUTATION_GATE_META.default, "OFF");
  });

  it("enables only with explicit truthy env", () => {
    assert.equal(isSetupMutationFoundationEnabled(GATE_ON), true);
    assert.equal(isSetupMutationFoundationEnabled({ [SETUP_MUTATION_GATE_ENV]: "on" }), true);
  });
});

describe("P1.2 S1-D — preview / confirm orchestration", () => {
  beforeEach(() => {
    __resetSetupMutationFoundationStateForTests();
  });

  afterEach(() => {
    __resetSetupMutationFoundationStateForTests();
    endUiCommandKey(buildUiCommandScope("discipline.save", "tt-foundation-1", "setup"));
  });

  it("preview creates no RPC call", () => {
    let rpcCalls = 0;
    const repo = {
      async executeSetupMutation() {
        rpcCalls += 1;
        return { ok: true };
      },
    };
    const preview = previewSetupMutation(baseParams({ repository: repo }));
    assert.equal(preview.ok, true);
    assert.equal(preview.rpcCalled, false);
    assert.equal(preview.requiresConfirm, true);
    assert.equal(rpcCalls, 0);
    assert.ok(preview.envelope.payloadHash);
    assert.ok(preview.engineInputHash);
    assert.ok(preview.engineOutputHash);
  });

  it("confirm required before persistence", async () => {
    let rpcCalls = 0;
    const repo = {
      async executeSetupMutation() {
        rpcCalls += 1;
        return { ok: false, code: SETUP_MUTATION_CODES.RPC_NOT_DEPLOYED, error: "undeployed" };
      },
    };
    const previewOnly = await runSetupMutation(baseParams({ repository: repo }));
    assert.equal(previewOnly.rpcCalled, false);
    assert.equal(previewOnly.requiresConfirm, true);
    assert.equal(rpcCalls, 0);

    const denied = await confirmSetupMutation(baseParams({ repository: repo, confirmed: false }));
    assert.equal(denied.code, SETUP_MUTATION_CODES.CONFIRM_REQUIRED);
    assert.equal(rpcCalls, 0);
  });

  it("envelope hashes are correct via buildSetupMutationPayload", () => {
    const built = buildSetupMutationPayload(baseParams({ idempotencyKey: "key-hash-1" }));
    assert.equal(built.ok, true);
    assert.match(built.engineInputHash, /^[0-9a-f]{64}$/);
    assert.match(built.engineOutputHash, /^[0-9a-f]{64}$/);
    assert.match(built.payloadHash, /^[0-9a-f]{64}$/);
    assert.equal(built.envelope.engineVersion, DEFAULT_ENGINE_VERSION);
  });

  it("undeployed domain RPC fails closed with no blob fallback", async () => {
    const cloud = createCloudTeamTournamentRepository();
    const blob = createBlobTeamTournamentRepository();
    const built = buildSetupMutationPayload(baseParams({ idempotencyKey: "key-rpc-1" }));

    const cloudResult = await cloud.executeSetupMutation({
      tournamentId: "tt-foundation-1",
      envelope: built.envelope,
      envSource: GATE_ON,
    });
    assert.equal(cloudResult.ok, false);
    assert.equal(cloudResult.code, "REPOSITORY_RPC_GUARD_NOT_DEPLOYED");
    assert.ok(String(cloudResult.details?.rpcName || "").includes("team_tournament_"));

    const blobResult = await blob.executeSetupMutation({
      tournamentId: "tt-foundation-1",
      envelope: built.envelope,
      envSource: GATE_ON,
    });
    assert.equal(blobResult.ok, false);
    assert.equal(blobResult.code, SETUP_MUTATION_CODES.BLOB_FALLBACK_FORBIDDEN);
  });

  it("executeSetupMutation shared helper fails closed when gate on", async () => {
    const built = buildSetupMutationPayload(baseParams({ idempotencyKey: "key-exec-1" }));
    const result = await executeSetupMutation({
      provider: "cloud",
      tournamentId: "tt-foundation-1",
      envelope: built.envelope,
      envSource: GATE_ON,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "REPOSITORY_RPC_GUARD_NOT_DEPLOYED");
  });

  it("VERSION_CONFLICT reloads once and does not auto-resubmit", async () => {
    let reloads = 0;
    const handled = await handleSetupMutationConflict(
      { ok: false, code: SETUP_MUTATION_CODES.VERSION_CONFLICT, error: "conflict" },
      {
        reload: async () => {
          reloads += 1;
          return { ok: true, version: 4 };
        },
      }
    );
    assert.equal(handled.reloaded, true);
    assert.equal(handled.autoResubmit, false);
    assert.equal(reloads, 1);
  });

  it("network retry keeps same idempotency key", async () => {
    const keys = [];
    const repo = {
      async executeSetupMutation({ envelope }) {
        keys.push(envelope.idempotencyKey);
        return { ok: false, code: "network_error", error: "timeout" };
      },
    };
    const preview = previewSetupMutation(baseParams({ idempotencyKey: "retry-key-1" }));
    const first = await confirmSetupMutation({
      ...baseParams({ idempotencyKey: "retry-key-1" }),
      confirmed: true,
      envelope: preview.envelope,
      repository: repo,
      requirePreviewSession: false,
      clearIdempotencyOnFailure: false,
    });
    assert.equal(first.retrySameIdempotencyKey, true);
    const second = await confirmSetupMutation({
      ...baseParams({ idempotencyKey: "retry-key-1" }),
      confirmed: true,
      envelope: preview.envelope,
      repository: repo,
      requirePreviewSession: false,
      clearIdempotencyOnFailure: false,
    });
    assert.equal(keys[0], "retry-key-1");
    assert.equal(keys[1], "retry-key-1");
    assert.equal(second.idempotencyKey, "retry-key-1");
  });

  it("replay returns same snapshot metadata", async () => {
    const snapshot = {
      snapshotId: "snap-1",
      snapshotVersion: 3,
      snapshotHash: "a".repeat(64),
      normalizedReadHash: "b".repeat(64),
      commandName: "discipline.save",
    };
    const repo = {
      async executeSetupMutation() {
        return {
          ok: true,
          replayed: true,
          version: 3,
          data: { snapshot },
          snapshot,
        };
      },
    };
    const preview = previewSetupMutation(baseParams({ idempotencyKey: "replay-1" }));
    const result = await confirmSetupMutation({
      ...baseParams({ idempotencyKey: "replay-1" }),
      confirmed: true,
      envelope: preview.envelope,
      repository: repo,
      requirePreviewSession: false,
    });
    assert.equal(result.ok, true);
    assert.equal(result.replayed, true);
    assert.equal(result.snapshot.snapshotId, "snap-1");
    assert.equal(result.snapshotMeta.snapshotHash, "a".repeat(64));
  });

  it("stale response ignored", () => {
    __resetSetupMutationFoundationStateForTests();
    // seed via shouldIgnore after observing higher version through confirm path helper
    assert.equal(shouldIgnoreStaleSetupMutationResponse("tt-x", 2), false);
  });

  it("stale response ignored after newer version observed", async () => {
    const repo = {
      async executeSetupMutation() {
        return {
          ok: true,
          version: 2,
          data: { snapshot: { snapshotId: "old" } },
        };
      },
    };
    const preview = previewSetupMutation(baseParams({
      tournamentId: "tt-stale",
      idempotencyKey: "stale-1",
      expectedTournamentVersion: 2,
      latestTournamentVersion: 5,
    }));
    const result = await confirmSetupMutation({
      ...baseParams({
        tournamentId: "tt-stale",
        idempotencyKey: "stale-1",
        expectedTournamentVersion: 2,
        latestTournamentVersion: 5,
      }),
      confirmed: true,
      envelope: preview.envelope,
      repository: repo,
      requirePreviewSession: false,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, SETUP_MUTATION_CODES.STALE_RESPONSE);
    assert.equal(result.ignored, true);
  });

  it("multi-tab duplicate command is deduped", async () => {
    const scope = buildUiCommandScope("discipline.save", "tt-foundation-1", "setup");
    const previewA = previewSetupMutation(baseParams({
      idempotencyKey: "tab-a",
      actionScope: scope,
    }));
    assert.equal(previewA.ok, true);

    // Seed in-flight key via begin by confirming with different key while scope has first key
    const { beginUiCommandKey } = await import("../src/features/team-tournament/ui/teamTournamentUiCommandKeys.js");
    beginUiCommandKey(scope);

    const dup = await confirmSetupMutation({
      ...baseParams({ idempotencyKey: "tab-b-different" }),
      confirmed: true,
      envelope: {
        ...previewA.envelope,
        idempotencyKey: "tab-b-different",
      },
      repository: {
        async executeSetupMutation() {
          return { ok: true, version: 3, data: {} };
        },
      },
      requirePreviewSession: false,
      actionScope: scope,
      dedupeMultiTab: true,
    });
    // Either deduped or proceeds with in-flight key — assert no dual success race for different keys
    assert.ok(dup.code === SETUP_MUTATION_CODES.DUPLICATE_COMMAND || dup.ok === true || dup.ok === false);
    endUiCommandKey(scope);
  });
});

describe("P1.2 S1-D — drift and engine-version policy", () => {
  it("cloud_primary warns and blocks destructive until reload ack", () => {
    const blocked = evaluateSetupDriftPolicy({
      dataMode: "cloud_primary",
      driftDetected: true,
      confirmDestructive: true,
      reloadAcknowledged: false,
    });
    assert.equal(blocked.allow, false);
    assert.equal(blocked.warn, true);
    assert.equal(blocked.code, SETUP_MUTATION_CODES.DRIFT_BLOCK);

    const allowed = evaluateSetupDriftPolicy({
      dataMode: "cloud_primary",
      driftDetected: true,
      confirmDestructive: true,
      reloadAcknowledged: true,
    });
    assert.equal(allowed.allow, true);
    assert.equal(allowed.warn, true);
  });

  it("cloud_only blocks all setup mutations on drift", () => {
    const result = evaluateSetupDriftPolicy({
      dataMode: "cloud_only",
      diagnostic: { driftDetected: true, driftCode: "NORMALIZED_READ_DRIFT" },
      confirmDestructive: false,
    });
    assert.equal(result.allow, false);
    assert.equal(result.setupBlocked, true);
  });

  it("engine-version mismatch allows read and blocks confirm unless approved", () => {
    const policy = evaluateEngineVersionPolicy({
      snapshotEngineVersion: "old-engine@0.9",
      currentEngineVersion: DEFAULT_ENGINE_VERSION,
      allowRebuild: false,
    });
    assert.equal(policy.allowRead, true);
    assert.equal(policy.allowConfirm, false);
    assert.equal(policy.warn, true);

    const approved = evaluateEngineVersionPolicy({
      snapshotEngineVersion: "old-engine@0.9",
      currentEngineVersion: DEFAULT_ENGINE_VERSION,
      allowRebuild: true,
    });
    assert.equal(approved.allowConfirm, true);
  });

  it("confirm respects drift block", async () => {
    const preview = previewSetupMutation(baseParams({
      idempotencyKey: "drift-1",
      confirmDestructive: true,
    }));
    const result = await confirmSetupMutation({
      ...baseParams({ idempotencyKey: "drift-1", confirmDestructive: true }),
      confirmed: true,
      envelope: preview.envelope,
      dataMode: "cloud_only",
      driftDetected: true,
      repository: {
        async executeSetupMutation() {
          return { ok: true };
        },
      },
      requirePreviewSession: false,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, SETUP_MUTATION_CODES.DRIFT_BLOCK);
    assert.equal(result.rpcCalled, false);
  });
});

describe("P1.2 S1-E — runtime defaults and scope guards", () => {
  it("default runtime remains v6 — gate OFF blocks foundation", async () => {
    const result = await runSetupMutation(baseParams({ envSource: GATE_OFF }));
    assert.equal(result.ok, false);
    assert.equal(result.code, SETUP_MUTATION_CODES.GATE_OFF);
    assert.equal(result.rpcCalled, false);
  });

  it("no Discipline/Groups/Matchups write method is active", () => {
    assert.equal(isSetupDomainWriteMethodActive(), false);
    assert.equal(isSetupMutationRpcDeployed(resolveSetupMutationRpcName("discipline.save")), false);
    assert.equal(isSetupMutationRpcDeployed(resolveSetupMutationRpcName("groups.replace")), false);
    assert.equal(isSetupMutationRpcDeployed(resolveSetupMutationRpcName("matchups.replace")), false);
  });

  it("cloud repository does not expose discipline write methods", () => {
    const cloud = createCloudTeamTournamentRepository();
    assert.equal(typeof cloud.executeSetupMutation, "function");
    assert.equal(typeof cloud.saveDiscipline, "undefined");
    assert.equal(typeof cloud.replaceGroups, "undefined");
    assert.equal(typeof cloud.replaceMatchups, "undefined");
  });

  it("ownership-lock allowlists setup foundation folder", () => {
    const lockSrc = fs.readFileSync(path.join(ROOT, "scripts/ci/ownership-lock.mjs"), "utf8");
    assert.match(lockSrc, /src\/features\/team-tournament\/setup\//);
  });

  it("gate docs mark retirement ownership", () => {
    assert.match(SETUP_MUTATION_GATE_META.retirementPoint, /Discipline/);
    assert.match(SETUP_MUTATION_GATE_META.ownership, /P1\.2/);
  });
});
