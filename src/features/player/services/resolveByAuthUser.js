/**
 * resolveByAuthUser — map an auth account to canonical player identity (read-first).
 *
 * Outcomes: MAPPED | DERIVED | UNMAPPED | INVALID | AMBIGUOUS
 * Never silently picks the first of multiple conflicting candidates.
 */
import {
  resolvePlayerForProfile,
} from "../../club/repositories/canonicalPlayerRepository.js";
import { buildDerivedAuthPlayerId } from "../../club/repositories/canonicalRepositoryTypes.js";
import { MAPPING_STATUS } from "../../club/repositories/canonicalRepositoryTypes.js";
import { RESOLUTION_OUTCOME } from "../constants/resolutionOutcomes.js";
import { buildResolutionResult } from "../models/resolutionResult.js";
import { createPlayerSourceRepository } from "../repositories/playerSourceRepository.js";
import { trimId } from "../utils/playerId.js";

/**
 * Collect distinct plausible player ids for an auth user without choosing one.
 * @param {object} params
 */
function collectCandidatePlayerIds({
  mappedPlayerId,
  derivedPlayerId,
  derivedExists,
  blobPlayerIds,
  extraCandidateIds,
}) {
  const ids = [];
  const push = (id) => {
    const safe = trimId(id);
    if (safe && !ids.includes(safe)) ids.push(safe);
  };

  if (mappedPlayerId) push(mappedPlayerId);
  if (derivedExists && derivedPlayerId) push(derivedPlayerId);
  for (const id of blobPlayerIds || []) push(id);
  for (const id of extraCandidateIds || []) push(id);
  return ids;
}

/**
 * @param {unknown} authUserId
 * @param {object} [options]
 * @param {object} [options.profile] — Identity profiles row (or partial)
 * @param {(playerId: string) => object|null|undefined} [options.findPlayerById]
 * @param {string|null} [options.clubId]
 * @param {string[]} [options.candidatePlayerIds] — additional known ids (tests / callers)
 * @param {boolean} [options.allowDerived=true]
 * @param {boolean} [options.requirePlayerRow=true] — when mapped id missing → INVALID
 * @param {object} [options.sourceRepository]
 * @returns {Promise<object>|object}
 */
export function resolveByAuthUser(authUserId, options = {}) {
  const uid = trimId(authUserId);
  if (!uid) {
    return buildResolutionResult({
      outcome: RESOLUTION_OUTCOME.INVALID,
      warnings: ["AUTH_USER_ID_REQUIRED"],
      meta: { reason: "authUserId is empty or malformed" },
    });
  }

  const allowDerived = options.allowDerived !== false;
  const requirePlayerRow = options.requirePlayerRow !== false;
  const sources = options.sourceRepository || createPlayerSourceRepository();
  const findPlayerById = sources.makeFindPlayerById(options.clubId, options.findPlayerById);

  const profile =
    options.profile && typeof options.profile === "object"
      ? options.profile
      : {
          id: uid,
          player_id: options.playerId || options.player_id || null,
          display_name: options.displayName || null,
          status: options.accountStatus || "active",
        };

  // Ensure profile id is the auth user
  const profileForResolve = {
    ...profile,
    id: trimId(profile.id || profile.profileId || uid) || uid,
  };

  const mappedPlayerId = trimId(profileForResolve.player_id || profileForResolve.playerId) || null;
  const derivedPlayerId = buildDerivedAuthPlayerId(uid);
  const derivedHit = allowDerived && derivedPlayerId ? findPlayerById(derivedPlayerId) : null;
  const derivedExists = Boolean(derivedHit);

  const blobPartials = sources.listBlobPlayersForAuthUser(uid, options.clubId);
  const blobPlayerIds = blobPartials.map((p) => p.playerId).filter(Boolean);

  const candidates = collectCandidatePlayerIds({
    mappedPlayerId,
    derivedPlayerId,
    derivedExists,
    blobPlayerIds,
    extraCandidateIds: options.candidatePlayerIds,
  });

  // Conflicting distinct identities → AMBIGUOUS (never first-match)
  // Exclude the case where only mapped + same derived/blob duplicates of that id exist.
  if (candidates.length > 1) {
    return buildResolutionResult({
      outcome: RESOLUTION_OUTCOME.AMBIGUOUS,
      playerId: null,
      authUserId: uid,
      candidatePlayerIds: candidates,
      warnings: ["AMBIGUOUS_PLAYER_IDENTITY"],
      meta: {
        reason: "Multiple plausible player identities; refusing silent selection",
        selectable: false,
      },
    });
  }

  // Delegate MAPPED / DERIVED / UNMAPPED / INVALID to existing canonical policy
  const { record, warning } = resolvePlayerForProfile(profileForResolve, {
    findPlayerById: (playerId) => {
      const hit = findPlayerById(playerId);
      if (hit === undefined && !requirePlayerRow) {
        // Cloud-only trust path: existence unknown → treat as present for MAPPED
        return { id: playerId };
      }
      return hit;
    },
    allowDerived,
  });

  const warnings = [];
  if (warning?.code) warnings.push(warning.code);

  let outcome = record.mappingStatus;
  if (outcome === MAPPING_STATUS.MAPPED) outcome = RESOLUTION_OUTCOME.MAPPED;
  else if (outcome === MAPPING_STATUS.DERIVED) outcome = RESOLUTION_OUTCOME.DERIVED;
  else if (outcome === MAPPING_STATUS.INVALID) outcome = RESOLUTION_OUTCOME.INVALID;
  else outcome = RESOLUTION_OUTCOME.UNMAPPED;

  return buildResolutionResult({
    outcome,
    playerId: record.playerId,
    authUserId: uid,
    candidatePlayerIds: candidates,
    warnings,
    meta: {
      mappingStatus: record.mappingStatus,
      displayName: record.displayName || null,
      clubId: options.clubId || null,
      tenantId: options.tenantId || null,
      canonicalWarning: warning || null,
    },
  });
}

/**
 * Async variant when profile/athlete loaders are async.
 * @param {unknown} authUserId
 * @param {object} [options]
 */
export async function resolveByAuthUserAsync(authUserId, options = {}) {
  const uid = trimId(authUserId);
  if (!uid) {
    return resolveByAuthUser(authUserId, options);
  }

  const sources = options.sourceRepository || createPlayerSourceRepository();
  let profile = options.profile;
  if (!profile && typeof options.loadProfileByUserId === "function") {
    profile = await options.loadProfileByUserId(uid);
  } else if (!profile) {
    const adapted = await sources.getProfile(uid);
    if (adapted) {
      profile = {
        id: adapted.authUserId,
        player_id: adapted.playerId,
        display_name: adapted.displayName,
        status: adapted.accountStatus,
        gender: adapted.gender,
        phone: adapted.phone,
        email: adapted.email,
        avatar_url: adapted.avatarUrl,
        birth_year: adapted.birthYear,
      };
    }
  }

  return resolveByAuthUser(uid, { ...options, profile, sourceRepository: sources });
}
