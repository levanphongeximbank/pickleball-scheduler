/**
 * CompetitionRefereeAdapterContract v1 — contract, registry, conformance.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_ACTION_PERMISSION_MAP,
  REFEREE_CAPABILITY,
  assertAdapterDoesNotOwnAuthority,
  createCompetitionRefereeAdapterRegistry,
  createReferenceRefereeAdapter,
  isRefereeAdapterContractError,
  runCompetitionRefereeAdapterConformance,
} from "../src/features/competition-engine/index.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";

function expectCode(fn, code) {
  try {
    fn();
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(isRefereeAdapterContractError(err), true);
    assert.equal(err.code, code);
    assert.equal(err.failClosed, true);
  }
}

test("adapter contract id/version are locked", () => {
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    "competition.referee.adapter.v1"
  );
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION, "1.0.0");
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED, true);
});

test("reference adapter exposes frozen translator methods only", () => {
  const adapter = createReferenceRefereeAdapter({
    mode: COMPETITION_REFEREE_MODE.INTERNAL,
  });
  const request = {
    tenantId: "tenant-1",
    competitionId: "comp-ref-1",
    matchId: "match-1",
  };
  const competition = adapter.getCompetitionContext(request);
  assert.equal(competition.tenantId, "tenant-1");
  assert.equal(Object.isFrozen(competition), true);
  const match = adapter.getMatchContext(request);
  assert.equal(match.matchId, "match-1");
  const participants = adapter.getParticipants(request);
  assert.equal(participants.sides.length, 2);
  const rules = adapter.getScoringRules(request);
  assert.equal(rules.pointsToWin, 11);
  const policy = adapter.getLifecyclePolicy(request);
  assert.equal(policy.standingsRequireAcceptedResult, true);
  const caps = adapter.getCapabilities(request);
  assert.equal(caps.ownsScoringAuthority, false);
  assert.equal(adapter.validatePreStart(request).ok, true);
  const propagation = adapter.resolveResultPropagation(request);
  assert.equal(propagation.propagateOnlyIfAccepted, true);
});

test("registry rejects unknown mode, incompatible version, malformed adapter", () => {
  const adapter = createReferenceRefereeAdapter({
    mode: COMPETITION_REFEREE_MODE.TEAM,
  });
  const registry = createCompetitionRefereeAdapterRegistry({
    adapters: [adapter],
  });
  assert.equal(registry.resolve("TEAM").competitionMode, "TEAM");
  assert.equal(registry.resolve("team_tournament").competitionMode, "TEAM");
  expectCode(
    () => registry.resolve("SEASON_LEAGUE"),
    REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MODE
  );
  expectCode(() => registry.register(), REFEREE_ADAPTER_ERROR_CODE.REGISTRY_FROZEN);

  expectCode(
    () =>
      createCompetitionRefereeAdapterRegistry({
        adapters: [{ ...adapter, contractVersion: "2.0.0" }],
      }),
    REFEREE_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION
  );
  expectCode(
    () => createCompetitionRefereeAdapterRegistry({ adapters: [{}] }),
    REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER
  );
  expectCode(
    () =>
      createCompetitionRefereeAdapterRegistry({
        adapters: [adapter, createReferenceRefereeAdapter({ mode: "TEAM" })],
      }),
    REFEREE_ADAPTER_ERROR_CODE.DUPLICATE_MODE
  );
});

test("conformance suite passes for reference adapter and fails forbidden authority", () => {
  const adapter = createReferenceRefereeAdapter();
  const report = runCompetitionRefereeAdapterConformance(adapter);
  assert.equal(report.ok, true, JSON.stringify(report.results.filter((r) => !r.ok)));
  const ids = report.results.map((row) => row.id);
  for (const required of [
    "CONTRACT_VERSION",
    "MATCH_CONTEXT",
    "PARTICIPANT_CONTEXT",
    "SCORING_RULES",
    "LIFECYCLE_POLICY",
    "CAPABILITIES",
    "PRESTART_POLICY",
    "RESULT_PROPAGATION",
    "UNKNOWN_MODE",
    "UNKNOWN_MATCH",
    "MALFORMED_CONTEXT",
    "MISSING_SCORING_RULES",
    "CROSS_TENANT_CONTEXT",
    "DIRECT_SCORE_AUTHORITY_FORBIDDEN",
    "DIRECT_RESULT_AUTHORITY_FORBIDDEN",
    "DIRECT_REFEREE_AUTHORITY_FORBIDDEN",
  ]) {
    assert.equal(ids.includes(required), true, required);
  }

  expectCode(
    () =>
      assertAdapterDoesNotOwnAuthority({
        recordPoint() {
          return 1;
        },
      }),
    REFEREE_ADAPTER_ERROR_CODE.DIRECT_SCORE_AUTHORITY_FORBIDDEN
  );
});

test("generic referee permission map is decoupled from TEAM_MATCH_RESULT_MANAGE", () => {
  for (const mapping of Object.values(REFEREE_ACTION_PERMISSION_MAP)) {
    assert.equal(
      mapping.requiredPermissions.includes(PERMISSIONS.TEAM_MATCH_RESULT_MANAGE),
      false,
      mapping.capability
    );
    assert.equal(
      mapping.capability.startsWith("competition.referee."),
      true
    );
  }
  assert.equal(
    REFEREE_CAPABILITY.RESULT_SUBMIT,
    PERMISSIONS.COMPETITION_REFEREE_RESULT_SUBMIT
  );
  assert.equal(
    REFEREE_CAPABILITY.INCIDENT_REPORT,
    "competition.referee.incident.report"
  );
});
