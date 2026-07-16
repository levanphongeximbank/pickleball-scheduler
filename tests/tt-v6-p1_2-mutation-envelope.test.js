import test from "node:test";
import assert from "node:assert/strict";

import {
  SETUP_COMMAND_REGISTRY,
  buildSetupMutationEnvelope,
  validateSetupMutationEnvelope,
  calculateSetupMutationPayloadHash,
  hashEngineInput,
  hashEngineOutput,
} from "../src/features/team-tournament/canonical/teamTournamentCanonical.js";
import { CanonicalValidationError } from "../src/features/team-tournament/canonical/teamTournamentCanonicalRules.js";
import { RULES } from "../scripts/ci/ownership-lock.mjs";

test("ownership-lock registers Team Tournament canonical gateway rules", () => {
  const ids = RULES.map((rule) => rule.id);
  assert.equal(ids.includes("team-tournament-setup-canonical-gateway"), true);
  assert.equal(ids.includes("team-tournament-node-crypto-boundary"), true);
});

test("command registry contains locked setup commands", () => {
  const required = [
    "discipline.save",
    "groups.replace",
    "matchups.replace",
    "schedule.publish",
    "tournament.close",
    "snapshot.restore",
  ];
  for (const commandName of required) {
    assert.equal(SETUP_COMMAND_REGISTRY.has(commandName), true, commandName);
  }
  assert.equal(SETUP_COMMAND_REGISTRY.has("generate.matchups"), false);
});

test("buildSetupMutationEnvelope calculates payloadHash after canonicalization", () => {
  const engineInput = { tournamentId: "t-1", disciplineCount: 1 };
  const payload = { disciplineId: "d1", name: "MD" };
  const envelope = buildSetupMutationEnvelope({
    commandName: "discipline.save",
    tournamentId: "t-1",
    expectedTournamentVersion: 4,
    idempotencyKey: "setup:discipline.save:t-1:ui-1",
    engineVersion: "team-tournament-engines@1.0.0",
    engineInputHash: hashEngineInput(engineInput),
    engineOutputHash: hashEngineOutput(payload),
    payload,
  });

  const validation = validateSetupMutationEnvelope(envelope);
  assert.equal(validation.ok, true);
  assert.equal(envelope.payloadHash, calculateSetupMutationPayloadHash(envelope));
  assert.notEqual(envelope.payloadHash, envelope.engineOutputHash);
});

test("payloadHash excludes its own field", () => {
  const envelope = buildSetupMutationEnvelope({
    commandName: "groups.clear",
    tournamentId: "t-1",
    expectedTournamentVersion: 2,
    idempotencyKey: "idem-clear",
    engineVersion: "team-tournament-engines@1.0.0",
    rulesVersion: "pairing-rules@1",
    engineInputHash: hashEngineInput({}),
    engineOutputHash: hashEngineOutput({}),
    payload: {},
  });
  const tampered = { ...envelope, payloadHash: "f".repeat(64) };
  const validation = validateSetupMutationEnvelope(tampered);
  assert.equal(validation.ok, false);
  if (!validation.ok) {
    assert.equal(validation.code, "PAYLOAD_HASH_MISMATCH");
  }
});

test("pairing commands require rulesVersion", () => {
  const envelope = buildSetupMutationEnvelope({
    commandName: "matchups.replace",
    tournamentId: "t-1",
    expectedTournamentVersion: 5,
    idempotencyKey: "idem-matchups",
    engineVersion: "team-tournament-engines@1.0.0",
    rulesVersion: "",
    engineInputHash: hashEngineInput({ mode: "round_robin" }),
    engineOutputHash: hashEngineOutput({ matchups: [] }),
    payload: { matchups: [] },
  });
  const validation = validateSetupMutationEnvelope(envelope);
  assert.equal(validation.ok, false);
  if (!validation.ok) {
    assert.equal(validation.code, "VALIDATION_ERROR");
  }
});

test("invalid commandName is rejected at build time", () => {
  assert.throws(
    () =>
      buildSetupMutationEnvelope({
        commandName: "generate.matchups",
        tournamentId: "t-1",
        expectedTournamentVersion: 1,
        idempotencyKey: "bad",
        engineInputHash: hashEngineInput({}),
        engineOutputHash: hashEngineOutput({}),
        payload: {},
      }),
    (error) => error instanceof CanonicalValidationError && error.code === "INVALID_COMMAND"
  );
});

test("envelope validation rejects invalid hash format", () => {
  const envelope = buildSetupMutationEnvelope({
    commandName: "deputies.set",
    tournamentId: "t-1",
    expectedTournamentVersion: 1,
    idempotencyKey: "idem-dep",
    engineVersion: "team-tournament-engines@1.0.0",
    engineInputHash: hashEngineInput({ teamId: "t1" }),
    engineOutputHash: hashEngineOutput({ deputyPlayerIds: ["p2"] }),
    payload: { teamId: "t1", deputyPlayerIds: ["p2"] },
  });
  envelope.engineOutputHash = "not-a-hash";
  const validation = validateSetupMutationEnvelope(envelope);
  assert.equal(validation.ok, false);
});
