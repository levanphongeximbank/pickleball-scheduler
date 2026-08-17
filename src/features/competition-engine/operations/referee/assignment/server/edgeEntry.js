/**
 * Trusted server bundle entry — Competition CORE-13 assignment Edge Function.
 * Same canonical CORE-13 runtime as the application; no second engine.
 */
export { createRpcCanonicalAssignmentPersistence } from "../persistence/createRpcCanonicalAssignmentPersistence.js";
export { createCompetitionRefereeAssignmentCommandService } from "../createCompetitionRefereeAssignmentCommandService.js";
export {
  handleCompetitionRefereeAssignmentHttpRequest,
  handleCompetitionRefereeAssignmentAction,
  createTrustedCompetitionAssignmentRuntime,
  verifyBearerToken,
  stripBrowserAuthority,
} from "./edgeHttpHandler.js";
export { assertTrustedAssignmentAuthz } from "./assertTrustedAssignmentAuthz.js";
export { loadAuthoritativeAssignmentEvidence } from "./loadAuthoritativeAssignmentEvidence.js";
