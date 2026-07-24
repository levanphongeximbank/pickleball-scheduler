/**
 * Club Communication application composition root (COMMS-03).
 *
 * In-memory repositories are for unit tests / capability proof only.
 * No Supabase, SQL, realtime, or notification wiring.
 */

import { CLUB_MEMBERSHIP_STATUS } from "../constants/clubMembershipStatus.js";
import { createClubMembershipFactContract } from "../contracts/clubMembershipFact.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import {
  createAllowAllClubCommunicationAccessPolicy,
  createAllowAllTeamAccessPolicy,
} from "../ports/clubCommunicationPolicyPorts.js";
import { createInMemoryClubCommunicationRepositories } from "../repositories/inMemoryClub.js";
import {
  createFixedClock,
  createMemoryIdentityActorPort,
  createSequentialIdProvider,
} from "./createDirectMessagingApplication.js";
import { createClubCommunicationApplicationService } from "./ClubCommunicationApplicationService.js";

/**
 * In-memory ClubMembershipReader for tests.
 * Seeds Communication-facing membership facts — does not write Club SoT.
 *
 * @param {Iterable<[string, string, string]|object>} [seedEntries]
 *   Entries: [clubId, participantId, status] or fact objects.
 */
export function createMemoryClubMembershipReader(seedEntries = []) {
  /** @type {Map<string, object>} */
  const byKey = new Map();

  function key(clubId, participantId) {
    return `${clubId}\u0000${participantId}`;
  }

  function seed(clubId, participantId, status, externalRoleFacts = null) {
    const fact = createClubMembershipFactContract({
      clubId,
      participantId,
      status,
      externalRoleFacts,
    });
    byKey.set(key(fact.clubId, fact.participantId), fact);
    return fact;
  }

  for (const entry of seedEntries) {
    if (Array.isArray(entry)) {
      seed(entry[0], entry[1], entry[2], entry[3] ?? null);
    } else if (entry && typeof entry === "object") {
      seed(
        entry.clubId,
        entry.participantId,
        entry.status,
        entry.externalRoleFacts ?? null
      );
    }
  }

  return {
    seed,
    /**
     * @param {string} clubId
     * @param {string} participantId
     * @param {string} status
     */
    setStatus(clubId, participantId, status, externalRoleFacts = null) {
      return seed(clubId, participantId, status, externalRoleFacts);
    },
    async getMembership(clubId, participantId) {
      const found = byKey.get(key(String(clubId), String(participantId)));
      if (found) return found;
      return createClubMembershipFactContract({
        clubId,
        participantId,
        status: CLUB_MEMBERSHIP_STATUS.NOT_MEMBER,
        externalRoleFacts: null,
      });
    },
    async isActiveMember(clubId, participantId) {
      const fact = await this.getMembership(clubId, participantId);
      return fact.status === CLUB_MEMBERSHIP_STATUS.ACTIVE;
    },
  };
}

/**
 * @param {object} [options]
 * @returns {object}
 */
export function createClubCommunicationApplication(options = {}) {
  const idProvider =
    options.idProvider ||
    (typeof options.idGenerator === "function"
      ? { nextId: options.idGenerator }
      : createSequentialIdProvider("club-comms"));
  const clock = options.clock || createFixedClock();

  let repositories = options.repositories;
  if (!repositories) {
    if (options.useInMemoryRepositories === false) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
        "repositories must be provided when useInMemoryRepositories is false"
      );
    }
    repositories = createInMemoryClubCommunicationRepositories();
  }

  const membershipReader =
    options.membershipReader || createMemoryClubMembershipReader();
  const accessPolicy =
    options.accessPolicy || createAllowAllClubCommunicationAccessPolicy();
  const teamAccessPolicy =
    options.teamAccessPolicy || createAllowAllTeamAccessPolicy();

  const clubCommunication = createClubCommunicationApplicationService({
    channelRepository: repositories.channels,
    messageRepository: repositories.messages,
    readCursorRepository: repositories.readCursors,
    pinnedMessageRepository: repositories.pins,
    membershipReader,
    accessPolicy,
    teamAccessPolicy,
    clock,
    idProvider,
  });

  return Object.freeze({
    /** In-memory only on default path — not production persistence. */
    repositories,
    clock,
    idProvider,
    membershipReader,
    accessPolicy,
    teamAccessPolicy,
    clubCommunication,
  });
}

export {
  createFixedClock,
  createMemoryIdentityActorPort,
  createSequentialIdProvider,
};
