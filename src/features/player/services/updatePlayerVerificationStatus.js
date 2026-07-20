/**
 * updatePlayerVerificationStatus — Phase 1H-A privileged admin writer.
 *
 * Explicit privileged API. Never use updatePlayerProfile / updateSelfProfile
 * for identity_verification_status. App authz mirrors existing Identity
 * user.manage + venue rules; Production DB self-write guard remains authoritative.
 */
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { guardPermission } from "../../../auth/guardAction.js";
import { hasRole } from "../../../auth/rbac.js";
import { fetchProfileByUserId, updateProfileRowById } from "../../../auth/profileService.js";
import { ROLES } from "../../../auth/roles.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import {
  writeAuditLog,
  AUDIT_ACTIONS,
} from "../../identity/services/auditService.js";
import { adaptProfileRow } from "../adapters/profileAdapter.js";
import { normalizeVerificationStatus, validateVerificationStatus } from "../adapters/verificationAdapter.js";
import { RESOLUTION_OUTCOME } from "../constants/resolutionOutcomes.js";
import { validateVerificationTransition } from "../constants/verificationTransitions.js";
import { WRITE_ERROR_CODES } from "../constants/writableFields.js";
import { normalizePlayerProfile } from "../models/playerProfile.js";
import { mapProfilesWriteError } from "./mapProfilesWriteError.js";
import { resolveCanonicalPlayerId } from "./resolveCanonicalPlayerId.js";
import { trimId } from "../utils/playerId.js";

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    profile: null,
    errors: [{ code, message }],
    ...extra,
  };
}

function extractVenueId(profileRow) {
  if (!profileRow || typeof profileRow !== "object") return null;
  return (
    trimId(profileRow.venue_id) ||
    trimId(profileRow.venueId) ||
    trimId(profileRow.tenant_id) ||
    trimId(profileRow.tenantId) ||
    null
  );
}

function isPlatformAdmin(user) {
  return hasRole(user, ROLES.PLATFORM_ADMIN) || hasRole(user, ROLES.SUPER_ADMIN);
}

/**
 * @param {unknown} playerId
 * @param {unknown} nextStatus
 * @param {object} [options]
 * @param {object} [options.user] — actor override (tests)
 * @param {boolean} [options.rbacEnabled]
 * @param {Function} [options.fetchTargetProfile]
 * @param {Function} [options.updateProfileRowById]
 * @param {Function} [options.writeAuditLog]
 * @param {object} [options.existingProfileRow]
 */
