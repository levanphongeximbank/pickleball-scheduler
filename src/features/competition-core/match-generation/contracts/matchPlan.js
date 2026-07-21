/**
 * CORE-09 — MatchPlan contract (ordered logical structure + fingerprints).
 */

import {
  MATCH_GENERATION_SCHEMA_VERSION,
  MATCH_GENERATOR_IDENTITY,
} from "../constants.js";
import { createLogicalMatch } from "./logicalMatch.js";
import { freezeMetadata } from "../services/canonicalFreeze.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";

/**
 * @param {Partial<{ stageId: string, stageOrder: number, roundIds: string[] }>} [partial]
 */
export function createMatchPlanStage(partial = {}) {
  return Object.freeze({
    stageId: String(partial.stageId || "").trim(),
    stageOrder:
      typeof partial.stageOrder === "number" && Number.isInteger(partial.stageOrder)
        ? partial.stageOrder
        : 0,
    roundIds: Object.freeze(
      (Array.isArray(partial.roundIds) ? partial.roundIds : []).map((id) => {
        const s = String(id || "").trim();
        if (!s) {
          throw new MatchGenerationContractError(
            MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
            "roundIds entries must be non-empty strings"
          );
        }
        return s;
      })
    ),
  });
}

/**
 * @param {Partial<{ roundId: string, stageId: string, roundNumber: number, roundOrder: number, logicalMatchKeys: string[] }>} [partial]
 */
export function createMatchPlanRound(partial = {}) {
  return Object.freeze({
    roundId: String(partial.roundId || "").trim(),
    stageId: String(partial.stageId || "").trim(),
    roundNumber:
      typeof partial.roundNumber === "number" &&
      Number.isInteger(partial.roundNumber)
        ? partial.roundNumber
        : 0,
    roundOrder:
      typeof partial.roundOrder === "number" && Number.isInteger(partial.roundOrder)
        ? partial.roundOrder
        : 0,
    logicalMatchKeys: Object.freeze(
      (Array.isArray(partial.logicalMatchKeys)
        ? partial.logicalMatchKeys
        : []
      ).map((k) => {
        const s = String(k || "").trim();
        if (!s) {
          throw new MatchGenerationContractError(
            MATCH_GENERATION_ISSUE_CODE.NON_CANONICAL_VALUE,
            "logicalMatchKeys entries must be non-empty strings"
          );
        }
        return s;
      })
    ),
  });
}

/**
 * @param {Partial<object>} [partial]
 */
export function createMatchPlan(partial = {}) {
  const logicalMatches = Object.freeze(
    (Array.isArray(partial.logicalMatches) ? partial.logicalMatches : []).map(
      (m) => createLogicalMatch(m)
    )
  );

  const stages = Object.freeze(
    (Array.isArray(partial.stages) ? partial.stages : []).map((s) =>
      createMatchPlanStage(s)
    )
  );

  const rounds = Object.freeze(
    (Array.isArray(partial.rounds) ? partial.rounds : []).map((r) =>
      createMatchPlanRound(r)
    )
  );

  const validationSummary = Object.freeze({
    ok: partial.validationSummary?.ok === true,
    issueCount:
      typeof partial.validationSummary?.issueCount === "number"
        ? partial.validationSummary.issueCount
        : 0,
    issueCodes: Object.freeze(
      Array.isArray(partial.validationSummary?.issueCodes)
        ? partial.validationSummary.issueCodes.map((c) => String(c))
        : []
    ),
  });

  return Object.freeze({
    schemaVersion: String(
      partial.schemaVersion ?? MATCH_GENERATION_SCHEMA_VERSION
    ),
    competitionId: String(partial.competitionId || "").trim(),
    divisionId: String(partial.divisionId || "").trim(),
    categoryId:
      typeof partial.categoryId === "string" && partial.categoryId.trim()
        ? partial.categoryId.trim()
        : null,
    stages,
    rounds,
    logicalMatches,
    drawFingerprint: String(partial.drawFingerprint || "").trim(),
    ruleEvaluationFingerprint: String(
      partial.ruleEvaluationFingerprint || ""
    ).trim(),
    participantFingerprint: String(partial.participantFingerprint || "").trim(),
    generatorVersion: String(
      partial.generatorVersion || MATCH_GENERATOR_IDENTITY.version
    ).trim(),
    generationFingerprint: String(partial.generationFingerprint || "").trim(),
    validationSummary,
    diagnostics: freezeMetadata(partial.diagnostics || {}, "diagnostics"),
    metadata: freezeMetadata(partial.metadata || {}),
  });
}
