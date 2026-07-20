/**
 * listPlayerVerificationQueue — Phase 1H-B admin verification queue read API.
 *
 * Explicit privileged read. Uses Player facade path + Identity RBAC helpers.
 * Does not mutate verification status. Does not use the public projector.
 */
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { guardPermission } from "../../../auth/guardAction.js";
import { hasRole } from "../../../auth/rbac.js";
import { ROLES } from "../../../auth/roles.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { normalizeVerificationStatus } from "../adapters/verificationAdapter.js";
import {
  VERIFICATION_QUEUE_DEFAULT_LIMIT,
  VERIFICATION_QUEUE_DEFAULT_STATUS,
  VERIFICATION_QUEUE_ERROR_CODES,
  VERIFICATION_QUEUE_MAX_LIMIT,
  VERIFICATION_QUEUE_SUPPORTED_STATUSES,
} from "../constants/verificationQueue.js";
import { projectAdminVerificationQueueItem } from "../projectors/projectAdminVerificationQueueItem.js";
import { listVerificationQueueProfileRows } from "../repositories/verificationQueueRepository.js";
import { trimId } from "../utils/playerId.js";

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    data: [],
    meta: {
      count: 0,
      limit: extra.limit ?? 0,
      status: extra.status ?? null,
      venueId: extra.venueId ?? null,
      query: extra.query ?? "",
      readOnly: true,
      ...extra.meta,
    },
    errors: [{ code, message }],
  };
}

function isPlatformAdmin(user) {
  return hasRole(user, ROLES.PLATFORM_ADMIN) || hasRole(user, ROLES.SUPER_ADMIN);
}

function extractActorVenueId(user) {
  if (!user || typeof user !== "object") return null;
  return trimId(user.venueId) || trimId(user.venue_id) || trimId(user.tenantId) || trimId(user.tenant_id) || null;
}

function normalizeLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return VERIFICATION_QUEUE_DEFAULT_LIMIT;
  return Math.min(VERIFICATION_QUEUE_MAX_LIMIT, Math.floor(n));
}

function normalizeStatusFilter(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return {
      ok: true,
      value: VERIFICATION_QUEUE_DEFAULT_STATUS,
      defaulted: true,
    };
  }
  const normalized = String(raw).trim().toLowerCase();
  if (!VERIFICATION_QUEUE_SUPPORTED_STATUSES.includes(normalized)) {
    return {
      ok: false,
      code: VERIFICATION_QUEUE_ERROR_CODES.UNSUPPORTED_STATUS,
      message: `Unsupported verification queue status filter: ${String(raw)}`,
      value: null,
    };
  }
  return { ok: true, value: normalized, defaulted: false };
}

function matchesSearch(item, query) {
  if (!query) return true;
  const hay = `${item.displayName || ""} ${item.playerId || ""} ${item.authUserId || ""}`.toLowerCase();
  return hay.includes(query);
}

function compareQueueItems(a, b) {
  const aTs = a.updatedAt ? Date.parse(a.updatedAt) : NaN;
  const bTs = b.updatedAt ? Date.parse(b.updatedAt) : NaN;
  const aValid = Number.isFinite(aTs);
  const bValid = Number.isFinite(bTs);

  if (aValid && bValid && aTs !== bTs) {
    return bTs - aTs; // newer first
  }
  if (aValid && !bValid) return -1;
  if (!aValid && bValid) return 1;

  const aId = String(a.playerId || a.authUserId || "");
  const bId = String(b.playerId || b.authUserId || "");
  if (aId < bId) return -1;
  if (aId > bId) return 1;
  return 0;
}

/**
 * @param {object} [options]
 * @param {string} [options.status] — pending|unverified|rejected|verified (default: pending)
 * @param {string} [options.venueId]
 * @param {string} [options.query]
 * @param {string} [options.q]
 * @param {string} [options.search]
 * @param {number} [options.limit]
 * @param {object} [options.user] — actor override (tests)
 * @param {boolean} [options.rbacEnabled]
 * @param {Function} [options.listProfileRows] — injectable profile list
 */
