#!/usr/bin/env node
/**
 * R2-2F — Staging HTTP runtime verification for USAP Rally Doubles.
 * Staging only: qyewbxjsiiyufanzcjcq
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, getStagingSupabaseEnv } from "./load-env.mjs";
import { signInStagingUser } from "./staging-auth-resolve.mjs";
import {
  RALLY_FIXTURE,
  applyRallySeed,
  buildRallyMatchResetSql,
} from "./seed-referee-v5-rally-test-staging.mjs";
import { MATCH_EVENT_TYPE } from "../src/features/referee-v5/constants/eventTypes.js";
import { SCORING_SYSTEM, SCORING_VARIANT } from "../src/features/referee-v5/constants/scoringStrategy.js";
import { applyMatchEvent } from "../src/features/referee-v5/engines/matchStateEngine.js";
import { initializeMatchState } from "../src/features/referee-v5/engines/initializeMatchState.js";
import { rebuildMatchState } from "../src/features/referee-v5/engines/stateReplayEngine.js";
import { hashMatchStateCanonical } from "../src/features/referee-v5/persistence/canonicalStateHash.js";
import { REFEREE_V5_ERROR } from "../src/features/referee-v5/persistence/errors.js";
import { buildDoublesUsapRallyConfig } from "../tests/referee-v5/testHelpers.js";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const EDGE_URL = `https://${STAGING_REF}.supabase.co/functions/v1/referee-v5-match`;
const OUT_DIR = "docs/v5/qa-evidence/referee-v5-rally/r2-2f";
const EXPIRED_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjE1MTYyMzkwMjJ9.invalidsig";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, "..", OUT_DIR);

const httpResults = [];
const parityResults = [];

function record(list, id, pass, expected, actual) {
  list.push({ id, pass, expected, actual });
  console.log(`${pass ? "PASS" : "FAIL"} ${id}`);
}

async function edgePost(accessToken, body, { withAuth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (withAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(EDGE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function applyCommand(token, args) {
  return edgePost(token, {
    action: "apply-command",
    tournamentId: RALLY_FIXTURE.TOURNAMENT,
    matchId: args.matchId || RALLY_FIXTURE.MATCH_DOUBLES,
    commandType: args.commandType,
    payload: args.payload || {},
    expectedVersion: args.expectedVersion,
    expectedSequence: args.expectedSequence,
    clientMutationId: args.clientMutationId || args.idempotencyKey,
    idempotencyKey: args.idempotencyKey,
  });
}

async function getState(token, matchId = RALLY_FIXTURE.MATCH_DOUBLES) {
  return edgePost(token, {
    action: "get-state",
    tournamentId: RALLY_FIXTURE.TOURNAMENT,
    matchId,
  });
}

async function finalize(token, args) {
  return edgePost(token, {
    action: "finalize",
    tournamentId: RALLY_FIXTURE.TOURNAMENT,
    matchId: args.matchId || RALLY_FIXTURE.MATCH_DOUBLES,
    expectedVersion: args.expectedVersion,
    idempotencyKey: args.idempotencyKey,
    forceComplete: true,
  });
}

async function resetMatch(matchId) {
  const token = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const sql = buildRallyMatchResetSql(matchId);
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
    throw new Error(body?.message || `reset failed ${matchId}`);
  }
}

function clientPlay(commands) {
  const init = initializeMatchState(buildDoublesUsapRallyConfig({ matchId: RALLY_FIXTURE.MATCH_DOUBLES }));
  if (!init.ok) {
    throw new Error(init.errors?.join(", "));
  }
  let state = init.state;
  const history = [];
  let seq = 1;
  for (const eventType of commands) {
    const result = applyMatchEvent(state, {
      eventId: `c-${seq}`,
      eventType,
      sequence: seq,
      expectedVersion: state.version,
      actorId: "ref-1",
      payload: {},
    });
    if (!result.ok) {
      throw new Error(result.error || result.code);
    }
    state = result.nextState;
    history.push({
      eventId: `c-${seq}`,
      eventType,
      sequence: seq,
      expectedVersion: state.version - 1,
      actorId: "ref-1",
      payload: {},
    });
    seq += 1;
  }
  return { state, history, initialState: init.state };
}

async function main() {
  loadProjectEnv();
  const { url, anonKey, serviceKey } = getStagingSupabaseEnv();
  if (!url.includes(STAGING_REF) || url.includes(PRODUCTION_REF)) {
    throw new Error("STOP — invalid staging target");
  }
  mkdirSync(outDir, { recursive: true });

  console.log("=== R2-2F fixture seed ===");
  await applyRallySeed();

  const referee = await signInStagingUser("owner@staging.local");
  if (referee.error || !referee.client) {
    throw new Error(`referee sign-in failed: ${referee.error}`);
  }

  const refereeToken = (await referee.client.auth.getSession()).data.session?.access_token;
  if (!refereeToken) {
    throw new Error("missing access tokens");
  }

  // Ensure live auth UUID is assigned on Rally fixtures (seed may use historical UUID).
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  await service.from("referee_assignments").upsert(
    [
      {
        tenant_id: RALLY_FIXTURE.TENANT,
        tournament_id: RALLY_FIXTURE.TOURNAMENT,
        match_id: RALLY_FIXTURE.MATCH_DOUBLES,
        referee_user_id: referee.userId,
        referee_display_name: "Rally V5 QA",
        role: "REFEREE",
        status: "active",
        assigned_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
        revoked_at: null,
      },
      {
        tenant_id: RALLY_FIXTURE.TENANT,
        tournament_id: RALLY_FIXTURE.TOURNAMENT,
        match_id: RALLY_FIXTURE.MATCH_MISSING_FORMAT,
        referee_user_id: referee.userId,
        referee_display_name: "Rally V5 QA",
        role: "REFEREE",
        status: "active",
        assigned_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
        revoked_at: null,
      },
      {
        tenant_id: RALLY_FIXTURE.TENANT,
        tournament_id: RALLY_FIXTURE.TOURNAMENT,
        match_id: RALLY_FIXTURE.MATCH_BAD_VARIANT,
        referee_user_id: referee.userId,
        referee_display_name: "Rally V5 QA",
        role: "REFEREE",
        status: "active",
        assigned_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
        revoked_at: null,
      },
      {
        tenant_id: RALLY_FIXTURE.TENANT,
        tournament_id: RALLY_FIXTURE.TOURNAMENT,
        match_id: RALLY_FIXTURE.MATCH_SINGLES,
        referee_user_id: referee.userId,
        referee_display_name: "Rally V5 QA",
        role: "REFEREE",
        status: "active",
        assigned_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
        revoked_at: null,
      },
      {
        tenant_id: RALLY_FIXTURE.TENANT,
        tournament_id: RALLY_FIXTURE.TOURNAMENT,
        match_id: RALLY_FIXTURE.MATCH_EXPIRED,
        referee_user_id: referee.userId,
        referee_display_name: "Rally V5 QA",
        role: "REFEREE",
        status: "active",
        assigned_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
        expires_at: new Date(Date.now() - 3600_000).toISOString(),
        revoked_at: null,
      },
      {
        tenant_id: RALLY_FIXTURE.TENANT,
        tournament_id: RALLY_FIXTURE.TOURNAMENT,
        match_id: RALLY_FIXTURE.MATCH_REVOKED_HOST,
        referee_user_id: referee.userId,
        referee_display_name: "Rally V5 QA",
        role: "REFEREE",
        status: "revoked",
        assigned_at: new Date(Date.now() - 3600_000).toISOString(),
        expires_at: null,
        revoked_at: new Date().toISOString(),
      },
    ],
    { onConflict: "tenant_id,tournament_id,match_id,role,referee_user_id" },
  );

  console.log("=== HTTP auth / validation ===");
  const noAuth = await edgePost(null, {
    action: "get-state",
    tournamentId: RALLY_FIXTURE.TOURNAMENT,
    matchId: RALLY_FIXTURE.MATCH_DOUBLES,
  }, { withAuth: false });
  record(httpResults, "http_01_no_auth_rejected", noAuth.status === 401, 401, noAuth.status);

  const badJwt = await edgePost(EXPIRED_JWT, {
    action: "get-state",
    tournamentId: RALLY_FIXTURE.TOURNAMENT,
    matchId: RALLY_FIXTURE.MATCH_DOUBLES,
  });
  record(
    httpResults,
    "http_02_invalid_jwt_rejected",
    badJwt.status === 401 || badJwt.body?.ok === false,
    "401/err",
    `${badJwt.status}/${badJwt.body?.code}`,
  );

  await resetMatch(RALLY_FIXTURE.MATCH_DOUBLES);
  await service.from("referee_assignments").upsert({
    tenant_id: RALLY_FIXTURE.TENANT,
    tournament_id: RALLY_FIXTURE.TOURNAMENT,
    match_id: RALLY_FIXTURE.MATCH_DOUBLES,
    referee_user_id: referee.userId,
    referee_display_name: "Rally V5 QA",
    role: "REFEREE",
    status: "active",
    assigned_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
    revoked_at: null,
  }, { onConflict: "tenant_id,tournament_id,match_id,role,referee_user_id" });

  const startOk = await applyCommand(refereeToken, {
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: "r22f-start",
  });
  record(httpResults, "http_03_assigned_referee_accepted", startOk.body?.ok === true, true, startOk.body?.ok);

  const unassigned = await applyCommand(refereeToken, {
    matchId: RALLY_FIXTURE.MATCH_UNASSIGNED,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: "r22f-unassigned",
  });
  // intentional: no referee_assignments row for this match
  record(
    httpResults,
    "http_04_unassigned_rejected",
    unassigned.body?.ok === false &&
      [REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED, "REFEREE_NOT_ASSIGNED"].includes(unassigned.body?.code),
    "REFEREE_NOT_ASSIGNED",
    unassigned.body?.code,
  );

  const revoked = await applyCommand(refereeToken, {
    matchId: RALLY_FIXTURE.MATCH_REVOKED_HOST,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: "r22f-revoked",
  });
  record(
    httpResults,
    "http_05_revoked_rejected",
    revoked.body?.ok === false &&
      [REFEREE_V5_ERROR.ASSIGNMENT_REVOKED, "ASSIGNMENT_REVOKED", REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED].includes(
        revoked.body?.code,
      ),
    "ASSIGNMENT_REVOKED",
    revoked.body?.code,
  );

  const expired = await applyCommand(refereeToken, {
    matchId: RALLY_FIXTURE.MATCH_EXPIRED,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: "r22f-expired",
  });
  record(
    httpResults,
    "http_06_expired_rejected",
    expired.body?.ok === false &&
      [REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED, "ASSIGNMENT_EXPIRED"].includes(expired.body?.code),
    "ASSIGNMENT_EXPIRED",
    expired.body?.code,
  );

  const missing = await applyCommand(refereeToken, {
    matchId: RALLY_FIXTURE.MATCH_MISSING_FORMAT,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: "r22f-missing-start",
  });
  let missingCode = missing.body?.code;
  if (missing.body?.ok) {
    const pt = await applyCommand(refereeToken, {
      matchId: RALLY_FIXTURE.MATCH_MISSING_FORMAT,
      commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      expectedVersion: missing.body.state?.version ?? 1,
      expectedSequence: 1,
      idempotencyKey: "r22f-missing-pt",
    });
    missingCode = pt.body?.code;
    record(
      httpResults,
      "http_07_missing_format_rejected",
      pt.body?.ok === false &&
        [REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED, "SCORING_FORMAT_REQUIRED", "UNSUPPORTED_SCORING_FORMAT"].includes(
          pt.body?.code,
        ),
      "SCORING_FORMAT_REQUIRED",
      missingCode,
    );
  } else {
    record(
      httpResults,
      "http_07_missing_format_rejected",
      [REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED, "SCORING_FORMAT_REQUIRED", "UNSUPPORTED_SCORING_FORMAT"].includes(
        missingCode,
      ),
      "SCORING_FORMAT_REQUIRED",
      missingCode,
    );
  }

  const badVarStart = await applyCommand(refereeToken, {
    matchId: RALLY_FIXTURE.MATCH_BAD_VARIANT,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: "r22f-badvar-start",
  });
  let badVarCode = badVarStart.body?.code;
  if (badVarStart.body?.ok) {
    const pt = await applyCommand(refereeToken, {
      matchId: RALLY_FIXTURE.MATCH_BAD_VARIANT,
      commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      expectedVersion: 1,
      expectedSequence: 1,
      idempotencyKey: "r22f-badvar-pt",
    });
    badVarCode = pt.body?.code;
    record(
      httpResults,
      "http_08_unsupported_variant_rejected",
      pt.body?.ok === false &&
        [REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT, "UNSUPPORTED_SCORING_VARIANT"].includes(pt.body?.code),
      "UNSUPPORTED_SCORING_VARIANT",
      badVarCode,
    );
  } else {
    record(
      httpResults,
      "http_08_unsupported_variant_rejected",
      [REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT, "UNSUPPORTED_SCORING_VARIANT", "SCORING_FORMAT_REQUIRED"].includes(
        badVarCode,
      ),
      "UNSUPPORTED_SCORING_VARIANT",
      badVarCode,
    );
  }

  const singlesStart = await applyCommand(refereeToken, {
    matchId: RALLY_FIXTURE.MATCH_SINGLES,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: "r22f-singles-start",
  });
  let singlesCode = singlesStart.body?.code;
  if (singlesStart.body?.ok) {
    const pt = await applyCommand(refereeToken, {
      matchId: RALLY_FIXTURE.MATCH_SINGLES,
      commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      expectedVersion: 1,
      expectedSequence: 1,
      idempotencyKey: "r22f-singles-pt",
    });
    singlesCode = pt.body?.code;
    record(
      httpResults,
      "http_09_singles_rally_rejected",
      pt.body?.ok === false &&
        [REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT, "UNSUPPORTED_SCORING_VARIANT"].includes(pt.body?.code),
      "UNSUPPORTED_SCORING_VARIANT",
      singlesCode,
    );
  } else {
    record(
      httpResults,
      "http_09_singles_rally_rejected",
      [REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT, "UNSUPPORTED_SCORING_VARIANT"].includes(singlesCode),
      "UNSUPPORTED_SCORING_VARIANT",
      singlesCode,
    );
  }

  console.log("=== HTTP scoring / parity ===");
  await resetMatch(RALLY_FIXTURE.MATCH_DOUBLES);
  await service.from("referee_assignments").upsert({
    tenant_id: RALLY_FIXTURE.TENANT,
    tournament_id: RALLY_FIXTURE.TOURNAMENT,
    match_id: RALLY_FIXTURE.MATCH_DOUBLES,
    referee_user_id: referee.userId,
    referee_display_name: "Rally V5 QA",
    role: "REFEREE",
    status: "active",
    assigned_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
    revoked_at: null,
  }, { onConflict: "tenant_id,tournament_id,match_id,role,referee_user_id" });

  const cmds = [
    MATCH_EVENT_TYPE.START_MATCH,
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.SWITCH_ENDS,
  ];
  let version = 0;
  let sequence = 0;
  for (let i = 0; i < cmds.length; i += 1) {
    const res = await applyCommand(refereeToken, {
      commandType: cmds[i],
      expectedVersion: version,
      expectedSequence: sequence,
      idempotencyKey: `r22f-play-${i}`,
    });
    if (!res.body?.ok) {
      throw new Error(`play failed ${cmds[i]}: ${res.body?.code || res.status}`);
    }
    version = res.body.state.version;
    sequence = res.body.state.lastEventSequence;
  }

  const remote = await getState(refereeToken);
  const remoteState = remote.body.state;
  record(httpResults, "http_10_normal_scoring", remoteState?.teams?.teamA?.score === 1, 1, remoteState?.teams?.teamA?.score);
  record(
    httpResults,
    "http_11_service_possession",
    remoteState?.servingTeamId === "team-b",
    "team-b",
    remoteState?.servingTeamId,
  );
  record(httpResults, "http_12_positions", remoteState?.teams?.teamA?.players?.length === 2, 2, remoteState?.teams?.teamA?.players?.length);
  record(httpResults, "http_13_server_receiver", Boolean(remoteState?.servingPlayerId && remoteState?.receivingPlayerId), true, `${remoteState?.servingPlayerId}/${remoteState?.receivingPlayerId}`);
  record(
    httpResults,
    "http_14_switch_ends",
    remoteState?.teams?.teamA?.courtEnd !== "NEAR_END" || remoteState?.teams?.teamB?.courtEnd !== "FAR_END",
    "swapped",
    `${remoteState?.teams?.teamA?.courtEnd}/${remoteState?.teams?.teamB?.courtEnd}`,
  );

  const undo = await applyCommand(refereeToken, {
    commandType: MATCH_EVENT_TYPE.UNDO_LAST_EVENT,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: "r22f-undo",
  });
  record(httpResults, "http_15_undo", undo.body?.ok === true, true, undo.body?.ok);
  version = undo.body.state.version;
  sequence = undo.body.state.lastEventSequence;

  const stale = await applyCommand(refereeToken, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: version - 1,
    expectedSequence: sequence,
    idempotencyKey: "r22f-stale",
  });
  record(
    httpResults,
    "http_16_stale_version",
    stale.body?.ok === false &&
      ["MATCH_STATE_CONFLICT", "VERSION_CONFLICT"].includes(stale.body?.code),
    "MATCH_STATE_CONFLICT",
    stale.body?.code,
  );

  const idempA = await applyCommand(refereeToken, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: "r22f-idem-same",
  });
  version = idempA.body.state.version;
  sequence = idempA.body.state.lastEventSequence;
  const idempB = await applyCommand(refereeToken, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: "r22f-idem-same",
  });
  record(
    httpResults,
    "http_17_idempotent_same",
    idempA.body?.ok === true && idempB.body?.ok === true && idempB.body?.duplicate === true,
    true,
    idempB.body?.duplicate,
  );

  const mismatch = await applyCommand(refereeToken, {
    commandType: MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    expectedVersion: version,
    expectedSequence: sequence,
    idempotencyKey: "r22f-idem-same",
  });
  record(
    httpResults,
    "http_18_idempotent_mismatch",
    mismatch.body?.ok === false && mismatch.body?.code === REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH,
    "IDEMPOTENCY_KEY_REUSE_MISMATCH",
    mismatch.body?.code,
  );

  // Drive to score 11 then finalize
  await resetMatch(RALLY_FIXTURE.MATCH_DOUBLES);
  await service.from("referee_assignments").upsert({
    tenant_id: RALLY_FIXTURE.TENANT,
    tournament_id: RALLY_FIXTURE.TOURNAMENT,
    match_id: RALLY_FIXTURE.MATCH_DOUBLES,
    referee_user_id: referee.userId,
    referee_display_name: "Rally V5 QA",
    role: "REFEREE",
    status: "active",
    assigned_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
    revoked_at: null,
  }, { onConflict: "tenant_id,tournament_id,match_id,role,referee_user_id" });

  version = 0;
  sequence = 0;
  const finStart = await applyCommand(refereeToken, {
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: "r22f-fin-start",
  });
  version = finStart.body.state.version;
  sequence = finStart.body.state.lastEventSequence;
  for (let i = 0; i < 11; i += 1) {
    const pt = await applyCommand(refereeToken, {
      commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      expectedVersion: version,
      expectedSequence: sequence,
      idempotencyKey: `r22f-fin-pt-${i}`,
    });
    if (!pt.body?.ok) {
      throw new Error(`finalize prep fail ${i}: ${pt.body?.code}`);
    }
    version = pt.body.state.version;
    sequence = pt.body.state.lastEventSequence;
  }

  const fin1 = await finalize(refereeToken, {
    expectedVersion: version,
    idempotencyKey: "r22f-finalize",
  });
  const fin2 = await finalize(refereeToken, {
    expectedVersion: version,
    idempotencyKey: "r22f-finalize",
  });
  record(httpResults, "http_19_finalize", fin1.body?.ok === true && fin1.body?.locked === true, true, fin1.body?.ok);
  record(
    httpResults,
    "http_19b_finalize_retry",
    fin2.body?.ok === true && fin2.body?.duplicate === true,
    true,
    fin2.body?.duplicate,
  );

  const post = await applyCommand(refereeToken, {
    commandType: MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    expectedVersion: version + 1,
    expectedSequence: sequence + 1,
    idempotencyKey: "r22f-post-fin",
  });
  record(
    httpResults,
    "http_20_post_finalize_blocked",
    post.body?.ok === false && post.body?.code === REFEREE_V5_ERROR.MATCH_LOCKED,
    "MATCH_LOCKED",
    post.body?.code,
  );

  // Parity for a fresh play sequence
  await resetMatch(RALLY_FIXTURE.MATCH_DOUBLES);
  await service.from("referee_assignments").upsert({
    tenant_id: RALLY_FIXTURE.TENANT,
    tournament_id: RALLY_FIXTURE.TOURNAMENT,
    match_id: RALLY_FIXTURE.MATCH_DOUBLES,
    referee_user_id: referee.userId,
    referee_display_name: "Rally V5 QA",
    role: "REFEREE",
    status: "active",
    assigned_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400_000 * 30).toISOString(),
    revoked_at: null,
  }, { onConflict: "tenant_id,tournament_id,match_id,role,referee_user_id" });

  const parityCmds = [
    MATCH_EVENT_TYPE.START_MATCH,
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.SWITCH_ENDS,
  ];
  const client = clientPlay(parityCmds);
  version = 0;
  sequence = 0;
  for (let i = 0; i < parityCmds.length; i += 1) {
    const res = await applyCommand(refereeToken, {
      commandType: parityCmds[i],
      expectedVersion: version,
      expectedSequence: sequence,
      idempotencyKey: `r22f-parity-${i}`,
    });
    version = res.body.state.version;
    sequence = res.body.state.lastEventSequence;
  }
  const edgeState = (await getState(refereeToken)).body.state;
  const matchStateId = `${RALLY_FIXTURE.TENANT}::${RALLY_FIXTURE.TOURNAMENT}::${RALLY_FIXTURE.MATCH_DOUBLES}`;
  const { data: live } = await service
    .from("match_live_states")
    .select("state_payload, state_version, last_event_sequence, state_hash")
    .eq("id", matchStateId)
    .maybeSingle();
  const persisted = live?.state_payload;
  const { data: events } = await service
    .from("match_events")
    .select("id, command_type, event_sequence, state_version_before, command_payload, actor_id")
    .eq("match_state_id", matchStateId)
    .order("event_sequence", { ascending: true });
  const history = (events || []).map((e) => ({
    eventId: e.id,
    eventType: e.command_type,
    sequence: e.event_sequence,
    expectedVersion: e.state_version_before,
    actorId: e.actor_id,
    payload: e.command_payload || {},
  }));
  const replayed = rebuildMatchState(client.initialState, history);

  const fields = [
    ["scoreA", client.state.teams.teamA.score, edgeState.teams.teamA.score, persisted?.teams?.teamA?.score],
    ["scoreB", client.state.teams.teamB.score, edgeState.teams.teamB.score, persisted?.teams?.teamB?.score],
    ["serving", client.state.servingPlayerId, edgeState.servingPlayerId, persisted?.servingPlayerId],
    ["receiving", client.state.receivingPlayerId, edgeState.receivingPlayerId, persisted?.receivingPlayerId],
    ["courtA", client.state.teams.teamA.courtEnd, edgeState.teams.teamA.courtEnd, persisted?.teams?.teamA?.courtEnd],
    ["status", client.state.status, edgeState.status, persisted?.status],
    [
      "hash",
      hashMatchStateCanonical(client.state),
      hashMatchStateCanonical(edgeState),
      live?.state_hash || hashMatchStateCanonical(persisted),
    ],
  ];
  for (const [name, c, e, p] of fields) {
    record(parityResults, `parity_${name}`, c === e && e === p, c, `${e}/${p}`);
  }
  record(
    parityResults,
    "parity_format",
    edgeState.scoringSystem === SCORING_SYSTEM.RALLY &&
      edgeState.scoringVariant === SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
    "RALLY/USAP",
    `${edgeState.scoringSystem}/${edgeState.scoringVariant}`,
  );
  record(parityResults, "parity_replay", replayed.ok && hashMatchStateCanonical(replayed.state) === hashMatchStateCanonical(edgeState), true, replayed.ok);

  const httpPass = httpResults.filter((r) => r.pass).length;
  const parityPass = parityResults.filter((r) => r.pass).length;
  const httpReport = {
    stagingRef: STAGING_REF,
    endpoint: EDGE_URL,
    results: httpResults,
    summary: { pass: httpPass, total: httpResults.length },
    timestamp: new Date().toISOString(),
  };
  const parityReport = {
    stagingRef: STAGING_REF,
    results: parityResults,
    summary: { pass: parityPass, total: parityResults.length },
    timestamp: new Date().toISOString(),
  };
  writeFileSync(join(outDir, "HTTP_RUNTIME_REPORT.json"), JSON.stringify(httpReport, null, 2));
  writeFileSync(join(outDir, "PARITY_REPORT.json"), JSON.stringify(parityReport, null, 2));

  console.log(`HTTP ${httpPass}/${httpResults.length}; Parity ${parityPass}/${parityResults.length}`);
  if (httpPass < httpResults.length || parityPass < parityResults.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`FAIL — ${err.message}`);
  process.exit(1);
});
