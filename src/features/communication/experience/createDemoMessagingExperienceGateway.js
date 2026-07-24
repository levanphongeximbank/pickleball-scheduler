/**
 * In-memory / demo Communication Experience Gateway (COMMS-06).
 *
 * NOT a production adapter. Does not connect remote Supabase.
 * Does not apply SQL. Does not enable realtime publication.
 * Realtime subscribe is an in-process signal that UI should reload.
 */

import { createDirectMessagingApplication } from "../application/createDirectMessagingApplication.js";
import { createClubCommunicationApplication } from "../application/createClubCommunicationApplication.js";
import { createCommunityCommunicationApplication } from "../application/createCommunityCommunicationApplication.js";
import { createMemoryClubMembershipReader } from "../application/createClubCommunicationApplication.js";
import { createMemoryCommunityMembershipReader } from "../application/createCommunityCommunicationApplication.js";
import {
  createFixedClock,
  createMemoryIdentityActorPort,
  createSequentialIdProvider,
} from "../application/createDirectMessagingApplication.js";
import { CLUB_CHANNEL_KIND } from "../constants/clubChannelKinds.js";
import { CLUB_MEMBERSHIP_STATUS } from "../constants/clubMembershipStatus.js";
import { COMMUNITY_CHANNEL_KIND } from "../constants/communityChannelKinds.js";
import { COMMUNITY_CHANNEL_VISIBILITY } from "../constants/communityChannelVisibility.js";
import { COMMUNITY_COMMUNICATION_ACCESS_DECISION } from "../constants/communityCommunicationAccess.js";
import { COMMUNITY_MEMBERSHIP_STATUS } from "../constants/communityMembershipStatus.js";
import { CONVERSATION_REQUEST_STATUS } from "../constants/conversationRequestStatus.js";
import { CONVERSATION_STATUS } from "../constants/conversationStatus.js";
import { DIRECT_MESSAGING_ACCESS_DECISION } from "../constants/directMessagingAccess.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import { createUserBlockContract } from "../contracts/userBlock.js";
import { createMessageReportContract } from "../contracts/messageReport.js";
import { evaluateCommunitySlowMode } from "../contracts/communitySlowMode.js";
import { createInMemoryRealtimeDeliveryAdapter } from "../persistence/realtime/createRealtimeDeliveryAdapter.js";
import { DEMO_GATEWAY_MARKER } from "./constants.js";
import { matchesCommunicationExperienceGateway } from "./gatewayPort.js";
import {
  assertNotRawPersistenceRow,
  createAccessDecisionVm,
  createClubChannelListItemVm,
  createCommunityChannelListItemVm,
  createDirectConversationListItemVm,
  createDirectRequestListItemVm,
  createMessageItemVm,
  createParticipantProjectionVm,
  createUnreadBadgeVm,
  validateComposerBody,
} from "./viewModels.js";

const DEFAULT_VIEWER = "viewer-demo";
const DEMO_CLUB_ID = "club-demo-1";
const DEMO_TENANT_ID = "tenant-demo-1";

const REQUEST_REQUIRED_PEERS = new Set(["peer-request", "peer-incoming"]);

/**
 * Demo Direct access policy — exercises ALLOW / REQUEST_REQUIRED / DENY paths.
 */
function createDemoDirectAccessPolicy() {
  return {
    async evaluate({ counterpartParticipantId, actorParticipantId }) {
      if (
        REQUEST_REQUIRED_PEERS.has(String(counterpartParticipantId)) ||
        REQUEST_REQUIRED_PEERS.has(String(actorParticipantId))
      ) {
        return {
          decision: DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED,
          reasonCode: "DEMO_REQUEST_REQUIRED",
        };
      }
      return {
        decision: DIRECT_MESSAGING_ACCESS_DECISION.ALLOW,
        reasonCode: null,
      };
    },
  };
}

/**
 * @param {object} [options]
 */
