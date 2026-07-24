/**
 * Production-oriented Communication Experience Gateway (COMMS-07).
 *
 * Composes COMMS-02/03/04 application services + COMMS-05 persistence/realtime
 * via dependency injection. Does NOT create a Supabase singleton.
 * Does NOT call Notification delivery.
 * Does NOT mutate Club/Community membership SoT.
 *
 * When remote activation is blocked and composition is not explicitly allowed,
 * factory throws COMMUNICATION_RUNTIME_NOT_ACTIVATED (no demo fallback).
 */

import {
  createFixedClock,
  createSequentialIdProvider,
} from "../application/createDirectMessagingApplication.js";
import { CLUB_MEMBERSHIP_STATUS } from "../constants/clubMembershipStatus.js";
import { COMMUNITY_MEMBERSHIP_STATUS } from "../constants/communityMembershipStatus.js";
import { CONVERSATION_REQUEST_STATUS } from "../constants/conversationRequestStatus.js";
import { DIRECT_MESSAGING_ACCESS_DECISION } from "../constants/directMessagingAccess.js";
import { createUserBlockContract } from "../contracts/userBlock.js";
import { createMessageReportContract } from "../contracts/messageReport.js";
import { evaluateCommunitySlowMode } from "../contracts/communitySlowMode.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import { getCommunicationActivationSnapshot } from "../persistence/activationGates.js";
import { createInMemoryRealtimeDeliveryAdapter } from "../persistence/realtime/createRealtimeDeliveryAdapter.js";
import { matchesCommunicationExperienceGateway } from "../experience/gatewayPort.js";
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
} from "../experience/viewModels.js";
import { PRODUCTION_GATEWAY_MARKER } from "./constants.js";
import {
  createRuntimeNotActivatedError,
  createSafeCommunicationDiagnosticEvent,
  mapToCommunicationExperienceError,
} from "./experienceErrors.js";

/**
 * @param {object} options
 */
function assertProductionCompositionAllowed(options) {
  const activation =
    options.activationSnapshot || getCommunicationActivationSnapshot();
  const remoteReady =
    activation.STAGING_MIGRATION_READY === true ||
    activation.PRODUCTION_READY === true;
  if (remoteReady) return;
  if (options.allowUnactivatedComposition === true) return;
  throw createRuntimeNotActivatedError(options.correlationId || null);
}

/**
 * Safe profile projection — never email/phone by default.
 * @param {object|null|undefined} snapshot
 * @param {string} participantId
 */
function toSafeProfile(snapshot, participantId) {
  const id = String(participantId);
  if (!snapshot || typeof snapshot !== "object") {
    return createParticipantProjectionVm({
      participantId: id,
      displayName: id,
      avatarUrl: null,
    });
  }
  return createParticipantProjectionVm({
    participantId: id,
    displayName:
      snapshot.displayName ||
      snapshot.name ||
      snapshot.fullName ||
      id,
    avatarUrl: snapshot.avatarUrl || snapshot.avatar || null,
  });
}

/**
 * @param {object} options
 * @returns {object}
 */
