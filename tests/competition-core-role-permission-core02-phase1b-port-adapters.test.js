import assert from "node:assert/strict";
import test from "node:test";

import {
  COMPETITION_PERMISSION,
  createIdentityProjectionEvidencePort,
  createLineupAuthorizationPortAdapter,
  createStaticIdentityEvidencePort,
  createTeamAuthorizationPortAdapter,
} from "../src/features/competition-core/role-permission/index.js";
import {
  matchesAuthorizationAdapter,
  TEAM_ROSTER_AUTH_ACTION,
} from "../src/features/competition-core/teams/ports/authorizationAdapterPort.js";
import {
  matchesLineupAuthorizationPort,
  LINEUP_AUTH_ACTION,
} from "../src/features/competition-core/lineups/ports/lineupAuthorizationPort.js";

test("Team adapter — satisfies matchesAuthorizationAdapter", () => {
  const adapter = createTeamAuthorizationPortAdapter({
    evidencePort: createStaticIdentityEvidencePort([
      COMPETITION_PERMISSION.TEAM_WITHDRAW,
    ]),
  });
  assert.equal(matchesAuthorizationAdapter(adapter), true);
});

test("Team adapter — allows withdraw when evidence grants team.withdraw", async () => {
  const adapter = createTeamAuthorizationPortAdapter({
    evidencePort: createStaticIdentityEvidencePort([
      COMPETITION_PERMISSION.TEAM_WITHDRAW,
    ]),
  });
  const result = await adapter.authorize({
    action: TEAM_ROSTER_AUTH_ACTION.TEAM_WITHDRAW,
    actor: "captain-1",
    team: { id: "team-1", competitionId: "comp-1" },
    context: { tenantId: "t1", actorRole: "TEAM_CAPTAIN" },
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, null);
});

test("Team adapter — denies when evidence missing", async () => {
  const adapter = createTeamAuthorizationPortAdapter({});
  const result = await adapter.authorize({
    action: TEAM_ROSTER_AUTH_ACTION.TEAM_ACTIVATE,
    actor: "u1",
    context: { competitionId: "comp-1" },
  });
  assert.equal(result.allowed, false);
});

test("Lineup adapter — satisfies matchesLineupAuthorizationPort", () => {
  const port = createLineupAuthorizationPortAdapter({
    evidencePort: createStaticIdentityEvidencePort([
      COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
    ]),
  });
  assert.equal(matchesLineupAuthorizationPort(port), true);
});

test("Lineup adapter — allows submit with team.lineup.submit grant", async () => {
  const port = createLineupAuthorizationPortAdapter({
    evidencePort: createStaticIdentityEvidencePort([
      COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT,
    ]),
  });
  const result = await port.authorize({
    action: LINEUP_AUTH_ACTION.SUBMIT,
    actorId: "captain-1",
    actorRole: "TEAM_CAPTAIN",
    lineup: { teamId: "team-1", competitionId: "comp-1" },
    context: { tenantId: "t1" },
  });
  assert.equal(result.allowed, true);
});

test("Lineup adapter — accepts team_lineup.submit alias grant", async () => {
  const port = createLineupAuthorizationPortAdapter({
    evidencePort: createStaticIdentityEvidencePort([
      COMPETITION_PERMISSION.TEAM_LINEUP_SUBMIT_V5,
    ]),
  });
  const result = await port.authorize({
    action: LINEUP_AUTH_ACTION.SUBMIT,
    actorId: "captain-1",
    actorRole: "TEAM_CAPTAIN",
    context: { competitionId: "comp-1" },
  });
  assert.equal(result.allowed, true);
});

test("Identity projection — dormant without resolver returns null evidence path", async () => {
  const port = createIdentityProjectionEvidencePort({});
  const evidence = await port.getEvidence({
    subject: { actorId: "u1", role: "TEAM_CAPTAIN" },
    scope: { competitionId: "comp-1" },
  });
  assert.equal(evidence, null);

  const adapter = createTeamAuthorizationPortAdapter({ evidencePort: port });
  const result = await adapter.authorize({
    action: TEAM_ROSTER_AUTH_ACTION.TEAM_WITHDRAW,
    actor: "u1",
    context: { competitionId: "comp-1" },
  });
  assert.equal(result.allowed, false);
});

test("Identity projection — injected resolver supplies grants", async () => {
  const port = createIdentityProjectionEvidencePort({
    resolveGrantedPermissions: async () => [
      COMPETITION_PERMISSION.TEAM_MANAGE,
    ],
  });
  const adapter = createTeamAuthorizationPortAdapter({ evidencePort: port });
  const result = await adapter.authorize({
    action: TEAM_ROSTER_AUTH_ACTION.ROSTER_LOCK,
    actor: "mgr-1",
    context: { competitionId: "comp-1", actorRole: "TOURNAMENT_MANAGER" },
  });
  assert.equal(result.allowed, true);
});