export function createDemoMessagingExperienceGateway(options = {}) {
  const clock =
    options.clock || createFixedClock("2026-07-24T12:00:00.000Z");
  const idProvider =
    options.idProvider || createSequentialIdProvider("comms06");
  const viewerParticipantId = String(
    options.viewerParticipantId || DEFAULT_VIEWER
  );

  /** @type {Map<string, { displayName: string, avatarUrl?: string|null }>} */
  const profiles = new Map();
  function seedProfile(id, displayName) {
    profiles.set(String(id), {
      displayName: String(displayName),
      avatarUrl: null,
    });
  }
  seedProfile(viewerParticipantId, "Bạn (demo)");
  seedProfile("peer-allow", "Minh Trần");
  seedProfile("peer-request", "Lan Nguyễn");
  seedProfile("peer-denied", "Khách bị chặn");
  seedProfile("peer-incoming", "Hùng Phạm");

  const identity = createMemoryIdentityActorPort([
    viewerParticipantId,
    "peer-allow",
    "peer-request",
    "peer-denied",
    "peer-incoming",
    "mod-demo",
  ]);

  const membershipReader = createMemoryClubMembershipReader([
    [DEMO_CLUB_ID, viewerParticipantId, CLUB_MEMBERSHIP_STATUS.ACTIVE],
  ]);
  const communityMembershipReader = createMemoryCommunityMembershipReader([
    [DEMO_TENANT_ID, viewerParticipantId, COMMUNITY_MEMBERSHIP_STATUS.ACTIVE],
  ]);

  const directApp = createDirectMessagingApplication({
    clock,
    idProvider,
    identityActorPort: identity,
    accessPolicy: createDemoDirectAccessPolicy(),
  });
  const clubApp = createClubCommunicationApplication({
    clock,
    idProvider,
    membershipReader,
  });
  const communityApp = createCommunityCommunicationApplication({
    clock,
    idProvider,
    identityActorPort: identity,
    membershipReader: communityMembershipReader,
  });

  const dm = directApp.directMessaging;
  const club = clubApp.clubCommunication;
  const community = communityApp.communityCommunication;
  const dmRepos = directApp.repositories;
  const clubRepos = clubApp.repositories;
  const communityRepos = communityApp.repositories;

  /** @type {Map<string, object>} */
  const directReports = new Map();
  /** @type {Map<string, object>} */
  const blocks = new Map();
  /** @type {Map<string, { lastSentAt: string|number }>} */
  const lastSendByConversation = new Map();
  /** @type {Map<string, { unsubscribe: Function }>} */
  const activeSubscriptions = new Map();

  const realtime = createInMemoryRealtimeDeliveryAdapter({
    authorizeSubscribe: () => true,
    idProvider,
    clock,
  });

  let seeded = false;
  /** @type {object|null} */
  let seedHandles = null;

  async function ensureSeeded() {
    if (seeded || options.skipSeed) {
      seeded = true;
      return seedHandles;
    }
    seeded = true;

    const opened = await dm.openOrResolveDirectConversation({
      actorParticipantId: viewerParticipantId,
      counterpartParticipantId: "peer-allow",
    });
    const allowConvId = opened.conversation.conversation.conversationId;
    await dm.sendDirectMessage({
      conversationId: allowConvId,
      senderParticipantId: "peer-allow",
      body: "Chào bạn! Đây là hội thoại demo (ALLOW).",
      createdAt: "2026-07-24T12:01:00.000Z",
    });
    await dm.sendDirectMessage({
      conversationId: allowConvId,
      senderParticipantId: viewerParticipantId,
      body: "Xin chào Minh, mình đã nhận tin.",
      createdAt: "2026-07-24T12:02:00.000Z",
    });

    const incoming = await dm.requestDirectConversation({
      actorParticipantId: "peer-incoming",
      counterpartParticipantId: viewerParticipantId,
      message: "Cho mình làm quen nhé?",
    });

    const outgoing = await dm.requestDirectConversation({
      actorParticipantId: viewerParticipantId,
      counterpartParticipantId: "peer-request",
      message: "Xin chào, mình muốn trò chuyện.",
    });

    dmRepos.blockState.seedBlock(viewerParticipantId, "peer-denied");
    blocks.set(
      `${viewerParticipantId}\u0000peer-denied`,
      createUserBlockContract({
        blockId: idProvider.nextId("block"),
        blockerParticipantId: viewerParticipantId,
        blockedParticipantId: "peer-denied",
        createdAt: clock.now(),
        reason: "demo-block",
      })
    );

    const defaults = await club.createOrResolveDefaultClubChannels({
      clubId: DEMO_CLUB_ID,
      actorParticipantId: viewerParticipantId,
    });
    const generalChannel =
      defaults.channels.find((c) => c.channelKind === CLUB_CHANNEL_KIND.GENERAL) ||
      defaults.channels[0];
    const generalId = generalChannel.conversation.conversationId;

    await club.sendClubMessage({
      conversationId: generalId,
      senderParticipantId: viewerParticipantId,
      body: "Thông báo CLB demo: tập tối nay lúc 19:00.",
    });

    const team = await club.createClubChannel({
      clubId: DEMO_CLUB_ID,
      actorParticipantId: viewerParticipantId,
      channelKind: CLUB_CHANNEL_KIND.TEAM,
      name: "Đội A",
    });
    await club.createClubChannel({
      clubId: DEMO_CLUB_ID,
      actorParticipantId: viewerParticipantId,
      channelKind: CLUB_CHANNEL_KIND.PRIVATE,
      name: "Kênh riêng demo",
    });
    await club.createClubChannel({
      clubId: DEMO_CLUB_ID,
      actorParticipantId: viewerParticipantId,
      channelKind: CLUB_CHANNEL_KIND.MANAGEMENT,
      name: "Ban điều hành",
    });

    const lobby = await community.createOrResolveCommunityLobby({
      tenantId: DEMO_TENANT_ID,
      actorParticipantId: viewerParticipantId,
    });
    const lobbyId = lobby.channel.conversation.conversationId;
    await community.joinCommunityChannel({
      conversationId: lobbyId,
      participantId: viewerParticipantId,
    });
    await community.sendCommunityMessage({
      conversationId: lobbyId,
      senderParticipantId: viewerParticipantId,
      body: "Chào mừng đến Community Lobby (demo).",
    });

    const topic = await community.createCommunityChannel({
      tenantId: DEMO_TENANT_ID,
      actorParticipantId: viewerParticipantId,
      channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
      visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
      name: "Chủ đề: Kỹ thuật",
    });
    const topicId = topic.channel.conversation.conversationId;
    await community.joinCommunityChannel({
      conversationId: topicId,
      participantId: viewerParticipantId,
    });

    const joinRequired = await community.createCommunityChannel({
      tenantId: DEMO_TENANT_ID,
      actorParticipantId: viewerParticipantId,
      channelKind: COMMUNITY_CHANNEL_KIND.REGION,
      visibility: COMMUNITY_CHANNEL_VISIBILITY.JOIN_REQUIRED,
      name: "Khu vực Hà Nội",
    });

    const readOnly = await community.createCommunityChannel({
      tenantId: DEMO_TENANT_ID,
      actorParticipantId: viewerParticipantId,
      channelKind: COMMUNITY_CHANNEL_KIND.SUPPORT,
      visibility: COMMUNITY_CHANNEL_VISIBILITY.READ_ONLY,
      name: "Hỗ trợ (chỉ đọc)",
    });

    const slow = await community.createCommunityChannel({
      tenantId: DEMO_TENANT_ID,
      actorParticipantId: viewerParticipantId,
      channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
      visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
      name: "Slow-mode demo",
      slowModeIntervalSeconds: 30,
    });
    const slowModeId = slow.channel.conversation.conversationId;
    await community.joinCommunityChannel({
      conversationId: slowModeId,
      participantId: viewerParticipantId,
    });

    seedHandles = Object.freeze({
      allowConvId,
      generalId,
      teamConversationId: team.channel.conversation.conversationId,
      lobbyId,
      topicId,
      joinRequiredId: joinRequired.channel.conversation.conversationId,
      readOnlyId: readOnly.channel.conversation.conversationId,
      slowModeId,
      incomingRequestId: incoming.request?.requestId ?? null,
      outgoingRequestId: outgoing.request?.requestId ?? null,
    });
    return seedHandles;
  }

  function resolveProfile(participantId) {
    const p = profiles.get(String(participantId));
    return createParticipantProjectionVm({
      participantId,
      displayName: p?.displayName || String(participantId),
      avatarUrl: p?.avatarUrl ?? null,
    });
  }

  function enrichClubVm(summary) {
    const access = String(summary.participantAccessState || "");
    const limited =
      access === PARTICIPANT_STATUS.SUSPENDED ||
      access === PARTICIPANT_STATUS.REMOVED ||
      access === "DENIED";
    const archived = summary.status === CONVERSATION_STATUS.ARCHIVED;
    const active = access === PARTICIPANT_STATUS.ACTIVE;
    const canSend = active && !archived && !limited;
    return createClubChannelListItemVm({
      ...summary,
      archived,
      readOnly: archived || limited,
      canSend,
      canPin: active && !archived,
      canComposeAnnouncement:
        summary.channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT && canSend,
    });
  }

  function enrichCommunityVm(summary) {
    const decision = String(summary.accessDecision || "DENY");
    const visibility = String(summary.visibility || "");
    const readOnly =
      decision === COMMUNITY_COMMUNICATION_ACCESS_DECISION.READ_ONLY ||
      visibility === COMMUNITY_CHANNEL_VISIBILITY.READ_ONLY;
    const allow = decision === COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW;
    const accessState = String(summary.participantAccessState || "");
    const isActiveParticipant = accessState === PARTICIPANT_STATUS.ACTIVE;
    const needsJoin =
      visibility === COMMUNITY_CHANNEL_VISIBILITY.JOIN_REQUIRED &&
      !isActiveParticipant;
    const bannedOrSuspended =
      accessState === PARTICIPANT_STATUS.SUSPENDED ||
      accessState === PARTICIPANT_STATUS.REMOVED ||
      decision === COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY;
    return createCommunityChannelListItemVm({
      ...summary,
      readOnly: readOnly || bannedOrSuspended,
      canSend: (allow || isActiveParticipant) && !readOnly && !bannedOrSuspended && !needsJoin,
      canJoin: needsJoin,
      canLeave: isActiveParticipant,
      canPin: (allow || isActiveParticipant) && !readOnly && !needsJoin,
      canModerate: allow && isActiveParticipant,
      canReport: true,
    });
  }

  async function resolveScope(conversationId) {
    const id = String(conversationId);
    if (await dmRepos.conversations.findById(id)) {
      return { scope: "DIRECT" };
    }
    if (await clubRepos.channels.findById(id)) {
      return { scope: "CLUB" };
    }
    if (await communityRepos.channels.findById(id)) {
      return { scope: "COMMUNITY" };
    }
    return { scope: null };
  }

  async function signal(conversationId, eventType, payload = {}) {
    try {
      await realtime.publishConversationEvent(String(conversationId), {
        eventType,
        payload,
      });
    } catch {
      // Demo signal must not break commands.
    }
  }

  const gateway = {
    getAdapterInfo() {
      return Object.freeze({ ...DEMO_GATEWAY_MARKER });
    },

    getViewerContext() {
      return Object.freeze({
        viewerParticipantId,
        clubId: DEMO_CLUB_ID,
        tenantId: DEMO_TENANT_ID,
        profile: resolveProfile(viewerParticipantId),
      });
    },

    async getUnreadBadge() {
      await ensureSeeded();
      const directs = await dm.listDirectConversationSummaries({
        viewerParticipantId,
      });
      const clubs = await club.listClubChannelSummaries({
        clubId: DEMO_CLUB_ID,
        viewerParticipantId,
      });
      const communities = await community.listCommunityChannelSummaries({
        tenantId: DEMO_TENANT_ID,
        viewerParticipantId,
      });
      const requests = await gateway.listDirectRequests();
      const badge = createUnreadBadgeVm({
        direct: directs.reduce((n, s) => n + (s.unreadCount || 0), 0),
        club: clubs.reduce((n, s) => n + (s.unreadCount || 0), 0),
        community: communities.reduce((n, s) => n + (s.unreadCount || 0), 0),
        requests: requests.filter((r) => r.direction === "INCOMING").length,
      });
      assertNotRawPersistenceRow(badge);
      return badge;
    },

    async listDirectConversations() {
      await ensureSeeded();
      const summaries = await dm.listDirectConversationSummaries({
        viewerParticipantId,
      });
      return summaries.map((s) => {
        const vm = createDirectConversationListItemVm(
          s,
          resolveProfile(s.counterpartParticipantId)
        );
        assertNotRawPersistenceRow(vm);
        return vm;
      });
    },

    async listDirectRequests() {
      await ensureSeeded();
      const all =
        typeof dmRepos.requests.listAll === "function"
          ? dmRepos.requests.listAll()
          : [];
      return all
        .filter((r) => r.status === CONVERSATION_REQUEST_STATUS.PENDING)
        .filter(
          (r) =>
            r.requesterParticipantId === viewerParticipantId ||
            r.recipientParticipantId === viewerParticipantId
        )
        .map((r) => {
          const vm = createDirectRequestListItemVm(
            { ...r, viewerParticipantId },
            resolveProfile(
              r.requesterParticipantId === viewerParticipantId
                ? r.recipientParticipantId
                : r.requesterParticipantId
            )
          );
          assertNotRawPersistenceRow(vm);
          return vm;
        });
    },

    async listClubChannels() {
      await ensureSeeded();
      const summaries = await club.listClubChannelSummaries({
        clubId: DEMO_CLUB_ID,
        viewerParticipantId,
      });
      return summaries.map((s) => {
        const vm = enrichClubVm(s);
        assertNotRawPersistenceRow(vm);
        return vm;
      });
    },

    async listCommunityChannels() {
      await ensureSeeded();
      const summaries = await community.listCommunityChannelSummaries({
        tenantId: DEMO_TENANT_ID,
        viewerParticipantId,
      });
      return summaries.map((s) => {
        const vm = enrichCommunityVm(s);
        assertNotRawPersistenceRow(vm);
        return vm;
      });
    },

    async loadMessages({ conversationId, scope } = {}) {
      await ensureSeeded();
      const effectiveScope =
        scope || (await resolveScope(conversationId)).scope;
      let messages;
      let pinnedMessageIds = [];
      if (effectiveScope === "DIRECT") {
        messages = await dmRepos.messages.listByConversationId(conversationId);
      } else if (effectiveScope === "CLUB") {
        messages = await clubRepos.messages.listByConversationId(conversationId);
        const pins = await clubRepos.pins.listByConversationId(conversationId);
        pinnedMessageIds = pins.map((p) => p.messageId);
      } else if (effectiveScope === "COMMUNITY") {
        messages = await communityRepos.messages.listByConversationId(
          conversationId
        );
        const pins = await communityRepos.pins.listByConversationId(
          conversationId
        );
        pinnedMessageIds = pins.map((p) => p.messageId);
      } else {
        return Object.freeze([]);
      }

      const byId = new Map(messages.map((m) => [m.messageId, m]));
      return Object.freeze(
        messages.map((m) => {
          const reply = m.replyToMessageId
            ? byId.get(m.replyToMessageId)
            : null;
          const vm = createMessageItemVm(
            { ...m, replyPreview: reply?.body || null },
            {
              viewerParticipantId,
              pinnedMessageIds,
              sender: resolveProfile(m.senderParticipantId),
            }
          );
          assertNotRawPersistenceRow(vm);
          return vm;
        })
      );
    },

    async sendMessage(input = {}) {
      await ensureSeeded();
      const validation = validateComposerBody(input.body);
      if (!validation.ok) {
        const err = new Error(validation.error);
        err.code = "COMPOSER_VALIDATION";
        throw err;
      }
      const scope =
        input.scope || (await resolveScope(input.conversationId)).scope;
      let result;
      if (scope === "DIRECT") {
        result = await dm.sendDirectMessage({
          conversationId: input.conversationId,
          senderParticipantId: viewerParticipantId,
          body: validation.body,
          replyToMessageId: input.replyToMessageId,
        });
      } else if (scope === "CLUB") {
        result = await club.sendClubMessage({
          conversationId: input.conversationId,
          senderParticipantId: viewerParticipantId,
          body: validation.body,
          replyToMessageId: input.replyToMessageId,
        });
      } else if (scope === "COMMUNITY") {
        result = await community.sendCommunityMessage({
          conversationId: input.conversationId,
          senderParticipantId: viewerParticipantId,
          body: validation.body,
          replyToMessageId: input.replyToMessageId,
        });
      } else {
        throw new Error("Unknown conversation scope");
      }
      lastSendByConversation.set(String(input.conversationId), {
        lastSentAt: clock.now(),
      });
      const message = result.message || result;
      await signal(input.conversationId, "MESSAGE_CREATED", {
        messageId: message.messageId,
      });
      return createMessageItemVm(message, {
        viewerParticipantId,
        sender: resolveProfile(viewerParticipantId),
      });
    },

    async replyMessage(input = {}) {
      return gateway.sendMessage({
        ...input,
        replyToMessageId: input.replyToMessageId || input.parentMessageId,
      });
    },

    async markRead({ conversationId, scope, lastReadMessageId } = {}) {
      await ensureSeeded();
      const effective =
        scope || (await resolveScope(conversationId)).scope;
      if (effective === "DIRECT") {
        await dm.markDirectConversationRead({
          conversationId,
          participantId: viewerParticipantId,
          lastReadMessageId,
        });
      } else if (effective === "CLUB") {
        await club.markClubChannelRead({
          conversationId,
          participantId: viewerParticipantId,
          lastReadMessageId,
        });
      } else if (effective === "COMMUNITY") {
        await community.markCommunityChannelRead({
          conversationId,
          participantId: viewerParticipantId,
          lastReadMessageId,
        });
      }
      await signal(conversationId, "READ_STATE_CHANGED", {});
      return Object.freeze({ ok: true });
    },

    async evaluateDirectAccess({ counterpartParticipantId } = {}) {
      await ensureSeeded();
      const result = await dm.evaluateAccess({
        actorParticipantId: viewerParticipantId,
        counterpartParticipantId,
      });
      return createAccessDecisionVm(result.decision);
    },

    async openOrResolveDirectConversation({ counterpartParticipantId } = {}) {
      await ensureSeeded();
      const result = await dm.openOrResolveDirectConversation({
        actorParticipantId: viewerParticipantId,
        counterpartParticipantId,
      });
      const summary = await dm.buildDirectConversationSummary({
        viewerParticipantId,
        conversationId: result.conversation.conversation.conversationId,
      });
      return createDirectConversationListItemVm(
        summary,
        resolveProfile(counterpartParticipantId)
      );
    },

    async requestDirectConversation({
      counterpartParticipantId,
      message,
    } = {}) {
      await ensureSeeded();
      const result = await dm.requestDirectConversation({
        actorParticipantId: viewerParticipantId,
        counterpartParticipantId,
        message,
      });
      if (result.request) {
        return createDirectRequestListItemVm(
          { ...result.request, viewerParticipantId },
          resolveProfile(counterpartParticipantId)
        );
      }
      if (result.conversation) {
        const summary = await dm.buildDirectConversationSummary({
          viewerParticipantId,
          conversationId: result.conversation.conversation.conversationId,
        });
        return createDirectConversationListItemVm(
          summary,
          resolveProfile(counterpartParticipantId)
        );
      }
      return null;
    },

    async acceptDirectRequest({ requestId } = {}) {
      await ensureSeeded();
      const result = await dm.acceptDirectConversationRequest({
        actorParticipantId: viewerParticipantId,
        requestId,
      });
      return Object.freeze({
        requestId: result.request.requestId,
        status: result.request.status,
        conversationId: result.conversation.conversation.conversationId,
      });
    },

    async declineDirectRequest({ requestId } = {}) {
      await ensureSeeded();
      const result = await dm.declineDirectConversationRequest({
        actorParticipantId: viewerParticipantId,
        requestId,
      });
      return Object.freeze({
        requestId: result.request.requestId,
        status: result.request.status,
      });
    },

    async cancelDirectRequest({ requestId } = {}) {
      await ensureSeeded();
      const result = await dm.cancelDirectConversationRequest({
        actorParticipantId: viewerParticipantId,
        requestId,
      });
      return Object.freeze({
        requestId: result.request.requestId,
        status: result.request.status,
      });
    },

    async joinCommunityChannel({ conversationId } = {}) {
      await ensureSeeded();
      await community.joinCommunityChannel({
        conversationId,
        participantId: viewerParticipantId,
      });
      await signal(conversationId, "PARTICIPANT_CHANGED", {});
      const list = await gateway.listCommunityChannels();
      return list.find((c) => c.conversationId === conversationId) || null;
    },

    async leaveCommunityChannel({ conversationId } = {}) {
      await ensureSeeded();
      await community.leaveCommunityChannel({
        conversationId,
        participantId: viewerParticipantId,
      });
      await signal(conversationId, "PARTICIPANT_CHANGED", {});
      return Object.freeze({ ok: true });
    },

    async blockUser({ counterpartParticipantId, reason } = {}) {
      await ensureSeeded();
      const block = createUserBlockContract({
        blockId: idProvider.nextId("block"),
        blockerParticipantId: viewerParticipantId,
        blockedParticipantId: counterpartParticipantId,
        createdAt: clock.now(),
        reason: reason || "user-block",
      });
      dmRepos.blockState.seedBlock(
        viewerParticipantId,
        counterpartParticipantId
      );
      blocks.set(
        `${viewerParticipantId}\u0000${counterpartParticipantId}`,
        block
      );
      return Object.freeze({
        blockId: block.blockId,
        blockerParticipantId: block.blockerParticipantId,
        blockedParticipantId: block.blockedParticipantId,
        createdAt: block.createdAt,
        reason: block.reason,
      });
    },

    async reportMessage({
      conversationId,
      messageId,
      reason,
      details,
      scope,
    } = {}) {
      await ensureSeeded();
      const effective =
        scope || (await resolveScope(conversationId)).scope;
      if (effective === "COMMUNITY") {
        const result = await community.reportCommunityMessage({
          conversationId,
          messageId,
          reporterParticipantId: viewerParticipantId,
          reason: reason || "inappropriate",
          details,
        });
        return Object.freeze({
          reportId: result.report.reportId,
          messageId: result.report.messageId,
          conversationId: result.report.conversationId,
          reason: result.report.reason,
        });
      }
      const report = createMessageReportContract({
        reportId: idProvider.nextId("report"),
        messageId,
        conversationId,
        reporterParticipantId: viewerParticipantId,
        reason: reason || "inappropriate",
        createdAt: clock.now(),
        details: details || null,
      });
      directReports.set(report.reportId, report);
      return Object.freeze({
        reportId: report.reportId,
        messageId: report.messageId,
        conversationId: report.conversationId,
        reason: report.reason,
      });
    },

    async pinMessage({ conversationId, messageId, scope } = {}) {
      await ensureSeeded();
      const effective =
        scope || (await resolveScope(conversationId)).scope;
      if (effective === "CLUB") {
        await club.pinClubMessage({
          conversationId,
          messageId,
          actorParticipantId: viewerParticipantId,
        });
      } else if (effective === "COMMUNITY") {
        await community.pinCommunityMessage({
          conversationId,
          messageId,
          actorParticipantId: viewerParticipantId,
        });
      } else {
        throw new Error("Pin không hỗ trợ hội thoại cá nhân trong COMMS-06");
      }
      await signal(conversationId, "PIN_CHANGED", { messageId });
      return Object.freeze({ ok: true, messageId, pinned: true });
    },

    async unpinMessage({ conversationId, messageId, scope } = {}) {
      await ensureSeeded();
      const effective =
        scope || (await resolveScope(conversationId)).scope;
      if (effective === "CLUB") {
        await club.unpinClubMessage({
          conversationId,
          messageId,
          actorParticipantId: viewerParticipantId,
        });
      } else if (effective === "COMMUNITY") {
        await community.unpinCommunityMessage({
          conversationId,
          messageId,
          actorParticipantId: viewerParticipantId,
        });
      }
      await signal(conversationId, "PIN_CHANGED", { messageId });
      return Object.freeze({ ok: true, messageId, pinned: false });
    },

    async hideMessage({ conversationId, messageId } = {}) {
      await ensureSeeded();
      await community.hideCommunityMessage({
        conversationId,
        messageId,
        actorParticipantId: viewerParticipantId,
      });
      await signal(conversationId, "MESSAGE_HIDDEN", { messageId });
      return Object.freeze({ ok: true, messageId, hidden: true });
    },

    async suspendParticipant({ conversationId, participantId } = {}) {
      await ensureSeeded();
      await community.suspendCommunityParticipant({
        conversationId,
        participantId,
        actorParticipantId: viewerParticipantId,
      });
      await signal(conversationId, "MODERATION_CHANGED", { participantId });
      return Object.freeze({ ok: true, participantId, status: "SUSPENDED" });
    },

    async banParticipant({ conversationId, participantId } = {}) {
      await ensureSeeded();
      await community.banCommunityParticipant({
        conversationId,
        participantId,
        actorParticipantId: viewerParticipantId,
      });
      await signal(conversationId, "MODERATION_CHANGED", { participantId });
      return Object.freeze({ ok: true, participantId, status: "BANNED" });
    },

    async restoreParticipant({ conversationId, participantId } = {}) {
      await ensureSeeded();
      await community.restoreCommunityParticipant({
        conversationId,
        participantId,
        actorParticipantId: viewerParticipantId,
      });
      await signal(conversationId, "MODERATION_CHANGED", { participantId });
      return Object.freeze({ ok: true, participantId, status: "RESTORED" });
    },

    async getConversationDetails({ conversationId, scope } = {}) {
      await ensureSeeded();
      const effective =
        scope || (await resolveScope(conversationId)).scope;
      if (effective === "DIRECT") {
        const summary = await dm.buildDirectConversationSummary({
          viewerParticipantId,
          conversationId,
        });
        const access = await dm.evaluateAccess({
          actorParticipantId: viewerParticipantId,
          counterpartParticipantId: summary.counterpartParticipantId,
        });
        return Object.freeze({
          scope: "DIRECT",
          conversation: createDirectConversationListItemVm(
            summary,
            resolveProfile(summary.counterpartParticipantId)
          ),
          access: createAccessDecisionVm(access.decision),
          blocked:
            access.decision?.decision ===
            DIRECT_MESSAGING_ACCESS_DECISION.DENY,
        });
      }
      if (effective === "CLUB") {
        const list = await gateway.listClubChannels();
        const item = list.find((c) => c.conversationId === conversationId);
        return Object.freeze({
          scope: "CLUB",
          conversation: item,
          clubId: DEMO_CLUB_ID,
          membershipNote:
            "Membership do Club Management sở hữu — UI chỉ phản chiếu access state.",
        });
      }
      if (effective === "COMMUNITY") {
        const list = await gateway.listCommunityChannels();
        const item = list.find((c) => c.conversationId === conversationId);
        return Object.freeze({
          scope: "COMMUNITY",
          conversation: item,
          tenantId: DEMO_TENANT_ID,
          ruleNotice: item?.ruleNotice,
        });
      }
      return null;
    },

    async getSlowModeState({ conversationId } = {}) {
      await ensureSeeded();
      const list = await gateway.listCommunityChannels();
      const channel = list.find((c) => c.conversationId === conversationId);
      const interval = channel?.slowModeIntervalSeconds || 0;
      if (!interval) {
        return Object.freeze({
          enabled: false,
          intervalSeconds: 0,
          remainingSeconds: 0,
          canSend: true,
        });
      }
      const last = lastSendByConversation.get(String(conversationId));
      const evaluation = evaluateCommunitySlowMode({
        enabled: true,
        intervalSeconds: interval,
        lastSentAt: last?.lastSentAt ?? null,
        now: clock.now(),
      });
      return Object.freeze({
        enabled: true,
        intervalSeconds: interval,
        remainingSeconds: Number(evaluation.retryAfterSeconds) || 0,
        canSend: evaluation.allowed !== false,
      });
    },

    async subscribe({ conversationId, onSignal } = {}) {
      await ensureSeeded();
      const id = String(conversationId);
      const previous = activeSubscriptions.get(id);
      if (previous) {
        previous.unsubscribe();
        activeSubscriptions.delete(id);
      }
      const sub = await realtime.subscribeConversation(
        id,
        (event) => {
          if (typeof onSignal === "function") {
            onSignal({
              signalOnly: true,
              eventType: event.eventType,
              conversationId: id,
            });
          }
        },
        { actorParticipantId: viewerParticipantId }
      );
      activeSubscriptions.set(id, sub);
      return Object.freeze({
        conversationId: id,
        unsubscribe: () => gateway.unsubscribe({ conversationId: id }),
      });
    },

    async unsubscribe({ conversationId } = {}) {
      const id = String(conversationId || "");
      const sub = activeSubscriptions.get(id);
      if (sub) {
        sub.unsubscribe();
        activeSubscriptions.delete(id);
      }
      return Object.freeze({ ok: true });
    },

    __demo: Object.freeze({
      ensureSeeded,
      getSeedHandles: () => seedHandles,
      dmRepos,
      clubRepos,
      communityRepos,
      clock,
      idProvider,
      activeSubscriptionCount: () => activeSubscriptions.size,
    }),
  };

  if (!matchesCommunicationExperienceGateway(gateway)) {
    throw new Error(
      "Demo gateway missing required Communication Experience methods"
    );
  }

  return Object.freeze(gateway);
}
