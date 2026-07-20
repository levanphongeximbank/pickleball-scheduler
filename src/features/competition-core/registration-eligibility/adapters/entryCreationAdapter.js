/**
 * Core-02 Entry creation / handoff adapter.
 *
 * Audit finding (Phase 1E): Core-02 does not currently expose a stable,
 * approved Entry *creation service* suitable for EntryCreationPort.
 * Public surface provides entity factories (`createCompetitionEntry`) and a
 * structural `EntryRepositoryPort.save` contract only — not an approved
 * registration→entry handoff API.
 *
 * Therefore this adapter is intentionally fail-closed / unavailable.
 * Do not deep-import Core-02 internals to bypass ownership.
 */

import { REGISTRATION_STATUS } from "../enums/registrationStatus.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  CORE03_SIBLING_ADAPTER_NAME,
  CORE03_SIBLING_CAPABILITY,
  createSiblingAdapterMetadata,
} from "./adapterMetadata.js";

export const ENTRY_CREATION_ADAPTER_CONTRACT_VERSION = "core02-entry-creation-unavailable-v1";

export const ENTRY_CREATION_COMPATIBILITY_GAP = Object.freeze({
  sibling: "Core-02 Participant & Entry",
  status: "DEFERRED_FAIL_CLOSED",
  expectedPublicApi:
    "Stable approved createEntryFromRegistration / handoff service on participants public barrel",
  discoveredPublicSurface: [
    "createCompetitionEntry (entity factory only)",
    "createEntryDTOv1 (DTO factory only)",
    "EntryRepositoryPort.save (structural repository contract)",
  ],
  decision: "DEFERRED_FAIL_CLOSED — owner-accepted sibling compatibility gap",
  blockingDependency: "approved Core-02 public registration-to-Entry handoff API",
  phase1FGuidance: Object.freeze({
    mayProceedForCore03OwnedPersistence: true,
    mustNotImplementCore02EntryCreation: true,
    handoffRemainsDeferredUntilCore02PublicApi: true,
  }),
  futureActivationConditions: Object.freeze([
    "stable Core-02 public import path",
    "approved request/result contract",
    "idempotent handoff",
    "duplicate prevention",
    "version metadata",
    "integration tests",
    "ownership review",
  ]),
  errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE,
  experimentalFlagNote:
    "allowUnapprovedFacade / allowUnapprovedEntryCreationFacade is test-only DI; default false; never read from env, HTTP, or request payload",
});

/**
 * Optional future facade — only used when Core-02 publishes an approved API.
 * @typedef {Object} Core02EntryCreationFacade
 * @property {(request: unknown) => Promise<{
 *   ok: boolean,
 *   entryId?: string|null,
 *   entryVersion?: string|null,
 *   errorCode?: string|null,
 *   message?: string|null,
 * }>| {
 *   ok: boolean,
 *   entryId?: string|null,
 *   entryVersion?: string|null,
 *   errorCode?: string|null,
 *   message?: string|null,
 * }} createEntryFromRegistration
 */

/**
 * Build the deterministic unavailable EntryCreationPort result.
 * @param {string|null} resolvedAt
 */
function buildUnavailableEntryCreationResult(resolvedAt) {
  return {
    ok: false,
    entryId: null,
    entryVersion: null,
    errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.ENTRY_CREATION_ADAPTER_UNAVAILABLE,
    message:
      "Core-02 has no stable approved Entry creation public API for registration handoff (Phase 1E deferred)",
    compatibilityGap: { ...ENTRY_CREATION_COMPATIBILITY_GAP },
    adapterMetadata: createSiblingAdapterMetadata({
      adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_CREATION,
      siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY_CREATION,
      siblingContractVersion: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
      resolvedAt,
      warnings: ["ENTRY_CREATION_PUBLIC_API_UNAVAILABLE"],
    }),
  };
}

/**
 * @param {{
 *   core02EntryCreation?: Core02EntryCreationFacade|null,
 *   clock?: { now: () => string }|null,
 *   allowUnapprovedFacade?: boolean,
 * }} [dependencies]
 *
 * Security / ownership boundary:
 * - `allowUnapprovedFacade` defaults to false (absent ⇒ false).
 * - Must be supplied only via explicit factory DI for controlled tests.
 * - Never read from environment variables, registration payloads, or HTTP/user requests.
 * - Not a normal Production runtime option; default composition never enables it.
 */
