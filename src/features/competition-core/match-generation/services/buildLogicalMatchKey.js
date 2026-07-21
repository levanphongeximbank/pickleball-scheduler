/**
 * CORE-09 — stable logical match key (length-prefixed, streaming grammar).
 *
 * Grammar (CORE09_LMK_V1) — concatenated segments, no delimiter reliance on ID body:
 *
 *   CORE09_LMK_V1
 *   + ReqRequired(competitionId)
 *   + ReqRequired(divisionId)
 *   + EncOptional(categoryId)
 *   + EncRequired(stageId)
 *   + EncOptional(groupId)
 *   + EncOptional(bracketId)
 *   + "R:" PositiveInt
 *   + "M:" PositiveInt
 *
 * EncRequired = "req:" DecDigit+ ":" Char{n}     where n = DecDigit value (JS string length)
 * EncOptional = "opt:0" | "opt:1:" DecDigit+ ":" Char{n}
 *
 * Identifier bodies MAY contain "::", "|", or the literal text "NONE".
 * Absence of an optional field is ONLY "opt:0" — never a sentinel ID value.
 *
 * drawFingerprint is NOT part of the key — it binds at MatchPlan / generation context.
 */

import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MatchGenerationContractError } from "../errors/contractError.js";

export const LOGICAL_MATCH_KEY_VERSION = "CORE09_LMK_V1";

/**
 * @param {string} value
 * @param {string} field
 * @returns {string}
 */
function requireNonEmptyId(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_COORDINATES,
      `${field} is required and must be a non-empty string`,
      { field, value: value ?? null }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requirePositiveInt(value, field) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_COORDINATES,
      `${field} must be a positive integer`,
      { field, value: value ?? null }
    );
  }
  return value;
}

/**
 * @param {string} body
 * @returns {string}
 */
export function encodeRequiredSegment(body) {
  const s = String(body);
  return `req:${s.length}:${s}`;
}

/**
 * @param {string|null|undefined} body
 * @returns {string}
 */
export function encodeOptionalSegment(body) {
  if (body == null || (typeof body === "string" && !body.trim())) {
    return "opt:0";
  }
  const s = String(body).trim();
  return `opt:1:${s.length}:${s}`;
}

/**
 * @param {object} parts
 * @returns {string}
 */
export function buildLogicalMatchKey(parts = {}) {
  const competitionId = requireNonEmptyId(parts.competitionId, "competitionId");
  const divisionId = requireNonEmptyId(parts.divisionId, "divisionId");
  const stageId = requireNonEmptyId(parts.stageId, "stageId");
  const categoryId =
    typeof parts.categoryId === "string" && parts.categoryId.trim()
      ? parts.categoryId.trim()
      : null;
  const groupId =
    typeof parts.groupId === "string" && parts.groupId.trim()
      ? parts.groupId.trim()
      : null;
  const bracketId =
    typeof parts.bracketId === "string" && parts.bracketId.trim()
      ? parts.bracketId.trim()
      : null;
  const roundNumber = requirePositiveInt(parts.roundNumber, "roundNumber");
  const matchNumber = requirePositiveInt(parts.matchNumber, "matchNumber");

  return (
    LOGICAL_MATCH_KEY_VERSION +
    encodeRequiredSegment(competitionId) +
    encodeRequiredSegment(divisionId) +
    encodeOptionalSegment(categoryId) +
    encodeRequiredSegment(stageId) +
    encodeOptionalSegment(groupId) +
    encodeOptionalSegment(bracketId) +
    `R:${roundNumber}` +
    `M:${matchNumber}`
  );
}

/**
 * @param {unknown} key
 * @returns {boolean}
 */
export function isWellFormedLogicalMatchKey(key) {
  if (typeof key !== "string" || !key.trim()) return false;
  try {
    parseLogicalMatchKey(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} key
 * @returns {{
 *   version: string,
 *   competitionId: string,
 *   divisionId: string,
 *   categoryId: string|null,
 *   stageId: string,
 *   groupId: string|null,
 *   bracketId: string|null,
 *   roundNumber: number,
 *   matchNumber: number,
 * }}
 */
export function parseLogicalMatchKey(key) {
  const raw = String(key || "");
  if (!raw.startsWith(LOGICAL_MATCH_KEY_VERSION)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
      "Logical match key missing version prefix",
      { key: raw }
    );
  }

  let i = LOGICAL_MATCH_KEY_VERSION.length;
  const competitionId = readRequired(raw, () => i, (n) => {
    i = n;
  }, "competitionId");
  const divisionId = readRequired(raw, () => i, (n) => {
    i = n;
  }, "divisionId");
  const categoryId = readOptional(raw, () => i, (n) => {
    i = n;
  }, "categoryId");
  const stageId = readRequired(raw, () => i, (n) => {
    i = n;
  }, "stageId");
  const groupId = readOptional(raw, () => i, (n) => {
    i = n;
  }, "groupId");
  const bracketId = readOptional(raw, () => i, (n) => {
    i = n;
  }, "bracketId");

  const rMatch = /^R:([1-9]\d*)/.exec(raw.slice(i));
  if (!rMatch) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
      "Logical match key has invalid roundNumber",
      { key: raw }
    );
  }
  i += rMatch[0].length;
  const mMatch = /^M:([1-9]\d*)$/.exec(raw.slice(i));
  if (!mMatch) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
      "Logical match key has invalid matchNumber or trailing data",
      { key: raw }
    );
  }

  return {
    version: LOGICAL_MATCH_KEY_VERSION,
    competitionId,
    divisionId,
    categoryId,
    stageId,
    groupId,
    bracketId,
    roundNumber: Number(rMatch[1]),
    matchNumber: Number(mMatch[1]),
  };
}

/**
 * @param {string} raw
 * @param {() => number} getI
 * @param {(n: number) => void} setI
 * @param {string} field
 * @returns {string}
 */
function readRequired(raw, getI, setI, field) {
  const i = getI();
  if (!raw.startsWith("req:", i)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
      `Expected req segment for ${field}`,
      { field, at: i }
    );
  }
  let j = i + 4;
  const lenStart = j;
  while (j < raw.length && raw[j] >= "0" && raw[j] <= "9") j += 1;
  if (j === lenStart || raw[j] !== ":") {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
      `Invalid req length for ${field}`,
      { field }
    );
  }
  const len = Number(raw.slice(lenStart, j));
  j += 1;
  if (len < 1 || j + len > raw.length) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
      `Invalid req body for ${field}`,
      { field, len }
    );
  }
  const body = raw.slice(j, j + len);
  setI(j + len);
  return body;
}

/**
 * @param {string} raw
 * @param {() => number} getI
 * @param {(n: number) => void} setI
 * @param {string} field
 * @returns {string|null}
 */
function readOptional(raw, getI, setI, field) {
  const i = getI();
  if (raw.startsWith("opt:0", i)) {
    setI(i + 5);
    return null;
  }
  if (!raw.startsWith("opt:1:", i)) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
      `Expected opt segment for ${field}`,
      { field, at: i }
    );
  }
  let j = i + 6;
  const lenStart = j;
  while (j < raw.length && raw[j] >= "0" && raw[j] <= "9") j += 1;
  if (j === lenStart || raw[j] !== ":") {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
      `Invalid opt length for ${field}`,
      { field }
    );
  }
  const len = Number(raw.slice(lenStart, j));
  j += 1;
  if (len < 1 || j + len > raw.length) {
    throw new MatchGenerationContractError(
      MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH_KEY,
      `Invalid opt body for ${field}`,
      { field, len }
    );
  }
  const body = raw.slice(j, j + len);
  setI(j + len);
  return body;
}
