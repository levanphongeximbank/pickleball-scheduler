/**
 * Club channel identity helpers (COMMS-03).
 * channelKey is immutable identity; channel name is mutable metadata.
 */

import {
  CLUB_CHANNEL_KIND,
  isClubChannelKind,
  isDefaultClubChannelKind,
} from "../constants/clubChannelKinds.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { requireOpaqueId } from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "./shared.js";

/**
 * Build canonical default channelKey for a club + default kind.
 * Does not depend on channel display name.
 *
 * @param {string} clubId
 * @param {string} channelKind
 * @returns {string}
 */
export function buildDefaultClubChannelKey(clubId, channelKind) {
  const club = requireOpaqueId(clubId, "clubId");
  if (!isDefaultClubChannelKind(channelKind)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CLUB_CHANNEL_KIND,
      `Default channel key requires a default kind, got: ${String(channelKind)}`,
      {
        channelKind,
        allowed: [CLUB_CHANNEL_KIND.GENERAL, CLUB_CHANNEL_KIND.ANNOUNCEMENT],
      }
    );
  }
  return `club:${club}:${channelKind}`;
}

/**
 * Build canonical channelKey for a non-default club channel.
 * Uses opaque suffix — never the display name.
 *
 * @param {string} clubId
 * @param {string} channelKind
 * @param {string} channelSuffix
 * @returns {string}
 */
export function buildClubChannelKey(clubId, channelKind, channelSuffix) {
  const club = requireOpaqueId(clubId, "clubId");
  if (!isClubChannelKind(channelKind)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CLUB_CHANNEL_KIND,
      `Unsupported club channel kind: ${String(channelKind)}`,
      { channelKind }
    );
  }
  if (isDefaultClubChannelKind(channelKind)) {
    return buildDefaultClubChannelKey(club, channelKind);
  }
  const suffix = requireOpaqueId(channelSuffix, "channelSuffix");
  return `club:${club}:${channelKind}:${suffix}`;
}

/**
 * @typedef {Object} ClubChannelIdentityContract
 * @property {string} clubId
 * @property {string} channelKind
 * @property {string} channelKey
 * @property {string|null} name
 */

/**
 * @param {object} input
 * @returns {Readonly<ClubChannelIdentityContract>}
 */
export function createClubChannelIdentityContract(input = {}) {
  const clubId = requireOpaqueId(input.clubId, "clubId");
  if (!isClubChannelKind(input.channelKind)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CLUB_CHANNEL_KIND,
      `Unsupported club channel kind: ${String(input.channelKind)}`,
      {
        channelKind: input.channelKind,
        allowed: Object.values(CLUB_CHANNEL_KIND),
      }
    );
  }
  const channelKind = String(input.channelKind);
  let channelKey;
  if (input.channelKey != null && String(input.channelKey).trim()) {
    channelKey = requireOpaqueId(input.channelKey, "channelKey");
  } else if (isDefaultClubChannelKind(channelKind)) {
    channelKey = buildDefaultClubChannelKey(clubId, channelKind);
  } else {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Non-default club channel requires channelKey or channelSuffix",
      { clubId, channelKind }
    );
  }

  if (!channelKey.startsWith(`club:${clubId}:`)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_CLUB_MISMATCH,
      "channelKey must belong to the same clubId",
      { clubId, channelKey }
    );
  }

  const name = optionalNonEmptyString(input.name, "name");

  return deepFreeze({
    clubId,
    channelKind,
    channelKey,
    name,
  });
}

/**
 * Assert channel cannot move to another club.
 * @param {string} existingClubId
 * @param {string} nextClubId
 */
export function assertClubChannelClubImmutable(existingClubId, nextClubId) {
  const existing = requireOpaqueId(existingClubId, "existingClubId");
  const next = requireNonEmptyString(nextClubId, "nextClubId");
  if (existing !== next) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_CLUB_MISMATCH,
      "Club channel cannot be moved to a different club",
      { existingClubId: existing, nextClubId: next }
    );
  }
  return true;
}

/**
 * Assert channelKey is immutable once assigned.
 * @param {string} existingKey
 * @param {string} nextKey
 */
export function assertClubChannelKeyImmutable(existingKey, nextKey) {
  if (String(existingKey) !== String(nextKey)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_KEY_IMMUTABLE,
      "channelKey is immutable",
      { existingKey, nextKey }
    );
  }
  return true;
}
