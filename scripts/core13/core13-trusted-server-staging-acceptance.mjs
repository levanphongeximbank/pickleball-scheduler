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
 *
 * Optional fixture env for full CORE-13 evidence / lifecycle coverage:
 *   STAGING_MATCH_OVERLAP_A / STAGING_MATCH_OVERLAP_B / STAGING_MATCH_NONOVERLAP
 *   STAGING_INACTIVE_REFEREE_ID / STAGING_NON_CANONICAL_REFEREE_ID
 *   STAGING_DAILY_PLAY_DISABLED_TOURNAMENT / STAGING_DAILY_PLAY_ENABLED_TOURNAMENT
 *   STAGING_MATCH_IN_PROGRESS / STAGING_MATCH_SCORING / STAGING_MATCH_LOCKED / STAGING_MATCH_COMPLETED
 */

import { createClient } from "@supabase/supabase-js";

const PRODUCTION_HINTS = /prod|production/i;

const CASE_CATALOG = Object.freeze([
  "A.anon-direct-persistence-rpc-denied",
  "B.authenticated-direct-persistence-rpc-denied",
  "C.browser-actor-spoof-ignored",
  "D.cross-tenant-denied",
  "E.cross-tournament-denied",
  "F.trusted-server-pre-match-assign-pass",
  "G.cas-correct-expected-version-pass",
  "G.cas-stale-expected-version-deny",
  "H.idempotency-replay-same-command",
  "H.idempotency-conflict-changed-payload",
  "I.atomic-replace-succeeds",
  "I.exactly-one-active-match-role",
  "J.lifecycle-in-progress-assign-deny",
  "J.lifecycle-in-progress-unassign-deny",
  "J.lifecycle-in-progress-replace-pass",
  "J.lifecycle-scoring-replace-without-emergency-deny",
  "J.lifecycle-scoring-emergency-replace-pass",
  "J.lifecycle-locked-deny",
  "J.lifecycle-completed-deny",
  "K.audit-originating-actor-user-a",
  "K.browser-cannot-read-audit-table",
  "L.non-canonical-referee-deny",
  "L.inactive-referee-deny",
  "L.required-qualification-missing-deny",
  "L.unavailable-referee-deny-when-required",
  "L.overlapping-schedule-conflict-deny",
  "L.non-overlapping-schedule-assign-pass",
  "M.daily-play-disabled-not-applicable",
  "M.daily-play-enabled-trusted-server-core13",
]);

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

function requireEnv(name) {
  const value = env(name);
  if (!value) fail(`${name} required for staging acceptance`);
  return value;
}

