/**
 * Opportunity + Pipeline foundation models (Phase 1B hardened for Phase 1D).
 *
 * Lifecycle commands live in opportunityApplicationService (Phase 1D).
 * amountEstimate / estimatedValue are non-authoritative CRM estimates only —
 * not Finance transactions or revenue recognition.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";
import {
  DEFAULT_PIPELINE_STAGE_ORDER,
  inferStageCategoryFromCode,
  isOpportunityStage,
  isPipelineStageCategory,
  normalizePipelineCode,
  OPPORTUNITY_STAGE,
  PIPELINE_STAGE_CATEGORY,
} from "../constants/opportunityStages.js";
import { normalizeIsoTimestamp } from "../constants/timestamps.js";
import { createTenantVenueScope, requireNonEmptyId } from "./scope.js";

/**
 * @param {object} input
 * @returns {object}
 */
export function createPipelineStage(input = {}) {
  const rawCode = input.code ?? input.stageCode ?? input.stageId;
  const code = normalizePipelineCode(rawCode);
  if (!code) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "stage.code is required.");
  }
  if (!isOpportunityStage(code) && input.allowCustom !== true) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_STATUS, `Invalid opportunity stage: ${code}`);
  }

  const sortOrder = Number(input.sortOrder ?? input.order);
  if (!Number.isFinite(sortOrder)) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "stage.sortOrder must be a number.");
  }

  let category =
    input.category != null
      ? String(input.category).trim().toLowerCase()
      : inferStageCategoryFromCode(code);
  if (!category) {
    category = input.isTerminal
      ? PIPELINE_STAGE_CATEGORY.WON
      : PIPELINE_STAGE_CATEGORY.OPEN;
  }
  if (!isPipelineStageCategory(category)) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_STATUS,
      `Invalid pipeline stage category: ${category}`
    );
  }

  const isTerminal =
    input.isTerminal != null
      ? Boolean(input.isTerminal)
      : category === PIPELINE_STAGE_CATEGORY.WON ||
        category === PIPELINE_STAGE_CATEGORY.LOST;

  if (
    isTerminal &&
    category !== PIPELINE_STAGE_CATEGORY.WON &&
    category !== PIPELINE_STAGE_CATEGORY.LOST
  ) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_STATUS,
      "Terminal stages must use won or lost category."
    );
  }
  if (
    !isTerminal &&
    (category === PIPELINE_STAGE_CATEGORY.WON ||
      category === PIPELINE_STAGE_CATEGORY.LOST)
  ) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_STATUS,
      "Won/lost category stages must be terminal."
    );
  }

  return Object.freeze({
    stageId: input.stageId != null && String(input.stageId).trim()
      ? String(input.stageId).trim()
      : code,
    code,
    name:
      input.name != null
        ? String(input.name).trim() || code
        : input.label != null
          ? String(input.label).trim() || code
          : code,
    label:
      input.label != null
        ? String(input.label).trim() || code
        : input.name != null
          ? String(input.name).trim() || code
          : code,
    sortOrder,
    order: sortOrder,
    category,
    isTerminal,
  });
}

/**
 * Validate pipeline stage set: unique codes, deterministic order,
 * exactly one won terminal and one lost terminal.
 * @param {object[]} stages
 */
export function assertValidPipelineStages(stages) {
  if (!Array.isArray(stages) || stages.length < 2) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "Pipeline requires at least two stages (open + terminals)."
    );
  }

  const codes = new Set();
  let wonCount = 0;
  let lostCount = 0;
  let openCount = 0;

  for (const stage of stages) {
    if (codes.has(stage.code)) {
      throw new CrmError(
        CRM_ERROR_CODES.INVALID_INPUT,
        `Duplicate pipeline stage code: ${stage.code}`
      );
    }
    codes.add(stage.code);
    if (stage.category === PIPELINE_STAGE_CATEGORY.WON) wonCount += 1;
    else if (stage.category === PIPELINE_STAGE_CATEGORY.LOST) lostCount += 1;
    else if (stage.category === PIPELINE_STAGE_CATEGORY.OPEN) openCount += 1;
  }

  if (openCount < 1) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_STATUS,
      "Pipeline requires at least one open stage."
    );
  }
  if (wonCount !== 1) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_STATUS,
      "Pipeline must have exactly one won terminal stage."
    );
  }
  if (lostCount !== 1) {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_STATUS,
      "Pipeline must have exactly one lost terminal stage."
    );
  }
}

/**
 * Default consecutive open-stage transitions (no skipping, no terminal exits).
 * @param {object[]} stages
 * @returns {ReadonlyArray<{ from: string, to: string }>}
 */
export function buildDefaultAllowedTransitions(stages) {
  const open = [...stages]
    .filter((s) => s.category === PIPELINE_STAGE_CATEGORY.OPEN && !s.isTerminal)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const transitions = [];
  for (let i = 0; i < open.length - 1; i += 1) {
    transitions.push(Object.freeze({ from: open[i].code, to: open[i + 1].code }));
  }
  return Object.freeze(transitions);
}

/**
 * @param {object} pipeline
 * @returns {object|null}
 */
export function getInitialOpenStage(pipeline) {
  const open = [...(pipeline.stages || [])]
    .filter((s) => s.category === PIPELINE_STAGE_CATEGORY.OPEN && !s.isTerminal)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  return open[0] || null;
}

/**
 * @param {object} pipeline
 * @param {string} category
 * @returns {object|null}
 */
export function getTerminalStageByCategory(pipeline, category) {
  return (
    (pipeline.stages || []).find(
      (s) => s.isTerminal && s.category === category
    ) || null
  );
}

