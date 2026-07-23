import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORIZATION_DENY_REASON,
  COMPETITION_ACTION,
  COMPETITION_PERMISSION,
  createAuthorizationEvidence,
  createAuthorizationRequest,
  createStaticIdentityEvidencePort,
  createUnavailableIdentityEvidencePort,
  evaluateAuthorization,
} from "../src/features/competition-core/role-permission/index.js";

function baseRequest(overrides = {}) {
  return {
    action: COMPETITION_ACTION.TEAM_WITHDRAW,
    subject: { actorId: "u1", role: "TEAM_CAPTAIN" },
    scope: { competitionId: "comp-1", tenantId: "tenant-1" },
    ...overrides,
  };
}

test("fail-closed — missing request body", async () => {
  const decision = await evaluateAuthorization(null);
  assert.equal(decision.allowed, false);
  assert.equal(decision.denyReason, AUTHORIZATION_DENY_REASON.INVALID_REQUEST);
});

test("fail-closed — missing subject", async () => {
  const decision = await evaluateAuthorization({
    action: COMPETITION_ACTION.TEAM_WITHDRAW,
    scope: { competitionId: "comp-1" },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.denyReason, AUTHORIZATION_DENY_REASON.MISSING_SUBJECT);
});

test("fail-closed — missing scope", async () => {
  const decision = await evaluateAuthorization({
    action: COMPETITION_ACTION.TEAM_WITHDRAW,
    subject: { actorId: "u1", role: "TEAM_CAPTAIN" },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.denyReason, AUTHORIZATION_DENY_REASON.MISSING_SCOPE);
});

test("fail-closed — missing competitionId", async () => {
  const decision = await evaluateAuthorization({
    action: COMPETITION_ACTION.TEAM_WITHDRAW,
    subject: { actorId: "u1", role: "TEAM_CAPTAIN" },
    scope: { tenantId: "t1" },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.denyReason, AUTHORIZATION_DENY_REASON.MISSING_SCOPE);
});

test("fail-closed — missing action", async () => {
  const decision = await evaluateAuthorization({
    subject: { actorId: "u1", role: "TEAM_CAPTAIN" },
    scope: { competitionId: "comp-1" },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.denyReason, AUTHORIZATION_DENY_REASON.MISSING_ACTION);
});

test("fail-closed — unknown action", async () => {
  const decision = await evaluateAuthorization(
    baseRequest({ action: "NOT_A_REAL_ACTION" }),
    {
      evidencePort: createStaticIdentityEvidencePort([
        COMPETITION_PERMISSION.TEAM_MANAGE,
      ]),
    }
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.denyReason, AUTHORIZATION_DENY_REASON.UNKNOWN_ACTION);
});

test("fail-closed — missing evidence port", async () => {
  const decision = await evaluateAuthorization(baseRequest());
  assert.equal(decision.allowed, false);
  assert.equal(
    decision.denyReason,
    AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE
  );
});

test("fail-closed — unavailable evidence port", async () => {
  const decision = await evaluateAuthorization(baseRequest(), {
    evidencePort: createUnavailableIdentityEvidencePort(),
  });
  assert.equal(decision.allowed, false);
  assert.equal(
    decision.denyReason,
    AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE
  );
});

test("fail-closed — evidence adapter exception", async () => {
  const decision = await evaluateAuthorization(baseRequest(), {
    evidencePort: {
      async getEvidence() {
        throw new Error("identity projection exploded");
      },
    },
  });
  assert.equal(decision.allowed, false);
  assert.equal(
    decision.denyReason,
    AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE
  );
});

test("fail-closed — malformed subject (non-object)", async () => {
  const decision = await evaluateAuthorization({
    action: COMPETITION_ACTION.TEAM_WITHDRAW,
    subject: "captain-1",
    scope: { competitionId: "comp-1" },
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.denyReason, AUTHORIZATION_DENY_REASON.MISSING_SUBJECT);
});

test("fail-closed — malformed evidence", async () => {
  const decision = await evaluateAuthorization(baseRequest(), {
    evidence: { notPermissions: true },
  });
  assert.equal(decision.allowed, false);
  assert.equal(
    decision.denyReason,
    AUTHORIZATION_DENY_REASON.EVIDENCE_MALFORMED
  );
});

test("fail-closed — indeterminate evidence (non-array grants)", async () => {
  const decision = await evaluateAuthorization(baseRequest(), {
    evidence: {
      source: "BAD",
      grantedPermissions: "team.withdraw",
    },
  });
  assert.equal(decision.allowed, false);
  assert.equal(
    decision.denyReason,
    AUTHORIZATION_DENY_REASON.EVIDENCE_MALFORMED
  );
});

test("fail-closed — independent of platform RBAC flag (no evidence ⇒ deny)", async () => {
  const previous = process.env.VITE_RBAC_ENABLED;
  process.env.VITE_RBAC_ENABLED = "false";
  try {
    const decision = await evaluateAuthorization(baseRequest());
    assert.equal(decision.allowed, false);
    assert.equal(
      decision.denyReason,
      AUTHORIZATION_DENY_REASON.EVIDENCE_UNAVAILABLE
    );
  } finally {
    if (previous === undefined) delete process.env.VITE_RBAC_ENABLED;
    else process.env.VITE_RBAC_ENABLED = previous;
  }
});

test("fail-closed — scope mismatch", async () => {
  const decision = await evaluateAuthorization(baseRequest(), {
    evidence: createAuthorizationEvidence({
      grantedPermissions: [COMPETITION_PERMISSION.TEAM_WITHDRAW],
      tenantId: "other-tenant",
      competitionId: "comp-1",
    }),
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.denyReason, AUTHORIZATION_DENY_REASON.SCOPE_MISMATCH);
});

test("fail-closed — permission denied when grants miss required", async () => {
  const decision = await evaluateAuthorization(baseRequest(), {
    evidencePort: createStaticIdentityEvidencePort([
      COMPETITION_PERMISSION.TEAM_VIEW,
    ]),
  });
  assert.equal(decision.allowed, false);
  assert.equal(
    decision.denyReason,
    AUTHORIZATION_DENY_REASON.PERMISSION_DENIED
  );
});

test("allow — granted permission intersection", async () => {
  const decision = await evaluateAuthorization(
    createAuthorizationRequest(baseRequest()),
    {
      evidencePort: createStaticIdentityEvidencePort([
        COMPETITION_PERMISSION.TEAM_WITHDRAW,
        COMPETITION_PERMISSION.TEAM_VIEW,
      ]),
    }
  );
  assert.equal(decision.allowed, true);
  assert.equal(decision.decisionCode, "ALLOW");
  assert.deepEqual(decision.explanation.matchedPermissions, [
    COMPETITION_PERMISSION.TEAM_WITHDRAW,
  ]);
});
