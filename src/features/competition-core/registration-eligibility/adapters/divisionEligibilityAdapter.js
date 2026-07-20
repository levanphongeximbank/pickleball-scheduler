/**
 * Core-04 Division / Category → Core-03 DivisionEligibilityPort adapter.
 *
 * Injected facade for gateDivisionCategoryRegistration (or equivalent).
 * Does not select a default/first division. Does not modify Core-04 state.
 */

import { ELIGIBILITY_CHECK_TYPE } from "../enums/eligibilityCheckType.js";
import { ELIGIBILITY_REASON_SEVERITY } from "../enums/eligibilityReasonSeverity.js";
import {
  createEligibilityCheckResult,
  createEligibilityReason,
  orderEligibilityReasons,
} from "../contracts/eligibility.js";
import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import {
  CORE03_SIBLING_ADAPTER_NAME,
  CORE03_SIBLING_CAPABILITY,
  createSiblingAdapterMetadata,
  defensiveCopy,
  orderReasonCodes,
} from "./adapterMetadata.js";

export const DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION =
  "core04-gateDivisionCategoryRegistration-v1";

/**
 * @typedef {Object} Core04DivisionEligibilityFacade
 * @property {(request: {
 *   competitionId: string,
 *   divisionId?: string|null,
 *   divisionCategoryId?: string|null,
 *   categoryId?: string|null,
 *   participantType?: string|null,
 *   currentEntryCount?: number,
 * }) => Promise<unknown>|unknown} evaluateDivisionEligibility
 */

/**
 * @param {unknown} raw
 * @returns {{
 *   ok: boolean,
 *   acceptsRegistration: boolean,
 *   reasonCodes: string[],
 *   eligibilityDescriptor: unknown,
 *   capacity: unknown,
 *   schemaVersion: string|null,
 *   errorCode: string|null,
 * }}
 */
export function normalizeCore04DivisionResult(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      acceptsRegistration: false,
      reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE],
      eligibilityDescriptor: null,
      capacity: null,
      schemaVersion: null,
      errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE,
    };
  }

  // ClassificationResult shape: { ok, errors[], warnings[], value? }
  if (typeof raw.ok === "boolean" && (Array.isArray(raw.errors) || "value" in raw)) {
    const errorCodes = (Array.isArray(raw.errors) ? raw.errors : [])
      .map((err) => (err && typeof err === "object" ? err.code : null))
      .filter(Boolean)
      .map(String);
    const value = raw.value && typeof raw.value === "object" ? raw.value : raw;
    return {
      ok: true,
      acceptsRegistration: raw.ok === true,
      reasonCodes: orderReasonCodes(
        errorCodes.length > 0
          ? errorCodes
          : raw.ok
            ? []
            : [REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED]
      ),
      eligibilityDescriptor: defensiveCopy(
        value.eligibilityDescriptor ?? value.eligibility ?? null
      ),
      capacity: defensiveCopy(value.capacity ?? null),
      schemaVersion:
        value.schemaVersion != null
          ? String(value.schemaVersion)
          : raw.schemaVersion != null
            ? String(raw.schemaVersion)
            : null,
      errorCode: raw.ok ? null : errorCodes[0] || REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED,
    };
  }

  // Direct port-like shape
  if (typeof raw.acceptsRegistration === "boolean") {
    const reasonCodes = orderReasonCodes(
      Array.isArray(raw.reasonCodes) ? raw.reasonCodes.map(String) : []
    );
    return {
      ok: true,
      acceptsRegistration: raw.acceptsRegistration === true,
      reasonCodes,
      eligibilityDescriptor: defensiveCopy(raw.eligibilityDescriptor ?? null),
      capacity: defensiveCopy(raw.capacity ?? null),
      schemaVersion: raw.schemaVersion != null ? String(raw.schemaVersion) : null,
      errorCode: raw.acceptsRegistration ? null : reasonCodes[0] || null,
    };
  }

  return {
    ok: false,
    acceptsRegistration: false,
    reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE],
    eligibilityDescriptor: null,
    capacity: null,
    schemaVersion: null,
    errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE,
  };
}

/**
 * @param {ReturnType<typeof normalizeCore04DivisionResult>} normalized
 * @param {{ evaluatedAt?: string|null }} [options]
 */
export function toEligibilityCheckResultFromDivisionNormalization(normalized, options = {}) {
  const evaluatedAt = options.evaluatedAt ?? null;
  if (!normalized.ok || !normalized.acceptsRegistration) {
    const codes =
      normalized.reasonCodes.length > 0
        ? normalized.reasonCodes
        : [REGISTRATION_ELIGIBILITY_ERROR_CODE.DIVISION_EVALUATION_UNAVAILABLE];
    return createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
      passed: false,
      evaluatedAt,
      reasons: orderEligibilityReasons(
        codes.map((code) =>
          createEligibilityReason({
            code,
            checkType: ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: code,
            details: { schemaVersion: normalized.schemaVersion },
          })
        )
      ),
    });
  }

  return createEligibilityCheckResult({
    checkType: ELIGIBILITY_CHECK_TYPE.DIVISION_COMPATIBILITY,
    passed: true,
    evaluatedAt,
    reasons: [],
  });
}

