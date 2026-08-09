/**
 * OPERATION B1B — WP6A Staging rehearsal readiness remediation tests.
 * Local/mock only. No Staging/Production access. No Auth mutations.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PRODUCTION_PROJECT_REF,
  EXPECTED_STAGING_PROJECT_REF,
  OPERATION_TARGET_MODE,
  OPERATION_ID,
  RETIRED_OWNER_PRODUCTION_GO,
  RETIRED_OPERATION_B1_BATCH_IDS,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
  CERTIFIED_STAGING_TARGET_LABELS,
  evaluateAuthorization,
  mutationAllowed,
  createFreshAuthorizationBinding,
  resolveOperationTargetMode,
  validateAllowlistDocument,
  sha256Hex,
  presentLiveAuthority,
  resetAuthorityConsumptionForTests,
} from "../scripts/operations/production-qa-identity-operation-b1b/lib/index.js";
import { runB1BExecute } from "../scripts/operations/production-qa-identity-operation-b1b/execute.mjs";
import { isCertifiedQaEmail } from "../src/features/player/utils/qaTestIdentityFilter.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WP6A_DIR = path.join(
  root,
  "docs/v5/operations/production-qa-identity-operation-b1b-remediation/wp6a-staging-readiness"
);
const STAGING_BATCH = "c13c323a-4fec-4327-90ba-56128fb126f5";
const PROD_BATCH = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2";
const STAGING_GO = "APPROVE_OPERATION_B1B_STAGING_REHEARSAL_UNIT_TEST_NOT_LIVE";
const PROD_GO = "APPROVE_OPERATION_B1B_UNIT_TEST_BINDING_NOT_PRODUCTION";

function zeroRefs() {
  return {
    athlete_count: 0,
    membership_active: 0,
    membership_removed: 0,
    membership_total: 0,
    tenant_members: 0,
    tenants_owned: 0,
    club_governance_owner: 0,
    tournament_refs: 0,
    rating_refs: 0,
    finance_refs: 0,
    other_business_refs: 0,
  };
}

function uuid(n = 1) {
  const hex = String(n).padStart(12, "0");
  return `33333333-4444-4555-8666-${hex}`;
}

function makeProductionEight() {
  const identities = [];
  for (let i = 1; i <= 8; i += 1) {
    const id = uuid(i);
    identities.push({
      label: `QA-${String(i + 3).padStart(2, "0")}`,
      auth_user_id: id,
      profile_id: id,
      expected_email: `phase1c.prod.safe${i}@prod-qa.local`,
      profile_status: "active",
      auth_banned: false,
      reference_counts: zeroRefs(),
      captured_at: "2026-08-09T00:00:00.000Z",
      production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    });
  }
  return identities;
}

function makeStagingEight() {
  const identities = [];
  for (let i = 1; i <= 8; i += 1) {
    const id = uuid(100 + i);
    identities.push({
      label: CERTIFIED_STAGING_TARGET_LABELS[i - 1],
      auth_user_id: id,
      profile_id: id,
      expected_email: `phase1c.stg.safe${i}@staging-qa.local`,
      profile_status: "active",
      auth_banned: false,
      reference_counts: zeroRefs(),
      captured_at: "2026-08-09T00:00:00.000Z",
      staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
    });
  }
  return identities;
}

function writePair(identities, { mode, batchId, projectRefField, projectRef }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "op-b1b-wp6a-"));
  const allowlist = {
    operation: OPERATION_ID,
    operation_target_mode: mode,
    target_count: 8,
    captured_at_utc: "2026-08-09T00:00:00.000Z",
    identities,
  };
  allowlist[projectRefField] = projectRef;
  const alBody = `${JSON.stringify(allowlist, null, 2)}\n`;
  const alPath = path.join(dir, "allowlist.json");
  fs.writeFileSync(alPath, alBody, "utf8");

  const snapshot = {
    operation:
      mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL
        ? "OPERATION_B1B_STAGING_ORIGINAL_STATE_SNAPSHOT"
        : "OPERATION_B1B_ORIGINAL_STATE_SNAPSHOT",
    operation_target_mode: mode,
    batch_id: batchId,
    captured_at_utc: "2026-08-09T00:00:00.000Z",
    target_count: 8,
    identities: identities.map((r) => ({
      label: r.label,
      auth_user_id: r.auth_user_id,
      profile_id: r.profile_id,
      email: r.expected_email,
      original_profile_status: r.profile_status,
      original_auth_banned: r.auth_banned === true,
      reference_counts: r.reference_counts,
      captured_at: r.captured_at,
      [projectRefField]: projectRef,
    })),
  };
  snapshot[projectRefField] = projectRef;
  const snBody = `${JSON.stringify(snapshot, null, 2)}\n`;
  const snPath = path.join(dir, "snapshot.json");
  fs.writeFileSync(snPath, snBody, "utf8");
  return {
    dir,
    alPath,
    snPath,
    alSha: sha256Hex(alBody),
    snSha: sha256Hex(snBody),
  };
}

function productionFiles() {
  return writePair(makeProductionEight(), {
    mode: OPERATION_TARGET_MODE.PRODUCTION,
    batchId: PROD_BATCH,
    projectRefField: "production_project_ref",
    projectRef: EXPECTED_PRODUCTION_PROJECT_REF,
  });
}

function stagingFiles() {
  return writePair(makeStagingEight(), {
    mode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    batchId: STAGING_BATCH,
    projectRefField: "staging_project_ref",
    projectRef: EXPECTED_STAGING_PROJECT_REF,
  });
}

function productionBinding(files) {
  const created = createFreshAuthorizationBinding({
    operationTargetMode: OPERATION_TARGET_MODE.PRODUCTION,
    ownerProductionGo: PROD_GO,
    explicitExecuteConfirmation: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
    expectedBatchId: PROD_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    productionProjectRef: EXPECTED_PRODUCTION_PROJECT_REF,
  });
  assert.equal(created.ok, true, created.reasons?.join(","));
  return created.binding;
}

function stagingBinding(files) {
  const created = createFreshAuthorizationBinding({
    operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    ownerStagingGo: STAGING_GO,
    explicitExecuteConfirmation: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
    expectedBatchId: STAGING_BATCH,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    stagingProjectRef: EXPECTED_STAGING_PROJECT_REF,
  });
  assert.equal(created.ok, true, created.reasons?.join(","));
  return created.binding;
}

function productionLiveInput(files, binding, overrides = {}) {
  return {
    DRY_RUN: "false",
    OPERATION_TARGET_MODE: OPERATION_TARGET_MODE.PRODUCTION,
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1B_BATCH_ID: PROD_BATCH,
    ALLOWLIST_PATH: files.alPath,
    ALLOWLIST_SHA256: files.alSha,
    RECOVERY_SNAPSHOT_PATH: files.snPath,
    SNAPSHOT_SHA256: files.snSha,
    OWNER_PRODUCTION_GO: PROD_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
    freshAuthorizationBinding: binding,
    ...overrides,
  };
}

function stagingLiveInput(files, binding, overrides = {}) {
  return {
    DRY_RUN: "false",
    OPERATION_TARGET_MODE: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    STAGING_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
    OPERATION_B1B_BATCH_ID: STAGING_BATCH,
    ALLOWLIST_PATH: files.alPath,
    ALLOWLIST_SHA256: files.alSha,
    RECOVERY_SNAPSHOT_PATH: files.snPath,
    SNAPSHOT_SHA256: files.snSha,
    OWNER_STAGING_GO: STAGING_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
    freshAuthorizationBinding: binding,
    ...overrides,
  };
}

test("WP6A) mode defaults to production when unset; staging must be explicit", () => {
  const unset = resolveOperationTargetMode({});
  assert.equal(unset.ok, true);
  assert.equal(unset.mode, OPERATION_TARGET_MODE.PRODUCTION);

  const explicit = resolveOperationTargetMode({
    OPERATION_TARGET_MODE: "staging_rehearsal",
  });
  assert.equal(explicit.ok, true);
  assert.equal(explicit.mode, OPERATION_TARGET_MODE.STAGING_REHEARSAL);

  const bad = resolveOperationTargetMode({ OPERATION_TARGET_MODE: "auto" });
  assert.equal(bad.ok, false);
  assert.ok(bad.reasons.includes("unknown_or_invalid_operation_target_mode"));
});

test("WP6A) production mode accepts only exact Production ref", () => {
  resetAuthorityConsumptionForTests();
  const files = productionFiles();
  const binding = productionBinding(files);
  const ok = evaluateAuthorization(productionLiveInput(files, binding));
  assert.equal(ok.ok, true);
  assert.equal(mutationAllowed(ok), true);
  assert.equal(ok.projectRef, EXPECTED_PRODUCTION_PROJECT_REF);
});

test("WP6A) staging rehearsal mode accepts only exact Staging ref", () => {
  resetAuthorityConsumptionForTests();
  const files = stagingFiles();
  const binding = stagingBinding(files);
  const ok = evaluateAuthorization(stagingLiveInput(files, binding));
  assert.equal(ok.ok, true, ok.reasons.join(","));
  assert.equal(mutationAllowed(ok), true);
  assert.equal(ok.projectRef, EXPECTED_STAGING_PROJECT_REF);
  assert.equal(ok.operationTargetMode, OPERATION_TARGET_MODE.STAGING_REHEARSAL);
});

test("WP6A) staging mode rejects Production ref", () => {
  resetAuthorityConsumptionForTests();
  const files = stagingFiles();
  const binding = stagingBinding(files);
  const bad = evaluateAuthorization(
    stagingLiveInput(files, binding, {
      STAGING_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
      TARGET_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    })
  );
  assert.equal(mutationAllowed(bad), false);
  assert.ok(
    bad.reasons.includes("production_project_ref_rejected_in_staging_mode")
  );
});

test("WP6A) production mode rejects Staging ref", () => {
  resetAuthorityConsumptionForTests();
  const files = productionFiles();
  const binding = productionBinding(files);
  const bad = evaluateAuthorization(
    productionLiveInput(files, binding, {
      PRODUCTION_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
    })
  );
  assert.equal(mutationAllowed(bad), false);
  assert.ok(
    bad.reasons.includes("staging_project_ref_rejected_in_production_mode")
  );
});

test("WP6A) unknown project ref fails closed in both modes", () => {
  resetAuthorityConsumptionForTests();
  const pFiles = productionFiles();
  const pBinding = productionBinding(pFiles);
  const pBad = evaluateAuthorization(
    productionLiveInput(pFiles, pBinding, {
      PRODUCTION_PROJECT_REF: "unknownprojectrefxxxx",
    })
  );
  assert.equal(mutationAllowed(pBad), false);
  assert.ok(pBad.reasons.includes("wrong_or_missing_production_project_ref"));

  const sFiles = stagingFiles();
  const sBinding = stagingBinding(sFiles);
  const sBad = evaluateAuthorization(
    stagingLiveInput(sFiles, sBinding, {
      STAGING_PROJECT_REF: "unknownprojectrefxxxx",
    })
  );
  assert.equal(mutationAllowed(sBad), false);
  assert.ok(sBad.reasons.includes("wrong_or_missing_staging_project_ref"));
});

test("WP6A) retired GO/batch rejected in staging and production", () => {
  resetAuthorityConsumptionForTests();
  const sFiles = stagingFiles();
  const sBinding = stagingBinding(sFiles);
  for (const retired of RETIRED_OPERATION_B1_BATCH_IDS) {
    const r = evaluateAuthorization(
      stagingLiveInput(sFiles, sBinding, { OPERATION_B1B_BATCH_ID: retired })
    );
    assert.equal(mutationAllowed(r), false);
    assert.ok(r.reasons.includes("retired_batch_id_not_reusable"));
  }
  const retiredGo = evaluateAuthorization(
    stagingLiveInput(sFiles, sBinding, {
      OWNER_STAGING_GO: RETIRED_OWNER_PRODUCTION_GO,
    })
  );
  assert.equal(mutationAllowed(retiredGo), false);
  assert.ok(
    retiredGo.reasons.includes("retired_owner_production_go_not_reusable")
  );

  const pFiles = productionFiles();
  const pBinding = productionBinding(pFiles);
  const pRetired = evaluateAuthorization(
    productionLiveInput(pFiles, pBinding, {
      OWNER_PRODUCTION_GO: RETIRED_OWNER_PRODUCTION_GO,
    })
  );
  assert.equal(mutationAllowed(pRetired), false);
  assert.ok(
    pRetired.reasons.includes("retired_owner_production_go_not_reusable")
  );
});

test("WP6A) production allowlist rejected in staging; staging allowlist rejected in production", () => {
  const prodDoc = {
    operation: OPERATION_ID,
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: 8,
    identities: makeProductionEight(),
  };
  const stagingDoc = {
    operation: OPERATION_ID,
    operation_target_mode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
    target_count: 8,
    identities: makeStagingEight(),
  };

  const prodInStaging = validateAllowlistDocument(prodDoc, {
    operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
  });
  assert.equal(prodInStaging.ok, false);
  assert.ok(
    prodInStaging.errors.includes("production_allowlist_rejected_in_staging_mode")
  );

  const stagingInProd = validateAllowlistDocument(stagingDoc, {
    operationTargetMode: OPERATION_TARGET_MODE.PRODUCTION,
  });
  assert.equal(stagingInProd.ok, false);
  assert.ok(
    stagingInProd.errors.includes("staging_allowlist_rejected_in_production_mode")
  );

  const stagingOk = validateAllowlistDocument(stagingDoc, {
    operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
  });
  assert.equal(stagingOk.ok, true, stagingOk.errors.join(","));
});

test("WP6A) authority mismatch yields zero auth mutation (presentLiveAuthority fail-closed)", async () => {
  resetAuthorityConsumptionForTests();
  const files = stagingFiles();
  const binding = stagingBinding(files);
  const mismatched = evaluateAuthorization(
    stagingLiveInput(files, binding, {
      OWNER_STAGING_GO: "WRONG_STAGING_GO",
    })
  );
  assert.equal(mutationAllowed(mismatched), false);
  let claimCalls = 0;
  const presented = await presentLiveAuthority(mismatched, async () => {
    claimCalls += 1;
    return { ok: true };
  });
  assert.equal(presented.ok, false);
  assert.equal(presented.reason, "mutation_not_authorized");
  assert.equal(claimCalls, 0);

  const report = await runB1BExecute(
    stagingLiveInput(files, binding, { OWNER_STAGING_GO: "WRONG_STAGING_GO" }),
    {
      repoRoots: [root],
      claimOneTimeLiveAuthority: async () => {
        claimCalls += 1;
        return { ok: true };
      },
    }
  );
  assert.equal(report.ok, false);
  assert.equal(report.mutationCalls, 0);
  assert.equal(report.authorityConsumed, false);
});

test("WP6A) real-user / certified email protection preserved", () => {
  assert.equal(isCertifiedQaEmail("phase1b-smith@gmail.com"), false);
  assert.equal(isCertifiedQaEmail("phase1c.prod.safe1@prod-qa.local"), true);
  assert.equal(isCertifiedQaEmail("phase1c.stg.safe1@staging-qa.local"), true);
  assert.equal(isCertifiedQaEmail("phase1c.stg.safe1@prod-qa.local"), false);
  assert.equal(isCertifiedQaEmail("phase1c.prod.safe1@staging-qa.local"), false);

  const stagingDoc = {
    operation: OPERATION_ID,
    operation_target_mode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
    target_count: 8,
    identities: makeStagingEight().map((row, idx) =>
      idx === 0
        ? { ...row, expected_email: "phase1b-smith@gmail.com" }
        : row
    ),
  };
  const forbidden = validateAllowlistDocument(stagingDoc, {
    operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
  });
  assert.equal(forbidden.ok, false);
  assert.ok(forbidden.errors.includes("forbidden_real_user_email"));
});

test("WP6A) evidence package artifacts exist with reserved staging batch", () => {
  const required = [
    "00_README.md",
    "01_STAGING_BACKUP_RECOVERY_AUDIT.md",
    "02_STAGING_BACKUP_OWNER_CONFIRMATION.json",
    "02_STAGING_BACKUP_OWNER_CONFIRMATION.template.json",
    "03_STAGING_QA_IDENTITY_PACKAGE.md",
    "04_STAGING_SAFE_RUNNER_RUNBOOK.md",
    "STAGING_QA_IDENTITY_DESIGNATION.json",
    "STAGING_ALLOWLIST.template.json",
    "STAGING_RECOVERY_SNAPSHOT.template.json",
    "STAGING_PACKAGE_CHECKSUMS.json",
    "REAL_USER_EXCLUSION_PROOF.json",
  ];
  for (const name of required) {
    assert.equal(
      fs.existsSync(path.join(WP6A_DIR, name)),
      true,
      `missing ${name}`
    );
  }
  const designation = JSON.parse(
    fs.readFileSync(
      path.join(WP6A_DIR, "STAGING_QA_IDENTITY_DESIGNATION.json"),
      "utf8"
    )
  );
  assert.equal(designation.identities.length, 8);
  assert.equal(designation.reserved_staging_batch_id, STAGING_BATCH);
  assert.equal(designation.staging_project_ref, EXPECTED_STAGING_PROJECT_REF);
  assert.equal(
    designation.production_project_ref_blocked,
    EXPECTED_PRODUCTION_PROJECT_REF
  );

  const backup = JSON.parse(
    fs.readFileSync(
      path.join(WP6A_DIR, "02_STAGING_BACKUP_OWNER_CONFIRMATION.json"),
      "utf8"
    )
  );
  assert.equal(backup.status, "pending_owner");
  assert.equal(backup.project_ref, EXPECTED_STAGING_PROJECT_REF);
});

test("WP6A) production execute confirmation rejected in staging mode", () => {
  resetAuthorityConsumptionForTests();
  const files = stagingFiles();
  const binding = stagingBinding(files);
  const bad = evaluateAuthorization(
    stagingLiveInput(files, binding, {
      EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
    })
  );
  assert.equal(mutationAllowed(bad), false);
  assert.ok(
    bad.reasons.includes(
      "missing_or_invalid_explicit_staging_execute_confirmation"
    ) ||
      bad.reasons.includes(
        "production_execute_confirmation_rejected_in_staging_mode"
      )
  );
});
