/**
 * updatePlayerProfile — Phase 1C single write path.
 *
 * Resolves canonical identity, validates ownership + field contracts,
 * then persists through a replaceable repository interface.
 * Never creates a second player identity.
 *
 * Runtime default: createDefaultPlayerProfileWriteRepository()
 * (durable Supabase writer when anon/session client is configured;
 * otherwise unconfigured). Tests may inject writeRepository doubles.
 * identityVerificationStatus is forbidden here — use updatePlayerVerificationStatus (Phase 1H-A).
 */
import { RESOLUTION_OUTCOME } from "../constants/resolutionOutcomes.js";
import { WRITE_ERROR_CODES } from "../constants/writableFields.js";
import { normalizeAndValidateWritePatch } from "../adapters/writePatchAdapter.js";
import { normalizePlayerProfile } from "../models/playerProfile.js";
import { createDefaultPlayerProfileWriteRepository } from "../bootstrap/playerProfileWriteBootstrap.js";
import { resolveCanonicalPlayerId } from "./resolveCanonicalPlayerId.js";
import { trimId } from "../utils/playerId.js";

/**
 * @param {unknown} playerId
 * @param {object} patch
 * @param {object} [options]
 * @param {object} [options.profile]
 * @param {Function} [options.findPlayerById]
 * @param {string} [options.clubId]
 * @param {string[]} [options.candidatePlayerIds]
 * @param {object} [options.writeRepository]
 * @param {object} [options.existingProfile]
 * @param {Date|string} [options.referenceDate]
 * @param {object} [options.tenantContext]
 * @param {object} [options.authContext]
 */
export async function updatePlayerProfile(playerId, patch, options = {}) {
  const id = trimId(playerId);
  if (!id) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.PLAYER_ID_REQUIRED,
      message: "playerId is required",
      profile: null,
      errors: [{ code: WRITE_ERROR_CODES.PLAYER_ID_REQUIRED, field: "playerId" }],
    };
  }

  const resolution = resolveCanonicalPlayerId({ kind: "player_id", id }, options);

  if (resolution.outcome === RESOLUTION_OUTCOME.INVALID) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.INVALID_IDENTITY,
      message: "Cannot write profile for INVALID identity",
      outcome: resolution.outcome,
      playerId: null,
      profile: null,
      errors: [{ code: WRITE_ERROR_CODES.INVALID_IDENTITY }],
      resolution,
    };
  }
  if (resolution.outcome === RESOLUTION_OUTCOME.UNMAPPED) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.UNMAPPED_IDENTITY,
      message: "Cannot write profile for UNMAPPED identity",
      outcome: resolution.outcome,
      playerId: null,
      profile: null,
      errors: [{ code: WRITE_ERROR_CODES.UNMAPPED_IDENTITY }],
      resolution,
    };
  }
  if (resolution.outcome === RESOLUTION_OUTCOME.AMBIGUOUS) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.AMBIGUOUS_IDENTITY,
      message: "Cannot write profile for AMBIGUOUS identity; refusing silent selection",
      outcome: resolution.outcome,
      playerId: null,
      candidatePlayerIds: resolution.candidatePlayerIds,
      profile: null,
      errors: [{ code: WRITE_ERROR_CODES.AMBIGUOUS_IDENTITY }],
      resolution,
    };
  }

  const canonicalId = resolution.playerId || id;

  // Hard rule: never create a different identity than resolved
  if (resolution.playerId && resolution.playerId !== canonicalId) {
    return {
      ok: false,
      code: WRITE_ERROR_CODES.DUPLICATE_IDENTITY_FORBIDDEN,
      message: "Refusing to create a second player identity",
      profile: null,
      errors: [{ code: WRITE_ERROR_CODES.DUPLICATE_IDENTITY_FORBIDDEN }],
    };
  }

  const writeRepository =
    options.writeRepository || createDefaultPlayerProfileWriteRepository();

  const existing =
    options.existingProfile ||
    (await writeRepository.getByPlayerId?.(canonicalId)) ||
    normalizePlayerProfile({
      playerId: canonicalId,
      authUserId: resolution.authUserId || options.authUserId || options.authContext?.userId,
    });

  const validated = normalizeAndValidateWritePatch(patch, {
    existing,
    referenceDate: options.referenceDate,
  });

  if (!validated.ok) {
    return {
      ok: false,
      code: validated.code,
      message: validated.errors[0]?.message || validated.code,
      errors: validated.errors,
      forbiddenFields: validated.forbiddenFields,
      profile: null,
      outcome: resolution.outcome,
      playerId: canonicalId,
      durable: false,
    };
  }

  const saveResult = await writeRepository.saveProfileFields(
    canonicalId,
    validated.normalized,
    {
      authUserId:
        resolution.authUserId ||
        trimId(options.authUserId) ||
        trimId(options.authContext?.userId) ||
        null,
      tenantContext: options.tenantContext || null,
      authContext: options.authContext || null,
      clubId: options.clubId || null,
    }
  );

  if (!saveResult.ok) {
    return {
      ok: false,
      code: saveResult.code || WRITE_ERROR_CODES.PERSISTENCE_ERROR,
      message: saveResult.message || "Persistence failed",
      profile: null,
      errors: [{ code: saveResult.code || WRITE_ERROR_CODES.PERSISTENCE_ERROR }],
      outcome: resolution.outcome,
      playerId: canonicalId,
      persistedFields: saveResult.persistedFields || [],
      deferredFields: saveResult.deferredFields || [],
      schemaGaps: saveResult.schemaGaps || [],
      migrationRequired: Boolean(saveResult.migrationRequired),
      durable: false,
    };
  }

  return {
    ok: true,
    code: saveResult.code || null,
    message: saveResult.message || null,
    outcome: resolution.outcome,
    playerId: canonicalId,
    authUserId: resolution.authUserId,
    profile: normalizePlayerProfile(saveResult.profile, {
      referenceDate: options.referenceDate,
    }),
    persistedFields: saveResult.persistedFields || [],
    deferredFields: saveResult.deferredFields || [],
    schemaGaps: saveResult.schemaGaps || [],
    migrationRequired: Boolean(saveResult.migrationRequired),
    durable: saveResult.durable === true,
    errors: [],
  };
}
