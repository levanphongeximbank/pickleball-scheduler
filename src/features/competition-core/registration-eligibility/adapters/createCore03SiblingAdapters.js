/**
 * Phase 1E — createCore03SiblingAdapters composition factory.
 *
 * Returns intentional Core-03 port implementations only.
 * Sibling facades are dependency-injected (no direct sibling source imports).
 */

import { REGISTRATION_ELIGIBILITY_ERROR_CODE } from "../errors/errorCodes.js";
import { SIBLING_ADAPTERS_VERSION } from "../contracts/shared.js";
import { createCore01RuleEvaluationAdapter } from "./ruleEvaluationAdapter.js";
import { createCore02ParticipantLookupAdapter } from "./participantLookupAdapter.js";
import { createCore02EntryLookupAdapter } from "./entryLookupAdapter.js";
import { createCore02EntryCreationAdapter } from "./entryCreationAdapter.js";
import { createCore04DivisionEligibilityAdapter } from "./divisionEligibilityAdapter.js";
import { createCore05TeamRosterValidationAdapter } from "./teamRosterValidationAdapter.js";
import { getCore03SiblingCompatibilityMatrix } from "./compatibilityMatrix.js";
import {
  CORE03_SIBLING_ADAPTER_VERSION,
  createSiblingAdapterMetadata,
} from "./adapterMetadata.js";

/**
 * @typedef {Object} Core03SiblingAdapterDependencies
 * @property {{ now: () => string }|null} [clock]
 * @property {{ evaluateCanonicalRules: Function }|null} [core01RuleEngine]
 * @property {{ getById: Function }|null} [core02ParticipantLookup]
 * @property {{ listByCompetition: Function, findActiveDuplicate?: Function, getById?: Function }|null} [core02EntryLookup]
 * @property {{ createEntryFromRegistration: Function }|null} [core02EntryCreation]
 * @property {boolean} [allowUnapprovedEntryCreationFacade] Test-only DI override (default false). Never env/request.
 * @property {{ evaluateDivisionEligibility: Function }|null} [core04DivisionEligibility]
 * @property {{ validateTeamRoster: Function }|null} [core05TeamRoster]
 * @property {boolean} [requireMandatoryFacades]
 */

/**
 * @param {Core03SiblingAdapterDependencies} [dependencies]
 */
export function createCore03SiblingAdapters(dependencies = {}) {
  const requireMandatoryFacades = dependencies.requireMandatoryFacades === true;
  const clock = dependencies.clock ?? null;

  const missing = [];
  if (requireMandatoryFacades) {
    if (!dependencies.core01RuleEngine?.evaluateCanonicalRules) {
      missing.push("core01RuleEngine.evaluateCanonicalRules");
    }
    if (!dependencies.core02ParticipantLookup?.getById) {
      missing.push("core02ParticipantLookup.getById");
    }
    if (!dependencies.core02EntryLookup?.listByCompetition) {
      missing.push("core02EntryLookup.listByCompetition");
    }
    if (!dependencies.core04DivisionEligibility?.evaluateDivisionEligibility) {
      missing.push("core04DivisionEligibility.evaluateDivisionEligibility");
    }
    if (!dependencies.core05TeamRoster?.validateTeamRoster) {
      missing.push("core05TeamRoster.validateTeamRoster");
    }
  }

  if (missing.length > 0) {
    const error = {
      ok: false,
      errorCode: REGISTRATION_ELIGIBILITY_ERROR_CODE.SIBLING_API_UNAVAILABLE,
      message: "Missing mandatory sibling facade(s) for Core-03 adapter composition",
      missing: [...missing].sort(),
      adapters: null,
      compatibilityMatrix: getCore03SiblingCompatibilityMatrix(),
      compositionMetadata: createSiblingAdapterMetadata({
        adapterName: "core03-sibling-adapters-composition",
        siblingCapability: "core-03-composition",
        siblingContractVersion: SIBLING_ADAPTERS_VERSION,
        warnings: missing.map((m) => `MISSING:${m}`),
      }),
    };
    return error;
  }

  const ruleEvaluation = createCore01RuleEvaluationAdapter({
    core01RuleEngine: dependencies.core01RuleEngine ?? null,
    clock,
  });
  const participantLookup = createCore02ParticipantLookupAdapter({
    core02ParticipantLookup: dependencies.core02ParticipantLookup ?? null,
    clock,
  });
  const entryLookup = createCore02EntryLookupAdapter({
    core02EntryLookup: dependencies.core02EntryLookup ?? null,
    clock,
  });
  // Entry creation remains DEFERRED_FAIL_CLOSED by default.
  // allowUnapprovedEntryCreationFacade is test-only; absent/false keeps Production fail-closed.
  const entryCreation = createCore02EntryCreationAdapter({
    core02EntryCreation: dependencies.core02EntryCreation ?? null,
    clock,
    allowUnapprovedFacade: dependencies.allowUnapprovedEntryCreationFacade === true,
  });
  const divisionEligibility = createCore04DivisionEligibilityAdapter({
    core04DivisionEligibility: dependencies.core04DivisionEligibility ?? null,
    clock,
  });
  const teamRosterValidation = createCore05TeamRosterValidationAdapter({
    core05TeamRoster: dependencies.core05TeamRoster ?? null,
    clock,
  });

  return Object.freeze({
    ok: true,
    errorCode: null,
    message: null,
    missing: [],
    ruleEvaluation,
    participantLookup,
    entryLookup,
    entryCreation,
    divisionEligibility,
    teamRosterValidation,
    compatibilityMatrix: getCore03SiblingCompatibilityMatrix(),
    compositionMetadata: createSiblingAdapterMetadata({
      adapterName: "core03-sibling-adapters-composition",
      siblingCapability: "core-03-composition",
      siblingContractVersion: CORE03_SIBLING_ADAPTER_VERSION,
      warnings: entryCreation.getCompatibilityGap
        ? ["ENTRY_CREATION_PUBLIC_API_UNAVAILABLE"]
        : [],
    }),
    versions: Object.freeze({
      siblingAdaptersVersion: SIBLING_ADAPTERS_VERSION,
      entryCreationAvailable: false,
    }),
  });
}
