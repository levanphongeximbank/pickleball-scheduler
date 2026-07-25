/**
 * COMMS-ACT-05 — Trusted backend unit + static certification tests.
 * No remote mutation. No Production access.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMMUNICATION_ACT05_CAPABILITY_STATE,
  COMMUNICATION_AUTH_CAPABILITY,
  COMMUNICATION_FOUNDATION_ERROR_CODE,
  COMMUNICATION_SERVER_ONLY_BOUNDARY,
  COMMUNICATION_SMOKE_FIXTURE_MARKER,
  COMMUNICATION_SYSTEM_PRODUCER_ID,
  COMMUNICATION_TRUSTED_BACKEND_ENV,
  COMMUNICATION_TRUSTED_BACKEND_HOST,
  COMMUNICATION_TRUSTED_COMMAND,
  COMMS_ACT_05_REQUIRED_DOCS,
  COMMS_ACT_05_VERDICTS,
  createClubManagerAccessPolicy,
  createMemoryClubMembershipReader,
  createTrustedBackendHttpMessagingGateway,
  evaluateCommsAct05BackupGate,
  evaluateCommsAct05OwnerGoGate,
  evaluateCommsAct05Preflight,
  evaluateCommsAct05TrustedBackendHost,
  getCommsAct03CapabilityMatrix,
  getCommsAct05CapabilityState,
  mapCommunicationHttpError,
  resolveCommunicationRuntimeMode,
  COMMUNICATION_RUNTIME_MODE,
  CommunicationFoundationError,
} from "../src/features/communication/index.js";
import {
  COMMS_PRODUCTION_PROJECT_REF,
  COMMS_STAGING_PROJECT_REF,
} from "../src/features/communication/activation/stagingTarget.js";
import { createMemoryIdempotencyLedger } from "../src/features/communication/trustedBackend/createIdempotencyLedger.js";
import { createTrustedCommunicationBackend } from "../src/features/communication/trustedBackend/createTrustedCommunicationBackend.js";
import { createSystemMessageProducer } from "../src/features/communication/trustedBackend/createSystemMessageProducer.js";
import {
  assertNoServiceRoleInCommunicationBrowserSurface,
  listCommunicationServerOnlyModulePaths,
} from "../src/features/communication/trustedBackend/serverOnlyBoundary.js";
import { createDirectMessagingApplication } from "../src/features/communication/application/createDirectMessagingApplication.js";
import { createClubCommunicationApplication } from "../src/features/communication/application/createClubCommunicationApplication.js";
import { CLUB_MEMBERSHIP_STATUS } from "../src/features/communication/constants/clubMembershipStatus.js";
import { CLUB_CHANNEL_KIND } from "../src/features/communication/constants/clubChannelKinds.js";
import { createClubManagerTeamAccessPolicy } from "../src/features/communication/adapters/createClubManagerAccessPolicy.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(
  root,
  "docs/communication-foundation/activation/comms-act-05"
);

test("COMMS-ACT-05 docs exist", () => {
  for (const name of COMMS_ACT_05_REQUIRED_DOCS) {
    assert.ok(fs.existsSync(path.join(docsDir, name)), name);
  }
  assert.ok(
    fs.existsSync(
      path.join(docsDir, "sql/COMMS_ACT_05_SMOKE_FIXTURES_CLEANUP.sql")
    )
  );
});

test("trusted backend host selection is Vercel api/communication", () => {
  const host = evaluateCommsAct05TrustedBackendHost({ repoRoot: root });
  assert.equal(host.pass, true, JSON.stringify(host.findings, null, 2));
  assert.equal(host.hostFamily, "vercel_serverless_api");
  assert.equal(host.basePath, "/api/communication");
  assert.equal(host.stagingRef, COMMS_STAGING_PROJECT_REF);
  assert.equal(host.productionRefBlocked, COMMS_PRODUCTION_PROJECT_REF);
  assert.ok(
    COMMUNICATION_TRUSTED_BACKEND_HOST.rejectedHosts.includes("api/v1")
  );
});

test("server-only secret boundary — browser surfaces clean", () => {
  const result = assertNoServiceRoleInCommunicationBrowserSurface({
    repoRoot: root,
  });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.equal(result.boundary, COMMUNICATION_SERVER_ONLY_BOUNDARY);
  const paths = listCommunicationServerOnlyModulePaths();
  assert.ok(paths.some((p) => p.startsWith("api/communication/")));
});

test("auth token verification contract mirrored in api host", () => {
  const src = fs.readFileSync(
    path.join(root, "api/communication/authorizeCommunicationActor.js"),
    "utf8"
  );
  assert.match(src, /auth\.getUser\(token\)/);
  assert.match(src, /from\("profiles"\)/);
  assert.match(src, /assertCommunicationProductionTargetAllowed/);
  assert.doesNotMatch(src, /VITE_.*SERVICE_ROLE/);
  const gate = fs.readFileSync(
    path.join(root, "api/communication/productionTargetGate.js"),
    "utf8"
  );
  assert.match(gate, /evaluateCommunicationProductionRefGate/);
  const stagingTarget = fs.readFileSync(
    path.join(
      root,
      "src/features/communication/activation/stagingTarget.js"
    ),
    "utf8"
  );
  assert.match(stagingTarget, /expuvcohlcjzvrrauvud/);
  assert.match(stagingTarget, /qyewbxjsiiyufanzcjcq/);
});

test("identity/tenant derived from server profile — not body claims", () => {
  const cmd = fs.readFileSync(
    path.join(root, "api/communication/command.js"),
    "utf8"
  );
  assert.match(cmd, /actorParticipantId: auth\.actorId/);
  assert.match(cmd, /tenantId: auth\.tenantId/);
  assert.match(cmd, /delete payload\.actorParticipantId/);
  assert.match(cmd, /delete payload\.senderParticipantId/);
});

test("capability state locked for ACT-05", () => {
  const state = getCommsAct05CapabilityState();
  assert.equal(
    state.DIRECT_TRUSTED_BACKEND,
    COMMUNICATION_ACT05_CAPABILITY_STATE.DIRECT_TRUSTED_BACKEND
  );
  assert.equal(
    state.SYSTEM_TRUSTED_PRODUCER,
    "SYSTEM_TRUSTED_PRODUCER"
  );
  assert.equal(state.CLUB_SELECT_CLIENT_RLS, "CLUB_SELECT_CLIENT_RLS");
  assert.equal(
    state.CLUB_WRITE_ADMIN_TRUSTED_BACKEND,
    "CLUB_WRITE_ADMIN_TRUSTED_BACKEND"
  );
  assert.equal(state.COMMUNITY_BLOCKED_FAIL_CLOSED, "COMMUNITY_BLOCKED_FAIL_CLOSED");
  assert.equal(state.REALTIME_BLOCKED_FAIL_CLOSED, "REALTIME_BLOCKED_FAIL_CLOSED");
  assert.equal(state.PRODUCTION_UNTOUCHED, "PRODUCTION_UNTOUCHED");

  const act03 = getCommsAct03CapabilityMatrix();
  assert.equal(
    act03.capabilities.community.read,
    COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED
  );
});

test("Direct positive/negative + sender spoof via trusted backend memory", async () => {
  const alice = "user-alice";
  const bob = "user-bob";
  const eve = "user-eve";

  const memDirect = createDirectMessagingApplication();
  memDirect.identityActorPort.seed(alice, true);
  memDirect.identityActorPort.seed(bob, true);
  memDirect.identityActorPort.seed(eve, true);
  const memClub = createClubCommunicationApplication({
    membershipReader: createMemoryClubMembershipReader([
      ["club-1", alice, CLUB_MEMBERSHIP_STATUS.ACTIVE],
      ["club-1", bob, CLUB_MEMBERSHIP_STATUS.ACTIVE],
    ]),
  });
  const repos = {
    asDirectMessagingRepositories: () => memDirect.repositories,
    asClubCommunicationRepositories: () => memClub.repositories,
  };
  const memBackend = createTrustedCommunicationBackend({
    client: { from() { return { insert: async () => ({ error: null }) }; } },
    actorParticipantId: alice,
    directApp: memDirect,
    clubApp: memClub,
    repositories: repos,
    membershipReader: memClub.membershipReader,
    idempotencyLedger: createMemoryIdempotencyLedger(),
  });

  const opened = await memBackend.execute(
    COMMUNICATION_TRUSTED_COMMAND.OPEN_OR_RESOLVE_DIRECT,
    { counterpartParticipantId: bob }
  );
  assert.ok(opened.conversation);

  const sent = await memBackend.execute(
    COMMUNICATION_TRUSTED_COMMAND.SEND_DIRECT_MESSAGE,
    {
      conversationId: opened.conversation.conversation.conversationId,
      body: `${COMMUNICATION_SMOKE_FIXTURE_MARKER}hello`,
      idempotencyKey: `${COMMUNICATION_SMOKE_FIXTURE_MARKER}dm-1`,
    }
  );
  assert.ok(sent.message?.messageId || sent.replayed);

  await assert.rejects(
    () =>
      memBackend.execute(COMMUNICATION_TRUSTED_COMMAND.SEND_DIRECT_MESSAGE, {
        conversationId: opened.conversation.conversation.conversationId,
        body: "spoof",
        senderParticipantId: bob,
      }),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER
  );

  const eveBackend = createTrustedCommunicationBackend({
    client: { from() { return {}; } },
    actorParticipantId: eve,
    directApp: memDirect,
    clubApp: memClub,
    repositories: repos,
    membershipReader: memClub.membershipReader,
    idempotencyLedger: createMemoryIdempotencyLedger(),
  });
  await assert.rejects(
    () =>
      eveBackend.execute(COMMUNICATION_TRUSTED_COMMAND.SEND_DIRECT_MESSAGE, {
        conversationId: opened.conversation.conversation.conversationId,
        body: "intruder",
      }),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER ||
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.INACTIVE_PARTICIPANT
  );
});

test("idempotent duplicate handling", async () => {
  const ledger = createMemoryIdempotencyLedger();
  await ledger.record({
    operationType: "send_direct_message",
    idempotencyKey: `${COMMUNICATION_SMOKE_FIXTURE_MARKER}idem`,
    conversationId: "c1",
    resultEntityType: "message",
    resultEntityId: "m1",
  });
  const prior = await ledger.find({
    operationType: "send_direct_message",
    idempotencyKey: `${COMMUNICATION_SMOKE_FIXTURE_MARKER}idem`,
  });
  assert.equal(prior.result_entity_id, "m1");
  assert.equal(ledger.__size(), 1);
});

test("System producer-only; browser invocation denied helper", async () => {
  const calls = [];
  const fakeClient = {
    from(table) {
      calls.push(table);
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        insert: async () => ({ error: null }),
      };
    },
    rpc: async () => ({ data: 1, error: null }),
  };
  const producer = createSystemMessageProducer({
    client: fakeClient,
    idempotencyLedger: createMemoryIdempotencyLedger(),
  });
  assert.equal(producer.producerId, COMMUNICATION_SYSTEM_PRODUCER_ID);
  const result = await producer.produceSystemMessage({
    source: "comms_act_05_smoke",
    recipientParticipantId: "user-r1",
    body: `${COMMUNICATION_SMOKE_FIXTURE_MARKER}sys`,
    idempotencyKey: `${COMMUNICATION_SMOKE_FIXTURE_MARKER}sys-1`,
  });
  assert.equal(result.ok, true);
  assert.equal(result.producerId, COMMUNICATION_SYSTEM_PRODUCER_ID);

  await assert.rejects(
    () =>
      producer.produceSystemMessage({
        source: "comms_act_05_smoke",
        recipientParticipantId: "user-r1",
        body: "x",
        senderParticipantId: "user-r1",
      }),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER
  );

  const sysSrc = fs.readFileSync(
    path.join(root, "api/communication/authorizeSystemProducer.js"),
    "utf8"
  );
  assert.match(sysSrc, /SYSTEM_BROWSER_INVOCATION_DENIED|denyBrowserSystemInvocation/);
});

test("Club member vs manager authorization + inactive/cross-club", async () => {
  const policy = createClubManagerAccessPolicy();
  const memberFacts = {
    isClubManagerOrOwner: false,
    clubRoles: [],
  };
  const managerFacts = {
    isClubManagerOrOwner: true,
    clubRoles: ["club_owner"],
  };

  const memberPin = await policy.evaluate({
    channelKind: CLUB_CHANNEL_KIND.GENERAL,
    action: "PIN",
    externalRoleFacts: memberFacts,
  });
  assert.equal(memberPin.decision, "DENY");

  const managerPin = await policy.evaluate({
    channelKind: CLUB_CHANNEL_KIND.GENERAL,
    action: "PIN",
    externalRoleFacts: managerFacts,
  });
  assert.equal(managerPin.decision, "ALLOW");

  const memberAnnounce = await policy.evaluate({
    channelKind: CLUB_CHANNEL_KIND.ANNOUNCEMENT,
    action: "SEND",
    externalRoleFacts: memberFacts,
  });
  assert.equal(memberAnnounce.decision, "DENY");

  const teamPolicy = createClubManagerTeamAccessPolicy();
  const teamMember = await teamPolicy.canAccessTeamChannel({
    externalRoleFacts: memberFacts,
  });
  assert.equal(teamMember.allowed, false);
  const teamManager = await teamPolicy.canAccessTeamChannel({
    externalRoleFacts: managerFacts,
  });
  assert.equal(teamManager.allowed, true);

  const reader = createMemoryClubMembershipReader([
    ["club-a", "u1", CLUB_MEMBERSHIP_STATUS.ACTIVE],
    ["club-a", "u2", CLUB_MEMBERSHIP_STATUS.REMOVED],
    ["club-b", "u1", CLUB_MEMBERSHIP_STATUS.ACTIVE],
  ]);
  assert.equal((await reader.getMembership("club-a", "u2")).status, "REMOVED");
  assert.equal((await reader.getMembership("club-a", "u3")).status, "NOT_MEMBER");
  assert.equal((await reader.isActiveMember("club-b", "u1")), true);
});

test("Community fail-closed command", async () => {
  const memDirect = createDirectMessagingApplication();
  const memClub = createClubCommunicationApplication();
  const backend = createTrustedCommunicationBackend({
    client: { from() { return {}; } },
    actorParticipantId: "u1",
    directApp: memDirect,
    clubApp: memClub,
    repositories: {
      asDirectMessagingRepositories: () => memDirect.repositories,
      asClubCommunicationRepositories: () => memClub.repositories,
    },
    membershipReader: memClub.membershipReader,
    idempotencyLedger: createMemoryIdempotencyLedger(),
  });
  await assert.rejects(
    () => backend.execute(COMMUNICATION_TRUSTED_COMMAND.COMMUNITY_ANY, {}),
    (err) => err.code === "COMMUNITY_BLOCKED_FAIL_CLOSED"
  );
});

test("runtime provider production wiring — no silent demo fallback", () => {
  const unavailable = resolveCommunicationRuntimeMode({
    env: { PROD: true, MODE: "production", NODE_ENV: "production" },
    productionDependenciesCertified: false,
    activationSnapshot: {
      STAGING_MIGRATION_READY: false,
      PRODUCTION_READY: false,
    },
  });
  assert.equal(unavailable.mode, COMMUNICATION_RUNTIME_MODE.UNAVAILABLE);
  assert.notEqual(unavailable.mode, COMMUNICATION_RUNTIME_MODE.DEMO);

  const stillBlocked = resolveCommunicationRuntimeMode({
    env: { PROD: true, MODE: "production", NODE_ENV: "production" },
    productionDependenciesCertified: true,
    activationSnapshot: {
      STAGING_MIGRATION_READY: false,
      PRODUCTION_READY: false,
    },
  });
  assert.equal(stillBlocked.mode, COMMUNICATION_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(stillBlocked.reason, "ACTIVATION_GATES_BLOCKED");
});

test("HTTP gateway never embeds service role and fails community", async () => {
  const gw = createTrustedBackendHttpMessagingGateway({
    actorParticipantId: "u1",
    getAccessToken: async () => "token",
  });
  assert.equal(gw.getAdapterInfo().secretsInBrowser, false);
  await assert.rejects(() => gw.listCommunityChannels());
  const src = fs.readFileSync(
    path.join(
      root,
      "src/features/communication/trustedBackend/createTrustedBackendHttpMessagingGateway.js"
    ),
    "utf8"
  );
  assert.doesNotMatch(src, /SERVICE_ROLE/);
});

test("typed error mapping + Production ref blocked in preflight", () => {
  const mapped = mapCommunicationHttpError(
    new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
      "spoof"
    )
  );
  assert.equal(mapped.status, 403);

  const preflight = evaluateCommsAct05Preflight({
    repoRoot: root,
    url: `https://${COMMS_STAGING_PROJECT_REF}.supabase.co`,
    targetConfirm: COMMS_STAGING_PROJECT_REF,
    environment: "staging",
  });
  assert.equal(preflight.pass, true, JSON.stringify(preflight.findings, null, 2));
  assert.equal(
    preflight.verdict,
    COMMS_ACT_05_VERDICTS.READY_FOR_STAGING_SMOKE_OWNER_GO
  );
  assert.equal(preflight.remoteMutateAllowed, false);

  const blockedMutate = evaluateCommsAct05Preflight({
    repoRoot: root,
    url: `https://${COMMS_STAGING_PROJECT_REF}.supabase.co`,
    targetConfirm: COMMS_STAGING_PROJECT_REF,
    remoteMutateRequested: true,
    ownerGo: "OWNER GO COMMS-ACT-04",
  });
  assert.equal(blockedMutate.pass, false);
  assert.equal(
    blockedMutate.verdict,
    COMMS_ACT_05_VERDICTS.BLOCKED_REMOTE_MUTATION_WITHOUT_GO
  );

  const prodBlocked = evaluateCommsAct05Preflight({
    repoRoot: root,
    url: `https://${COMMS_PRODUCTION_PROJECT_REF}.supabase.co`,
    targetConfirm: COMMS_STAGING_PROJECT_REF,
  });
  assert.equal(prodBlocked.pass, false);

  const go = evaluateCommsAct05OwnerGoGate({
    ownerGo: COMMUNICATION_TRUSTED_BACKEND_ENV.OWNER_GO_TOKEN,
  });
  assert.equal(go.pass, true);

  const backup = evaluateCommsAct05BackupGate({
    backupEvidence: "ACT-04 only snapshot",
  });
  assert.equal(backup.pass, false);
});

test("realtime remains disabled — no publication SQL added in ACT-05", () => {
  const act05Dir = fs.readdirSync(docsDir);
  for (const name of act05Dir) {
    const fp = path.join(docsDir, name);
    if (!fs.statSync(fp).isFile()) continue;
    if (!name.endsWith(".md") && !name.endsWith(".sql")) continue;
    const text = fs.readFileSync(fp, "utf8");
    assert.doesNotMatch(
      text,
      /alter publication supabase_realtime add/i,
      name
    );
  }
  const cleanup = fs.readFileSync(
    path.join(docsDir, "sql/COMMS_ACT_05_SMOKE_FIXTURES_CLEANUP.sql"),
    "utf8"
  );
  assert.match(cleanup, /COMMS_ACT_05_SMOKE_FIXTURE_/);
  assert.match(cleanup, /expuvcohlcjzvrrauvud/);
});
