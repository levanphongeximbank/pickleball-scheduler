/**
 * Apply CM-02 instantiation proposal fragments owned by CM-04.
 * Does not mutate proposal or CM-01 definition. Does not create CM-03 version.
 */

import {
  COMPETITION_TEMPLATE_OWNERSHIP_TARGET,
  COMPETITION_TEMPLATE_COMPATIBILITY_STATUS,
  COMPETITION_TEMPLATE_INSTANTIATION_STATUS,
} from "../../template-instantiation/index.js";
import { COMPETITION_CONFIGURATION_SECTION } from "../constants/sectionTypes.js";
import { COMPETITION_CONFIGURATION_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createFieldError,
  validationOk,
  validationFail,
} from "../contracts/validation.js";
import {
  deepFreeze,
  clonePlain,
  isNonEmptyString,
  canonicalizeJson,
} from "../contracts/shared.js";
import { parseConfigurationSections } from "../contracts/sections.js";

/**
 * Known CM-04-owned proposal paths from CM-02 catalog.
 */
export const CM04_TEMPLATE_PROPOSAL_PATHS = Object.freeze({
  FORMAT_BLUEPRINT: "configuration.formatBlueprintId",
  REGISTRATION_DEFAULTS: "configuration.registrationDefaults",
});

/**
 * Map a CM-04-owned patch into a section fragment.
 * @param {{ path: string, value: *, ownershipTarget: string }} patch
 * @returns {{ sectionId: string, section: object } | { error: object } | { deferred: object }}
 */
export function mapCm04OwnedPatchToSection(patch) {
  if (patch.path === CM04_TEMPLATE_PROPOSAL_PATHS.FORMAT_BLUEPRINT) {
    if (!isNonEmptyString(patch.value)) {
      return {
        error: createFieldError(
          patch.path,
          COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
          "formatBlueprintId proposal value must be a non-empty string",
          {}
        ),
      };
    }
    return {
      sectionId: COMPETITION_CONFIGURATION_SECTION.FORMAT,
      section: {
        sectionId: COMPETITION_CONFIGURATION_SECTION.FORMAT,
        formatBlueprintId: String(patch.value).trim(),
      },
    };
  }

  if (patch.path === CM04_TEMPLATE_PROPOSAL_PATHS.REGISTRATION_DEFAULTS) {
    if (!patch.value || typeof patch.value !== "object" || Array.isArray(patch.value)) {
      return {
        error: createFieldError(
          patch.path,
          COMPETITION_CONFIGURATION_ERROR_CODE.INVALID_SECTION,
          "registrationDefaults proposal value must be a plain object",
          {}
        ),
      };
    }
    return {
      sectionId: COMPETITION_CONFIGURATION_SECTION.REGISTRATION_POLICY,
      section: {
        sectionId: COMPETITION_CONFIGURATION_SECTION.REGISTRATION_POLICY,
        registrationDefaults: clonePlain(patch.value),
      },
    };
  }

  return {
    error: createFieldError(
      patch.path,
      COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_OWNERSHIP_MISMATCH,
      "CM-04-tagged proposal path is not a known configuration mapping",
      { path: patch.path }
    ),
  };
}

/**
 * Extract and validate CM-04-owned fragments from a CM-02 instantiation result.
 *
 * @param {object} instantiationResult
 * @param {{
 *   tenantId: string,
 *   competitionId: string,
 *   expectedSourceDefinitionRevision: number,
 * }} scope
 * @returns {import("../contracts/validation.js").CompetitionConfigurationValidationResult}
 */
