/**
 * E2E-02 — Compose Pool → Qualification → Knockout vertical slice.
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
 * @param {{
 *   competitionId: string,
 *   tenantId: string,
 *   divisionId?: string,
 *   categoryId?: string|null,
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
 *   competitionUnitKind?: string|null,
 *   authoritativeSeedsByEntryId?: Record<string, number>,
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
  let competitionPopulationEntryIds = Array.isArray(
    input.competitionPopulationEntryIds
  )
    ? input.competitionPopulationEntryIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (admissionAware) {
    const units = normalizeCompetitionUnitParticipants(input.participants || [], {
      requireCanonicalEntryId: true,
      competitionUnitKind: input.competitionUnitKind,
    });
    if (!competitionPopulationEntryIds.length) {
      competitionPopulationEntryIds = units.map((u) => u.entryId);
    }
    if (!knockoutAdmissionPlan) {
      const derived = deriveKnockoutAdmissionPlan(
        input.competitionRulesProfile,
        { competitionPopulationEntryIds }
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
  }

  const poolStage = composePoolStage({
    participants: input.participants,
    format,
    competitionId,
    tenantId,
    divisionId: input.divisionId,
    categoryId: input.categoryId,
    deterministicSeed: input.deterministicSeed,
    competitionRulesProfile: admissionAware
      ? input.competitionRulesProfile
      : undefined,
    knockoutAdmissionPlan: admissionAware ? knockoutAdmissionPlan : undefined,
    applyGroupStageBypass: admissionAware,
    requireCanonicalEntryId: admissionAware,
    competitionUnitKind: input.competitionUnitKind,
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

  if (wantsKnockout && hasQualificationInputs) {
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
        competitionPopulationEntryIds,
        deterministicSeed: input.deterministicSeed,
        knockoutRequired: true,
        authoritativeSeedsByEntryId: input.authoritativeSeedsByEntryId,
      });

      knockoutStage = composeKnockoutStage({
        format,
        qualification: { qualifiers: knockoutAdmission.qualifiers },
        competitionId,
        tenantId,
        divisionId: input.divisionId,
        categoryId: input.categoryId,
        deterministicSeed: input.deterministicSeed,
        poolStageComplete: true,
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
      poolFingerprint: poolStage.compositionFingerprint,
      qualificationQualifierIds: qualifierIds,
      knockoutFingerprint: knockoutStage
        ? knockoutStage.compositionFingerprint
        : null,
      admissionAware,
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
    knockoutAdmissionPlan: admissionAware ? knockoutAdmissionPlan : null,
    stages: {
      pool: poolStage,
      qualification,
      knockoutAdmission,
      knockout: knockoutStage,
    },
    publicationArchiveReady: Boolean(poolStage),
    deterministicReplayReady: true,
  });
}
