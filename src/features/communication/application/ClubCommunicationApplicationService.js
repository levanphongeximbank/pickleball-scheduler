/**
 * Club Communication application service (COMMS-03).
 *
 * Persistence-agnostic command handlers over COMMS-01 contracts.
 * No SQL, Supabase, realtime, notification delivery, or UI.
 * Club membership / governance remain owned by Club Management.
 */

import { CLUB_CHANNEL_KIND, DEFAULT_CLUB_CHANNEL_KINDS } from "../constants/clubChannelKinds.js";
import {
  CLUB_COMMUNICATION_ACCESS_ACTION,
  CLUB_COMMUNICATION_ACCESS_DECISION,
} from "../constants/clubCommunicationAccess.js";
import { CLUB_MEMBERSHIP_STATUS } from "../constants/clubMembershipStatus.js";
import { CONVERSATION_ROLE } from "../constants/conversationRoles.js";
import { CONVERSATION_STATUS } from "../constants/conversationStatus.js";
import { CONVERSATION_TYPE } from "../constants/conversationTypes.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import { createClubPinnedMessageContract } from "../contracts/clubPinnedMessage.js";
import { createClubMembershipFactContract } from "../contracts/clubMembershipFact.js";
import { createParticipantId, requireOpaqueId } from "../contracts/identifiers.js";
import {
  assertClubAccessAllowed,
  assertCannotChangeChannelKey,
  assertCannotMoveClubChannel,
  assertParticipantBelongsToClub,
  evaluateClubChannelAccess,
  isClubChannelAdminRole,
  isExplicitActiveClubParticipant,
  resolveClubChannelIdentity,
} from "../domain/clubAccessRules.js";
import {
  buildClubChannelSummary,
  isPinnableClubMessage,
  sortClubChannelSummaries,
} from "../domain/clubCommunicationProjection.js";
import {
  addParticipant,
  assertCanSendMessage,
  createValidConversation,
  findActiveParticipant,
  suspendOrRemoveParticipant,
  transitionConversationStatus,
  transitionParticipantStatus,
  updateParticipantRole,
} from "../domain/conversationRules.js";
import {
  assertReplyTargetInConversation,
  createMessageForConversation,
} from "../domain/messageRules.js";
import { advanceReadCursor } from "../domain/readCursorRules.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import {
  createAllowAllClubCommunicationAccessPolicy,
  createAllowAllTeamAccessPolicy,
} from "../ports/clubCommunicationPolicyPorts.js";

/**
 * @param {object} deps
 * @returns {object}
 */