/**
 * @param {{
 *   core04DivisionEligibility?: Core04DivisionEligibilityFacade|null,
 *   clock?: { now: () => string }|null,
 *   requireDivisionId?: boolean,
 * }} [dependencies]
 */
export function createCore04DivisionEligibilityAdapter(dependencies = {}) {
  const facade = dependencies.core04DivisionEligibility ?? null;
  const clock = dependencies.clock ?? null;
  const requireDivisionId = dependencies.requireDivisionId !== false;

  return {
    getAdapterMetadata() {
      return createSiblingAdapterMetadata({
        adapterName: CORE03_SIBLING_ADAPTER_NAME.DIVISION_ELIGIBILITY,
        siblingCapability: CORE03_SIBLING_CAPABILITY.CORE04_DIVISION,
        siblingContractVersion: DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION,
      });
    },

    async getDivisionEligibilityContext(args = {}) {
      const evaluatedAt = clock && typeof clock.now === "function" ? String(clock.now()) : null;
      const competitionId = String(args.competitionId || "").trim();
      const divisionId =
        args.divisionId != null && String(args.divisionId).trim() !== ""
          ? String(args.divisionId).trim()
          : null;
      const divisionCategoryId =
        args.divisionCategoryId != null && String(args.divisionCategoryId).trim() !== ""
          ? String(args.divisionCategoryId).trim()
          : null;

      if (!competitionId) {
        return {
          acceptsRegistration: false,
          reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER],
          eligibilityDescriptor: null,
          capacity: null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.DIVISION_ELIGIBILITY,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE04_DIVISION,
            siblingContractVersion: DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: ["MISSING_COMPETITION_ID"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromDivisionNormalization(
            {
              ok: false,
              acceptsRegistration: false,
              reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER],
              eligibilityDescriptor: null,
              capacity: null,
              schemaVersion: null,
              errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
            },
            { evaluatedAt }
          ),
        };
      }

      if (requireDivisionId && !divisionId && !divisionCategoryId) {
        return {
          acceptsRegistration: false,
          reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER],
          eligibilityDescriptor: null,
          capacity: null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.DIVISION_ELIGIBILITY,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE04_DIVISION,
            siblingContractVersion: DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: ["MISSING_MANDATORY_DIVISION"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromDivisionNormalization(
            {
              ok: false,
              acceptsRegistration: false,
              reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER],
              eligibilityDescriptor: null,
              capacity: null,
              schemaVersion: null,
              errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
            },
            { evaluatedAt }
          ),
        };
      }

      if (!facade || typeof facade.evaluateDivisionEligibility !== "function") {
        return {
          acceptsRegistration: false,
          reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.DIVISION_EVALUATION_UNAVAILABLE],
          eligibilityDescriptor: null,
          capacity: null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.DIVISION_ELIGIBILITY,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE04_DIVISION,
            siblingContractVersion: DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: ["CORE04_FACADE_UNAVAILABLE"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromDivisionNormalization(
            {
              ok: false,
              acceptsRegistration: false,
              reasonCodes: [
                REGISTRATION_ELIGIBILITY_ERROR_CODE.DIVISION_EVALUATION_UNAVAILABLE,
              ],
              eligibilityDescriptor: null,
              capacity: null,
              schemaVersion: null,
              errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.DIVISION_EVALUATION_UNAVAILABLE,
            },
            { evaluatedAt }
          ),
        };
      }

      try {
        const raw = await facade.evaluateDivisionEligibility({
          competitionId,
          divisionId,
          divisionCategoryId,
          categoryId: args.categoryId ?? null,
          participantType: args.participantType ?? null,
          currentEntryCount:
            typeof args.currentEntryCount === "number" ? args.currentEntryCount : 0,
        });
        const normalized = normalizeCore04DivisionResult(raw);
        return {
          acceptsRegistration: normalized.acceptsRegistration,
          reasonCodes: normalized.reasonCodes,
          eligibilityDescriptor: normalized.eligibilityDescriptor,
          capacity: normalized.capacity,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.DIVISION_ELIGIBILITY,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE04_DIVISION,
            siblingContractVersion: DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION,
            siblingResultVersion: normalized.schemaVersion,
            evaluatedAt,
            sourceIds: [divisionId, divisionCategoryId].filter(Boolean),
            warnings: normalized.ok ? [] : ["CORE04_MALFORMED_RESPONSE"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromDivisionNormalization(normalized, {
            evaluatedAt,
          }),
        };
      } catch {
        return {
          acceptsRegistration: false,
          reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED],
          eligibilityDescriptor: null,
          capacity: null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.DIVISION_ELIGIBILITY,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE04_DIVISION,
            siblingContractVersion: DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: ["CORE04_EXCEPTION"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromDivisionNormalization(
            {
              ok: false,
              acceptsRegistration: false,
              reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED],
              eligibilityDescriptor: null,
              capacity: null,
              schemaVersion: null,
              errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED,
            },
            { evaluatedAt }
          ),
        };
      }
    },
  };
}
