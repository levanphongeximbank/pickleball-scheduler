import assert from "node:assert/strict";
import test from "node:test";

import {
  CORE02_ROLE_PERMISSION_VERSION,
  CORE02_POLICY_ID,
  COMPETITION_ROLE,
  COMPETITION_PERMISSION,
  COMPETITION_ACTION,
  AUTHORIZATION_DENY_REASON,
  AUTHORIZATION_DECISION_CODE,
  AUTHORIZATION_ERROR_CODE,
  createAuthorizationSubject,
  createAuthorizationScope,
  createAuthorizationRequest,
  createAuthorizationEvidence,
  createAuthorizationExplanation,
  createAuthorizationDecision,
  mapActionToPermissions,
  evaluateAuthorization,
  createStaticIdentityEvidencePort,
  createTeamAuthorizationPortAdapter,
  createLineupAuthorizationPortAdapter,
  projectToMatchAuthorizationDecision,
  projectToTransitionAuthorizationDecision,
} from "../src/features/competition-core/role-permission/index.js";

test("CORE-02 Phase 1B — version and policy constants freeze", () => {
  assert.equal(CORE02_ROLE_PERMISSION_VERSION, "core02-role-permission-1.0.0");
  assert.equal(CORE02_POLICY_ID, "CORE02_ROLE_PERMISSION");
});

test("CORE-02 Phase 1B — enums expose Team and Lineup actions", () => {
  assert.equal(COMPETITION_ACTION.TEAM_WITHDRAW, "TEAM_WITHDRAW");
  assert.equal(COMPETITION_ACTION.LINEUP_SUBMIT, "LINEUP_SUBMIT");
  assert.equal(COMPETITION_PERMISSION.TEAM_MANAGE, "team.manage");
  assert.equal(COMPETITION_ROLE.TEAM_CAPTAIN, "TEAM_CAPTAIN");
  assert.ok(AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE);
  assert.equal(AUTHORIZATION_DECISION_CODE.ALLOW, "ALLOW");
  assert.ok(AUTHORIZATION_ERROR_CODE.INVALID_CONTRACT);
});

test("CORE-02 Phase 1B — contract factories freeze shapes", () => {
  const subject = createAuthorizationSubject({
    actorId: "u1",
    role: "TEAM_CAPTAIN",
  });
  const scope = createAuthorizationScope({ competitionId: "c1", tenantId: "t1" });
  const request = createAuthorizationRequest({
    action: COMPETITION_ACTION.LINEUP_SUBMIT,
    subject,
    scope,
  });
  const evidence = createAuthorizationEvidence({
    grantedPermissions: [COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT],
  });
  const explanation = createAuthorizationExplanation({
    summary: "ok",
    requiredPermissions: [COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT],
    matchedPermissions: [COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT],
    grantedPermissions: [COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT],
  });
  const decision = createAuthorizationDecision({
    allowed: true,
    actorId: "u1",
    actorRole: "TEAM_CAPTAIN",
    action: COMPETITION_ACTION.LINEUP_SUBMIT,
    explanation,
  });

  assert.equal(subject.role, "TEAM_CAPTAIN");
  assert.equal(scope.competitionId, "c1");
  assert.equal(request.action, COMPETITION_ACTION.LINEUP_SUBMIT);
  assert.deepEqual(evidence.grantedPermissions, ["team.lineup.submit"]);
  assert.equal(decision.allowed, true);
  assert.equal(decision.policyId, CORE02_POLICY_ID);
  assert.throws(() => {
    decision.allowed = false;
  });
});

test("CORE-02 Phase 1B — public barrel exports evaluator and adapters", () => {
  assert.equal(typeof evaluateAuthorization, "function");
  assert.equal(typeof mapActionToPermissions, "function");
  assert.equal(typeof createStaticIdentityEvidencePort, "function");
  assert.equal(typeof createTeamAuthorizationPortAdapter, "function");
  assert.equal(typeof createLineupAuthorizationPortAdapter, "function");
  assert.equal(typeof projectToMatchAuthorizationDecision, "function");
  assert.equal(typeof projectToTransitionAuthorizationDecision, "function");
});
