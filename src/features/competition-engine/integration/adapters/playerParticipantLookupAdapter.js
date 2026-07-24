/**
 * INT-03 — Player Profile → ParticipantLookupPort adapter.
 *
 * Resolves canonical player/profile for registration, seeding, display.
 * Does not copy Player Management ownership. Missing mapping is explicit.
 */

import { mapPlayerProfileToParticipantReference } from "../../../competition-core/participants/compatibility/mapPlayerClubRead.js";
import { getPlayerProfile } from "../../../player/services/getPlayerProfile.js";
import { RESOLUTION_OUTCOME } from "../../../player/constants/resolutionOutcomes.js";
import { INTEGRATION_ERROR_CODE } from "../constants.js";
import { optionalNonEmptyString } from "../context/requireIntegrationContext.js";
import { normalizeAdapterError } from "../errors.js";

/**
 * @param {unknown} resolution
 * @returns {boolean}
 */
function isSuccessfulResolution(resolution) {
  const outcome = resolution?.outcome;
  return (
    outcome === RESOLUTION_OUTCOME.MAPPED ||
    outcome === RESOLUTION_OUTCOME.DERIVED
  );
}

/**
 * @param {{
 *   getPlayerProfile?: (playerId: string, options?: object) => object,
 *   clubId?: string|null,
 *   mapProfile?: typeof mapPlayerProfileToParticipantReference,
 * }} [deps]
 * @returns {import('../../../competition-core/registration-eligibility/ports/participantLookupPort.js').ParticipantLookupPort & {
 *   resolveParticipantSnapshot: (playerId: string) => object,
 * }}
 */
export function createPlayerParticipantLookupAdapter(deps = {}) {
  const loadProfile =
    typeof deps.getPlayerProfile === "function"
      ? deps.getPlayerProfile
      : getPlayerProfile;
  const mapProfile =
    typeof deps.mapProfile === "function"
      ? deps.mapProfile
      : mapPlayerProfileToParticipantReference;
  const defaultClubId = optionalNonEmptyString(deps.clubId);

  /**
   * @param {string} playerId
   */
  function resolveParticipantSnapshot(playerId) {
    const id = optionalNonEmptyString(playerId);
    if (!id) {
      return {
        ok: false,
        code: INTEGRATION_ERROR_CODE.INVALID_REQUEST,
        participant: null,
        reasonCodes: [INTEGRATION_ERROR_CODE.INVALID_REQUEST],
      };
    }

    try {
      const resolution = loadProfile(id, {
        ...(defaultClubId ? { clubId: defaultClubId } : {}),
      });

      if (!isSuccessfulResolution(resolution) || !resolution?.profile) {
        return {
          ok: false,
          code: INTEGRATION_ERROR_CODE.PLAYER_MAPPING_MISSING,
          participant: null,
          reasonCodes: [
            INTEGRATION_ERROR_CODE.PLAYER_MAPPING_MISSING,
            resolution?.outcome || RESOLUTION_OUTCOME.UNMAPPED,
          ],
          resolutionOutcome: resolution?.outcome || null,
        };
      }

      const mapped = mapProfile(resolution.profile);
      if (!mapped.success || !mapped.reference) {
        return {
          ok: false,
          code: INTEGRATION_ERROR_CODE.PLAYER_MAPPING_MISSING,
          participant: null,
          reasonCodes: [INTEGRATION_ERROR_CODE.PLAYER_MAPPING_MISSING],
        };
      }

      // Snapshot only — never mutate canonical profile.
      const profileSnapshot = Object.freeze({
        playerId: resolution.playerId || id,
        authUserId: resolution.authUserId || null,
        displayName:
          resolution.profile.displayName ||
          resolution.profile.name ||
          mapped.reference.displayNameSnapshot ||
          null,
      });

      return {
        ok: true,
        code: null,
        participant: Object.freeze({
          id: mapped.reference.id,
          status: "ACTIVE",
          reference: mapped.reference,
          profileSnapshot,
          source: "player-public-read",
        }),
        reasonCodes: [],
        resolutionOutcome: resolution.outcome,
      };
    } catch (err) {
      const normalized = normalizeAdapterError(
        err,
        INTEGRATION_ERROR_CODE.ADAPTER_FAILURE,
        "Player profile resolution failed"
      );
      return {
        ok: false,
        code: normalized.code,
        participant: null,
        reasonCodes: [normalized.code],
      };
    }
  }

  return {
    async getByIds(ids = []) {
      const unique = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
      const found = [];
      for (const id of unique) {
        const result = resolveParticipantSnapshot(id);
        if (result.ok && result.participant) {
          found.push(result.participant);
        }
      }
      return found;
    },
    resolveParticipantSnapshot,
  };
}
