/**
 * E2E-02 — Compose shared Pool → Qualification → Knockout or no-group
 * admission → Knockout vertical slice.
 *
 * When canonical admission profile/plan is supplied:
 *   pool (bypass) → standings → composeKnockoutAdmission → composeKnockoutStage
 * When absent: legacy TOP_N qualification → knockout (backward compatible).
 */

import { deriveKnockoutAdmissionPlan } from "../../competition-core/competition-rules/index.js";
import { createPoolKnockoutFormatDefinition } from "../formats/poolKnockoutFormat.js";
import {
  E2E02_COMPOSITION_VERSION,
  E2E02_FORMAT_VERSION,
  E2E02_TEMPLATE_ID,
  E2E02_TEMPLATE_VERSION,
} from "./constants.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";
import {
  computeDeterministicFingerprint,
  deepFreeze,
  isNonEmptyString,
} from "./fingerprint.js";
import { composeKnockoutAdmission } from "./knockoutAdmission.js";
import { composeKnockoutStage } from "./knockoutStage.js";
import { normalizeCompetitionUnitParticipants } from "./entryIdentity.js";
import { composePoolStage } from "./poolStage.js";
import { composeQualificationAdvancement } from "./qualification.js";

/**
 * @param {string[]} ids
 * @returns {Set<string>}
 */
function toUniqueIdSet(ids, label) {
  const set = new Set();
  for (const raw of ids) {
    const id = String(raw || "").trim();
    if (!id) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        `empty identity in ${label}`,
        {}
      );
    }
    if (set.has(id)) {
      failE2E02(
        E2E02_ERROR_CODE.DUPLICATE_PARTICIPANT,
        `duplicate identity in ${label}`,
        { entryId: id }
      );
    }
    set.add(id);
  }
  return set;
}

/**
 * @param {Set<string>} a
 * @param {Set<string>} b
 */
function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}

/**
 * @param {{
 *   competitionId: string,
 *   tenantId: string,
 *   divisionId?: string,
 *   categoryId?: string|null,
 *   competitionVersionId?: string|null,
 *   participants: Array<{ entryId?: string, participantId?: string, seedNumber?: number }|string>,
 *   deterministicSeed: string,
 *   formatOverrides?: object,
 *   format?: object,
 *   poolStandingsRows?: object[],
 *   poolMatchResults?: object[],
 *   poolStageComplete?: boolean,
 *   includeKnockout?: boolean,
 *   templateVersion?: number,
 *   formatVersion?: string,
 *   competitionRulesProfile?: object,
 *   knockoutAdmissionPlan?: object|null,
 *   competitionPopulationEntryIds?: string[],
 *   excludedEntryIds?: string[],
 *   entryStatusesByEntryId?: Record<string, string>,
 *   competitionUnitKind?: string|null,
 *   groupStageSeedingProjection?: object|null,
 *   knockoutSeedingProjection?: object|null,
 *   authoritativeSeedingProjection?: object|null,
 * }} input
 */
