/**
 * Club channel + membership access domain rules (COMMS-03).
 * Pure / deterministic. Club roles arrive only via policy / membership facts.
 */

import {
  CLUB_CHANNEL_KIND,
  isClubChannelKind,
  isDefaultClubChannelKind,
} from "../constants/clubChannelKinds.js";
import {
  CLUB_COMMUNICATION_ACCESS_ACTION,
  CLUB_COMMUNICATION_ACCESS_DECISION,
  CLUB_COMMUNICATION_DENY_REASON,
} from "../constants/clubCommunicationAccess.js";
import { CLUB_MEMBERSHIP_STATUS } from "../constants/clubMembershipStatus.js";
import { CONVERSATION_STATUS } from "../constants/conversationStatus.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import { createClubAccessDecisionContract } from "../contracts/clubAccessDecision.js";
import {
  assertClubChannelClubImmutable,
  assertClubChannelKeyImmutable,
  buildClubChannelKey,
  buildDefaultClubChannelKey,
  createClubChannelIdentityContract,
} from "../contracts/clubChannel.js";
import { createClubMembershipFactContract } from "../contracts/clubMembershipFact.js";
import { createParticipantId, requireOpaqueId } from "../contracts/identifiers.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";

/**
 * @param {unknown} channelKind
 * @returns {string}
 */
export function assertClubChannelKind(channelKind) {
  if (!isClubChannelKind(channelKind)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CLUB_CHANNEL_KIND,
      `Unsupported club channel kind: ${String(channelKind)}`,
      {
        channelKind,
        allowed: Object.values(CLUB_CHANNEL_KIND),
      }
    );
  }
  return String(channelKind);
}

/**
 * @param {unknown} clubId
 * @returns {string}
 */
export function assertClubIdRequired(clubId) {
  try {
    return requireOpaqueId(clubId, "clubId");
  } catch {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ID_REQUIRED,
      "CLUB conversation / channel requires clubId",
      { clubId }
    );
  }
}

/**
 * Resolve deterministic channel identity for defaults or custom channels.
 * @param {object} input
 */
export function resolveClubChannelIdentity(input = {}) {
  const clubId = assertClubIdRequired(input.clubId);
  const channelKind = assertClubChannelKind(input.channelKind);
  let channelKey = input.channelKey;
  if (!channelKey) {
    if (isDefaultClubChannelKind(channelKind)) {
      channelKey = buildDefaultClubChannelKey(clubId, channelKind);
    } else {
      channelKey = buildClubChannelKey(
        clubId,
        channelKind,
        input.channelSuffix
      );
    }
  }
  return createClubChannelIdentityContract({
    clubId,
    channelKind,
    channelKey,
    name: input.name ?? null,
  });
}

/**
 * Map membership status into a typed deny decision, or null if ACTIVE.
 * @param {object} membership
 * @returns {Readonly<object>|null}
 */
export function denyReasonForMembership(membership) {
  const fact = createClubMembershipFactContract(membership);
  if (fact.status === CLUB_MEMBERSHIP_STATUS.ACTIVE) {
    return null;
  }
  if (fact.status === CLUB_MEMBERSHIP_STATUS.SUSPENDED) {
    return createClubAccessDecisionContract({
      decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: CLUB_COMMUNICATION_DENY_REASON.MEMBERSHIP_SUSPENDED,
      message: "Club membership is suspended",
    });
  }
  if (fact.status === CLUB_MEMBERSHIP_STATUS.REMOVED) {
    return createClubAccessDecisionContract({
      decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: CLUB_COMMUNICATION_DENY_REASON.MEMBERSHIP_REMOVED,
      message: "Club membership is removed",
    });
  }
  return createClubAccessDecisionContract({
    decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
    reasonCode: CLUB_COMMUNICATION_DENY_REASON.NOT_MEMBER,
    message: "Actor is not a club member",
  });
}

