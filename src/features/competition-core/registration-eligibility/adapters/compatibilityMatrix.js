/**
 * Phase 1E — Core-03 ↔ sibling Core compatibility matrix (documentation data).
 * Pure data — no sibling imports.
 */

import { ENTRY_CREATION_COMPATIBILITY_GAP } from "./entryCreationAdapter.js";
import { RULE_EVALUATION_ADAPTER_CONTRACT_VERSION } from "./ruleEvaluationAdapter.js";
import { PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION } from "./participantLookupAdapter.js";
import { ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION } from "./entryLookupAdapter.js";
import { ENTRY_CREATION_ADAPTER_CONTRACT_VERSION } from "./entryCreationAdapter.js";
import { DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION } from "./divisionEligibilityAdapter.js";
import { TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION } from "./teamRosterValidationAdapter.js";

/**
 * @typedef {Object} CompatibilityMatrixRow
 * @property {string} core03Port
 * @property {string} siblingCore
 * @property {string} [status]
 * @property {string} publicImportPath
 * @property {string} publicMethod
 * @property {string} requestMapping
 * @property {string} resultMapping
 * @property {string} versionBehavior
 * @property {string} failClosedBehavior
 * @property {string} [blockingDependency]
 * @property {string} [phase1FGuidance]
 * @property {string} [futureActivationConditions]
 * @property {string} knownLimitations
 * @property {string} adapterContractVersion
 * @property {boolean} available
 */

