/**
 * Core-02 Entry lookup → Core-03 EntryLookupPort adapter.
 *
 * Injected facade only — no deep imports. Does not create/modify entries.
 * Does not alias Core-03 RegistrationStatus to Core-02 Entry status.
 */

import { buildRegistrationTargetStableIdentity } from "../contracts/registrationTarget.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  CORE03_SIBLING_ADAPTER_NAME,
  CORE03_SIBLING_CAPABILITY,
  createSiblingAdapterMetadata,
  defensiveCopy,
} from "./adapterMetadata.js";

export const ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION = "core02-entry-repository-v1";

/** Core-02 active/conflicting entry statuses — explicit, not RegistrationStatus. */
export const CORE02_ACTIVE_ENTRY_STATUSES = Object.freeze(["APPROVED", "ACTIVE", "PENDING"]);

/**
 * @typedef {Object} Core02EntryLookupFacade
 * @property {(competitionId: string) => Promise<unknown[]>|unknown[]} listByCompetition
 * @property {(scope: {
 *   competitionId: string,
 *   divisionId?: string|null,
 *   categoryId?: string|null,
 *   entryRole?: string|null,
 * }) => Promise<unknown[]>|unknown[]} [findActiveDuplicate]
 * @property {(id: string) => Promise<unknown|null>|unknown|null} [getById]
 */

/**
 * Explicit Core-02 Entry status normalization — never maps RegistrationStatus.
 * @param {unknown} status
 * @returns {{ entryStatus: string, isActiveOrConflicting: boolean }}
 */
export function normalizeCore02EntryStatus(status) {
  const entryStatus = String(status || "UNKNOWN").toUpperCase();
  return {
    entryStatus,
    isActiveOrConflicting: CORE02_ACTIVE_ENTRY_STATUSES.includes(entryStatus),
  };
}

/**
 * @param {unknown} raw
 * @returns {{
 *   id: string,
 *   competitionId: string,
 *   divisionId: string|null,
 *   identityKey: string|null,
 *   entryStatus: string,
 *   isActiveOrConflicting: boolean,
 *   participantId: string|null,
 *   teamId: string|null,
 *   pairParticipantIds: string[],
 * }|null}
 */
export function normalizeEntryRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = raw.id != null ? String(raw.id).trim() : "";
  const competitionId = raw.competitionId != null ? String(raw.competitionId).trim() : "";
  if (!id || !competitionId) return null;

  const statusInfo = normalizeCore02EntryStatus(raw.status ?? raw.entryStatus);
  const pairParticipantIds = Array.isArray(raw.pairParticipantIds)
    ? [...raw.pairParticipantIds].map((x) => String(x).trim()).filter(Boolean).sort()
    : Array.isArray(raw.participantIds)
      ? [...raw.participantIds].map((x) => String(x).trim()).filter(Boolean).sort()
      : [];

  return defensiveCopy({
    id,
    competitionId,
    divisionId:
      raw.divisionId != null && String(raw.divisionId).trim() !== ""
        ? String(raw.divisionId).trim()
        : null,
    identityKey:
      raw.identityKey != null && String(raw.identityKey).trim() !== ""
        ? String(raw.identityKey).trim()
        : null,
    entryStatus: statusInfo.entryStatus,
    isActiveOrConflicting: statusInfo.isActiveOrConflicting,
    participantId:
      raw.participantId != null && String(raw.participantId).trim() !== ""
        ? String(raw.participantId).trim()
        : null,
    teamId:
      raw.teamId != null && String(raw.teamId).trim() !== ""
        ? String(raw.teamId).trim()
        : null,
    pairParticipantIds,
  });
}

/**
 * Build Core-03-compatible identity key used by eligibility executor.
 * @param {{ competitionId: string, divisionId?: string|null, target: import('../contracts/registrationTarget.js').RegistrationTarget }} args
 */
export function buildEntryLookupIdentityKey({ competitionId, divisionId, target }) {
  const targetIdentity = buildRegistrationTargetStableIdentity(target);
  return `${competitionId}::${divisionId ?? "NONE"}::${targetIdentity}`;
}

/**
 * @param {{
 *   core02EntryLookup?: Core02EntryLookupFacade|null,
 *   clock?: { now: () => string }|null,
 * }} [dependencies]
 */
