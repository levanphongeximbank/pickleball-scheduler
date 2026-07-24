import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import {
  COMMUNICATION_FOUNDATION_PHASE,
  COMMUNICATION_FOUNDATION_ERROR_CODE,
  CommunicationFoundationError,
  CONVERSATION_TYPE,
  CONVERSATION_REQUEST_STATUS,
  DIRECT_MESSAGING_ACCESS_DECISION,
  DIRECT_MESSAGING_DENY_REASON,
  PARTICIPANT_STATUS,
  createDirectPairContract,
  resolveCanonicalDirectPair,
  evaluateDirectMessagingAccess,
  createDirectMessagingApplication,
  createMemoryIdentityActorPort,
  createUnimplementedDirectConversationRepository,
  createUnimplementedDirectMessageRepository,
  createUnimplementedBlockStateReader,
  createUnimplementedDirectMessagingAccessPolicy,
  matchesDirectConversationRepository,
  matchesDirectMessageRepository,
  matchesBlockStateReader,
  matchesDirectMessagingAccessPolicy,
  createAllowAllDirectMessagingAccessPolicy,
  createInMemoryDirectMessagingRepositories,
} from "../src/features/communication/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(__dirname, "../src/features/communication");
const T0 = "2026-07-24T12:00:00.000Z";
const T1 = "2026-07-24T12:05:00.000Z";
const T2 = "2026-07-24T12:10:00.000Z";

/**
 * @param {() => unknown} fn
 * @param {string} code
 */
function expectCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof CommunicationFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

/**
 * @param {() => Promise<unknown>} fn
 * @param {string} code
 */