export async function updatePlayerVerificationStatus(playerId, nextStatus, options = {}) {
  const actor = options.user !== undefined ? options.user : getCurrentUser();
  if (!actor?.id) {
    return fail(
      WRITE_ERROR_CODES.NOT_AUTHENTICATED,
      "Authentication required to update verification status"
    );
  }

  const id = trimId(playerId);
  if (!id) {
    return fail(WRITE_ERROR_CODES.PLAYER_ID_REQUIRED, "playerId is required");
  }

  const statusCheck = validateVerificationStatus(nextStatus);
  if (!statusCheck.ok) {
    return fail(
      WRITE_ERROR_CODES.VALIDATION_ERROR,
      statusCheck.errors[0]?.message || "Invalid verification status",
      { errors: statusCheck.errors }
    );
  }
  const desiredStatus = statusCheck.value;

  const resolution = resolveCanonicalPlayerId({ kind: "player_id", id }, options);
  if (resolution.outcome === RESOLUTION_OUTCOME.INVALID) {
    return fail(WRITE_ERROR_CODES.INVALID_IDENTITY, "Cannot update verification for INVALID identity", {
      outcome: resolution.outcome,
      resolution,
    });
  }
  if (resolution.outcome === RESOLUTION_OUTCOME.UNMAPPED) {
    return fail(WRITE_ERROR_CODES.UNMAPPED_IDENTITY, "Cannot update verification for UNMAPPED identity", {
      outcome: resolution.outcome,
      resolution,
    });
  }
  if (resolution.outcome === RESOLUTION_OUTCOME.AMBIGUOUS) {
    return fail(
      WRITE_ERROR_CODES.AMBIGUOUS_IDENTITY,
      "Cannot update verification for AMBIGUOUS identity; refusing silent selection",
      {
        outcome: resolution.outcome,
        candidatePlayerIds: resolution.candidatePlayerIds,
        resolution,
      }
    );
  }

  const canonicalPlayerId = resolution.playerId || id;
  const targetAuthUserId =
    trimId(resolution.authUserId) ||
    trimId(options.authUserId) ||
    trimId(options.existingProfileRow?.id) ||
    null;

  if (!targetAuthUserId) {
    return fail(
      WRITE_ERROR_CODES.UNMAPPED_IDENTITY,
      "Target player has no auth-linked profile id for verification write"
    );
  }

  if (String(actor.id) === String(targetAuthUserId)) {
    return fail(
      WRITE_ERROR_CODES.SELF_VERIFICATION_FORBIDDEN,
      "Players cannot modify their own identity verification status"
    );
  }

  const fetchTargetProfile =
    options.fetchTargetProfile ||
    (async (authUserId) => fetchProfileByUserId(authUserId));

  let profileRow = options.existingProfileRow || null;
  if (!profileRow) {
    const loaded = await fetchTargetProfile(targetAuthUserId);
    if (!loaded?.ok || !loaded.profile) {
      return fail(
        loaded?.code === "PROFILE_NOT_FOUND"
          ? WRITE_ERROR_CODES.PLAYER_NOT_FOUND
          : WRITE_ERROR_CODES.PERSISTENCE_ERROR,
        loaded?.error || "Failed to load target profile for verification update",
        { authUserId: targetAuthUserId }
      );
    }
    profileRow = loaded.profile;
  }

  const targetVenueId = extractVenueId(profileRow);
  const rbacEnabled =
    options.rbacEnabled !== undefined ? Boolean(options.rbacEnabled) : isRbacEnabled();

  // Mirror DB: non–platform-admin requires user.manage + same venue (venue must exist).
  if (!isPlatformAdmin(actor)) {
    if (!targetVenueId) {
      return fail(
        WRITE_ERROR_CODES.UNAUTHORIZED,
        "Target profile has no venue; venue-scoped verification update is not allowed"
      );
    }
    const authz = guardPermission(
      PERMISSIONS.USER_MANAGE,
      { venueId: targetVenueId },
      { user: actor, rbacEnabled }
    );
    if (!authz.ok) {
      return fail(
        WRITE_ERROR_CODES.UNAUTHORIZED,
        authz.error || "Not authorized to update identity verification status",
        { permission: PERMISSIONS.USER_MANAGE, venueId: targetVenueId }
      );
    }
  } else if (rbacEnabled) {
    // Platform admin still requires an authenticated active session under RBAC.
    const authz = guardPermission(PERMISSIONS.USER_MANAGE, {}, { user: actor, rbacEnabled });
    if (!authz.ok) {
      return fail(
        WRITE_ERROR_CODES.UNAUTHORIZED,
        authz.error || "Not authorized to update identity verification status"
      );
    }
  }

  const previousStatus = normalizeVerificationStatus(
    profileRow.identity_verification_status ??
      profileRow.identityVerificationStatus ??
      profileRow.verificationStatus
  );

  const transition = validateVerificationTransition(previousStatus, desiredStatus);
  if (!transition.ok) {
    return fail(transition.code, transition.message, {
      fromStatus: transition.from,
      toStatus: transition.to,
      allowed: transition.allowed,
    });
  }

  const persist =
    options.updateProfileRowById || updateProfileRowById;
  const writeResult = await persist(targetAuthUserId, {
    identity_verification_status: desiredStatus,
    updated_at: new Date().toISOString(),
  });

  if (!writeResult?.ok) {
    const mapped = mapProfilesWriteError(
      { message: writeResult?.error, code: writeResult?.code },
      { preferNotFound: true }
    );
    return fail(mapped.code, mapped.message, {
      fromStatus: previousStatus,
      toStatus: desiredStatus,
      authUserId: targetAuthUserId,
      playerId: canonicalPlayerId,
      durable: false,
    });
  }

  const audit =
    options.writeAuditLog || writeAuditLog;
  await audit({
    action: AUDIT_ACTIONS.PLAYER_VERIFICATION_STATUS_UPDATED,
    resourceType: "player_profile",
    resourceId: canonicalPlayerId,
    venueId: targetVenueId || actor.venueId || null,
    clubId: actor.clubId || null,
    actor,
    metadata: {
      actorUserId: actor.id,
      targetAuthUserId,
      targetPlayerId: canonicalPlayerId,
      previousStatus,
      nextStatus: desiredStatus,
      venueId: targetVenueId,
    },
  });

  const adapted = adaptProfileRow(writeResult.profile || {
    ...profileRow,
    identity_verification_status: desiredStatus,
  });
  const profile = normalizePlayerProfile({
    ...adapted,
    playerId: adapted?.playerId || canonicalPlayerId,
    authUserId: adapted?.authUserId || targetAuthUserId,
    verificationStatus: desiredStatus,
  });

  return {
    ok: true,
    code: null,
    message: null,
    playerId: canonicalPlayerId,
    authUserId: targetAuthUserId,
    fromStatus: previousStatus,
    toStatus: desiredStatus,
    venueId: targetVenueId,
    profile,
    durable: true,
    errors: [],
  };
}
