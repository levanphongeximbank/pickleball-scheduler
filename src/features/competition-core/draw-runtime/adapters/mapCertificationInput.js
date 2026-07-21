/**
 * CORE-08 Phase 1B — map plain legacy fixtures → DrawResolveRequest.
 * No production engine imports. No seed calculation. No placement algorithms.
 */

import { CANDIDATE_TYPE } from "../enums/candidateTypes.js";
import { createDrawResolveRequest } from "../contracts/drawRequest.js";
import {
  DRAW_CERTIFICATION_ERROR_CODE,
  createDrawCertificationError,
} from "./certificationErrors.js";
import { mapLegacyModeToPhase3h } from "./modeMapping.js";

/**
 * @param {unknown} value
 * @returns {string}
 */
function trimId(value) {
  return value == null ? "" : String(value).trim();
}

/**
 * @param {unknown} raw
 * @param {number} index
 * @returns {{ id: string, seedNumber: number|null, candidateType: string, metadata: Record<string, unknown>, manualPlacement: object|null, protectedPlacement: boolean }|null}
 */
function normalizeEntryLike(raw, index) {
  if (raw == null) return null;
  if (typeof raw === "string" || typeof raw === "number") {
    const id = trimId(raw);
    if (!id) return null;
    return {
      id,
      seedNumber: null,
      candidateType: CANDIDATE_TYPE.ENTRY,
      metadata: {},
      manualPlacement: null,
      protectedPlacement: false,
    };
  }
  if (typeof raw !== "object") return null;

  const id = trimId(
    raw.id ?? raw.entryId ?? raw.teamId ?? raw.candidateReference ?? raw.candidateId
  );
  if (!id) return null;

  let seedNumber = null;
  if (raw.seedNumber != null && Number.isFinite(Number(raw.seedNumber))) {
    seedNumber = Number(raw.seedNumber);
  } else if (raw.seed != null && Number.isFinite(Number(raw.seed))) {
    const seed = Number(raw.seed);
    seedNumber = seed > 0 ? seed : null;
  }

  let candidateType = CANDIDATE_TYPE.ENTRY;
  if (raw.candidateType === CANDIDATE_TYPE.TEAM || raw.teamId != null || raw.playerIds) {
    candidateType = CANDIDATE_TYPE.TEAM;
  } else if (raw.candidateType === CANDIDATE_TYPE.PARTICIPANT) {
    candidateType = CANDIDATE_TYPE.PARTICIPANT;
  }

  let manualPlacement = null;
  if (raw.manualPlacement && typeof raw.manualPlacement === "object") {
    manualPlacement = { ...raw.manualPlacement };
  } else if (
    raw.groupNumber != null &&
    Number.isFinite(Number(raw.groupNumber))
  ) {
    manualPlacement = {
      groupNumber: Number(raw.groupNumber),
      positionNumber:
        raw.positionNumber != null && Number.isFinite(Number(raw.positionNumber))
          ? Number(raw.positionNumber)
          : null,
    };
  }

  return {
    id,
    seedNumber,
    candidateType,
    metadata: {
      sourceIndex: index,
      name: raw.name != null ? String(raw.name) : undefined,
      label: raw.label != null ? String(raw.label) : undefined,
    },
    manualPlacement,
    protectedPlacement: raw.protectedPlacement === true || raw.protected === true,
  };
}

/**
 * Assign dense seedNumbers 1..n from caller-provided ranked order when seeds missing.
 * This preserves an already-ranked list as immutable seed references — it does not
 * compute skill/rating. Forbidden when options.forbidImpliedSeeds is true and any
 * seed is missing.
 *
 * @param {ReturnType<typeof normalizeEntryLike>[]} entries
 * @param {{ forbidImpliedSeeds?: boolean }} [options]
 */
function applyRankedSeedReferences(entries, options = {}) {
  const missing = entries.filter((e) => e && e.seedNumber == null);
  if (missing.length === 0) return { ok: true, entries };

  if (options.forbidImpliedSeeds) {
    return {
      ok: false,
      error: createDrawCertificationError(
        DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_SEED_RECALC_FORBIDDEN,
        "Seed numbers are required; adapter will not imply ranking from skill/rating",
        { missingCount: missing.length }
      ),
    };
  }

  // Dense seeds from given array order (caller ranking). Not a rating calculation.
  const next = entries.map((entry, index) =>
    entry.seedNumber == null
      ? { ...entry, seedNumber: index + 1 }
      : entry
  );
  return { ok: true, entries: next, impliedFromOrder: true };
}

/**
 * Build DrawResolveRequest from a plain certification fixture.
 *
 * @param {object} input
 * @param {string} input.competitionId
 * @param {string} input.contextId
 * @param {unknown[]} [input.entries]
 * @param {unknown[]} [input.teams]
 * @param {unknown[]} [input.candidates]
 * @param {unknown} [input.legacyMode]
 * @param {string} [input.drawMode] explicit Phase 3H mode
 * @param {number} [input.groupCount]
 * @param {number|null} [input.groupCapacity]
 * @param {unknown} [input.deterministicSeed]
 * @param {Array} [input.manualPlacements]
 * @param {Array} [input.protectedPlacements]
 * @param {Array} [input.seedAssignments]
 * @param {boolean} [input.forbidImpliedSeeds]
 * @param {boolean} [input.allowConditionalMode]
 * @param {Record<string, unknown>} [input.context]
 * @param {Record<string, unknown>} [input.metadata]
 */
