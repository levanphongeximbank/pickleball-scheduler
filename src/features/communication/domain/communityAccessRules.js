/**
 * Community channel + membership access domain rules (COMMS-04).
 * Pure / deterministic. Membership / ban / identity arrive via ports / facts.
 */

import {
  COMMUNITY_CHANNEL_KIND,
  isCommunityChannelKind,
  isDefaultCommunityChannelKind,
} from "../constants/communityChannelKinds.js";
import {
  COMMUNITY_CHANNEL_LIFECYCLE,
  isCommunityChannelLifecycle,
} from "../constants/communityChannelLifecycle.js";
import {
  COMMUNITY_CHANNEL_VISIBILITY,
  isCommunityChannelVisibility,
} from "../constants/communityChannelVisibility.js";
import {
  COMMUNITY_COMMUNICATION_ACCESS_ACTION,
  COMMUNITY_COMMUNICATION_ACCESS_DECISION,
  COMMUNITY_COMMUNICATION_DENY_REASON,
} from "../constants/communityCommunicationAccess.js";
import { COMMUNITY_MEMBERSHIP_STATUS } from "../constants/communityMembershipStatus.js";
import { COMMUNITY_RESTRICTION_STATUS } from "../constants/communityRestrictionStatus.js";
import { CONVERSATION_STATUS } from "../constants/conversationStatus.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import { createCommunityAccessDecisionContract } from "../contracts/communityAccessDecision.js";
import {
  assertCommunityChannelKeyImmutable,
  assertCommunityChannelTenantImmutable,
  buildCommunityChannelKey,
  buildCommunityLobbyChannelKey,
  buildDefaultCommunityChannelKey,
  createCommunityChannelIdentityContract,
} from "../contracts/communityChannel.js";
import { createCommunityMembershipFactContract } from "../contracts/communityMembershipFact.js";
import { createParticipantId, requireOpaqueId } from "../contracts/identifiers.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";

/**
 * @param {unknown} channelKind
 * @returns {string}
 */
export function assertCommunityChannelKind(channelKind) {
  if (!isCommunityChannelKind(channelKind)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_KIND,
      `Unsupported community channel kind: ${String(channelKind)}`,
      {
        channelKind,
        allowed: Object.values(COMMUNITY_CHANNEL_KIND),
      }
    );
  }
  return String(channelKind);
}

/**
 * @param {unknown} visibility
 * @returns {string}
 */
export function assertCommunityChannelVisibility(visibility) {
  if (!isCommunityChannelVisibility(visibility)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_VISIBILITY,
      `Unsupported community channel visibility: ${String(visibility)}`,
      {
        visibility,
        allowed: Object.values(COMMUNITY_CHANNEL_VISIBILITY),
      }
    );
  }
  return String(visibility);
}

/**
 * @param {unknown} tenantId
 * @returns {string}
 */
export function assertTenantIdRequired(tenantId) {
  try {
    return requireOpaqueId(tenantId, "tenantId");
  } catch {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.TENANT_ID_REQUIRED,
      "COMMUNITY conversation / channel requires tenantId",
      { tenantId }
    );
  }
}

/**
 * Resolve deterministic channel identity for lobby or custom channels.
 * @param {object} input
 */
export function resolveCommunityChannelIdentity(input = {}) {
  const tenantId = assertTenantIdRequired(input.tenantId);
  const channelKind = assertCommunityChannelKind(input.channelKind);
  let channelKey = input.channelKey;
  if (!channelKey) {
    if (isDefaultCommunityChannelKind(channelKind)) {
      channelKey = buildDefaultCommunityChannelKey(tenantId, channelKind);
    } else {
      channelKey = buildCommunityChannelKey(
        tenantId,
        channelKind,
        input.channelSuffix
      );
    }
  }
  return createCommunityChannelIdentityContract({
    tenantId,
    channelKind,
    visibility: input.visibility,
    channelKey,
    name: input.name ?? null,
  });
}

/**
 * @param {object} membership
 * @returns {Readonly<object>|null}
 */
