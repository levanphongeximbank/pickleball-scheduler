import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  OPERATOR_ACCEPTANCE_STEPS,
  OPERATOR_ACCEPTANCE_ERROR,
  buildOperatorAcceptanceEvidence,
  OPERATOR_ACCEPTANCE_PROJECT_REF,
} from "../src/features/platform-hard-cutover/operatorAcceptanceShared.js";
import {
  evaluateOwnerSecurityBoundary,
  textContainsRestrictedCapability,
  assertNoRestrictedCapabilityLeak,
  scrubRestrictedCapabilityEvidence,
} from "../src/features/platform-hard-cutover/operatorAcceptanceSecurityBoundary.js";
import {
  PUBLIC_CATALOG_ACCEPTANCE_RPCS,
  evaluatePublicCatalogRpcProbe,
  buildRemainingAcceptancePreflightPlan,
  REMAINING_PREFLIGHT_STEPS,
} from "../src/features/platform-hard-cutover/operatorAcceptanceRemainingPreflight.js";

const root = process.cwd();
const runnerPath = path.join(
  root,
  "src/features/platform-hard-cutover/operatorAcceptanceRunner.js"
);
const revokeVerifyPath = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/sql/pairing-owner-view-rbac/99_REVOKE_VERIFY.sql"
);
const rollbackPath = path.join(
  root,
  "docs/platform-hard-cutover-01/phase-04/sql/pairing-owner-view-rbac/90_ROLLBACK.sql"
);

function readRunner() {
  return fs.readFileSync(runnerPath, "utf8");
}

test("acceptance contract remains exactly 17 steps with A-SEC", () => {
  assert.equal(OPERATOR_ACCEPTANCE_STEPS.length, 17);
  assert.equal(OPERATOR_ACCEPTANCE_STEPS[6], "A-SEC");
  assert.equal(OPERATOR_ACCEPTANCE_STEPS.includes("A-PAIR"), false);
  assert.deepEqual(OPERATOR_ACCEPTANCE_STEPS.slice(0, 7), [
    "A-OWN",
    "A-CLUB",
    "A-COURT",
    "A-PLAYER",
    "A-RATE",
    "A-COMP",
    "A-SEC",
  ]);
});

