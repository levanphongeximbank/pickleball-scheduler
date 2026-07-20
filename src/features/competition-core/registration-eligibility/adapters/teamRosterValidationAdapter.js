/**
 * Core-05 Team / Roster → Core-03 TeamRosterValidationPort adapter.
 *
 * Injected facade only — no deep imports into Core-05 private modules.
 * INDIVIDUAL / PAIR targets return documented not-applicable results.
 */

import { REGISTRATION_TARGET_TYPE } from "../enums/registrationTargetType.js";
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

export const TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION =
  "core05-validateRosterInvariants-v1";

export const TEAM_ROSTER_NOT_APPLICABLE_CODE = "TEAM_ROSTER_NOT_APPLICABLE";

/**
 * @typedef {Object} Core05TeamRosterFacade
 * @property {(request: {
 *   competitionId: string,
 *   teamId: string,
 *   divisionId?: string|null,
 *   rosterVersion?: number|string|null,
 * }) => Promise<unknown>|unknown} validateTeamRoster
 */

/**
 * @param {unknown} raw
 * @returns {{
 *   ok: boolean,
 *   valid: boolean,
 *   reasonCodes: string[],
 *   memberCount: number|null,
 *   rosterVersion: string|null,
 *   errorCode: string|null,
 * }}
 */
export function normalizeCore05RosterResult(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      valid: false,
      reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE],
      memberCount: null,
      rosterVersion: null,
      errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE,
    };
  }

  // Service envelope: { ok, value, issues: DomainIssue[], code, message }
  if (typeof raw.ok === "boolean" && (Array.isArray(raw.issues) || "value" in raw)) {
    const issueCodes = (Array.isArray(raw.issues) ? raw.issues : [])
      .map((issue) => (issue && typeof issue === "object" ? issue.code : null))
      .filter(Boolean)
      .map(String);
    const value = raw.value && typeof raw.value === "object" ? raw.value : {};
    const roster = value.roster && typeof value.roster === "object" ? value.roster : value;
    const members = Array.isArray(roster.members) ? roster.members : null;
    return {
      ok: true,
      valid: raw.ok === true && issueCodes.length === 0,
      reasonCodes: orderReasonCodes(
        issueCodes.length > 0
          ? issueCodes
          : raw.ok
            ? []
            : [raw.code || REGISTRATION_ELIGIBILITY_ERROR_CODE.FAIL_CLOSED].filter(Boolean)
      ),
      memberCount: members ? members.length : typeof raw.memberCount === "number" ? raw.memberCount : null,
      rosterVersion:
        roster.rosterVersion != null
          ? String(roster.rosterVersion)
          : raw.rosterVersion != null
            ? String(raw.rosterVersion)
            : null,
      errorCode: raw.ok ? null : issueCodes[0] || raw.code || null,
    };
  }

  // Port-like shape
  if (typeof raw.valid === "boolean") {
    const reasonCodes = orderReasonCodes(
      Array.isArray(raw.reasonCodes) ? raw.reasonCodes.map(String) : []
    );
    return {
      ok: true,
      valid: raw.valid === true,
      reasonCodes,
      memberCount: typeof raw.memberCount === "number" ? raw.memberCount : null,
      rosterVersion: raw.rosterVersion != null ? String(raw.rosterVersion) : null,
      errorCode: raw.valid ? null : reasonCodes[0] || null,
    };
  }

  // DomainIssue[] direct
  if (Array.isArray(raw)) {
    const reasonCodes = orderReasonCodes(
      raw.map((issue) => (issue && typeof issue === "object" ? issue.code : null)).filter(Boolean)
    );
    return {
      ok: true,
      valid: reasonCodes.length === 0,
      reasonCodes,
      memberCount: null,
      rosterVersion: null,
      errorCode: reasonCodes[0] || null,
    };
  }

  return {
    ok: false,
    valid: false,
    reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE],
    memberCount: null,
    rosterVersion: null,
    errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_MALFORMED_RESPONSE,
  };
}

/**
 * @param {ReturnType<typeof normalizeCore05RosterResult>} normalized
 * @param {{ evaluatedAt?: string|null, notApplicable?: boolean }} [options]
 */
