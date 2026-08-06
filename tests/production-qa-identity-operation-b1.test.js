/**
 * Operation B1 package — focused automated tests (no Production I/O).
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isCertifiedQaEmail,
  isConfirmedQaTestIdentity,
} from "../src/features/player/utils/qaTestIdentityFilter.js";
import {
  quarantineProductionSmokeUsers,
  resolveAuthUserEmailForQuarantine,
} from "../scripts/lib/prod-smoke-identity-hygiene.mjs";
import {
  EXPECTED_B1_COUNT,
  EXPECTED_PRODUCTION_PROJECT_REF,
  FORBIDDEN_REAL_USER_EMAIL,
  REQUIRED_OWNER_PRODUCTION_GO,
  REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  B2_EXCLUDED_LABELS,
  evaluateAuthorization,
  mutationAllowed,
  validateAllowlistDocument,
  loadAndValidateAllowlistFile,
  sha256Hex,
  evaluateIdentityEligibility,
  quarantineOneIdentity,
  unquarantineOneIdentity,
  runBatchQuarantine,
  hardDeleteUnavailable,
  maskEmail,
  maskId,
} from "../scripts/operations/production-qa-identity-operation-b1/lib/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function uuid(n = 1) {
  // deterministic-ish UUIDs for tests
  const hex = String(n).padStart(12, "0");
  return `11111111-2222-4333-8444-${hex}`;
}

function makeEightIdentities(overrides = {}) {
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
      reference_counts: {
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
      },
      captured_at: "2026-08-06T00:00:00.000Z",
      production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
      ...overrides[i],
    });
  }
  return identities;
}

function makeAllowlistDoc(identities = makeEightIdentities()) {
  return {
    operation: "OPERATION_B1_REVERSIBLE_QA_QUARANTINE",
    production_project_ref: EXPECTED_PRODUCTION_PROJECT_REF,
    target_count: identities.length,
    identities,
  };
}

function writeTempAllowlist(doc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "op-b1-"));
  const file = path.join(dir, "allowlist.json");
  const json = `${JSON.stringify(doc, null, 2)}\n`;
  fs.writeFileSync(file, json, "utf8");
  return { file, sha: sha256Hex(json), dir };
}

test("canonical QA predicate acceptance", () => {
  assert.equal(
    isCertifiedQaEmail("phase1b-smoke-1@pickleball-scheduler.qa"),
    true
  );
  assert.equal(isCertifiedQaEmail("phase1c.prod.player.x@prod-qa.local"), true);
});

test("phase1b-smith@gmail.com rejection", () => {
  assert.equal(isCertifiedQaEmail(FORBIDDEN_REAL_USER_EMAIL), false);
  assert.equal(
    isConfirmedQaTestIdentity({ email: FORBIDDEN_REAL_USER_EMAIL }),
    false
  );
});

test("missing / non-QA / mismatched email rejection paths", async () => {
  const row = makeEightIdentities()[0];
  const missing = await evaluateIdentityEligibility(row, {
    admin: {
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: { id: row.auth_user_id } }, error: null }),
        },
      },
    },
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.reasons.includes("email_absent"));

  const nonQa = await evaluateIdentityEligibility(row, {
    admin: {
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { id: row.auth_user_id, email: "real@gmail.com" } },
            error: null,
          }),
        },
      },
    },
  });
  assert.equal(nonQa.ok, false);
  assert.ok(nonQa.reasons.includes("email_not_certified_qa"));

  const mismatch = await evaluateIdentityEligibility(
    { ...row, expected_email: "phase1c.prod.other@prod-qa.local" },
    {
      admin: {
        auth: {
          admin: {
            getUserById: async () => ({
              data: {
                user: { id: row.auth_user_id, email: row.expected_email },
              },
              error: null,
            }),
          },
        },
      },
      fetchProfile: async () => ({
        id: row.profile_id,
        email: row.expected_email,
        status: "active",
      }),
      fetchReferenceCounts: async () => row.reference_counts,
    }
  );
  assert.equal(mismatch.ok, false);
  assert.ok(mismatch.reasons.includes("email_mismatch_vs_allowlist"));
});

test("Auth-ID-only cannot authorize quarantine", async () => {
  const row = makeEightIdentities()[0];
  const result = await evaluateIdentityEligibility(row, {
    // no admin email resolution
    admin: {},
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.reasons.includes("auth_lookup_unavailable") ||
      result.reasons.includes("email_absent")
  );
});

test("ambiguous auth/profile mapping rejection", async () => {
  const row = makeEightIdentities()[0];
  row.profile_id = uuid(99);
  const result = await evaluateIdentityEligibility(row, {
    emailOverrides: { [row.auth_user_id]: row.expected_email },
  });
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes("ambiguous_auth_profile_mapping"));
});

test("allowlist count not equal to 8 / duplicates / wrong project / bad checksum", () => {
  const seven = makeEightIdentities().slice(0, 7);
  const badCount = validateAllowlistDocument(makeAllowlistDoc(seven));
  assert.equal(badCount.ok, false);
  assert.ok(badCount.errors.includes("identity_array_length_not_eight"));

  const dup = makeEightIdentities();
  dup[1].auth_user_id = dup[0].auth_user_id;
  dup[1].profile_id = dup[0].profile_id;
  const badDup = validateAllowlistDocument(makeAllowlistDoc(dup));
  assert.equal(badDup.ok, false);
  assert.ok(badDup.errors.includes("duplicate_auth_user_id"));

  const wrongProject = makeAllowlistDoc();
  wrongProject.production_project_ref = "staging-ref";
  assert.equal(validateAllowlistDocument(wrongProject).ok, false);

  const { file, sha, dir } = writeTempAllowlist(makeAllowlistDoc());
  const badSha = loadAndValidateAllowlistFile(file, "0".repeat(64), {
    repoRoots: [root],
  });
  assert.equal(badSha.ok, false);
  assert.ok(badSha.errors.includes("allowlist_sha256_mismatch"));
  const good = loadAndValidateAllowlistFile(file, sha, { repoRoots: [root] });
  assert.equal(good.ok, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("QA-01/02/03 exclusion and smith forbidden in allowlist", () => {
  for (const label of B2_EXCLUDED_LABELS) {
    const identities = makeEightIdentities();
    identities[0].label = label;
    const v = validateAllowlistDocument(makeAllowlistDoc(identities));
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.startsWith("b2_excluded_label_present")));
  }
  const identities = makeEightIdentities();
  identities[0].expected_email = FORBIDDEN_REAL_USER_EMAIL;
  const v = validateAllowlistDocument(makeAllowlistDoc(identities));
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes("forbidden_real_user_email"));
});

test("new tenant_staff / historical membership / athlete drift blocks", async () => {
  const row = makeEightIdentities()[0];
  const baseAdapters = {
    emailOverrides: { [row.auth_user_id]: row.expected_email },
    fetchProfile: async () => ({
      id: row.profile_id,
      email: row.expected_email,
      status: "active",
    }),
  };

  const tenant = await evaluateIdentityEligibility(row, {
    ...baseAdapters,
    fetchReferenceCounts: async () => ({
      ...row.reference_counts,
      tenant_members: 1,
    }),
  });
  assert.equal(tenant.ok, false);
  assert.ok(tenant.reasons.includes("business_reference_present"));

  const hist = await evaluateIdentityEligibility(row, {
    ...baseAdapters,
    fetchReferenceCounts: async () => ({
      ...row.reference_counts,
      membership_removed: 1,
      membership_total: 1,
    }),
  });
  assert.equal(hist.ok, false);

  const athlete = await evaluateIdentityEligibility(row, {
    ...baseAdapters,
    fetchReferenceCounts: async () => ({
      ...row.reference_counts,
      athlete_count: 1,
    }),
  });
  assert.equal(athlete.ok, false);
});

test("dry-run and rejected preflight perform zero mutation calls", async () => {
  let profileWrites = 0;
  let banWrites = 0;
  const row = makeEightIdentities()[0];
  const adapters = {
    emailOverrides: { [row.auth_user_id]: row.expected_email },
    fetchProfile: async () => ({
      id: row.profile_id,
      email: row.expected_email,
      status: "active",
    }),
    fetchReferenceCounts: async () => row.reference_counts,
    fetchAuthBanState: async () => false,
    updateProfileStatus: async () => {
      profileWrites += 1;
      return { ok: true };
    },
    banAuthUser: async () => {
      banWrites += 1;
      return { ok: true };
    },
  };

  const dryAuth = evaluateAuthorization({
    DRY_RUN: "true",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: "8b9fa2d4-46a2-4f82-b385-21a7628adb3b",
    ALLOWLIST_PATH: "C:\\Users\\Le Phong\\Documents\\PICK_VN-Secure-Backups\\Operation-B1\\x.json",
    ALLOWLIST_SHA256: "a".repeat(64),
  });
  assert.equal(dryAuth.dryRun, true);
  assert.equal(mutationAllowed(dryAuth), false);

  const dryOne = await quarantineOneIdentity({
    allowlistRow: row,
    adapters,
    authResult: dryAuth,
    dryRun: true,
  });
  assert.equal(dryOne.ok, true);
  assert.equal(dryOne.mutations, 0);
  assert.equal(profileWrites, 0);
  assert.equal(banWrites, 0);

  const rejected = await quarantineOneIdentity({
    allowlistRow: row,
    adapters: {
      ...adapters,
      fetchReferenceCounts: async () => ({
        ...row.reference_counts,
        athlete_count: 1,
      }),
    },
    authResult: dryAuth,
    dryRun: false,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.mutations, 0);
  assert.equal(profileWrites, 0);
});

test("missing Owner GO / malformed batch ID block mutations", () => {
  const missingGo = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: "8b9fa2d4-46a2-4f82-b385-21a7628adb3b",
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "b".repeat(64),
    OWNER_PRODUCTION_GO: "WRONG",
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  assert.equal(mutationAllowed(missingGo), false);
  assert.ok(
    missingGo.reasons.includes("missing_or_invalid_owner_production_go")
  );

  const badBatch = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: "not-a-uuid",
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "b".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  assert.equal(mutationAllowed(badBatch), false);
  assert.ok(badBatch.reasons.includes("malformed_or_missing_batch_id"));
});

test("hard delete unavailable; partial failure compensates", async () => {
  assert.equal(hardDeleteUnavailable().available, false);

  const row = makeEightIdentities()[0];
  let profileStatus = "active";
  let banOk = false;
  const auth = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: "8b9fa2d4-46a2-4f82-b385-21a7628adb3b",
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "c".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  assert.equal(mutationAllowed(auth), true);

  const result = await quarantineOneIdentity({
    allowlistRow: row,
    authResult: auth,
    dryRun: false,
    adapters: {
      emailOverrides: { [row.auth_user_id]: row.expected_email },
      fetchProfile: async () => ({
        id: row.profile_id,
        email: row.expected_email,
        status: profileStatus,
      }),
      fetchReferenceCounts: async () => row.reference_counts,
      fetchAuthBanState: async () => false,
      updateProfileStatus: async ({ status }) => {
        profileStatus = status;
        return { ok: true };
      },
      banAuthUser: async () => {
        banOk = false;
        return { ok: false, reason: "auth_ban_failed_simulated" };
      },
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.compensated, true);
  assert.equal(profileStatus, "active");
  assert.equal(banOk, false);
});

test("rollback refuses post-quarantine drift; idempotent execute/rollback", async () => {
  const row = makeEightIdentities()[0];
  const auth = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: "8b9fa2d4-46a2-4f82-b385-21a7628adb3b",
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "d".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });

  const drift = await unquarantineOneIdentity({
    snapshotRow: {
      ...row,
      original_profile_status: "active",
      original_auth_banned: false,
      email: row.expected_email,
    },
    authResult: auth,
    dryRun: false,
    adapters: {
      fetchProfile: async () => ({
        id: row.profile_id,
        email: row.expected_email,
        status: "disabled_by_someone_else",
      }),
      fetchAuthBanState: async () => true,
    },
  });
  assert.equal(drift.ok, false);
  assert.equal(drift.abortReason, "post_quarantine_profile_drift");

  let status = "quarantined";
  let banned = true;
  const adapters = {
    emailOverrides: { [row.auth_user_id]: row.expected_email },
    fetchProfile: async () => ({
      id: row.profile_id,
      email: row.expected_email,
      status,
    }),
    fetchReferenceCounts: async () => row.reference_counts,
    fetchAuthBanState: async () => banned,
    updateProfileStatus: async ({ status: next }) => {
      status = next;
      return { ok: true };
    },
    banAuthUser: async () => {
      banned = true;
      return { ok: true };
    },
    unbanAuthUser: async () => {
      banned = false;
      return { ok: true };
    },
  };

  // First quarantine from active
  status = "active";
  banned = false;
  const first = await quarantineOneIdentity({
    allowlistRow: row,
    adapters,
    authResult: auth,
    dryRun: false,
  });
  assert.equal(first.ok, true);
  assert.equal(status, "quarantined");
  assert.equal(banned, true);

  // Idempotent re-run
  const second = await quarantineOneIdentity({
    allowlistRow: row,
    adapters,
    authResult: auth,
    dryRun: false,
  });
  assert.equal(second.ok, true);
  assert.equal(second.profile, "already_quarantined");
  assert.equal(second.ban, "already_banned");

  const snap = {
    ...row,
    original_profile_status: "active",
    original_auth_banned: false,
    email: row.expected_email,
  };
  const rb1 = await unquarantineOneIdentity({
    snapshotRow: snap,
    adapters,
    authResult: auth,
    dryRun: false,
  });
  assert.equal(rb1.ok, true);
  assert.equal(status, "active");
  assert.equal(banned, false);

  const rb2 = await unquarantineOneIdentity({
    snapshotRow: snap,
    adapters,
    authResult: auth,
    dryRun: false,
  });
  assert.equal(rb2.ok, true);
  assert.equal(rb2.profile, "already_restored");
});

test("terminal masking hides full emails and ids", () => {
  const email = maskEmail("phase1c.prod.player@prod-qa.local");
  assert.equal(email.includes("phase1c.prod.player"), false);
  assert.ok(email.includes("@prod-qa.local"));
  const id = maskId("11111111-2222-4333-8444-000000000001");
  assert.equal(id.includes("8444-000000000001"), false);
  assert.ok(id.startsWith("11111111"));
});

test("smoke hygiene adjacent — Auth rejection / dry-run zero mutations", async () => {
  const calls = { update: 0, ban: 0 };
  const admin = {
    auth: {
      admin: {
        getUserById: async (id) => ({
          data: { user: { id, email: FORBIDDEN_REAL_USER_EMAIL } },
          error: null,
        }),
        updateUserById: async () => {
          calls.ban += 1;
          return { data: {}, error: null };
        },
      },
    },
    from() {
      return {
        update() {
          return {
            eq() {
              return {
                eq: async () => {
                  calls.update += 1;
                  return { error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  const aborted = await quarantineProductionSmokeUsers({
    admin,
    userIds: [uuid(1)],
    dryRun: false,
  });
  assert.equal(aborted[0].aborted, true);
  assert.equal(calls.update, 0);
  assert.equal(calls.ban, 0);

  const dry = await quarantineProductionSmokeUsers({
    admin: {
      auth: {
        admin: {
          getUserById: async (id) => ({
            data: {
              user: { id, email: "phase1b-smoke-x@pickleball-scheduler.qa" },
            },
            error: null,
          }),
          updateUserById: async () => {
            calls.ban += 1;
            return { data: {}, error: null };
          },
        },
      },
    },
    userIds: [uuid(2)],
    dryRun: true,
  });
  assert.equal(dry[0].dryRun, true);
  assert.equal(calls.ban, 0);

  const resolved = await resolveAuthUserEmailForQuarantine({
    userId: uuid(3),
    emailOverride: "phase1c.prod.player.x@prod-qa.local",
  });
  assert.equal(isCertifiedQaEmail(resolved.email), true);
});

test("batch runner stops after first live failure", async () => {
  const identities = makeEightIdentities();
  let updates = 0;
  const auth = evaluateAuthorization({
    DRY_RUN: "false",
    PRODUCTION_PROJECT_REF: EXPECTED_PRODUCTION_PROJECT_REF,
    OPERATION_B1_BATCH_ID: "8b9fa2d4-46a2-4f82-b385-21a7628adb3b",
    ALLOWLIST_PATH: "C:\\tmp\\a.json",
    ALLOWLIST_SHA256: "e".repeat(64),
    OWNER_PRODUCTION_GO: REQUIRED_OWNER_PRODUCTION_GO,
    EXPLICIT_EXECUTE_CONFIRMATION: REQUIRED_EXPLICIT_EXECUTE_CONFIRMATION,
  });
  const batch = await runBatchQuarantine({
    identities,
    authResult: auth,
    adapters: {
      emailOverrides: Object.fromEntries(
        identities.map((r) => [r.auth_user_id, r.expected_email])
      ),
      fetchProfile: async (id) => ({
        id,
        email: identities.find((r) => r.profile_id === id).expected_email,
        status: "active",
      }),
      fetchReferenceCounts: async () => identities[0].reference_counts,
      fetchAuthBanState: async () => false,
      updateProfileStatus: async () => {
        updates += 1;
        if (updates === 1) return { ok: true };
        return { ok: false, reason: "stop" };
      },
      banAuthUser: async () => ({ ok: false, reason: "ban_fail" }),
    },
  });
  assert.equal(batch.ok, false);
  assert.ok(batch.results.length < EXPECTED_B1_COUNT);
});

test("EXPECTED_B1_COUNT is exactly 8", () => {
  assert.equal(EXPECTED_B1_COUNT, 8);
});
