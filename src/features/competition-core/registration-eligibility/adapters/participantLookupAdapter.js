/**
 * Core-02 Participant → Core-03 ParticipantLookupPort adapter.
 *
 * Injected facade only — no deep imports into Core-02 private modules.
 */

import { REGISTRATION_TARGET_TYPE } from "../enums/registrationTargetType.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  CORE03_SIBLING_ADAPTER_NAME,
  CORE03_SIBLING_CAPABILITY,
  createSiblingAdapterMetadata,
  defensiveCopy,
} from "./adapterMetadata.js";

export const PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION = "core02-participant-getById-v1";

/**
 * @typedef {Object} Core02ParticipantLookupFacade
 * @property {(id: string) => Promise<unknown|null>|unknown|null} getById
 */

/**
 * @param {unknown} raw
 * @param {string} requestedId
 * @returns {{ id: string, status: string, [k: string]: unknown }|null}
 */
export function normalizeParticipantRecord(raw, requestedId) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id =
    raw.id != null && String(raw.id).trim() !== ""
      ? String(raw.id).trim()
      : String(requestedId).trim();
  if (!id) return null;

  const normalized = {
    id,
    status: String(raw.status || "UNKNOWN").toUpperCase(),
  };

  for (const key of ["birthDate", "gender", "rating", "displayName", "competitionId"]) {
    if (raw[key] !== undefined) {
      normalized[key] = defensiveCopy(raw[key]);
    }
  }

  return defensiveCopy(normalized);
}

/**
 * @param {{
 *   core02ParticipantLookup?: Core02ParticipantLookupFacade|null,
 *   clock?: { now: () => string }|null,
 * }} [dependencies]
 */
