/**
 * CompetitionRefereeAdapterContract v1 — translator + policy provider only.
 *
 * Adapter MUST NOT own referee identity, authorization, assignment persistence,
 * lifecycle transitions, scoring calculation, score persistence, official
 * result acceptance, match event authority, or result revision authority.
 */

import { createScoringFormat } from "../../../competition-core/scoring/index.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE_VALUES,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_ADAPTER_FORBIDDEN_AUTHORITY_KEYS,
  REFEREE_ADAPTER_FORBIDDEN_METHODS,
  REFEREE_ADAPTER_REQUIRED_METHODS,
} from "./constants.js";
import { failRefereeAdapter } from "./errors.js";
import { freezeClone, isNonEmptyString, isPlainObject } from "./helpers.js";

export const COMPETITION_REFEREE_ADAPTER_OWNED = Object.freeze([
  "competition context translation",
  "match context translation",
  "participant / team / lineup context",
  "scoring rules description",
  "lifecycle policy description",
  "capability flags",
  "pre-start validation policy",
  "result propagation instructions",
]);

export const COMPETITION_REFEREE_ADAPTER_FORBIDDEN_OWNERSHIP = Object.freeze([
  "referee identity",
  "referee authorization",
  "referee assignment persistence",
  "match lifecycle transitions",
  "scoring calculation",
  "score persistence authority",
  "official result acceptance",
  "match event authority",
  "result revision authority",
]);

/**
 * @param {unknown} mode
 * @returns {string}
 */
export function normalizeRefereeAdapterMode(mode) {
  const raw = String(mode || "").trim();
  if (!raw) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MODE,
      "competition mode is required",
      { mode }
    );
  }
  const upper = raw.toUpperCase().replace(/-/g, "_");
  if (COMPETITION_REFEREE_MODE_VALUES.includes(upper)) return upper;
  const fromType = {
    DAILY_PLAY: "DAILY_PLAY",
    INTERNAL_TOURNAMENT: "INTERNAL",
    OFFICIAL_TOURNAMENT: "OFFICIAL",
    TEAM_TOURNAMENT: "TEAM",
  }[upper];
  if (fromType) return fromType;
  failRefereeAdapter(
    REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MODE,
    `Unknown competition referee mode: ${raw}`,
    { mode: raw }
  );
}

/**
 * @param {unknown} request
 * @returns {Readonly<{
 *   tenantId: string,
 *   competitionId: string,
 *   matchId: string|null,
 *   venueId: string|null,
 *   clubId: string|null,
 * }>}
 */
export function requireAdapterRequest(request) {
  if (!isPlainObject(request)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Adapter request must be a plain object",
      { requestType: request == null ? "null" : typeof request }
    );
  }
  const tenantId = String(request.tenantId || "").trim();
  const competitionId = String(request.competitionId || "").trim();
  if (!tenantId || !competitionId) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "tenantId and competitionId are required",
      {}
    );
  }
  return freezeClone({
    tenantId,
    competitionId,
    matchId: isNonEmptyString(request.matchId)
      ? String(request.matchId).trim()
      : null,
    venueId: isNonEmptyString(request.venueId)
      ? String(request.venueId).trim()
      : null,
    clubId: isNonEmptyString(request.clubId)
      ? String(request.clubId).trim()
      : null,
  });
}

/**
 * @param {object} adapter
 */
export function assertAdapterDoesNotOwnAuthority(adapter) {
  for (const method of REFEREE_ADAPTER_FORBIDDEN_METHODS) {
    if (typeof adapter[method] === "function") {
      const scoreish = /score|point|calculate/i.test(method);
      const resultish = /result|accept|revise/i.test(method);
      const code = scoreish
        ? REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN
        : resultish
          ? REFEREE_ADAPTER_ERROR_CODE.DIRECT_RESULT_AUTHORITY_FORBIDDEN
          : REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN;
      failRefereeAdapter(
        code,
        `Adapter must not own forbidden authority method: ${method}`,
        { method }
      );
    }
  }
  for (const key of REFEREE_ADAPTER_FORBIDDEN_AUTHORITY_KEYS) {
    if (adapter[key] != null) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN,
        `Adapter must not expose authority key: ${key}`,
        { key }
      );
    }
  }
}

