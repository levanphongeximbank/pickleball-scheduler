export {
  buildRegistrationIdentityKey,
  createRegistrationIdentity,
  identityFromCompetitionRegistration,
} from "./registrationIdentity.js";

export { createRegistrationResolveRequest } from "./resolveRequest.js";

export {
  createRegistrationResolveResult,
  resolveOk,
  resolveFail,
} from "./resolveResult.js";

export {
  REGISTRATION_ADAPTER_ID,
  isRegistrationAdapter,
} from "./registrationAdapter.js";
