/**
 * CE composition boundary — consume CORE-07 authoritative seeding projections.
 *
 * Does NOT allocate seeds. Reuses:
 *   projectAuthoritativeSeedingResult
 *   mapAuthoritativeProjectionToDrawSeedRanking
 */

import {
  FINALIZATION_STATE,
  mapAuthoritativeProjectionToDrawSeedRanking,
  projectAuthoritativeSeedingResult,
} from "../../competition-core/seeding/index.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";

/**
 * Normalize a scope id dimension for exact null-vs-value comparison.
 * Empty string → null (matches CORE-07 opaque-id empty handling).
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeEffectiveScopeId(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/**
 * Resolve the SAME effective competition scope used by E2E02 draw/match composition.
 * Historical pool/knockout execution uses division fallback `"div-1"` when omitted —
 * validation must use that same effective division, never a divergent null.
 *
 * @param {{
 *   competitionId: string,
 *   divisionId?: string|null,
 *   categoryId?: string|null,
 * }} input
 * @returns {{ competitionId: string, effectiveDivisionId: string, effectiveCategoryId: string|null }}
 */
export function resolveEffectiveCompetitionScope(input) {
  const competitionId = String(input?.competitionId || "").trim();
  if (!competitionId) {
    failE2E02(
      E2E02_ERROR_CODE.MISSING_COMPETITION_IDENTITY,
      "competitionId required to resolve effective competition scope",
      { UNKNOWN_EFFECTIVE_SCOPE: true }
    );
  }

  const suppliedDivision = normalizeEffectiveScopeId(input?.divisionId);
  // Must match poolStage / poolGrouping / knockoutStage draw context fallback.
  const effectiveDivisionId = suppliedDivision || "div-1";
  const effectiveCategoryId = normalizeEffectiveScopeId(input?.categoryId);

  return Object.freeze({
    competitionId,
    effectiveDivisionId,
    effectiveCategoryId,
  });
}

/**
 * Exact null-aware equality for CORE-07 scope dimensions (null ≠ concrete id).
 * @param {string|null} expected
 * @param {string|null} actual
 */
function scopeIdsExactEqual(expected, actual) {
  return expected === actual;
}

/**
 * @param {string|null|undefined} unitKind
 * @returns {string|null}
 */
export function mapCompetitionUnitKindToSeedingEntryType(unitKind) {
  const k = String(unitKind || "")
    .trim()
    .toUpperCase();
  if (!k) return null;
  if (k === "SINGLES" || k === "PARTICIPANT" || k === "INDIVIDUAL") {
    return "PARTICIPANT";
  }
  if (k === "PAIR" || k === "DOUBLES") return "PAIR";
  if (k === "TEAM") return "TEAM";
  if (k === "ENTRY") return "ENTRY";
  return null;
}

/**
 * Normalize raw SeedingResult or already-projected CORE-07 projection.
 * @param {object} input
 */
export function resolveCore07AuthoritativeProjection(input) {
  if (!input || typeof input !== "object") {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "CORE-07 authoritative seeding projection/result required",
      {}
    );
  }

  // Already a CORE-07 projection (assignments + FINALIZED + seedingScope)
  if (
    Array.isArray(input.assignments) &&
    input.finalizationState === FINALIZATION_STATE.FINALIZED &&
    (input.seedingScope || input.scope)
  ) {
    return input;
  }

  // Authoritative SeedingResult → project via CORE-07
  if (Array.isArray(input.orderedAssignments)) {
    try {
      return projectAuthoritativeSeedingResult(input);
    } catch (err) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        err?.message || "CORE-07 authoritative seeding projection failed",
        {
          causeCode: err?.code || null,
          CORE07_PROJECTION_API: "projectAuthoritativeSeedingResult",
        }
      );
    }
  }

  failE2E02(
    E2E02_ERROR_CODE.INVALID_CONFIGURATION,
    "input is neither a FINALIZED CORE-07 seeding projection nor a FINALIZED SeedingResult",
    {
      CORE07_PROJECTION_API: "projectAuthoritativeSeedingResult",
    }
  );
}