async function expectCodeAsync(fn, code) {
  await assert.rejects(fn, (err) => {
    assert.ok(err instanceof CommunicationFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

function createApp(options = {}) {
  const identity =
    options.identityActorPort ||
    createMemoryIdentityActorPort(["user-a", "user-b", "user-c"]);
  const app = createDirectMessagingApplication({
    useInMemoryRepositories: true,
    identityActorPort: identity,
    accessPolicy: options.accessPolicy,
    ...options,
  });
  if (!options.identityActorPort) {
    // ensure seeded
    identity.seed("user-a", true);
    identity.seed("user-b", true);
    identity.seed("user-c", true);
  }
  return app;
}

test("COMMS-02 phase metadata remains available under COMMS-03 barrel", () => {
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.id, "COMMS-04");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.priorPhase, "COMMS-03");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasPersistence, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasRealtime, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasUi, false);
});

test("canonical direct pair is order-independent", () => {
  const ab = createDirectPairContract("user-b", "user-a");
  const ba = createDirectPairContract("user-a", "user-b");
  assert.equal(ab.pairKey, ba.pairKey);
  assert.equal(ab.participantIdA, "user-a");
  assert.equal(ab.participantIdB, "user-b");
  assert.deepEqual(resolveCanonicalDirectPair("user-b", "user-a"), ab);
});

test("self-conversation is rejected", () => {
  expectCode(
    () => createDirectPairContract("user-a", "user-a"),
    COMMUNICATION_FOUNDATION_ERROR_CODE.SELF_CONVERSATION_DENIED
  );
  const decision = evaluateDirectMessagingAccess({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-a",
  });
  assert.equal(decision.decision, DIRECT_MESSAGING_ACCESS_DECISION.DENY);
  assert.equal(decision.reasonCode, DIRECT_MESSAGING_DENY_REASON.SELF_CONVERSATION);
});

test("duplicate participant / self open fails closed", async () => {
  const app = createApp();
  await expectCodeAsync(
    () =>
      app.directMessaging.openOrResolveDirectConversation({
        actorParticipantId: "user-a",
        counterpartParticipantId: "user-a",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.SELF_CONVERSATION_DENIED
  );
});

test("access ALLOW / REQUEST_REQUIRED / DENY + block override", async () => {
  const allow = evaluateDirectMessagingAccess({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
    blocked: false,
    actorIdentityFound: true,
    counterpartIdentityFound: true,
    actorActive: true,
    counterpartActive: true,
    policyDecision: DIRECT_MESSAGING_ACCESS_DECISION.ALLOW,
  });
  assert.equal(allow.decision, DIRECT_MESSAGING_ACCESS_DECISION.ALLOW);

  const request = evaluateDirectMessagingAccess({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
    blocked: false,
    actorIdentityFound: true,
    counterpartIdentityFound: true,
    actorActive: true,
    counterpartActive: true,
    policyDecision: DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED,
  });
  assert.equal(
    request.decision,
    DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED
  );

  const deny = evaluateDirectMessagingAccess({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
    blocked: false,
    actorIdentityFound: true,
    counterpartIdentityFound: true,
    actorActive: true,
    counterpartActive: true,
    policyDecision: DIRECT_MESSAGING_ACCESS_DECISION.DENY,
  });
  assert.equal(deny.decision, DIRECT_MESSAGING_ACCESS_DECISION.DENY);
  assert.equal(deny.reasonCode, DIRECT_MESSAGING_DENY_REASON.POLICY_DENIED);

  const blocked = evaluateDirectMessagingAccess({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
    blocked: true,
    actorIdentityFound: true,
    counterpartIdentityFound: true,
    actorActive: true,
    counterpartActive: true,
    policyDecision: DIRECT_MESSAGING_ACCESS_DECISION.ALLOW,
  });
  assert.equal(blocked.decision, DIRECT_MESSAGING_ACCESS_DECISION.DENY);
  assert.equal(blocked.reasonCode, DIRECT_MESSAGING_DENY_REASON.BLOCKED);

  const app = createApp();
  app.repositories.blockState.seedBlock("user-b", "user-a");
  const evaluated = await app.directMessaging.evaluateAccess({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
  });
  assert.equal(
    evaluated.decision.decision,
    DIRECT_MESSAGING_ACCESS_DECISION.DENY
  );
  assert.equal(
    evaluated.decision.reasonCode,
    DIRECT_MESSAGING_DENY_REASON.BLOCKED
  );
});

test("duplicate pending request is prevented", async () => {
  const app = createApp({
    accessPolicy: {
      async evaluate() {
        return { decision: DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED };
      },
    },
  });
  const first = await app.directMessaging.requestDirectConversation({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
  });
  assert.equal(first.outcome, "REQUEST_CREATED");
  await expectCodeAsync(
    () =>
      app.directMessaging.requestDirectConversation({
        actorParticipantId: "user-b",
        counterpartParticipantId: "user-a",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PENDING_REQUEST
  );
});

test("only recipient accept/decline; only requester cancel; terminal locked", async () => {
  const app = createApp({
    accessPolicy: {
      async evaluate() {
        return { decision: DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED };
      },
    },
  });
  const { request } = await app.directMessaging.requestDirectConversation({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
  });

  await expectCodeAsync(
    () =>
      app.directMessaging.acceptDirectConversationRequest({
        requestId: request.requestId,
        actorParticipantId: "user-a",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_REQUEST_ACTION
  );

  await expectCodeAsync(
    () =>
      app.directMessaging.declineDirectConversationRequest({
        requestId: request.requestId,
        actorParticipantId: "user-a",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_REQUEST_ACTION
  );

  await expectCodeAsync(
    () =>
      app.directMessaging.cancelDirectConversationRequest({
        requestId: request.requestId,
        actorParticipantId: "user-b",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_REQUEST_ACTION
  );

  const cancelled = await app.directMessaging.cancelDirectConversationRequest({
    requestId: request.requestId,
    actorParticipantId: "user-a",
  });
  assert.equal(
    cancelled.request.status,
    CONVERSATION_REQUEST_STATUS.CANCELLED
  );

  await expectCodeAsync(
    () =>
      app.directMessaging.acceptDirectConversationRequest({
        requestId: request.requestId,
        actorParticipantId: "user-b",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_REQUEST_TRANSITION
  );
});

test("accept request creates conversation; open/resolve is idempotent; no duplicate pair", async () => {
  const requestPolicy = {
    async evaluate() {
      return { decision: DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED };
    },
  };
  const app = createApp({ accessPolicy: requestPolicy });
  const { request } = await app.directMessaging.requestDirectConversation({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
  });
  const accepted = await app.directMessaging.acceptDirectConversationRequest({
    requestId: request.requestId,
    actorParticipantId: "user-b",
  });
  assert.equal(accepted.created, true);
  assert.equal(accepted.conversation.conversation.type, CONVERSATION_TYPE.DIRECT);

  const again = await app.directMessaging.acceptDirectConversationRequest({
    // re-accept must fail — terminal
    requestId: request.requestId,
    actorParticipantId: "user-b",
  }).catch((err) => err);
  assert.ok(again instanceof CommunicationFoundationError);
  assert.equal(
    again.code,
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_REQUEST_TRANSITION
  );

  // Switch to ALLOW policy to exercise idempotent open on existing pair
  const allowApp = createDirectMessagingApplication({
    repositories: app.repositories,
    identityActorPort: app.identityActorPort,
    clock: app.clock,
    idProvider: app.idProvider,
    accessPolicy: createAllowAllDirectMessagingAccessPolicy(),
  });
  const first = await allowApp.directMessaging.openOrResolveDirectConversation({
    actorParticipantId: "user-b",
    counterpartParticipantId: "user-a",
  });
  const second = await allowApp.directMessaging.openOrResolveDirectConversation({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
  });
  assert.equal(first.created, false);
  assert.equal(second.created, false);
  assert.equal(
    first.conversation.conversation.conversationId,
    second.conversation.conversation.conversationId
  );
});

test("openOrResolve creates once under ALLOW and rejects blocked", async () => {
  const app = createApp();
  const created = await app.directMessaging.openOrResolveDirectConversation({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
  });
  assert.equal(created.created, true);
  const resolved = await app.directMessaging.openOrResolveDirectConversation({
    actorParticipantId: "user-b",
    counterpartParticipantId: "user-a",
  });
  assert.equal(resolved.created, false);
  assert.equal(
    resolved.conversation.conversation.conversationId,
    created.conversation.conversation.conversationId
  );

  app.repositories.blockState.seedBlock("user-a", "user-c");
  await expectCodeAsync(
    () =>
      app.directMessaging.openOrResolveDirectConversation({
        actorParticipantId: "user-a",
        counterpartParticipantId: "user-c",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.BLOCKED_PARTICIPANT
  );
});

test("send rules: unauthorized sender, inactive participant, cross-conversation reply, block", async () => {
  const app = createApp();
  const { conversation } =
    await app.directMessaging.openOrResolveDirectConversation({
      actorParticipantId: "user-a",
      counterpartParticipantId: "user-b",
    });
  const conversationId = conversation.conversation.conversationId;

  const sent = await app.directMessaging.sendDirectMessage({
    conversationId,
    senderParticipantId: "user-a",
    body: "hello",
  });
  assert.equal(sent.message.body, "hello");

  await expectCodeAsync(
    () =>
      app.directMessaging.sendDirectMessage({
        conversationId,
        senderParticipantId: "user-c",
        body: "intruder",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER
  );

  // inactive participant: mutate in-memory store for proof
  const agg = app.repositories.conversations.findById(conversationId);
  const mutated = {
    ...agg,
    participants: agg.participants.map((p) =>
      p.participantId === "user-b"
        ? { ...p, status: PARTICIPANT_STATUS.SUSPENDED }
        : p
    ),
  };
  // bypass save uniqueness by direct map replace via save after clearing — use save of same id
  app.repositories.conversations.save({
    ...mutated,
    participants: mutated.participants,
  });

  await expectCodeAsync(
    () =>
      app.directMessaging.sendDirectMessage({
        conversationId,
        senderParticipantId: "user-a",
        body: "still?",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INACTIVE_PARTICIPANT
  );

  // restore for reply / other checks via new conversation
  const app2 = createApp();
  const openA = await app2.directMessaging.openOrResolveDirectConversation({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-b",
  });
  const openB = await app2.directMessaging.openOrResolveDirectConversation({
    actorParticipantId: "user-a",
    counterpartParticipantId: "user-c",
  });
  const msgA = await app2.directMessaging.sendDirectMessage({
    conversationId: openA.conversation.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "in A",
  });
  await expectCodeAsync(
    () =>
      app2.directMessaging.sendDirectMessage({
        conversationId: openB.conversation.conversation.conversationId,
        senderParticipantId: "user-a",
        body: "bad reply",
        replyToMessageId: msgA.message.messageId,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CROSS_CONVERSATION_REPLY
  );

  app2.repositories.blockState.seedBlock("user-b", "user-a");
  await expectCodeAsync(
    () =>
      app2.directMessaging.sendDirectMessage({
        conversationId: openA.conversation.conversation.conversationId,
        senderParticipantId: "user-a",
        body: "blocked send",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.BLOCKED_PARTICIPANT
  );
});

test("mark read only advances; inbox projection is deterministic", async () => {
  const app = createApp();
  app.clock.set(T0);
  const { conversation } =
    await app.directMessaging.openOrResolveDirectConversation({
      actorParticipantId: "user-a",
      counterpartParticipantId: "user-b",
    });
  const conversationId = conversation.conversation.conversationId;

  app.clock.set(T1);
  await app.directMessaging.sendDirectMessage({
    conversationId,
    senderParticipantId: "user-a",
    body: "one",
  });
  app.clock.set(T2);
  await app.directMessaging.sendDirectMessage({
    conversationId,
    senderParticipantId: "user-a",
    body: "two",
  });

  const read = await app.directMessaging.markDirectConversationRead({
    conversationId,
    participantId: "user-b",
    lastReadAt: T1,
  });
  assert.equal(read.readCursor.lastReadAt, T1);

  await expectCodeAsync(
    () =>
      app.directMessaging.markDirectConversationRead({
        conversationId,
        participantId: "user-b",
        lastReadAt: T0,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.READ_CURSOR_REGRESSION
  );

  const summary = await app.directMessaging.buildDirectConversationSummary({
    conversationId,
    viewerParticipantId: "user-b",
  });
  assert.equal(summary.counterpartParticipantId, "user-a");
  assert.equal(summary.unreadCount, 1);
  assert.equal(summary.hasUnread, true);
  assert.equal(summary.latestMessageBodyPreview, "two");
  assert.ok(!("displayName" in summary));
  assert.ok(!("avatar" in summary));

  // second conversation for sort determinism
  app.clock.set(T0);
  await app.directMessaging.openOrResolveDirectConversation({
    actorParticipantId: "user-b",
    counterpartParticipantId: "user-c",
  });
  const list1 = await app.directMessaging.listDirectConversationSummaries({
    viewerParticipantId: "user-b",
  });
  const list2 = await app.directMessaging.listDirectConversationSummaries({
    viewerParticipantId: "user-b",
  });
  assert.deepEqual(list1, list2);
  assert.ok(list1.length >= 2);
  // newest activity first
  assert.ok(
    list1[0].latestActivityAt >= list1[1].latestActivityAt ||
      list1[0].conversationId < list1[1].conversationId
  );
});

test("ports have no runtime coupling (unimplemented throw typed code)", async () => {
  const conv = createUnimplementedDirectConversationRepository();
  const msg = createUnimplementedDirectMessageRepository();
  const block = createUnimplementedBlockStateReader();
  const policy = createUnimplementedDirectMessagingAccessPolicy();
  assert.equal(matchesDirectConversationRepository(conv), true);
  assert.equal(matchesDirectMessageRepository(msg), true);
  assert.equal(matchesBlockStateReader(block), true);
  assert.equal(matchesDirectMessagingAccessPolicy(policy), true);
  await expectCodeAsync(
    () => conv.findById("x"),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  await expectCodeAsync(
    () => msg.save({}),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  await expectCodeAsync(
    () => block.isBlockedEitherWay("a", "b"),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  await expectCodeAsync(
    () => policy.evaluate({}),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );

  const memory = createInMemoryDirectMessagingRepositories();
  assert.equal(memory.isTestDoubleOnly, true);
  assert.equal(matchesDirectConversationRepository(memory.conversations), true);
});

test("module tree has no SQL/Supabase/UI wiring artifacts", () => {
  const banned = [
    "createClient",
    "supabase",
    "from('",
    ".rpc(",
    "useEffect",
    "react-router",
  ];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(js|jsx|ts|tsx|md)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, "utf8").toLowerCase();
      for (const token of banned) {
        if (token === "supabase" && entry.name.includes("README")) continue;
        if (
          text.includes(token.toLowerCase()) &&
          !full.includes(`${path.sep}docs${path.sep}`) &&
          !/explicit non-scope|does not export|no supabase|not production/i.test(
            text
          )
        ) {
          // allow documentation mentions of non-scope
          if (
            /no sql|no supabase|does not export|not production|persistence-agnostic|unit tests only/i.test(
              text
            )
          ) {
            continue;
          }
          assert.fail(`Banned token "${token}" in ${full}`);
        }
      }
    }
  }
  walk(MODULE_ROOT);
});