export function createClubCommunicationApplicationService(deps = {}) {
  const channels = deps.channelRepository;
  const messages = deps.messageRepository;
  const readCursors = deps.readCursorRepository;
  const pins = deps.pinnedMessageRepository;
  const membershipReader = deps.membershipReader;
  const accessPolicy =
    deps.accessPolicy || createAllowAllClubCommunicationAccessPolicy();
  const teamAccessPolicy =
    deps.teamAccessPolicy || createAllowAllTeamAccessPolicy();
  const clock = deps.clock;
  const ids = deps.idProvider;

  if (!channels || !messages || !readCursors || !pins) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Club communication repositories are required"
    );
  }
  if (!membershipReader || !clock || !ids) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "membershipReader, clock, and idProvider are required"
    );
  }

  async function loadMembership(clubId, participantId) {
    const raw = await membershipReader.getMembership(clubId, participantId);
    if (!raw) {
      return createClubMembershipFactContract({
        clubId,
        participantId,
        status: CLUB_MEMBERSHIP_STATUS.NOT_MEMBER,
        externalRoleFacts: null,
      });
    }
    return createClubMembershipFactContract({
      clubId: raw.clubId ?? clubId,
      participantId: raw.participantId ?? participantId,
      status: raw.status ?? CLUB_MEMBERSHIP_STATUS.NOT_MEMBER,
      externalRoleFacts: raw.externalRoleFacts ?? null,
    });
  }

  async function resolvePolicyDecision(input) {
    const kind = input.channelKind;
    if (kind === CLUB_CHANNEL_KIND.TEAM) {
      const team = await teamAccessPolicy.canAccessTeamChannel({
        clubId: input.clubId,
        participantId: input.participantId,
        channelKey: input.channelKey,
        membershipStatus: input.membershipStatus,
        action: input.action,
        externalRoleFacts: input.externalRoleFacts,
      });
      return {
        decision: team?.allowed
          ? CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW
          : CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
        reasonCode: team?.reasonCode ?? "TEAM_POLICY_DENIED",
      };
    }

    const policy = await accessPolicy.evaluate({
      clubId: input.clubId,
      channelKind: input.channelKind,
      channelKey: input.channelKey,
      participantId: input.participantId,
      membershipStatus: input.membershipStatus,
      action: input.action,
      externalRoleFacts: input.externalRoleFacts,
    });
    return {
      decision: policy?.decision ?? CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: policy?.reasonCode ?? null,
    };
  }

  async function decideAccess(aggregate, participantId, action) {
    const membership = await loadMembership(aggregate.clubId, participantId);
    const participant = (aggregate.participants || []).find(
      (p) => p.participantId === participantId
    );
    const policy = await resolvePolicyDecision({
      clubId: aggregate.clubId,
      channelKind: aggregate.channelKind,
      channelKey: aggregate.channelKey,
      participantId,
      membershipStatus: membership.status,
      action,
      externalRoleFacts: membership.externalRoleFacts,
    });

    return evaluateClubChannelAccess({
      clubId: aggregate.clubId,
      channelKind: aggregate.channelKind,
      participantId,
      membershipStatus: membership.status,
      externalRoleFacts: membership.externalRoleFacts,
      action,
      conversationStatus: aggregate.conversation.status,
      participantStatus: participant?.status,
      isExplicitParticipant: isExplicitActiveClubParticipant(
        aggregate.participants,
        participantId
      ),
      isChannelAdmin: isClubChannelAdminRole(participant),
      policyDecision: policy.decision,
      policyReasonCode: policy.reasonCode,
    });
  }

  function requireClubAggregate(aggregate, conversationId) {
    if (!aggregate) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_CHANNEL_NOT_FOUND,
        `Club channel not found: ${String(conversationId)}`,
        { conversationId }
      );
    }
    if (aggregate.conversation.type !== CONVERSATION_TYPE.CLUB) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.CONVERSATION_NOT_CLUB,
        "Operation requires a CLUB conversation",
        {
          conversationId: aggregate.conversation.conversationId,
          type: aggregate.conversation.type,
        }
      );
    }
    return aggregate;
  }

  async function createClubAggregate(identity, createdByParticipantId, at, participants = []) {
    const conversationId = ids.nextId("conv");
    const seeded = createValidConversation({
      conversationId,
      type: CONVERSATION_TYPE.CLUB,
      clubId: identity.clubId,
      contextRef: identity.channelKey,
      createdAt: at,
      createdByParticipantId: createdByParticipantId ?? null,
      participants,
    });
    return channels.save({
      conversation: seeded.conversation,
      participants: seeded.participants,
      clubId: identity.clubId,
      channelKind: identity.channelKind,
      channelKey: identity.channelKey,
      name: identity.name,
    });
  }

  async function resolveOrCreateDefault(clubId, channelKind, actorParticipantId) {
    const identity = resolveClubChannelIdentity({ clubId, channelKind });
    const existing = await channels.findByChannelKey(identity.channelKey);
    if (existing) {
      return Object.freeze({ channel: existing, created: false });
    }
    const now = clock.now();
    const created = await createClubAggregate(
      identity,
      actorParticipantId ?? null,
      now,
      []
    );
    return Object.freeze({ channel: created, created: true });
  }

  return Object.freeze({
    async createOrResolveDefaultClubChannels(input = {}) {
      const clubId = requireOpaqueId(input.clubId, "clubId");
      const actorParticipantId = input.actorParticipantId
        ? createParticipantId(input.actorParticipantId)
        : null;
      const results = [];
      for (const kind of DEFAULT_CLUB_CHANNEL_KINDS) {
        results.push(await resolveOrCreateDefault(clubId, kind, actorParticipantId));
      }
      return Object.freeze({
        clubId,
        channels: Object.freeze(results.map((r) => r.channel)),
        createdCount: results.filter((r) => r.created).length,
      });
    },

    async createClubChannel(input = {}) {
      const identity = resolveClubChannelIdentity({
        clubId: input.clubId,
        channelKind: input.channelKind,
        channelKey: input.channelKey,
        channelSuffix: input.channelSuffix || ids.nextId("ch"),
        name: input.name ?? null,
      });
      const existing = await channels.findByChannelKey(identity.channelKey);
      if (existing) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_CLUB_CHANNEL,
          "A club channel already exists for this channelKey",
          {
            channelKey: identity.channelKey,
            existingConversationId: existing.conversation.conversationId,
          }
        );
      }

      const actorParticipantId = input.actorParticipantId
        ? createParticipantId(input.actorParticipantId)
        : null;

      if (actorParticipantId) {
        const membership = await loadMembership(identity.clubId, actorParticipantId);
        assertParticipantBelongsToClub(identity.clubId, membership);
        if (membership.status !== CLUB_MEMBERSHIP_STATUS.ACTIVE) {
          assertClubAccessAllowed(
            evaluateClubChannelAccess({
              clubId: identity.clubId,
              channelKind: identity.channelKind,
              participantId: actorParticipantId,
              membershipStatus: membership.status,
              action: CLUB_COMMUNICATION_ACCESS_ACTION.JOIN,
            }),
            { clubId: identity.clubId, channelKey: identity.channelKey }
          );
        }
      }

      const now = clock.now();
      const seedParticipants = [];
      if (actorParticipantId && identity.channelKind === CLUB_CHANNEL_KIND.PRIVATE) {
        seedParticipants.push({
          participantId: actorParticipantId,
          role: CONVERSATION_ROLE.OWNER,
          joinedAt: now,
        });
      }

      const created = await createClubAggregate(
        identity,
        actorParticipantId,
        now,
        seedParticipants
      );
      return Object.freeze({ channel: created, created: true });
    },

    async updateClubChannelMetadata(input = {}) {
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      if (input.clubId != null) {
        assertCannotMoveClubChannel(aggregate, input.clubId);
      }
      if (input.channelKey != null) {
        assertCannotChangeChannelKey(aggregate, input.channelKey);
      }

      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertClubAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
        action: CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN,
      });

      const updated = await channels.save({
        ...aggregate,
        name: input.name != null ? String(input.name).trim() || null : aggregate.name,
      });
      return Object.freeze({ channel: updated });
    },

    async archiveClubChannel(input = {}) {
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertClubAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
        action: CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN,
      });

      const conversation = transitionConversationStatus(
        aggregate.conversation,
        CONVERSATION_STATUS.ARCHIVED
      );
      const updated = await channels.save({ ...aggregate, conversation });
      return Object.freeze({ channel: updated });
    },

    async addClubChannelParticipant(input = {}) {
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const actorParticipantId = createParticipantId(input.actorParticipantId);

      const adminDecision = await decideAccess(
        aggregate,
        actorParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertClubAccessAllowed(adminDecision, {
        conversationId: aggregate.conversation.conversationId,
        action: CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN,
      });

      const membership = await loadMembership(aggregate.clubId, participantId);
      assertParticipantBelongsToClub(aggregate.clubId, membership);
      if (membership.status !== CLUB_MEMBERSHIP_STATUS.ACTIVE) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
          "Only ACTIVE club members may be added to a club channel",
          {
            clubId: aggregate.clubId,
            participantId,
            status: membership.status,
          }
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

    async suspendClubChannelParticipant(input = {}) {
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const adminDecision = await decideAccess(
        aggregate,
        actorParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertClubAccessAllowed(adminDecision, {
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
      return Object.freeze({ channel: updated, participant: next });
    },

    async removeClubChannelParticipant(input = {}) {
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const adminDecision = await decideAccess(
        aggregate,
        actorParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertClubAccessAllowed(adminDecision, {
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

    async changeClubChannelParticipantRole(input = {}) {
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const adminDecision = await decideAccess(
        aggregate,
        actorParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN
      );
      assertClubAccessAllowed(adminDecision, {
        conversationId: aggregate.conversation.conversationId,
      });

      const current = findActiveParticipant(
        aggregate.participants,
        participantId,
        aggregate.conversation.conversationId
      );
      const next = updateParticipantRole(current, input.role);
      const participants = aggregate.participants.map((p) =>
        p.participantId === participantId ? next : p
      );
      const updated = await channels.save({ ...aggregate, participants });
      return Object.freeze({ channel: updated, participant: next });
    },

    /**
     * Deterministic reconciliation: Club membership suspension/removal
     * revokes channel send rights (participant → SUSPENDED/REMOVED).
     * Does NOT write Club Management membership.
     */
    async synchronizeClubMembershipAccess(input = {}) {
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const participantId = createParticipantId(input.participantId);
      const membership = await loadMembership(aggregate.clubId, participantId);
      const existing = (aggregate.participants || []).find(
        (p) => p.participantId === participantId
      );

      if (!existing || existing.status === PARTICIPANT_STATUS.REMOVED) {
        return Object.freeze({
          channel: aggregate,
          participant: existing ?? null,
          changed: false,
          membership,
        });
      }

      let next = existing;
      let changed = false;
      if (
        membership.status === CLUB_MEMBERSHIP_STATUS.SUSPENDED &&
        existing.status === PARTICIPANT_STATUS.ACTIVE
      ) {
        next = suspendOrRemoveParticipant(
          existing,
          PARTICIPANT_STATUS.SUSPENDED
        );
        changed = true;
      } else if (
        (membership.status === CLUB_MEMBERSHIP_STATUS.REMOVED ||
          membership.status === CLUB_MEMBERSHIP_STATUS.NOT_MEMBER) &&
        existing.status !== PARTICIPANT_STATUS.REMOVED
      ) {
        next = suspendOrRemoveParticipant(
          existing,
          PARTICIPANT_STATUS.REMOVED
        );
        changed = true;
      } else if (
        membership.status === CLUB_MEMBERSHIP_STATUS.ACTIVE &&
        existing.status === PARTICIPANT_STATUS.SUSPENDED &&
        input.restoreActive === true
      ) {
        // Optional restore only when explicitly requested — Communication
        // never invents Club membership reactivation.
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
      });
    },

    async sendClubMessage(input = {}) {
      const senderParticipantId = createParticipantId(
        input.senderParticipantId
      );
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );

      if (input.clubId != null) {
        assertCannotMoveClubChannel(aggregate, input.clubId);
      }

      const membership = await loadMembership(
        aggregate.clubId,
        senderParticipantId
      );
      if (membership.status !== CLUB_MEMBERSHIP_STATUS.ACTIVE) {
        assertClubAccessAllowed(
          evaluateClubChannelAccess({
            clubId: aggregate.clubId,
            channelKind: aggregate.channelKind,
            participantId: senderParticipantId,
            membershipStatus: membership.status,
            action: CLUB_COMMUNICATION_ACCESS_ACTION.SEND,
            conversationStatus: aggregate.conversation.status,
          }),
          { conversationId: aggregate.conversation.conversationId }
        );
      }

      // Ensure sender is an ACTIVE channel participant for GENERAL/ANNOUNCEMENT
      // by auto-joining when membership + kind policy allow (except PRIVATE).
      let working = aggregate;
      let sender = (working.participants || []).find(
        (p) => p.participantId === senderParticipantId
      );

      if (
        !sender &&
        (aggregate.channelKind === CLUB_CHANNEL_KIND.GENERAL ||
          aggregate.channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT ||
          aggregate.channelKind === CLUB_CHANNEL_KIND.TEAM ||
          aggregate.channelKind === CLUB_CHANNEL_KIND.MANAGEMENT)
      ) {
        const joinDecision = await decideAccess(
          working,
          senderParticipantId,
          CLUB_COMMUNICATION_ACCESS_ACTION.JOIN
        );
        assertClubAccessAllowed(joinDecision, {
          conversationId: working.conversation.conversationId,
          action: CLUB_COMMUNICATION_ACCESS_ACTION.JOIN,
        });
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
        sender = candidate;
      }

      if (!sender) {
        const accessDecision = await decideAccess(
          working,
          senderParticipantId,
          CLUB_COMMUNICATION_ACCESS_ACTION.SEND
        );
        assertClubAccessAllowed(accessDecision, {
          conversationId: working.conversation.conversationId,
          action: CLUB_COMMUNICATION_ACCESS_ACTION.SEND,
        });
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
          "Sender is not a participant of this club channel",
          {
            conversationId: working.conversation.conversationId,
            senderParticipantId,
          }
        );
      }

      const sendDecision = await decideAccess(
        working,
        senderParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.SEND
      );
      assertClubAccessAllowed(sendDecision, {
        conversationId: working.conversation.conversationId,
        action: CLUB_COMMUNICATION_ACCESS_ACTION.SEND,
      });

      if (sender.status !== PARTICIPANT_STATUS.ACTIVE) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INACTIVE_PARTICIPANT,
          `Sender participant is not ACTIVE (${sender.status})`,
          { senderParticipantId, status: sender.status }
        );
      }

      assertCanSendMessage(working.conversation, sender);

      if (input.replyToMessageId) {
        const replyTarget = await messages.findById(input.replyToMessageId);
        assertReplyTargetInConversation(
          { replyToMessageId: input.replyToMessageId },
          replyTarget,
          working.conversation.conversationId
        );
      }

      const now = clock.now();
      const message = createMessageForConversation(working.conversation, sender, {
        messageId: input.messageId || ids.nextId("msg"),
        body: input.body,
        createdAt: input.createdAt ?? now,
        replyToMessageId: input.replyToMessageId ?? null,
        attachmentRefs: input.attachmentRefs ?? [],
      });
      const saved = await messages.save(message);
      return Object.freeze({ message: saved, channel: working });
    },

    async pinClubMessage(input = {}) {
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.PIN
      );
      assertClubAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
        action: CLUB_COMMUNICATION_ACCESS_ACTION.PIN,
      });

      const message = await messages.findById(input.messageId);
      if (
        !message ||
        message.conversationId !== aggregate.conversation.conversationId
      ) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.PIN_TARGET_INVALID,
          "Pin target must be a message in the same club channel",
          {
            conversationId: aggregate.conversation.conversationId,
            messageId: input.messageId,
            messageConversationId: message?.conversationId ?? null,
          }
        );
      }
      if (!isPinnableClubMessage(message)) {
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

      const pin = createClubPinnedMessageContract({
        conversationId: aggregate.conversation.conversationId,
        messageId: message.messageId,
        pinnedByParticipantId: actorParticipantId,
        pinnedAt: input.pinnedAt ?? clock.now(),
      });
      const saved = await pins.save(pin);
      return Object.freeze({ pin: saved, channel: aggregate });
    },

    async unpinClubMessage(input = {}) {
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const decision = await decideAccess(
        aggregate,
        actorParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.PIN
      );
      assertClubAccessAllowed(decision, {
        conversationId: aggregate.conversation.conversationId,
        action: CLUB_COMMUNICATION_ACCESS_ACTION.PIN,
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

    async markClubChannelRead(input = {}) {
      const participantId = createParticipantId(input.participantId);
      const aggregate = requireClubAggregate(
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

    async buildClubChannelSummary(input = {}) {
      const viewerParticipantId = createParticipantId(
        input.viewerParticipantId
      );
      const aggregate = requireClubAggregate(
        await channels.findById(input.conversationId),
        input.conversationId
      );
      const access = await decideAccess(
        aggregate,
        viewerParticipantId,
        CLUB_COMMUNICATION_ACCESS_ACTION.READ
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
      return buildClubChannelSummary({
        conversation: aggregate.conversation,
        clubId: aggregate.clubId,
        channelKind: aggregate.channelKind,
        channelKey: aggregate.channelKey,
        name: aggregate.name,
        viewerParticipantId,
        messages: messageList,
        readCursor,
        participants: aggregate.participants,
        accessAllowed:
          access.decision === CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
        pinnedMessageIds: pinList.map((p) => p.messageId),
      });
    },

    async listClubChannelSummaries(input = {}) {
      const clubId = requireOpaqueId(input.clubId, "clubId");
      const viewerParticipantId = createParticipantId(
        input.viewerParticipantId
      );
      const aggregates = await channels.listByClubId(clubId);
      const summaries = [];
      for (const aggregate of aggregates) {
        if (aggregate.conversation.type !== CONVERSATION_TYPE.CLUB) continue;
        const access = await decideAccess(
          aggregate,
          viewerParticipantId,
          CLUB_COMMUNICATION_ACCESS_ACTION.READ
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
          buildClubChannelSummary({
            conversation: aggregate.conversation,
            clubId: aggregate.clubId,
            channelKind: aggregate.channelKind,
            channelKey: aggregate.channelKey,
            name: aggregate.name,
            viewerParticipantId,
            messages: messageList,
            readCursor,
            participants: aggregate.participants,
            accessAllowed:
              access.decision === CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
            pinnedMessageIds: pinList.map((p) => p.messageId),
          })
        );
      }
      return sortClubChannelSummaries(summaries);
    },
  });
}
