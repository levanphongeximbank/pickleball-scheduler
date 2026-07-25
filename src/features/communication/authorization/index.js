/**
 * COMMS-ACT-03 — Authorization & Client RLS foundation (Communication-owned).
 */

export {
  COMMUNICATION_AUTH_CAPABILITY,
  COMMUNICATION_AUTH_ACTOR,
  getCommsAct03CapabilityMatrix,
} from "./capabilityMatrix.js";

export {
  COMMUNICATION_AUTH_POLICY_CELL,
  getCommsAct03PolicyMatrix,
  evaluateCommsAct03PolicyCell,
} from "./policyMatrix.js";

export {
  COMMUNICATION_AUTHORIZATION_DECISION,
  createCommunicationAuthorizationDecision,
  assertCommunicationAuthorizationAllowed,
  resolveClientRlsSelectCapability,
  getCommsAct03MembershipDependencyMap,
} from "./authorizationDecision.js";
