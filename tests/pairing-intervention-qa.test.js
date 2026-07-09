import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/features/identity/constants/roles.js";
import { TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";
import { INTERVENTION_PHASE } from "../src/features/pairing-intervention/constants.js";
import {
  canPairingIntervention,
  guardPairingIntervention,
} from "../src/features/pairing-intervention/services/pairingInterventionService.js";

/**
 * QA checklist scenarios from UI design plan.
 */

const founder = { id: "founder-1", role: ROLES.PLATFORM_ADMIN };
const tenantOwner = { id: "owner-1", role: ROLES.TENANT_OWNER };

test("QA: Founder sees intervention during tournament setup (draft)", () => {
  assert.equal(
    canPairingIntervention({
      user: founder,
      phase: INTERVENTION_PHASE.TOURNAMENT,
      tournamentStatus: TOURNAMENT_STATUS.DRAFT,
    }),
    true
  );
});

test("QA: Founder sees intervention during tournament setup (ready)", () => {
  assert.equal(
    canPairingIntervention({
      user: founder,
      phase: INTERVENTION_PHASE.TOURNAMENT,
      tournamentStatus: TOURNAMENT_STATUS.READY,
    }),
    true
  );
});

test("QA: Tenant owner cannot intervene in tournament setup", () => {
  assert.equal(
    canPairingIntervention({
      user: tenantOwner,
      phase: INTERVENTION_PHASE.TOURNAMENT,
      tournamentStatus: TOURNAMENT_STATUS.DRAFT,
    }),
    false
  );
});

test("QA: Panel hidden when tournament is active", () => {
  const result = guardPairingIntervention({
    user: founder,
    phase: INTERVENTION_PHASE.TOURNAMENT,
    tournamentStatus: TOURNAMENT_STATUS.ACTIVE,
  });
  assert.equal(result.ok, false);
});

test("QA: Panel hidden when tournament is completed", () => {
  const result = guardPairingIntervention({
    user: founder,
    phase: INTERVENTION_PHASE.TOURNAMENT,
    tournamentStatus: TOURNAMENT_STATUS.COMPLETED,
  });
  assert.equal(result.ok, false);
});

test("QA: Founder court intervention only in preview mode", () => {
  assert.equal(
    canPairingIntervention({
      user: founder,
      phase: INTERVENTION_PHASE.COURT,
      previewMode: true,
    }),
    true
  );
  assert.equal(
    canPairingIntervention({
      user: founder,
      phase: INTERVENTION_PHASE.COURT,
      previewMode: false,
    }),
    false
  );
});

test("QA: Tenant owner cannot intervene in court preview", () => {
  assert.equal(
    canPairingIntervention({
      user: tenantOwner,
      phase: INTERVENTION_PHASE.COURT,
      previewMode: true,
    }),
    false
  );
});
