/**
 * Phase 3H — Legacy draw source → DrawCandidate[] (map-only).
 * Accepts plain objects — no Production engine imports or execution.
 */

import { createDrawCandidate } from "../contracts/drawCandidate.js";
import { CANDIDATE_TYPE } from "../enums/candidateTypes.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";
import { normalizeCandidates } from "../services/normalizeCandidates.js";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export function isLegacyDrawSource(source, context = {}) {
  if (Array.isArray(source)) return source.length > 0;
  if (!source || typeof source !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (source);
  const explicit =
    s.__sourceType || context.sourceType || context.__sourceType || null;
  if (
    explicit === "LEGACY_DRAW" ||
    explicit === "LEGACY" ||
    explicit === "legacy_draw"
  ) {
    return true;
  }
  if (
    Array.isArray(s.participants) ||
    Array.isArray(s.entries) ||
    Array.isArray(s.teams) ||
    Array.isArray(s.candidates)
  ) {
    return true;
  }
  if (s.id != null && (s.seed != null || s.seedNumber != null || s.name != null)) {
    return true;
  }
  return false;
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {import('../contracts/drawCandidate.js').DrawCandidate[]}
 */
export function mapLegacyDrawToCandidates(source, context = {}) {
  if (!isLegacyDrawSource(source, context)) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_UNSUPPORTED_SOURCE,
      "Source is not a legacy draw payload",
      {}
    );
  }

  /** @type {Array<Record<string, unknown>>} */
  let rows = [];
  if (Array.isArray(source)) {
    rows = source.filter((item) => item && typeof item === "object");
  } else if (source && typeof source === "object") {
    const s = /** @type {Record<string, unknown>} */ (source);
    if (Array.isArray(s.candidates)) {
      rows = s.candidates;
    } else if (Array.isArray(s.participants)) {
      rows = s.participants;
    } else if (Array.isArray(s.entries)) {
      rows = s.entries;
    } else if (Array.isArray(s.teams)) {
      rows = s.teams.map((team) => ({
        .../** @type {Record<string, unknown>} */ (team),
        candidateType: CANDIDATE_TYPE.TEAM,
        teamId: /** @type {Record<string, unknown>} */ (team).id,
      }));
    } else {
      rows = [s];
    }
  }

  const competitionId = String(context.competitionId || "");
  const contextId = String(context.contextId || "");
  const drawIdentityKey =
    typeof context.drawIdentityKey === "string"
      ? context.drawIdentityKey
      : undefined;

  const normalized = normalizeCandidates(rows, {
    competitionId,
    contextId,
    drawIdentityKey,
  });

  return normalized.map((candidate) =>
    createDrawCandidate({
      ...candidate,
      competitionId,
      contextId,
      drawIdentityKey,
    })
  );
}
