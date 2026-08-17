#!/usr/bin/env node
/**
 * Executable Staging acceptance harness for CORE-13 trusted server boundary.
 *
 * DOES NOT RUN unless explicit non-production safety flags are set.
 * Does not commit secrets. Uses environment variables / fixture IDs.
 *
 * Required flags:
 *   CORE13_STAGING_ACCEPTANCE_GO=YES
 *   SQL_EXECUTION_GO=YES
 *   STAGING_MUTATION_GO=YES
 *   EDGE_FUNCTION_DEPLOY_GO=YES
 *   PICK_VN_ENV=staging
 *
 * Required env (never commit values):
 *   STAGING_SUPABASE_URL
 *   STAGING_ANON_KEY
 *   STAGING_SERVICE_ROLE_KEY
 *   STAGING_USER_A_EMAIL / STAGING_USER_A_PASSWORD
 *   STAGING_USER_B_EMAIL / STAGING_USER_B_PASSWORD
 *   STAGING_TENANT_A / STAGING_TOURNAMENT_A / STAGING_MATCH_A
 *   STAGING_TENANT_B / STAGING_TOURNAMENT_B
 *   STAGING_REFEREE_USER_ID
 */

import { createClient } from "@supabase/supabase-js";

const PRODUCTION_HINTS = /prod|production/i;

function fail(message) {
  console.error(`REFUSE: ${message}`);
  process.exit(1);
}

function env(name) {
  return String(process.env[name] || "").trim();
}

function requireStagingSafety() {
  if (env("CORE13_STAGING_ACCEPTANCE_GO") !== "YES") {
    fail("CORE13_STAGING_ACCEPTANCE_GO must be YES");
  }
  if (env("SQL_EXECUTION_GO") !== "YES") {
    fail("SQL_EXECUTION_GO must be YES");
  }
  if (env("STAGING_MUTATION_GO") !== "YES") {
    fail("STAGING_MUTATION_GO must be YES");
  }
  if (env("EDGE_FUNCTION_DEPLOY_GO") !== "YES") {
    fail("EDGE_FUNCTION_DEPLOY_GO must be YES");
  }
  if (env("PICK_VN_ENV").toLowerCase() !== "staging") {
    fail("PICK_VN_ENV must be staging");
  }
  const url = env("STAGING_SUPABASE_URL");
  if (!url) fail("STAGING_SUPABASE_URL required");
  if (PRODUCTION_HINTS.test(url) && !/staging/i.test(url)) {
    fail("Refusing Production-like STAGING_SUPABASE_URL");
  }
}

function edgeUrl(base) {
  return `${base.replace(/\/+$/, "")}/functions/v1/competition-referee-assignment`;
}

async function signIn(url, anonKey, email, password) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.session?.access_token) {
    throw new Error(`sign-in failed for ${email}: ${error?.message || "no session"}`);
  }
  return { client, token: data.session.access_token, userId: data.user.id };
}

async function invokeEdge(url, token, body) {
  const response = await fetch(edgeUrl(url), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function main() {
  requireStagingSafety();

  const url = env("STAGING_SUPABASE_URL");
  const anonKey = env("STAGING_ANON_KEY");
  const serviceKey = env("STAGING_SERVICE_ROLE_KEY");
  const tenantA = env("STAGING_TENANT_A");
  const tournamentA = env("STAGING_TOURNAMENT_A");
  const matchA = env("STAGING_MATCH_A");
  const tenantB = env("STAGING_TENANT_B");
  const tournamentB = env("STAGING_TOURNAMENT_B");
  const refereeId = env("STAGING_REFEREE_USER_ID");

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const userA = await signIn(url, anonKey, env("STAGING_USER_A_EMAIL"), env("STAGING_USER_A_PASSWORD"));
  const userB = await signIn(url, anonKey, env("STAGING_USER_B_EMAIL"), env("STAGING_USER_B_PASSWORD"));

  const results = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  };

  const anonRpc = await anon.rpc("competition_assign_referee", {
    p_tenant_id: tenantA,
    p_tournament_id: tournamentA,
    p_match_id: matchA,
    p_referee_user_id: refereeId,
    p_expected_version: 0,
    p_idempotency_key: "anon-deny",
    p_actor_id: userA.userId,
  });
  record("anon-direct-rpc-denied", Boolean(anonRpc.error), anonRpc.error?.message || "no error");

  const userARpc = await userA.client.rpc("competition_assign_referee", {
    p_tenant_id: tenantA,
    p_tournament_id: tournamentA,
    p_match_id: matchA,
    p_referee_user_id: refereeId,
    p_expected_version: 0,
    p_idempotency_key: "user-a-direct-deny",
    p_actor_id: userA.userId,
  });
  record(
    "authenticated-direct-rpc-denied",
    Boolean(userARpc.error),
    userARpc.error?.message || "no error"
  );

  const spoof = await invokeEdge(url, userA.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      refereeId,
      actorId: userB.userId,
      expectedVersion: 0,
      idempotencyKey: `stage-spoof-${Date.now()}`,
    },
  });
  record(
    "browser-actor-spoof-ignored",
    spoof.payload?.originatingActorId === userA.userId || spoof.payload?.ok === false,
    JSON.stringify({ status: spoof.status, actor: spoof.payload?.originatingActorId })
  );

  const crossTenant = await invokeEdge(url, userB.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      refereeId,
      expectedVersion: 0,
      idempotencyKey: `stage-cross-tenant-${Date.now()}`,
    },
  });
  record(
    "cross-tenant-denied",
    crossTenant.payload?.ok === false,
    JSON.stringify({ status: crossTenant.status, code: crossTenant.payload?.code })
  );

  const crossTournament = await invokeEdge(url, userA.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentB,
      matchId: matchA,
      refereeId,
      expectedVersion: 0,
      idempotencyKey: `stage-cross-tournament-${Date.now()}`,
    },
  });
  record(
    "cross-tournament-denied",
    crossTournament.payload?.ok === false,
    JSON.stringify({ status: crossTournament.status, code: crossTournament.payload?.code })
  );

  const assign = await invokeEdge(url, userA.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      refereeId,
      expectedVersion: 0,
      idempotencyKey: `stage-assign-${Date.now()}`,
      competitionMode: "INTERNAL",
    },
  });
  record("trusted-server-assign", assign.payload?.ok === true && assign.payload?.core13Executed === true, JSON.stringify(assign.payload));

  const stale = await invokeEdge(url, userA.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      refereeId,
      expectedVersion: 0,
      idempotencyKey: `stage-stale-${Date.now()}`,
    },
  });
  record("cas-stale-write", stale.payload?.ok === false, stale.payload?.code || "");

  const failed = results.filter((row) => !row.ok);
  if (failed.length) {
    fail(`Staging acceptance failures: ${failed.map((row) => row.name).join(", ")}`);
  }
  console.log("PASS core13 trusted-server staging acceptance");
  void service;
}

main().catch((err) => {
  fail(String(err?.message || err));
});