/**
 * Evaluate club channel access using membership + optional policy facts.
 *
 * Precedence:
 * 1. Invalid channel kind → DENY
 * 2. Archived channel (for SEND) → DENY
 * 3. Membership not ACTIVE → DENY
 * 4. Kind-specific rules / external policy results
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function evaluateClubChannelAccess(input = {}) {
  const channelKind = input.channelKind;
  if (!isClubChannelKind(channelKind)) {
    return createClubAccessDecisionContract({
      decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: CLUB_COMMUNICATION_DENY_REASON.CHANNEL_KIND_INVALID,
      message: "Invalid club channel kind",
    });
  }

  const action = input.action || CLUB_COMMUNICATION_ACCESS_ACTION.READ;
  if (
    action === CLUB_COMMUNICATION_ACCESS_ACTION.SEND &&
    input.conversationStatus &&
    input.conversationStatus !== CONVERSATION_STATUS.ACTIVE
  ) {
    return createClubAccessDecisionContract({
      decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: CLUB_COMMUNICATION_DENY_REASON.CHANNEL_ARCHIVED,
      message: "Archived or closed club channel cannot accept messages",
    });
  }

  const membershipDeny = denyReasonForMembership({
    clubId: input.clubId,
    participantId: input.participantId,
    status: input.membershipStatus ?? CLUB_MEMBERSHIP_STATUS.NOT_MEMBER,
    externalRoleFacts: input.externalRoleFacts ?? null,
  });
  if (membershipDeny) {
    return membershipDeny;
  }

  if (
    input.participantStatus &&
    input.participantStatus !== PARTICIPANT_STATUS.ACTIVE &&
    (action === CLUB_COMMUNICATION_ACCESS_ACTION.SEND ||
      action === CLUB_COMMUNICATION_ACCESS_ACTION.JOIN)
  ) {
    return createClubAccessDecisionContract({
      decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: CLUB_COMMUNICATION_DENY_REASON.INACTIVE_PARTICIPANT,
      message: "Channel participant is not ACTIVE",
    });
  }

  // PRIVATE: explicit participant required for JOIN/READ/SEND (beyond membership)
  if (channelKind === CLUB_CHANNEL_KIND.PRIVATE) {
    if (input.isExplicitParticipant !== true) {
      return createClubAccessDecisionContract({
        decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
        reasonCode: CLUB_COMMUNICATION_DENY_REASON.NOT_EXPLICIT_PARTICIPANT,
        message: "PRIVATE channel requires explicit participant membership",
      });
    }
  }

  // ANNOUNCEMENT send requires policy allow
  if (
    channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT &&
    action === CLUB_COMMUNICATION_ACCESS_ACTION.SEND
  ) {
    if (input.policyDecision === CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW) {
      return createClubAccessDecisionContract({
        decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
        message: null,
      });
    }
    return createClubAccessDecisionContract({
      decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode:
        input.policyReasonCode ||
        CLUB_COMMUNICATION_DENY_REASON.ANNOUNCEMENT_SEND_DENIED,
      message: "Announcement send denied by policy",
    });
  }

  // TEAM / MANAGEMENT require policy allow for JOIN/READ/SEND/ADMIN/PIN
  if (
    channelKind === CLUB_CHANNEL_KIND.TEAM ||
    channelKind === CLUB_CHANNEL_KIND.MANAGEMENT
  ) {
    if (input.policyDecision === CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW) {
      return createClubAccessDecisionContract({
        decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
        message: null,
      });
    }
    const defaultReason =
      channelKind === CLUB_CHANNEL_KIND.TEAM
        ? CLUB_COMMUNICATION_DENY_REASON.TEAM_POLICY_DENIED
        : CLUB_COMMUNICATION_DENY_REASON.MANAGEMENT_POLICY_DENIED;
    return createClubAccessDecisionContract({
      decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: input.policyReasonCode || defaultReason,
      message: `${channelKind} access denied by policy`,
    });
  }

  // ADMIN / PIN on GENERAL / ANNOUNCEMENT / PRIVATE: require policy or channel role
  if (
    action === CLUB_COMMUNICATION_ACCESS_ACTION.ADMIN ||
    action === CLUB_COMMUNICATION_ACCESS_ACTION.PIN
  ) {
    if (input.policyDecision === CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW) {
      return createClubAccessDecisionContract({
        decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
        message: null,
      });
    }
    if (input.isChannelAdmin === true) {
      return createClubAccessDecisionContract({
        decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
        message: null,
      });
    }
    return createClubAccessDecisionContract({
      decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode:
        input.policyReasonCode ||
        CLUB_COMMUNICATION_DENY_REASON.UNAUTHORIZED_ADMIN,
      message: "Channel admin action denied",
    });
  }

  // GENERAL / ANNOUNCEMENT READ/JOIN and GENERAL SEND: active membership sufficient
  return createClubAccessDecisionContract({
    decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
    reasonCode: null,
    message: null,
  });
}

/**
 * @param {Readonly<object>} decision
 * @param {object} [details]
 */