/**
 * Exact effective-scope match for canonical admission-aware CORE-07 consumption.
 * divisionId/categoryId null on the projection is NOT a wildcard.
 * stageId null remains competition-wide (may serve GROUP/KNOCKOUT).
 *
 * @param {object} projection
 * @param {{
 *   competitionId: string,
 *   divisionId: string,
 *   categoryId: string|null,
 *   stageId?: string|null,
 *   competitionUnitKind?: string|null,
 *   role: "GROUP" | "KNOCKOUT",
 * }} expected — divisionId/categoryId MUST be the resolved effective scope
 */
export function assertCore07ProjectionScopeCompatible(projection, expected) {
  const scope = projection?.seedingScope || projection?.scope || {};
  const competitionId = String(expected.competitionId || "").trim();
  if (String(scope.competitionId || "").trim() !== competitionId) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "CORE-07 seeding projection competitionId mismatch",
      {
        expected: competitionId,
        actual: scope.competitionId ?? null,
        role: expected.role,
      }
    );
  }

  const wantDivision = normalizeEffectiveScopeId(expected.divisionId);
  const gotDivision = normalizeEffectiveScopeId(scope.divisionId);
  if (wantDivision == null || wantDivision === "") {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "effective division scope unknown — cannot validate CORE-07 projection",
      { UNKNOWN_EFFECTIVE_SCOPE: true, role: expected.role }
    );
  }
  if (!scopeIdsExactEqual(wantDivision, gotDivision)) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "CORE-07 seeding projection divisionId mismatch against effective execution scope",
      {
        expected: wantDivision,
        actual: gotDivision,
        role: expected.role,
        DIVISION_NULL_AS_WILDCARD: false,
        CROSS_DIVISION_SEED_PROJECTION: true,
      }
    );
  }

  const wantCategory = normalizeEffectiveScopeId(expected.categoryId);
  const gotCategory = normalizeEffectiveScopeId(scope.categoryId);
  if (!scopeIdsExactEqual(wantCategory, gotCategory)) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      "CORE-07 seeding projection categoryId mismatch against effective execution scope",
      {
        expected: wantCategory,
        actual: gotCategory,
        role: expected.role,
        CATEGORY_NULL_AS_WILDCARD: false,
        CROSS_CATEGORY_SEED_PROJECTION: true,
      }
    );
  }

  const expectedEntryType = mapCompetitionUnitKindToSeedingEntryType(
    expected.competitionUnitKind
  );
  if (expectedEntryType) {
    const got = normalizeEffectiveScopeId(scope.entryType);
    if (!got) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "CORE-07 seeding projection missing entryType",
        { expectedEntryType, role: expected.role }
      );
    }
    const gotUpper = String(got).toUpperCase();
    // ENTRY is a generic competition-entry scope; accept alongside mapped kind.
    if (gotUpper !== expectedEntryType && gotUpper !== "ENTRY") {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "CORE-07 seeding projection entryType incompatible with competition unit kind",
        {
          expectedEntryType,
          actual: gotUpper,
          competitionUnitKind: expected.competitionUnitKind,
          role: expected.role,
        }
      );
    }
  }

  if (expected.stageId != null && String(expected.stageId).trim()) {
    const want = String(expected.stageId).trim();
    const got = normalizeEffectiveScopeId(scope.stageId);
    // Null stageId on projection = competition-wide; allowed for either stage.
    if (got != null && got !== want) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "CORE-07 seeding projection stageId incompatible with composition stage",
        {
          expected: want,
          actual: got,
          role: expected.role,
          WRONG_STAGE_SEED_PROJECTION: true,
        }
      );
    }
  }
}

/**
 * Whether a competition-wide (stageId null) projection may serve a stage role.
 * Stage-specific projections must match the requested stageId.
 *
 * @param {object} projectionOrResult
 * @param {string} stageId
 */
