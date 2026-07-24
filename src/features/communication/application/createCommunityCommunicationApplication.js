/**
 * Community Communication application composition root (COMMS-04).
 *
 * In-memory repositories are for unit tests / capability proof only.
 * No Supabase, SQL, realtime, or notification wiring.
 */

import { COMMUNITY_MEMBERSHIP_STATUS } from "../constants/communityMembershipStatus.js";
import { createCommunityMembershipFactContract } from "../contracts/communityMembershipFact.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import {
  createAllowAllCommunityAccessPolicy,
  createAllowAllCommunityModerationPolicy,
} from "../ports/communityCommunicationPolicyPorts.js";
import { createInMemoryCommunityCommunicationRepositories } from "../repositories/inMemoryCommunity.js";
import {
  createFixedClock,
  createMemoryIdentityActorPort,
  createSequentialIdProvider,
} from "./createDirectMessagingApplication.js";
import { createCommunityCommunicationApplicationService } from "./CommunityCommunicationApplicationService.js";

/**
 * In-memory CommunityMembershipReader for tests.
 * Seeds Communication-facing membership facts — does not write external SoT.
 *
 * @param {Iterable<[string, string, string]|object>} [seedEntries]
 *   Entries: [tenantId, participantId, status] or fact objects.
 */
export function createMemoryCommunityMembershipReader(seedEntries = []) {
  /** @type {Map<string, object>} */
  const byKey = new Map();

  function key(tenantId, participantId) {
    return `${tenantId}\u0000${participantId}`;
  }

  function seed(tenantId, participantId, status, externalRoleFacts = null) {
    const fact = createCommunityMembershipFactContract({
      tenantId,
      participantId,
      status,
      externalRoleFacts,
    });
    byKey.set(key(fact.tenantId, fact.participantId), fact);
    return fact;
  }

  for (const entry of seedEntries) {
    if (Array.isArray(entry)) {
      seed(entry[0], entry[1], entry[2], entry[3] ?? null);
    } else if (entry && typeof entry === "object") {
      seed(
        entry.tenantId,
        entry.participantId,
        entry.status,
        entry.externalRoleFacts ?? null
      );
    }
  }

  return {
    seed,
    /**
     * @param {string} tenantId
     * @param {string} participantId
     * @param {string} status
     */
    setStatus(tenantId, participantId, status, externalRoleFacts = null) {
      return seed(tenantId, participantId, status, externalRoleFacts);
    },
    async getMembership(tenantId, participantId) {
      const found = byKey.get(key(String(tenantId), String(participantId)));
      if (found) return found;
      return createCommunityMembershipFactContract({
        tenantId,
        participantId,
        status: COMMUNITY_MEMBERSHIP_STATUS.NOT_MEMBER,
        externalRoleFacts: null,
      });
    },
    async isActiveMember(tenantId, participantId) {
      const fact = await this.getMembership(tenantId, participantId);
      return fact.status === COMMUNITY_MEMBERSHIP_STATUS.ACTIVE;
    },
  };
}

/**
 * @param {object} [options]
 * @returns {object}
 */
export function createCommunityCommunicationApplication(options = {}) {
  const idProvider =
    options.idProvider ||
    (typeof options.idGenerator === "function"
      ? { nextId: options.idGenerator }
      : createSequentialIdProvider("community-comms"));
  const clock = options.clock || createFixedClock();

  let repositories = options.repositories;
  if (!repositories) {
    if (options.useInMemoryRepositories === false) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
        "repositories must be provided when useInMemoryRepositories is false"
      );
    }
    repositories = createInMemoryCommunityCommunicationRepositories();
  }

  const membershipReader =
    options.membershipReader || createMemoryCommunityMembershipReader();
  const identityActorPort =
    options.identityActorPort ||
    createMemoryIdentityActorPort(
      options.activeIdentityIds || [
        "user-a",
        "user-b",
        "mod-a",
        "banned-a",
        "inactive-a",
      ]
    );
  if (
    options.seedInactiveIdentity === true ||
    (options.activeIdentityIds &&
      !options.activeIdentityIds.includes("inactive-a"))
  ) {
    // leave default; tests can override identityActorPort
  }
  if (identityActorPort && typeof identityActorPort.seed === "function") {
    identityActorPort.seed("inactive-a", false);
  }

  const accessPolicy =
    options.accessPolicy || createAllowAllCommunityAccessPolicy();
  const moderationPolicy =
    options.moderationPolicy || createAllowAllCommunityModerationPolicy();

  const communityCommunication =
    createCommunityCommunicationApplicationService({
      channelRepository: repositories.channels,
      messageRepository: repositories.messages,
      readCursorRepository: repositories.readCursors,
      pinnedMessageRepository: repositories.pins,
      restrictionRepository: repositories.restrictions,
      reportRepository: repositories.reports,
      moderationActionRepository: repositories.moderationActions,
      membershipReader,
      identityActorPort,
      accessPolicy,
      moderationPolicy,
      clock,
      idProvider,
    });

  return Object.freeze({
    /** In-memory only on default path — not production persistence. */
    repositories,
    clock,
    idProvider,
    membershipReader,
    identityActorPort,
    accessPolicy,
    moderationPolicy,
    communityCommunication,
  });
}

export {
  createFixedClock,
  createMemoryIdentityActorPort,
  createSequentialIdProvider,
};
