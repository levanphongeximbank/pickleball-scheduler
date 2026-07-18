/**
 * resolveCanonicalPlayerId — resolve a heterogeneous reference to a player identity outcome.
 */
import { RESOLUTION_OUTCOME } from "../constants/resolutionOutcomes.js";
import { buildResolutionResult } from "../models/resolutionResult.js";
import { createPlayerSourceRepository } from "../repositories/playerSourceRepository.js";
import {
  authUserIdFromAuthLinkedPlayerId,
  isPlausiblePlayerId,
  isRouteAliasId,
  trimId,
} from "../utils/playerId.js";
import { resolveByAuthUser } from "./resolveByAuthUser.js";

/**
 * Normalize reference into a structured shape.
 * @param {unknown} reference
 * @returns {{ kind: string, id: string } | null}
 */
export function parsePlayerReference(reference) {
  if (reference == null) return null;

  if (typeof reference === "string" || typeof reference === "number") {
    const id = trimId(reference);
    if (!id) return null;
    return { kind: "player_id", id };
  }

  if (typeof reference !== "object") return null;

  if (reference.kind && reference.id != null) {
    const id = trimId(reference.id);
    if (!id) return null;
    return { kind: String(reference.kind).trim().toLowerCase(), id };
  }

  const playerId = trimId(reference.playerId || reference.player_id);
  if (playerId) return { kind: "player_id", id: playerId };

  const authUserId = trimId(reference.authUserId || reference.auth_user_id || reference.userId);
  if (authUserId) return { kind: "auth_user", id: authUserId };

  const athleteId = trimId(reference.athleteId || reference.athlete_id);
  if (athleteId) return { kind: "athlete", id: athleteId };

  return null;
}

/**
 * @param {unknown} reference
 * @param {object} [options]
 */
export function resolveCanonicalPlayerId(reference, options = {}) {
  const parsed = parsePlayerReference(reference);
  if (!parsed) {
    return buildResolutionResult({
      outcome: RESOLUTION_OUTCOME.INVALID,
      warnings: ["REFERENCE_REQUIRED"],
      meta: { reason: "Empty or unsupported player reference" },
    });
  }

  const { kind, id } = parsed;

  if (isRouteAliasId(id)) {
    // Route aliases are not canonical — try to unwrap known forms
    if (id.startsWith("profile-")) {
      const authUserId = id.slice("profile-".length);
      return resolveByAuthUser(authUserId, options);
    }
    return buildResolutionResult({
      outcome: RESOLUTION_OUTCOME.INVALID,
      warnings: ["ROUTE_ALIAS_NOT_CANONICAL"],
      meta: { reason: "Route alias ids are not canonical player ids", reference: id, kind },
    });
  }

  if (kind === "auth_user" || kind === "platform_user") {
    return resolveByAuthUser(id, options);
  }

  if (kind === "athlete") {
    // Without an athlete→player link loader result, we cannot invent a player id
    const linkedPlayerId = trimId(options.athletePlayerId || options.playerId);
    const authUserId = trimId(options.authUserId || options.athleteAuthUserId);
    if (authUserId) {
      return resolveByAuthUser(authUserId, options);
    }
    if (!linkedPlayerId) {
      return buildResolutionResult({
        outcome: RESOLUTION_OUTCOME.UNMAPPED,
        authUserId: null,
        candidatePlayerIds: [],
        warnings: ["ATHLETE_UNMAPPED"],
        meta: { athleteId: id, reason: "Athlete has no linked canonical player id" },
      });
    }
    return resolveCanonicalPlayerId({ kind: "player_id", id: linkedPlayerId }, options);
  }

  if (kind === "player_id" || kind === "player_profile" || kind === "player") {
    if (!isPlausiblePlayerId(id)) {
      return buildResolutionResult({
        outcome: RESOLUTION_OUTCOME.INVALID,
        warnings: ["PLAYER_ID_INVALID"],
        meta: { reason: "Malformed player id", reference: id },
      });
    }

    // If this is an auth-linked id, prefer auth resolution (detects AMBIGUOUS)
    const authFromId = authUserIdFromAuthLinkedPlayerId(id);
    if (authFromId && options.preferAuthResolution !== false) {
      const viaAuth = resolveByAuthUser(authFromId, {
        ...options,
        // Do not force profiles.player_id from the string alone
        profile: options.profile || { id: authFromId, player_id: options.mappedPlayerId || null },
      });
      // If auth path found a clear outcome, use it; if UNMAPPED, fall through to id lookup
      if (
        viaAuth.outcome === RESOLUTION_OUTCOME.AMBIGUOUS ||
        viaAuth.outcome === RESOLUTION_OUTCOME.MAPPED ||
        viaAuth.outcome === RESOLUTION_OUTCOME.DERIVED ||
        viaAuth.outcome === RESOLUTION_OUTCOME.INVALID
      ) {
        return viaAuth;
      }
    }

    const sources = options.sourceRepository || createPlayerSourceRepository();
    const findPlayerById = sources.makeFindPlayerById(options.clubId, options.findPlayerById);
    const hit = findPlayerById(id);

    if (hit === null) {
      return buildResolutionResult({
        outcome: RESOLUTION_OUTCOME.UNMAPPED,
        playerId: null,
        authUserId: authFromId,
        candidatePlayerIds: [],
        warnings: ["PLAYER_NOT_FOUND"],
        meta: { reason: "Player id not found in directory", requestedPlayerId: id },
      });
    }

    if (hit === undefined) {
      // Existence unknown — treat as MAPPED only when caller opts in (cloud trust)
      if (options.trustUnknownExistence) {
        return buildResolutionResult({
          outcome: RESOLUTION_OUTCOME.MAPPED,
          playerId: id,
          authUserId: authFromId,
          candidatePlayerIds: [id],
          meta: { reason: "Trusted player id with unknown directory existence" },
        });
      }
      return buildResolutionResult({
        outcome: RESOLUTION_OUTCOME.UNMAPPED,
        playerId: null,
        authUserId: authFromId,
        candidatePlayerIds: [id],
        warnings: ["PLAYER_EXISTENCE_UNKNOWN"],
        meta: { reason: "Player directory unavailable", requestedPlayerId: id },
      });
    }

    // Found in directory — explicit roster hit counts as MAPPED for direct id resolve
    const linkedAuth =
      authFromId ||
      trimId(hit.authUserId || hit.auth_user_id || hit.userId || hit.user_id) ||
      null;

    // If auth linkage yields conflicting candidates, escalate to AMBIGUOUS
    if (linkedAuth) {
      const viaAuth = resolveByAuthUser(linkedAuth, {
        ...options,
        profile: options.profile || {
          id: linkedAuth,
          player_id: options.mappedPlayerId || null,
        },
        candidatePlayerIds: [id, ...(options.candidatePlayerIds || [])],
      });
      if (viaAuth.outcome === RESOLUTION_OUTCOME.AMBIGUOUS) {
        return viaAuth;
      }
    }

    return buildResolutionResult({
      outcome: RESOLUTION_OUTCOME.MAPPED,
      playerId: id,
      authUserId: linkedAuth,
      candidatePlayerIds: [id],
      meta: { reason: "Player id confirmed in directory", source: "directory" },
    });
  }

  return buildResolutionResult({
    outcome: RESOLUTION_OUTCOME.INVALID,
    warnings: ["UNSUPPORTED_REFERENCE_KIND"],
    meta: { kind, id },
  });
}
