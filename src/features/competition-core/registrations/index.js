/**
 * Phase 3C — Registration Resolution Runtime (capability-local public surface).
 * Integrator owns root competition-core/index.js re-exports — do not edit that here.
 */

export {
  createRegistrationResolver,
  RegistrationResolver,
} from "./RegistrationResolver.js";

export {
  createLegacyRegistrationAdapter,
  LegacyRegistrationAdapter,
} from "./adapters/index.js";

export {
  createRegistrationResolveRequest,
  createRegistrationResolveResult,
  resolveOk,
  resolveFail,
  REGISTRATION_ADAPTER_ID,
  isRegistrationAdapter,
  buildRegistrationIdentityKey,
  createRegistrationIdentity,
  identityFromCompetitionRegistration,
} from "./contracts/index.js";

export {
  REGISTRATION_RUNTIME_ERROR_CODE,
  REGISTRATION_RUNTIME_ERROR_CODE_VALUES,
  isRegistrationRuntimeErrorCode,
  RegistrationRuntimeError,
  isRegistrationRuntimeError,
  createRegistrationRuntimeError,
} from "./errors/index.js";

export {
  REGISTRATION_KIND,
  REGISTRATION_KIND_VALUES,
  isRegistrationKind,
  REGISTRATION_SOURCE_TYPE,
  REGISTRATION_SOURCE_TYPE_VALUES,
  isRegistrationSourceType,
} from "./enums/index.js";

export {
  mapLegacyRegistrationStatus,
  LEGACY_REGISTRATION_STATUS_MAP,
  buildMemberRefsFromContext,
  resolveMemberRefsWithDependency,
  isLegacyIndividualEntrySource,
  mapLegacyIndividualEntryToRegistration,
  isLegacyTeamRegistrationSource,
  mapLegacyTeamRegistrationToRegistration,
} from "./mappers/index.js";

export {
  REGISTRATION_PERSISTENCE_PORT_METHODS,
  matchesRegistrationPersistencePort,
  createInMemoryRegistrationPersistencePort,
  createNoopRegistrationPersistencePort,
} from "./ports/index.js";

export {
  createRegistrationIdentityLookup,
  requireRegistrationIdentity,
  normalizeAndValidateRegistration,
  assertGuestPreserved,
} from "./services/index.js";
