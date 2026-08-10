/**
 * OPERATION B1B — Option C mode-aware label/email contract + preclaim ordering.
 * Local/mock only (no Staging/Production access).
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

import {
  CERTIFIED_B1_TARGET_LABELS,
  CERTIFIED_STAGING_TARGET_LABELS,
  EXPECTED_B1B_COUNT,
  EXPECTED_PRODUCTION_PROJECT_REF,
  EXPECTED_STAGING_PROJECT_REF,
  FORBIDDEN_REAL_USER_EMAIL,
  OPERATION_ID,
  OPERATION_TARGET_MODE,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
  certifiedLabelsForOperationMode,
  createFreshAuthorizationBinding,
  resetAuthorityConsumptionForTests,
  sha256Hex,
  validateAllowlistDocument,
  validateCertifiedQaLabelBinding,
} from "../scripts/operations/production-qa-identity-operation-b1b/lib/index.js";
import { runB1BExecute } from "../scripts/operations/production-qa-identity-operation-b1b/execute.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function uuid(n) {
  const hex = Number(n).toString(16).padStart(12, "0");
  return `aaaaaaaa-bbbb-4ccc-8ddd-${hex}`;
}

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

function makeProdEight() {
  return CERTIFIED_B1_TARGET_LABELS.map((label, i) => ({
    label,
    auth_user_id: uuid(i + 1),
    profile_id: uuid(i + 1),
    expected_email: `phase1c.prod.safe${i + 1}@prod-qa.local`,
    profile_status: "active",
    auth_banned: false,
    reference_counts: zeroRefs(),
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
  }));
}

function makeStgEight() {
  return CERTIFIED_STAGING_TARGET_LABELS.map((label, i) => ({
    label,
    auth_user_id: uuid(i + 1),
    profile_id: uuid(i + 1),
    expected_email: `phase1c.stg.safe${i + 1}@staging-qa.local`,
    profile_status: "active",
    auth_banned: false,
    reference_counts: zeroRefs(),
    staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
  }));
}

function writePackage(identities, batchId, mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "b1b-label-contract-"));
  const allowlist = {
    operation: OPERATION_ID,
    operation_target_mode: mode,
    target_count: EXPECTED_B1B_COUNT,
    identities,
    ...(mode === OPERATION_TARGET_MODE.STAGING_REHEARSAL
      ? { staging_project_ref: EXPECTED_STAGING_PROJECT_REF }
      : { production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF }),
  };
  const snapshot = {
    operation: OPERATION_ID,
    operation_target_mode: mode,
    batch_id: batchId,
    identities: identities.map((r) => ({
      label: r.label,
      auth_user_id: r.auth_user_id,
      profile_id: r.profile_id,
      expected_email: r.expected_email,
      original_profile_status: r.profile_status,
      original_auth_banned: r.auth_banned,
    })),
  };
  const alPath = path.join(dir, "allowlist.json");
  const snPath = path.join(dir, "snapshot.json");
  const alBytes = Buffer.from(JSON.stringify(allowlist, null, 2));
  const snBytes = Buffer.from(JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(alPath, alBytes);
  fs.writeFileSync(snPath, snBytes);
  return {
    alPath,
    snPath,
    alSha: sha256Hex(alBytes),
    snSha: sha256Hex(snBytes),
    dir,
  };
}

function claimerSpy() {
  const state = { calls: 0 };
  const fn = async () => {
    state.calls += 1;
    return { ok: true };
  };
  fn.state = state;
  return fn;
}

test("Option C JS: certified label sets remain exact-eight and non-interchangeable", () => {
  assert.deepEqual(certifiedLabelsForOperationMode("production"), [
    ...CERTIFIED_B1_TARGET_LABELS,
  ]);
  assert.deepEqual(certifiedLabelsForOperationMode("staging_rehearsal"), [
    ...CERTIFIED_STAGING_TARGET_LABELS,
  ]);
  assert.equal(CERTIFIED_B1_TARGET_LABELS.length, 8);
  assert.equal(CERTIFIED_STAGING_TARGET_LABELS.length, 8);
  for (const label of CERTIFIED_B1_TARGET_LABELS) {
    assert.equal(CERTIFIED_STAGING_TARGET_LABELS.includes(label), false);
  }
});

test("D1 allowlist: Production QA PASS; Staging STG PASS; cross-env FAIL", () => {
  const prod = validateAllowlistDocument(
    {
      operation: OPERATION_ID,
      operation_target_mode: "production",
      production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
      target_count: 8,
      identities: makeProdEight(),
    },
    { operationTargetMode: "production" }
  );
  assert.equal(prod.ok, true);

  const stg = validateAllowlistDocument(
    {
      operation: OPERATION_ID,
      operation_target_mode: "staging_rehearsal",
      staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
      target_count: 8,
      identities: makeStgEight(),
    },
    { operationTargetMode: "staging_rehearsal" }
  );
  assert.equal(stg.ok, true);

  const prodWithStgLabels = validateAllowlistDocument(
    {
      operation: OPERATION_ID,
      production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
      target_count: 8,
      identities: makeStgEight().map((r) => ({
        ...r,
        production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
        staging_project_ref: undefined,
      })),
    },
    { operationTargetMode: "production" }
  );
  assert.equal(prodWithStgLabels.ok, false);

  const stgWithProdLabels = validateAllowlistDocument(
    {
      operation: OPERATION_ID,
      operation_target_mode: "staging_rehearsal",
      staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
      target_count: 8,
      identities: makeProdEight().map((r) => ({
        ...r,
        expected_email: `phase1c.stg.safe${r.label.slice(-1)}@staging-qa.local`,
        staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
        production_project_ref: undefined,
      })),
    },
    { operationTargetMode: "staging_rehearsal" }
  );
  assert.equal(stgWithProdLabels.ok, false);
});

test("D1 binding helper rejects wrong domain / real-user / out-of-range", () => {
  assert.equal(
    validateCertifiedQaLabelBinding({
      operationTargetMode: "staging_rehearsal",
      label: "STG-QA-04",
      expectedEmail: "phase1c.stg.safe1@staging-qa.local",
    }).ok,
    true
  );
  assert.equal(
    validateCertifiedQaLabelBinding({
      operationTargetMode: "staging_rehearsal",
      label: "STG-QA-04",
      expectedEmail: "phase1c.prod.safe1@prod-qa.local",
    }).ok,
    false
  );
  assert.equal(
    validateCertifiedQaLabelBinding({
      operationTargetMode: "production",
      label: "QA-04",
      expectedEmail: "phase1c.stg.safe1@staging-qa.local",
    }).ok,
    false
  );
  assert.equal(
    validateCertifiedQaLabelBinding({
      operationTargetMode: "staging_rehearsal",
      label: "STG-QA-01",
      expectedEmail: "phase1c.stg.safe1@staging-qa.local",
    }).ok,
    false
  );
  assert.equal(
    validateCertifiedQaLabelBinding({
      operationTargetMode: "production",
      label: "QA-12",
      expectedEmail: "phase1c.prod.safe1@prod-qa.local",
    }).ok,
    false
  );
  assert.equal(
    validateCertifiedQaLabelBinding({
      operationTargetMode: "production",
      label: "QA-04",
      expectedEmail: FORBIDDEN_REAL_USER_EMAIL,
    }).ok,
    false
  );
});

test("D3 preclaim FAIL: durable claim not called; mutationCalls=0", async () => {
  resetAuthorityConsumptionForTests();
  const batchId = crypto.randomUUID();
  const identities = makeStgEight();
  const files = writePackage(
    identities,
    batchId,
    OPERATION_TARGET_MODE.STAGING_REHEARSAL
  );
  const created = createFreshAuthorizationBinding({
    operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    ownerStagingGo: "OWNER_STAGING_GO_LABEL_CONTRACT_TEST",
    expectedBatchId: batchId,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    stagingProjectRef: EXPECTED_STAGING_PROJECT_REF,
    explicitExecuteConfirmation: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
  });
  assert.equal(created.ok, true, String(created.reasons || []));
  const binding = created.binding;
  const claim = claimerSpy();
  let prepareCalls = 0;
  const report = await runB1BExecute(
    {
      DRY_RUN: "false",
      OPERATION_TARGET_MODE: "staging_rehearsal",
      STAGING_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
      OPERATION_B1B_BATCH_ID: batchId,
      ALLOWLIST_PATH: files.alPath,
      ALLOWLIST_SHA256: files.alSha,
      RECOVERY_SNAPSHOT_PATH: files.snPath,
      SNAPSHOT_SHA256: files.snSha,
      OWNER_STAGING_GO: "OWNER_STAGING_GO_LABEL_CONTRACT_TEST",
      EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
      freshAuthorizationBinding: binding,
    },
    {
      repoRoots: [root],
      claimOneTimeLiveAuthority: claim,
      adapters: {
        validateQaPrepareContract: async () => ({
          ok: false,
          reason: "prepare_contract_incompatible",
          code: "prepare_contract_incompatible",
        }),
        qaQuarantinePrepare: async () => {
          prepareCalls += 1;
          return { ok: true, data: { ok: true, code: "prepared" } };
        },
        fetchAuthUser: async () => null,
        fetchProfile: async () => null,
        fetchReferenceCounts: async () => zeroRefs(),
        fetchAuthBanState: async () => false,
      },
    }
  );
  assert.equal(report.ok, false);
  assert.equal(report.failReason, "prepare_contract_preclaim_failed");
  assert.equal(report.durableAuthorityClaimed, false);
  assert.equal(report.authorityConsumed, false);
  assert.equal(report.mutationCalls, 0);
  assert.equal(claim.state.calls, 0);
  assert.equal(prepareCalls, 0);
});

test("D3 preclaim PASS staging: claim called once then batch may proceed", async () => {
  resetAuthorityConsumptionForTests();
  const batchId = crypto.randomUUID();
  const identities = makeStgEight();
  const files = writePackage(
    identities,
    batchId,
    OPERATION_TARGET_MODE.STAGING_REHEARSAL
  );
  const created = createFreshAuthorizationBinding({
    operationTargetMode: OPERATION_TARGET_MODE.STAGING_REHEARSAL,
    ownerStagingGo: "OWNER_STAGING_GO_LABEL_CONTRACT_PASS",
    expectedBatchId: batchId,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    stagingProjectRef: EXPECTED_STAGING_PROJECT_REF,
    explicitExecuteConfirmation: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
  });
  assert.equal(created.ok, true, String(created.reasons || []));
  const binding = created.binding;
  const claim = claimerSpy();
  let compatCalls = 0;
  const row = identities[0];
  const report = await runB1BExecute(
    {
      DRY_RUN: "false",
      OPERATION_TARGET_MODE: "staging_rehearsal",
      STAGING_PROJECT_REF: EXPECTED_STAGING_PROJECT_REF,
      OPERATION_B1B_BATCH_ID: batchId,
      ALLOWLIST_PATH: files.alPath,
      ALLOWLIST_SHA256: files.alSha,
      RECOVERY_SNAPSHOT_PATH: files.snPath,
      SNAPSHOT_SHA256: files.snSha,
      OWNER_STAGING_GO: "OWNER_STAGING_GO_LABEL_CONTRACT_PASS",
      EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_STAGING_EXECUTE_CONFIRMATION,
      freshAuthorizationBinding: binding,
    },
    {
      repoRoots: [root],
      claimOneTimeLiveAuthority: claim,
      adapters: {
        validateQaPrepareContract: async () => {
          compatCalls += 1;
          return {
            ok: true,
            data: {
              ok: true,
              code: "prepare_contract_compatible",
              environment: "staging",
            },
          };
        },
        fetchAuthUser: async (id) =>
          id === row.auth_user_id
            ? { id, email: row.expected_email, banned_until: null }
            : null,
        fetchProfile: async (id) =>
          id === row.profile_id
            ? { id, email: row.expected_email, status: "active" }
            : null,
        fetchReferenceCounts: async () => zeroRefs(),
        fetchAuthBanState: async () => false,
        qaQuarantinePrepare: async () => ({
          ok: false,
          reason: "prepare_rejected_after_claim_for_harness",
        }),
      },
    }
  );
  assert.equal(compatCalls, 1);
  assert.equal(claim.state.calls, 1);
  assert.equal(report.durableAuthorityClaimed, true);
  assert.equal(report.authorityConsumed, true);
  // Batch may fail after claim (single-row adapters); claim must still have run.
  assert.ok(report.failReason !== "prepare_contract_preclaim_failed");
});

test("D3 production preclaim PASS under Production contract", async () => {
  resetAuthorityConsumptionForTests();
  const batchId = crypto.randomUUID();
  const identities = makeProdEight();
  const files = writePackage(identities, batchId, OPERATION_TARGET_MODE.PRODUCTION);
  const created = createFreshAuthorizationBinding({
    operationTargetMode: OPERATION_TARGET_MODE.PRODUCTION,
    ownerProductionGo: "OWNER_PRODUCTION_GO_LABEL_CONTRACT_PASS",
    expectedBatchId: batchId,
    allowlistSha256: files.alSha,
    snapshotSha256: files.snSha,
    productionProjectRef: EXPECTED_PRODUCTION_PROJECT_REF,
    explicitExecuteConfirmation: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  assert.equal(created.ok, true, String(created.reasons || []));
  const binding = created.binding;
  const claim = claimerSpy();
  const report = await runB1BExecute(
    {
      DRY_RUN: "false",
      OPERATION_TARGET_MODE: "production",
      PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
      OPERATION_B1B_BATCH_ID: batchId,
      ALLOWLIST_PATH: files.alPath,
      ALLOWLIST_SHA256: files.alSha,
      RECOVERY_SNAPSHOT_PATH: files.snPath,
      SNAPSHOT_SHA256: files.snSha,
      OWNER_PRODUCTION_GO: "OWNER_PRODUCTION_GO_LABEL_CONTRACT_PASS",
      EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
      freshAuthorizationBinding: binding,
    },
    {
      repoRoots: [root],
      claimOneTimeLiveAuthority: claim,
      adapters: {
        validateQaPrepareContract: async () => ({
          ok: true,
          data: {
            ok: true,
            code: "prepare_contract_compatible",
            environment: "production",
          },
        }),
        fetchAuthUser: async () => null,
        fetchProfile: async () => null,
        fetchReferenceCounts: async () => zeroRefs(),
        fetchAuthBanState: async () => false,
        qaQuarantinePrepare: async () => ({
          ok: false,
          reason: "stop_after_claim",
        }),
      },
    }
  );
  assert.equal(claim.state.calls, 1);
  assert.equal(report.durableAuthorityClaimed, true);
});

test("D4 incident regression: STG-QA-04 package contract PASS (JS)", () => {
  const binding = validateCertifiedQaLabelBinding({
    operationTargetMode: "staging_rehearsal",
    label: "STG-QA-04",
    expectedEmail: "phase1c.stg.safe1@staging-qa.local",
  });
  assert.equal(binding.ok, true);
  const doc = validateAllowlistDocument(
    {
      operation: OPERATION_ID,
      operation_target_mode: "staging_rehearsal",
      staging_project_ref: EXPECTED_STAGING_PROJECT_REF,
      target_count: 8,
      identities: makeStgEight(),
    },
    { operationTargetMode: "staging_rehearsal" }
  );
  assert.equal(doc.ok, true);
  assert.equal(doc.identities[0].label, "STG-QA-04");
});