export function createProductionMessagingExperienceGateway(options = {}) {
  assertProductionCompositionAllowed(options);

  const actorParticipantId = String(options.actorParticipantId || "").trim();
  if (!actorParticipantId) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE,
      "Authenticated actor is required for production messaging gateway",
      { experienceCode: "COMMUNICATION_EXPERIENCE_UNAUTHORIZED" }
    );
  }

  const tenantId = options.tenantId ? String(options.tenantId) : null;
  const clubId = options.clubId ? String(options.clubId) : null;
  const correlationId = options.correlationId
    ? String(options.correlationId)
    : null;

  const clock = options.clock || createFixedClock(new Date().toISOString());
  const idProvider =
    options.idProvider || createSequentialIdProvider("comms07");

  const dm = options.directMessaging || options.directApp?.directMessaging;
  const club = options.clubCommunication || options.clubApp?.clubCommunication;
  const community =
    options.communityCommunication ||
    options.communityApp?.communityCommunication;
  const dmRepos =
    options.directRepositories || options.directApp?.repositories || null;
  const clubRepos =
    options.clubRepositories || options.clubApp?.repositories || null;
  const communityRepos =
    options.communityRepositories ||
    options.communityApp?.repositories ||
    null;

  if (!dm || !club || !community) {
    throw createRuntimeNotActivatedError(correlationId);
  }

  const playerDisplayPort = options.playerDisplayPort || null;
  const identityActorPort = options.identityActorPort || null;
  const clubMembershipReader = options.clubMembershipReader || null;
  const communityMembershipReader = options.communityMembershipReader || null;

  /** @type {Map<string, object>} */
  const profileCache = new Map();
  /** @type {Map<string, object>} */
  const directReports = new Map();
  /** @type {Map<string, object>} */
  const blocks = new Map();
  /** @type {Map<string, { lastSentAt: string|number }>} */
  const lastSendByConversation = new Map();
  /** @type {Map<string, { unsubscribe: Function }>} */
  const activeSubscriptions = new Map();
  /** @type {Set<string>} */
  const seenRealtimeEventIds = new Set();
  /** @type {object[]} */
  const diagnostics = [];

  const realtime =
    options.realtimeAdapter ||
    createInMemoryRealtimeDeliveryAdapter({
      authorizeSubscribe: async (conversationId, actorId) => {
        if (String(actorId) !== actorParticipantId) return false;
        if (!conversationId) return false;
        return true;
      },
      idProvider,
      clock,
    });

  function recordDiagnostic(partial) {
    const event = createSafeCommunicationDiagnosticEvent({
      ...partial,
      correlationId,
    });
    diagnostics.push(event);
    if (typeof options.onDiagnostic === "function") {
      options.onDiagnostic(event);
    }
    return event;
  }

  async function assertActorActive() {
    if (!identityActorPort || typeof identityActorPort.resolveActor !== "function") {
      return;
    }
    const actor = await identityActorPort.resolveActor(actorParticipantId);
    if (!actor || actor.accountStatus !== "ACTIVE") {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE,
        "Authenticated actor is inactive or missing",
        { participantId: actorParticipantId }
      );
    }
  }

  /**
   * Actor authority is gateway-bound — UI-supplied actorId is ignored.
   * @param {object} [input]
   */
  function resolveTrustedActor(input = {}) {
    if (
      input.actorParticipantId != null &&
      String(input.actorParticipantId) !== actorParticipantId
    ) {
      recordDiagnostic({
        code: "ACTOR_OVERRIDE_REJECTED",
        experienceCode: "COMMUNICATION_EXPERIENCE_UNAUTHORIZED",
        operation: "resolveTrustedActor",
      });
    }
    return actorParticipantId;
  }

  async function resolveProfile(participantId) {
    const id = String(participantId);
    if (profileCache.has(id)) return profileCache.get(id);
    let snapshot = null;
    if (playerDisplayPort && typeof playerDisplayPort.getDisplaySnapshot === "function") {
      try {
        snapshot = await playerDisplayPort.getDisplaySnapshot(id);
      } catch {
        snapshot = null;
      }
    }
    const vm = toSafeProfile(snapshot, id);
    profileCache.set(id, vm);
    return vm;
  }

  async function assertClubMembershipAvailable() {
    if (!clubId) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ID_REQUIRED,
        "Trusted club context is required",
        {}
      );
    }
    if (
      !clubMembershipReader ||
      typeof clubMembershipReader.getMembership !== "function"
    ) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
        "Club membership reader unavailable — fail-closed",
        { clubId }
      );
    }
    const membership = await clubMembershipReader.getMembership(
      clubId,
      actorParticipantId
    );
    if (
      !membership ||
      membership.status !== CLUB_MEMBERSHIP_STATUS.ACTIVE
    ) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
        "Club membership evidence missing — fail-closed",
        {
          clubId,
          participantId: actorParticipantId,
          status: membership?.status || null,
        }
      );
    }
    return membership;
  }

  async function assertCommunityAccessAvailable() {
    if (!tenantId) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.TENANT_ID_REQUIRED,
        "Trusted tenant context is required",
        {}
      );
    }
    if (
      !communityMembershipReader ||
      typeof communityMembershipReader.getMembership !== "function"
    ) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_MEMBERSHIP_DENIED,
        "Community membership reader unavailable — fail-closed",
        { tenantId }
      );
    }
    const membership = await communityMembershipReader.getMembership(
      tenantId,
      actorParticipantId
    );
    if (
      !membership ||
      membership.status !== COMMUNITY_MEMBERSHIP_STATUS.ACTIVE
    ) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_MEMBERSHIP_DENIED,
        "Community access evidence missing — fail-closed",
        {
          tenantId,
          participantId: actorParticipantId,
          status: membership?.status || null,
        }
      );
    }
    return membership;
  }

  async function resolveScope(conversationId) {
    if (dmRepos?.conversations?.findById) {
      const row = await dmRepos.conversations.findById(conversationId);
      if (row) return { scope: "DIRECT", row };
    }
    if (clubRepos?.channels?.findById) {
      const row = await clubRepos.channels.findById(conversationId);
      if (row) return { scope: "CLUB", row };
    }
    if (communityRepos?.channels?.findById) {
      const row = await communityRepos.channels.findById(conversationId);
      if (row) return { scope: "COMMUNITY", row };
    }
    return { scope: null, row: null };
  }

  async function signal(conversationId, eventType, payload = {}) {
    if (!realtime || typeof realtime.publishConversationEvent !== "function") {
      return;
    }
    await realtime.publishConversationEvent(conversationId, {
      eventType,
      tenantId,
      clubId,
      payload,
    });
  }

  async function wrap(operation, fn) {
    try {
      await assertActorActive();
      return await fn();
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        String(err.code).startsWith("COMMUNICATION_EXPERIENCE_")
      ) {
        throw err;
      }
      if (
        err &&
        typeof err === "object" &&
        err.code === "COMMUNICATION_RUNTIME_NOT_ACTIVATED"
      ) {
        throw err;
      }
      throw mapToCommunicationExperienceError(err, {
        operation,
        correlationId,
      });
    }
  }

  function enrichClubVm(summary) {
    return createClubChannelListItemVm(summary);
  }

  function enrichCommunityVm(summary) {
    return createCommunityChannelListItemVm(summary);
  }

  const gateway = {
    getAdapterInfo() {
      return Object.freeze({
        ...PRODUCTION_GATEWAY_MARKER,
        correlationId,
        hasRealtimeAdapter: Boolean(realtime),
        remoteActivation:
          options.activationSnapshot || getCommunicationActivationSnapshot(),
      });
    },

    getViewerContext() {
      return Object.freeze({
        viewerParticipantId: actorParticipantId,
        clubId,
        tenantId,
        profile: profileCache.get(actorParticipantId) || null,
      });
    },

    async getUnreadBadge() {
      return wrap("getUnreadBadge", async () => {
        const directs = await dm.listDirectConversationSummaries({
          viewerParticipantId: actorParticipantId,
        });
        let clubUnread = 0;
        let communityUnread = 0;
        if (clubId && clubMembershipReader) {
          try {
            await assertClubMembershipAvailable();
            const clubs = await club.listClubChannelSummaries({
              clubId,
              viewerParticipantId: actorParticipantId,
            });
            clubUnread = clubs.reduce((n, s) => n + (s.unreadCount || 0), 0);
          } catch {
            clubUnread = 0;
          }
        }
        if (tenantId && communityMembershipReader) {
          try {
            await assertCommunityAccessAvailable();
            const communities = await community.listCommunityChannelSummaries({
              tenantId,
              viewerParticipantId: actorParticipantId,
            });
            communityUnread = communities.reduce(
              (n, s) => n + (s.unreadCount || 0),
              0
            );
          } catch {
            communityUnread = 0;
          }
        }
        const requests = await gateway.listDirectRequests();
        const badge = createUnreadBadgeVm({
          direct: directs.reduce((n, s) => n + (s.unreadCount || 0), 0),
          club: clubUnread,
          community: communityUnread,
          requests: requests.filter((r) => r.direction === "INCOMING").length,
        });
        assertNotRawPersistenceRow(badge);
        return badge;
      });
    },

    async listDirectConversations() {
      return wrap("listDirectConversations", async () => {
        resolveTrustedActor();
        const summaries = await dm.listDirectConversationSummaries({
          viewerParticipantId: actorParticipantId,
        });
        const rows = [];
        for (const s of summaries) {
          const vm = createDirectConversationListItemVm(
            s,
            await resolveProfile(s.counterpartParticipantId)
          );
          assertNotRawPersistenceRow(vm);
          rows.push(vm);
        }
        return rows;
      });
    },

    async listDirectRequests() {
      return wrap("listDirectRequests", async () => {
        resolveTrustedActor();
        const all =
          typeof dmRepos?.requests?.listAll === "function"
            ? dmRepos.requests.listAll()
            : typeof dm.listDirectConversationRequests === "function"
              ? await dm.listDirectConversationRequests({
                  viewerParticipantId: actorParticipantId,
                })
              : [];
        const list = Array.isArray(all) ? all : [];
        const rows = [];
        for (const r of list) {
          if (r.status !== CONVERSATION_REQUEST_STATUS.PENDING) continue;
          if (
            r.requesterParticipantId !== actorParticipantId &&
            r.recipientParticipantId !== actorParticipantId
          ) {
            continue;
          }
          const counterpartId =
            r.requesterParticipantId === actorParticipantId
              ? r.recipientParticipantId
              : r.requesterParticipantId;
          const vm = createDirectRequestListItemVm(
            { ...r, viewerParticipantId: actorParticipantId },
            await resolveProfile(counterpartId)
          );
          assertNotRawPersistenceRow(vm);
          rows.push(vm);
        }
        return rows;
      });
    },

    async listClubChannels() {
      return wrap("listClubChannels", async () => {
        resolveTrustedActor();
        await assertClubMembershipAvailable();
        const summaries = await club.listClubChannelSummaries({
          clubId,
          viewerParticipantId: actorParticipantId,
        });
        return summaries.map((s) => {
          const vm = enrichClubVm(s);
          assertNotRawPersistenceRow(vm);
          return vm;
        });
      });
    },

    async listCommunityChannels() {
      return wrap("listCommunityChannels", async () => {
        resolveTrustedActor();
        await assertCommunityAccessAvailable();
        const summaries = await community.listCommunityChannelSummaries({
          tenantId,
          viewerParticipantId: actorParticipantId,
        });
        return summaries.map((s) => {
          const vm = enrichCommunityVm(s);
          assertNotRawPersistenceRow(vm);
          return vm;
        });
      });
    },

    async loadMessages({ conversationId, scope } = {}) {
      return wrap("loadMessages", async () => {
        resolveTrustedActor();
        const effectiveScope =
          scope || (await resolveScope(conversationId)).scope;
        let messages;
        let pinnedMessageIds = [];
        if (effectiveScope === "DIRECT") {
          messages = await dmRepos.messages.listByConversationId(conversationId);
        } else if (effectiveScope === "CLUB") {
          await assertClubMembershipAvailable();
          messages = await clubRepos.messages.listByConversationId(
            conversationId
          );
          const pins = await clubRepos.pins.listByConversationId(conversationId);
          pinnedMessageIds = pins.map((p) => p.messageId);
        } else if (effectiveScope === "COMMUNITY") {
          await assertCommunityAccessAvailable();
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
        const rows = [];
        for (const m of messages) {
          const reply = m.replyToMessageId
            ? byId.get(m.replyToMessageId)
            : null;
          const vm = createMessageItemVm(
            { ...m, replyPreview: reply?.body || null },
            {
              viewerParticipantId: actorParticipantId,
              pinnedMessageIds,
              sender: await resolveProfile(m.senderParticipantId),
            }
          );
          assertNotRawPersistenceRow(vm);
          rows.push(vm);
        }
        return Object.freeze(rows);
      });
    },

    async sendMessage(input = {}) {
      return wrap("sendMessage", async () => {
        const actorId = resolveTrustedActor(input);
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
            senderParticipantId: actorId,
            body: validation.body,
            replyToMessageId: input.replyToMessageId,
          });
        } else if (scope === "CLUB") {
          await assertClubMembershipAvailable();
          result = await club.sendClubMessage({
            conversationId: input.conversationId,
            senderParticipantId: actorId,
            body: validation.body,
            replyToMessageId: input.replyToMessageId,
          });
        } else if (scope === "COMMUNITY") {
          await assertCommunityAccessAvailable();
          result = await community.sendCommunityMessage({
            conversationId: input.conversationId,
            senderParticipantId: actorId,
            body: validation.body,
            replyToMessageId: input.replyToMessageId,
          });
        } else {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.CONVERSATION_NOT_FOUND,
            "Unknown conversation scope",
            { conversationId: input.conversationId }
          );
        }
        lastSendByConversation.set(String(input.conversationId), {
          lastSentAt: clock.now(),
        });
        const message = result.message || result;
        await signal(input.conversationId, "MESSAGE_CREATED", {
          messageId: message.messageId,
        });
        return createMessageItemVm(message, {
          viewerParticipantId: actorId,
          sender: await resolveProfile(actorId),
        });
      });
    },

    async replyMessage(input = {}) {
      return gateway.sendMessage({
        ...input,
        replyToMessageId: input.replyToMessageId || input.parentMessageId,
      });
    },

    async markRead({ conversationId, scope, lastReadMessageId } = {}) {
      return wrap("markRead", async () => {
        const actorId = resolveTrustedActor();
        const effective =
          scope || (await resolveScope(conversationId)).scope;
        if (effective === "DIRECT") {
          await dm.markDirectConversationRead({
            conversationId,
            participantId: actorId,
            lastReadMessageId,
          });
        } else if (effective === "CLUB") {
          await assertClubMembershipAvailable();
          await club.markClubChannelRead({
            conversationId,
            participantId: actorId,
            lastReadMessageId,
          });
        } else if (effective === "COMMUNITY") {
          await assertCommunityAccessAvailable();
          await community.markCommunityChannelRead({
            conversationId,
            participantId: actorId,
            lastReadMessageId,
          });
        }
        await signal(conversationId, "READ_STATE_CHANGED", {});
        return Object.freeze({ ok: true });
      });
    },

    async evaluateDirectAccess({ counterpartParticipantId } = {}) {
      return wrap("evaluateDirectAccess", async () => {
        const result = await dm.evaluateAccess({
          actorParticipantId: resolveTrustedActor(),
          counterpartParticipantId,
        });
        return createAccessDecisionVm(result.decision);
      });
    },

    async openOrResolveDirectConversation({ counterpartParticipantId } = {}) {
      return wrap("openOrResolveDirectConversation", async () => {
        const actorId = resolveTrustedActor();
        const result = await dm.openOrResolveDirectConversation({
          actorParticipantId: actorId,
          counterpartParticipantId,
        });
        const summary = await dm.buildDirectConversationSummary({
          viewerParticipantId: actorId,
          conversationId: result.conversation.conversation.conversationId,
        });
        return createDirectConversationListItemVm(
          summary,
          await resolveProfile(counterpartParticipantId)
        );
      });
    },

    async requestDirectConversation({
      counterpartParticipantId,
      message,
    } = {}) {
      return wrap("requestDirectConversation", async () => {
        const actorId = resolveTrustedActor();
        const result = await dm.requestDirectConversation({
          actorParticipantId: actorId,
          counterpartParticipantId,
          message,
        });
        if (result.request) {
          return createDirectRequestListItemVm(
            { ...result.request, viewerParticipantId: actorId },
            await resolveProfile(counterpartParticipantId)
          );
        }
        if (result.conversation) {
          const summary = await dm.buildDirectConversationSummary({
            viewerParticipantId: actorId,
            conversationId: result.conversation.conversation.conversationId,
          });
          return createDirectConversationListItemVm(
            summary,
            await resolveProfile(counterpartParticipantId)
          );
        }
        return null;
      });
    },

    async acceptDirectRequest({ requestId } = {}) {
      return wrap("acceptDirectRequest", async () => {
        const result = await dm.acceptDirectConversationRequest({
          actorParticipantId: resolveTrustedActor(),
          requestId,
        });
        return Object.freeze({
          requestId: result.request.requestId,
          status: result.request.status,
          conversationId: result.conversation.conversation.conversationId,
        });
      });
    },

    async declineDirectRequest({ requestId } = {}) {
      return wrap("declineDirectRequest", async () => {
        const result = await dm.declineDirectConversationRequest({
          actorParticipantId: resolveTrustedActor(),
          requestId,
        });
        return Object.freeze({
          requestId: result.request.requestId,
          status: result.request.status,
        });
      });
    },

    async cancelDirectRequest({ requestId } = {}) {
      return wrap("cancelDirectRequest", async () => {
        const result = await dm.cancelDirectConversationRequest({
          actorParticipantId: resolveTrustedActor(),
          requestId,
        });
        return Object.freeze({
          requestId: result.request.requestId,
          status: result.request.status,
        });
      });
    },

    async joinCommunityChannel({ conversationId } = {}) {
      return wrap("joinCommunityChannel", async () => {
        await assertCommunityAccessAvailable();
        await community.joinCommunityChannel({
          conversationId,
          participantId: resolveTrustedActor(),
        });
        await signal(conversationId, "PARTICIPANT_CHANGED", {});
        const list = await gateway.listCommunityChannels();
        return list.find((c) => c.conversationId === conversationId) || null;
      });
    },

    async leaveCommunityChannel({ conversationId } = {}) {
      return wrap("leaveCommunityChannel", async () => {
        await assertCommunityAccessAvailable();
        await community.leaveCommunityChannel({
          conversationId,
          participantId: resolveTrustedActor(),
        });
        await signal(conversationId, "PARTICIPANT_CHANGED", {});
        return Object.freeze({ ok: true });
      });
    },

    async blockUser({ counterpartParticipantId, reason } = {}) {
      return wrap("blockUser", async () => {
        const actorId = resolveTrustedActor();
        const block = createUserBlockContract({
          blockId: idProvider.nextId("block"),
          blockerParticipantId: actorId,
          blockedParticipantId: counterpartParticipantId,
          createdAt: clock.now(),
          reason: reason || "user-block",
        });
        if (typeof dmRepos?.blockState?.seedBlock === "function") {
          dmRepos.blockState.seedBlock(actorId, counterpartParticipantId);
        }
        blocks.set(`${actorId}\u0000${counterpartParticipantId}`, block);
        return Object.freeze({
          blockId: block.blockId,
          blockerParticipantId: block.blockerParticipantId,
          blockedParticipantId: block.blockedParticipantId,
          createdAt: block.createdAt,
          reason: block.reason,
        });
      });
    },

    async reportMessage({
      conversationId,
      messageId,
      reason,
      details,
      scope,
    } = {}) {
      return wrap("reportMessage", async () => {
        const actorId = resolveTrustedActor();
        const effective =
          scope || (await resolveScope(conversationId)).scope;
        if (effective === "COMMUNITY") {
          await assertCommunityAccessAvailable();
          const result = await community.reportCommunityMessage({
            conversationId,
            messageId,
            reporterParticipantId: actorId,
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
          reporterParticipantId: actorId,
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
      });
    },

    async pinMessage({ conversationId, messageId, scope } = {}) {
      return wrap("pinMessage", async () => {
        const actorId = resolveTrustedActor();
        const effective =
          scope || (await resolveScope(conversationId)).scope;
        if (effective === "CLUB") {
          await assertClubMembershipAvailable();
          await club.pinClubMessage({
            conversationId,
            messageId,
            actorParticipantId: actorId,
          });
        } else if (effective === "COMMUNITY") {
          await assertCommunityAccessAvailable();
          await community.pinCommunityMessage({
            conversationId,
            messageId,
            actorParticipantId: actorId,
          });
        } else {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.PIN_TARGET_INVALID,
            "Pin không hỗ trợ hội thoại cá nhân",
            { conversationId }
          );
        }
        await signal(conversationId, "PIN_CHANGED", { messageId });
        return Object.freeze({ ok: true, messageId, pinned: true });
      });
    },

    async unpinMessage({ conversationId, messageId, scope } = {}) {
      return wrap("unpinMessage", async () => {
        const actorId = resolveTrustedActor();
        const effective =
          scope || (await resolveScope(conversationId)).scope;
        if (effective === "CLUB") {
          await assertClubMembershipAvailable();
          await club.unpinClubMessage({
            conversationId,
            messageId,
            actorParticipantId: actorId,
          });
        } else if (effective === "COMMUNITY") {
          await assertCommunityAccessAvailable();
          await community.unpinCommunityMessage({
            conversationId,
            messageId,
            actorParticipantId: actorId,
          });
        } else {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.PIN_TARGET_INVALID,
            "Unpin không hỗ trợ hội thoại cá nhân",
            { conversationId }
          );
        }
        await signal(conversationId, "PIN_CHANGED", { messageId });
        return Object.freeze({ ok: true, messageId, pinned: false });
      });
    },

    async hideMessage({ conversationId, messageId } = {}) {
      return wrap("hideMessage", async () => {
        await assertCommunityAccessAvailable();
        await community.hideCommunityMessage({
          conversationId,
          messageId,
          actorParticipantId: resolveTrustedActor(),
        });
        await signal(conversationId, "MESSAGE_HIDDEN", { messageId });
        return Object.freeze({ ok: true, messageId, hidden: true });
      });
    },

    async suspendParticipant({ conversationId, participantId } = {}) {
      return wrap("suspendParticipant", async () => {
        await assertCommunityAccessAvailable();
        await community.suspendCommunityParticipant({
          conversationId,
          participantId,
          actorParticipantId: resolveTrustedActor(),
        });
        await signal(conversationId, "MODERATION_CHANGED", { participantId });
        return Object.freeze({ ok: true, participantId, status: "SUSPENDED" });
      });
    },

    async banParticipant({ conversationId, participantId } = {}) {
      return wrap("banParticipant", async () => {
        await assertCommunityAccessAvailable();
        await community.banCommunityParticipant({
          conversationId,
          participantId,
          actorParticipantId: resolveTrustedActor(),
        });
        await signal(conversationId, "MODERATION_CHANGED", { participantId });
        return Object.freeze({ ok: true, participantId, status: "BANNED" });
      });
    },

    async restoreParticipant({ conversationId, participantId } = {}) {
      return wrap("restoreParticipant", async () => {
        await assertCommunityAccessAvailable();
        await community.restoreCommunityParticipant({
          conversationId,
          participantId,
          actorParticipantId: resolveTrustedActor(),
        });
        await signal(conversationId, "MODERATION_CHANGED", { participantId });
        return Object.freeze({ ok: true, participantId, status: "RESTORED" });
      });
    },

    async getConversationDetails({ conversationId, scope } = {}) {
      return wrap("getConversationDetails", async () => {
        const actorId = resolveTrustedActor();
        const effective =
          scope || (await resolveScope(conversationId)).scope;
        if (effective === "DIRECT") {
          const summary = await dm.buildDirectConversationSummary({
            viewerParticipantId: actorId,
            conversationId,
          });
          const access = await dm.evaluateAccess({
            actorParticipantId: actorId,
            counterpartParticipantId: summary.counterpartParticipantId,
          });
          return Object.freeze({
            scope: "DIRECT",
            conversation: createDirectConversationListItemVm(
              summary,
              await resolveProfile(summary.counterpartParticipantId)
            ),
            access: createAccessDecisionVm(access.decision),
            blocked:
              access.decision?.decision ===
              DIRECT_MESSAGING_ACCESS_DECISION.DENY,
          });
        }
        if (effective === "CLUB") {
          await assertClubMembershipAvailable();
          const list = await gateway.listClubChannels();
          const item = list.find((c) => c.conversationId === conversationId);
          return Object.freeze({
            scope: "CLUB",
            conversation: item,
            clubId,
            membershipNote:
              "Membership do Club Management sở hữu — UI chỉ phản chiếu access state.",
          });
        }
        if (effective === "COMMUNITY") {
          await assertCommunityAccessAvailable();
          const list = await gateway.listCommunityChannels();
          const item = list.find((c) => c.conversationId === conversationId);
          return Object.freeze({
            scope: "COMMUNITY",
            conversation: item,
            tenantId,
            ruleNotice: item?.ruleNotice,
          });
        }
        return null;
      });
    },

    async getSlowModeState({ conversationId } = {}) {
      return wrap("getSlowModeState", async () => {
        await assertCommunityAccessAvailable();
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
      });
    },

    async subscribe({ conversationId, onSignal, tenantId: subTenant, clubId: subClub } = {}) {
      return wrap("subscribe", async () => {
        const id = String(conversationId || "");
        if (!id) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_IDENTIFIER,
            "conversationId required for subscribe",
            {}
          );
        }
        if (subTenant != null && tenantId && String(subTenant) !== String(tenantId)) {
          recordDiagnostic({
            code: "REALTIME_TENANT_MISMATCH",
            experienceCode: "COMMUNICATION_EXPERIENCE_FORBIDDEN",
            operation: "subscribe",
            conversationId: id,
          });
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_TENANT_MISMATCH,
            "Realtime tenant mismatch — fail-closed",
            { conversationId: id }
          );
        }
        if (subClub != null && clubId && String(subClub) !== String(clubId)) {
          recordDiagnostic({
            code: "REALTIME_CLUB_MISMATCH",
            experienceCode: "COMMUNICATION_EXPERIENCE_FORBIDDEN",
            operation: "subscribe",
            conversationId: id,
          });
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_CLUB_MISMATCH,
            "Realtime club mismatch — fail-closed",
            { conversationId: id }
          );
        }

        const previous = activeSubscriptions.get(id);
        if (previous) {
          previous.unsubscribe();
          activeSubscriptions.delete(id);
        }

        if (!realtime || typeof realtime.subscribeConversation !== "function") {
          // Persistence / manual-refresh mode — no remote publication.
          const inert = Object.freeze({
            conversationId: id,
            unsubscribe: () => gateway.unsubscribe({ conversationId: id }),
            manualRefreshOnly: true,
          });
          activeSubscriptions.set(id, { unsubscribe: inert.unsubscribe });
          return inert;
        }

        const sub = await realtime.subscribeConversation(
          id,
          (event) => {
            if (!event || event.signalOnly !== true) {
              recordDiagnostic({
                code: "REALTIME_MALFORMED_EVENT",
                operation: "subscribe",
                conversationId: id,
              });
              return;
            }
            if (
              event.conversationId &&
              String(event.conversationId) !== id
            ) {
              recordDiagnostic({
                code: "REALTIME_OUT_OF_SCOPE",
                operation: "subscribe",
                conversationId: id,
              });
              return;
            }
            if (event.eventId) {
              const key = String(event.eventId);
              if (seenRealtimeEventIds.has(key)) {
                recordDiagnostic({
                  code: "REALTIME_DUPLICATE_SUPPRESSED",
                  operation: "subscribe",
                  conversationId: id,
                });
                return;
              }
              seenRealtimeEventIds.add(key);
            }
            if (typeof onSignal === "function") {
              onSignal({
                signalOnly: true,
                eventType: event.eventType,
                conversationId: id,
                eventId: event.eventId || null,
              });
            }
          },
          {
            actorParticipantId: actorParticipantId,
            tenantId,
            clubId,
          }
        );
        activeSubscriptions.set(id, sub);
        return Object.freeze({
          conversationId: id,
          unsubscribe: () => gateway.unsubscribe({ conversationId: id }),
        });
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

    __production: Object.freeze({
      actorParticipantId,
      tenantId,
      clubId,
      activeSubscriptionCount: () => activeSubscriptions.size,
      getDiagnostics: () => diagnostics.slice(),
      seenEventCount: () => seenRealtimeEventIds.size,
    }),
  };

  // Warm viewer profile (safe identifier fallback).
  void resolveProfile(actorParticipantId);

  if (!matchesCommunicationExperienceGateway(gateway)) {
    throw new Error(
      "Production gateway missing required Communication Experience methods"
    );
  }

  return Object.freeze(gateway);
}
