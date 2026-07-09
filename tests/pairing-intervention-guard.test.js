import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/features/identity/constants/roles.js";
import { TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";
import {
  INTERVENTION_GUARD_CODE,
  INTERVENTION_PHASE,
  isTournamentSetupStatus,
} from "../src/features/pairing-intervention/constants.js";
import {
  guardPairingIntervention,
  canPairingIntervention,
} from "../src/features/pairing-intervention/services/pairingInterventionService.js";

const founderUser = { id: "u1", role: ROLES.PLATFORM_ADMIN };
const tenantOwner = { id: "u2", role: ROLES.TENANT_OWNER };

test("isTournamentSetupStatus allows draft, registration, ready", () => {
  assert.equal(isTournamentSetupStatus(TOURNAMENT_STATUS.DRAFT), true);
  assert.equal(isTournamentSetupStatus(TOURNAMENT_STATUS.REGISTRATION), true);
  assert.equal(isTournamentSetupStatus(TOURNAMENT_STATUS.READY), true);
  assert.equal(isTournamentSetupStatus(TOURNAMENT_STATUS.ACTIVE), false);
});

test("guardPairingIntervention blocks non-founder", () => {
  const result = guardPairingIntervention({
    user: tenantOwner,
    phase: INTERVENTION_PHASE.TOURNAMENT,
    tournamentStatus: TOURNAMENT_STATUS.DRAFT,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, INTERVENTION_GUARD_CODE.FORBIDDEN);
});

test("guardPairingIntervention blocks tournament after setup", () => {
  const result = guardPairingIntervention({
    user: founderUser,
    phase: INTERVENTION_PHASE.TOURNAMENT,
    tournamentStatus: TOURNAMENT_STATUS.ACTIVE,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, INTERVENTION_GUARD_CODE.TOURNAMENT_STARTED);
});

test("guardPairingIntervention allows founder during setup", () => {
  const result = guardPairingIntervention({
    user: founderUser,
    phase: INTERVENTION_PHASE.TOURNAMENT,
    tournamentStatus: TOURNAMENT_STATUS.READY,
  });

  assert.equal(result.ok, true);
});

test("guardPairingIntervention blocks court intervention outside preview", () => {
  const result = guardPairingIntervention({
    user: founderUser,
    phase: INTERVENTION_PHASE.COURT,
    previewMode: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, INTERVENTION_GUARD_CODE.NOT_PREVIEW);
});

test("canPairingIntervention returns true for founder in court preview", () => {
  assert.equal(
    canPairingIntervention({
      user: founderUser,
      phase: INTERVENTION_PHASE.COURT,
      previewMode: true,
    }),
    true
  );
});

test("SUPER_ADMIN alias is treated as founder", () => {
  const result = guardPairingIntervention({
    user: { id: "u3", role: ROLES.SUPER_ADMIN },
    phase: INTERVENTION_PHASE.TOURNAMENT,
    tournamentStatus: TOURNAMENT_STATUS.DRAFT,
  });

  assert.equal(result.ok, true);
});