/** @type {ReadonlyArray<CompatibilityMatrixRow>} */
export const CORE03_SIBLING_COMPATIBILITY_MATRIX = Object.freeze([
  Object.freeze({
    core03Port: "RuleEvaluationPort",
    siblingCore: "Core-01 Rule Engine",
    publicImportPath: "features/competition-core → Core-01 public barrel (rule engine)",
    publicMethod: "evaluateCanonicalRules(ruleSet, context, options)",
    requestMapping:
      "Core-03 RuleEvaluationRequest → ruleSet{id,version,constraints} + context{competitionId,operation,subject,divisionId,...}",
    resultMapping:
      "CanonicalRuleEvaluationResult → {accepted, reasonCodes, ruleSetVersion, eligibilityCheckResult}",
    versionBehavior: "Preserves ruleSetId, ruleSetVersion, engineVersion on adapterMetadata",
    failClosedBehavior:
      "Missing facade / exception / malformed output → accepted:false; never ELIGIBLE",
    knownLimitations:
      "Facade injected (no direct Core-03→Core-01 source import). Soft/manual outcomes carried on eligibilityCheckResult.",
    adapterContractVersion: RULE_EVALUATION_ADAPTER_CONTRACT_VERSION,
    available: true,
  }),
  Object.freeze({
    core03Port: "ParticipantLookupPort",
    siblingCore: "Core-02 Participant & Entry",
    publicImportPath: "features/competition-core → Core-02 public barrel (participant)",
    publicMethod: "ParticipantRepositoryPort.getById / createParticipantResolver.resolve",
    requestMapping:
      "getByIds(ids) + lookupParticipants({targetType, participantId|participantIds|representativeParticipantId})",
    resultMapping: "CompetitionParticipant-like rows → defensive {id, status, ...}",
    versionBehavior: "adapterMetadata.resolvedAt from ClockPort; no auth-user fallback",
    failClosedBehavior:
      "Missing participant / duplicate pair identity / facade unavailable → structured fail-closed",
    knownLimitations:
      "Uses injected getById facade. Does not mutate Core-02 records. Pair ids canonical-sorted.",
    adapterContractVersion: PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
    available: true,
  }),
  Object.freeze({
    core03Port: "EntryLookupPort",
    siblingCore: "Core-02 Participant & Entry",
    publicImportPath: "features/competition-core → Core-02 public barrel (entry repository)",
    publicMethod: "EntryRepositoryPort.listByCompetition / findActiveDuplicate",
    requestMapping:
      "competitionId + optional divisionId + target identity / identityKey (never RegistrationStatus)",
    resultMapping:
      "CompetitionEntry rows → {id, competitionId, entryStatus, isActiveOrConflicting, identityKey, ...}",
    versionBehavior: "Preserves entry identity keys; entryStatus is Core-02-only",
    failClosedBehavior: "Missing competition scope fails closed; conflicts flagged explicitly",
    knownLimitations:
      "Does not create/modify Entry. RegistrationStatus is never aliased to Entry status.",
    adapterContractVersion: ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION,
    available: true,
  }),
  Object.freeze({
    core03Port: "EntryCreationPort",
    siblingCore: "Core-02 Participant & Entry",
    status: "DEFERRED_FAIL_CLOSED",
    publicImportPath: "features/competition-core → Core-02 public barrel (entry creation GAP)",
    publicMethod: "NONE — no stable approved createEntryFromRegistration service",
    requestMapping: "N/A (deferred)",
    resultMapping:
      "Fail-closed EntryCreationResult with REG_ELIG_ENTRY_CREATION_ADAPTER_UNAVAILABLE + ENTRY_CREATION_COMPATIBILITY_GAP",
    versionBehavior: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
    failClosedBehavior:
      "Default composition always fail-closed. Experimental DI flag is test-only (default false; never env/request).",
    blockingDependency: "approved Core-02 public handoff API",
    phase1FGuidance:
      "Phase 1F may proceed for Core-03-owned persistence; must NOT implement Core-02 Entry creation or handoff",
    futureActivationConditions: ENTRY_CREATION_COMPATIBILITY_GAP.futureActivationConditions.join("; "),
    knownLimitations: JSON.stringify(ENTRY_CREATION_COMPATIBILITY_GAP),
    adapterContractVersion: ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
    available: false,
  }),
  Object.freeze({
    core03Port: "DivisionEligibilityPort",
    siblingCore: "Core-04 Division / Category",
    publicImportPath: "features/competition-core → Core-04 public barrel (division-category)",
    publicMethod: "gateDivisionCategoryRegistration (via evaluateDivisionEligibility facade)",
    requestMapping:
      "{competitionId, divisionId?, divisionCategoryId?} — no default/first-division fallback",
    resultMapping:
      "ClassificationResult → {acceptsRegistration, reasonCodes, eligibilityDescriptor, capacity}",
    versionBehavior: "Preserves schemaVersion on adapterMetadata.siblingResultVersion",
    failClosedBehavior:
      "Missing mandatory division / facade / exception / malformed → acceptsRegistration:false",
    knownLimitations:
      "Facade wraps Core-04 gate; Core-03 does not own lane descriptors or capacity counters.",
    adapterContractVersion: DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION,
    available: true,
  }),
  Object.freeze({
    core03Port: "TeamRosterValidationPort",
    siblingCore: "Core-05 Team & Roster",
    publicImportPath: "features/competition-core → Core-05 public barrel (team-roster)",
    publicMethod: "validateRosterInvariants / createTeamRosterService().validateRoster",
    requestMapping:
      "{competitionId, teamId, divisionId?, rosterVersion?, targetType?} — TEAM only",
    resultMapping:
      "DomainIssue[] / service envelope → {valid, reasonCodes, memberCount, violations}",
    versionBehavior: "Stale rosterVersion → STALE_SIBLING_RESULT fail-closed",
    failClosedBehavior:
      "Missing team / missing roster / stale version / malformed / exception → valid:false",
    knownLimitations:
      "INDIVIDUAL/PAIR return TEAM_ROSTER_NOT_APPLICABLE (passed). Does not invent roster members.",
    adapterContractVersion: TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
    available: true,
  }),
]);

/**
 * @returns {CompatibilityMatrixRow[]}
 */
export function getCore03SiblingCompatibilityMatrix() {
  return CORE03_SIBLING_COMPATIBILITY_MATRIX.map((row) => ({ ...row }));
}
