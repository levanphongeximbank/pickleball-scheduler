/**
 * Phase 3D — Team / Roster Resolution Runtime (capability-local public surface).
 * Integrator owns root competition-core/index.js re-exports — do not edit that here.
 */

export {
  createTeamResolver,
  TeamResolver,
} from "./TeamResolver.js";

export {
  createRosterResolver,
  RosterResolver,
} from "./RosterResolver.js";

export {
  createLegacyTeamAdapter,
  LegacyTeamAdapter,
  createLegacyRosterAdapter,
  LegacyRosterAdapter,
  mapTtV6TeamToCompetitionTeam,
  mapTtV6TeamToCompetitionRoster,
  mapTtV6TeamBundle,
} from "./adapters/index.js";

export {
  createTeamResolveRequest,
  createRosterResolveRequest,
  createTeamResolveResult,
  createRosterResolveResult,
  teamResolveOk,
  teamResolveFail,
  rosterResolveOk,
  rosterResolveFail,
  TEAM_ADAPTER_ID,
  ROSTER_ADAPTER_ID,
  isTeamAdapter,
  isRosterAdapter,
  TEAM_IDENTITY_KIND,
  buildTeamIdentityKey,
  createTeamIdentity,
  identityFromCompetitionTeam,
  ROSTER_IDENTITY_KIND,
  buildRosterIdentityKey,
  createRosterIdentity,
  identityFromCompetitionRoster,
  ROSTER_MEMBER_IDENTITY_KIND,
  formatParticipantReferenceToken,
  buildRosterMemberIdentityKey,
  createRosterMemberIdentity,
  createTeamRosterSnapshot,
  buildRosterSnapshotContentHash,
} from "./contracts/index.js";
export {
  TEAM_RUNTIME_ERROR_CODE,
  TEAM_RUNTIME_ERROR_CODE_VALUES,
  isTeamRuntimeErrorCode,
  TeamRuntimeError,
  isTeamRuntimeError,
  createTeamRuntimeError,
} from "./errors/index.js";

export {
  TEAM_SOURCE_TYPE,
  TEAM_SOURCE_TYPE_VALUES,
  isTeamSourceType,
} from "./enums/index.js";

export {
  mapLegacyTeamStatus,
  mapLegacyRosterStatus,
  mapLegacyRosterMemberStatus,
  LEGACY_TEAM_STATUS_MAP,
  LEGACY_ROSTER_STATUS_MAP,
  buildMemberRefsFromContext,
  resolveMemberRefsWithDependency,
  isLegacyTeamSource,
  mapLegacyTeamToCompetitionTeam,
  isLegacyRosterSource,
  mapLegacyRosterToCompetitionRoster,
} from "./mappers/index.js";

export {
  TEAM_PERSISTENCE_PORT_METHODS,
  ROSTER_PERSISTENCE_PORT_METHODS,
  matchesTeamPersistencePort,
  matchesRosterPersistencePort,
  createInMemoryTeamPersistencePort,
  createInMemoryRosterPersistencePort,
  createNoopTeamPersistencePort,
  createNoopRosterPersistencePort,
  TEAM_ROSTER_AUTH_ACTION,
  matchesAuthorizationAdapter,
  createDenyAuthorizationAdapter,
  createAllowlistAuthorizationAdapter,
  matchesRuleAdapter,
  createDefaultDenyCrossTeamRuleAdapter,
  createRuleAdapter,
  matchesEligibilityAdapter,
  createFailClosedEligibilityAdapter,
  createEligibilityAdapter,
  matchesAuditAdapter,
  createNoopAuditAdapter,
  createAuditAdapter,
  matchesClassificationAdapter,
  createOptionalClassificationAdapter,
  createClassificationAdapter,
} from "./ports/index.js";

export {
  createTeamIdentityLookup,
  requireTeamIdentity,
  createRosterIdentityLookup,
  requireRosterIdentity,
  normalizeAndValidateTeam,
  normalizeAndValidateRoster,
  createTeamRosterService,
  sortDomainIssues,
  domainIssue,
  personTokenOf,
  listActiveMembers,
  validateIsolationContext,
  validateUniqueActiveMembers,
  validateRosterSize,
  validateCaptainOnRoster,
  validateRosterNotLocked,
  validateRosterInvariants,
} from "./services/index.js";

export { createInMemoryTeamRosterRepository } from "./repositories/inMemoryTeamRosterRepository.js";