export async function listPlayerVerificationQueue(options = {}) {
  const actor = options.user !== undefined ? options.user : getCurrentUser();
  const limit = normalizeLimit(options.limit);
  const query = trimId(options.query ?? options.q ?? options.search).toLowerCase();

  if (!actor?.id) {
    return fail(
      VERIFICATION_QUEUE_ERROR_CODES.NOT_AUTHENTICATED,
      "Authentication required to list the verification queue",
      { limit, query }
    );
  }

  const statusCheck = normalizeStatusFilter(options.status);
  if (!statusCheck.ok) {
    return fail(statusCheck.code, statusCheck.message, {
      limit,
      query,
      status: null,
    });
  }
  const status = statusCheck.value;

  const rbacEnabled =
    options.rbacEnabled !== undefined ? Boolean(options.rbacEnabled) : isRbacEnabled();
  const requestedVenueId = trimId(options.venueId) || null;
  const actorVenueId = extractActorVenueId(actor);
  const platformAdmin = isPlatformAdmin(actor);

  /** @type {string|null} */
  let scopedVenueId;

  if (platformAdmin) {
    const authz = guardPermission(
      PERMISSIONS.USER_MANAGE,
      requestedVenueId ? { venueId: requestedVenueId } : {},
      { user: actor, rbacEnabled }
    );
    if (!authz.ok) {
      return fail(
        VERIFICATION_QUEUE_ERROR_CODES.UNAUTHORIZED,
        authz.error || "Not authorized to list the verification queue",
        { limit, query, status, venueId: requestedVenueId }
      );
    }
    scopedVenueId = requestedVenueId;
  } else {
    if (!actorVenueId) {
      return fail(
        VERIFICATION_QUEUE_ERROR_CODES.UNAUTHORIZED,
        "Venue-scoped verification queue requires an assigned venue",
        { limit, query, status, venueId: null }
      );
    }
    if (requestedVenueId && requestedVenueId !== actorVenueId) {
      return fail(
        VERIFICATION_QUEUE_ERROR_CODES.UNAUTHORIZED,
        "Not authorized to list verification queue outside assigned venue",
        { limit, query, status, venueId: requestedVenueId }
      );
    }
    scopedVenueId = actorVenueId;
    const authz = guardPermission(
      PERMISSIONS.USER_MANAGE,
      { venueId: scopedVenueId },
      { user: actor, rbacEnabled }
    );
    if (!authz.ok) {
      return fail(
        VERIFICATION_QUEUE_ERROR_CODES.UNAUTHORIZED,
        authz.error || "Not authorized to list the verification queue",
        { limit, query, status, venueId: scopedVenueId }
      );
    }
  }

  const listRows =
    options.listProfileRows ||
    ((queryArgs) => listVerificationQueueProfileRows(queryArgs));

  let listed;
  try {
    listed = await listRows({
      status,
      venueId: scopedVenueId,
      fetchLimit: VERIFICATION_QUEUE_MAX_LIMIT * 2,
    });
  } catch (err) {
    return fail(
      VERIFICATION_QUEUE_ERROR_CODES.PERSISTENCE_ERROR,
      err?.message || "Failed to list verification queue profiles",
      { limit, query, status, venueId: scopedVenueId }
    );
  }

  if (!listed?.ok) {
    const code =
      listed?.code === "PERSISTENCE_UNAVAILABLE"
        ? VERIFICATION_QUEUE_ERROR_CODES.PERSISTENCE_UNAVAILABLE
        : VERIFICATION_QUEUE_ERROR_CODES.PERSISTENCE_ERROR;
    return fail(code, listed?.error || "Failed to list verification queue profiles", {
      limit,
      query,
      status,
      venueId: scopedVenueId,
    });
  }

  const rows = Array.isArray(listed.rows) ? listed.rows : [];
  const items = [];

  for (const row of rows) {
    const item = projectAdminVerificationQueueItem(row);
    if (!item) continue;

    // Defense in depth: never leak cross-venue rows for non–platform admins.
    if (scopedVenueId && item.venueId && item.venueId !== scopedVenueId) {
      continue;
    }
    if (scopedVenueId && !platformAdmin && !item.venueId) {
      continue;
    }
    if (normalizeVerificationStatus(item.verificationStatus) !== status) {
      continue;
    }
    if (!matchesSearch(item, query)) continue;

    items.push(item);
  }

  items.sort(compareQueueItems);
  const data = items.slice(0, limit);

  return {
    ok: true,
    code: null,
    message: null,
    data,
    meta: {
      count: data.length,
      limit,
      status,
      statusDefaulted: Boolean(statusCheck.defaulted),
      venueId: scopedVenueId,
      query,
      readOnly: true,
      sort: "updatedAt_desc_playerId_asc",
      maxLimit: VERIFICATION_QUEUE_MAX_LIMIT,
    },
    errors: [],
  };
}
