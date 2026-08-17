#!/usr/bin/env node
/**
 * Executable Staging acceptance harness for CORE-13 trusted server boundary.
 *
 * DOES NOT RUN unless explicit non-production safety flags are set.
 * Does not commit secrets. Uses environment variables / fixture IDs.
 *
 * Required flags:
 *   CORE13_STAGING_ACCEPTANCE_GO=YES
 *   STAGING_MUTATION_GO=YES
 *   SQL_ALREADY_APPLIED_PREREQUISITE=YES
 *   EDGE_ALREADY_DEPLOYED_PREREQUISITE=YES
 *   PICK_VN_ENV=staging
 *
 * Optional negative guards (if set, must be NO; absence does not grant authority):
 *   SQL_COMMAND_EXECUTION_THIS_PHASE=NO
 *   SQL_REAPPLY_GO=NO
 *   EDGE_REDEPLOY_GO=NO
 *
 * Not used as acceptance prerequisites:
 *   SQL_EXECUTION_GO
 *   EDGE_FUNCTION_DEPLOY_GO
 *
 * This harness does not execute SQL and does not deploy Edge Functions.
 *
 * Required env (never commit values):
 *   STAGING_SUPABASE_URL
 *   STAGING_ANON_KEY
 *   STAGING_SERVICE_ROLE_KEY   (test evidence only — never product/browser)
 *   STAGING_USER_A_EMAIL / STAGING_USER_A_PASSWORD
 *   STAGING_USER_B_EMAIL / STAGING_USER_B_PASSWORD
 *   CORE13_FIXTURE_RECEIPT_PATH   (immutable provisioner receipt — SSOT)
 *
 * Optional env IDs (STAGING_TENANT_A, STAGING_MATCH_A, STAGING_REPLACE_REFEREE_USER_ID, ...)
 * may only cross-check the receipt. They cannot bypass receipt ownership.
 *
 * UUID IDs stay canonical. Namespace text in entity IDs is not required.
 * Arbitrary Staging business rows are refused.
 *
 * Identity subject lookup:
 *   Contract #01 gap was closed by merged PR #446. CORE-13 consumes
 *   resolveSubjectIdentity. Identity L cases now test canonical deny
 *   (unknown / non-referee / inactive / foreign / missing tenant).
 *   Do not restore a Competition profiles-table read.
 *
 * Service-role inspection is test evidence only. Audit history is immutable
 * and is never deleted by this harness.
 */

import { createClient } from "@supabase/supabase-js";
import {
  CASE_CATALOG,
  CORE13_FIXTURE_NAMESPACE,
  DENIAL_CODES,
  createMutationGate,
  evaluateAcceptanceGate,
  evaluateActiveLeftovers,
  evaluateAssignPass,
  evaluateAtomicReplacePass,
  evaluateAuthenticatedRuntimeProbe,
  evaluateBaselineKnownStart,
  evaluateBrowserAuditDenied,
  evaluateCasCorrectPass,
  evaluateCatalogExecution,
  evaluateDailyEnabledPass,
  evaluateDenial,
  evaluateDirectRpcDenied,
  evaluateDurableAssignment,
  evaluateDurableAuditActor,
  evaluateDurableIdempotency,
  evaluateExactlyOneActive,
  evaluateOldAssignmentRevoked,
  runWithFinalization,
} from "./core13-staging-acceptance-proofs.mjs";
import {
  evaluateFixtureReceipt,
  evaluateManualFixtureOverride,
  evaluatePhysicalEnvironment,
  evaluateReceiptRemoteReconciliation,
  hydrateHarnessFixtures,
  loadAuthoritativeRemoteFixtureEvidence,
  loadFixtureReceiptFromPath,
  projectRefFromSupabaseUrl,
  STAGING_PROJECT_REF,
} from "./core13-staging-fixture-receipt.mjs";

function fail(message) {
  console.error(`REFUSE: ${message}`);
  process.exit(1);
}

function env(name) {
  return String(process.env[name] || "").trim();
}