export function mapCertificationInputToDrawResolveRequest(input = {}) {
  if (!input || typeof input !== "object") {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_INVALID_INPUT,
      "Certification input must be an object"
    );
  }

  const competitionId = trimId(input.competitionId ?? input.tournamentId);
  const contextId = trimId(input.contextId ?? input.eventId ?? input.divisionId);
  if (!competitionId || !contextId) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MISSING_IDENTITY,
      "competitionId and contextId are required",
      { competitionId, contextId }
    );
  }

  const modeMap = mapLegacyModeToPhase3h(input.legacyMode ?? input.mode, {
    allowConditional: input.allowConditionalMode !== false,
    explicitPhase3hMode: input.drawMode || input.phase3hMode || null,
  });
  if (modeMap.ok === false) {
    return modeMap;
  }

  const rawList = Array.isArray(input.candidates)
    ? input.candidates
    : Array.isArray(input.teams)
      ? input.teams
      : Array.isArray(input.entries)
        ? input.entries
        : [];

  if (rawList.length === 0) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_INVALID_INPUT,
      "At least one entry/team/candidate is required"
    );
  }

  /** @type {ReturnType<typeof normalizeEntryLike>[]} */
  const normalized = [];
  for (let i = 0; i < rawList.length; i += 1) {
    const row = normalizeEntryLike(rawList[i], i);
    if (!row) {
      return createDrawCertificationError(
        DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_INVALID_INPUT,
        "Every entry/team requires a stable id",
        { index: i }
      );
    }
    normalized.push(row);
  }

  const ids = new Set();
  for (const row of normalized) {
    if (ids.has(row.id)) {
      return createDrawCertificationError(
        DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_INVALID_INPUT,
        "Duplicate entry/team id",
        { id: row.id }
      );
    }
    ids.add(row.id);
  }

  const seeded = applyRankedSeedReferences(normalized, {
    forbidImpliedSeeds: input.forbidImpliedSeeds === true,
  });
  if (seeded.ok === false) return seeded.error;

  const groupCount =
    input.groupCount != null && Number.isFinite(Number(input.groupCount))
      ? Number(input.groupCount)
      : null;
  if (
    modeMap.phase3hMode !== "SEEDED_BRACKET" &&
    modeMap.phase3hMode !== "OPEN_RANDOM_BRACKET" &&
    modeMap.phase3hMode !== "NOOP" &&
    (groupCount == null || groupCount < 1)
  ) {
    return createDrawCertificationError(
      DRAW_CERTIFICATION_ERROR_CODE.ADAPTER_MISSING_GROUP_COUNT,
      "groupCount is required for group draw modes",
      { drawMode: modeMap.phase3hMode }
    );
  }

  const candidates = seeded.entries.map((row) => ({
    candidateId: row.id,
    candidateReference: row.id,
    candidateType: row.candidateType,
    seedNumber: row.seedNumber,
    seedAssignmentReference:
      row.seedNumber != null ? `seed:${row.id}:${row.seedNumber}` : null,
    eligible: true,
    protectedPlacement: row.protectedPlacement,
    manualPlacement: row.manualPlacement,
    metadata: row.metadata,
  }));

  const seedAssignments = Array.isArray(input.seedAssignments)
    ? input.seedAssignments
    : seeded.entries
        .filter((row) => row.seedNumber != null)
        .map((row) => ({
          candidateIdentityKey: null,
          candidateReference: row.id,
          seedNumber: row.seedNumber,
          seedAssignmentReference: `seed:${row.id}:${row.seedNumber}`,
        }));

  const request = createDrawResolveRequest({
    competitionId,
    contextId,
    formatType:
      typeof input.formatType === "string" ? input.formatType : null,
    candidates,
    seedAssignments,
    groupCount,
    groupCapacity:
      input.groupCapacity != null && Number.isFinite(Number(input.groupCapacity))
        ? Number(input.groupCapacity)
        : null,
    bracketSize:
      input.bracketSize != null && Number.isFinite(Number(input.bracketSize))
        ? Number(input.bracketSize)
        : null,
    drawMode: modeMap.phase3hMode,
    deterministicSeed:
      input.deterministicSeed !== undefined
        ? input.deterministicSeed
        : input.seed !== undefined
          ? input.seed
          : undefined,
    manualPlacements: Array.isArray(input.manualPlacements)
      ? input.manualPlacements
      : [],
    protectedPlacements: Array.isArray(input.protectedPlacements)
      ? input.protectedPlacements
      : [],
    allowNonPowerOfTwo: input.allowNonPowerOfTwo === true,
    context: {
      ...(input.context && typeof input.context === "object" ? input.context : {}),
      certificationTarget: input.certificationTarget || null,
      legacyMode: modeMap.legacyMode,
      mappingStatus: modeMap.status,
    },
    metadata: {
      ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}),
      impliedSeedsFromOrder: seeded.impliedFromOrder === true,
      phase: "CORE08_PHASE_1B",
    },
  });

  return {
    ok: true,
    request,
    modeMapping: modeMap,
    candidateCount: candidates.length,
  };
}
