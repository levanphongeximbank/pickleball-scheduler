/**
 * CORE-13 trusted server execution boundary — security + architecture tests.
 * Local/static only. Does not execute SQL, deploy Edge, or mutate Staging.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_COMMAND,
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_COMPETITION_MODE,
  ASSIGNMENT_LIFECYCLE_STATE,
  COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION,
  CORE13_CANONICAL_ASSIGNMENT_RUNTIME,
  createCompetitionRefereeAssignmentCommandService,
  createInMemoryCanonicalAssignmentPersistence,
  createRpcCanonicalAssignmentPersistence,
  evaluateAssignmentLifecycleGate,
  stripUntrustedAssignmentActorFields,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import {
  handleCompetitionRefereeAssignmentAction,
  stripBrowserAuthority,
  verifyBearerToken,
} from "../src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js";
import { COMPETITION_ASSIGNMENT_MUTATION_RPC } from "../src/features/competition-engine/operations/referee/assignment/persistence/createRpcCanonicalAssignmentPersistence.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(js|jsx|ts|tsx|mjs)$/.test(name)) acc.push(full);
  }
  return acc;
}

const APPLY = read(
  "docs/v5/migrations/core13-canonical-assignment-runtime-closure-01/02_APPLY.sql"
);
const VERIFY = read(
  "docs/v5/migrations/core13-canonical-assignment-runtime-closure-01/03_VERIFY.sql"
);

test("A/B: authored SQL denies authenticated/anon/public EXECUTE; allows service_role", () => {
  for (const name of [
    "competition_assign_referee",
    "competition_replace_referee",
    "competition_unassign_referee",
  ]) {
    const block = APPLY.split(`create or replace function public.${name}`)[1];
    assert.match(
      block,
      /revoke all on function public\.\w+[\s\S]{0,500}from public, anon, authenticated/i,
      name
    );
    assert.match(block, /grant execute[\s\S]{0,400}to service_role/i, name);
    assert.doesNotMatch(block, /grant execute[\s\S]{0,400}to authenticated/i, name);
    assert.doesNotMatch(block, /grant execute[\s\S]{0,400}to anon/i, name);
  }
  assert.match(VERIFY, /authenticated\.execute\./);
  assert.match(VERIFY, /service_role\.execute\.missing/);
  assert.match(VERIFY, /authenticated_assign_execute_denied/);
  assert.match(VERIFY, /service_role_assign_execute_allowed/);
});

test("C: Edge Function authenticates JWT and ignores browser actorId", async () => {
  const stripped = stripBrowserAuthority({
    tenantId: "tenant-a",
    tournamentId: "tourn-a",
    matchId: "match-1",
    refereeId: "11111111-1111-4111-8111-111111111111",
    actorId: "spoofed-browser-actor",
    actor: { id: "spoofed-browser-actor" },
    lifecycleState: "PRE_MATCH",
    directorySnapshot: { forged: true },
    emergencyAuthorized: true,
  });
  assert.equal(stripped.actorId, undefined);
  assert.equal(stripped.actor, undefined);
  assert.equal(stripped.lifecycleState, undefined);
  assert.equal(stripped.directorySnapshot, undefined);
  assert.equal(stripped.emergencyAuthorized, undefined);

  const clientStrip = stripUntrustedAssignmentActorFields({
    tenantId: "tenant-a",
    actorId: "browser-actor",
    lifecycleState: "PRE_MATCH",
  });
  assert.equal(clientStrip.actorId, undefined);

  let persistedActor = null;
  const userClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }, error: null }),
    },
    rpc: async (name) => {
      if (name === "canonical_tournament_assert_tenant") return { data: null, error: null };
      if (name === "canonical_tournament_assert_permission") return { data: null, error: null };
      if (name === "canonical_tournament_get") return { data: { ok: true }, error: null };
      return { data: null, error: { message: "unexpected " + name } };
    },
  };
  const serviceClient = {
    rpc: async (name, args) => {
      if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.ASSIGN) {
        persistedActor = args.p_actor_id;
        return {
          data: {
            ok: true,
            replayed: false,
            assignmentId: "asg-1",
            version: 1,
            matchId: args.p_match_id,
            role: "REFEREE",
            refereeUserId: args.p_referee_user_id,
            status: "active",
          },
          error: null,
        };
      }
      return { data: null, error: { message: "unexpected rpc " + name } };
    },
    from(table) {
      const rows =
        table === "canonical_tournaments"
          ? [{ id: "tourn-a", tenant_id: "tenant-a", club_id: "club-a", status: "active", mode: "internal", payload: { matches: [{ id: "match-1", status: "SCHEDULED", entryAId: "a", entryBId: "b" }] }, external_key: "tourn-a" }]
          : table === "team_tournaments"
            ? []
            : table === "match_live_states"
              ? []
              : table === "profiles"
                ? [
                    {
                      id: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
                      display_name: "Ref",
                      role: "REFEREE",
                      venue_id: "tenant-a",
                      status: "active",
                    },
                  ]
                : table === "referee_assignments"
                  ? []
                  : [];
      const api = {
        select: () => api,
        eq: () => api,
        order: () => api,
        limit: () => api,
        maybeSingle: async () => ({ data: rows[0] || null, error: null }),
        then: (resolve) => resolve({ data: rows, error: null }),
      };
      return api;
    },
  };

  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
        actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        expectedVersion: 0,
        idempotencyKey: "idem-actor-spoof",
      },
    },
    userClient,
    serviceClient,
    identityAccessAdapter: {
      async resolveSubjectIdentity() {
        return {
          status: "OK",
          data: {
            subjectId: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
            canonicalSubjectId: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
            role: "REFEREE",
            status: "active",
            active: true,
            tenantId: "tenant-a",
            venueId: "venue-home",
          },
        };
      },
    },
  });
  assert.equal(result.body?.ok, true, JSON.stringify(result.body));
  assert.equal(persistedActor, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.notEqual(persistedActor, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal(result.body.originatingActorId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(result.body?.core13Executed, true);
  assert.equal(result.body?.assignmentId, "asg-1");
  assert.equal(result.body?.callerTenantAsAuthority, "DENY");
});

test("D: service-role key never appears in browser/product source", () => {
  const roots = [
    path.join(ROOT, "src/components"),
    path.join(ROOT, "src/pages"),
    path.join(ROOT, "src/features/competition-engine/operations/referee/assignment/client"),
    path.join(ROOT, "src/features/team-tournament/services/teamCore13AssignmentTransport.js"),
  ];
  const files = roots.flatMap((root) =>
    statSync(root).isDirectory() ? walk(root) : [root]
  );
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY/, path.relative(ROOT, file));
    assert.doesNotMatch(src, /service_role key/i, path.relative(ROOT, file));
  }
  const edge = read("supabase/functions/competition-referee-assignment/index.ts");
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /createSupabaseClients/);
});

test("E: server-side CORE-13 runs before persistence (command service wiring)", () => {
  const serviceSrc = read(
    "src/features/competition-engine/operations/referee/assignment/createCompetitionRefereeAssignmentCommandService.js"
  );
  const assignFn = serviceSrc.split("async function assignReferee")[1].split("async function replaceReferee")[0];
  const coreIdx = assignFn.indexOf("validateManualRefereeAssignment");
  const persistIdx = assignFn.indexOf("persistence.assign");
  assert.ok(coreIdx >= 0 && persistIdx > coreIdx);
  const handler = read(
    "src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js"
  );
  assert.match(handler, /commandService\[method\]/);
  assert.doesNotMatch(
    handler.split("async function executeCompetitionRefereeAssignmentAction")[1],
    /persistence\.assign\(/
  );
});

test("F: product UI is not the persistence-adapter decision path", () => {
  const uiFiles = [
    "src/components/tournament/RefereeAssignPanel.jsx",
    "src/components/tournament/team/TeamRefereeSafetyPanel.jsx",
    "src/pages/tournament/TournamentRefereeAssignPage.jsx",
  ];
  for (const rel of uiFiles) {
    const src = read(rel);
    assert.doesNotMatch(src, /createRpcCanonicalAssignmentPersistence/);
    assert.doesNotMatch(src, /createBlobCanonicalAssignmentPersistence/);
    assert.doesNotMatch(src, /createCompetitionRefereeAssignmentCommandService/);
  }
  const panel = read("src/components/tournament/RefereeAssignPanel.jsx");
  assert.match(panel, /createCompetitionRefereeAssignmentTrustedClient/);
  const team = read("src/features/team-tournament/services/teamCore13AssignmentTransport.js");
  assert.match(team, /createCompetitionRefereeAssignmentTrustedClient/);
  assert.match(team, /competition-referee-assignment/);
});

test("G: canonical referee identity/evidence required", async () => {
  const persistence = createRpcCanonicalAssignmentPersistence({
    serviceClient: {
      rpc: async () => ({ data: { ok: true }, error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({ limit: async () => ({ data: [], error: null }) }),
              }),
            }),
          }),
        }),
      }),
    },
  });
  await assert.rejects(
    () =>
      persistence.assign({
        tenantId: "t",
        tournamentId: "x",
        matchId: "m",
        refereeId: "not-a-uuid",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        expectedVersion: 0,
        idempotencyKey: "k",
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED
  );
});

test("H: cross-tenant and cross-tournament fail closed", async () => {
  const userClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } }, error: null }),
    },
    rpc: async (name) => {
      if (name === "canonical_tournament_assert_tenant") {
        return { data: null, error: { message: "TOURNAMENT_FORBIDDEN" } };
      }
      return { data: null, error: null };
    },
  };
  const denied = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "foreign-tenant",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: "11111111-1111-4111-8111-111111111111",
        expectedVersion: 0,
        idempotencyKey: "x",
      },
    },
    userClient,
    serviceClient: {
      rpc: async () => ({ data: null, error: null }),
      from: () => {
        const api = {
          select: () => api,
          eq: () => api,
          limit: () => api,
          maybeSingle: async () => ({
            data: { id: "tourn-a", tenant_id: "tenant-a", club_id: "club-a" },
            error: null,
          }),
          then: (resolve) => resolve({ data: [], error: null }),
        };
        return api;
      },
    },
  });
  assert.equal(denied.body.ok, false);
  assert.equal(denied.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED);
  assert.equal(denied.httpStatus, 403);
});

test("I: CAS / idempotency / atomic replace remain intact", () => {
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.casRequired, true);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.idempotencyRequired, true);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.atomicReplacement, true);
  assert.match(APPLY, /EXPECTED_VERSION_REQUIRED/);
  assert.match(APPLY, /STALE_WRITE/);
  assert.match(APPLY, /competition_assignment_check_idempotency/);
  assert.match(APPLY, /ATOMIC: revoke old \+ activate new/);
  const inProgressReplace = evaluateAssignmentLifecycleGate({
    command: ASSIGNMENT_COMMAND.REPLACE,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS,
  });
  assert.equal(inProgressReplace.allowed, true);
});

test("J: legacy assignment writers remain zero", () => {
  const individual = read("src/features/individual-tournament/engines/refereeAssignEngine.js");
  assert.match(individual, /productWriters:\s*0/);
  const team = read("src/features/team-tournament/engines/refereeAssignEngine.js");
  assert.match(team, /productWriters:\s*0/);
});

test("runtime lock: trusted server is authoritative execution", () => {
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.assignmentAuthority, "CORE-13");
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.authoritativeExecutionLocation, "TRUSTED_SERVER");
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.clientCore13Role, "PRE_VALIDATION_ONLY");
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.trustedServerEndpoint, COMPETITION_REFEREE_ASSIGNMENT_EDGE_FUNCTION);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.authenticatedDirectRpcExecute, "DENY");
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.interimBlobAuthorityPostCutover, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.contract08Changed, false);
});

test("SQL actor provenance is delegated p_actor_id under service_role", () => {
  assert.match(APPLY, /SERVICE_ROLE_REQUIRED/);
  assert.match(APPLY, /ORIGINATING_ACTOR_REQUIRED/);
  assert.match(APPLY, /v_actor := p_actor_id/);
  assert.doesNotMatch(APPLY, /v_actor := auth\.uid\(\)/);
  assert.doesNotMatch(APPLY, /coalesce\s*\(\s*p_actor_id\s*,\s*auth\.uid\s*\(\s*\)\s*\)/i);
  assert.match(APPLY, /trustedServerBoundary/);
});

test("verifyBearerToken fail-closed without user", async () => {
  const result = await verifyBearerToken({
    auth: { getUser: async () => ({ data: { user: null }, error: { message: "nope" } }) },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR);
});

test("in-memory command service still requires CORE-13 before persist", async () => {
  const persistence = createInMemoryCanonicalAssignmentPersistence();
  const service = createCompetitionRefereeAssignmentCommandService({
    persistence,
    production: false,
  });
  const result = await service.assignReferee({
    tenantId: "tenant-a",
    tournamentId: "tourn-a",
    matchId: "match-1",
    refereeId: "ref-001",
    actorId: "actor-1",
    expectedVersion: 0,
    idempotencyKey: "idem-local",
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
    authorizedTenantId: "tenant-a",
    authorizedTournamentId: "tourn-a",
    competitionMode: ASSIGNMENT_COMPETITION_MODE.INTERNAL,
  });
  assert.equal(result.ok, true);
  assert.equal(result.core13Decision, "ACCEPT");
});

test("staging acceptance harness refuses without explicit Staging flags", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  const proofs = read("scripts/core13/core13-staging-acceptance-proofs.mjs");
  assert.match(harness, /CORE13_STAGING_ACCEPTANCE_GO/);
  assert.match(harness, /STAGING_MUTATION_GO/);
  assert.match(harness, /SQL_ALREADY_APPLIED_PREREQUISITE/);
  assert.match(harness, /EDGE_ALREADY_DEPLOYED_PREREQUISITE/);
  assert.match(harness, /PICK_VN_ENV/);
  assert.match(proofs, /PRODUCTION_HINTS/);
  assert.match(harness, /A\.anon-direct-persistence-rpc-denied/);
  assert.match(harness, /L\.overlapping-schedule-conflict-deny/);
  assert.match(harness, /M\.daily-play-disabled-not-applicable/);
  assert.doesNotMatch(harness, /eyJ[A-Za-z0-9_-]{20,}/);
  const sqlAcceptance = read(
    "docs/v5/migrations/core13-canonical-assignment-runtime-closure-01/05_STAGING_SQL_ACCEPTANCE.sql"
  );
  assert.match(sqlAcceptance, /STAGING_SQL_ACCEPTANCE_TEST_NOT_RUN_REQUIRES_OWNER_GO/);
});

test("Edge Function and bundle entry exist; not coupled to Referee V5 scoring", () => {
  assert.equal(
    existsSync(path.join(ROOT, "supabase/functions/competition-referee-assignment/index.ts")),
    true
  );
  assert.equal(
    existsSync(
      path.join(
        ROOT,
        "src/features/competition-engine/operations/referee/assignment/server/edgeEntry.js"
      )
    ),
    true
  );
  const edge = read("supabase/functions/competition-referee-assignment/index.ts");
  assert.doesNotMatch(edge, /handleRefereeV5MatchHttpRequest/);
  assert.match(edge, /handleCompetitionRefereeAssignmentHttpRequest/);
});
