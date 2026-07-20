/**
 * Internal admin verification queue DTO projector (Phase 1H-B).
 *
 * Privileged internal surface — not the public/directory projector.
 * Returns only the minimum fields needed for an admin review queue.
 * Never pass through raw privacy_settings or unrelated PII.
 */
import { normalizeActivityRegion } from "../adapters/activityRegionAdapter.js";
import { normalizeVerificationStatus } from "../adapters/verificationAdapter.js";
import { buildAuthLinkedPlayerId, trimId } from "../utils/playerId.js";

function extractVenueId(row) {
  if (!row || typeof row !== "object") return null;
  return (
    trimId(row.venue_id) ||
    trimId(row.venueId) ||
    trimId(row.tenant_id) ||
    trimId(row.tenantId) ||
    null
  );
}

function extractAuthUserId(row) {
  if (!row || typeof row !== "object") return null;
  return (
    trimId(row.id) ||
    trimId(row.authUserId) ||
    trimId(row.auth_user_id) ||
    trimId(row.user_id) ||
    trimId(row.userId) ||
    null
  );
}

function extractPlayerId(row, authUserId) {
  const mapped =
    trimId(row?.player_id) ||
    trimId(row?.playerId) ||
    null;
  if (mapped) return mapped;
  if (authUserId) return buildAuthLinkedPlayerId(authUserId);
  return null;
}

function extractActivityRegion(row) {
  if (!row || typeof row !== "object") return null;
  const raw = row.activity_region ?? row.activityRegion;
  if (raw === undefined || raw === null) return null;
  return normalizeActivityRegion(raw);
}

function extractUpdatedAt(row) {
  if (!row || typeof row !== "object") return null;
  const raw = row.updated_at ?? row.updatedAt ?? null;
  if (raw == null || raw === "") return null;
  return String(raw);
}

/**
 * @param {object|null|undefined} row — profiles-shaped or adapted row
 * @returns {object|null}
 */
export function projectAdminVerificationQueueItem(row) {
  if (!row || typeof row !== "object") return null;

  const authUserId = extractAuthUserId(row);
  const playerId = extractPlayerId(row, authUserId);
  if (!playerId && !authUserId) return null;

  const verificationRaw =
    row.identity_verification_status ??
    row.identityVerificationStatus ??
    row.verificationStatus;

  return Object.freeze({
    playerId: playerId || null,
    authUserId: authUserId || null,
    displayName:
      nullIfEmpty(row.display_name ?? row.displayName) || null,
    activityRegion: extractActivityRegion(row),
    verificationStatus: normalizeVerificationStatus(verificationRaw),
    venueId: extractVenueId(row),
    updatedAt: extractUpdatedAt(row),
  });
}

function nullIfEmpty(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

/** Keys allowed on the admin queue DTO (documentation / test contract). */
export const ADMIN_VERIFICATION_QUEUE_DTO_FIELDS = Object.freeze([
  "playerId",
  "authUserId",
  "displayName",
  "activityRegion",
  "verificationStatus",
  "venueId",
  "updatedAt",
]);

/** Sensitive / out-of-scope fields that must never appear on queue DTOs. */
export const ADMIN_VERIFICATION_QUEUE_EXCLUDED_FIELDS = Object.freeze([
  "privacy_settings",
  "privacySettings",
  "email",
  "phone",
  "birth_date",
  "birthDate",
  "birth_year",
  "birthYear",
  "handedness",
  "avatar_url",
  "avatarUrl",
  "role",
  "roles",
  "permissions",
  "password",
  "token",
  "accessToken",
  "refreshToken",
]);
