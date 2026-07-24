/**
 * Community Communication application service (COMMS-04).
 *
 * Persistence-agnostic command handlers over COMMS-01 contracts.
 * No SQL, Supabase, realtime, notification delivery, or UI.
 * Community / tenant membership remain owned outside Communication.
 */

import { COMMUNITY_CHANNEL_KIND } from "../constants/communityChannelKinds.js";
import { COMMUNITY_CHANNEL_LIFECYCLE } from "../constants/communityChannelLifecycle.js";
import { COMMUNITY_CHANNEL_VISIBILITY } from "../constants/communityChannelVisibility.js";
import {
  COMMUNITY_COMMUNICATION_ACCESS_ACTION,
  COMMUNITY_COMMUNICATION_ACCESS_DECISION,
  COMMUNITY_COMMUNICATION_DENY_REASON,
} from "../constants/communityCommunicationAccess.js";
import { COMMUNITY_MEMBERSHIP_STATUS } from "../constants/communityMembershipStatus.js";
import {
  COMMUNITY_RESTRICTION_SCOPE,
  COMMUNITY_RESTRICTION_STATUS,
} from "../constants/communityRestrictionStatus.js";
import { CONVERSATION_ROLE } from "../constants/conversationRoles.js";
import { CONVERSATION_STATUS } from "../constants/conversationStatus.js";
import { CONVERSATION_TYPE } from "../constants/conversationTypes.js";
import { MESSAGE_STATUS } from "../constants/messageLifecycle.js";
import { MODERATION_ACTION_TYPE } from "../constants/moderationActions.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import { createCommunityMembershipFactContract } from "../contracts/communityMembershipFact.js";
import { createCommunityPinnedMessageContract } from "../contracts/communityPinnedMessage.js";
import { createCommunityRestrictionContract } from "../contracts/communityRestriction.js";
import {
  createCommunitySlowModeConfigContract,
  evaluateCommunitySlowMode,
} from "../contracts/communitySlowMode.js";
import { createMessageReportContract } from "../contracts/messageReport.js";
import { createModerationActionContract } from "../contracts/moderationAction.js";
import {
  createParticipantId,
  requireOpaqueId,
} from "../contracts/identifiers.js";
import {
  assertCannotChangeCommunityChannelKey,
  assertCannotMoveCommunityChannel,
  assertCommunityAccessAllowed,
  evaluateCommunityChannelAccess,
  isCommunityChannelAdminRole,
  isExplicitActiveCommunityParticipant,
  resolveCommunityChannelIdentity,
} from "../domain/communityAccessRules.js";
import {
  buildCommunityChannelSummary,
  isPinnableCommunityMessage,
  sortCommunityChannelSummaries,
} from "../domain/communityCommunicationProjection.js";
import {
  addParticipant,
  assertCanSendMessage,
  createValidConversation,
  findActiveParticipant,
  suspendOrRemoveParticipant,
  transitionConversationStatus,
  transitionParticipantStatus,
} from "../domain/conversationRules.js";
import {
  assertReplyTargetInConversation,
  createMessageForConversation,
  transitionMessageStatus,
} from "../domain/messageRules.js";
import { advanceReadCursor } from "../domain/readCursorRules.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import {
  createAllowAllCommunityAccessPolicy,
  createDenyAllCommunityModerationPolicy,
} from "../ports/communityCommunicationPolicyPorts.js";

/**
 * @param {object} deps
 * @returns {object}
 */
