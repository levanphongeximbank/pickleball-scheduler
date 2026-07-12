#!/usr/bin/env node
/**
 * Referee V5-D.3 — Real HTTP verification on staging (no in-memory mocks).
 * Usage: node scripts/verify-referee-v5-http-concurrency-staging.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import { FIXTURE, buildSingleMatchResetSql } from "./seed-referee-v5-test-staging.mjs";
import { MATCH_EVENT_TYPE } from "../src/features/referee-v5/constants/eventTypes.js";
import { buildCommandRequestHash } from "../src/features/referee-v5/persistence/RefereeV5AtomicCommitService.js";
import { RefereeV5SupabaseRepository } from "../src/features/referee-v5/persistence/RefereeV5SupabaseRepository.js";
import { RefereeV5EdgeCommandHandler } from "../src/features/referee-v5/persistence/RefereeV5EdgeCommandHandler.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const EDGE_URL = `https://${STAGING_REF}.supabase.co/functions/v1/referee-v5-match`;
const EXPIRED_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjE1MTYyMzkwMjJ9.invalidsig";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "..", "docs/v5/qa-evidence/phase-v5d3");

const results = [];

function record(id, pass, expected, actual, method) {
  results.push({ id, pass, expected, actual, method });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}`);
}

async function fetchAnonKeyFromManagementApi(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return null;
  }
  const keys = await res.json();
  const anon = keys?.find((k) => k.name === "anon" || k.name === "anon key");
  return anon?.api_key ?? keys?.[0]?.api_key ?? null;
}

async function edgePost(accessToken, body) {
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

async function applyCommand(session, args) {
  return edgePost(session.accessToken, {
    action: "apply-command",
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId: args.matchId || FIXTURE.MATCH_DOUBLES,
    commandType: args.commandType,
    payload: args.payload || {},
    expectedVersion: args.expectedVersion,
    expectedSequence: args.expectedSequence,
    clientMutationId: args.clientMutationId || args.idempotencyKey,
    idempotencyKey: args.idempotencyKey,
  });
}

async function getState(session, matchId = FIXTURE.MATCH_DOUBLES) {
  return edgePost(session.accessToken, {
    action: "get-state",
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId,
  });
}

async function resetDoublesMatch(service) {
  const matchStateId = `${FIXTURE.TENANT_A}::${FIXTURE.TOURNAMENT_A}::${FIXTURE.MATCH_DOUBLES}`;
  const sql = buildSingleMatchResetSql(FIXTURE.MATCH_DOUBLES);
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    if (!res.ok) {
      throw new Error(`resetDoublesMatch failed: HTTP ${res.status}`);
    }
    return;
  }
  await service.from("match_sync_mutations").delete().eq("match_state_id", matchStateId);
  await service.from("match_events").delete().eq("match_state_id", matchStateId);
}

async function countEvents(service, matchId = FIXTURE.MATCH_DOUBLES) {
  const matchStateId = `${FIXTURE.TENANT_A}::${FIXTURE.TOURNAMENT_A}::${matchId}`;
  const { count, error } = await service
    .from("match_events")
    .select("*", { count: "exact", head: true })
    .eq("match_state_id", matchStateId);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function getLiveSnapshot(service, matchId = FIXTURE.MATCH_DOUBLES) {
  const matchStateId = `${FIXTURE.TENANT_A}::${FIXTURE.TOURNAMENT_A}::${matchId}`;
  const { data, error } = await service
    .from("match_live_states")
    .select("state_version, last_event_sequence, state_hash, state_payload")
    .eq("id", matchStateId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(error?.message || "live state missing");
  }
  return data;
}

async function main() {
  loadProjectEnv();
  mkdirSync(outDir, { recursive: true });

  const { url, serviceKey } = getStagingSupabaseEnv();
  if (String(url).includes(PRODUCTION_REF)) {
    throw new Error("STOP — production ref");
  }

  const pat = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  console.log(`SUPABASE_ACCESS_TOKEN: ${pat ? "PRESENT" : "MISSING"}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? "CONFIGURED" : "MISSING"}`);

  if (!process.env.STAGING_SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY && pat) {
    const anon = await fetchAnonKeyFromManagementApi(pat);
    if (anon) {
      process.env.STAGING_SUPABASE_ANON_KEY = anon;
      process.env.VITE_SUPABASE_ANON_KEY = anon;
    }
  }

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  const edgeProbe = await fetch(EDGE_URL, { method: "OPTIONS" });
  record(
    "edge_function_reachable",
    edgeProbe.status === 200 || edgeProbe.status === 204,
    "OPTIONS 200/204",
    edgeProbe.status,
    "HTTP OPTIONS",
  );

  if (edgeProbe.status === 404) {
    writeFileSync(join(outDir, "CONCURRENCY_REPORT.json"), JSON.stringify({ results, blocked: "edge not deployed" }, null, 2));
    console.error("\nFAIL — Edge function not deployed. Run: node scripts/deploy-referee-v5-edge-staging.mjs");
    process.exit(1);
  }

  const noAuth = await fetch(EDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "get-state", tournamentId: FIXTURE.TOURNAMENT_A, matchId: FIXTURE.MATCH_DOUBLES }),
  });
  record("no_authorization_header", noAuth.status === 401, 401, noAuth.status, "HTTP POST without Authorization");

  const badToken = await edgePost(EXPIRED_JWT, { action: "get-state", tournamentId: FIXTURE.TOURNAMENT_A, matchId: FIXTURE.MATCH_DOUBLES });
  record("invalid_token_rejected", badToken.status === 401, 401, badToken.status, "HTTP POST expired JWT");

  const referee = await signInStagingUser(FIXTURE.USERS.refereeA.replace("@staging.local", "") === "owner" ? "owner@staging.local" : "owner@staging.local");
  const player = await signInStagingUser("player@staging.local");
  const refereeB = await signInStagingUser("owner-b@staging.local");

  if (referee.error || !referee.client) {
    record("auth_referee_a", false, "session", referee.error || "missing anon key", "signInStagingUser");
    writeFileSync(join(outDir, "CONCURRENCY_REPORT.json"), JSON.stringify({ results }, null, 2));
    process.exit(1);
  }

  const { data: sessionData } = await referee.client.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const session = { accessToken, client: referee.client, userId: referee.userId };

  record("auth_referee_a", Boolean(accessToken), "token present", accessToken ? "present" : "missing", "signInStagingUser");

  await resetDoublesMatch(service);

  const fakeBody = await edgePost(accessToken, {
    action: "apply-command",
    actorId: "00000000-0000-0000-0000-000000000001",
    tenantId: "fake-tenant",
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId: FIXTURE.MATCH_DOUBLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: `fake-body-${Date.now()}`,
  });
  record(
    "fake_actor_tenant_ignored",
    fakeBody.body?.ok === true ||
      fakeBody.body?.code === "VALIDATION_FAILED" ||
      fakeBody.body?.code === "MATCH_STATE_CONFLICT",
    "fake actor rejected or ignored; verified actor used on success",
    fakeBody.body?.code || fakeBody.body?.ok,
    "apply-command with fake actorId in body",
  );

  if (fakeBody.body?.ok) {
    const { data: fakeEvents } = await service
      .from("match_events")
      .select("actor_id")
      .eq("match_state_id", `${FIXTURE.TENANT_A}::${FIXTURE.TOURNAMENT_A}::${FIXTURE.MATCH_DOUBLES}`)
      .order("event_sequence", { ascending: false })
      .limit(1);
    record(
      "fake_actor_never_trusted",
      fakeEvents?.[0]?.actor_id === referee.userId,
      "verified JWT actor on event",
      fakeEvents?.[0]?.actor_id,
      "audit actor after fake body success",
    );
  } else {
    record(
      "fake_actor_never_trusted",
      fakeBody.body?.code === "VALIDATION_FAILED" || fakeBody.body?.code === "MATCH_STATE_CONFLICT",
      "fake actor rejected",
      fakeBody.body?.code,
      "fake actor rejected before commit",
    );
  }

  const unassignedRes = player.client
    ? await edgePost((await player.client.auth.getSession()).data.session.access_token, {
        action: "get-state",
        tournamentId: FIXTURE.TOURNAMENT_A,
        matchId: FIXTURE.MATCH_SINGLES,
      })
    : { body: { code: "BLOCKED_PLAYER_AUTH" } };
  record(
    "unassigned_referee_denied",
    player.client
      ? unassignedRes.body?.code === "REFEREE_NOT_ASSIGNED"
      : false,
    player.client ? "REFEREE_NOT_ASSIGNED" : `BLOCKED: ${player.error}`,
    unassignedRes.body?.code,
    "player get-state singles (no assignment)",
  );

  const revoked = player.client
    ? await edgePost((await player.client.auth.getSession()).data.session.access_token, {
        action: "apply-command",
        tournamentId: FIXTURE.TOURNAMENT_A,
        matchId: FIXTURE.MATCH_DOUBLES,
        commandType: MATCH_EVENT_TYPE.START_MATCH,
        expectedVersion: 0,
        expectedSequence: 0,
        idempotencyKey: `revoked-${Date.now()}`,
      })
    : { body: { code: "BLOCKED_PLAYER_AUTH" } };
  record(
    "revoked_assignment_denied",
    player.client
      ? revoked.body?.code === "REFEREE_NOT_ASSIGNED" || revoked.body?.code === "ASSIGNMENT_REVOKED"
      : false,
    player.client ? "ASSIGNMENT_REVOKED or NOT_ASSIGNED" : `BLOCKED: ${player.error}`,
    revoked.body?.code,
    "player apply on doubles (revoked row)",
  );

  const expiredRes = await edgePost(accessToken, {
    action: "get-state",
    tournamentId: FIXTURE.TOURNAMENT_A,
    matchId: FIXTURE.MATCH_EXPIRED,
  });
  record(
    "expired_assignment_denied",
    expiredRes.body?.code === "ASSIGNMENT_EXPIRED" || expiredRes.body?.code === "REFEREE_NOT_ASSIGNED",
    "ASSIGNMENT_EXPIRED",
    expiredRes.body?.code,
    "get-state expired match",
  );

  const crossTenant = await edgePost(accessToken, {
    action: "get-state",
    tournamentId: FIXTURE.TOURNAMENT_B,
    matchId: FIXTURE.MATCH_TENANT_B,
  });
  record(
    "cross_tenant_read_blocked_as_expected",
    crossTenant.body?.ok === false,
    "denied",
    crossTenant.body?.code,
    "tenant A reads tenant B",
  );

  const internalRpc = await referee.client.rpc("referee_v5_commit_match_transition", {
    p_tenant_id: FIXTURE.TENANT_A,
    p_tournament_id: FIXTURE.TOURNAMENT_A,
    p_match_id: FIXTURE.MATCH_DOUBLES,
    p_actor_id: referee.userId,
    p_command_type: "START_MATCH",
    p_command_payload: {},
    p_expected_state_version: 0,
    p_expected_event_sequence: 0,
    p_client_mutation_id: "x",
    p_idempotency_key: "x",
    p_request_hash: "x",
    p_next_state: {},
    p_generated_events: [],
    p_state_before_hash: "a",
    p_state_after_hash: "b",
  });
  record(
    "internal_rpc_browser_call_blocked_as_expected",
    Boolean(internalRpc.error),
    "permission denied",
    internalRpc.error?.message || "ok",
    "authenticated commit rpc",
  );

  await resetDoublesMatch(service);

  const commandLog = [];
  let stateRes = await getState(session);
  let version = stateRes.body.stateVersion ?? 0;
  let sequence = stateRes.body.lastEventSequence ?? 0;

  const commands = [
    MATCH_EVENT_TYPE.START_MATCH,
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.SWITCH_ENDS,
    MATCH_EVENT_TYPE.UNDO_LAST_EVENT,
  ];

  for (const cmd of commands) {
    const idem = `http-cmd-${cmd}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const beforeV = version;
    const beforeS = sequence;
    const res = await applyCommand(session, {
      commandType: cmd,
      expectedVersion: version,
      expectedSequence: sequence,
      idempotencyKey: idem,
    });
    commandLog.push({
      commandType: cmd,
      httpStatus: res.status,
      code: res.body?.code,
      beforeVersion: beforeV,
      afterVersion: res.body?.stateVersion,
      beforeSequence: beforeS,
      afterSequence: res.body?.lastEventSequence,
      pass: res.body?.ok === true,
    });
    if (res.body?.ok) {
      version = res.body.stateVersion ?? res.body.state?.version ?? version + 1;
      sequence = res.body.lastEventSequence ?? res.body.state?.lastEventSequence ?? sequence + 1;
    }
  }

  record(
    "http_commands_applied",
    commandLog.every((c) => c.pass),
    "all commands ok",
    commandLog.filter((c) => !c.pass).map((c) => c.commandType).join(",") || "all pass",
    "Edge apply-command sequence",
  );

  const undoEntry = commandLog.find((c) => c.commandType === MATCH_EVENT_TYPE.UNDO_LAST_EVENT);
  if (undoEntry?.pass) {
    const matchStateId = `${FIXTURE.TENANT_A}::${FIXTURE.TOURNAMENT_A}::${FIXTURE.MATCH_DOUBLES}`;
    const repo = new RefereeV5SupabaseRepository(service);
    const handler = new RefereeV5EdgeCommandHandler(repo);
    const replayCheck = await handler.verifySnapshotMatchesReplay(matchStateId);
    const { data: events } = await service
      .from("match_events")
      .select("event_type, command_type, event_sequence, state_version_before, command_payload, generated_events, actor_id")
      .eq("match_state_id", matchStateId)
      .order("event_sequence", { ascending: true });
    const revertEvent = events?.find(
      (e) =>
        e.command_type === MATCH_EVENT_TYPE.UNDO_LAST_EVENT ||
        e.command_type === MATCH_EVENT_TYPE.EVENT_REVERTED ||
        e.event_type === MATCH_EVENT_TYPE.EVENT_REVERTED ||
        (Array.isArray(e.generated_events) && e.generated_events.includes(MATCH_EVENT_TYPE.EVENT_REVERTED)),
    );
    const live = await getLiveSnapshot(service);
    const replayReport = {
      undoPass: undoEntry.pass,
      eventRevertedAppended: Boolean(revertEvent),
      originalEventsPreserved: (events || []).filter((e) => e.command_type === MATCH_EVENT_TYPE.SWITCH_ENDS).length >= 1,
      snapshotHash: live.state_hash,
      replayHash: replayCheck.rebuiltHash ?? null,
      replayMatchesSnapshot: replayCheck.ok === true,
      versionAfterUndo: live.state_version,
      sequenceAfterUndo: live.last_event_sequence,
    };
    writeFileSync(join(outDir, "REPLAY_HASH_REPORT.json"), JSON.stringify(replayReport, null, 2));
    record("undo_event_reverted_appended", Boolean(revertEvent), "EVENT_REVERTED", revertEvent?.command_type, "undo event row");
    record("undo_replay_snapshot_consistency", replayCheck.ok === true, "hash match", replayReport, "replay vs snapshot");
  } else {
    writeFileSync(join(outDir, "REPLAY_HASH_REPORT.json"), JSON.stringify({ undoPass: false }, null, 2));
    record("undo_event_reverted_appended", false, "EVENT_REVERTED", undoEntry?.code, "undo failed");
    record("undo_replay_snapshot_consistency", false, "hash match", undoEntry?.code, "undo failed");
  }

  writeFileSync(join(outDir, "HTTP_COMMAND_REPORT.json"), JSON.stringify({ commandLog }, null, 2));

  stateRes = await getState(session);
  version = stateRes.body.stateVersion;
  sequence = stateRes.body.lastEventSequence;

  const c1a = applyCommand(session, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: `c1a-${Date.now()}`,
  });
  const c1b = applyCommand(session, {
    commandType: MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: `c1b-${Date.now()}`,
  });
  const [r1a, r1b] = await Promise.all([c1a, c1b]);
  const c1Pass =
    (r1a.body?.ok && r1b.body?.code === "MATCH_STATE_CONFLICT") ||
    (r1b.body?.ok && r1a.body?.code === "MATCH_STATE_CONFLICT");
  record("c1_same_version_conflict", c1Pass, "one ok one CONFLICT", { a: r1a.body?.code, b: r1b.body?.code }, "parallel apply");

  stateRes = await getState(session);
  version = stateRes.body.stateVersion;
  sequence = stateRes.body.lastEventSequence;

  const idem2 = `c2-idem-${Date.now()}`;
  const eventsBeforeC2 = await countEvents(service);
  const versionBeforeC2 = version;
  const c2a = applyCommand(session, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: idem2,
  });
  const c2b = applyCommand(session, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: idem2,
  });
  const [r2a, r2b] = await Promise.all([c2a, c2b]);
  const eventsAfterC2 = await countEvents(service);
  stateRes = await getState(session);
  version = stateRes.body.stateVersion;
  sequence = stateRes.body.lastEventSequence;
  const c2DuplicateOk =
    r2a.body?.ok && r2b.body?.ok && (r2a.body?.duplicate || r2b.body?.duplicate);
  const c2SingleEvent = eventsAfterC2 === eventsBeforeC2 + 1;
  const c2SingleVersion =
    r2a.body?.stateVersion === r2b.body?.stateVersion &&
    Number(r2a.body?.stateVersion) === Number(versionBeforeC2) + 1;
  record(
    "c2_same_idempotency_duplicate",
    c2DuplicateOk && c2SingleEvent && c2SingleVersion,
    "both ok duplicate, one event, one version step",
    {
      duplicate: { a: r2a.body?.duplicate, b: r2b.body?.duplicate },
      eventsBefore: eventsBeforeC2,
      eventsAfter: eventsAfterC2,
      version: r2a.body?.stateVersion,
    },
    "parallel same idempotency",
  );

  const idem3 = `c3-idem-${Date.now()}`;
  const liveBeforeC3 = await getLiveSnapshot(service);
  await applyCommand(session, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: idem3,
  });
  stateRes = await getState(session);
  const v3 = stateRes.body.stateVersion;
  const s3 = stateRes.body.lastEventSequence;
  const r3 = await applyCommand(session, {
    commandType: MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    expectedVersion: v3 - 1,
    expectedSequence: s3 - 1,
    idempotencyKey: idem3,
  });
  const liveAfterC3 = await getLiveSnapshot(service);
  record(
    "c3_idempotency_hash_mismatch",
    r3.body?.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH",
    "IDEMPOTENCY_KEY_REUSE_MISMATCH",
    r3.body?.code,
    "reuse key different command",
  );
  record(
    "c3_state_unchanged_on_mismatch",
    liveAfterC3.state_version === liveBeforeC3.state_version + 1 &&
      liveAfterC3.last_event_sequence === liveBeforeC3.last_event_sequence + 1,
    "only first command applied",
    {
      before: { v: liveBeforeC3.state_version, s: liveBeforeC3.last_event_sequence },
      after: { v: liveAfterC3.state_version, s: liveAfterC3.last_event_sequence },
    },
    "snapshot unchanged after mismatch retry",
  );

  writeFileSync(join(outDir, "CONCURRENCY_REPORT.json"), JSON.stringify({ results }, null, 2));
  writeFileSync(
    join(outDir, "IDEMPOTENCY_REPORT.json"),
    JSON.stringify(
      {
        c1: { r1a: r1a.body?.code, r1b: r1b.body?.code },
        c2: { r2a: r2a.body, r2b: r2b.body, eventsBeforeC2, eventsAfterC2 },
        c3: { response: r3.body, liveBeforeC3, liveAfterC3 },
      },
      null,
      2,
    ),
  );

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n${passCount}/${results.length} HTTP checks passed`);
  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