export function toEligibilityCheckResultFromRosterNormalization(normalized, options = {}) {
  const evaluatedAt = options.evaluatedAt ?? null;
  if (options.notApplicable) {
    return createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
      passed: true,
      evaluatedAt,
      reasons: orderEligibilityReasons([
        createEligibilityReason({
          code: TEAM_ROSTER_NOT_APPLICABLE_CODE,
          checkType: ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
          severity: ELIGIBILITY_REASON_SEVERITY.INFO,
          message: "Team roster validation is not applicable for non-TEAM targets",
        }),
      ]),
    });
  }

  if (!normalized.ok || !normalized.valid) {
    const codes =
      normalized.reasonCodes.length > 0
        ? normalized.reasonCodes
        : [REGISTRATION_ELIGIBILITY_ERROR_CODE.TEAM_ROSTER_VALIDATION_UNAVAILABLE];
    return createEligibilityCheckResult({
      checkType: ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
      passed: false,
      evaluatedAt,
      reasons: orderEligibilityReasons(
        codes.map((code) =>
          createEligibilityReason({
            code,
            checkType: ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
            severity: ELIGIBILITY_REASON_SEVERITY.BLOCKING,
            message: code,
            details: {
              rosterVersion: normalized.rosterVersion,
              memberCount: normalized.memberCount,
            },
          })
        )
      ),
    });
  }

  return createEligibilityCheckResult({
    checkType: ELIGIBILITY_CHECK_TYPE.TEAM_ROSTER_REQUIREMENT,
    passed: true,
    evaluatedAt,
    reasons: [],
  });
}

/**
 * @param {{
 *   core05TeamRoster?: Core05TeamRosterFacade|null,
 *   clock?: { now: () => string }|null,
 * }} [dependencies]
 */