export function projectionMayServeStage(projectionOrResult, stageId) {
  if (!projectionOrResult || typeof projectionOrResult !== "object") return false;
  const scope =
    projectionOrResult.seedingScope || projectionOrResult.scope || {};
  const got = normalizeEffectiveScopeId(scope.stageId);
  if (got == null) return true;
  return got === String(stageId || "").trim();
}

/**
 * Select stage-appropriate CORE-07 projection input.
 * Prefer stage-specific keys; allow competition-wide authoritativeSeedingProjection
 * when its stageId is null or matches.
 *
 * @param {{
 *   groupStageSeedingProjection?: object|null,
 *   knockoutSeedingProjection?: object|null,
 *   authoritativeSeedingProjection?: object|null,
 * }} input
 * @param {"GROUP"|"KNOCKOUT"} role
 * @param {string} stageId
 */
export function selectCore07SeedingProjectionForStage(input, role, stageId) {
  const bag = input || {};
  if (role === "GROUP") {
    if (bag.groupStageSeedingProjection) return bag.groupStageSeedingProjection;
    if (
      bag.authoritativeSeedingProjection &&
      projectionMayServeStage(bag.authoritativeSeedingProjection, stageId)
    ) {
      return bag.authoritativeSeedingProjection;
    }
    return null;
  }
  if (bag.knockoutSeedingProjection) return bag.knockoutSeedingProjection;
  if (
    bag.authoritativeSeedingProjection &&
    projectionMayServeStage(bag.authoritativeSeedingProjection, stageId)
  ) {
    return bag.authoritativeSeedingProjection;
  }
  return null;
}

/**
 * Map CORE-07 projection → seedNumber by entryId for a required entry set.
 * Fail closed on missing coverage, invalid seeds, or duplicates among required ids.
 *
 * @param {object} projectionOrResult
 * @param {string[]} requiredEntryIds
 * @param {object} expectedScope
 * @returns {Record<string, number>}
 */
export function resolveAuthoritativeSeedMapFromCore07(
  projectionOrResult,
  requiredEntryIds,
  expectedScope
) {
  const projection = resolveCore07AuthoritativeProjection(projectionOrResult);
  assertCore07ProjectionScopeCompatible(projection, expectedScope);

  let ranking;
  try {
    ranking = mapAuthoritativeProjectionToDrawSeedRanking(projection);
  } catch (err) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_CONFIGURATION,
      err?.message || "CORE-07 draw seed ranking projection failed",
      {
        causeCode: err?.code || null,
        CORE07_PROJECTION_API: "mapAuthoritativeProjectionToDrawSeedRanking",
      }
    );
  }

  /** @type {Map<string, number>} */
  const byEntry = new Map();
  for (const row of ranking) {
    const entryId = String(row.entryId || "").trim();
    const seedNumber = Number(row.seedNumber);
    if (!entryId) continue;
    if (!Number.isFinite(seedNumber) || seedNumber < 1) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "CORE-07 projection contains invalid seedNumber",
        { entryId, seedNumber }
      );
    }
    if (byEntry.has(entryId)) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "CORE-07 projection contains duplicate entryId",
        { entryId }
      );
    }
    byEntry.set(entryId, seedNumber);
  }

  const required = (requiredEntryIds || [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  /** @type {Record<string, number>} */
  const out = {};
  /** @type {Set<number>} */
  const usedSeeds = new Set();

  for (const entryId of required) {
    if (!byEntry.has(entryId)) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "CORE-07 authoritative seeding does not cover required competition unit — fail closed",
        {
          entryId,
          ADMITTED_FIELD_SEED_COVERAGE_REQUIRED: true,
          PARTIAL_SEED_FAIL_CLOSED: true,
          role: expectedScope.role,
        }
      );
    }
    const seedNumber = byEntry.get(entryId);
    if (usedSeeds.has(seedNumber)) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "duplicate seedNumber among required competition units — fail closed",
        { entryId, seedNumber, DUPLICATE_SEED_FAIL_CLOSED: true }
      );
    }
    usedSeeds.add(seedNumber);
    out[entryId] = seedNumber;
  }

  return Object.freeze(out);
}