/**
 * @param {unknown} adapter
 * @returns {object}
 */
export function assertCompetitionRefereeAdapter(adapter) {
  if (!isPlainObject(adapter)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Adapter must be a plain object",
      {}
    );
  }
  if (!isNonEmptyString(adapter.adapterId)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "adapterId is required",
      {}
    );
  }
  if (!isNonEmptyString(adapter.contractId) || !isNonEmptyString(adapter.contractVersion)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "contractId and contractVersion are required",
      {}
    );
  }
  if (adapter.contractId !== COMPETITION_REFEREE_ADAPTER_CONTRACT_ID) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION,
      "Adapter contractId must be competition.referee.adapter.v1",
      { contractId: adapter.contractId || null }
    );
  }
  if (adapter.contractVersion !== COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION,
      "Adapter contractVersion must be 1.0.0",
      { contractVersion: adapter.contractVersion || null }
    );
  }
  normalizeRefereeAdapterMode(adapter.competitionMode);
  for (const method of REFEREE_ADAPTER_REQUIRED_METHODS) {
    if (typeof adapter[method] !== "function") {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
        `Adapter missing required method: ${method}`,
        { method }
      );
    }
  }
  assertAdapterDoesNotOwnAuthority(adapter);
  return adapter;
}

/**
 * @param {unknown} scoringRules
 */
export function assertScoringRulesPayload(scoringRules) {
  if (!isPlainObject(scoringRules)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      "Scoring rules are required",
      {}
    );
  }
  try {
    return freezeClone(createScoringFormat(scoringRules));
  } catch (err) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES,
      err instanceof Error ? err.message : "Invalid scoring rules",
      {}
    );
  }
}

/**
 * @param {unknown} propagation
 */
export function assertResultPropagationPayload(propagation) {
  if (!isPlainObject(propagation)) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
      "Result propagation instructions are required",
      {}
    );
  }
  if (propagation.propagateOnlyIfAccepted !== true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.PROPAGATION_REQUIRES_ACCEPTED_RESULT,
      "Adapters may only describe propagation of CORE-17 accepted active results",
      { propagateOnlyIfAccepted: propagation.propagateOnlyIfAccepted }
    );
  }
  if (propagation.acceptOfficialResult === true || propagation.directScoreToResult === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DIRECT_RESULT_AUTHORITY_FORBIDDEN,
      "Adapter must not convert raw score into an official result",
      {}
    );
  }
  return freezeClone({
    propagateOnlyIfAccepted: true,
    targets: Array.isArray(propagation.targets)
      ? [...propagation.targets]
      : Object.freeze(["standings", "bracket", "qualification", "aggregate"]),
    instructions: isPlainObject(propagation.instructions)
      ? propagation.instructions
      : {},
  });
}

/**
 * Wrap a validated adapter so returned payloads are frozen and authority
 * methods cannot be added later.
 *
 * @param {object} adapter
 */
export function freezeRefereeAdapterView(adapter) {
  const validated = assertCompetitionRefereeAdapter(adapter);
  const view = {
    contractId: COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    contractVersion: COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
    adapterId: String(validated.adapterId).trim(),
    competitionMode: normalizeRefereeAdapterMode(validated.competitionMode),
    ownsAuthority: false,
    owned: COMPETITION_REFEREE_ADAPTER_OWNED,
    forbiddenOwnership: COMPETITION_REFEREE_ADAPTER_FORBIDDEN_OWNERSHIP,
  };
  for (const method of REFEREE_ADAPTER_REQUIRED_METHODS) {
    view[method] = (...args) => {
      const result = validated[method](...args);
      return result && typeof result === "object" ? freezeClone(result) : result;
    };
  }
  return Object.freeze(view);
}
