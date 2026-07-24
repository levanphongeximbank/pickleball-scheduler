/**
 * Community channel identity helpers (COMMS-04).
 * channelKey is immutable identity; channel name is mutable metadata.
 */

import {
  COMMUNITY_CHANNEL_KIND,
  isCommunityChannelKind,
  isDefaultCommunityChannelKind,
} from "../constants/communityChannelKinds.js";
import {
  COMMUNITY_CHANNEL_VISIBILITY,
  isCommunityChannelVisibility,
} from "../constants/communityChannelVisibility.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { requireOpaqueId } from "./identifiers.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "./shared.js";

/**
 * Build canonical lobby channelKey for a tenant.
 * Does not depend on channel display name.
 *
 * @param {string} tenantId
 * @returns {string}
 */
export function buildCommunityLobbyChannelKey(tenantId) {
  const tenant = requireOpaqueId(tenantId, "tenantId");
  return `community:${tenant}:${COMMUNITY_CHANNEL_KIND.LOBBY}`;
}

/**
 * Build canonical default channelKey for a tenant + default kind.
 *
 * @param {string} tenantId
 * @param {string} channelKind
 * @returns {string}
 */
export function buildDefaultCommunityChannelKey(tenantId, channelKind) {
  const tenant = requireOpaqueId(tenantId, "tenantId");
  if (!isDefaultCommunityChannelKind(channelKind)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_KIND,
      `Default community channel key requires LOBBY, got: ${String(channelKind)}`,
      {
        channelKind,
        allowed: [COMMUNITY_CHANNEL_KIND.LOBBY],
      }
    );
  }
  return `community:${tenant}:${channelKind}`;
}

/**
 * Build canonical channelKey for a non-lobby community channel.
 * Uses opaque suffix — never the display name.
 *
 * @param {string} tenantId
 * @param {string} channelKind
 * @param {string} channelSuffix
 * @returns {string}
 */
export function buildCommunityChannelKey(tenantId, channelKind, channelSuffix) {
  const tenant = requireOpaqueId(tenantId, "tenantId");
  if (!isCommunityChannelKind(channelKind)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_KIND,
      `Unsupported community channel kind: ${String(channelKind)}`,
      { channelKind }
    );
  }
  if (isDefaultCommunityChannelKind(channelKind)) {
    return buildDefaultCommunityChannelKey(tenant, channelKind);
  }
  const suffix = requireOpaqueId(channelSuffix, "channelSuffix");
  return `community:${tenant}:${channelKind}:${suffix}`;
}

/**
 * @typedef {Object} CommunityChannelIdentityContract
 * @property {string} tenantId
 * @property {string} channelKind
 * @property {string} visibility
 * @property {string} channelKey
 * @property {string|null} name
 */

/**
 * @param {object} input
 * @returns {Readonly<CommunityChannelIdentityContract>}
 */
export function createCommunityChannelIdentityContract(input = {}) {
  const tenantId = requireOpaqueId(input.tenantId, "tenantId");
  if (!isCommunityChannelKind(input.channelKind)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_KIND,
      `Unsupported community channel kind: ${String(input.channelKind)}`,
      {
        channelKind: input.channelKind,
        allowed: Object.values(COMMUNITY_CHANNEL_KIND),
      }
    );
  }
  const channelKind = String(input.channelKind);

  const visibilityRaw =
    input.visibility == null
      ? channelKind === COMMUNITY_CHANNEL_KIND.LOBBY
        ? COMMUNITY_CHANNEL_VISIBILITY.PUBLIC
        : COMMUNITY_CHANNEL_VISIBILITY.JOIN_REQUIRED
      : input.visibility;
  if (!isCommunityChannelVisibility(visibilityRaw)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_VISIBILITY,
      `Unsupported community channel visibility: ${String(visibilityRaw)}`,
      {
        visibility: visibilityRaw,
        allowed: Object.values(COMMUNITY_CHANNEL_VISIBILITY),
      }
    );
  }
  const visibility = String(visibilityRaw);

  let channelKey;
  if (input.channelKey != null && String(input.channelKey).trim()) {
    channelKey = requireOpaqueId(input.channelKey, "channelKey");
  } else if (isDefaultCommunityChannelKind(channelKind)) {
    channelKey = buildDefaultCommunityChannelKey(tenantId, channelKind);
  } else {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Non-lobby community channel requires channelKey or channelSuffix",
      { tenantId, channelKind }
    );
  }

  if (!channelKey.startsWith(`community:${tenantId}:`)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_TENANT_MISMATCH,
      "channelKey must belong to the same tenantId",
      { tenantId, channelKey }
    );
  }

  const name = optionalNonEmptyString(input.name, "name");

  return deepFreeze({
    tenantId,
    channelKind,
    visibility,
    channelKey,
    name,
  });
}

/**
 * Assert channel cannot move to another tenant.
 * @param {string} existingTenantId
 * @param {string} nextTenantId
 */
export function assertCommunityChannelTenantImmutable(
  existingTenantId,
  nextTenantId
) {
  const existing = requireOpaqueId(existingTenantId, "existingTenantId");
  const next = requireNonEmptyString(nextTenantId, "nextTenantId");
  if (existing !== next) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_TENANT_MISMATCH,
      "Community channel cannot be moved to a different tenant",
      { existingTenantId: existing, nextTenantId: next }
    );
  }
  return true;
}

/**
 * Assert channelKey is immutable once assigned.
 * @param {string} existingKey
 * @param {string} nextKey
 */
export function assertCommunityChannelKeyImmutable(existingKey, nextKey) {
  if (String(existingKey) !== String(nextKey)) {
    failContract(
      COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_KEY_IMMUTABLE,
      "channelKey is immutable",
      { existingKey, nextKey }
    );
  }
  return true;
}