export function denyReasonForCommunityMembership(membership) {
  const fact = createCommunityMembershipFactContract(membership);
  if (fact.status === COMMUNITY_MEMBERSHIP_STATUS.ACTIVE) {
    return null;
  }
  if (fact.status === COMMUNITY_MEMBERSHIP_STATUS.SUSPENDED) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.MEMBERSHIP_SUSPENDED,
      message: "Community membership is suspended",
    });
  }
  if (fact.status === COMMUNITY_MEMBERSHIP_STATUS.REMOVED) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.MEMBERSHIP_REMOVED,
      message: "Community membership is removed",
    });
  }
  return createCommunityAccessDecisionContract({
    decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
    reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.NOT_MEMBER,
    message: "Actor is not a community member",
  });
}

/**
 * Evaluate community channel access.
 *
 * Precedence:
 * 1. Invalid identity → DENY
 * 2. Invalid kind / visibility → DENY
 * 3. Community ban → DENY
 * 4. Channel lifecycle / archived for SEND → DENY
 * 5. Suspended channel participant for SEND/JOIN → DENY
 * 6. Visibility rules (PUBLIC / JOIN_REQUIRED / RESTRICTED / READ_ONLY)
 * 7. ADMIN / PIN / MODERATE via policy or channel role
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function evaluateCommunityChannelAccess(input = {}) {
  if (input.identityActive === false) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.IDENTITY_INACTIVE,
      message: "Identity is inactive or invalid",
    });
  }
  if (input.identityValid === false) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.IDENTITY_INVALID,
      message: "Identity is invalid",
    });
  }

  const channelKind = input.channelKind;
  if (!isCommunityChannelKind(channelKind)) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.CHANNEL_KIND_INVALID,
      message: "Invalid community channel kind",
    });
  }

  const visibility = input.visibility;
  if (!isCommunityChannelVisibility(visibility)) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.CHANNEL_VISIBILITY_INVALID,
      message: "Invalid community channel visibility",
    });
  }

  if (
    input.communityRestrictionStatus === COMMUNITY_RESTRICTION_STATUS.BANNED
  ) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.COMMUNITY_BANNED,
      message: "Actor is banned from the community",
    });
  }

  const action = input.action || COMMUNITY_COMMUNICATION_ACCESS_ACTION.READ;
  const lifecycle =
    input.lifecycleStatus && isCommunityChannelLifecycle(input.lifecycleStatus)
      ? input.lifecycleStatus
      : COMMUNITY_CHANNEL_LIFECYCLE.ACTIVE;

  if (
    action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND ||
    action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.JOIN
  ) {
    if (lifecycle === COMMUNITY_CHANNEL_LIFECYCLE.ARCHIVED) {
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
        reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.CHANNEL_ARCHIVED,
        message: "Archived community channel cannot accept messages",
      });
    }
    if (lifecycle === COMMUNITY_CHANNEL_LIFECYCLE.SUSPENDED) {
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
        reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.CHANNEL_SUSPENDED,
        message: "Suspended community channel cannot accept messages",
      });
    }
    if (
      input.conversationStatus &&
      input.conversationStatus !== CONVERSATION_STATUS.ACTIVE
    ) {
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
        reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.CHANNEL_ARCHIVED,
        message: "Non-ACTIVE community conversation cannot accept messages",
      });
    }
  }

  if (
    input.participantStatus === PARTICIPANT_STATUS.SUSPENDED &&
    (action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND ||
      action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.JOIN)
  ) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode:
        COMMUNITY_COMMUNICATION_DENY_REASON.CHANNEL_SUSPENDED_PARTICIPANT,
      message: "Channel participant is suspended",
    });
  }

  if (
    input.communityRestrictionStatus ===
      COMMUNITY_RESTRICTION_STATUS.SUSPENDED &&
    action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND
  ) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode:
        COMMUNITY_COMMUNICATION_DENY_REASON.CHANNEL_SUSPENDED_PARTICIPANT,
      message: "Community participant is suspended",
    });
  }

  if (
    input.participantStatus &&
    input.participantStatus !== PARTICIPANT_STATUS.ACTIVE &&
    input.participantStatus !== PARTICIPANT_STATUS.SUSPENDED &&
    (action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND ||
      action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.JOIN)
  ) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.INACTIVE_PARTICIPANT,
      message: "Channel participant is not ACTIVE",
    });
  }

  const membershipStatus =
    input.membershipStatus ?? COMMUNITY_MEMBERSHIP_STATUS.NOT_MEMBER;
  const isActiveMember =
    membershipStatus === COMMUNITY_MEMBERSHIP_STATUS.ACTIVE;

  // ADMIN / PIN / MODERATE: policy or channel admin role
  if (
    action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.ADMIN ||
    action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.PIN ||
    action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE
  ) {
    if (
      input.policyDecision === COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW ||
      input.isChannelAdmin === true ||
      input.moderatorAuthorized === true
    ) {
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
        message: null,
      });
    }
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode:
        input.policyReasonCode ||
        (action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.MODERATE
          ? COMMUNITY_COMMUNICATION_DENY_REASON.UNAUTHORIZED_MODERATOR
          : COMMUNITY_COMMUNICATION_DENY_REASON.UNAUTHORIZED_ADMIN),
      message: "Community moderation/admin action denied",
    });
  }

  // REPORT: active identity + not banned is enough (target checked elsewhere)
  if (action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.REPORT) {
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
      reasonCode: null,
      message: null,
    });
  }

  // READ_ONLY visibility
  if (visibility === COMMUNITY_CHANNEL_VISIBILITY.READ_ONLY) {
    if (action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND) {
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.READ_ONLY,
        reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.READ_ONLY_CHANNEL,
        message: "READ_ONLY channel does not allow sending",
      });
    }
    if (action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.JOIN) {
      if (isActiveMember || input.isExplicitParticipant === true) {
        return createCommunityAccessDecisionContract({
          decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
          reasonCode: null,
          message: null,
        });
      }
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.JOIN_REQUIRED,
        reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.JOIN_REQUIRED,
        message: "READ_ONLY channel join requires membership",
      });
    }
    // READ allowed for public-read style
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
      reasonCode: null,
      message: null,
    });
  }

  // PUBLIC
  if (visibility === COMMUNITY_CHANNEL_VISIBILITY.PUBLIC) {
    if (
      action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.READ ||
      action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.JOIN ||
      action === COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND
    ) {
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
        message: null,
      });
    }
  }

  // JOIN_REQUIRED
  if (visibility === COMMUNITY_CHANNEL_VISIBILITY.JOIN_REQUIRED) {
    if (!isActiveMember) {
      if (membershipStatus === COMMUNITY_MEMBERSHIP_STATUS.SUSPENDED) {
        return denyReasonForCommunityMembership({
          tenantId: input.tenantId,
          participantId: input.participantId,
          status: membershipStatus,
        });
      }
      if (membershipStatus === COMMUNITY_MEMBERSHIP_STATUS.REMOVED) {
        return denyReasonForCommunityMembership({
          tenantId: input.tenantId,
          participantId: input.participantId,
          status: membershipStatus,
        });
      }
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.JOIN_REQUIRED,
        reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.JOIN_REQUIRED,
        message: "Active community membership is required",
      });
    }
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
      reasonCode: null,
      message: null,
    });
  }

  // RESTRICTED: explicit participant or policy allow
  if (visibility === COMMUNITY_CHANNEL_VISIBILITY.RESTRICTED) {
    if (input.isExplicitParticipant === true) {
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
        message: null,
      });
    }
    if (
      input.policyDecision === COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW
    ) {
      return createCommunityAccessDecisionContract({
        decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
        message: null,
      });
    }
    return createCommunityAccessDecisionContract({
      decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
      reasonCode:
        input.policyReasonCode ||
        COMMUNITY_COMMUNICATION_DENY_REASON.RESTRICTED_POLICY_DENIED,
      message: "RESTRICTED channel requires explicit access or policy allow",
    });
  }

  return createCommunityAccessDecisionContract({
    decision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
    reasonCode: COMMUNITY_COMMUNICATION_DENY_REASON.POLICY_DENIED,
    message: "Community communication access denied",
  });
}

/**
 * @param {Readonly<object>} decision
 * @param {object} [details]
 */