export function createCore02EntryCreationAdapter(dependencies = {}) {
  const facade = dependencies.core02EntryCreation ?? null;
  const clock = dependencies.clock ?? null;
  // Strict boolean — only exact `true` enables experimental path.
  const allowUnapprovedFacade = dependencies.allowUnapprovedFacade === true;

  /** @type {Set<string>} */
  const seenHandoffIds = new Set();

  return {
    getAdapterMetadata() {
      return createSiblingAdapterMetadata({
        adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_CREATION,
        siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY_CREATION,
        siblingContractVersion: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
        warnings: facade && allowUnapprovedFacade ? [] : ["ENTRY_CREATION_PUBLIC_API_UNAVAILABLE"],
      });
    },

    getCompatibilityGap() {
      return { ...ENTRY_CREATION_COMPATIBILITY_GAP };
    },

    /**
     * @param {import('../ports/entryCreationPort.js').EntryCreationRequest & {
     *   registrationStatus?: string|null,
     *   eligibilityOutcome?: string|null,
     *   capacityReservationId?: string|null,
     *   handoffRequestId?: string|null,
     *   allowUnapprovedFacade?: unknown,
     *   allowUnapprovedEntryCreationFacade?: unknown,
     * }} request
     * @returns {Promise<import('../ports/entryCreationPort.js').EntryCreationResult & {
     *   adapterMetadata?: unknown,
     *   entryVersion?: string|null,
     *   compatibilityGap?: typeof ENTRY_CREATION_COMPATIBILITY_GAP,
     * }>}
     */
    async createEntryFromRegistration(request = {}) {
      const resolvedAt = clock && typeof clock.now === "function" ? String(clock.now()) : null;

      // Explicitly ignore any request-payload attempt to enable experimental mode.
      // Experimental activation is DI-only (factory deps), never request/HTTP/env.
      void request.allowUnapprovedFacade;
      void request.allowUnapprovedEntryCreationFacade;

      const handoffRequestId =
        request.handoffRequestId != null && String(request.handoffRequestId).trim() !== ""
          ? String(request.handoffRequestId).trim()
          : request.idempotencyKey != null && String(request.idempotencyKey).trim() !== ""
            ? String(request.idempotencyKey).trim()
            : null;

      // Default / Production path: no stable approved Core-02 creation API.
      if (!allowUnapprovedFacade || !facade || typeof facade.createEntryFromRegistration !== "function") {
        return buildUnavailableEntryCreationResult(resolvedAt);
      }

      // Guarded experimental path — still enforce Core-03 preconditions.
      if (String(request.registrationStatus || "") !== REGISTRATION_STATUS.APPROVED) {
        return {
          ok: false,
          entryId: null,
          entryVersion: null,
          errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.INVALID_STATUS,
          message: "Entry creation requires APPROVED registration",
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_CREATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY_CREATION,
            siblingContractVersion: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            warnings: ["REGISTRATION_NOT_APPROVED"],
          }),
        };
      }

      if (!handoffRequestId) {
        return {
          ok: false,
          entryId: null,
          entryVersion: null,
          errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
          message: "Explicit handoffRequestId is required",
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_CREATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY_CREATION,
            siblingContractVersion: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            warnings: ["MISSING_HANDOFF_REQUEST_ID"],
          }),
        };
      }

      if (seenHandoffIds.has(handoffRequestId)) {
        return {
          ok: false,
          entryId: null,
          entryVersion: null,
          errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.DUPLICATE_ENTRY_DETECTED,
          message: "Duplicate entry handoff prevented",
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_CREATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY_CREATION,
            siblingContractVersion: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            sourceIds: [handoffRequestId],
            warnings: ["DUPLICATE_HANDOFF"],
          }),
        };
      }

      try {
        const result = await facade.createEntryFromRegistration({
          ...request,
          handoffRequestId,
        });
        if (result?.ok && result.entryId) {
          seenHandoffIds.add(handoffRequestId);
          return {
            ok: true,
            entryId: String(result.entryId),
            entryVersion: result.entryVersion != null ? String(result.entryVersion) : null,
            errorCode: null,
            message: null,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_CREATION,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY_CREATION,
              siblingContractVersion: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
              siblingResultVersion:
                result.entryVersion != null ? String(result.entryVersion) : null,
              resolvedAt,
              sourceIds: [String(result.entryId)],
            }),
          };
        }
        return {
          ok: false,
          entryId: null,
          entryVersion: null,
          errorCode:
            result?.errorCode || REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED,
          message: result?.message || "Core-02 entry creation failed",
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_CREATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY_CREATION,
            siblingContractVersion: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            warnings: ["CORE02_ENTRY_CREATION_FAILED"],
          }),
        };
      } catch {
        return {
          ok: false,
          entryId: null,
          entryVersion: null,
          errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED,
          message: "Core-02 entry creation threw",
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.ENTRY_CREATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE02_ENTRY_CREATION,
            siblingContractVersion: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
            resolvedAt,
            warnings: ["CORE02_ENTRY_CREATION_EXCEPTION"],
          }),
        };
      }
    },
  };
}
