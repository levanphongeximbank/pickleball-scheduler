/**
 * searchPlayers — directory/search facade over an injected roster.
 *
 * Phase 1F-B2: requires explicit viewer mode.
 * - public / directory → projectPublicPlayerProfile; hidden profiles excluded
 * - internal → full normalized profiles (authorized ops only; never default)
 *
 * Does not write; does not invent players; does not silently merge identities.
 * Does not change authenticated self-profile reads.
 */
import { RESOLUTION_OUTCOME } from "../constants/resolutionOutcomes.js";
import {
  PLAYER_PROFILE_VIEWER_MODE,
  isPublicOrDirectoryMode,
  resolvePlayerProfileViewerMode,
} from "../constants/viewerModes.js";
import { normalizePlayerGender } from "../adapters/genderAdapter.js";
import { adaptBlobPlayerRow } from "../adapters/blobPlayerAdapter.js";
import { normalizePlayerProfile } from "../models/playerProfile.js";
import { projectPublicPlayerProfile } from "../projectors/projectPublicPlayerProfile.js";
import { trimId } from "../utils/playerId.js";

function failClosed(code, message, meta = {}) {
  return {
    ok: false,
    outcome: RESOLUTION_OUTCOME.INVALID,
    code,
    message,
    data: [],
    meta: {
      count: 0,
      hiddenCount: 0,
      limit: meta.limit ?? 0,
      readOnly: true,
      mode: meta.mode ?? null,
      projected: false,
      ...meta,
    },
  };
}

/**
 * @param {object} [filters]
 * @param {string} [filters.query]
 * @param {string} [filters.clubId]
 * @param {string} [filters.gender]
 * @param {object} [options]
 * @param {"public"|"directory"|"internal"} [options.mode] — required
 * @param {"public"|"directory"|"internal"} [options.viewerMode] — alias of mode
 * @param {object[]} [options.players]
 * @param {number} [options.limit=50]
 */
export function searchPlayers(filters = {}, options = {}) {
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 50));
  const modeResult = resolvePlayerProfileViewerMode(
    options.mode ?? options.viewerMode
  );
  if (!modeResult.ok) {
    return failClosed(modeResult.code, modeResult.message, { limit });
  }

  const mode = modeResult.mode;
  const players = Array.isArray(options.players) ? options.players : [];
  const query = trimId(filters.query || filters.q).toLowerCase();
  const genderFilter =
    filters.gender != null && String(filters.gender).trim() !== ""
      ? normalizePlayerGender(filters.gender)
      : null;
  const clubId = trimId(filters.clubId) || null;
  const projectPublic = isPublicOrDirectoryMode(mode);

  const results = [];
  let hiddenCount = 0;

  for (const row of players) {
    const adapted = adaptBlobPlayerRow(row, {
      clubId: clubId || row?.clubId || null,
    });
    if (!adapted?.playerId) continue;

    // Roster rows may carry profiles-shaped foundation fields (not all mapped by blob adapter).
    // Keep raw privacy for the projector; do not let normalizePlayerProfile throw on malformed privacy.
    const privacyRaw =
      adapted.privacySettings ??
      row?.privacySettings ??
      row?.privacy_settings ??
      null;

    let normalized;
    try {
      normalized = normalizePlayerProfile({
        ...adapted,
        email: adapted.email ?? row?.email ?? null,
        birthDate: adapted.birthDate ?? row?.birth_date ?? row?.birthDate ?? null,
        birthYear: adapted.birthYear ?? row?.birth_year ?? row?.birthYear ?? null,
        handedness: adapted.handedness ?? row?.handedness ?? null,
        activityRegion:
          adapted.activityRegion ?? row?.activity_region ?? row?.activityRegion ?? null,
        verificationStatus:
          adapted.verificationStatus ??
          row?.identity_verification_status ??
          row?.identityVerificationStatus ??
          row?.verificationStatus ??
          null,
        privacySettings: privacyRaw,
        sourceReferences: adapted.sourceReferences,
      });
    } catch {
      if (projectPublic) {
        hiddenCount += 1;
        continue;
      }
      normalized = normalizePlayerProfile({
        ...adapted,
        email: adapted.email ?? row?.email ?? null,
        birthDate: adapted.birthDate ?? row?.birth_date ?? row?.birthDate ?? null,
        birthYear: adapted.birthYear ?? row?.birth_year ?? row?.birthYear ?? null,
        handedness: adapted.handedness ?? row?.handedness ?? null,
        activityRegion:
          adapted.activityRegion ?? row?.activity_region ?? row?.activityRegion ?? null,
        verificationStatus:
          adapted.verificationStatus ??
          row?.identity_verification_status ??
          row?.identityVerificationStatus ??
          row?.verificationStatus ??
          null,
        privacySettings: null,
        sourceReferences: adapted.sourceReferences,
      });
    }

    // Ensure projector sees original privacy payload (including malformed) for fail-closed reasons.
    if (projectPublic && privacyRaw !== undefined) {
      normalized = { ...normalized, privacySettings: privacyRaw };
    }

    // Query match — public/directory never match on authUserId.
    if (query) {
      const hay = projectPublic
        ? `${normalized.displayName || ""} ${normalized.playerId || ""}`.toLowerCase()
        : `${normalized.displayName || ""} ${normalized.playerId || ""} ${normalized.authUserId || ""}`.toLowerCase();
      if (!hay.includes(query)) continue;
    }

    if (projectPublic) {
      const projected = projectPublicPlayerProfile(normalized);
      if (!projected.visible) {
        hiddenCount += 1;
        continue;
      }

      if (
        genderFilter &&
        (projected.gender == null ||
          normalizePlayerGender(projected.gender) !== genderFilter)
      ) {
        continue;
      }

      results.push(projected);
    } else {
      // internal — full normalized profile
      if (
        genderFilter &&
        normalizePlayerGender(normalized.gender) !== genderFilter
      ) {
        continue;
      }
      results.push(normalized);
    }

    if (results.length >= limit) break;
  }

  return {
    ok: true,
    outcome: RESOLUTION_OUTCOME.MAPPED,
    code: null,
    message: null,
    data: results,
    meta: {
      count: results.length,
      hiddenCount,
      limit,
      readOnly: true,
      mode,
      projected: projectPublic,
      hiddenProfilePolicy: projectPublic ? "exclude" : "n/a",
    },
  };
}

/** Public directory/search — always projected. */
export function searchPublicPlayers(filters = {}, options = {}) {
  return searchPlayers(filters, {
    ...options,
    mode: PLAYER_PROFILE_VIEWER_MODE.PUBLIC,
  });
}

/** Directory search — same fail-closed projector policy as public. */
export function searchDirectoryPlayers(filters = {}, options = {}) {
  return searchPlayers(filters, {
    ...options,
    mode: PLAYER_PROFILE_VIEWER_MODE.DIRECTORY,
  });
}

/**
 * Internal ops search — full normalized profiles.
 * Callers must be authorized internal surfaces; never use as a public default.
 */
export function searchInternalPlayers(filters = {}, options = {}) {
  return searchPlayers(filters, {
    ...options,
    mode: PLAYER_PROFILE_VIEWER_MODE.INTERNAL,
  });
}