export function assertCommunityAccessAllowed(decision, details = {}) {
  if (
    !decision ||
    decision.decision !== COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW
  ) {
    const reasonCode = decision?.reasonCode || null;
    const decisionValue = decision?.decision;
    let code = COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_ACCESS_DENIED;

    if (
      decisionValue === COMMUNITY_COMMUNICATION_ACCESS_DECISION.JOIN_REQUIRED
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_JOIN_REQUIRED;
    } else if (
      decisionValue === COMMUNITY_COMMUNICATION_ACCESS_DECISION.READ_ONLY
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_READ_ONLY;
    } else if (
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.IDENTITY_INACTIVE ||
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.IDENTITY_INVALID
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE;
    } else if (
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.COMMUNITY_BANNED
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_BANNED;
    } else if (
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.NOT_MEMBER ||
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.MEMBERSHIP_SUSPENDED ||
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.MEMBERSHIP_REMOVED
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_MEMBERSHIP_DENIED;
    } else if (
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.CHANNEL_ARCHIVED
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_CHANNEL_ARCHIVED;
    } else if (
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.CHANNEL_SUSPENDED
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_CHANNEL_SUSPENDED;
    } else if (
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.SLOW_MODE_ACTIVE
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_SLOW_MODE_ACTIVE;
    } else if (
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.UNAUTHORIZED_MODERATOR
    ) {
      code =
        COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_COMMUNITY_MODERATOR;
    } else if (
      reasonCode === COMMUNITY_COMMUNICATION_DENY_REASON.UNAUTHORIZED_ADMIN
    ) {
      code = COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_CHANNEL_ADMIN;
    }

    throw new CommunicationFoundationError(
      code,
      decision?.message || "Community communication access denied",
      {
        reasonCode,
        decision: decisionValue,
        ...details,
      }
    );
  }
  return true;
}

