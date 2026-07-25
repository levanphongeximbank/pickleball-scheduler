/**
 * NEWS-02 — Editorial authorization decisions (fail-closed).
 *
 * Actor identity must come from authentication context projection —
 * never from caller-supplied actor_id for privilege elevation.
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { NewsPublicContentError } from "../errors/NewsPublicContentError.js";
import { CONTENT_SCOPE } from "../constants/contentScopes.js";
import { projectNewsActor } from "../platform/newsPlatformAdoption.js";
import { isOk } from "../platform/newsPlatformAdoption.js";
import {
  NEWS_AUTH_DECISION,
  NEWS_CAPABILITY_PERMISSION_MAP,
  NEWS_EDITORIAL_CAPABILITY,
  NEWS_PERMISSION,
} from "./capabilityMatrix.js";

/**
 * @param {unknown} value
 * @returns {ReadonlyArray<string>}
 */
function normalizePermissionList(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(Boolean)
  );
}

/**
 * @param {{
 *   authContext: {
 *     actorId?: string,
 *     userId?: string,
 *     authUserId?: string,
 *     isPlatformAdmin?: boolean,
 *     isTrustedBackend?: boolean,
 *     permissions?: string[],
 *     tenantId?: string|null,
 *     venueId?: string|null,
 *   },
 *   capability: string,
 *   contentScope?: string|null,
 *   tenantId?: string|null,
 *   venueId?: string|null,
 *   clubId?: string|null,
 *   competitionId?: string|null,
 * }} input
 */
export function authorizeNewsEditorialCapability(input) {
  if (!input || typeof input !== "object") {
    return deny("invalid_auth_input");
  }

  const capability = input.capability;
  if (
    !capability ||
    !Object.values(NEWS_EDITORIAL_CAPABILITY).includes(capability)
  ) {
    return deny("unknown_capability", { capability });
  }

  // Public read does not require authenticated editorial actor.
  if (capability === NEWS_EDITORIAL_CAPABILITY.PUBLIC_READ) {
    return allow({ capability, actorKind: "public" });
  }

  const authContext = input.authContext;
  if (!authContext || typeof authContext !== "object") {
    return deny("missing_auth_context");
  }

  if (authContext.isTrustedBackend === true) {
    return allow({
      capability,
      actorKind: "trusted_backend",
      actorId: "service_role",
    });
  }

  if (authContext.isPlatformAdmin === true) {
    return allow({
      capability,
      actorKind: "platform_administrator",
      actorId: resolveActorId(authContext),
    });
  }

  const actorProjection = projectNewsActor(authContext);
  if (!isOk(actorProjection)) {
    return deny("actor_identity_required", {
      details: actorProjection.error,
    });
  }
  const actorId = String(actorProjection.value.actorId);

  if (!scopeAllows(input, authContext)) {
    return deny("scope_denied", {
      contentScope: input.contentScope,
      tenantId: input.tenantId,
      venueId: input.venueId,
    });
  }

  const permissions = normalizePermissionList(authContext.permissions);
  const required = NEWS_CAPABILITY_PERMISSION_MAP[capability] || [];
  const permitted =
    required.length === 0 ||
    required.some((p) => permissions.includes(p)) ||
    permissions.includes(NEWS_PERMISSION.ADMIN);

  if (!permitted) {
    return deny("permission_denied", {
      capability,
      requiredPermissions: required,
    });
  }

  return allow({ capability, actorId, actorKind: "authenticated" });
}

/**
 * Assert helper — throws typed NEWS error on deny.
 * @param {Parameters<typeof authorizeNewsEditorialCapability>[0]} input
 */
export function assertNewsEditorialCapability(input) {
  const decision = authorizeNewsEditorialCapability(input);
  if (decision.decision !== NEWS_AUTH_DECISION.ALLOW) {
    throw new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.FORBIDDEN,
      `News editorial capability denied: ${input?.capability || "unknown"}`,
      {
        reason: decision.reason,
        capability: input?.capability,
        ...(decision.details || {}),
      }
    );
  }
  return decision;
}

/**
 * Reject explicit actor spoofing attempts (caller tries to pass actor_id as authority).
 * @param {{ claimedActorId?: unknown, authContext?: { actorId?: unknown, userId?: unknown, authUserId?: unknown } }} input
 */
export function rejectActorSpoofing(input) {
  if (!input || typeof input !== "object") return;
  if (input.claimedActorId == null || input.claimedActorId === "") return;
  const auth = input.authContext || {};
  const real =
    auth.actorId ?? auth.userId ?? auth.authUserId ?? null;
  if (real == null || String(real) !== String(input.claimedActorId)) {
    throw new NewsPublicContentError(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.FORBIDDEN,
      "Caller-supplied actor identity is not authoritative",
      { reason: "actor_spoofing_denied" }
    );
  }
}

function resolveActorId(authContext) {
  const raw =
    authContext.actorId ?? authContext.userId ?? authContext.authUserId ?? null;
  return raw == null ? null : String(raw);
}

function scopeAllows(input, authContext) {
  const contentScope = input.contentScope || CONTENT_SCOPE.TENANT;
  if (contentScope === CONTENT_SCOPE.PLATFORM) {
    return authContext.isPlatformAdmin === true;
  }
  const bound = authContext.tenantId ?? authContext.venueId ?? null;
  if (bound == null || bound === "") return false;
  const tenantId = input.tenantId;
  if (tenantId == null || String(tenantId) !== String(bound)) return false;
  if (contentScope === CONTENT_SCOPE.VENUE) {
    const venueId = input.venueId;
    const authVenue = authContext.venueId ?? authContext.tenantId;
    return venueId != null && String(venueId) === String(authVenue);
  }
  if (contentScope === CONTENT_SCOPE.CLUB) {
    return input.clubId != null && String(input.clubId).length > 0;
  }
  if (contentScope === CONTENT_SCOPE.COMPETITION) {
    return input.competitionId != null && String(input.competitionId).length > 0;
  }
  return true;
}

function allow(details) {
  return Object.freeze({
    decision: NEWS_AUTH_DECISION.ALLOW,
    reason: "allowed",
    details: Object.freeze(details || {}),
  });
}

function deny(reason, details) {
  return Object.freeze({
    decision: NEWS_AUTH_DECISION.DENY,
    reason,
    details: Object.freeze(details || {}),
  });
}