export function createCore02ParticipantLookupAdapter(dependencies = {}) {
  const facade = dependencies.core02ParticipantLookup ?? null;
  const clock = dependencies.clock ?? null;

  /**
   * @param {string[]} ids
   */
  async function resolveByIds(ids = []) {
    const resolvedAt = clock && typeof clock.now === "function" ? String(clock.now()) : null;

    if (!facade || typeof facade.getById !== "function") {
      return {
        ok: false,
        participants: [],
        missingIds: [...ids].map(String).sort(),
        errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_API_UNAVAILABLE,
        adapterMetadata: createSiblingAdapterMetadata({
          adapterName: CORE03_SIBLING_ADAPTER_NAME.PARTICIPANT_LOOKUP,
          siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_PARTICIPANT,
          siblingContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
          resolvedAt,
          warnings: ["CORE02_PARTICIPANT_FACADE_UNAVAILABLE"],
        }),
      };
    }

    /** @type {Array<{ id: string, status: string, [k: string]: unknown }>} */
    const participants = [];
    /** @type {string[]} */
    const missingIds = [];

    // Preserve input order for getByIds port semantics.
    for (const rawId of ids) {
      const id = String(rawId || "").trim();
      if (!id) continue;
      let raw;
      try {
        raw = await facade.getById(id);
      } catch {
        return {
          ok: false,
          participants: [],
          missingIds: [id],
          errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.PARTICIPANT_LOOKUP,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_PARTICIPANT,
            siblingContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            sourceIds: [id],
            warnings: ["CORE02_PARTICIPANT_EXCEPTION"],
          }),
        };
      }
      const normalized = normalizeParticipantRecord(raw, id);
      if (!normalized) {
        missingIds.push(id);
      } else {
        participants.push(normalized);
      }
    }

    return {
      ok: missingIds.length === 0,
      participants,
      missingIds: [...missingIds].sort(),
      errorCode:
        missingIds.length > 0 ? REGISTRATION_ELIGIBILITY_ERROR_CODE.PARTICIPANT_NOT_FOUND : null,
      adapterMetadata: createSiblingAdapterMetadata({
        adapterName: CORE03_SIBLING_ADAPTER_NAME.PARTICIPANT_LOOKUP,
        siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_PARTICIPANT,
        siblingContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
        resolvedAt,
        sourceIds: participants.map((p) => p.id),
      }),
    };
  }

  return {
    getAdapterMetadata() {
      return createSiblingAdapterMetadata({
        adapterName: CORE03_SIBLING_ADAPTER_NAME.PARTICIPANT_LOOKUP,
        siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_PARTICIPANT,
        siblingContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
      });
    },

    /**
     * Port method — returns defensive participant rows in request order.
     * Missing participants are omitted (executor fail-closes). Never falls back
     * to auth user or first-available participant.
     * @param {string[]} ids
     */
    async getByIds(ids = []) {
      const result = await resolveByIds(Array.isArray(ids) ? ids : []);
      return result.participants.map((p) => defensiveCopy(p));
    },

    /**
     * Richer Phase 1E lookup for INDIVIDUAL / PAIR / TEAM-derived identities.
     * @param {{
     *   targetType: string,
     *   participantId?: string|null,
     *   participantIds?: string[],
     *   representativeParticipantId?: string|null,
     *   teamId?: string|null,
     *   authUserId?: string|null,
     * }} request
     */
    async lookupParticipants(request = {}) {
      const resolvedAt = clock && typeof clock.now === "function" ? String(clock.now()) : null;
      const targetType = String(request.targetType || "").trim();

      // Explicitly ignore authUserId — never use as participant fallback.
      void request.authUserId;

      if (targetType === REGISTRATION_TARGET_TYPE.INDIVIDUAL) {
        const id = String(request.participantId || "").trim();
        if (!id) {
          return {
            ok: false,
            participants: [],
            canonicalParticipantIds: [],
            errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.PARTICIPANT_NOT_FOUND,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.PARTICIPANT_LOOKUP,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_PARTICIPANT,
              siblingContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
              resolvedAt,
              warnings: ["MISSING_PARTICIPANT_ID"],
            }),
          };
        }
        const result = await resolveByIds([id]);
        return {
          ...result,
          canonicalParticipantIds: result.participants.map((p) => p.id),
          participants: result.participants.map((p) => defensiveCopy(p)),
        };
      }

      if (targetType === REGISTRATION_TARGET_TYPE.PAIR) {
        const ids = Array.isArray(request.participantIds)
          ? request.participantIds.map((id) => String(id).trim()).filter(Boolean)
          : [];
        if (ids.length !== 2) {
          return {
            ok: false,
            participants: [],
            canonicalParticipantIds: [],
            errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.PARTICIPANT_NOT_FOUND,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.PARTICIPANT_LOOKUP,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_PARTICIPANT,
              siblingContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
              resolvedAt,
              warnings: ["PAIR_REQUIRES_TWO_PARTICIPANTS"],
            }),
          };
        }
        if (ids[0] === ids[1]) {
          return {
            ok: false,
            participants: [],
            canonicalParticipantIds: [],
            errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TARGET,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.PARTICIPANT_LOOKUP,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_PARTICIPANT,
              siblingContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
              resolvedAt,
              sourceIds: ids,
              warnings: ["DUPLICATE_PAIR_IDENTITY"],
            }),
          };
        }
        const canonicalIds = [...ids].sort();
        const result = await resolveByIds(canonicalIds);
        // Return participants in canonical pair order.
        const byId = new Map(result.participants.map((p) => [p.id, p]));
        const ordered = canonicalIds
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((p) => defensiveCopy(p));
        return {
          ...result,
          ok: result.ok && ordered.length === 2,
          participants: ordered,
          canonicalParticipantIds: canonicalIds,
        };
      }

      if (targetType === REGISTRATION_TARGET_TYPE.TEAM) {
        const representativeId = String(request.representativeParticipantId || "").trim();
        if (!representativeId) {
          return {
            ok: true,
            participants: [],
            canonicalParticipantIds: [],
            errorCode: null,
            notApplicable: true,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.PARTICIPANT_LOOKUP,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_PARTICIPANT,
              siblingContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
              resolvedAt,
              warnings: ["TEAM_WITHOUT_REPRESENTATIVE"],
            }),
          };
        }
        const result = await resolveByIds([representativeId]);
        return {
          ...result,
          canonicalParticipantIds: result.participants.map((p) => p.id),
          participants: result.participants.map((p) => defensiveCopy(p)),
        };
      }

      return {
        ok: false,
        participants: [],
        canonicalParticipantIds: [],
        errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TARGET,
        adapterMetadata: createSiblingAdapterMetadata({
          adapterName: CORE03_SIBLING_ADAPTER_NAME.PARTICIPANT_LOOKUP,
          siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_PARTICIPANT,
          siblingContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
          resolvedAt,
          warnings: ["UNSUPPORTED_TARGET_TYPE"],
        }),
      };
    },
  };
}
