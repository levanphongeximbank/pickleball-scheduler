/**
 * Direct pair + access decision domain rules (COMMS-02).
 * Pure / deterministic. External policy consumed via adapter inputs only.
 */

import {
  DIRECT_MESSAGING_ACCESS_DECISION,
  DIRECT_MESSAGING_DENY_REASON,
} from "../constants/directMessagingAccess.js";
import { createDirectAccessDecisionContract } from "../contracts/directAccessDecision.js";
import {
  createDirectPairContract,
  getDirectPairCounterpart,
  isDirectPairMember,
} from "../contracts/directPair.js";
import { createParticipantId } from "../contracts/identifiers.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";

/**
 * Canonical direct pair — order-independent.
 * @param {unknown} leftParticipantId
 * @param {unknown} rightParticipantId
 */
export function resolveCanonicalDirectPair(
  leftParticipantId,
  rightParticipantId
) {
  return createDirectPairContract(leftParticipantId, rightParticipantId);
}

/**
 * Assert actor is one of the two pair members.
 * @param {object} pair
 * @param {string} actorParticipantId
 */
export function assertActorInDirectPair(pair, actorParticipantId) {
  if (!isDirectPairMember(pair, actorParticipantId)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.DIRECT_PAIR_INVALID,
      "Actor must be a member of the direct pair",
      {
        actorParticipantId: createParticipantId(actorParticipantId),
        pairKey: pair.pairKey,
      }
    );
  }
  return true;
}

/**
 * Evaluate access for opening/requesting a direct conversation.
 *
 * Precedence:
 * 1. Invalid / self / duplicate → DENY
 * 2. Block (either direction) → DENY
 * 3. Inactive / missing identity → DENY
 * 4. External policy decision (ALLOW | REQUEST_REQUIRED | DENY)
 *
 * @param {object} input
 * @param {string} input.actorParticipantId
 * @param {string} input.counterpartParticipantId
 * @param {boolean} [input.blocked]
 * @param {boolean} [input.actorActive]
 * @param {boolean} [input.counterpartActive]
 * @param {boolean} [input.actorIdentityFound]
 * @param {boolean} [input.counterpartIdentityFound]
 * @param {"ALLOW"|"REQUEST_REQUIRED"|"DENY"} [input.policyDecision]
 * @param {string|null} [input.policyReasonCode]
 * @returns {Readonly<object>}
 */
export function evaluateDirectMessagingAccess(input = {}) {
  let pair;
  try {
    pair = createDirectPairContract(
      input.actorParticipantId,
      input.counterpartParticipantId
    );
  } catch (err) {
    if (
      err instanceof CommunicationFoundationError &&
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.SELF_CONVERSATION_DENIED
    ) {
      return createDirectAccessDecisionContract({
        decision: DIRECT_MESSAGING_ACCESS_DECISION.DENY,
        reasonCode: DIRECT_MESSAGING_DENY_REASON.SELF_CONVERSATION,
        message: "Self-conversation is not allowed",
      });
    }
    throw err;
  }

  assertActorInDirectPair(pair, input.actorParticipantId);

  if (input.blocked === true) {
    return createDirectAccessDecisionContract({
      decision: DIRECT_MESSAGING_ACCESS_DECISION.DENY,
      reasonCode: DIRECT_MESSAGING_DENY_REASON.BLOCKED,
      message: "Direct messaging is blocked between these participants",
    });
  }

  if (
    input.actorIdentityFound === false ||
    input.counterpartIdentityFound === false
  ) {
    return createDirectAccessDecisionContract({
      decision: DIRECT_MESSAGING_ACCESS_DECISION.DENY,
      reasonCode: DIRECT_MESSAGING_DENY_REASON.INVALID_IDENTITY,
      message: "One or both identities are invalid or missing",
    });
  }

  if (input.actorActive === false || input.counterpartActive === false) {
    return createDirectAccessDecisionContract({
      decision: DIRECT_MESSAGING_ACCESS_DECISION.DENY,
      reasonCode: DIRECT_MESSAGING_DENY_REASON.INACTIVE_IDENTITY,
      message: "One or both identities are inactive",
    });
  }

  const policyDecision =
    input.policyDecision ?? DIRECT_MESSAGING_ACCESS_DECISION.ALLOW;

  if (policyDecision === DIRECT_MESSAGING_ACCESS_DECISION.DENY) {
    return createDirectAccessDecisionContract({
      decision: DIRECT_MESSAGING_ACCESS_DECISION.DENY,
      reasonCode:
        input.policyReasonCode ?? DIRECT_MESSAGING_DENY_REASON.POLICY_DENIED,
      message: "External access policy denied direct messaging",
    });
  }

  if (policyDecision === DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED) {
    return createDirectAccessDecisionContract({
      decision: DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED,
      reasonCode: null,
      message: "Recipient must accept a conversation request first",
    });
  }

  return createDirectAccessDecisionContract({
    decision: DIRECT_MESSAGING_ACCESS_DECISION.ALLOW,
    reasonCode: null,
    message: null,
  });
}

/**
 * Throw typed errors when a decision is not ALLOW for open/send paths.
 * @param {object} decision
 * @param {Record<string, unknown>} [details]
 */
export function assertDirectAccessAllowed(decision, details = {}) {
  if (!decision || decision.decision === DIRECT_MESSAGING_ACCESS_DECISION.ALLOW) {
    return true;
  }
  if (decision.decision === DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.REQUEST_REQUIRED,
      decision.message || "Conversation request is required",
      { reasonCode: decision.reasonCode, ...details }
    );
  }
  const code =
    decision.reasonCode === DIRECT_MESSAGING_DENY_REASON.BLOCKED
      ? COMMUNICATION_FOUNDATION_ERROR_CODE.BLOCKED_PARTICIPANT
      : decision.reasonCode === DIRECT_MESSAGING_DENY_REASON.INACTIVE_IDENTITY
        ? COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE
        : decision.reasonCode === DIRECT_MESSAGING_DENY_REASON.SELF_CONVERSATION
          ? COMMUNICATION_FOUNDATION_ERROR_CODE.SELF_CONVERSATION_DENIED
          : COMMUNICATION_FOUNDATION_ERROR_CODE.ACCESS_DENIED;
  throw new CommunicationFoundationError(
    code,
    decision.message || "Direct messaging access denied",
    { reasonCode: decision.reasonCode, ...details }
  );
}

export { getDirectPairCounterpart, isDirectPairMember };