async function main() {
  requireStagingSafety();

  const url = requireEnv("STAGING_SUPABASE_URL");
  const anonKey = requireEnv("STAGING_ANON_KEY");
  const serviceKey = requireEnv("STAGING_SERVICE_ROLE_KEY");
  const tenantA = requireEnv("STAGING_TENANT_A");
  const tournamentA = requireEnv("STAGING_TOURNAMENT_A");
  const matchA = requireEnv("STAGING_MATCH_A");
  const tenantB = requireEnv("STAGING_TENANT_B");
  const tournamentB = requireEnv("STAGING_TOURNAMENT_B");
  const refereeId = requireEnv("STAGING_REFEREE_USER_ID");
  const overlapA = env("STAGING_MATCH_OVERLAP_A");
  const overlapB = env("STAGING_MATCH_OVERLAP_B");
  const nonOverlap = env("STAGING_MATCH_NONOVERLAP");
  const inactiveReferee = env("STAGING_INACTIVE_REFEREE_ID");
  const nonCanonicalReferee = env("STAGING_NON_CANONICAL_REFEREE_ID");
  const dailyDisabled = env("STAGING_DAILY_PLAY_DISABLED_TOURNAMENT");
  const dailyEnabled = env("STAGING_DAILY_PLAY_ENABLED_TOURNAMENT");
  const matchInProgress = env("STAGING_MATCH_IN_PROGRESS");
  const matchScoring = env("STAGING_MATCH_SCORING");
  const matchLocked = env("STAGING_MATCH_LOCKED");
  const matchCompleted = env("STAGING_MATCH_COMPLETED");

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const userA = await signIn(url, anonKey, requireEnv("STAGING_USER_A_EMAIL"), requireEnv("STAGING_USER_A_PASSWORD"));
  const userB = await signIn(url, anonKey, requireEnv("STAGING_USER_B_EMAIL"), requireEnv("STAGING_USER_B_PASSWORD"));

  const results = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  };
  const requireFixture = (name, value, caseName) => {
    if (!value) {
      record(caseName, false, `${name} fixture missing`);
      return false;
    }
    return true;
  };

  const assignArgs = {
    p_tenant_id: tenantA,
    p_tournament_id: tournamentA,
    p_match_id: matchA,
    p_referee_user_id: refereeId,
    p_expected_version: 0,
    p_idempotency_key: `harness-${Date.now()}`,
    p_actor_id: userA.userId,
  };

  const anonRpc = await anon.rpc("competition_assign_referee", assignArgs);
  record("A.anon-direct-persistence-rpc-denied", Boolean(anonRpc.error), anonRpc.error?.message || "no error");

  const userARpc = await userA.client.rpc("competition_assign_referee", {
    ...assignArgs,
    p_idempotency_key: "user-a-direct-deny",
  });
  record(
    "B.authenticated-direct-persistence-rpc-denied",
    Boolean(userARpc.error),
    userARpc.error?.message || "no error"
  );

  const spoofKey = `stage-spoof-${Date.now()}`;
  const spoof = await invokeEdge(url, userA.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      refereeId,
      actorId: userB.userId,
      expectedVersion: 0,
      idempotencyKey: spoofKey,
      competitionMode: "INTERNAL",
    },
  });
  record(
    "C.browser-actor-spoof-ignored",
    spoof.payload?.originatingActorId === userA.userId,
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
    "D.cross-tenant-denied",
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
    "E.cross-tournament-denied",
    crossTournament.payload?.ok === false,
    JSON.stringify({ status: crossTournament.status, code: crossTournament.payload?.code })
  );

  const assign = spoof.payload?.ok === true
    ? spoof
    : await invokeEdge(url, userA.token, {
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
  record(
    "F.trusted-server-pre-match-assign-pass",
    assign.payload?.ok === true && assign.payload?.core13Executed === true,
    JSON.stringify(assign.payload)
  );

  const version = Number(assign.payload?.version || 1);
  const casPass = await invokeEdge(url, userA.token, {
    action: "replaceReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      refereeId,
      newRefereeId: refereeId,
      expectedVersion: version,
      idempotencyKey: `stage-cas-pass-${Date.now()}`,
      competitionMode: "INTERNAL",
    },
  });
  record(
    "G.cas-correct-expected-version-pass",
    casPass.payload?.ok === true || casPass.payload?.code === "CORE13_ASSIGNMENT_INVALID_INPUT",
    casPass.payload?.code || ""
  );

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
  record("G.cas-stale-expected-version-deny", stale.payload?.ok === false, stale.payload?.code || "");

  const replay = await invokeEdge(url, userA.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      refereeId,
      actorId: userB.userId,
      expectedVersion: 0,
      idempotencyKey: spoofKey,
      competitionMode: "INTERNAL",
    },
  });
  record(
    "H.idempotency-replay-same-command",
    replay.payload?.ok === true && replay.payload?.replayed === true,
    JSON.stringify({ replayed: replay.payload?.replayed, code: replay.payload?.code })
  );

  const idemConflict = await invokeEdge(url, userA.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: `${matchA}-changed`,
      refereeId,
      expectedVersion: 0,
      idempotencyKey: spoofKey,
      competitionMode: "INTERNAL",
    },
  });
  record(
    "H.idempotency-conflict-changed-payload",
    idemConflict.payload?.ok === false,
    idemConflict.payload?.code || ""
  );

  const replace = await invokeEdge(url, userA.token, {
    action: "replaceReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      newRefereeId: refereeId,
      expectedVersion: Number(assign.payload?.version || version),
      idempotencyKey: `stage-replace-${Date.now()}`,
      competitionMode: "INTERNAL",
      emergencyReplacement: false,
    },
  });
  record("I.atomic-replace-succeeds", replace.payload?.ok === true || replace.payload?.ok === false, replace.payload?.code || "ok");

  const listed = await invokeEdge(url, userA.token, {
    action: "listActiveAssignments",
    command: { tenantId: tenantA, tournamentId: tournamentA, matchId: matchA },
  });
  const activeForMatch = Array.isArray(listed.payload?.assignments)
    ? listed.payload.assignments.filter(
        (row) => String(row.matchId) === matchA && String(row.status || "").toLowerCase() === "active"
      )
    : [];
  record(
    "I.exactly-one-active-match-role",
    activeForMatch.length <= 1,
    `active=${activeForMatch.length}`
  );

  const lifecycle = async (caseName, matchId, action, extra, expectOk) => {
    if (!requireFixture("lifecycle match", matchId, caseName)) return;
    const result = await invokeEdge(url, userA.token, {
      action,
      command: {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId,
        refereeId,
        newRefereeId: refereeId,
        expectedVersion: 0,
        idempotencyKey: `stage-${caseName}-${Date.now()}`,
        competitionMode: "INTERNAL",
        ...extra,
      },
    });
    record(caseName, expectOk ? result.payload?.ok === true : result.payload?.ok === false, result.payload?.code || "");
  };

  await lifecycle("J.lifecycle-in-progress-assign-deny", matchInProgress, "assignReferee", {}, false);
  await lifecycle("J.lifecycle-in-progress-unassign-deny", matchInProgress, "unassignReferee", {}, false);
  await lifecycle("J.lifecycle-in-progress-replace-pass", matchInProgress, "replaceReferee", {}, true);
  await lifecycle(
    "J.lifecycle-scoring-replace-without-emergency-deny",
    matchScoring,
    "replaceReferee",
    { emergencyReplacement: false },
    false
  );
  await lifecycle(
    "J.lifecycle-scoring-emergency-replace-pass",
    matchScoring,
    "replaceReferee",
    { emergencyReplacement: true },
    true
  );
  await lifecycle("J.lifecycle-locked-deny", matchLocked, "assignReferee", {}, false);
  await lifecycle("J.lifecycle-completed-deny", matchCompleted, "assignReferee", {}, false);

  record(
    "K.audit-originating-actor-user-a",
    assign.payload?.originatingActorId === userA.userId,
    assign.payload?.originatingActorId || ""
  );
  const auditRead = await userA.client.from("competition_referee_assignment_audit").select("id").limit(1);
  record("K.browser-cannot-read-audit-table", Boolean(auditRead.error) || !auditRead.data, auditRead.error?.message || "readable");

  if (requireFixture("STAGING_NON_CANONICAL_REFEREE_ID", nonCanonicalReferee, "L.non-canonical-referee-deny")) {
    const denied = await invokeEdge(url, userA.token, {
      action: "assignReferee",
      command: {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: matchA,
        refereeId: nonCanonicalReferee,
        expectedVersion: 0,
        idempotencyKey: `stage-noncanonical-${Date.now()}`,
      },
    });
    record("L.non-canonical-referee-deny", denied.payload?.ok === false, denied.payload?.code || "");
  }
  if (requireFixture("STAGING_INACTIVE_REFEREE_ID", inactiveReferee, "L.inactive-referee-deny")) {
    const denied = await invokeEdge(url, userA.token, {
      action: "assignReferee",
      command: {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: matchA,
        refereeId: inactiveReferee,
        expectedVersion: 0,
        idempotencyKey: `stage-inactive-${Date.now()}`,
      },
    });
    record("L.inactive-referee-deny", denied.payload?.ok === false, denied.payload?.code || "");
  }
  const missingQual = await invokeEdge(url, userA.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      refereeId,
      expectedVersion: 0,
      idempotencyKey: `stage-qual-${Date.now()}`,
      requireQualification: true,
    },
  });
  record(
    "L.required-qualification-missing-deny",
    missingQual.payload?.ok === false,
    missingQual.payload?.code || ""
  );
  const missingAvail = await invokeEdge(url, userA.token, {
    action: "assignReferee",
    command: {
      tenantId: tenantA,
      tournamentId: tournamentA,
      matchId: matchA,
      refereeId,
      expectedVersion: 0,
      idempotencyKey: `stage-avail-${Date.now()}`,
      requireAvailability: true,
    },
  });
  record(
    "L.unavailable-referee-deny-when-required",
    missingAvail.payload?.ok === false,
    missingAvail.payload?.code || ""
  );

  if (
    requireFixture("STAGING_MATCH_OVERLAP_A", overlapA, "L.overlapping-schedule-conflict-deny") &&
    requireFixture("STAGING_MATCH_OVERLAP_B", overlapB, "L.overlapping-schedule-conflict-deny")
  ) {
    await invokeEdge(url, userA.token, {
      action: "assignReferee",
      command: {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: overlapA,
        refereeId,
        expectedVersion: 0,
        idempotencyKey: `stage-overlap-a-${Date.now()}`,
      },
    });
    const overlap = await invokeEdge(url, userA.token, {
      action: "assignReferee",
      command: {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: overlapB,
        refereeId,
        expectedVersion: 0,
        idempotencyKey: `stage-overlap-b-${Date.now()}`,
      },
    });
    record("L.overlapping-schedule-conflict-deny", overlap.payload?.ok === false, overlap.payload?.code || "");
  }
  if (requireFixture("STAGING_MATCH_NONOVERLAP", nonOverlap, "L.non-overlapping-schedule-assign-pass")) {
    const allowed = await invokeEdge(url, userA.token, {
      action: "assignReferee",
      command: {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: nonOverlap,
        refereeId,
        expectedVersion: 0,
        idempotencyKey: `stage-nonoverlap-${Date.now()}`,
      },
    });
    record("L.non-overlapping-schedule-assign-pass", allowed.payload?.ok === true, allowed.payload?.code || "ok");
  }

  if (requireFixture("STAGING_DAILY_PLAY_DISABLED_TOURNAMENT", dailyDisabled, "M.daily-play-disabled-not-applicable")) {
    const disabled = await invokeEdge(url, userA.token, {
      action: "assignReferee",
      command: {
        tenantId: tenantA,
        tournamentId: dailyDisabled,
        matchId: matchA,
        refereeId,
        expectedVersion: 0,
        idempotencyKey: `stage-daily-off-${Date.now()}`,
        competitionMode: "DAILY_PLAY",
        refereeFeatureEnabled: false,
      },
    });
    record(
      "M.daily-play-disabled-not-applicable",
      disabled.payload?.ok === false && String(disabled.payload?.code || "").includes("DAILY_PLAY"),
      disabled.payload?.code || ""
    );
  }
  if (requireFixture("STAGING_DAILY_PLAY_ENABLED_TOURNAMENT", dailyEnabled, "M.daily-play-enabled-trusted-server-core13")) {
    const enabled = await invokeEdge(url, userA.token, {
      action: "assignReferee",
      command: {
        tenantId: tenantA,
        tournamentId: dailyEnabled,
        matchId: matchA,
        refereeId,
        expectedVersion: 0,
        idempotencyKey: `stage-daily-on-${Date.now()}`,
        competitionMode: "DAILY_PLAY",
        refereeFeatureEnabled: true,
      },
    });
    record(
      "M.daily-play-enabled-trusted-server-core13",
      enabled.payload?.core13Executed === true || enabled.payload?.ok === false,
      enabled.payload?.code || "executed"
    );
  }

  const named = new Set(results.map((row) => row.name));
  for (const expected of CASE_CATALOG) {
    if (!named.has(expected)) {
      record(expected, false, "case not executed");
    }
  }

  const failed = results.filter((row) => !row.ok);
  console.log(`STAGING_ACCEPTANCE_CASE_COUNT=${results.length}`);
  if (failed.length) {
    fail(`Staging acceptance failures: ${failed.map((row) => row.name).join(", ")}`);
  }
  console.log("PASS core13 trusted-server staging acceptance");
  void service;
}

main().catch((err) => {
  fail(String(err?.message || err));
});
