import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPETITION_ACTION,
  COMPETITION_PERMISSION,
  createAuthorizationDecision,
  createStaticIdentityEvidencePort,
  evaluateAuthorization,
  projectToMatchAuthorizationDecision,
  projectToTransitionAuthorizationDecision,
} from "../src/features/competition-core/role-permission/index.js";
import { normalizeMatchAuthorizationDecision } from "../src/features/competition-core/matches/services/applyMatchTransition.js";
import { createTransitionAuthorizationDecision } from "../src/features/competition-core/workflow/contracts/workflowDecisions.js";

test("Match projector — allow decision accepted by normalizeMatchAuthorizationDecision", async () => {
  const decision = await evaluateAuthorization(
    {
      action: COMPETITION_ACTION.LINEUP_LOCK,
      subject: { actorId: "dir-1", role: "TOURNAMENT_MANAGER" },
      scope: { competitionId: "comp-1" },
    },
    {
      evidencePort: createStaticIdentityEvidencePort([
        COMPETITION_PERMISSION.TEAM_LINEUP_LOCK,
      ]),
    }
  );
  const projected = projectToMatchAuthorizationDecision(decision);
  const normalized = normalizeMatchAuthorizationDecision(projected, {
    action: "START",
    requireAuthorization: true,
  });
  assert.equal(normalized.allowed, true);
  assert.equal(normalized.actorId, "dir-1");
  assert.equal(normalized.policyId, "CORE02_ROLE_PERMISSION");
});

test("Match projector — deny decision remains denied", () => {
  const projected = projectToMatchAuthorizationDecision(
    createAuthorizationDecision({
      allowed: false,
      denyReason: "PERMISSION_DENIED",
      reason: "no grant",
      actorId: "u1",
      actorRole: "PLAYER",
    })
  );
  assert.equal(projected.allowed, false);
  assert.equal(projected.decisionCode, "PERMISSION_DENIED");
  assert.equal(projected.actorId, "u1");
  assert.throws(
    () =>
      normalizeMatchAuthorizationDecision(projected, {
        action: "COMPLETE",
        requireAuthorization: true,
      }),
    (err) =>
      err &&
      err.code === "MATCH_AUTHORIZATION_DENIED" &&
      err.details?.decisionCode === "PERMISSION_DENIED"
  );
});

test("Workflow projector — compatible with createTransitionAuthorizationDecision", async () => {
  const decision = await evaluateAuthorization(
    {
      action: COMPETITION_ACTION.TEAM_ACTIVATE,
      subject: { actorId: "mgr-1", role: "TOURNAMENT_MANAGER" },
      scope: { competitionId: "comp-1" },
    },
    {
      evidencePort: createStaticIdentityEvidencePort([
        COMPETITION_PERMISSION.TEAM_MANAGE,
      ]),
    }
  );
  const projected = projectToTransitionAuthorizationDecision(decision);
  const frozen = createTransitionAuthorizationDecision(projected);
  assert.equal(frozen.allowed, true);
  assert.equal(frozen.actorId, "mgr-1");
  assert.equal(frozen.actorType, "TOURNAMENT_MANAGER");
  assert.equal(frozen.decisionCode, "ALLOW");
});

test("Workflow projector — deny projects reason", () => {
  const projected = projectToTransitionAuthorizationDecision(
    createAuthorizationDecision({
      allowed: false,
      denyReason: "EVIDENCE_UNAVAILABLE",
      reason: "no evidence",
      actorId: "u9",
      actorRole: "PLAYER",
    })
  );
  const frozen = createTransitionAuthorizationDecision(projected);
  assert.equal(frozen.allowed, false);
  assert.equal(frozen.decisionCode, "EVIDENCE_UNAVAILABLE");
  assert.equal(frozen.reason, "no evidence");
});

test("projectors — malformed decision cannot become allow", () => {
  const matchProjected = projectToMatchAuthorizationDecision(null);
  const workflowProjected = projectToTransitionAuthorizationDecision("bad");
  assert.equal(matchProjected.allowed, false);
  assert.equal(workflowProjected.allowed, false);
  assert.notEqual(matchProjected.decisionCode, "ALLOW");
  assert.notEqual(workflowProjected.decisionCode, "ALLOW");
});

test("projectors — allowed:false with ALLOW-looking code still denies", () => {
  const projected = projectToMatchAuthorizationDecision({
    allowed: false,
    decisionCode: "ALLOW",
    denyReason: "PERMISSION_DENIED",
    reason: "forced deny",
  });
  assert.equal(projected.allowed, false);
  assert.equal(projected.decisionCode, "PERMISSION_DENIED");
});
