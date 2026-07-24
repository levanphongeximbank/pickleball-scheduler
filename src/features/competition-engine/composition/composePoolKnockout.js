/**
 * E2E-02 — Compose Pool → Qualification → Knockout vertical slice.
 */

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
import { composeKnockoutStage } from "./knockoutStage.js";
import { composePoolStage } from "./poolStage.js";
import { composeQualificationAdvancement } from "./qualification.js";

/**
 * @param {{
 *   competitionId: string,
 *   tenantId: string,
 *   divisionId?: string,
 *   categoryId?: string|null,
 *   participants: Array<{ participantId: string, seedNumber?: number }|string>,
 *   deterministicSeed: string,
 *   formatOverrides?: object,
 *   format?: object,
 *   poolStandingsRows?: object[],
 *   poolMatchResults?: object[],
 *   poolStageComplete?: boolean,
 *   includeKnockout?: boolean,
 *   templateVersion?: number,
 *   formatVersion?: string,
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

  const poolStage = composePoolStage({
    participants: input.participants,
    format,
    competitionId,
    tenantId,
    divisionId: input.divisionId,
    categoryId: input.categoryId,
    deterministicSeed: input.deterministicSeed,
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
  let knockoutStage = null;

  if (wantsKnockout && hasQualificationInputs) {
    if (!poolStageComplete) {
      failE2E02(
        E2E02_ERROR_CODE.POOL_STAGE_INCOMPLETE,
        "cannot compose knockout before pool stage is complete",
        {}
      );
    }
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
  } else if (wantsKnockout && !hasQualificationInputs) {
    // Pool-only composition is valid; knockout deferred until standings/results exist.
    qualification = null;
    knockoutStage = null;
  }

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
      qualificationQualifierIds: qualification
        ? qualification.qualifiers.map((q) => q.participantId)
        : [],
      knockoutFingerprint: knockoutStage
        ? knockoutStage.compositionFingerprint
        : null,
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
    stages: {
      pool: poolStage,
      qualification,
      knockout: knockoutStage,
    },
    publicationArchiveReady: Boolean(poolStage),
    deterministicReplayReady: true,
  });
}
