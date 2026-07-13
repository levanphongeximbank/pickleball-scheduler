import { mkdirSync, writeFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { FIXTURE, buildSingleMatchResetSql } from "./seed-referee-v5-test-staging.mjs";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { MATCH_EVENT_TYPE } from "../src/features/referee-v5/constants/eventTypes.js";
import { RefereeV5SupabaseRepository } from "../src/features/referee-v5/persistence/RefereeV5SupabaseRepository.js";
import { RefereeV5EdgeCommandHandler } from "../src/features/referee-v5/persistence/RefereeV5EdgeCommandHandler.js";
import { RefereeV5RpcAtomicCommitService } from "../src/features/referee-v5/persistence/RefereeV5RpcAtomicCommitService.js";
import { REFEREE_V5_INTERNAL_RPC } from "../src/features/referee-v5/server/edgeHttpHandler.js";
import { buildMatchStateId } from "../src/features/referee-v5/persistence/matchStateSerializer.js";

export const STAGING_REF = "qyewbxjsiiyufanzcjcq";
export const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
export const EDGE_URL = `https://${STAGING_REF}.supabase.co/functions/v1/referee-v5-match`;
export const D4_OUT_DIR = "docs/v5/qa-evidence/phase-v5d4";
export const D41_OUT_DIR = "docs/v5/qa-evidence/phase-v5d41";
export const E1_OUT_DIR = "docs/v5/qa-evidence/phase-v5e1";
export const REFEREE_USER_ID = FIXTURE.USERS.refereeA;

export function assertStagingOnly() {
  loadProjectEnv();
  const { url } = getStagingSupabaseEnv();
  if (String(url).includes(PRODUCTION_REF)) {
    throw new Error("STOP — production ref");
  }
  if (!String(url).includes(STAGING_REF)) {
    throw new Error(`STOP — expected staging ref ${STAGING_REF}`);
  }
  return url;
}

export function createStagingService() {
  const { url, serviceKey } = getStagingSupabaseEnv();
  assertStagingOnly();
  if (!serviceKey) {
    throw new Error("Missing STAGING_SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function trustedToken(userId = REFEREE_USER_ID) {
  return `jwt:${userId}`;
}

export function createFaultHarness(service) {
  const repository = new RefereeV5SupabaseRepository(service);
  const atomicCommit = new RefereeV5RpcAtomicCommitService(
    repository,
    service,
    REFEREE_V5_INTERNAL_RPC,
  );
  const handler = new RefereeV5EdgeCommandHandler(repository, atomicCommit);
  return { repository, atomicCommit, handler };
}

export function matchStateId(matchId, tenantId = FIXTURE.TENANT_A, tournamentId = FIXTURE.TOURNAMENT_A) {
  return buildMatchStateId({ tenantId, tournamentId, matchId });
}

export async function resetMatchFromSeed(service, matchId) {
  const id = matchStateId(matchId);
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (token) {
    const sql = buildSingleMatchResetSql(matchId);
    const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || `reset failed for ${matchId}`);
    }
    return id;
  }
  await service.from("match_sync_mutations").delete().eq("match_state_id", id);
  await service.from("match_integration_outbox").delete().eq("match_state_id", id);
  await service.from("match_result_revisions").delete().eq("match_id", matchId);
  await service.from("match_events").delete().eq("match_state_id", id);
  return id;
}

export async function snapshotMatch(service, matchId) {
  const id = matchStateId(matchId);
  const [live, events, mutations, revisions, outbox] = await Promise.all([
    service
      .from("match_live_states")
      .select("state_version, last_event_sequence, state_hash, status, locked_at")
      .eq("id", id)
      .maybeSingle(),
    service.from("match_events").select("id", { count: "exact", head: true }).eq("match_state_id", id),
    service
      .from("match_sync_mutations")
      .select("id, status, idempotency_key")
      .eq("match_state_id", id),
    service.from("match_result_revisions").select("id", { count: "exact", head: true }).eq("match_id", matchId),
    service.from("match_integration_outbox").select("id", { count: "exact", head: true }).eq("match_state_id", id),
  ]);

  return {
    matchStateId: id,
    version: live.data?.state_version ?? 0,
    sequence: live.data?.last_event_sequence ?? 0,
    stateHash: live.data?.state_hash ?? null,
    status: live.data?.status ?? null,
    lockedAt: live.data?.locked_at ?? null,
    eventCount: events.count ?? 0,
    mutationCount: mutations.data?.length ?? 0,
    completedMutations: (mutations.data || []).filter((m) => m.status === "applied").length,
    revisionCount: revisions.count ?? 0,
    outboxCount: outbox.count ?? 0,
  };
}

export async function applyHarnessCommand(harness, {
  matchId = FIXTURE.MATCH_DOUBLES,
  commandType,
  expectedVersion,
  expectedSequence,
  idempotencyKey,
  fault = null,
}) {
  if (fault) {
    harness.atomicCommit.setStagingFault(fault);
  } else {
    harness.atomicCommit.setStagingFault(null);
  }
  const result = await harness.handler.processMatchCommand({
    accessToken: trustedToken(),
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId,
    commandType,
    expectedVersion,
    expectedSequence,
    clientMutationId: idempotencyKey,
    idempotencyKey,
  });
  harness.atomicCommit.setStagingFault(null);
  return result;
}

export async function applyHarnessFinalize(harness, {
  matchId = FIXTURE.MATCH_SINGLES,
  expectedVersion,
  idempotencyKey,
  fault = null,
  forceComplete = true,
}) {
  if (fault) {
    harness.atomicCommit.setStagingFault(fault);
  } else {
    harness.atomicCommit.setStagingFault(null);
  }
  const result = await harness.handler.processFinalize({
    accessToken: trustedToken(),
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId,
    expectedVersion,
    idempotencyKey,
    forceComplete,
  });
  harness.atomicCommit.setStagingFault(null);
  return result;
}

export async function runCommandSequence(service, harness, matchId, commands) {
  let snap = await snapshotMatch(service, matchId);
  for (const cmd of commands) {
    const idem = cmd.idempotencyKey || `seq-${cmd}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const res = await applyHarnessCommand(harness, {
      matchId,
      commandType: cmd,
      expectedVersion: snap.version,
      expectedSequence: snap.sequence,
      idempotencyKey: idem,
      fault: cmd.fault || null,
    });
    if (!res.ok && !cmd.allowFail) {
      return { ok: false, cmd, res, snap };
    }
    snap = await snapshotMatch(service, matchId);
  }
  return { ok: true, snap };
}

export function writeReport(fileName, payload, outDir = D4_OUT_DIR) {
  const dir = pathJoin(process.cwd(), outDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(pathJoin(dir, fileName), JSON.stringify(payload, null, 2));
}

export function writeD41Report(fileName, payload) {
  writeReport(fileName, payload, D41_OUT_DIR);
}

export async function edgePost(accessToken, body) {
  const res = await fetch(EDGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

export { FIXTURE, MATCH_EVENT_TYPE };
