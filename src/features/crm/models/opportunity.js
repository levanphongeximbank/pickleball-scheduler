/**
 * Opportunity + Pipeline foundation models (Phase 1B). Lifecycle is Phase 1D+.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import {
  DEFAULT_PIPELINE_STAGE_ORDER,
  isOpportunityStage,
  OPPORTUNITY_STAGE,
} from "../constants/opportunityStages.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

/**
 * @param {object} input
 * @returns {object}
 */
export function createPipelineStage(input = {}) {
  const code = requireNonEmptyId(input.code ?? input.stageCode, "stage.code");
  if (!isOpportunityStage(code) && input.allowCustom !== true) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid opportunity stage: ${code}`);
  }
  const sortOrder = Number(input.sortOrder);
  if (!Number.isFinite(sortOrder)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "stage.sortOrder must be a number.");
  }
  return Object.freeze({
    code,
    label: input.label != null ? String(input.label).trim() || code : code,
    sortOrder,
    isTerminal: Boolean(input.isTerminal),
  });
}

/**
 * @param {object} input
 * @returns {object}
 */
export function createPipeline(input = {}) {
  const scope = createTenantVenueScope(input);
  const pipelineId = requireNonEmptyId(input.pipelineId ?? input.id, "pipelineId");

  const stagesInput = Array.isArray(input.stages)
    ? input.stages
    : DEFAULT_PIPELINE_STAGE_ORDER.map((code, index) => ({
        code,
        sortOrder: index,
        isTerminal: code === OPPORTUNITY_STAGE.WON || code === OPPORTUNITY_STAGE.LOST,
      }));

  const stages = stagesInput.map((row) => createPipelineStage(row));

  return Object.freeze({
    pipelineId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    name: input.name != null ? String(input.name).trim() || "Default pipeline" : "Default pipeline",
    stages: Object.freeze(stages),
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt),
  });
}

/**
 * @param {object} input
 * @returns {object}
 */
export function createOpportunity(input = {}) {
  const scope = createTenantVenueScope(input);
  const opportunityId = requireNonEmptyId(input.opportunityId ?? input.id, "opportunityId");

  const stageCode =
    input.stageCode != null ? String(input.stageCode) : OPPORTUNITY_STAGE.QUALIFICATION;
  if (!isOpportunityStage(stageCode)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid opportunity stage: ${stageCode}`);
  }

  const contactRefId =
    input.contactRefId != null && String(input.contactRefId).trim()
      ? String(input.contactRefId).trim()
      : null;
  const leadId =
    input.leadId != null && String(input.leadId).trim() ? String(input.leadId).trim() : null;
  const ownerUserId =
    input.ownerUserId != null && String(input.ownerUserId).trim()
      ? String(input.ownerUserId).trim()
      : null;
  const pipelineId =
    input.pipelineId != null && String(input.pipelineId).trim()
      ? String(input.pipelineId).trim()
      : null;

  let amountEstimate = null;
  if (input.amountEstimate != null && input.amountEstimate !== "") {
    const n = Number(input.amountEstimate);
    if (!Number.isFinite(n) || n < 0) {
      throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "amountEstimate must be a non-negative number.");
    }
    amountEstimate = n;
  }

  return Object.freeze({
    opportunityId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    pipelineId,
    stageCode,
    contactRefId,
    leadId,
    ownerUserId,
    title: input.title != null ? String(input.title).trim() || null : null,
    amountEstimate,
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt),
  });
}