/**
 * @param {string} channelTenantId
 * @param {object} membership
 */
export function assertParticipantBelongsToTenant(channelTenantId, membership) {
  const tenantId = assertTenantIdRequired(channelTenantId);
  const fact = createCommunityMembershipFactContract(membership);
  if (fact.tenantId !== tenantId) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_TENANT_MISMATCH,
      "Participant membership tenantId does not match channel tenant",
      {
        channelTenantId: tenantId,
        membershipTenantId: fact.tenantId,
        participantId: fact.participantId,
      }
    );
  }
  return fact;
}

/**
 * @param {object} aggregate
 * @param {string} nextTenantId
 */
export function assertCannotMoveCommunityChannel(aggregate, nextTenantId) {
  assertCommunityChannelTenantImmutable(aggregate.tenantId, nextTenantId);
  assertCommunityChannelTenantImmutable(
    aggregate.conversation.tenantId,
    nextTenantId
  );
  return true;
}

/**
 * @param {object} aggregate
 * @param {string} nextChannelKey
 */
export function assertCannotChangeCommunityChannelKey(
  aggregate,
  nextChannelKey
) {
  assertCommunityChannelKeyImmutable(aggregate.channelKey, nextChannelKey);
  return true;
}

/**
 * @param {readonly object[]} participants
 * @param {string} participantId
 * @returns {boolean}
 */
export function isExplicitActiveCommunityParticipant(
  participants,
  participantId
) {
  const id = createParticipantId(participantId);
  return (Array.isArray(participants) ? participants : []).some(
    (p) =>
      p.participantId === id && p.status === PARTICIPANT_STATUS.ACTIVE
  );
}

/**
 * @param {object|null|undefined} participant
 * @returns {boolean}
 */
export function isCommunityChannelAdminRole(participant) {
  if (!participant) return false;
  return (
    participant.role === "OWNER" || participant.role === "MODERATOR"
  );
}

export {
  isDefaultCommunityChannelKind,
  buildDefaultCommunityChannelKey,
  buildCommunityChannelKey,
  buildCommunityLobbyChannelKey,
};
