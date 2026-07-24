/**
 * E2E-02 Competition Management runtime wiring facade.
 *
 * Resolves template, instantiates, validates config, associates format/workflow,
 * and exposes runtime-ready composition. Does not expand UI/portals.
 */

import { createCompetitionRuntimePorts } from "../integration/composition/createCompetitionRuntimePorts.js";
import { composeIndividualPoolKnockout } from "../composition/composePoolKnockout.js";
import {
  E2E02_COMPOSITION_PHASE,
  E2E02_RULE_REFERENCES,
} from "../composition/constants.js";
import { E2E02_ERROR_CODE, failE2E02 } from "../composition/errors.js";
import { deepFreeze, isNonEmptyString } from "../composition/fingerprint.js";
import {
  ensureIndividualPoolKnockoutTemplateRegistered,
  instantiateIndividualPoolKnockoutTemplate,
} from "./instantiateIndividualPoolKnockout.js";

/**
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   participants: Array<{ participantId: string, seedNumber?: number }|string>,
 *   deterministicSeed: string,
 *   definition?: object,
 *   formatOverrides?: object,
 *   poolStandingsRows?: object[],
 *   poolMatchResults?: object[],
 *   poolStageComplete?: boolean,
 *   includeKnockout?: boolean,
 *   catalog?: object,
 *   runtimePorts?: object,
 *   runtimePortDeps?: object,
 *   requireRuntimePorts?: boolean,
 * }} input
 */
export function createPoolKnockoutRuntimeComposition(input) {
  const tenantId = String(input.tenantId || "").trim();
  const competitionId = String(input.competitionId || "").trim();
  if (!tenantId) {
    failE2E02(E2E02_ERROR_CODE.MISSING_TENANT, "tenantId is required", {});
  }
  if (!competitionId) {
    failE2E02(
      E2E02_ERROR_CODE.MISSING_COMPETITION_IDENTITY,
      "competitionId is required",
      {}
    );
  }
  if (!isNonEmptyString(input.deterministicSeed)) {
    failE2E02(
      E2E02_ERROR_CODE.MISSING_DETERMINISTIC_SEED,
      "deterministicSeed is required",
      {}
    );
  }

  const requireRuntimePorts = input.requireRuntimePorts !== false;
  const runtimePorts =
    input.runtimePorts ||
    (requireRuntimePorts
      ? createCompetitionRuntimePorts(input.runtimePortDeps || {})
      : null);

  if (requireRuntimePorts) {
    if (!runtimePorts || typeof runtimePorts !== "object") {
      failE2E02(
        E2E02_ERROR_CODE.MISSING_INTEGRATION_PORTS,
        "E2E-01 createCompetitionRuntimePorts bag is required",
        {}
      );
    }
    if (!runtimePorts.identityEvidencePort || !runtimePorts.requireIntegrationContext) {
      failE2E02(
        E2E02_ERROR_CODE.MISSING_INTEGRATION_PORTS,
        "runtime ports missing identity/context boundary",
        {}
      );
    }
    // Fail-closed tenant/competition context check at runtime boundary.
    runtimePorts.requireIntegrationContext({
      subject: { actorId: "e2e02-system", role: "ORGANIZER" },
      scope: {
        tenantId,
        competitionId,
        venueId: "venue-runtime-check",
      },
      requireRole: true,
      requireVenue: true,
      requireClub: false,
    });
  }

  const registration = ensureIndividualPoolKnockoutTemplateRegistered({
    catalog: input.catalog,
  });

  const instantiated = instantiateIndividualPoolKnockoutTemplate({
    tenantId,
    competitionId,
    definition: input.definition,
    catalog: registration.catalog,
    deterministicSeed: input.deterministicSeed,
    formatOverrides: input.formatOverrides,
  });

  // Validate configuration association
  if (instantiated.format.configurationFingerprint == null) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_FORMAT,
      "format configuration fingerprint missing",
      {}
    );
  }

  const composition = composeIndividualPoolKnockout({
    competitionId,
    tenantId,
    participants: input.participants,
    deterministicSeed: input.deterministicSeed,
    format: instantiated.format,
    formatOverrides: input.formatOverrides,
    poolStandingsRows: input.poolStandingsRows,
    poolMatchResults: input.poolMatchResults,
    poolStageComplete: input.poolStageComplete,
    includeKnockout: input.includeKnockout,
    templateVersion: instantiated.templateVersion,
    formatVersion: instantiated.formatVersion,
  });

  return deepFreeze({
    phase: E2E02_COMPOSITION_PHASE,
    runtimeReady: true,
    wiredToProductionRuntime: false,
    templateResolution: {
      templateId: instantiated.templateId,
      templateVersion: instantiated.templateVersion,
      registered: registration.registered,
    },
    instantiation: instantiated.instantiation,
    formatVersion: instantiated.formatVersion,
    formatFingerprint: instantiated.format.configurationFingerprint,
    workflowReference: E2E02_RULE_REFERENCES.workflowId,
    ruleReferences: E2E02_RULE_REFERENCES,
    composition,
    runtimePorts: runtimePorts
      ? {
          version: runtimePorts.version,
          hasIdentityEvidencePort: Boolean(runtimePorts.identityEvidencePort),
          hasMembershipStatusPort: Boolean(runtimePorts.membershipStatusPort),
          hasParticipantLookupPort: Boolean(runtimePorts.participantLookupPort),
          hasVenueAvailabilityBridge: Boolean(runtimePorts.venueAvailabilityBridge),
          inventory: runtimePorts.inventory,
        }
      : null,
    archiveCompatible: true,
    versioningCompatible: true,
  });
}

/**
 * Resolve Individual Pool+KO template from CM catalog (fail-closed).
 *
 * @param {{ tenantId: string, catalog?: object, templateVersion?: number }} input
 */
export function resolveIndividualPoolKnockoutTemplate(input) {
  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) {
    failE2E02(E2E02_ERROR_CODE.MISSING_TENANT, "tenantId is required", {});
  }
  const { catalog, template } = ensureIndividualPoolKnockoutTemplateRegistered({
    catalog: input.catalog,
  });
  return deepFreeze({
    ok: true,
    tenantId,
    template,
    catalog,
  });
}