export function assertClubAccessAllowed(decision, details = {}) {
  if (
    !decision ||
    decision.decision !== CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW
  ) {
    const reasonCode = decision?.reasonCode || null;
    let code = COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ACCESS_DENIED;
    if (
      reasonCode === CLUB_COMMUNICATION_DENY_REASON.NOT_MEMBER ||
      reasonCode === CLUB_COMMUNICATION_DENY_REASON.MEMBERSHIP_SUSPENDED ||
      reasonCode === CLUB_COMMUNICATION_DENY_REASON.MEMBERSHIP_REMOVED
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED;
    } else if (
      reasonCode === CLUB_COMMUNICATION_DENY_REASON.ANNOUNCEMENT_SEND_DENIED ||
      reasonCode === CLUB_COMMUNICATION_DENY_REASON.TEAM_POLICY_DENIED ||
      reasonCode === CLUB_COMMUNICATION_DENY_REASON.MANAGEMENT_POLICY_DENIED ||
      reasonCode === CLUB_COMMUNICATION_DENY_REASON.POLICY_DENIED
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_SEND_POLICY_DENIED;
    } else if (
      reasonCode === CLUB_COMMUNICATION_DENY_REASON.CHANNEL_ARCHIVED
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_CHANNEL_ARCHIVED;
    } else if (
      reasonCode === CLUB_COMMUNICATION_DENY_REASON.UNAUTHORIZED_ADMIN
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_CHANNEL_ADMIN;
    }

    throw new CommunicationFoundationError(
      code,
      decision?.message || "Club communication access denied",
      {
        reasonCode,
        decision: decision?.decision,
        ...details,
      }
    );
  }
  return true;
}

/**
 * Ensure participant belongs to the channel's club via membership fact.
 * @param {string} channelClubId
 * @param {object} membership
 */
export function assertParticipantBelongsToClub(channelClubId, membership) {
  const clubId = assertClubIdRequired(channelClubId);
  const fact = createClubMembershipFactContract(membership);
  if (fact.clubId !== clubId) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_CLUB_MISMATCH,
      "Participant membership clubId does not match channel club",
      {
        channelClubId: clubId,
        membershipClubId: fact.clubId,
        participantId: fact.participantId,
      }
    );
  }
  if (fact.status === CLUB_MEMBERSHIP_STATUS.NOT_MEMBER) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_CLUB_MISMATCH,
      "Participant is not a member of the channel club",
      {
        clubId,
        participantId: fact.participantId,
        status: fact.status,
      }
    );
  }
  return fact;
}

/**
 * @param {object} aggregate
 * @param {string} nextClubId
 */
export function assertCannotMoveClubChannel(aggregate, nextClubId) {
  assertClubChannelClubImmutable(aggregate.clubId, nextClubId);
  assertClubChannelClubImmutable(aggregate.conversation.clubId, nextClubId);
  return true;
}

/**
 * @param {object} aggregate
 * @param {string} nextChannelKey
 */
export function assertCannotChangeChannelKey(aggregate, nextChannelKey) {
  assertClubChannelKeyImmutable(aggregate.channelKey, nextChannelKey);
  return true;
}

/**
 * @param {readonly object[]} participants
 * @param {string} participantId
 * @returns {boolean}
 */
export function isExplicitActiveClubParticipant(participants, participantId) {
  const id = createParticipantId(participantId);
  return (Array.isArray(participants) ? participants : []).some(
    (p) =>
      p.participantId === id && p.status === PARTICIPANT_STATUS.ACTIVE
  );
}

/**
 * Conversation-role check for channel admin (OWNER/MODERATOR).
 * Does not consult Club Management roles.
 * @param {object|null|undefined} participant
 * @returns {boolean}
 */
export function isClubChannelAdminRole(participant) {
  if (!participant) return false;
  return (
    participant.role === "OWNER" || participant.role === "MODERATOR"
  );
}

export { isDefaultClubChannelKind, buildDefaultClubChannelKey, buildClubChannelKey };