export function createCore05TeamRosterValidationAdapter(dependencies = {}) {
  const facade = dependencies.core05TeamRoster ?? null;
  const clock = dependencies.clock ?? null;

  return {
    getAdapterMetadata() {
      return createSiblingAdapterMetadata({
        adapterName: CORE03_SIBLING_ADAPTER_NAME.TEAM_ROSTER_VALIDATION,
        siblingCapability: CORE03_SIBLING_CAPABILITY.CORE05_TEAM_ROSTER,
        siblingContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
      });
    },

    /**
     * @param {{
     *   competitionId: string,
     *   teamId: string,
     *   divisionId?: string|null,
     *   targetType?: string|null,
     *   rosterVersion?: number|string|null,
     *   expectedRosterVersion?: number|string|null,
     * }} args
     */
    async validateRoster(args = {}) {
      const evaluatedAt = clock && typeof clock.now === "function" ? String(clock.now()) : null;
      const targetType = args.targetType != null ? String(args.targetType).trim() : null;

      if (
        targetType === REGISTRATION_TARGET_TYPE.INDIVIDUAL ||
        targetType === REGISTRATION_TARGET_TYPE.PAIR
      ) {
        return {
          valid: true,
          reasonCodes: [TEAM_ROSTER_NOT_APPLICABLE_CODE],
          memberCount: null,
          notApplicable: true,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.TEAM_ROSTER_VALIDATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE05_TEAM_ROSTER,
            siblingContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: [TEAM_ROSTER_NOT_APPLICABLE_CODE],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromRosterNormalization(
            {
              ok: true,
              valid: true,
              reasonCodes: [TEAM_ROSTER_NOT_APPLICABLE_CODE],
              memberCount: null,
              rosterVersion: null,
              errorCode: null,
            },
            { evaluatedAt, notApplicable: true }
          ),
        };
      }

      const competitionId = String(args.competitionId || "").trim();
      const teamId = String(args.teamId || "").trim();

      if (!competitionId || !teamId) {
        return {
          valid: false,
          reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER],
          memberCount: null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.TEAM_ROSTER_VALIDATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE05_TEAM_ROSTER,
            siblingContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: ["MISSING_TEAM_OR_COMPETITION"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromRosterNormalization(
            {
              ok: false,
              valid: false,
              reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER],
              memberCount: null,
              rosterVersion: null,
              errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.MISSING_IDENTIFIER,
            },
            { evaluatedAt }
          ),
        };
      }

      if (!facade || typeof facade.validateTeamRoster !== "function") {
        return {
          valid: false,
          reasonCodes: [
            REGISTRATION_ELIGIBILITY_ERROR_CODE.TEAM_ROSTER_VALIDATION_UNAVAILABLE,
          ],
          memberCount: null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.TEAM_ROSTER_VALIDATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE05_TEAM_ROSTER,
            siblingContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: ["CORE05_FACADE_UNAVAILABLE"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromRosterNormalization(
            {
              ok: false,
              valid: false,
              reasonCodes: [
                REGISTRATION_ELIGIBILITY_ERROR_CODE.TEAM_ROSTER_VALIDATION_UNAVAILABLE,
              ],
              memberCount: null,
              rosterVersion: null,
              errorCode:
                REGISTRATION_ELIGIBILITY_ERROR_CODE.TEAM_ROSTER_VALIDATION_UNAVAILABLE,
            },
            { evaluatedAt }
          ),
        };
      }

      try {
        const raw = await facade.validateTeamRoster({
          competitionId,
          teamId,
          divisionId: args.divisionId ?? null,
          rosterVersion: args.rosterVersion ?? args.expectedRosterVersion ?? null,
        });

        // Stale roster version: facade may return dedicated signal, or compare versions.
        if (
          raw &&
          typeof raw === "object" &&
          !Array.isArray(raw) &&
          (raw.stale === true ||
            raw.code === "STALE_ROSTER_VERSION" ||
            raw.errorCode === REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_SIBLING_RESULT)
        ) {
          return {
            valid: false,
            reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_SIBLING_RESULT],
            memberCount: null,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.TEAM_ROSTER_VALIDATION,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE05_TEAM_ROSTER,
              siblingContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
              evaluatedAt,
              sourceIds: [teamId],
              warnings: ["STALE_ROSTER_VERSION"],
            }),
            eligibilityCheckResult: toEligibilityCheckResultFromRosterNormalization(
              {
                ok: false,
                valid: false,
                reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_SIBLING_RESULT],
                memberCount: null,
                rosterVersion: null,
                errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_SIBLING_RESULT,
              },
              { evaluatedAt }
            ),
          };
        }

        // Missing team signal
        if (
          raw &&
          typeof raw === "object" &&
          !Array.isArray(raw) &&
          (raw.code === "TEAM_NOT_FOUND" ||
            raw.errorCode === "TEAM_NOT_FOUND" ||
            (raw.ok === false &&
              Array.isArray(raw.issues) &&
              raw.issues.some((i) => i && i.code === "TEAM_NOT_FOUND")))
        ) {
          return {
            valid: false,
            reasonCodes: ["TEAM_NOT_FOUND"],
            memberCount: null,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.TEAM_ROSTER_VALIDATION,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE05_TEAM_ROSTER,
              siblingContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
              evaluatedAt,
              sourceIds: [teamId],
              warnings: ["TEAM_NOT_FOUND"],
            }),
            eligibilityCheckResult: toEligibilityCheckResultFromRosterNormalization(
              {
                ok: false,
                valid: false,
                reasonCodes: ["TEAM_NOT_FOUND"],
                memberCount: null,
                rosterVersion: null,
                errorCode: "TEAM_NOT_FOUND",
              },
              { evaluatedAt }
            ),
          };
        }

        const expectedVersion =
          args.expectedRosterVersion != null
            ? String(args.expectedRosterVersion)
            : args.rosterVersion != null
              ? String(args.rosterVersion)
              : null;
        const normalized = normalizeCore05RosterResult(raw);

        if (
          expectedVersion != null &&
          normalized.rosterVersion != null &&
          String(normalized.rosterVersion) !== expectedVersion
        ) {
          return {
            valid: false,
            reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_SIBLING_RESULT],
            memberCount: normalized.memberCount,
            adapterMetadata: createSiblingAdapterMetadata({
              adapterName: CORE03_SIBLING_ADAPTER_NAME.TEAM_ROSTER_VALIDATION,
              siblingCapability: CORE03_SIBLING_CAPABILITY.CORE05_TEAM_ROSTER,
              siblingContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
              siblingResultVersion: normalized.rosterVersion,
              evaluatedAt,
              sourceIds: [teamId],
              warnings: ["STALE_ROSTER_VERSION"],
            }),
            eligibilityCheckResult: toEligibilityCheckResultFromRosterNormalization(
              {
                ok: false,
                valid: false,
                reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_SIBLING_RESULT],
                memberCount: normalized.memberCount,
                rosterVersion: normalized.rosterVersion,
                errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.STALE_SIBLING_RESULT,
              },
              { evaluatedAt }
            ),
          };
        }

        return {
          valid: normalized.valid,
          reasonCodes: normalized.reasonCodes,
          memberCount: normalized.memberCount,
          rosterVersion: normalized.rosterVersion,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.TEAM_ROSTER_VALIDATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE05_TEAM_ROSTER,
            siblingContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
            siblingResultVersion: normalized.rosterVersion,
            evaluatedAt,
            sourceIds: [teamId],
            warnings: normalized.ok ? [] : ["CORE05_MALFORMED_RESPONSE"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromRosterNormalization(normalized, {
            evaluatedAt,
          }),
          violations: normalized.reasonCodes.map((code) =>
            defensiveCopy({ code, path: "roster", message: code })
          ),
        };
      } catch {
        return {
          valid: false,
          reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED],
          memberCount: null,
          adapterMetadata: createSiblingAdapterMetadata({
            adapterName: CORE03_SIBLING_ADAPTER_NAME.TEAM_ROSTER_VALIDATION,
            siblingCapability: CORE03_SIBLING_CAPABILITY.CORE05_TEAM_ROSTER,
            siblingContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
            evaluatedAt,
            warnings: ["CORE05_EXCEPTION"],
          }),
          eligibilityCheckResult: toEligibilityCheckResultFromRosterNormalization(
            {
              ok: false,
              valid: false,
              reasonCodes: [REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED],
              memberCount: null,
              rosterVersion: null,
              errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_OPERATION_FAILED,
            },
            { evaluatedAt }
          ),
        };
      }
    },
  };
}
