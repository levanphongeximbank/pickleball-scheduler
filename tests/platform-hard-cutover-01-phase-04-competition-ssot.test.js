import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  COMPETITION_SSOT_ERROR,
  COMPETITION_SSOT_RPC,
  assertTextTenantId,
  createFailClosedCompetitionSsotAdapter,
  createRemoteCompetitionSsotAdapter,
  resolveCompetitionSsotAdapter,
} from "../src/features/competition-engine/remote-ssot/competitionSsotAdapter.js";
import { COMPETITION_REMOTE_SSOT_FLAG } from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";

const M8 = path.join(
  process.cwd(),
  "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot"
);

function readM8(name) {
  return fs.readFileSync(path.join(M8, name), "utf8");
}

test("M8 SQL: tenant_id columns are text (not uuid)", () => {
  const tables = readM8("10_TABLES.sql");
  assert.equal(/tenant_id\s+uuid\b/.test(tables), false);
  assert.equal((tables.match(/tenant_id\s+text\s+NOT\s+NULL/g) || []).length >= 8, true);
  assert.equal(tables.includes("CHECK (length(trim(tenant_id)) > 0)"), true);
});

test("M8 SQL: RPC p_tenant_id is text; no uuid p_tenant_id", () => {
  const rpc = readM8("40_RPC_COMMAND_AND_FINALIZE.sql");
  assert.equal(/p_tenant_id\s+uuid\b/.test(rpc), false);
  assert.equal((rpc.match(/p_tenant_id\s+text\b/g) || []).length >= 3, true);
  assert.equal(rpc.includes("length(trim(p_tenant_id)) = 0"), true);
  assert.equal(rpc.includes("THE single finalized-result writer"), true);
  assert.equal(
    rpc.includes(
      "GRANT EXECUTE ON FUNCTION public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text)"
    ),
    true
  );
});

test("M8 SQL: RLS compares text tenant_id to user_venue_id without casts", () => {
  const rls = readM8("30_RLS.sql");
  assert.equal(rls.includes("tenant_id = public.user_venue_id()"), true);
  assert.equal(/tenant_id\s*::\s*text/.test(rls), false);
  assert.equal(/user_venue_id\(\)\s*::\s*uuid/.test(rls), false);
  assert.equal(rls.includes("length(trim(public.user_venue_id())) > 0"), true);
  assert.equal(rls.includes("WITH CHECK (false)"), true);
});

test("M8 SQL: rollback drops text + legacy uuid signatures and all competition_ssot_* tables", () => {
  const rollback = readM8("90_ROLLBACK.sql");
  assert.equal(
    rollback.includes(
      "DROP FUNCTION IF EXISTS public.competition_ssot_finalize_match_result(text, uuid, jsonb, text, text, text)"
    ),
    true
  );
  assert.equal(
    rollback.includes(
      "DROP FUNCTION IF EXISTS public.competition_ssot_finalize_match_result(uuid, uuid, jsonb, text, text, text)"
    ),
    true
  );
  for (const table of [
    "competition_ssot_idempotency",
    "competition_ssot_audit_events",
    "competition_ssot_command_log",
    "competition_ssot_standings_snapshots",
    "competition_ssot_finalized_results",
    "competition_ssot_matches",
    "competition_ssot_participants",
    "competition_ssot_competitions",
  ]) {
    assert.equal(rollback.includes(`DROP TABLE IF EXISTS public.${table}`), true);
  }
});

test("M8 SQL: verify asserts tenant_id type is text", () => {
  const verify = readM8("99_VERIFY.sql");
  assert.equal(verify.includes("format_type(a.atttypid, a.atttypmod) <> 'text'"), true);
  assert.equal(verify.includes("competition_ssot_finalize_match_result"), true);
});

test("assertTextTenantId: accepts venue-style text tenant", () => {
  const ok = assertTextTenantId("venue-staging-a");
  assert.equal(ok.ok, true);
  assert.equal(ok.tenantId, "venue-staging-a");
});

test("assertTextTenantId: missing/blank fails closed", () => {
  assert.equal(assertTextTenantId(null).ok, false);
  assert.equal(assertTextTenantId("").ok, false);
  assert.equal(assertTextTenantId("   ").ok, false);
  assert.equal(assertTextTenantId(undefined).code, COMPETITION_SSOT_ERROR.INVALID_ARGS);
});

test("competition SSOT: fail-closed adapter blocks finalize", async () => {
  const adapter = createFailClosedCompetitionSsotAdapter();
  const result = await adapter.finalizeMatchResult({
    tenantId: "venue-staging-a",
    matchId: "m1",
    idempotencyKey: "idem-0001",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, COMPETITION_SSOT_ERROR.UNAVAILABLE);
});

test("competition SSOT: remote adapter accepts text tenant and calls finalize once", async () => {
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
    tenantId: "venue-staging-a",
    matchId: "22222222-2222-2222-2222-222222222222",
    idempotencyKey: "finalize-key-001",
    resultPayload: { score: [11, 5] },
    source: "referee_pipeline",
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, COMPETITION_SSOT_RPC.FINALIZE);
  assert.equal(calls[0].args.p_tenant_id, "venue-staging-a");
  assert.equal(calls[0].args.p_source, "referee_pipeline");
  assert.equal(calls[0].args.p_idempotency_key, "finalize-key-001");
});

test("competition SSOT: wrong/missing tenant denied at adapter (fail-closed)", async () => {
  let rpcCalls = 0;
  const adapter = createRemoteCompetitionSsotAdapter({
    rpc: async () => {
      rpcCalls += 1;
      return { data: { ok: true } };
    },
  });
  const missing = await adapter.finalizeMatchResult({
    matchId: "m",
    idempotencyKey: "idem-1",
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, COMPETITION_SSOT_ERROR.INVALID_ARGS);
  assert.equal(rpcCalls, 0);

  const blank = await adapter.finalizeMatchResult({
    tenantId: "  ",
    matchId: "m",
    idempotencyKey: "idem-2",
  });
  assert.equal(blank.ok, false);
  assert.equal(rpcCalls, 0);
});

test("competition SSOT: remote adapter rejects missing idempotency key", async () => {
  const adapter = createRemoteCompetitionSsotAdapter({
    rpc: async () => ({ data: { ok: true } }),
  });
  const result = await adapter.finalizeMatchResult({
    tenantId: "venue-staging-a",
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
    tenantId: "venue-staging-a",
    matchId: "m",
    idempotencyKey: "idem-fail-01",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, COMPETITION_SSOT_ERROR.RPC_FAILED);
});

test("hotfix package: no Production/Staging apply mutation claims", () => {
  const tables = readM8("10_TABLES.sql");
  assert.equal(tables.includes("NOT applied by this PR"), true);
  assert.equal(tables.includes("Staging rehearsal / Production require Owner GO"), true);
});
