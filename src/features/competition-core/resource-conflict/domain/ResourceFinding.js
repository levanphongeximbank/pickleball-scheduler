/**
 * CORE-14 — ResourceFinding factory (foundation; no detectors).
 */

import { isResourceFindingCode } from "../enums/findingCode.js";
import { DOMAIN_CONTRACT_ERROR_CODE } from "../enums/domainContractErrorCode.js";
import { isSeverity, SEVERITY } from "../enums/severity.js";
import { ResourceConflictContractError } from "../errors/ResourceConflictContractError.js";
import { sortIdentifiers } from "../deterministic/compare.js";
import { createFindingId } from "../deterministic/fingerprint.js";
import {
  createCanonicalResourceKey,
  serializeCanonicalResourceKey,
} from "./CanonicalResourceKey.js";
import { getMinimumSeverity, evaluateSeverityOverride } from "../catalogs/severityPolicy.js";

/**
 * @param {{
 *   code: string,
 *   resourceKey: object,
 *   occupancyIds: readonly string[],
 *   assignmentIds?: readonly string[],
 *   violationStartMs?: number | null,
 *   violationEndMs?: number | null,
 *   evidence?: Record<string, unknown> | null,
 *   reasonCode?: string,
 *   policyVersion?: string,
 *   requestedSeverity?: string,
 *   availabilityMode?: string,
 *   permittedActionTypes?: readonly string[],
 * }} input
 */
export function createResourceFinding(input) {
  if (!isResourceFindingCode(input?.code)) {
    throw new ResourceConflictContractError(
      DOMAIN_CONTRACT_ERROR_CODE.UNKNOWN_FINDING_CODE,
      "Finding code must be a frozen catalog value",
      { code: input?.code ?? null }
    );
  }
  const resourceKey = createCanonicalResourceKey(input.resourceKey);
  const resourceKeyCanonical = serializeCanonicalResourceKey(resourceKey);
  const occupancyIds = sortIdentifiers(input.occupancyIds || []);
  const assignmentIds = sortIdentifiers(input.assignmentIds || []);
  const reasonCode = typeof input.reasonCode === "string" && input.reasonCode.length > 0
    ? input.reasonCode
    : input.code;
  const policyVersion =
    typeof input.policyVersion === "string" && input.policyVersion.length > 0
      ? input.policyVersion
      : "core14-severity-capacity-v1";

  const severityResult = evaluateSeverityOverride({
    findingCode: input.code,
    requestedSeverity: input.requestedSeverity ?? getMinimumSeverity(input.code, {
      availabilityMode: input.availabilityMode,
    }),
    availabilityMode: input.availabilityMode,
  });

  if (!isSeverity(severityResult.effectiveSeverity)) {
    throw new ResourceConflictContractError(
      DOMAIN_CONTRACT_ERROR_CODE.INVALID_SEVERITY,
      "effective severity invalid",
      {}
    );
  }

  const findingId = createFindingId({
    code: input.code,
    resourceKeyCanonical,
    occupancyIds,
    violationStartMs: input.violationStartMs ?? null,
    violationEndMs: input.violationEndMs ?? null,
    reasonCode,
    policyVersion,
  });

  const effectiveSeverity = severityResult.effectiveSeverity;
  const blocksPlanValidity = effectiveSeverity === SEVERITY.HARD;

  return Object.freeze({
    findingId,
    code: input.code,
    severity: effectiveSeverity,
    resourceKey,
    occupancyIds: Object.freeze(occupancyIds),
    assignmentIds: Object.freeze(assignmentIds),
    violationStartMs: input.violationStartMs ?? null,
    violationEndMs: input.violationEndMs ?? null,
    evidence: input.evidence == null ? Object.freeze({}) : Object.freeze({ ...input.evidence }),
    blocksPlanValidity,
    permittedActionTypes: Object.freeze([...(input.permittedActionTypes || [])]),
    reasonCode,
    policyVersion,
    severityOverrideDiagnostic: severityResult.diagnostic,
  });
}