export function extractCm04ProposalFragments(instantiationResult, scope) {
  /** @type {object[]} */
  const errors = [];
  const result =
    instantiationResult && typeof instantiationResult === "object"
      ? instantiationResult
      : {};

  if (result.ok !== true) {
    errors.push(
      createFieldError(
        "instantiationResult",
        COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_INCOMPATIBLE,
        "instantiation result must be ok=true",
        {}
      )
    );
  }

  if (result.status !== COMPETITION_TEMPLATE_INSTANTIATION_STATUS.SUCCESS) {
    errors.push(
      createFieldError(
        "instantiationResult.status",
        COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_INCOMPATIBLE,
        "instantiation status must be SUCCESS",
        { status: result.status }
      )
    );
  }

  const plan = result.plan;
  if (!plan || typeof plan !== "object") {
    errors.push(
      createFieldError(
        "instantiationResult.plan",
        COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_INCOMPATIBLE,
        "explicit instantiation plan is required",
        {}
      )
    );
    return validationFail(errors);
  }

  if (!isNonEmptyString(plan.tenantId) || plan.tenantId !== scope.tenantId) {
    errors.push(
      createFieldError(
        "instantiationResult.plan.tenantId",
        COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_TENANT_MISMATCH,
        "proposal tenantId must match explicit tenantId",
        { expected: scope.tenantId, actual: plan.tenantId }
      )
    );
  }

  if (
    !isNonEmptyString(plan.competitionId) ||
    plan.competitionId !== scope.competitionId
  ) {
    errors.push(
      createFieldError(
        "instantiationResult.plan.competitionId",
        COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_COMPETITION_MISMATCH,
        "proposal competitionId must match explicit competitionId",
        { expected: scope.competitionId, actual: plan.competitionId }
      )
    );
  }

  if (plan.sourceDefinitionRevision !== scope.expectedSourceDefinitionRevision) {
    errors.push(
      createFieldError(
        "instantiationResult.plan.sourceDefinitionRevision",
        COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_STALE,
        "proposal sourceDefinitionRevision does not match expected definition revision",
        {
          expected: scope.expectedSourceDefinitionRevision,
          actual: plan.sourceDefinitionRevision,
        }
      )
    );
  }

  const proof = plan.compatibilityProof;
  if (
    !proof ||
    proof.status !== COMPETITION_TEMPLATE_COMPATIBILITY_STATUS.PASS
  ) {
    errors.push(
      createFieldError(
        "instantiationResult.plan.compatibilityProof",
        COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_INCOMPATIBLE,
        "compatibility proof must be PASS",
        { status: proof?.status }
      )
    );
  }

  const patches = Array.isArray(plan.patches) ? plan.patches : [];
  const proposedFragments = Array.isArray(result.proposedFragments)
    ? result.proposedFragments
    : patches;

  /** @type {object[]} */
  const cm04Patches = [];
  /** @type {object[]} */
  const nonCm04Owned = [];
  /** @type {object[]} */
  const definitionPatchProposals = [];
  /** @type {object[]} */
  const coreOwnedProposals = [];

  for (const patch of proposedFragments) {
    if (!patch || typeof patch !== "object") {
      errors.push(
        createFieldError(
          "proposedFragments",
          COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_OWNERSHIP_MISMATCH,
          "proposal fragment must be an object",
          {}
        )
      );
      continue;
    }

    const ownershipTarget = patch.ownershipTarget;
    if (ownershipTarget === COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CM04_CONFIGURATION) {
      cm04Patches.push(patch);
    } else if (
      ownershipTarget === COMPETITION_TEMPLATE_OWNERSHIP_TARGET.CM01_DEFINITION
    ) {
      definitionPatchProposals.push(clonePlain(patch));
    } else if (
      typeof ownershipTarget === "string" &&
      ownershipTarget.startsWith("core_")
    ) {
      coreOwnedProposals.push(clonePlain(patch));
    } else if (
      ownershipTarget === COMPETITION_TEMPLATE_OWNERSHIP_TARGET.DEFERRED
    ) {
      nonCm04Owned.push(clonePlain(patch));
    } else {
      // Unknown ownership target — fail closed (do not silently discard)
      errors.push(
        createFieldError(
          `proposedFragments.${patch.path || "unknown"}`,
          COMPETITION_CONFIGURATION_ERROR_CODE.TEMPLATE_PROPOSAL_OWNERSHIP_MISMATCH,
          "unknown proposal ownership target",
          { ownershipTarget, path: patch.path }
        )
      );
    }
  }

  if (errors.length > 0) {
    return validationFail(errors);
  }

  /** @type {Record<string, object>} */
  const sectionUpdates = {};
  /** @type {object[]} */
  const applied = [];
  /** @type {object[]} */
  const mappingErrors = [];

  for (const patch of cm04Patches) {
    const mapped = mapCm04OwnedPatchToSection(patch);
    if (mapped.error) {
      mappingErrors.push(mapped.error);
      continue;
    }
    sectionUpdates[mapped.sectionId] = mapped.section;
    applied.push({
      path: patch.path,
      sectionId: mapped.sectionId,
      ownershipTarget: patch.ownershipTarget,
    });
  }

  if (mappingErrors.length > 0) {
    return validationFail(mappingErrors);
  }

  const sectionsParsed = parseConfigurationSections(sectionUpdates);
  if (sectionsParsed.errors.length > 0) {
    return validationFail(sectionsParsed.errors);
  }

  return validationOk(
    deepFreeze({
      sectionUpdates: sectionsParsed.value,
      appliedSections: applied.sort((a, b) =>
        String(a.path).localeCompare(String(b.path), "en")
      ),
      skippedUnsupportedSections: nonCm04Owned,
      definitionPatchProposals: definitionPatchProposals.sort((a, b) =>
        String(a.path).localeCompare(String(b.path), "en")
      ),
      coreOwnedProposals: coreOwnedProposals.sort((a, b) =>
        String(a.path).localeCompare(String(b.path), "en")
      ),
      templateIdentity: plan.selectedTemplate
        ? clonePlain(plan.selectedTemplate)
        : null,
      proposalFingerprint: canonicalizeJson({
        planId: plan.planId,
        applied,
      }),
    }),
    {
      summary: "CM-04 template proposal fragments extracted.",
      reasons: Object.freeze([
        `appliedCount=${applied.length}`,
        `definitionProposals=${definitionPatchProposals.length}`,
        `coreProposals=${coreOwnedProposals.length}`,
        "cm01NotMutated",
        "coreNotExecuted",
      ]),
    }
  );
}