export function composeIndividualPoolKnockout(input) {
  const competitionId = String(input.competitionId || "").trim();
  const tenantId = String(input.tenantId || "").trim();
  if (!competitionId) {
    failE2E02(
      E2E02_ERROR_CODE.MISSING_COMPETITION_IDENTITY,
      "competitionId is required",
      {}
    );
  }
  if (!tenantId) {
    failE2E02(E2E02_ERROR_CODE.MISSING_TENANT, "tenantId is required", {});
  }
  if (!isNonEmptyString(input.deterministicSeed)) {
    failE2E02(
      E2E02_ERROR_CODE.MISSING_DETERMINISTIC_SEED,
      "deterministicSeed is required",
      {}
    );
  }

  const format =
    input.format ||
    createPoolKnockoutFormatDefinition(input.formatOverrides || {});

  const admissionAware =
    input.competitionRulesProfile != null ||
    input.knockoutAdmissionPlan != null;

  /** @type {object|null} */
  let knockoutAdmissionPlan = input.knockoutAdmissionPlan || null;
  /** @type {string[]} */
  let canonicalPopulation = [];
  /** @type {Array<{ entryId: string, participantId: string, seedNumber?: number }>} */
  let admissionParticipants = [];
  /** @type {Record<string, string>} */
  const entryStatusesByEntryId = {
    ...(input.entryStatusesByEntryId || {}),
  };

  if (admissionAware) {
    const units = normalizeCompetitionUnitParticipants(input.participants || [], {
      requireCanonicalEntryId: true,
      competitionUnitKind: input.competitionUnitKind,
    });
    admissionParticipants = units.map((u) => ({
      entryId: u.entryId,
      participantId: u.participantId || u.entryId,
      ...(u.seedNumber != null ? { seedNumber: u.seedNumber } : {}),
    }));
    (input.participants || []).forEach((raw, index) => {
      if (raw && typeof raw === "object" && raw.status != null) {
        entryStatusesByEntryId[units[index].entryId] = String(raw.status);
      }
    });

    const participantSet = toUniqueIdSet(
      units.map((u) => u.entryId),
      "normalized participants"
    );

    if (Array.isArray(input.competitionPopulationEntryIds)) {
      const explicitSet = toUniqueIdSet(
        input.competitionPopulationEntryIds,
        "competitionPopulationEntryIds"
      );
      if (!setsEqual(participantSet, explicitSet)) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          "competitionPopulationEntryIds must equal proven participant entryId set",
          {
            POPULATION_MISMATCH_FAIL_CLOSED: true,
            participantCount: participantSet.size,
            explicitCount: explicitSet.size,
          }
        );
      }
    }

    canonicalPopulation = [...participantSet].sort();

    if (!knockoutAdmissionPlan) {
      const derived = deriveKnockoutAdmissionPlan(
        input.competitionRulesProfile,
        { competitionPopulationEntryIds: canonicalPopulation }
      );
      if (!derived.ok) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          derived.message || "knockout admission plan derivation failed",
          { code: derived.code, details: derived.details || {} }
        );
      }
      knockoutAdmissionPlan = derived.knockoutAdmissionPlan;
    }

    const planPop = knockoutAdmissionPlan?.populations?.competitionPopulationEntryIds;
    if (Array.isArray(planPop)) {
      const planSet = toUniqueIdSet(planPop, "plan competitionPopulationEntryIds");
      if (!setsEqual(planSet, participantSet)) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          "knockoutAdmissionPlan population must equal proven participant entryId set",
          { POPULATION_MISMATCH_FAIL_CLOSED: true }
        );
      }
    }
  }

  const noGroupAdmission =
    admissionAware && knockoutAdmissionPlan?.groupStageEnabled === false;
  const poolStage = noGroupAdmission
    ? null
    : composePoolStage({
        participants: admissionAware
          ? admissionParticipants
          : input.participants,
        format,
        competitionId,
        tenantId,
        divisionId: input.divisionId,
        categoryId: input.categoryId,
        competitionVersionId: input.competitionVersionId,
        deterministicSeed: input.deterministicSeed,
        competitionRulesProfile: admissionAware
          ? input.competitionRulesProfile
          : undefined,
        knockoutAdmissionPlan: admissionAware ? knockoutAdmissionPlan : undefined,
        applyGroupStageBypass: admissionAware,
        requireCanonicalEntryId: admissionAware,
        competitionUnitKind: input.competitionUnitKind,
        groupStageSeedingProjection: admissionAware
          ? input.groupStageSeedingProjection
          : undefined,
        knockoutSeedingProjection: admissionAware
          ? input.knockoutSeedingProjection
          : undefined,
        authoritativeSeedingProjection: admissionAware
          ? input.authoritativeSeedingProjection
          : undefined,
      });

  const poolStageComplete = input.poolStageComplete !== false;
  const wantsKnockout = input.includeKnockout !== false;
  const hasQualificationInputs =
    (Array.isArray(input.poolStandingsRows) &&
      input.poolStandingsRows.length > 0) ||
    (Array.isArray(input.poolMatchResults) &&
      input.poolMatchResults.length > 0);

  /** @type {object|null} */
  let qualification = null;
  /** @type {object|null} */
  let knockoutAdmission = null;
  /** @type {object|null} */
  let knockoutStage = null;

  if (wantsKnockout && noGroupAdmission) {
    knockoutAdmission = composeKnockoutAdmission({
      knockoutAdmissionPlan,
      competitionRulesProfile: input.competitionRulesProfile,
      standingsByGroup: [],
      competitionPopulationEntryIds: canonicalPopulation,
      excludedEntryIds: input.excludedEntryIds,
      entryStatusesByEntryId,
      deterministicSeed: input.deterministicSeed,
      knockoutRequired: true,
      competitionId,
      competitionVersionId: input.competitionVersionId,
      divisionId: input.divisionId,
      categoryId: input.categoryId,
      competitionUnitKind: input.competitionUnitKind,
      knockoutSeedingProjection: input.knockoutSeedingProjection,
      authoritativeSeedingProjection: input.authoritativeSeedingProjection,
      groupStageSeedingProjection: input.groupStageSeedingProjection,
    });

    knockoutStage = composeKnockoutStage({
      format,
      qualification: { qualifiers: knockoutAdmission.qualifiers },
      competitionId,
      tenantId,
      divisionId: input.divisionId,
      categoryId: input.categoryId,
      competitionVersionId: input.competitionVersionId,
      deterministicSeed: input.deterministicSeed,
      placementMode: knockoutAdmission.drawPlacementMode,
    });
  } else if (wantsKnockout && hasQualificationInputs) {
    if (!poolStageComplete) {
      failE2E02(
        E2E02_ERROR_CODE.POOL_STAGE_INCOMPLETE,
        "cannot compose knockout before pool stage is complete",
        {}
      );
    }

    if (admissionAware) {
      qualification = composeQualificationAdvancement({
        format,
        poolStage,
        poolStandingsRows: input.poolStandingsRows,
        poolMatchResults: input.poolMatchResults,
        competitionId,
        poolStageComplete: true,
        advancementMode: "STANDINGS_ONLY",
      });

      const standingsByGroup = Object.entries(
        qualification.standingsByGroup || {}
      ).map(([groupId, rows]) => ({
        groupId,
        rows,
      }));

      knockoutAdmission = composeKnockoutAdmission({
        knockoutAdmissionPlan,
        competitionRulesProfile: input.competitionRulesProfile,
        standingsByGroup,
        competitionPopulationEntryIds: canonicalPopulation,
        deterministicSeed: input.deterministicSeed,
        knockoutRequired: true,
        competitionId,
        competitionVersionId: input.competitionVersionId,
        divisionId: input.divisionId,
        categoryId: input.categoryId,
        competitionUnitKind: input.competitionUnitKind,
        knockoutSeedingProjection: input.knockoutSeedingProjection,
        authoritativeSeedingProjection: input.authoritativeSeedingProjection,
        groupStageSeedingProjection: input.groupStageSeedingProjection,
      });

      knockoutStage = composeKnockoutStage({
        format,
        qualification: { qualifiers: knockoutAdmission.qualifiers },
        competitionId,
        tenantId,
        divisionId: input.divisionId,
        categoryId: input.categoryId,
        competitionVersionId: input.competitionVersionId,
        deterministicSeed: input.deterministicSeed,
        poolStageComplete: true,
        placementMode: knockoutAdmission.drawPlacementMode,
      });
    } else {
      qualification = composeQualificationAdvancement({
        format,
        poolStage,
        poolStandingsRows: input.poolStandingsRows,
        poolMatchResults: input.poolMatchResults,
        competitionId,
        poolStageComplete: true,
      });
      knockoutStage = composeKnockoutStage({
        format,
        qualification,
        competitionId,
        tenantId,
        divisionId: input.divisionId,
        categoryId: input.categoryId,
        competitionVersionId: input.competitionVersionId,
        deterministicSeed: input.deterministicSeed,
        poolStageComplete: true,
      });
    }
  } else if (wantsKnockout && !hasQualificationInputs) {
    qualification = null;
    knockoutAdmission = null;
    knockoutStage = null;
  }

  const qualifierIds = knockoutAdmission
    ? knockoutAdmission.qualifiers.map((q) => q.entryId || q.participantId)
    : qualification
      ? qualification.qualifiers.map((q) => q.participantId)
      : [];

  const compositionIdentifier = computeDeterministicFingerprint(
    {
      competitionId,
      tenantId,
      templateId: E2E02_TEMPLATE_ID,
      templateVersion: input.templateVersion ?? E2E02_TEMPLATE_VERSION,
      formatId: format.formatId,
      formatVersion: input.formatVersion ?? format.formatVersion ?? E2E02_FORMAT_VERSION,
      formatFingerprint: format.configurationFingerprint,
      poolFingerprint: poolStage?.compositionFingerprint || null,
      qualificationQualifierIds: qualifierIds,
      knockoutFingerprint: knockoutStage
        ? knockoutStage.compositionFingerprint
        : null,
      admissionAware,
      canonicalPopulation: admissionAware ? canonicalPopulation : null,
      deterministicSeed: input.deterministicSeed,
      compositionVersion: E2E02_COMPOSITION_VERSION,
    },
    "composition"
  );

  return deepFreeze({
    compositionIdentifier,
    compositionVersion: E2E02_COMPOSITION_VERSION,
    templateId: E2E02_TEMPLATE_ID,
    templateVersion: input.templateVersion ?? E2E02_TEMPLATE_VERSION,
    formatId: format.formatId,
    formatVersion: format.formatVersion,
    format,
    competitionId,
    tenantId,
    admissionAware: Boolean(admissionAware),
    canonicalCompetitionPopulationEntryIds: admissionAware
      ? Object.freeze([...canonicalPopulation])
      : null,
    knockoutAdmissionPlan: admissionAware ? knockoutAdmissionPlan : null,
    stages: {
      pool: poolStage,
      qualification,
      knockoutAdmission,
      knockout: knockoutStage,
    },
    publicationArchiveReady: Boolean(poolStage || knockoutStage),
    deterministicReplayReady: true,
  });
}