/**
 * @param {object} pipeline
 * @param {string} stageCode
 * @returns {object|null}
 */
export function findPipelineStage(pipeline, stageCode) {
  const code = normalizePipelineCode(stageCode);
  return (pipeline.stages || []).find((s) => s.code === code) || null;
}

/**
 * Whether advancing from → to is permitted (open stages only).
 * Terminal stages have no outgoing transitions.
 * @param {object} pipeline
 * @param {string} fromCode
 * @param {string} toCode
 * @returns {boolean}
 */
export function isAllowedStageTransition(pipeline, fromCode, toCode) {
  const from = findPipelineStage(pipeline, fromCode);
  const to = findPipelineStage(pipeline, toCode);
  if (!from || !to) return false;
  if (from.isTerminal) return false;
  if (to.category === PIPELINE_STAGE_CATEGORY.WON || to.category === PIPELINE_STAGE_CATEGORY.LOST) {
    // Won/lost only via explicit close commands, not advance.
    return false;
  }
  const allowed = pipeline.allowedTransitions || [];
  return allowed.some((t) => t.from === from.code && t.to === to.code);
}

/**
 * @param {object} input
 * @returns {object}
 */
export function createPipeline(input = {}) {
  const scope = createTenantVenueScope(input);
  const pipelineId = requireNonEmptyId(input.pipelineId ?? input.id, "pipelineId");

  const codeRaw = input.code != null ? input.code : input.name;
  const code = normalizePipelineCode(codeRaw);
  if (!code) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "pipeline.code is required.");
  }

  const stagesInput = Array.isArray(input.stages)
    ? input.stages
    : DEFAULT_PIPELINE_STAGE_ORDER.map((stageCode, index) => ({
        code: stageCode,
        sortOrder: index,
        isTerminal:
          stageCode === OPPORTUNITY_STAGE.WON || stageCode === OPPORTUNITY_STAGE.LOST,
        category: inferStageCategoryFromCode(stageCode),
      }));

  const stages = stagesInput
    .map((row) => createPipelineStage(row))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  assertValidPipelineStages(stages);

  const allowedTransitions = Array.isArray(input.allowedTransitions)
    ? Object.freeze(
        input.allowedTransitions.map((t) =>
          Object.freeze({
            from: normalizePipelineCode(t.from),
            to: normalizePipelineCode(t.to),
          })
        )
      )
    : buildDefaultAllowedTransitions(stages);

  // Terminal stages must not appear as transition sources.
  for (const t of allowedTransitions) {
    const fromStage = stages.find((s) => s.code === t.from);
    if (fromStage?.isTerminal) {
      throw new CrmError(
        CRM_ERROR_CODES.INVALID_TRANSITION,
        `Terminal stage ${t.from} cannot have outgoing transitions.`
      );
    }
  }

  const name =
    input.name != null ? String(input.name).trim() || code : code;

  const active = input.active !== false;

  return Object.freeze({
    pipelineId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    name,
    code,
    stages: Object.freeze(stages),
    allowedTransitions,
    active,
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

  const stageCodeRaw =
    input.stageCode != null ? String(input.stageCode) : OPPORTUNITY_STAGE.QUALIFICATION;
  const stageCode = normalizePipelineCode(stageCodeRaw) || stageCodeRaw.trim();
  if (!stageCode) {
    throw new CrmError(CRM_ERROR_CODES.INVALID_INPUT, "stageCode is required.");
  }
  // Default enum check unless caller already validated against a Pipeline (allowCustomStage).
  if (!isOpportunityStage(stageCode) && input.allowCustomStage !== true) {
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

  // Non-authoritative CRM estimate only — never a Finance transaction.
  const estimateSource =
    input.estimatedValue != null && input.estimatedValue !== ""
      ? input.estimatedValue
      : input.amountEstimate;
  let amountEstimate = null;
  if (estimateSource != null && estimateSource !== "") {
    const n = Number(estimateSource);
    if (!Number.isFinite(n) || n < 0) {
      throw new CrmError(
        CRM_ERROR_CODES.INVALID_INPUT,
        "estimatedValue/amountEstimate must be a non-negative number (non-authoritative CRM data)."
      );
    }
    amountEstimate = n;
  }

  const closedAt =
    input.closedAt != null && String(input.closedAt).trim()
      ? normalizeIsoTimestamp(input.closedAt)
      : null;
  const lossReason =
    input.lossReason != null && String(input.lossReason).trim()
      ? String(input.lossReason).trim()
      : null;
  const lossReasonCode =
    input.lossReasonCode != null && String(input.lossReasonCode).trim()
      ? normalizePipelineCode(input.lossReasonCode) || String(input.lossReasonCode).trim()
      : null;

  const stageCategory =
    input.stageCategory != null && isPipelineStageCategory(input.stageCategory)
      ? String(input.stageCategory)
      : inferStageCategoryFromCode(stageCode) || PIPELINE_STAGE_CATEGORY.OPEN;

  return Object.freeze({
    opportunityId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    pipelineId,
    stageCode,
    stageCategory,
    contactRefId,
    leadId,
    ownerUserId,
    title: input.title != null ? String(input.title).trim() || null : null,
    /** @deprecated Prefer estimatedValue — same non-authoritative CRM field. */
    amountEstimate,
    estimatedValue: amountEstimate,
    closedAt,
    lossReason,
    lossReasonCode,
    createdAt: normalizeIsoTimestamp(input.createdAt),
    updatedAt: normalizeIsoTimestamp(input.updatedAt),
  });
}
