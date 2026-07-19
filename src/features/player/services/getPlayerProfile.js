/**
 * getPlayerProfile — read-only normalized player profile facade.
 * Does not invent missing fields. No public profile projector in Phase 1B.
 */
import { RESOLUTION_OUTCOME } from "../constants/resolutionOutcomes.js";
import { mergePlayerProfileParts, normalizePlayerProfile } from "../models/playerProfile.js";
import { buildResolutionResult } from "../models/resolutionResult.js";
import { createPlayerSourceRepository } from "../repositories/playerSourceRepository.js";
import { adaptBlobPlayerRow } from "../adapters/blobPlayerAdapter.js";
import { adaptProfileRow } from "../adapters/profileAdapter.js";
import { adaptAthleteRow } from "../adapters/athleteAdapter.js";
import { trimId } from "../utils/playerId.js";
import { resolveCanonicalPlayerId } from "./resolveCanonicalPlayerId.js";
import { resolveByAuthUser } from "./resolveByAuthUser.js";

/**
 * @param {unknown} playerId
 * @param {object} [options]
 */
export function getPlayerProfile(playerId, options = {}) {
  const id = trimId(playerId);
  if (!id) {
    return buildResolutionResult({
      outcome: RESOLUTION_OUTCOME.INVALID,
      profile: null,
      warnings: ["PLAYER_ID_REQUIRED"],
      meta: { reason: "playerId is required" },
    });
  }

  const resolution = resolveCanonicalPlayerId(
    { kind: "player_id", id },
    options
  );

  if (
    resolution.outcome === RESOLUTION_OUTCOME.INVALID ||
    resolution.outcome === RESOLUTION_OUTCOME.AMBIGUOUS ||
    resolution.outcome === RESOLUTION_OUTCOME.UNMAPPED
  ) {
    return buildResolutionResult({
      ...resolution,
      profile: null,
    });
  }

  const resolvedId = resolution.playerId || id;
  const sources = options.sourceRepository || createPlayerSourceRepository();
  const parts = [];

  // Direct directory / blob hit
  const findPlayerById = sources.makeFindPlayerById(options.clubId, options.findPlayerById);
  const raw = findPlayerById(resolvedId);
  if (raw && typeof raw === "object") {
    const adapted = adaptBlobPlayerRow(raw, { clubId: options.clubId || null });
    if (adapted) parts.push(adapted);
  }

  // Optional injected profile / athlete rows (read-only)
  if (options.profile) {
    const adapted = adaptProfileRow(options.profile);
    if (adapted) parts.push(adapted);
  }
  if (options.athlete) {
    const adapted = adaptAthleteRow(options.athlete);
    if (adapted) parts.push(adapted);
  }
  if (options.blobPlayer) {
    const adapted = adaptBlobPlayerRow(options.blobPlayer, { clubId: options.clubId || null });
    if (adapted) parts.push(adapted);
  }

  // Ensure playerId on profile matches resolved canonical id
  const profile = normalizePlayerProfile(
    mergePlayerProfileParts(
      { playerId: resolvedId, authUserId: resolution.authUserId, source: "resolution" },
      ...parts
    )
  );

  return buildResolutionResult({
    outcome: resolution.outcome,
    playerId: resolvedId,
    authUserId: resolution.authUserId,
    candidatePlayerIds: resolution.candidatePlayerIds,
    warnings: resolution.warnings,
    meta: resolution.meta,
    profile,
  });
}

/**
 * Convenience: resolve auth user then load profile when mapping is safe.
 * @param {unknown} authUserId
 * @param {object} [options]
 */
export function getPlayerProfileByAuthUser(authUserId, options = {}) {
  const resolution = resolveByAuthUser(authUserId, options);
  if (
    resolution.outcome !== RESOLUTION_OUTCOME.MAPPED &&
    resolution.outcome !== RESOLUTION_OUTCOME.DERIVED
  ) {
    return buildResolutionResult({
      ...resolution,
      profile: null,
    });
  }
  return getPlayerProfile(resolution.playerId, {
    ...options,
    profile: options.profile,
    // When auth resolution already accepted a cloud mapping without a blob row,
    // do not fail the second directory probe as UNMAPPED.
    trustUnknownExistence:
      options.trustUnknownExistence === true || options.requirePlayerRow === false,
  });
}