function requireStagingSafety() {
  const gate = evaluateAcceptanceGate(process.env);
  if (!gate.ok) fail(gate.detail);
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

async function loadActiveRows(service, { tenantId, tournamentId, matchId }) {
  let query = service
    .from("referee_assignments")
    .select("id,tenant_id,tournament_id,match_id,referee_user_id,role,status,version,assigned_by")
    .eq("tenant_id", tenantId)
    .eq("tournament_id", tournamentId)
    .eq("status", "active");
  if (matchId) query = query.eq("match_id", matchId);
  const { data, error } = await query;
  if (error) throw new Error(`service assignment evidence failed: ${error.message}`);
  return data || [];
}

async function loadAuditRows(service, { tenantId, tournamentId, matchId }) {
  const { data, error } = await service
    .from("competition_referee_assignment_audit")
    .select("id,tenant_id,tournament_id,match_id,actor_id,operation,idempotency_key")
    .eq("tenant_id", tenantId)
    .eq("tournament_id", tournamentId)
    .eq("match_id", matchId)
    .order("recorded_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`service audit evidence failed: ${error.message}`);
  return data || [];
}

async function loadIdempotencyRows(service, { tenantId, tournamentId, key }) {
  const { data, error } = await service
    .from("competition_referee_assignment_idempotency")
    .select("tenant_id,tournament_id,idempotency_key,payload_hash,assignment_id")
    .eq("tenant_id", tenantId)
    .eq("tournament_id", tournamentId)
    .eq("idempotency_key", key);
  if (error) throw new Error(`service idempotency evidence failed: ${error.message}`);
  return data || [];
}

async function main() {
  requireStagingSafety();

  const url = requireEnv("STAGING_SUPABASE_URL");
  const anonKey = requireEnv("STAGING_ANON_KEY");
  const serviceKey = requireEnv("STAGING_SERVICE_ROLE_KEY");
  const receiptPath = requireEnv("CORE13_FIXTURE_RECEIPT_PATH");
  const loaded = loadFixtureReceiptFromPath(receiptPath);
  if (!loaded.ok) fail(loaded.detail);
  const receipt = loaded.receipt;
  const receiptProof = evaluateFixtureReceipt(receipt);
  if (!receiptProof.ok) fail(receiptProof.detail);
  if (receipt.namespace !== CORE13_FIXTURE_NAMESPACE) {
    fail(`receipt namespace=${receipt.namespace}`);
  }
  const physical = evaluatePhysicalEnvironment(receipt, process.env);
  if (!physical.ok) fail(physical.detail);
  const extractedRef = projectRefFromSupabaseUrl(url);
  if (extractedRef && extractedRef !== STAGING_PROJECT_REF) {
    fail("physical Staging projectRef mismatch");
  }
  const overrideProof = evaluateManualFixtureOverride(receipt, process.env);
  if (!overrideProof.ok) fail(overrideProof.detail);
  const fixtures = hydrateHarnessFixtures(receipt);
  const tenantA = fixtures.tenantA;
  const tournamentA = fixtures.tournamentA;
  const matchA = fixtures.matchA;
  const tenantB = fixtures.tenantB;
  const tournamentB = fixtures.tournamentB;
  const refereeId = fixtures.refereeId;
  const replaceRefereeId = fixtures.replaceRefereeId;
  const overlapA = fixtures.overlapA;
  const overlapB = fixtures.overlapB;
  const nonOverlap = fixtures.nonOverlap;
  const inactiveReferee = fixtures.inactiveReferee;
  const nonCanonicalReferee = fixtures.nonCanonicalReferee;
  const dailyDisabled = fixtures.dailyDisabled;
  const dailyEnabled = fixtures.dailyEnabled;
  const dailyEnabledMatch = fixtures.dailyEnabledMatch;
  const matchInProgress = fixtures.matchInProgress;
  const matchScoring = fixtures.matchScoring;
  const matchLocked = fixtures.matchLocked;
  const matchCompleted = fixtures.matchCompleted;

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const userA = await signIn(
    url,
    anonKey,
    requireEnv("STAGING_USER_A_EMAIL"),
    requireEnv("STAGING_USER_A_PASSWORD")
  );
  const userB = await signIn(
    url,
    anonKey,
    requireEnv("STAGING_USER_B_EMAIL"),
    requireEnv("STAGING_USER_B_PASSWORD")
  );

  const results = [];
  const record = (name, proof) => {
    const ok = proof?.ok === true;
    const detail = proof?.detail || "";
    results.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  };

  const requireFixture = (name, value, caseName) => {
    if (!value) {
      record(caseName, { ok: false, detail: `${name} fixture missing` });
      return false;
    }
    return true;
  };

  const mutationGate = createMutationGate();

  const remoteEvidence = await loadAuthoritativeRemoteFixtureEvidence(service, receipt);
  // Schedule windows: only pass when Adapter B / payload evidence is actually present.
  // Do not invent overlap truth from the receipt.
  const scheduleEvidence = {
    required: true,
    overlapConflict: remoteEvidence.schedule?.overlapConflict,
    nonOverlapConflict: remoteEvidence.schedule?.nonOverlapConflict,
  };
  if (
    scheduleEvidence.overlapConflict === undefined ||
    scheduleEvidence.nonOverlapConflict === undefined
  ) {
    const scheduleFail = {
      ok: false,
      detail: "REMOTE_SCHEDULE_EVIDENCE_UNPROVEN",
    };
    for (const name of CASE_CATALOG) record(name, scheduleFail);
    console.error(`REFUSE: ${scheduleFail.detail}`);
    console.log(`STAGING_ACCEPTANCE_CASE_COUNT=${CASE_CATALOG.length}`);
    console.log("PASS_COUNT=0");
    console.log(`FAIL_COUNT=${CASE_CATALOG.length}`);
    process.exit(1);
  }

  const remoteProof = evaluateReceiptRemoteReconciliation(receipt, {
    reconcile: true,
    hardcodedLifecycleProof: false,
    projectRef: extractedRef || STAGING_PROJECT_REF,
    environment: env("PICK_VN_ENV") || "staging",
    signedInUserA: userA.userId,
    signedInUserB: userB.userId,
    ...remoteEvidence,
    schedule: scheduleEvidence,
  });
  if (!remoteProof.ok) {
    for (const name of CASE_CATALOG) record(name, remoteProof);
    console.error(`REFUSE: ${remoteProof.detail}`);
    console.log(`STAGING_ACCEPTANCE_CASE_COUNT=${CASE_CATALOG.length}`);
    console.log("PASS_COUNT=0");
    console.log(`FAIL_COUNT=${CASE_CATALOG.length}`);
    process.exit(1);
  }

  const assignArgs = {
    p_tenant_id: tenantA,
    p_tournament_id: tournamentA,
    p_match_id: matchA,
    p_referee_user_id: refereeId,
    p_expected_version: 0,
    p_idempotency_key: `harness-${Date.now()}`,
    p_actor_id: userA.userId,
  };

  const commandBase = {
    tenantId: tenantA,
    tournamentId: tournamentA,
    matchId: matchA,
    refereeId,
    competitionMode: "INTERNAL",
  };

  const mutate = async (body) => {
    const gate = mutationGate.assertCanMutate();
    if (!gate.ok) return { status: 0, payload: { ok: false, code: gate.detail } };
    return invokeEdge(url, userA.token, body);
  };

  const teardownPreMatch = async () => {
    const leftovers = [];
    const restoreTargets = [
      { tournamentId: tournamentA, matchId: matchA },
      overlapA ? { tournamentId: tournamentA, matchId: overlapA } : null,
      overlapB ? { tournamentId: tournamentA, matchId: overlapB } : null,
      nonOverlap ? { tournamentId: tournamentA, matchId: nonOverlap } : null,
      dailyEnabled && dailyEnabledMatch
        ? { tournamentId: dailyEnabled, matchId: dailyEnabledMatch }
        : null,
    ].filter(Boolean);

    for (const target of restoreTargets) {
      const rows = await loadActiveRows(service, {
        tenantId: tenantA,
        tournamentId: target.tournamentId,
        matchId: target.matchId,
      });
      for (const row of rows) {
        const restore = await invokeEdge(url, userA.token, {
          action: "unassignReferee",
          command: {
            tenantId: tenantA,
            tournamentId: target.tournamentId,
            matchId: target.matchId,
            expectedVersion: Number(row.version || 0),
            idempotencyKey: `teardown-unassign-${row.id}`,
            competitionMode: target.tournamentId === dailyEnabled ? "DAILY_PLAY" : "INTERNAL",
          },
        });
        if (restore.payload?.ok !== true) leftovers.push(row);
      }
    }
    const leftoverProof = evaluateActiveLeftovers(leftovers);
    console.log(
      `ACTIVE_ASSIGNMENT_FIXTURE_LEFTOVERS=${leftovers.length} IMMUTABLE_AUDIT_DELETE=NO`
    );
    return leftoverProof;
  };

  let workError = null;
  let leftoverProof = { ok: true, detail: "ACTIVE_ASSIGNMENT_FIXTURE_LEFTOVERS=0" };
  await runWithFinalization(
    async () => {
      const anonRpc = await anon.rpc("competition_assign_referee", assignArgs);
      record("A.anon-direct-persistence-rpc-denied", evaluateDirectRpcDenied(anonRpc));

      const userARpc = await userA.client.rpc("competition_assign_referee", {
        ...assignArgs,
        p_idempotency_key: "user-a-direct-deny",
      });
      record(
        "B.authenticated-direct-persistence-rpc-denied",
        evaluateDirectRpcDenied(userARpc)
      );

      const probe = await invokeEdge(url, userA.token, {
        action: "getMatchAssignmentVersion",
        command: {
          tenantId: tenantA,
          tournamentId: tournamentA,
          matchId: matchA,
          competitionMode: "INTERNAL",
        },
      });
      const probeProof = evaluateAuthenticatedRuntimeProbe(probe);
      console.log(
        `${probeProof.ok ? "PASS" : "FAIL"} AUTHENTICATED_NON_MUTATING_EDGE_PROBE — ${probeProof.detail}`
      );
      if (!probeProof.ok) {
        for (const name of CASE_CATALOG) {
          if (!results.some((row) => row.name === name)) {
            record(name, { ok: false, detail: `blocked by runtime probe: ${probeProof.detail}` });
          }
        }
        throw new Error(probeProof.detail);
      }
      mutationGate.markProbePassed();

      const baselineA = await loadActiveRows(service, {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: matchA,
      });
      const baselineProof = evaluateBaselineKnownStart(baselineA.length, 0, "matchA");
      if (!baselineProof.ok) {
        for (const name of CASE_CATALOG) {
          if (!results.some((row) => row.name === name)) record(name, baselineProof);
        }
        throw new Error(baselineProof.detail);
      }

      const spoofKey = `stage-spoof-${Date.now()}`;
      const spoof = await mutate({
        action: "assignReferee",
        command: {
          ...commandBase,
          actorId: userB.userId,
          expectedVersion: 0,
          idempotencyKey: spoofKey,
        },
      });
      record(
        "C.browser-actor-spoof-ignored",
        evaluateAssignPass(spoof, { actorId: userA.userId, previousVersion: 0 })
      );

      const crossTenant = await invokeEdge(url, userB.token, {
        action: "assignReferee",
        command: {
          ...commandBase,
          expectedVersion: 0,
          idempotencyKey: `stage-cross-tenant-${Date.now()}`,
        },
      });
      record("D.cross-tenant-denied", evaluateDenial(crossTenant, DENIAL_CODES.CROSS_TENANT));

      const crossTournament = await mutate({
        action: "assignReferee",
        command: {
          ...commandBase,
          tournamentId: tournamentB,
          expectedVersion: 0,
          idempotencyKey: `stage-cross-tournament-${Date.now()}`,
        },
      });
      record(
        "E.cross-tournament-denied",
        evaluateDenial(crossTournament, DENIAL_CODES.CROSS_TOURNAMENT)
      );

      const durableAfterAssign = await loadActiveRows(service, {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: matchA,
      });
      const assignProof = evaluateAssignPass(spoof, {
        actorId: userA.userId,
        previousVersion: 0,
      });
      const durableAssignProof = evaluateDurableAssignment(durableAfterAssign, {
        matchId: matchA,
        refereeId,
        version: Number(spoof.payload?.version || 1),
      });
      record("F.trusted-server-pre-match-assign-pass", {
        ok: assignProof.ok && durableAssignProof.ok,
        detail: `${assignProof.detail}; durable=${durableAssignProof.detail}`,
      });

      const version = Number(spoof.payload?.version || 1);
      const beforeIdempotencyCount = durableAfterAssign.length;
      const replay = await mutate({
        action: "assignReferee",
        command: {
          ...commandBase,
          actorId: userB.userId,
          expectedVersion: 0,
          idempotencyKey: spoofKey,
        },
      });
      const afterReplay = await loadActiveRows(service, {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: matchA,
      });
      const idemConflict = await mutate({
        action: "assignReferee",
        command: {
          ...commandBase,
          refereeId: replaceRefereeId,
          expectedVersion: 0,
          idempotencyKey: spoofKey,
        },
      });
      const afterConflict = await loadActiveRows(service, {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: matchA,
      });
      const idempotentDurable = evaluateDurableIdempotency(
        beforeIdempotencyCount,
        afterReplay.length,
        Math.max(0, afterConflict.length - afterReplay.length)
      );
      const idempotencyLedger = await loadIdempotencyRows(service, {
        tenantId: tenantA,
        tournamentId: tournamentA,
        key: spoofKey,
      });
      const replayOk =
        replay.payload?.ok === true &&
        replay.payload?.replayed === true &&
        Number(replay.payload?.version) === version;
      record("H.idempotency-replay-same-command", {
        ok: replayOk && idempotentDurable.ok && idempotencyLedger.length === 1,
        detail: JSON.stringify({
          replayed: replay.payload?.replayed,
          code: replay.payload?.code,
          version: replay.payload?.version,
          durable: idempotentDurable.detail,
          ledger: idempotencyLedger.length,
        }),
      });
      const conflictProof = evaluateDenial(idemConflict, DENIAL_CODES.IDEMPOTENCY_CONFLICT);
      record("H.idempotency-conflict-changed-payload", {
        ok: conflictProof.ok && idempotentDurable.ok,
        detail: `${conflictProof.detail}; ${idempotentDurable.detail}`,
      });

      const casPass = await mutate({
        action: "replaceReferee",
        command: {
          ...commandBase,
          newRefereeId: replaceRefereeId,
          expectedVersion: version,
          idempotencyKey: `stage-cas-pass-${Date.now()}`,
        },
      });
      record("G.cas-correct-expected-version-pass", evaluateCasCorrectPass(casPass, version));

      const stale = await mutate({
        action: "assignReferee",
        command: {
          ...commandBase,
          expectedVersion: 0,
          idempotencyKey: `stage-stale-${Date.now()}`,
        },
      });
      record("G.cas-stale-expected-version-deny", evaluateDenial(stale, DENIAL_CODES.STALE_WRITE));

      const replaceVersion = Number(casPass.payload?.version || version + 1);
      const previousAssignmentId =
        casPass.payload?.assignment?.assignmentId ||
        casPass.payload?.assignmentId ||
        casPass.payload?.previousAssignmentId ||
        durableAfterAssign[0]?.id ||
        null;
      const replace = await mutate({
        action: "replaceReferee",
        command: {
          ...commandBase,
          newRefereeId: refereeId,
          expectedVersion: replaceVersion,
          idempotencyKey: `stage-replace-${Date.now()}`,
          emergencyReplacement: false,
        },
      });
      record(
        "I.atomic-replace-succeeds",
        evaluateAtomicReplacePass(replace, {
          previousVersion: replaceVersion,
          refereeId,
        })
      );

      const durableAfterReplace = await loadActiveRows(service, {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: matchA,
      });
      const listed = await invokeEdge(url, userA.token, {
        action: "listActiveAssignments",
        command: { tenantId: tenantA, tournamentId: tournamentA, matchId: matchA },
      });
      const listedActive = Array.isArray(listed.payload?.assignments)
        ? listed.payload.assignments.filter(
            (row) =>
              String(row.matchId || row.match_id) === matchA &&
              String(row.status || "").toLowerCase() === "active"
          )
        : durableAfterReplace;
      const oneActive = evaluateExactlyOneActive(durableAfterReplace, {
        matchId: matchA,
        refereeId,
        version: Number(replace.payload?.version),
        role: "PRIMARY",
      });
      const listedOne = evaluateExactlyOneActive(listedActive, {
        matchId: matchA,
        refereeId,
      });
      const oldRevoked = evaluateOldAssignmentRevoked(
        durableAfterReplace,
        previousAssignmentId
      );
      record("I.exactly-one-active-match-role", {
        ok: oneActive.ok && listedOne.ok && oldRevoked.ok,
        detail: `${oneActive.detail}; listed=${listedOne.detail}; ${oldRevoked.detail}`,
      });

      const lifecycle = async (caseName, matchId, action, extra, denialCodes) => {
        if (!requireFixture("lifecycle match", matchId, caseName)) return;
        let expectedVersion = 0;
        if (action === "replaceReferee" && !denialCodes) {
          const rows = await loadActiveRows(service, {
            tenantId: tenantA,
            tournamentId: tournamentA,
            matchId,
          });
          const start = evaluateBaselineKnownStart(rows.length, 1, caseName);
          if (!start.ok) {
            record(caseName, {
              ok: false,
              detail: `fixture/evidence blocker: ${start.detail}`,
            });
            return;
          }
          expectedVersion = Number(rows[0].version || 0);
        }
        const result = await mutate({
          action,
          command: {
            ...commandBase,
            matchId,
            newRefereeId: replaceRefereeId,
            expectedVersion,
            idempotencyKey: `stage-${caseName}-${Date.now()}`,
            ...extra,
          },
        });
        if (denialCodes) {
          record(caseName, evaluateDenial(result, denialCodes));
          return;
        }
        record(
          caseName,
          action === "replaceReferee"
            ? evaluateAtomicReplacePass(result, { refereeId: replaceRefereeId })
            : evaluateAssignPass(result)
        );
      };

      await lifecycle(
        "J.lifecycle-in-progress-assign-deny",
        matchInProgress,
        "assignReferee",
        {},
        DENIAL_CODES.IN_PROGRESS_ASSIGN
      );
      await lifecycle(
        "J.lifecycle-in-progress-unassign-deny",
        matchInProgress,
        "unassignReferee",
        {},
        DENIAL_CODES.IN_PROGRESS_UNASSIGN
      );
      await lifecycle(
        "J.lifecycle-in-progress-replace-pass",
        matchInProgress,
        "replaceReferee",
        {},
        null
      );
      await lifecycle(
        "J.lifecycle-scoring-replace-without-emergency-deny",
        matchScoring,
        "replaceReferee",
        { emergencyReplacement: false },
        DENIAL_CODES.SCORING_REPLACE_WITHOUT_EMERGENCY
      );
      await lifecycle(
        "J.lifecycle-scoring-emergency-replace-pass",
        matchScoring,
        "replaceReferee",
        { emergencyReplacement: true },
        null
      );
      await lifecycle(
        "J.lifecycle-locked-deny",
        matchLocked,
        "assignReferee",
        {},
        DENIAL_CODES.LOCKED
      );
      await lifecycle(
        "J.lifecycle-completed-deny",
        matchCompleted,
        "assignReferee",
        {},
        DENIAL_CODES.COMPLETED
      );
      console.log(
        "LIFECYCLE_FIXTURE_FINAL_STATE=in-progress-replace and scoring-emergency-replace remain on dedicated disposable fixtures; unassign is lifecycle-denied"
      );

      const auditRows = await loadAuditRows(service, {
        tenantId: tenantA,
        tournamentId: tournamentA,
        matchId: matchA,
      });
      record(
        "K.audit-originating-actor-user-a",
        evaluateDurableAuditActor(auditRows, {
          actorId: userA.userId,
          tenantId: tenantA,
          tournamentId: tournamentA,
          matchId: matchA,
          operation: "ASSIGN",
        })
      );
      const auditRead = await userA.client
        .from("competition_referee_assignment_audit")
        .select("id")
        .limit(1);
      record(
        "K.browser-cannot-read-audit-table",
        evaluateBrowserAuditDenied(auditRead, auditRows)
      );

      if (
        requireFixture(
          "STAGING_NON_CANONICAL_REFEREE_ID",
          nonCanonicalReferee,
          "L.non-canonical-referee-deny"
        )
      ) {
        const denied = await mutate({
          action: "assignReferee",
          command: {
            ...commandBase,
            refereeId: nonCanonicalReferee,
            expectedVersion: 0,
            idempotencyKey: `stage-noncanonical-${Date.now()}`,
          },
        });
        record(
          "L.non-canonical-referee-deny",
          evaluateDenial(denied, DENIAL_CODES.NON_CANONICAL_IDENTITY)
        );
      }
      if (
        requireFixture(
          "STAGING_INACTIVE_REFEREE_ID",
          inactiveReferee,
          "L.inactive-referee-deny"
        )
      ) {
        const denied = await mutate({
          action: "assignReferee",
          command: {
            ...commandBase,
            refereeId: inactiveReferee,
            expectedVersion: 0,
            idempotencyKey: `stage-inactive-${Date.now()}`,
          },
        });
        record("L.inactive-referee-deny", evaluateDenial(denied, DENIAL_CODES.INACTIVE_REFEREE));
      }

      const missingQual = await mutate({
        action: "assignReferee",
        command: {
          ...commandBase,
          expectedVersion: 0,
          idempotencyKey: `stage-qual-${Date.now()}`,
          requireQualification: true,
        },
      });
      record(
        "L.required-qualification-missing-deny",
        evaluateDenial(missingQual, DENIAL_CODES.QUALIFICATION_MISSING)
      );
      const missingAvail = await mutate({
        action: "assignReferee",
        command: {
          ...commandBase,
          expectedVersion: 0,
          idempotencyKey: `stage-avail-${Date.now()}`,
          requireAvailability: true,
        },
      });
      record(
        "L.unavailable-referee-deny-when-required",
        evaluateDenial(missingAvail, DENIAL_CODES.AVAILABILITY_MISSING)
      );

      if (
        requireFixture("STAGING_MATCH_OVERLAP_A", overlapA, "L.overlapping-schedule-conflict-deny") &&
        requireFixture("STAGING_MATCH_OVERLAP_B", overlapB, "L.overlapping-schedule-conflict-deny")
      ) {
        const overlapBaselineA = await loadActiveRows(service, {
          tenantId: tenantA,
          tournamentId: tournamentA,
          matchId: overlapA,
        });
        const overlapBaselineB = await loadActiveRows(service, {
          tenantId: tenantA,
          tournamentId: tournamentA,
          matchId: overlapB,
        });
        const overlapStartA = evaluateBaselineKnownStart(
          overlapBaselineA.length,
          0,
          "overlapA"
        );
        const overlapStartB = evaluateBaselineKnownStart(
          overlapBaselineB.length,
          0,
          "overlapB"
        );
        if (!overlapStartA.ok || !overlapStartB.ok) {
          record("L.overlapping-schedule-conflict-deny", {
            ok: false,
            detail: `${overlapStartA.detail}; ${overlapStartB.detail}`,
          });
        } else {
          await mutate({
            action: "assignReferee",
            command: {
              ...commandBase,
              matchId: overlapA,
              expectedVersion: 0,
              idempotencyKey: `stage-overlap-a-${Date.now()}`,
            },
          });
          const overlap = await mutate({
            action: "assignReferee",
            command: {
              ...commandBase,
              matchId: overlapB,
              expectedVersion: 0,
              idempotencyKey: `stage-overlap-b-${Date.now()}`,
            },
          });
          record(
            "L.overlapping-schedule-conflict-deny",
            evaluateDenial(overlap, DENIAL_CODES.OVERLAP)
          );
        }
      }
      if (
        requireFixture(
          "STAGING_MATCH_NONOVERLAP",
          nonOverlap,
          "L.non-overlapping-schedule-assign-pass"
        )
      ) {
        const nonOverlapBaseline = await loadActiveRows(service, {
          tenantId: tenantA,
          tournamentId: tournamentA,
          matchId: nonOverlap,
        });
        const nonOverlapStart = evaluateBaselineKnownStart(
          nonOverlapBaseline.length,
          0,
          "nonOverlap"
        );
        if (!nonOverlapStart.ok) {
          record("L.non-overlapping-schedule-assign-pass", nonOverlapStart);
        } else {
          const allowed = await mutate({
            action: "assignReferee",
            command: {
              ...commandBase,
              matchId: nonOverlap,
              expectedVersion: 0,
              idempotencyKey: `stage-nonoverlap-${Date.now()}`,
            },
          });
          record(
            "L.non-overlapping-schedule-assign-pass",
            evaluateAssignPass(allowed, { previousVersion: 0 })
          );
        }
      }

      if (
        requireFixture(
          "STAGING_DAILY_PLAY_DISABLED_TOURNAMENT",
          dailyDisabled,
          "M.daily-play-disabled-not-applicable"
        )
      ) {
        const disabled = await mutate({
          action: "assignReferee",
          command: {
            ...commandBase,
            tournamentId: dailyDisabled,
            expectedVersion: 0,
            idempotencyKey: `stage-daily-off-${Date.now()}`,
            competitionMode: "DAILY_PLAY",
            refereeFeatureEnabled: false,
          },
        });
        record(
          "M.daily-play-disabled-not-applicable",
          evaluateDenial(disabled, DENIAL_CODES.DAILY_DISABLED)
        );
      }
      if (
        requireFixture(
          "STAGING_DAILY_PLAY_ENABLED_TOURNAMENT",
          dailyEnabled,
          "M.daily-play-enabled-trusted-server-core13"
        ) &&
        requireFixture(
          "STAGING_DAILY_PLAY_ENABLED_MATCH",
          dailyEnabledMatch,
          "M.daily-play-enabled-trusted-server-core13"
        )
      ) {
        const dailyBaseline = await loadActiveRows(service, {
          tenantId: tenantA,
          tournamentId: dailyEnabled,
          matchId: dailyEnabledMatch,
        });
        const dailyStart = evaluateBaselineKnownStart(
          dailyBaseline.length,
          0,
          "dailyEnabled"
        );
        if (!dailyStart.ok) {
          record("M.daily-play-enabled-trusted-server-core13", dailyStart);
        } else {
          const enabled = await mutate({
            action: "assignReferee",
            command: {
              ...commandBase,
              tournamentId: dailyEnabled,
              matchId: dailyEnabledMatch,
              expectedVersion: 0,
              idempotencyKey: `stage-daily-on-${Date.now()}`,
              competitionMode: "DAILY_PLAY",
              refereeFeatureEnabled: true,
            },
          });
          record("M.daily-play-enabled-trusted-server-core13", evaluateDailyEnabledPass(enabled));
        }
      }

    },
    async () => {
      try {
        leftoverProof = await teardownPreMatch();
        if (!leftoverProof.ok) {
          console.error(`REFUSE: ${leftoverProof.detail}`);
        }
      } catch (err) {
        leftoverProof = {
          ok: false,
          detail: `teardown failed: ${err?.message || err}`,
        };
        console.error(`REFUSE: ${leftoverProof.detail}`);
      }
    }
  ).catch((err) => {
    workError = err;
  });

  for (const expected of CASE_CATALOG) {
    if (!results.some((row) => row.name === expected)) {
      record(expected, {
        ok: false,
        detail: workError ? String(workError.message || workError) : "case not executed",
      });
    }
  }

  const catalog = evaluateCatalogExecution(results, CASE_CATALOG);
  const failed = results.filter((row) => !row.ok);
  console.log(`STAGING_ACCEPTANCE_CASE_COUNT=${CASE_CATALOG.length}`);
  console.log(`PASS_COUNT=${results.filter((row) => row.ok).length}`);
  console.log(`FAIL_COUNT=${failed.length}`);
  if (!catalog.ok) {
    fail(catalog.detail);
  }
  if (failed.length || workError || leftoverProof.ok !== true) {
    fail(
      `Staging acceptance failures: ${failed.map((row) => row.name).join(", ") || workError || leftoverProof.detail}`
    );
  }
  console.log("PASS core13 trusted-server staging acceptance");
}

main().catch((err) => {
  fail(String(err?.message || err));
});
