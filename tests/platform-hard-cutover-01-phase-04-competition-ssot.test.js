import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPETITION_SSOT_ERROR,
  COMPETITION_SSOT_RPC,
  createFailClosedCompetitionSsotAdapter,
  createRemoteCompetitionSsotAdapter,
  resolveCompetitionSsotAdapter,
} from "../src/features/competition-engine/remote-ssot/competitionSsotAdapter.js";
import { COMPETITION_REMOTE_SSOT_FLAG } from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";

test("competition SSOT: fail-closed adapter blocks finalize", async () => {
  const adapter = createFailClosedCompetitionSsotAdapter();
  const result = await adapter.finalizeMatchResult({
    tenantId: "t1",
    matchId: "m1",
    idempotencyKey: "idem-0001",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, COMPETITION_SSOT_ERROR.UNAVAILABLE);
});

test("competition SSOT: remote adapter calls finalize RPC once (single writer)", async () => {
  const calls = [];
  const adapter = createRemoteCompetitionSsotAdapter({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: { ok: true, result_id: "r1", replay: false },
      };
    },
  });

  const result = await adapter.finalizeMatchResult({
    tenantId: "11111111-1111-1111-1111-111111111111",
    matchId: "22222222-2222-2222-2222-222222222222",
    idempotencyKey: "finalize-key-001",
    resultPayload: { score: [11, 5] },
    source: "referee_pipeline",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, COMPETITION_SSOT_RPC.FINALIZE);
  assert.equal(calls[0].args.p_source, "referee_pipeline");
  assert.equal(calls[0].args.p_idempotency_key, "finalize-key-001");
});

test("competition SSOT: remote adapter rejects missing idempotency key", async () => {
  const adapter = createRemoteCompetitionSsotAdapter({
    rpc: async () => ({ data: { ok: true } }),
  });
  const result = await adapter.finalizeMatchResult({
    tenantId: "t",
    matchId: "m",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, COMPETITION_SSOT_ERROR.INVALID_ARGS);
});

test("competition SSOT: resolve uses remote when flag on", () => {
  const adapter = resolveCompetitionSsotAdapter({
    env: { [COMPETITION_REMOTE_SSOT_FLAG]: "true" },
    rpc: async () => ({ data: { ok: true } }),
  });
  assert.equal(adapter.kind, "remote_ssot");
});

test("competition SSOT: resolve fail-closed when hard cutover without remote flag", () => {
  const adapter = resolveCompetitionSsotAdapter({
    env: {
      VITE_PLATFORM_HARD_CUTOVER_ENABLED: "true",
      [COMPETITION_REMOTE_SSOT_FLAG]: "false",
    },
  });
  assert.equal(adapter.kind, "fail_closed");
});

test("competition SSOT: test memory only when explicitly allowed", () => {
  const adapter = resolveCompetitionSsotAdapter({
    env: { [COMPETITION_REMOTE_SSOT_FLAG]: "false" },
    allowInMemoryForTests: true,
  });
  assert.equal(adapter.kind, "test_memory");
});

test("competition SSOT: RPC failure does not silent-fallback", async () => {
  const adapter = createRemoteCompetitionSsotAdapter({
    rpc: async () => ({ error: { message: "boom" } }),
  });
  const result = await adapter.finalizeMatchResult({
    tenantId: "t",
    matchId: "m",
    idempotencyKey: "idem-fail-01",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, COMPETITION_SSOT_ERROR.RPC_FAILED);
});
