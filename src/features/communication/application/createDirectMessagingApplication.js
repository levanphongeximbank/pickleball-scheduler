/**
 * Direct Messaging application composition root (COMMS-02).
 *
 * In-memory repositories are for unit tests / capability proof only.
 * No Supabase, SQL, realtime, or notification wiring.
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import { createAllowAllDirectMessagingAccessPolicy } from "../ports/directMessagingPolicyPorts.js";
import { createInMemoryDirectMessagingRepositories } from "../repositories/inMemory.js";
import { createDirectMessagingApplicationService } from "./DirectMessagingApplicationService.js";

/**
 * Deterministic sequential id generator for tests / injected callers.
 * @param {string} [prefix]
 * @returns {(kind?: string) => string}
 */
export function createSequentialIdProvider(prefix = "comms") {
  let n = 0;
  return {
    nextId(kind = "id") {
      n += 1;
      return `${prefix}-${kind}-${String(n).padStart(4, "0")}`;
    },
  };
}

/**
 * Fixed / injectable clock for deterministic tests.
 * @param {string|number|(() => string|number)} [initial]
 */
export function createFixedClock(initial = "2026-07-24T12:00:00.000Z") {
  let current =
    typeof initial === "function" ? initial() : initial;
  return {
    now() {
      return typeof current === "function" ? current() : current;
    },
    /**
     * @param {string|number} next
     */
    set(next) {
      current = next;
    },
  };
}

/**
 * Simple in-memory identity actor double for tests.
 * @param {Iterable<string>|[string, boolean][]} [activeIds]
 */
export function createMemoryIdentityActorPort(activeIds = []) {
  /** @type {Map<string, boolean>} */
  const active = new Map();
  if (Array.isArray(activeIds) || activeIds instanceof Set) {
    for (const entry of activeIds) {
      if (Array.isArray(entry)) {
        active.set(String(entry[0]), Boolean(entry[1]));
      } else {
        active.set(String(entry), true);
      }
    }
  }
  return {
    /**
     * @param {string} authUserId
     * @param {boolean} isActive
     */
    seed(authUserId, isActive = true) {
      active.set(String(authUserId), Boolean(isActive));
    },
    async resolveActor(authUserId) {
      const id = String(authUserId);
      if (!active.has(id)) return null;
      return {
        authUserId: id,
        accountStatus: active.get(id) ? "ACTIVE" : "INACTIVE",
      };
    },
    async isAccountActive(authUserId) {
      return active.get(String(authUserId)) === true;
    },
  };
}

/**
 * @param {object} [options]
 * @returns {object}
 */
export function createDirectMessagingApplication(options = {}) {
  const idProvider =
    options.idProvider ||
    (typeof options.idGenerator === "function"
      ? { nextId: options.idGenerator }
      : createSequentialIdProvider("comms"));
  const clock = options.clock || createFixedClock();

  let repositories = options.repositories;
  if (!repositories) {
    if (options.useInMemoryRepositories === false) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
        "repositories must be provided when useInMemoryRepositories is false"
      );
    }
    repositories = createInMemoryDirectMessagingRepositories();
  }

  const identityActorPort =
    options.identityActorPort || createMemoryIdentityActorPort();
  const accessPolicy =
    options.accessPolicy || createAllowAllDirectMessagingAccessPolicy();
  const blockStateReader =
    options.blockStateReader || repositories.blockState;

  const directMessaging = createDirectMessagingApplicationService({
    conversationRepository: repositories.conversations,
    requestRepository: repositories.requests,
    messageRepository: repositories.messages,
    readCursorRepository: repositories.readCursors,
    blockStateReader,
    identityActorPort,
    accessPolicy,
    clock,
    idProvider,
  });

  return Object.freeze({
    /** In-memory only on default path — not production persistence. */
    repositories,
    clock,
    idProvider,
    identityActorPort,
    accessPolicy,
    directMessaging,
  });
}