export function createCommunityCommunicationApplicationService(deps = {}) {
  const channels = deps.channelRepository;
  const messages = deps.messageRepository;
  const readCursors = deps.readCursorRepository;
  const pins = deps.pinnedMessageRepository;
  const restrictions = deps.restrictionRepository;
  const reports = deps.reportRepository;
  const moderationActions = deps.moderationActionRepository;
  const membershipReader = deps.membershipReader;
  const identityActorPort = deps.identityActorPort;
  const accessPolicy =
    deps.accessPolicy || createAllowAllCommunityAccessPolicy();
  const moderationPolicy =
    deps.moderationPolicy || createDenyAllCommunityModerationPolicy();
  const clock = deps.clock;
  const ids = deps.idProvider;

  if (!channels || !messages || !readCursors || !pins || !restrictions) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Community communication repositories are required"
    );
  }
  if (!membershipReader || !clock || !ids) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "membershipReader, clock, and idProvider are required"
    );
  }

  async function loadMembership(tenantId, participantId) {
    const raw = await membershipReader.getMembership(tenantId, participantId);
    if (!raw) {
      return createCommunityMembershipFactContract({
        tenantId,
        participantId,
        status: COMMUNITY_MEMBERSHIP_STATUS.NOT_MEMBER,
        externalRoleFacts: null,
      });
    }
    return createCommunityMembershipFactContract({
      tenantId: raw.tenantId ?? tenantId,
      participantId: raw.participantId ?? participantId,
      status: raw.status ?? COMMUNITY_MEMBERSHIP_STATUS.NOT_MEMBER,
      externalRoleFacts: raw.externalRoleFacts ?? null,
    });
  }

  async function resolveIdentityFlags(participantId) {
    if (!identityActorPort) {
      return { identityActive: true, identityValid: true };
    }
    const actor = await identityActorPort.resolveActor(participantId);
    if (!actor) {
      return { identityActive: false, identityValid: false };
    }
    const active =
      typeof identityActorPort.isAccountActive === "function"
        ? await identityActorPort.isAccountActive(participantId)
        : actor.accountStatus === "ACTIVE";
    return {
      identityActive: Boolean(active),
      identityValid: true,
    };
  }

  async function loadRestriction(tenantId, participantId, channelKey = null) {
    const found = await restrictions.find(
      tenantId,
      participantId,
      channelKey
    );
    if (!found) {
      return createCommunityRestrictionContract({
        tenantId,
        participantId,
        status: COMMUNITY_RESTRICTION_STATUS.NONE,
        scope: COMMUNITY_RESTRICTION_SCOPE.COMMUNITY,
        updatedAt: clock.now(),
      });
    }
    return createCommunityRestrictionContract(found);
  }

  async function resolvePolicyDecision(input) {
    const policy = await accessPolicy.evaluate({
      tenantId: input.tenantId,
      channelKind: input.channelKind,
      visibility: input.visibility,
      channelKey: input.channelKey,
      participantId: input.participantId,
      membershipStatus: input.membershipStatus,
      action: input.action,
      externalRoleFacts: input.externalRoleFacts,
    });
    return {
      decision: policy?.decision ?? COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: policy?.reasonCode ?? null,
    };
  }

  async function decideAccess(aggregate, participantId, action) {
    const membership = await loadMembership(aggregate.tenantId, participantId);
    const participant = (aggregate.participants || []).find(
      (p) => p.participantId === participantId
    );
    const identity = await resolveIdentityFlags(participantId);
    const restriction = await loadRestriction(
      aggregate.tenantId,
      participantId,
      aggregate.channelKey
    );
    const policy = await resolvePolicyDecision({
      tenantId: aggregate.tenantId,
      channelKind: aggregate.channelKind,
      visibility: aggregate.visibility,
      channelKey: aggregate.channelKey,
      participantId,
      membershipStatus: membership.status,
      action,
      externalRoleFacts: membership.externalRoleFacts,
    });

    let moderatorAuthorized = false;
    if (
      action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE ||
      action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.ADMIN ||
      action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.PIN
    ) {
      const mod = await moderationPolicy.canModerate({
        tenantId: aggregate.tenantId,
        channelKey: aggregate.channelKey,
        participantId,
        action,
        membershipStatus: membership.status,
        externalRoleFacts: membership.externalRoleFacts,
      });
      moderatorAuthorized = Boolean(mod?.allowed);
    }

    return evaluateCommunityChannelAccess({
      tenantId: aggregate.tenantId,
      channelKind: aggregate.channelKind,
      visibility: aggregate.visibility,
      participantId,
      membershipStatus: membership.status,
      externalRoleFacts: membership.externalRoleFacts,
      action,
      conversationStatus: aggregate.conversation.status,
      lifecycleStatus: aggregate.lifecycleStatus,
      participantStatus: participant?.status,
      isExplicitParticipant: isExplicitActiveCommunityParticipant(
        aggregate.participants,
        participantId
      ),
      isChannelAdmin: isCommunityChannelAdminRole(participant),
      moderatorAuthorized,
      communityRestrictionStatus: restriction.status,
      identityActive: identity.identityActive,
      identityValid: identity.identityValid,
      policyDecision: policy.decision,
      policyReasonCode: policy.reasonCode,
    });
  }

  function requireCommunityAggregate(aggregate, conversationId) {
    if (!aggregate) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_CHANNEL_NOT_FOUND,
        `Community channel not found: ${String(conversationId)}`,
        { conversationId }
      );
    }
    if (aggregate.conversation.type !== CONVERSATION_TYPE.COMMUNITY) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.CONVERSATION_NOT_COMMUNITY,
        "Operation requires a COMMUNITY conversation",
        {
          conversationId: aggregate.conversation.conversationId,
          type: aggregate.conversation.type,
        }
      );
    }
    return aggregate;
  }

  async function createCommunityAggregate(
    identity,
    createdByParticipantId,
    at,
    participants = [],
    extras = {}
  ) {
    const conversationId = ids.nextId("conv");
    const seeded = createValidConversation({
      conversationId,
      type: CONVERSATION_TYPE.COMMUNITY,
      tenantId: identity.tenantId,
      contextRef: identity.channelKey,
      createdAt: at,
      createdByParticipantId: createdByParticipantId ?? null,
      participants,
    });
    const slowMode = createCommunitySlowModeConfigContract({
      enabled: extras.slowModeIntervalSeconds > 0,
      intervalSeconds: extras.slowModeIntervalSeconds ?? 0,
    });
    return channels.save({
      conversation: seeded.conversation,
      participants: seeded.participants,
      tenantId: identity.tenantId,
      channelKind: identity.channelKind,
      visibility: identity.visibility,
      channelKey: identity.channelKey,
      name: identity.name,
      lifecycleStatus:
        extras.lifecycleStatus ?? COMMUNITY_CHANNEL_LIFECYCLE.ACTIVE,
      slowModeIntervalSeconds: slowMode.intervalSeconds,
    });
  }

  async function resolveOrCreateLobby(tenantId, actorParticipantId) {
    const identity = resolveCommunityChannelIdentity({
      tenantId,
      channelKind: COMMUNITY_CHANNEL_KIND.LOBBY,
      visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
    });
    const existing = await channels.findByChannelKey(identity.channelKey);
    if (existing) {
      if (
        existing.lifecycleStatus === COMMUNITY_CHANNEL_LIFECYCLE.ACTIVE &&
        existing.channelKind === COMMUNITY_CHANNEL_KIND.LOBBY
      ) {
        return Object.freeze({ channel: existing, created: false });
      }
      // Non-active lobby with same key still resolves to that logical lobby
      return Object.freeze({ channel: existing, created: false });
    }

    // Guard: no second active LOBBY for tenant (different key should not happen)
    const siblings = await channels.listByTenantId(tenantId);
    const activeLobby = siblings.find(
      (c) =>
        c.channelKind === COMMUNITY_CHANNEL_KIND.LOBBY &&
        c.lifecycleStatus === COMMUNITY_CHANNEL_LIFECYCLE.ACTIVE
    );
    if (activeLobby) {
      return Object.freeze({ channel: activeLobby, created: false });
    }

    const now = clock.now();
    const created = await createCommunityAggregate(
      identity,
      actorParticipantId ?? null,
      now,
      []
    );
    return Object.freeze({ channel: created, created: true });
  }

  async function ensureSenderParticipant(working, senderParticipantId) {
    let sender = (working.participants || []).find(
      (p) => p.participantId === senderParticipantId
    );
    if (sender) return { working, sender };

    const joinDecision = await decideAccess(
      working,
      senderParticipantId,
      COMMUNITY_COMMUNICATION_ACCESS_ACTION.JOIN
    );
    assertCommunityAccessAllowed(joinDecision, {
      conversationId: working.conversation.conversationId,
      action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.JOIN,
    });

    if (working.visibility === COMMUNITY_CHANNEL_VISIBILITY.RESTRICTED) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
        "RESTRICTED channel requires an explicit participant before send",
        {
          conversationId: working.conversation.conversationId,
          senderParticipantId,
        }
      );
    }

    const nowJoin = clock.now();
    const candidate = addParticipant(working.participants, {
      conversationId: working.conversation.conversationId,
      participantId: senderParticipantId,
      role: CONVERSATION_ROLE.MEMBER,
      joinedAt: nowJoin,
      status: PARTICIPANT_STATUS.ACTIVE,
    });
    working = await channels.save({
      ...working,
      participants: [...working.participants, candidate],
    });
    return { working, sender: candidate };
  }

  return Object.freeze({
    async createOrResolveCommunityLobby(input = {}) {
      const tenantId = requireOpaqueId(input.tenantId, "tenantId");
      const actorParticipantId = input.actorParticipantId
        ? createParticipantId(input.actorParticipantId)
        : null;
      return resolveOrCreateLobby(tenantId, actorParticipantId);
    },

    async createCommunityChannel(input = {}) {
      const identity = resolveCommunityChannelIdentity({
        tenantId: input.tenantId,
        channelKind: input.channelKind,
        visibility: input.visibility,
        channelKey: input.channelKey,
        channelSuffix: input.channelSuffix || ids.nextId("ch"),
        name: input.name ?? null,
      });

      if (identity.channelKind === COMMUNITY_CHANNEL_KIND.LOBBY) {
        return resolveOrCreateLobby(
          identity.tenantId,
          input.actorParticipantId
            ? createParticipantId(input.actorParticipantId)
            : null
        );
      }

      const existing = await channels.findByChannelKey(identity.channelKey);
      if (existing) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_COMMUNITY_CHANNEL,
          "A community channel already exists for this channelKey",
          {
            channelKey: identity.channelKey,
            existingConversationId: existing.conversation.conversationId,
          }
        );
      }

      const actorParticipantId = input.actorParticipantId
        ? createParticipantId(input.actorParticipantId)
        : null;

      const now = clock.now();
      const slowModeIntervalSeconds =
        input.slowModeIntervalSeconds == null
          ? 0
          : Number(input.slowModeIntervalSeconds);
      createCommunitySlowModeConfigContract({
        intervalSeconds: slowModeIntervalSeconds,
      });

      const seedParticipants = [];
      if (
        actorParticipantId &&
        identity.visibility === COMMUNITY_CHANNEL_VISIBILITY.RESTRICTED
      ) {
        seedParticipants.push({
          participantId: actorParticipantId,
          role: CONVERSATION_ROLE.OWNER,
          joinedAt: now,
        });
      }

      const created = await createCommunityAggregate(
        identity,
        actorParticipantId,
        now,
        seedParticipants,
        { slowModeIntervalSeconds }
      );
      return Object.freeze({ channel: created, created: true });
    },

    async updateCommunityChannelMetadata(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      if (input.tenantId != null) {
        assertCannotMoveCommunityChannel(aggregate, input.tenantId);
      }
      if (input.channelKey != null) {
        assertCannotChangeCommunityChannelKey(aggregate, input.channelKey);
      }

      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
        action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.ADMIN,
      });

      let slowModeIntervalSeconds = aggregate.slowModeIntervalSeconds ?? 0;
      if (input.slowModeIntervalSeconds != null) {
        const cfg = createCommunitySlowModeConfigContract({
          intervalSeconds: Number(input.slowModeIntervalSeconds),
        });
        slowModeIntervalSeconds = cfg.intervalSeconds;
      }

      const visibility =
        input.visibility != null
          ? resolveCommunityChannelIdentity({
              tenantId: aggregate.tenantId,
              channelKind: aggregate.channelKind,
              visibility: input.visibility,
              channelKey: aggregate.channelKey,
              name: aggregate.name,
            }).visibility
          : aggregate.visibility;

      const updated = await channels.save({
        ...aggregate,
        name:
          input.name != null
            ? String(input.name).trim() || null
            : aggregate.name,
        visibility,
        slowModeIntervalSeconds,
      });
      return Object.freeze({ channel: updated });
    },

    async suspendCommunityChannel(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
      });

      const updated = await channels.save({
        ...aggregate,
        lifecycleStatus: COMMUNITY_CHANNEL_LIFECYCLE.SUSPENDED,
      });
      return Object.freeze({ channel: updated });
    },

    async archiveCommunityChannel(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
      });

      const conversation = transitionConversationStatus(
        aggregate.conversation,
        CONVERSATION_STATUS.ARCHIVED
      );
      const updated = await channels.save({
        ...aggregate,
        conversation,
        lifecycleStatus: COMMUNITY_CHANNEL_LIFECYCLE.ARCHIVED,
      });
      return Object.freeze({ channel: updated });
    },

    async joinCommunityChannel(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const restriction = await loadRestriction(
        aggregate.tenantId,
        participantId,
        aggregate.channelKey
      );
      if (restriction.status === COMMUNITY_RESTRICTION_STATUS.BANNED) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_BANNED,
          "Banned participant cannot join community channel",
          {
            tenantId: aggregate.tenantId,
            participantId,
            reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.COMMUNITY_BANNED,
          }
        );
      }

      const decision = await decideAccess(
        aggregate,
        participantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.JOIN
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
        action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.JOIN,
      });

      const existing = (aggregate.participants || []).find(
        (p) => p.participantId === participantId
      );
      if (existing && existing.status === PARTICIPANT_STATUS.ACTIVE) {
        return Object.freeze({
          channel: aggregate,
          participant: existing,
          joined: false,
        });
      }

      if (
        aggregate.visibility === COMMUNITY_CHANNEL_VISIBILITY.RESTRICTED &&
        !existing
      ) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_ACCESS_DENIED,
          "RESTRICTED channel requires addRestrictedChannelParticipant",
          {
            conversationId: aggregate.conversation.conversationId,
            reasonCode:
              COMMUNITY_COMMUNICATION_DENY_REASON.NOT_EXPLICIT_PARTICIPANT,
          }
        );
      }

      const now = clock.now();
      if (existing && existing.status === PARTICIPANT_STATUS.SUSPENDED) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INACTIVE_PARTICIPANT,
          "Suspended participant cannot self-join; restore required",
          { participantId, status: existing.status }
        );
      }

      let participants;
      let candidate;
      if (existing && existing.status === PARTICIPANT_STATUS.REMOVED) {
        candidate = transitionParticipantStatus(
          existing,
          PARTICIPANT_STATUS.ACTIVE
        );
        participants = aggregate.participants.map((p) =>
          p.participantId === participantId ? candidate : p
        );
      } else {
        candidate = addParticipant(aggregate.participants, {
          conversationId: aggregate.conversation.conversationId,
          participantId,
          role: input.role || CONVERSATION_ROLE.MEMBER,
          joinedAt: now,
          status: PARTICIPANT_STATUS.ACTIVE,
        });
        participants = [...aggregate.participants, candidate];
      }

      const updated = await channels.save({ ...aggregate, participants });
      return Object.freeze({
        channel: updated,
        participant: candidate,
        joined: true,
      });
    },

    async leaveCommunityChannel(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const existing = (aggregate.participants || []).find(
        (p) => p.participantId === participantId
      );

      if (!existing || existing.status === PARTICIPANT_STATUS.REMOVED) {
        return Object.freeze({
          channel: aggregate,
          participant: existing ?? null,
          left: false,
        });
      }

      const next = suspendOrRemoveParticipant(
        existing,
        PARTICIPANT_STATUS.REMOVED
      );
      const participants = aggregate.participants.map((p) =>
        p.participantId === participantId ? next : p
      );
      const updated = await channels.save({ ...aggregate, participants });
      return Object.freeze({
        channel: updated,
        participant: next,
        left: true,
      });
    },

    async addRestrictedChannelParticipant(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      if (aggregate.visibility !== COMMUNITY_CHANNEL_VISIBILITY.RESTRICTED) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
          "addRestrictedChannelParticipant requires RESTRICTED visibility",
          {
            visibility: aggregate.visibility,
            conversationId: aggregate.conversation.conversationId,
          }
        );
      }

      const participantId = createParticipantId(input.participantId);
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const adminDecision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertCommunityAccessAllowed(adminDecision, {
        conversationId: aggregate.conversation.conversationId,
      });

      const restriction = await loadRestriction(
        aggregate.tenantId,
        participantId
      );
      if (restriction.status === COMMUNITY_RESTRICTION_STATUS.BANNED) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_BANNED,
          "Banned participant cannot be added to a community channel",
          { participantId }
        );
      }

      const existing = (aggregate.participants || []).find(
        (p) => p.participantId === participantId
      );
      if (existing && existing.status === PARTICIPANT_STATUS.ACTIVE) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PARTICIPANT,
          "Participant is already ACTIVE in this channel",
          { participantId }
        );
      }

      const now = clock.now();
      const candidate = addParticipant(aggregate.participants, {
        conversationId: aggregate.conversation.conversationId,
        participantId,
        role: input.role || CONVERSATION_ROLE.MEMBER,
        joinedAt: now,
        status: PARTICIPANT_STATUS.ACTIVE,
      });
      const participants = [...aggregate.participants, candidate];
      const updated = await channels.save({ ...aggregate, participants });
      return Object.freeze({ channel: updated, participant: candidate });
    },

    async suspendCommunityChannelParticipant(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const adminDecision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE
      );
      assertCommunityAccessAllowed(adminDecision, {
        conversationId: aggregate.conversation.conversationId,
      });

      const current = findActiveParticipant(
        aggregate.participants,
        participantId,
        aggregate.conversation.conversationId
      );
      const next = suspendOrRemoveParticipant(
        current,
        PARTICIPANT_STATUS.SUSPENDED
      );
      const participants = aggregate.participants.map((p) =>
        p.participantId === participantId ? next : p
      );
      const updated = await channels.save({ ...aggregate, participants });

      if (restrictions) {
        await restrictions.save(
          createCommunityRestrictionContract({
            tenantId: aggregate.tenantId,
            participantId,
            status: COMMUNITY_RESTRICTION_STATUS.SUSPENDED,
            scope: COMMUNITY_RESTRICTION_SCOPE.CHANNEL,
            channelKey: aggregate.channelKey,
            reasonCode: input.reasonCode || "CHANNEL_SUSPENDED_PARTICIPANT",
            reason: input.reason ?? null,
            updatedAt: clock.now(),
          })
        );
      }

      return Object.freeze({ channel: updated, participant: next });
    },

    async removeCommunityChannelParticipant(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const adminDecision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE
      );
      assertCommunityAccessAllowed(adminDecision, {
        conversationId: aggregate.conversation.conversationId,
      });

      const current = findActiveParticipant(
        aggregate.participants,
        participantId,
        aggregate.conversation.conversationId
      );
      const next = suspendOrRemoveParticipant(
        current,
        PARTICIPANT_STATUS.REMOVED
      );
      const participants = aggregate.participants.map((p) =>
        p.participantId === participantId ? next : p
      );
      const updated = await channels.save({ ...aggregate, participants });
      return Object.freeze({ channel: updated, participant: next });
    },

    /**
     * Deterministic reconciliation from membership / restriction facts.
     * Does NOT write external community membership SoT.
     */
    async reconcileCommunityAccess(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const membership = await loadMembership(
        aggregate.tenantId,
        participantId
      );
      const restriction = await loadRestriction(
        aggregate.tenantId,
        participantId,
        aggregate.channelKey
      );
      const existing = (aggregate.participants || []).find(
        (p) => p.participantId === participantId
      );

      if (!existing || existing.status === PARTICIPANT_STATUS.REMOVED) {
        return Object.freeze({
          channel: aggregate,
          participant: existing ?? null,
          changed: false,
          membership,
          restriction,
        });
      }

      let next = existing;
      let changed = false;

      if (
        restriction.status === COMMUNITY_RESTRICTION_STATUS.BANNED ||
        membership.status === COMMUNITY_MEMBERSHIP_STATUS.REMOVED ||
        membership.status === COMMUNITY_MEMBERSHIP_STATUS.NOT_MEMBER
      ) {
        if (existing.status !== PARTICIPANT_STATUS.REMOVED) {
          next = suspendOrRemoveParticipant(
            existing,
            PARTICIPANT_STATUS.REMOVED
          );
          changed = true;
        }
      } else if (
        restriction.status === COMMUNITY_RESTRICTION_STATUS.SUSPENDED ||
        membership.status === COMMUNITY_MEMBERSHIP_STATUS.SUSPENDED
      ) {
        if (existing.status === PARTICIPANT_STATUS.ACTIVE) {
          next = suspendOrRemoveParticipant(
            existing,
            PARTICIPANT_STATUS.SUSPENDED
          );
          changed = true;
        }
      } else if (
        membership.status === COMMUNITY_MEMBERSHIP_STATUS.ACTIVE &&
        restriction.status === COMMUNITY_RESTRICTION_STATUS.NONE &&
        existing.status === PARTICIPANT_STATUS.SUSPENDED &&
        input.restoreActive === true
      ) {
        next = transitionParticipantStatus(
          existing,
          PARTICIPANT_STATUS.ACTIVE
        );
        changed = true;
      }

      if (!changed) {
        return Object.freeze({
          channel: aggregate,
          participant: existing,
          changed: false,
          membership,
          restriction,
        });
      }

      const participants = aggregate.participants.map((p) =>
        p.participantId === participantId ? next : p
      );
      const updated = await channels.save({ ...aggregate, participants });
      return Object.freeze({
        channel: updated,
        participant: next,
        changed: true,
        membership,
        restriction,
      });
    },

    async sendCommunityMessage(input = {}) {
      const senderParticipantId = createParticipantId(
        input.senderParticipantId
      );
      let working = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );

      if (input.tenantId != null) {
        assertCannotMoveCommunityChannel(working, input.tenantId);
      }

      const ensured = await ensureSenderParticipant(
        working,
        senderParticipantId
      );
      working = ensured.working;
      const sender = ensured.sender;

      const sendDecision = await decideAccess(
        working,
        senderParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND
      );
      assertCommunityAccessAllowed(sendDecision, {
        conversationId: working.conversation.conversationId,
        action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND,
      });

      if (sender.status !== PARTICIPANT_STATUS.ACTIVE) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INACTIVE_PARTICIPANT,
          `Sender participant is not ACTIVE (${sender.status})`,
          { senderParticipantId, status: sender.status }
        );
      }

      assertCanSendMessage(working.conversation, sender);

      // Slow mode — bypass only via explicit policy port signal
      const interval = working.slowModeIntervalSeconds ?? 0;
      if (interval > 0) {
        let moderatorBypass = false;
        const mod = await moderationPolicy.canModerate({
          tenantId: working.tenantId,
          channelKey: working.channelKey,
          participantId: senderParticipantId,
          action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE,
        });
        if (mod?.bypassSlowMode === true) {
          moderatorBypass = true;
        } else if (
          typeof moderationPolicy.canBypassSlowMode === "function"
        ) {
          const bypass = await moderationPolicy.canBypassSlowMode({
            tenantId: working.tenantId,
            participantId: senderParticipantId,
          });
          moderatorBypass = Boolean(bypass?.allowed);
        }
        const last = await messages.findLatestBySender(
          working.conversation.conversationId,
          senderParticipantId
        );
        const slowDecision = evaluateCommunitySlowMode({
          enabled: interval > 0,
          intervalSeconds: interval,
          lastSentAt: last?.createdAt ?? null,
          now: input.createdAt ?? clock.now(),
          moderatorBypass,
        });
        if (!slowDecision.allowed) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_SLOW_MODE_ACTIVE,
            slowDecision.message || "Slow mode interval has not elapsed",
            {
              reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.SLOW_MODE_ACTIVE,
              retryAfterSeconds: slowDecision.retryAfterSeconds,
              conversationId: working.conversation.conversationId,
              senderParticipantId,
            }
          );
        }
      }

      if (input.replyToMessageId) {
        const replyTarget = await messages.findById(input.replyToMessageId);
        assertReplyTargetInConversation(
          { replyToMessageId: input.replyToMessageId },
          replyTarget,
          working.conversation.conversationId
        );
      }

      const now = clock.now();
      const message = createMessageForConversation(
        working.conversation,
        sender,
        {
          messageId: input.messageId || ids.nextId("msg"),
          body: input.body,
          createdAt: input.createdAt ?? now,
          replyToMessageId: input.replyToMessageId ?? null,
          attachmentRefs: input.attachmentRefs ?? [],
        }
      );
      const saved = await messages.save(message);
      return Object.freeze({ message: saved, channel: working });
    },

    async pinCommunityMessage(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.PIN
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
        action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.PIN,
      });

      const message = await messages.findById(input.messageId);
      if (
        !message ||
        message.conversationId !== aggregate.conversation.conversationId
      ) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.PIN_TARGET_INVALID,
          "Pin target must be a message in the same community channel",
          {
            conversationId: aggregate.conversation.conversationId,
            messageId: input.messageId,
            messageConversationId: message?.conversationId ?? null,
          }
        );
      }
      if (!isPinnableCommunityMessage(message)) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.PIN_TARGET_INVALID,
          "Only visible/edited messages can be pinned",
          {
            messageId: message.messageId,
            status: message.status,
          }
        );
      }

      const existing = await pins.find(
        aggregate.conversation.conversationId,
        message.messageId
      );
      if (existing) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN,
          "Message is already pinned in this channel",
          {
            conversationId: aggregate.conversation.conversationId,
            messageId: message.messageId,
          }
        );
      }

      const pin = createCommunityPinnedMessageContract({
        conversationId: aggregate.conversation.conversationId,
        messageId: message.messageId,
        pinnedByParticipantId: actorParticipantId,
        pinnedAt: input.pinnedAt ?? clock.now(),
      });
      const saved = await pins.save(pin);
      return Object.freeze({ pin: saved, channel: aggregate });
    },

    async unpinCommunityMessage(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.PIN
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
        action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.PIN,
      });

      const removed = await pins.remove(
        aggregate.conversation.conversationId,
        input.messageId
      );
      return Object.freeze({
        removed: Boolean(removed),
        channel: aggregate,
      });
    },

    async markCommunityChannelRead(input = {}) {
      const participantId = createParticipantId(input.participantId);
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      findActiveParticipant(
        aggregate.participants,
        participantId,
        aggregate.conversation.conversationId
      );

      const current = await readCursors.find(
        aggregate.conversation.conversationId,
        participantId
      );
      const next = advanceReadCursor(current, {
        conversationId: aggregate.conversation.conversationId,
        participantId,
        lastReadAt: input.lastReadAt ?? clock.now(),
        lastReadMessageId: input.lastReadMessageId ?? null,
      });
      const saved = await readCursors.save(next);
      return Object.freeze({ readCursor: saved });
    },

    async buildCommunityChannelSummary(input = {}) {
      const viewerParticipantId = createParticipantId(
        input.viewerParticipantId
      );
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const access = await decideAccess(
        aggregate,
        viewerParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.READ
      );
      const messageList = await messages.listByConversationId(
        aggregate.conversation.conversationId
      );
      const readCursor = await readCursors.find(
        aggregate.conversation.conversationId,
        viewerParticipantId
      );
      const pinList = await pins.listByConversationId(
        aggregate.conversation.conversationId
      );
      return buildCommunityChannelSummary({
        conversation: aggregate.conversation,
        tenantId: aggregate.tenantId,
        channelKind: aggregate.channelKind,
        visibility: aggregate.visibility,
        channelKey: aggregate.channelKey,
        name: aggregate.name,
        lifecycleStatus: aggregate.lifecycleStatus,
        viewerParticipantId,
        messages: messageList,
        readCursor,
        participants: aggregate.participants,
        accessDecision: access.decision,
        slowModeIntervalSeconds: aggregate.slowModeIntervalSeconds ?? 0,
        pinnedMessageIds: pinList.map((p) => p.messageId),
      });
    },

    async listCommunityChannelSummaries(input = {}) {
      const tenantId = requireOpaqueId(input.tenantId, "tenantId");
      const viewerParticipantId = createParticipantId(
        input.viewerParticipantId
      );
      const aggregates = await channels.listByTenantId(tenantId);
      const summaries = [];
      for (const aggregate of aggregates) {
        if (aggregate.conversation.type !== CONVERSATION_TYPE.COMMUNITY) {
          continue;
        }
        const access = await decideAccess(
          aggregate,
          viewerParticipantId,
          COMMUNITY_COMMUNICATION_ACCESS_ACTION.READ
        );
        const messageList = await messages.listByConversationId(
          aggregate.conversation.conversationId
        );
        const readCursor = await readCursors.find(
          aggregate.conversation.conversationId,
          viewerParticipantId
        );
        const pinList = await pins.listByConversationId(
          aggregate.conversation.conversationId
        );
        summaries.push(
          buildCommunityChannelSummary({
            conversation: aggregate.conversation,
            tenantId: aggregate.tenantId,
            channelKind: aggregate.channelKind,
            visibility: aggregate.visibility,
            channelKey: aggregate.channelKey,
            name: aggregate.name,
            lifecycleStatus: aggregate.lifecycleStatus,
            viewerParticipantId,
            messages: messageList,
            readCursor,
            participants: aggregate.participants,
            accessDecision: access.decision,
            slowModeIntervalSeconds: aggregate.slowModeIntervalSeconds ?? 0,
            pinnedMessageIds: pinList.map((p) => p.messageId),
          })
        );
      }
      return sortCommunityChannelSummaries(summaries);
    },

    async reportCommunityMessage(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const reporterParticipantId = createParticipantId(
        input.reporterParticipantId
      );
      const decision = await decideAccess(
        aggregate,
        reporterParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.REPORT
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
      });

      const message = await messages.findById(input.messageId);
      if (
        !message ||
        message.conversationId !== aggregate.conversation.conversationId
      ) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.REPORT_TARGET_INVALID,
          "Report target must be a message in the same community channel",
          {
            conversationId: aggregate.conversation.conversationId,
            messageId: input.messageId,
            messageConversationId: message?.conversationId ?? null,
          }
        );
      }

      if (
        input.tenantId != null &&
        String(input.tenantId) !== aggregate.tenantId
      ) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_TENANT_MISMATCH,
          "Report tenantId does not match channel tenant",
          {
            tenantId: input.tenantId,
            channelTenantId: aggregate.tenantId,
          }
        );
      }

      const report = createMessageReportContract({
        reportId: input.reportId || ids.nextId("rpt"),
        messageId: message.messageId,
        conversationId: aggregate.conversation.conversationId,
        reporterParticipantId,
        reason: input.reason,
        createdAt: input.createdAt ?? clock.now(),
        details: input.details ?? null,
      });

      if (reports) {
        await reports.save(report);
      }
      return Object.freeze({ report, channel: aggregate });
    },

    async hideCommunityMessage(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
        action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE,
      });

      const message = await messages.findById(input.messageId);
      if (
        !message ||
        message.conversationId !== aggregate.conversation.conversationId
      ) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.REPORT_TARGET_INVALID,
          "Hide target must be a message in the same community channel",
          {
            conversationId: aggregate.conversation.conversationId,
            messageId: input.messageId,
          }
        );
      }

      const reasonCode = input.reasonCode || "HIDE_MESSAGE";
      const action = createModerationActionContract({
        actionId: input.actionId || ids.nextId("mod"),
        type: MODERATION_ACTION_TYPE.HIDE_MESSAGE,
        conversationId: aggregate.conversation.conversationId,
        actorParticipantId,
        targetMessageId: message.messageId,
        createdAt: input.createdAt ?? clock.now(),
        reason: input.reason || reasonCode,
      });

      let updatedMessage = message;
      if (message.status !== MESSAGE_STATUS.DELETED) {
        updatedMessage = transitionMessageStatus(
          message,
          MESSAGE_STATUS.DELETED
        );
        if (typeof messages.update === "function") {
          updatedMessage = await messages.update(updatedMessage);
        }
      }

      if (moderationActions) {
        await moderationActions.save(action);
      }

      return Object.freeze({
        message: updatedMessage,
        moderationAction: action,
        channel: aggregate,
      });
    },

    async suspendCommunityParticipant(input = {}) {
      return this.suspendCommunityChannelParticipant(input);
    },

    async banCommunityParticipant(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
      });

      const reasonCode = input.reasonCode || "COMMUNITY_BANNED";
      const restriction = await restrictions.save(
        createCommunityRestrictionContract({
          tenantId: aggregate.tenantId,
          participantId,
          status: COMMUNITY_RESTRICTION_STATUS.BANNED,
          scope: COMMUNITY_RESTRICTION_SCOPE.COMMUNITY,
          reasonCode,
          reason: input.reason ?? null,
          updatedAt: clock.now(),
        })
      );

      let working = aggregate;
      const existing = (aggregate.participants || []).find(
        (p) => p.participantId === participantId
      );
      if (existing && existing.status !== PARTICIPANT_STATUS.REMOVED) {
        const next = suspendOrRemoveParticipant(
          existing,
          PARTICIPANT_STATUS.REMOVED
        );
        const participants = aggregate.participants.map((p) =>
          p.participantId === participantId ? next : p
        );
        working = await channels.save({ ...aggregate, participants });
      }

      const action = createModerationActionContract({
        actionId: input.actionId || ids.nextId("mod"),
        type: MODERATION_ACTION_TYPE.BAN_PARTICIPANT,
        conversationId: aggregate.conversation.conversationId,
        actorParticipantId,
        targetParticipantId: participantId,
        createdAt: clock.now(),
        reason: input.reason || reasonCode,
      });
      if (moderationActions) {
        await moderationActions.save(action);
      }

      return Object.freeze({
        channel: working,
        restriction,
        moderationAction: action,
      });
    },

    async restoreCommunityParticipant(input = {}) {
      const aggregate = requireCommunityAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE
      );
      assertCommunityAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
      });

      await restrictions.clear(aggregate.tenantId, participantId, null);
      if (aggregate.channelKey) {
        await restrictions.clear(
          aggregate.tenantId,
          participantId,
          aggregate.channelKey
        );
      }

      const existing = (aggregate.participants || []).find(
        (p) => p.participantId === participantId
      );
      let working = aggregate;
      let participant = existing ?? null;
      if (existing && existing.status === PARTICIPANT_STATUS.SUSPENDED) {
        participant = transitionParticipantStatus(
          existing,
          PARTICIPANT_STATUS.ACTIVE
        );
        const participants = aggregate.participants.map((p) =>
          p.participantId === participantId ? participant : p
        );
        working = await channels.save({ ...aggregate, participants });
      }

      const action = createModerationActionContract({
        actionId: input.actionId || ids.nextId("mod"),
        type: MODERATION_ACTION_TYPE.RESTORE_PARTICIPANT,
        conversationId: aggregate.conversation.conversationId,
        actorParticipantId,
        targetParticipantId: participantId,
        createdAt: clock.now(),
        reason: input.reason || "RESTORE_PARTICIPANT",
      });
      if (moderationActions) {
        await moderationActions.save(action);
      }

      return Object.freeze({
        channel: working,
        participant,
        moderationAction: action,
      });
    },
  });
}