export function createCore02EntryLookupAdapter(dependencies = {}) {
  const facade = dependencies.core02EntryLookup ?? null;
  const clock = dependencies.clock ?? null;

  return {
    getAdapterMetadata() {
      return createSiblingAdapterMetadata({
        adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_LOOKUP,
        siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY,
        siblingContractVersion: ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION,
      });
    },

    async getByCompetition(competitionId) {
      const resolvedAt = clock && typeof clock.now === "function" ? String(clock.now()) : null;
      const scopeId = String(competitionId || "").trim();
      if (!scopeId) {
        return [];
      }
      if (!facade || typeof facade.listByCompetition !== "function") {
        return [];
      }
      try {
        const rows = await facade.listByCompetition(scopeId);
        const list = Array.isArray(rows) ? rows : [];
        return list
          .map((row) => normalizeEntryRecord(row))
          .filter(Boolean)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)))
          .map((row) => ({
            ...row,
            // Port-compatible field used by in-memory consumers.
            status: row.entryStatus,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_LOOKUP,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY,
              siblingContractVersion: ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION,
              resolvedAt,
              sourceIds: [row.id],
            }),
          }));
      } catch {
        return [];
      }
    },

    async findByIdentityKey(identityKey) {
      const key = String(identityKey || "").trim();
      if (!key) return null;
      if (!facade || typeof facade.listByCompetition !== "function") return null;

      const competitionId = key.split("::")[0] || "";
      if (!competitionId) return null;

      const rows = await this.getByCompetition(competitionId);
      const found = rows.find((row) => row.identityKey === key) ?? null;
      return found ? defensiveCopy(found) : null;
    },

    /**
     * Richer Phase 1E lookup — competition/division scope + target identity.
     * @param {{
     *   competitionId?: string|null,
     *   divisionId?: string|null,
     *   target?: import('../contracts/registrationTarget.js').RegistrationTarget|null,
     *   identityKey?: string|null,
     * }} request
     */
    async lookupEntries(request = {}) {
      const resolvedAt = clock && typeof clock.now === "function" ? String(clock.now()) : null;
      const competitionId = String(request.competitionId || "").trim();
      if (!competitionId) {
        return {
          ok: false,
          entries: [],
          conflict: null,
          errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_LOOKUP,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY,
            siblingContractVersion: ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            warnings: ["MISSING_COMPETITION_SCOPE"],
          }),
        };
      }

      if (!facade || typeof facade.listByCompetition !== "function") {
        return {
          ok: false,
          entries: [],
          conflict: null,
          errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_API_UNAVAILABLE,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_LOOKUP,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY,
            siblingContractVersion: ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            warnings: ["CORE02_ENTRY_FACADE_UNAVAILABLE"],
          }),
        };
      }

      const divisionId =
        request.divisionId != null && String(request.divisionId).trim() !== ""
          ? String(request.divisionId).trim()
          : null;

      let identityKey =
        request.identityKey != null && String(request.identityKey).trim() !== ""
          ? String(request.identityKey).trim()
          : null;

      if (!identityKey && request.target) {
        try {
          identityKey = buildEntryLookupIdentityKey({
            competitionId,
            divisionId,
            target: request.target,
          });
        } catch {
          return {
            ok: false,
            entries: [],
            conflict: null,
            errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_TARGET,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_LOOKUP,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY,
              siblingContractVersion: ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION,
              resolvedAt,
              warnings: ["INVALID_TARGET_IDENTITY"],
            }),
          };
        }
      }

      try {
        let rows = await facade.listByCompetition(competitionId);
        let list = (Array.isArray(rows) ? rows : [])
          .map((row) => normalizeEntryRecord(row))
          .filter(Boolean);

        if (divisionId != null) {
          list = list.filter((row) => row.divisionId === divisionId);
        }

        if (typeof facade.findActiveDuplicate === "function") {
          const duplicates = await facade.findActiveDuplicate({
            competitionId,
            divisionId,
          });
          const extra = (Array.isArray(duplicates) ? duplicates : [])
            .map((row) => normalizeEntryRecord(row))
            .filter(Boolean);
          const byId = new Map(list.map((row) => [row.id, row]));
          for (const row of extra) {
            byId.set(row.id, row);
          }
          list = [...byId.values()];
        }

        list = list.sort((a, b) => String(a.id).localeCompare(String(b.id)));

        const conflict =
          identityKey != null
            ? list.find(
                (row) =>
                  row.identityKey === identityKey && row.isActiveOrConflicting === true
              ) ?? null
            : list.find((row) => row.isActiveOrConflicting === true) ?? null;

        return {
          ok: true,
          entries: list.map((row) => defensiveCopy(row)),
          conflict: conflict ? defensiveCopy(conflict) : null,
          identityKey,
          competitionId,
          divisionId,
          errorCode: conflict
            ? REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ENTRY_DETECTED
            : null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_LOOKUP,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY,
            siblingContractVersion: ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            sourceIds: list.map((row) => row.id),
            warnings: conflict ? ["ACTIVE_OR_CONFLICTING_ENTRY"] : [],
          }),
        };
      } catch {
        return {
          ok: false,
          entries: [],
          conflict: null,
          errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_LOOKUP,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY,
            siblingContractVersion: ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            warnings: ["CORE02_ENTRY_EXCEPTION"],
          }),
        };
      }
    },
  };
}