test("Owner path uses A-SEC and does not invoke restricted capability read", () => {
  const runner = readRunner();
  assert.match(runner, /runSecurityBoundaryAcceptance/);
  assert.match(runner, /evaluateOwnerSecurityBoundary/);
  assert.match(runner, /if \(access\.isSuperAdmin\)/);
  assert.match(runner, /runSecurityBoundaryAcceptance\(\{\s*isSuperAdmin: access\.isSuperAdmin/);
  // Owner branch must not call restricted loader
  const ownerBranch = runner.slice(
    runner.indexOf("if (access.isSuperAdmin)"),
    runner.indexOf("const coach = await runCoachingAcceptance")
  );
  assert.match(ownerBranch, /runSecurityBoundaryAcceptance/);
  assert.match(ownerBranch, /else \{/);
  assert.doesNotMatch(
    ownerBranch.slice(ownerBranch.indexOf("else {")),
    /loadActivePrivatePairingRulesForRuntime/
  );
  const ownerEval = evaluateOwnerSecurityBoundary({ isSuperAdmin: false });
  assert.equal(ownerEval.ok, true);
  assert.equal(ownerEval.details.platformWideAdmin, false);
  assertNoRestrictedCapabilityLeak(ownerEval);
  assert.equal(textContainsRestrictedCapability(JSON.stringify(ownerEval)), false);
});

test("Owner evidence/UI scrub removes restricted capability strings", () => {
  const dirty = {
    id: "A-SEC",
    details: {
      note: "should not mention secrets",
      leak: "pairing.private_rules.view",
    },
  };
  const scrubbed = scrubRestrictedCapabilityEvidence(dirty);
  assert.equal(textContainsRestrictedCapability(JSON.stringify(scrubbed)), false);
  const evidence = buildOperatorAcceptanceEvidence({
    access: {
      target: { projectRef: OPERATOR_ACCEPTANCE_PROJECT_REF, appEnv: "staging" },
      tenantId: "venue-staging-a",
      maskedActorId: "13e0***af9c",
      role: "TENANT_OWNER",
      isSuperAdmin: false,
    },
    steps: [
      {
        id: "A-SEC",
        status: "PASS",
        details: { observed: "owner_session_lacks_platform_wide_admin" },
      },
      {
        id: "A-PAIR",
        status: "FAIL",
        message: "private_pairing denied",
        details: { source: "private_pairing_rules repository" },
      },
    ],
  });
  assert.equal(evidence.secretsPrinted, false);
  assert.equal(evidence.actor.maskedUserId, "13e0***af9c");
  assert.equal(textContainsRestrictedCapability(JSON.stringify(evidence)), false);
});

test("Owner roles must not receive private pairing grants in revoke verify", () => {
  const verify = fs.readFileSync(revokeVerifyPath, "utf8");
  const rollback = fs.readFileSync(rollbackPath, "utf8");
  assert.match(rollback, /delete from public\.role_permissions/i);
  assert.match(rollback, /COURT_OWNER/);
  assert.match(rollback, /VENUE_OWNER/);
  assert.match(rollback, /pairing\.private_rules\.view/);
  assert.doesNotMatch(rollback, /create or replace function public\.private_pairing_can/i);
  assert.match(verify, /TENANT_OWNER/);
  assert.match(verify, /COURT_OWNER/);
  assert.match(verify, /VENUE_OWNER/);
  assert.match(verify, /owner_like_pairing_mappings/);
  assert.match(verify, /can_requires_is_super_admin/);
  assert.match(verify, /vis_requires_is_super_admin/);
  assert.doesNotMatch(verify, /insert into public\.role_permissions/i);
});

test("Super-admin positive pairing path remains available and unchanged in contract", () => {
  const runner = readRunner();
  assert.match(runner, /async function runPairingAcceptance/);
  assert.match(runner, /loadActivePrivatePairingRulesForRuntime/);
  assert.match(runner, /okStep\("A-PAIR"/);
  assert.equal(evaluateOwnerSecurityBoundary({ isSuperAdmin: true }).ok, false);
});

test("A-COURT fails when found.venueId !== tenantId", () => {
  const runner = readRunner();
  assert.match(runner, /COURT_TENANT_MISMATCH/);
  assert.match(runner, /foundVenueId !== String\(tenantId\)\.trim\(\)/);
  assert.equal(
    OPERATOR_ACCEPTANCE_ERROR.COURT_TENANT_MISMATCH,
    "COURT_TENANT_MISMATCH"
  );
});

test("A-RATE fails when two start assessments resolve different profiles", () => {
  const runner = readRunner();
  assert.match(runner, /RATING_PROFILE_MISMATCH/);
  assert.match(runner, /sameProfileId/);
  assert.match(runner, /Two start-assessment calls did not resolve the same profile/);
  assert.doesNotMatch(runner, /clubBlobWriteForbidden:\s*true/);
  assert.doesNotMatch(runner, /authUsersCreated:\s*0/);
  assert.doesNotMatch(runner, /legacyTableAbsent:\s*true/);
  assert.match(runner, /notObserved/);
});

test("A-CAT covers all four Public Catalog RPCs; empty PASS; malformed FAIL", () => {
  assert.deepEqual(PUBLIC_CATALOG_ACCEPTANCE_RPCS, [
    "public_catalog_list_clubs",
    "public_catalog_list_courts",
    "public_catalog_list_tournaments",
    "public_catalog_list_rankings",
  ]);
  const emptyPass = evaluatePublicCatalogRpcProbe({
    rpc: "public_catalog_list_clubs",
    result: { ok: true, value: { items: [] } },
  });
  assert.equal(emptyPass.ok, true);
  assert.equal(emptyPass.empty, true);
  const denied = evaluatePublicCatalogRpcProbe({
    rpc: "public_catalog_list_courts",
    result: { ok: false, code: "PERMISSION_DENIED", message: "denied" },
  });
  assert.equal(denied.ok, false);
  const malformed = evaluatePublicCatalogRpcProbe({
    rpc: "public_catalog_list_tournaments",
    result: { ok: true, value: { items: "nope" } },
  });
  assert.equal(malformed.ok, false);
  const runner = readRunner();
  assert.match(runner, /PUBLIC_CATALOG_RPC\.LIST_CLUBS/);
  assert.match(runner, /PUBLIC_CATALOG_RPC\.LIST_COURTS/);
  assert.match(runner, /PUBLIC_CATALOG_RPC\.LIST_TOURNAMENTS/);
  assert.match(runner, /PUBLIC_CATALOG_RPC\.LIST_RANKINGS/);
  assert.match(runner, /Malformed public catalog response/);
});

test("remaining preflight plan is read-only and covers required steps", () => {
  const plan = buildRemainingAcceptancePreflightPlan();
  assert.equal(plan.mode, "READ_ONLY");
  assert.equal(plan.noBusinessWrites, true);
  assert.equal(plan.noDatabaseWrites, true);
  assert.equal(plan.acceptanceStepsContract, 17);
  assert.equal(plan.ownerBoundaryStep, "A-SEC");
  assert.deepEqual(plan.remainingSteps, REMAINING_PREFLIGHT_STEPS);
  assert.equal(plan.aCat.rpcs.length, 4);
});
