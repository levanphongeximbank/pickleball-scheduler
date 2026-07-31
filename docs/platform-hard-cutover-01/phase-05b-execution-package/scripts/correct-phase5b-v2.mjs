/**
 * Phase 5B V2 integrity correction — regenerate manifests/evidence/verifier inputs.
 * No database / network access.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");
const ROOT = path.resolve(PKG, "../../..");
const generatedAt = new Date().toISOString();

const TT5D = [
  "190_TT5D_ASSIGNMENT_SAFETY.sql",
  "200_TT5D_REOPEN_RESULT.sql",
  "210_TT5D_CORRECTION.sql",
  "220_TT5D_SECURITY_GUARDS.sql",
];

function writeJson(fp, obj) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function sha256Buf(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}

function gitBlobBytes(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  for (const spec of [`:${norm}`, `HEAD:${norm}`]) {
    const r = spawnSync("git", ["rev-parse", "--verify", "--quiet", spec], {
      cwd: ROOT,
      encoding: "utf8",
    });
    if (r.status !== 0) continue;
    const oid = r.stdout.trim();
    if (!oid) continue;
    const blob = spawnSync("git", ["cat-file", "blob", oid], { cwd: ROOT, encoding: "buffer" });
    if (blob.status !== 0) continue;
    const bytes = blob.stdout;
    return {
      oid,
      bytes,
      sha256ExactGitBlobBytes: sha256Buf(bytes),
      sha256CanonicalLf: sha256Buf(Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8")),
      source: spec.startsWith(":") ? "INDEX" : "HEAD",
    };
  }
  const abs = path.join(ROOT, norm);
  if (!fs.existsSync(abs)) throw new Error(`missing ${relPath}`);
  const buf = fs.readFileSync(abs);
  return {
    oid: null,
    bytes: buf,
    sha256ExactGitBlobBytes: sha256Buf(buf),
    sha256CanonicalLf: sha256Buf(Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8")),
    source: "WORKING_TREE_EXACT_BYTES",
  };
}

function hashPath(relPath) {
  return gitBlobBytes(relPath);
}

function listApplySql(dirAbs, { excludeNames = [] } = {}) {
  return fs
    .readdirSync(dirAbs)
    .filter((n) => n.endsWith(".sql"))
    .filter((n) => !/^90_/.test(n) && !/^99_/.test(n))
    .filter((n) => !/\.verify\.sql$/i.test(n))
    .filter((n) => !excludeNames.includes(n))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
}

const M9_DIR = path.join(PKG, "sql/m9-team-tournament");
const M10_DIR = path.join(PKG, "sql/m10-referee-v5");
const M11_DIR = path.join(PKG, "sql/m11-private-pairing-digest");

const m9AllSql = listApplySql(M9_DIR);
const m9Executable = m9AllSql.filter((n) => !TT5D.includes(n));
const m10Executable = listApplySql(M10_DIR);
const m11Reference = ["10_PRIVATE_PAIRING_DIGEST.sql"];

const M9_SOURCE = {
  "10_TT2B_LINEUP_DEADLINE.sql": "docs/v5/PHASE_TT2B_LINEUP_DEADLINE_SERVER_TIME.sql",
  "20_TT2C_LINEUP_VALIDATION.sql": "docs/v5/PHASE_TT2C_LINEUP_VALIDATION.sql",
  "30_TT2C_SUBMIT_LINEUP_VALIDATION.sql": "docs/v5/PHASE_TT2C_SUBMIT_LINEUP_VALIDATION.sql",
  "40_TT2D_RANDOMIZE_LOCK.sql": "docs/v5/PHASE_TT2D_RANDOMIZE_LOCK_WORKFLOW.sql",
  "50_TT2E_ATOMIC_PUBLISH.sql": "docs/v5/PHASE_TT2E_ATOMIC_PUBLISH_WORKFLOW.sql",
  "60_TT2E_GET_SETUP_FIX.sql": "docs/v5/PHASE_TT2E_GET_SETUP_FIX.sql",
  "70_TT3_LINEUP_OVERRIDE.sql": "docs/v5/PHASE_TT3_LINEUP_OVERRIDE.sql",
  "80_TT3_GET_SETUP_PATCH.sql": "docs/v5/PHASE_TT3_GET_SETUP_PATCH.sql",
  "85_TT4_FORFEIT_WITHDRAWAL.sql": "docs/v5/PHASE_TT4_FORFEIT_WITHDRAWAL.sql",
  "100_TT4_GET_SETUP_PATCH.sql": "docs/v5/PHASE_TT4_GET_SETUP_PATCH.sql",
  "110_TT5B_BRIDGE_SCHEMA.sql": "docs/v5/team-tournament/tt5/TT5-B_BRIDGE_SCHEMA.sql",
  "120_TT5B_PROVISION_RPC.sql": "docs/v5/team-tournament/tt5/TT5-B_PROVISION_RPC.sql",
  "130_TT5B_LEGACY_LOCK_GUARD.sql": "docs/v5/team-tournament/tt5/TT5-B_LEGACY_LOCK_GUARD.sql",
  "140_TT5B_GET_SETUP_PATCH.sql": "docs/v5/team-tournament/tt5/TT5-B_GET_SETUP_PATCH.sql",
  "150_TT5C_RESULT_OUTBOX.sql": "docs/v5/team-tournament/tt5/TT5-C_RESULT_OUTBOX_CONSUMER.sql",
  "160_TT5C_RESULT_PROPAGATION.sql": "docs/v5/team-tournament/tt5/TT5-C_RESULT_PROPAGATION.sql",
  "170_TT5C_STANDINGS_RECOMPUTE.sql": "docs/v5/team-tournament/tt5/TT5-C_STANDINGS_RECOMPUTE.sql",
  "180_TT5C_REPROVISION.sql": "docs/v5/team-tournament/tt5/TT5-C_REPROVISION_STATE.sql",
  "190_TT5D_ASSIGNMENT_SAFETY.sql": "docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql",
  "200_TT5D_REOPEN_RESULT.sql": "docs/v5/team-tournament/tt5/TT5-D_REOPEN_RESULT_REVISION.sql",
  "210_TT5D_CORRECTION.sql": "docs/v5/team-tournament/tt5/TT5-D_CORRECTION_WORKFLOW.sql",
  "220_TT5D_SECURITY_GUARDS.sql": "docs/v5/team-tournament/tt5/TT5-D_SECURITY_GUARDS.sql",
  "230_TT6B_REALTIME_SECURITY.sql": "docs/v5/team-tournament/tt6/TT6-B_REALTIME_SECURITY.sql",
  "240_TT6B_REALTIME_CORE.sql": "docs/v5/team-tournament/tt6/TT6-B_REALTIME_CORE.sql",
};

const M10_SOURCE = {
  "10_V5A_REFEREE_FOUNDATION.sql": "docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql",
  "20_V5D_REFEREE_PERSISTENCE.sql": "docs/v5/referee-v5/PHASE_V5D_REFEREE_PERSISTENCE.sql",
  "30_V5D1_REFEREE_HARDENING.sql": "docs/v5/referee-v5/PHASE_V5D1_REFEREE_HARDENING.sql",
  "40_V5D32_IDEMPOTENCY_UNDO.sql": "docs/v5/referee-v5/PHASE_V5D32_IDEMPOTENCY_UNDO.sql",
};

function pkgRel(familyDir, name) {
  return `docs/platform-hard-cutover-01/phase-05b-execution-package/sql/${familyDir}/${name}`;
}

function fileRecord(rel) {
  const h = hashPath(rel);
  return {
    path: rel.replace(/\\/g, "/"),
    sha256ExactGitBlobBytes: h.sha256ExactGitBlobBytes,
    sha256CanonicalLf: h.sha256CanonicalLf,
    gitBlobOid: h.oid,
    hashSource: h.source,
  };
}

// --- Build M9/M10/M11 family artefacts ---
function buildM9() {
  const artefacts = [];
  for (const name of m9AllSql) {
    const rel = pkgRel("m9-team-tournament", name);
    const h = hashPath(rel);
    const src = M9_SOURCE[name];
    const srcH = src ? hashPath(src) : null;
    const isTt5d = TT5D.includes(name);
    artefacts.push({
      applyFile: rel,
      order: parseInt(name, 10),
      sourcePath: src,
      sha256ExactGitBlobBytes: h.sha256ExactGitBlobBytes,
      sha256CanonicalLf: h.sha256CanonicalLf,
      sourceSha256ExactGitBlobBytes: srcH?.sha256ExactGitBlobBytes || null,
      bytesMatchSourceExact: srcH ? srcH.sha256ExactGitBlobBytes === h.sha256ExactGitBlobBytes : null,
      executionEligible: !isTt5d,
      classification: isTt5d
        ? "NON_EXECUTABLE_CANDIDATE_PENDING_STAGING_CERTIFICATION"
        : "EXECUTABLE_CANDIDATE",
      dependsOnM10: parseInt(name, 10) >= 110,
    });
  }
  return artefacts;
}

function buildM10() {
  return m10Executable.map((name) => {
    const rel = pkgRel("m10-referee-v5", name);
    const h = hashPath(rel);
    const src = M10_SOURCE[name];
    const srcH = hashPath(src);
    return {
      applyFile: rel,
      order: parseInt(name, 10),
      sourcePath: src,
      sha256ExactGitBlobBytes: h.sha256ExactGitBlobBytes,
      sha256CanonicalLf: h.sha256CanonicalLf,
      sourceSha256ExactGitBlobBytes: srcH.sha256ExactGitBlobBytes,
      bytesMatchSourceExact: srcH.sha256ExactGitBlobBytes === h.sha256ExactGitBlobBytes,
      executionEligible: true,
      classification: "EXECUTABLE_CANDIDATE",
    };
  });
}

const m9Artefacts = buildM9();
const m10Artefacts = buildM10();
const m11ApplyRel = pkgRel("m11-private-pairing-digest", "10_PRIVATE_PAIRING_DIGEST.sql");
const m11ApplyH = hashPath(m11ApplyRel);
const m9Verify = fileRecord(pkgRel("m9-team-tournament", "99_VERIFY.sql"));
const m9Rollback = fileRecord(pkgRel("m9-team-tournament", "90_ROLLBACK.sql"));
const m10Verify = fileRecord(pkgRel("m10-referee-v5", "99_VERIFY.sql"));
const m10Rollback = fileRecord(pkgRel("m10-referee-v5", "90_ROLLBACK.sql"));
const m11Verify = fileRecord(pkgRel("m11-private-pairing-digest", "99_VERIFY.sql"));
const m11Rollback = fileRecord(pkgRel("m11-private-pairing-digest", "90_ROLLBACK.sql"));

const m9Exec = m9Artefacts.filter((a) => a.executionEligible);
const m9NonExec = m9Artefacts.filter((a) => !a.executionEligible);

// --- Family manifests ---
const m9Manifest = {
  family: "M9",
  packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/",
  readiness: "BLOCKED_STAGING_CATALOG_NOT_PROVEN_FOR_TT5D",
  productionExecutionGo: false,
  sqlApplied: false,
  generatedAt,
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  orderedApply: m9Exec.map((a) => ({
    order: a.order,
    file: path.basename(a.applyFile),
    path: a.applyFile,
    sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
    sha256CanonicalLf: a.sha256CanonicalLf,
    sourcePath: a.sourcePath,
    executionEligible: true,
    dependsOnM10: a.dependsOnM10,
  })),
  nonExecutionCandidates: m9NonExec.map((a) => ({
    order: a.order,
    file: path.basename(a.applyFile),
    path: a.applyFile,
    sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
    sha256CanonicalLf: a.sha256CanonicalLf,
    sourcePath: a.sourcePath,
    executionEligible: false,
    classification: "NON_EXECUTABLE_CANDIDATE_PENDING_STAGING_CERTIFICATION",
  })),
  executableApplyCount: m9Exec.length,
  nonExecutableCandidateCount: m9NonExec.length,
  verify: m9Verify,
  rollback: {
    ...m9Rollback,
    classification: "ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS",
    afterReplaceRecovery: "BACKUP_PITR_ONLY_AFTER_REPLACE",
  },
  interleaveNote:
    "TT5B+ executable files require M10 verified first. TT5D files are checksum-protected non-executable candidates only.",
};

const m10Manifest = {
  family: "M10",
  packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m10-referee-v5/",
  readiness: "READY",
  productionExecutionGo: false,
  sqlApplied: false,
  generatedAt,
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  orderedApply: m10Artefacts.map((a) => ({
    order: a.order,
    file: path.basename(a.applyFile),
    path: a.applyFile,
    sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
    sha256CanonicalLf: a.sha256CanonicalLf,
    sourcePath: a.sourcePath,
    executionEligible: true,
  })),
  nonExecutionCandidates: [],
  verify: m10Verify,
  rollback: {
    ...m10Rollback,
    classification: "DROP_M10_OWNED_V5_OBJECTS__LEGACY_TOKEN_RPCS_PRESERVED",
  },
  excludedStagingOnly: [
    "phase_v5d3_staging_fault_injection",
    "PHASE_V5D4_ATOMIC_ROLLBACK.sql",
    "PHASE_V5E1_REALTIME_SYNC.sql",
  ],
};

const m11Manifest = {
  family: "M11",
  packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m11-private-pairing-digest/",
  readiness: "READY_STAGING_CATALOG_DERIVED_ALREADY_EQUIVALENT_ON_PRODUCTION",
  productionExecutionGo: false,
  sqlApplied: false,
  generatedAt,
  provenanceClass: "STAGING_CATALOG_DERIVED",
  productionRunbookAction: "VERIFY_ONLY_ALREADY_EQUIVALENT",
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  orderedApply: [],
  referenceCandidates: [
    {
      order: 10,
      file: "10_PRIVATE_PAIRING_DIGEST.sql",
      path: m11ApplyRel,
      sha256ExactGitBlobBytes: m11ApplyH.sha256ExactGitBlobBytes,
      sha256CanonicalLf: m11ApplyH.sha256CanonicalLf,
      executionEligible: false,
      classification: "REFERENCE_CANDIDATE_ALREADY_EQUIVALENT_DO_NOT_APPLY",
      stagingMigration: "private_pairing_pr4_digest_patch",
    },
  ],
  nonExecutionCandidates: [
    {
      file: "10_PRIVATE_PAIRING_DIGEST.sql",
      path: m11ApplyRel,
      executionEligible: false,
      classification: "REFERENCE_CANDIDATE_ALREADY_EQUIVALENT_DO_NOT_APPLY",
    },
  ],
  verify: m11Verify,
  rollback: {
    ...m11Rollback,
    classification: "RESTORE_SAME_CATALOG_DERIVED_BODY__NOOP_WHEN_ALREADY_EQUIVALENT",
  },
  productionApplicability: "ALREADY_EQUIVALENT_VERIFY_ONLY",
};

writeJson(path.join(M9_DIR, "M9_MANIFEST.json"), m9Manifest);
writeJson(path.join(M10_DIR, "M10_MANIFEST.json"), m10Manifest);
writeJson(path.join(M11_DIR, "M11_MANIFEST.json"), m11Manifest);

writeJson(path.join(M9_DIR, "00_SOURCE_PROVENANCE.json"), {
  family: "M9",
  purpose: "Team Tournament remainder TT2B–TT6B",
  generatedAt,
  baseSha: "e3bdb55799f91b3e5d52f867d947de2aac12f52a",
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  mutationsExecuted: 0,
  sqlApplied: false,
  artefacts: m9Artefacts,
  executableOrderedApply: m9Exec.map((a) => path.basename(a.applyFile)),
  nonExecutionCandidates: m9NonExec.map((a) => ({
    file: path.basename(a.applyFile),
    classification: a.classification,
    executionEligible: false,
    sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
  })),
  rollbackClassification: "ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS",
  afterReplaceRecovery: "BACKUP_PITR_ONLY_AFTER_REPLACE",
  verifyArtefact: m9Verify.path,
  rollbackArtefact: m9Rollback.path,
  packageVerdict: "BLOCKED_STAGING_CATALOG_NOT_PROVEN_FOR_TT5D",
  blockers: [
    {
      objects: TT5D,
      reason:
        "Staging schema_migrations lacks tt5d_* rows and required TT5D catalog objects were absent; Production applicability not proven",
    },
  ],
});

writeJson(path.join(M10_DIR, "00_SOURCE_PROVENANCE.json"), {
  family: "M10",
  purpose: "Referee V5 foundation + persistence + hardening + idempotency undo",
  generatedAt,
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  artefacts: m10Artefacts,
  excluded: [
    { path: "docs/v5/referee-v5/PHASE_V5D4_ATOMIC_ROLLBACK.sql", reason: "STAGING_FAULT_INJECTION_APPLY" },
    { path: "docs/v5/referee-v5/PHASE_V5E1_REALTIME_SYNC.sql", reason: "STAGING_ONLY_PUBLICATION" },
    { name: "phase_v5d3_staging_fault_injection", reason: "STAGING_FAULT_INJECTION_ONLY" },
  ],
  legacyObjectsPreserved: [
    "referee_get_match_by_token(p_token text)",
    "referee_update_match_score(p_token text, p_payload jsonb)",
  ],
  rollbackClassification: "DROP_M10_OWNED_V5_OBJECTS__LEGACY_TOKEN_RPCS_PRESERVED",
  verifyArtefact: m10Verify.path,
  rollbackArtefact: m10Rollback.path,
  packageVerdict: "READY",
});

writeJson(path.join(M11_DIR, "00_SOURCE_PROVENANCE.json"), {
  family: "M11",
  purpose: "Private pairing digest patch",
  generatedAt,
  originalSqlFoundInGitHistory: false,
  provenanceClass: "STAGING_CATALOG_DERIVED",
  productionRunbookAction: "VERIFY_ONLY_ALREADY_EQUIVALENT",
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  stagingMigrationName: "private_pairing_pr4_digest_patch",
  productionMigrationPresent: "private_pairing_rc1_archive_rule_set_ONLY",
  catalogComparison: {
    function: "public.private_pairing_compute_rule_set_hash(p_rule_set_id uuid)",
    stagingDefMd5: "0be77671f95c52b1d5e00496bee2adf1",
    productionDefMd5: "0be77671f95c52b1d5e00496bee2adf1",
    liveDelta: "NONE_ALREADY_EQUIVALENT",
    bodyDigestCall: "extensions.digest(v_payload, 'sha256'::text)",
    searchPath: "public, pg_temp",
    securityDefiner: true,
  },
  referenceSql: {
    path: m11ApplyRel,
    sha256ExactGitBlobBytes: m11ApplyH.sha256ExactGitBlobBytes,
    sha256CanonicalLf: m11ApplyH.sha256CanonicalLf,
    executionEligible: false,
    classification: "REFERENCE_CANDIDATE_ALREADY_EQUIVALENT_DO_NOT_APPLY",
  },
  verifyArtefact: m11Verify.path,
  rollbackArtefact: m11Rollback.path,
  packageVerdict: "READY_STAGING_CATALOG_DERIVED_ALREADY_EQUIVALENT_ON_PRODUCTION",
});

// --- Exact M0–M8 paths ---
const M0 = {
  apply: [],
  verify: "docs/production-security/prod-sec-g3-b12-01/11_VERIFY.sql",
  rollback: "docs/production-security/prod-sec-g3-b12-01/90_ROLLBACK.sql",
  precheck: "docs/production-security/prod-sec-g3-b12-01/11_VERIFY.sql",
};
const M1_APPLY = [
  "docs/customer-management/phase-3/10_CUSTOMER_PHASE_3_TABLES.sql",
  "docs/customer-management/phase-3/20_CUSTOMER_PHASE_3_INDEXES.sql",
  "docs/customer-management/phase-3/30_CUSTOMER_PHASE_3_RLS.sql",
  "docs/customer-management/phase-3/40_CUSTOMER_PHASE_3_SAVE_RPC.sql",
  "docs/customer-management/phase-3/50_CUSTOMER_PHASE_3_GRANTS.sql",
];
const M1_VERIFY = "docs/customer-management/phase-3/99_CUSTOMER_PHASE_3_VERIFICATION.sql";
const M1_ROLLBACK = "docs/customer-management/phase-3/90_CUSTOMER_PHASE_3_ROLLBACK.sql";
const M2_APPLY = ["docs/supabase-finance-phase1f.sql"];
const M2_ROLLBACK = "docs/supabase-finance-phase1f-rollback.sql";
const M3_APPLY = [
  "docs/crm/phase-1g/10_CRM_PHASE_1G_TABLES.sql",
  "docs/crm/phase-1g/20_CRM_PHASE_1G_INDEXES.sql",
  "docs/crm/phase-1g/30_CRM_PHASE_1G_RLS.sql",
  "docs/crm/phase-1g/40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS.sql",
  "docs/crm/phase-1g/50_CRM_PHASE_1G_GRANTS.sql",
  "docs/crm/phase-1g/60_CRM_PHASE_1G_CONSENT_IMMUTABLE.sql",
  "docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql",
  "docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql",
];
const M3_VERIFY = "docs/crm/phase-1h-b/15_PRE_APPLY_OBJECT_STATE_CHECK.sql";
const M3_ROLLBACK = "docs/crm/phase-1h-b/14_CRM_PHASE_1H_B_STAGING_ROLLBACK.sql";
const M4_APPLY = [
  "docs/reporting-analytics/reporting-02/10_REPORTING_02_TABLES.sql",
  "docs/reporting-analytics/reporting-02/20_REPORTING_02_INDEXES.sql",
  "docs/reporting-analytics/reporting-02/30_REPORTING_02_RLS.sql",
  "docs/reporting-analytics/reporting-02/40_REPORTING_02_PERMISSION_SEED.sql",
  "docs/reporting-analytics/reporting-02/50_REPORTING_02_GRANTS.sql",
];
const M4_VERIFY = "docs/reporting-analytics/reporting-02/99_REPORTING_02_VERIFICATION.sql";
const M4_ROLLBACK = "docs/reporting-analytics/reporting-02/90_REPORTING_02_ROLLBACK.sql";
const M5_APPLY = [
  "docs/news-public-content/news-02/10_NEWS_PHASE_02_TABLES.sql",
  "docs/news-public-content/news-02/20_NEWS_PHASE_02_INDEXES.sql",
  "docs/news-public-content/news-02/30_NEWS_PHASE_02_RLS.sql",
  "docs/news-public-content/news-02/40_NEWS_PHASE_02_SAVE_RPC.sql",
  "docs/news-public-content/news-02/50_NEWS_PHASE_02_GRANTS.sql",
  "docs/news-public-content/news-02/60_NEWS_PHASE_02_IMMUTABLE_REVISIONS.sql",
  "docs/news-public-content/news-03/10_NEWS_PHASE_03_PERMISSION_SEED.sql",
  "docs/news-public-content/news-04/10_NEWS_PHASE_04_PUBLIC_RPC_LIVE_ONLY.sql",
];
const M5_VERIFY = [
  "docs/news-public-content/news-02/99_NEWS_PHASE_02_VERIFICATION.sql",
  "docs/news-public-content/news-03/99_NEWS_PHASE_03_PERMISSION_SEED_VERIFICATION.sql",
  "docs/news-public-content/news-04/99_NEWS_PHASE_04_PUBLIC_BOUNDARY_VERIFICATION.sql",
];
const M5_ROLLBACK = [
  "docs/news-public-content/news-02/90_NEWS_PHASE_02_ROLLBACK.sql",
  "docs/news-public-content/news-03/90_NEWS_PHASE_03_PERMISSION_SEED_ROLLBACK.sql",
];
const M6_APPLY = [
  "docs/coaching-training/coaching-02/10_COACHING_02_TABLES.sql",
  "docs/coaching-training/coaching-02/15_COACHING_02_PERMISSION_SEED.sql",
  "docs/coaching-training/coaching-02/20_COACHING_02_INDEXES.sql",
  "docs/coaching-training/coaching-02/30_COACHING_02_RLS.sql",
  "docs/coaching-training/coaching-02/40_COACHING_02_ATTENDANCE_CORRECTION_RPC.sql",
  "docs/coaching-training/coaching-02/45_COACHING_02_ENTITLEMENT_CONSUME_RPC.sql",
  "docs/coaching-training/coaching-02/50_COACHING_02_GRANTS.sql",
  "docs/coaching-training/coaching-02/60_COACHING_02_IMMUTABLE.sql",
  "docs/coaching-training/coaching-04/10_COACHING_04_ASSIGNMENT_HELPERS.sql",
  "docs/coaching-training/coaching-04/11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS.sql",
  "docs/coaching-training/coaching-04/20_COACHING_04_ASSIGNMENT_RLS.sql",
  "docs/coaching-training/coaching-04/21_COACHING_04_PLAYER_SELF_SCOPE_RLS.sql",
  "docs/coaching-training/coaching-04/30_COACHING_04_SCOPED_RPCS.sql",
  "docs/coaching-training/coaching-04/41_COACHING_04_HELPER_EXECUTE_ACL_HARDENING.sql",
];
const M6_VERIFY = [
  "docs/coaching-training/coaching-02/99_COACHING_02_VERIFICATION.sql",
  "docs/coaching-training/coaching-04/41_COACHING_04_HELPER_EXECUTE_ACL_HARDENING.verify.sql",
  "docs/coaching-training/coaching-04/99_COACHING_04_VERIFICATION.sql",
];
const M6_ROLLBACK = [
  "docs/coaching-training/coaching-02/90_COACHING_02_ROLLBACK.sql",
  "docs/coaching-training/coaching-04/90_COACHING_04_ROLLBACK.sql",
];
const M6_NON_EXEC = [
  "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql",
];
const M7_APPLY = [
  "docs/competition-core/supabase-cc02-rating-v2.sql",
  "docs/competition-core/supabase-cc02c-rating-durability.sql",
  "docs/competition-core/supabase-cc02d-staging-hardening.sql",
];
const M8_APPLY = [
  "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/10_TABLES.sql",
  "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/20_INDEXES.sql",
  "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/30_RLS.sql",
  "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/40_RPC_COMMAND_AND_FINALIZE.sql",
  "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/50_GRANTS.sql",
  "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/51_GRANTS_TIGHTEN.sql",
  "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/52_GRANTS_EXACT_BASELINE.sql",
];
const M8_VERIFY = "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/99_VERIFY.sql";
const M8_ROLLBACK = "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/90_ROLLBACK.sql";

function withHashes(paths) {
  return paths.map((p) => {
    const h = hashPath(p);
    return {
      path: p,
      sha256ExactGitBlobBytes: h.sha256ExactGitBlobBytes,
      sha256CanonicalLf: h.sha256CanonicalLf,
    };
  });
}

function familyBlock({
  family,
  purpose,
  productionClassification,
  packageReadiness,
  applyPaths,
  verifyPaths,
  rollbackPaths,
  irreversibility,
  dependencyFamilies,
  precheckPath,
  stopPoint,
  productionApplicability,
  extra = {},
}) {
  const apply = withHashes(applyPaths);
  const verify = withHashes(Array.isArray(verifyPaths) ? verifyPaths : verifyPaths ? [verifyPaths] : []);
  const rollback = irreversibility
    ? null
    : withHashes(Array.isArray(rollbackPaths) ? rollbackPaths : rollbackPaths ? [rollbackPaths] : []);
  return {
    family,
    purpose,
    productionClassification,
    packageReadiness,
    exactOrderedApplyFiles: apply,
    dependencyFamilies,
    exactPrecheckPath: precheckPath,
    exactVerificationArtefacts: verify,
    exactRollbackArtefacts: rollback,
    irreversibilityBoundary: irreversibility || null,
    stopPoint,
    productionApplicability,
    ...extra,
  };
}

const families = {
  M0: familyBlock({
    family: "M0",
    purpose: "G3-B12 club_ai_data anon write lockdown",
    productionClassification: "already_present_and_verified",
    packageReadiness: "VERIFY_ONLY",
    applyPaths: [],
    verifyPaths: M0.verify,
    rollbackPaths: M0.rollback,
    dependencyFamilies: [],
    precheckPath: M0.precheck,
    stopPoint: "after_M0_verify_before_M1",
    productionApplicability: "ALREADY_PRESENT",
    extra: {
      note: "Do not reopen anon policies; prefer leave-locked over executing 90_ROLLBACK.sql",
    },
  }),
  M1: familyBlock({
    family: "M1",
    purpose: "Customer",
    productionClassification: "missing",
    packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
    applyPaths: M1_APPLY,
    verifyPaths: M1_VERIFY,
    rollbackPaths: M1_ROLLBACK,
    dependencyFamilies: ["identity"],
    precheckPath: M1_VERIFY,
    stopPoint: "after_M1_verify",
    productionApplicability: "AUTHORED_PACKAGE",
  }),
  M2: familyBlock({
    family: "M2",
    purpose: "Finance",
    productionClassification: "missing",
    packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
    applyPaths: M2_APPLY,
    verifyPaths: [],
    rollbackPaths: M2_ROLLBACK,
    dependencyFamilies: ["RBAC_permissions"],
    precheckPath: M2_APPLY[0],
    stopPoint: "after_M2_catalog_verify",
    productionApplicability: "AUTHORED_PACKAGE",
    extra: {
      exactVerificationArtefacts: [],
      verificationBoundary:
        "NO_AUTHORED_99_VERIFY_SQL — STOP requires Owner SELECT/catalog verification of finance_* objects after apply; apply artefact remains docs/supabase-finance-phase1f.sql",
    },
  }),
  M3: familyBlock({
    family: "M3",
    purpose: "CRM",
    productionClassification: "missing",
    packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
    applyPaths: M3_APPLY,
    verifyPaths: M3_VERIFY,
    rollbackPaths: M3_ROLLBACK,
    dependencyFamilies: ["Customer_optional", "identity"],
    precheckPath: M3_VERIFY,
    stopPoint: "after_M3_verify",
    productionApplicability: "AUTHORED_PACKAGE",
  }),
  M4: familyBlock({
    family: "M4",
    purpose: "Reporting",
    productionClassification: "missing",
    packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
    applyPaths: M4_APPLY,
    verifyPaths: M4_VERIFY,
    rollbackPaths: [
      M4_ROLLBACK,
      "docs/reporting-analytics/reporting-02/91_REPORTING_02_PERMISSION_SEED_ROLLBACK.sql",
    ],
    dependencyFamilies: [],
    precheckPath: M4_VERIFY,
    stopPoint: "after_M4_verify",
    productionApplicability: "AUTHORED_PACKAGE",
  }),
  M5: familyBlock({
    family: "M5",
    purpose: "News",
    productionClassification: "missing",
    packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
    applyPaths: M5_APPLY,
    verifyPaths: M5_VERIFY,
    rollbackPaths: M5_ROLLBACK,
    dependencyFamilies: [],
    precheckPath: M5_VERIFY[0],
    stopPoint: "after_M5_verify",
    productionApplicability: "AUTHORED_PACKAGE",
  }),
  M6: familyBlock({
    family: "M6",
    purpose: "Coaching",
    productionClassification: "missing",
    packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
    applyPaths: M6_APPLY,
    verifyPaths: M6_VERIFY,
    rollbackPaths: M6_ROLLBACK,
    dependencyFamilies: ["Player", "Court"],
    precheckPath: M6_VERIFY[0],
    stopPoint: "after_M6_verify",
    productionApplicability: "AUTHORED_PACKAGE",
    extra: {
      nonExecutionCandidates: withHashes(M6_NON_EXEC).map((f) => ({
        ...f,
        executionEligible: false,
        classification: "PROPOSAL_ONLY_NOT_IN_EXECUTABLE_ORDER",
      })),
    },
  }),
  M7: familyBlock({
    family: "M7",
    purpose: "Competition Core cc02",
    productionClassification: "missing",
    packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
    applyPaths: M7_APPLY,
    verifyPaths: [],
    rollbackPaths: [],
    irreversibility: "IRREVERSIBLE_WITHOUT_BACKUP_RESTORE",
    dependencyFamilies: ["CORE_flag"],
    precheckPath: M7_APPLY[0],
    stopPoint: "after_M7_apply_catalog_check",
    productionApplicability: "AUTHORED_PACKAGE",
    extra: {
      exactVerificationArtefacts: [],
      verificationNote:
        "No authored 99_VERIFY.sql for cc02 package; STOP requires Owner catalog SELECT verification against expected player_ratings/rating_history objects before continuing",
    },
  }),
  M8: familyBlock({
    family: "M8",
    purpose: "Competition Remote SSOT",
    productionClassification: "missing",
    packageReadiness: "AUTHORED_PHASE4_NOT_REWRITTEN",
    applyPaths: M8_APPLY,
    verifyPaths: M8_VERIFY,
    rollbackPaths: M8_ROLLBACK,
    dependencyFamilies: ["identity_user_venue_id"],
    precheckPath: M8_VERIFY,
    stopPoint: "after_M8_verify",
    productionApplicability: "AUTHORED_PACKAGE",
    extra: {
      tenantContract: { tenant_id: "text", p_tenant_id: "text", user_venue_id_result: "text" },
    },
  }),
  M9: {
    family: "M9",
    purpose: "Team Tournament remainder TT2B–TT6B",
    productionClassification: "partially_present_p1_tt1b_only",
    packageReadiness: "BLOCKED_STAGING_CATALOG_NOT_PROVEN_FOR_TT5D",
    exactOrderedApplyFiles: m9Exec.map((a) => ({
      path: a.applyFile,
      sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
      sha256CanonicalLf: a.sha256CanonicalLf,
      executionEligible: true,
    })),
    nonExecutionCandidates: m9NonExec.map((a) => ({
      path: a.applyFile,
      sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
      sha256CanonicalLf: a.sha256CanonicalLf,
      executionEligible: false,
      classification: "NON_EXECUTABLE_CANDIDATE_PENDING_STAGING_CERTIFICATION",
    })),
    executableApplyCount: m9Exec.length,
    dependencyFamilies: ["M10_before_TT5B"],
    exactPrecheckPath: m9Verify.path,
    exactVerificationArtefacts: [m9Verify],
    exactRollbackArtefacts: [m9Rollback],
    irreversibilityBoundary: "BACKUP_PITR_ONLY_AFTER_REPLACE for CREATE OR REPLACE of pre-existing TT RPCs",
    rollbackClassification: "ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS",
    stopPoint: "after_M9_full_verify",
    productionApplicability: "BLOCKED_PENDING_TT5D_STAGING_PROOF",
  },
  M10: {
    family: "M10",
    purpose: "Referee V5",
    productionClassification: "missing_v5_legacy_token_rpcs_only",
    packageReadiness: "READY",
    exactOrderedApplyFiles: m10Artefacts.map((a) => ({
      path: a.applyFile,
      sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
      sha256CanonicalLf: a.sha256CanonicalLf,
      executionEligible: true,
    })),
    nonExecutionCandidates: [],
    dependencyFamilies: ["M8_preferred"],
    exactPrecheckPath: m10Verify.path,
    exactVerificationArtefacts: [m10Verify],
    exactRollbackArtefacts: [m10Rollback],
    irreversibilityBoundary: null,
    stopPoint: "after_M10_verify_before_M9B",
    productionApplicability: "PACKAGED_MISSING_ON_PRODUCTION",
  },
  M11: {
    family: "M11",
    purpose: "Private pairing digest",
    productionClassification: "rc1_present_digest_body_already_equivalent",
    packageReadiness: "READY_STAGING_CATALOG_DERIVED_ALREADY_EQUIVALENT_ON_PRODUCTION",
    productionRunbookAction: "VERIFY_ONLY_ALREADY_EQUIVALENT",
    exactOrderedApplyFiles: [],
    referenceCandidates: [
      {
        path: m11ApplyRel,
        sha256ExactGitBlobBytes: m11ApplyH.sha256ExactGitBlobBytes,
        sha256CanonicalLf: m11ApplyH.sha256CanonicalLf,
        executionEligible: false,
        classification: "REFERENCE_CANDIDATE_ALREADY_EQUIVALENT_DO_NOT_APPLY",
      },
    ],
    nonExecutionCandidates: [
      {
        path: m11ApplyRel,
        executionEligible: false,
        classification: "REFERENCE_CANDIDATE_ALREADY_EQUIVALENT_DO_NOT_APPLY",
      },
    ],
    dependencyFamilies: ["private_pairing_rc1_archive_rule_set"],
    exactPrecheckPath: m11Verify.path,
    exactVerificationArtefacts: [m11Verify],
    exactRollbackArtefacts: [m11Rollback],
    irreversibilityBoundary: null,
    stopPoint: "after_M11_verify_before_wipe",
    productionApplicability: "ALREADY_EQUIVALENT_VERIFY_ONLY",
    provenanceClass: "STAGING_CATALOG_DERIVED",
  },
};

const executionSequence = [
  {
    step: "M0",
    action: "VERIFY_ONLY",
    artefacts: [M0.verify],
  },
  {
    step: "M1",
    action: "APPLY_THEN_VERIFY",
    orderedApply: M1_APPLY,
    verify: [M1_VERIFY],
    rollback: [M1_ROLLBACK],
  },
  {
    step: "M2",
    action: "APPLY_THEN_CATALOG_VERIFY",
    orderedApply: M2_APPLY,
    verify: [],
    verificationBoundary:
      "NO_AUTHORED_99_VERIFY_SQL — Owner SELECT/catalog verification required",
    rollback: [M2_ROLLBACK],
  },
  {
    step: "M3",
    action: "APPLY_THEN_VERIFY",
    orderedApply: M3_APPLY,
    verify: [M3_VERIFY],
    rollback: [M3_ROLLBACK],
  },
  {
    step: "M4",
    action: "APPLY_THEN_VERIFY",
    orderedApply: M4_APPLY,
    verify: [M4_VERIFY],
    rollback: [
      M4_ROLLBACK,
      "docs/reporting-analytics/reporting-02/91_REPORTING_02_PERMISSION_SEED_ROLLBACK.sql",
    ],
  },
  {
    step: "M5",
    action: "APPLY_THEN_VERIFY",
    orderedApply: M5_APPLY,
    verify: M5_VERIFY,
    rollback: M5_ROLLBACK,
  },
  {
    step: "M6",
    action: "APPLY_THEN_VERIFY",
    orderedApply: M6_APPLY,
    verify: M6_VERIFY,
    rollback: M6_ROLLBACK,
    nonExecutionCandidates: M6_NON_EXEC,
  },
  {
    step: "M7",
    action: "APPLY_THEN_CATALOG_VERIFY",
    orderedApply: M7_APPLY,
    irreversibilityBoundary: "IRREVERSIBLE_WITHOUT_BACKUP_RESTORE",
  },
  {
    step: "M8",
    action: "APPLY_THEN_VERIFY",
    orderedApply: M8_APPLY,
    verify: [M8_VERIFY],
    rollback: [M8_ROLLBACK],
    tenantContract: { tenant_id: "text", p_tenant_id: "text", user_venue_id_result: "text" },
  },
  {
    step: "M9A_TT2B_TT4",
    action: "APPLY_THEN_VERIFY_PARTIAL",
    family: "M9",
    orderedApply: m9Exec.filter((a) => a.order <= 100).map((a) => a.applyFile),
    stopAfter: "family_partial_verify_TT2_TT4",
  },
  {
    step: "M10",
    action: "APPLY_THEN_VERIFY",
    family: "M10",
    orderedApply: m10Artefacts.map((a) => a.applyFile),
    verify: [m10Verify.path],
    rollback: [m10Rollback.path],
  },
  {
    step: "M9B_TT5B_TT5C_TT6B",
    action: "APPLY_THEN_VERIFY",
    family: "M9",
    precondition: "M10_VERIFY_PASS",
    orderedApply: m9Exec.filter((a) => a.order >= 110).map((a) => a.applyFile),
    nonExecutionCandidates: m9NonExec.map((a) => a.applyFile),
    verify: [m9Verify.path],
    rollback: [m9Rollback.path],
    note: "TT5D files MUST NOT appear in orderedApply",
  },
  {
    step: "M11",
    action: "VERIFY_ONLY_ALREADY_EQUIVALENT",
    family: "M11",
    orderedApply: [],
    verify: [m11Verify.path],
    referenceCandidates: [m11ApplyRel],
    stopIfLiveMetadataDiffers: true,
  },
];

const unified = {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_M0_M11_EXECUTION_MANIFEST",
  correction: "PHASE5B_V2_INTEGRITY",
  generatedAt,
  baseSha: "e3bdb55799f91b3e5d52f867d947de2aac12f52a",
  productionExecutionGo: false,
  executionRunbookAccepted: false,
  phase5Readiness: "BLOCKED_PHASE5_READINESS",
  phase05Complete: "NOT_ISSUED",
  phase5bDecision: "BLOCKED_PHASE5B_EXECUTION_PACKAGE",
  canonicalMigrationScope: "M0_TO_M11_ACCEPTED",
  club_ai_data: "PERMANENT_DROP_NO_RECREATE",
  backupPitrRestore: "NOT_PROVABLE",
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  mutationsExecuted: { staging: 0, production: 0 },
  sqlApplied: false,
  executionSequence,
  families,
};

writeJson(path.join(PKG, "M0_M11_EXECUTION_MANIFEST.json"), unified);

// Evidence
const evidenceDir = path.join(PKG, "evidence");
writeJson(path.join(evidenceDir, "01_M9_SOURCE_AND_PACKAGE_CERTIFICATION_2026-07-31.json"), {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_M9_CERT",
  correction: "PHASE5B_V2_INTEGRITY",
  generatedAt,
  family: "M9",
  verdict: "BLOCKED_STAGING_CATALOG_NOT_PROVEN_FOR_TT5D",
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  executableApplyCount: m9Exec.length,
  nonExecutableCandidateCount: m9NonExec.length,
  orderedExecutableApply: m9Exec.map((a) => ({
    file: path.basename(a.applyFile),
    sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
    sha256CanonicalLf: a.sha256CanonicalLf,
  })),
  nonExecutionCandidates: m9NonExec.map((a) => ({
    file: path.basename(a.applyFile),
    executionEligible: false,
    classification: "NON_EXECUTABLE_CANDIDATE_PENDING_STAGING_CERTIFICATION",
    sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
  })),
  rollbackClassification: "ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS",
  afterReplaceRecovery: "BACKUP_PITR_ONLY_AFTER_REPLACE",
  productionApplicability: "BLOCKED_PENDING_TT5D_STAGING_PROOF",
  mutationsExecuted: 0,
  sqlApplied: false,
  tt5dStagingActivationInThisCorrection: false,
});

writeJson(path.join(evidenceDir, "02_M10_SOURCE_AND_PACKAGE_CERTIFICATION_2026-07-31.json"), {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_M10_CERT",
  correction: "PHASE5B_V2_INTEGRITY",
  generatedAt,
  family: "M10",
  verdict: "READY",
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  orderedExecutableApply: m10Artefacts.map((a) => ({
    file: path.basename(a.applyFile),
    sha256ExactGitBlobBytes: a.sha256ExactGitBlobBytes,
    sha256CanonicalLf: a.sha256CanonicalLf,
  })),
  excluded: ["PHASE_V5D4", "PHASE_V5E1", "phase_v5d3_staging_fault_injection"],
  rollbackClassification: "DROP_M10_OWNED_V5_OBJECTS__LEGACY_TOKEN_RPCS_PRESERVED",
  mutationsExecuted: 0,
  sqlApplied: false,
});

writeJson(path.join(evidenceDir, "03_M11_SOURCE_AND_PACKAGE_CERTIFICATION_2026-07-31.json"), {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_M11_CERT",
  correction: "PHASE5B_V2_INTEGRITY",
  generatedAt,
  family: "M11",
  verdict: "READY_STAGING_CATALOG_DERIVED_ALREADY_EQUIVALENT_ON_PRODUCTION",
  productionRunbookAction: "VERIFY_ONLY_ALREADY_EQUIVALENT",
  provenanceClass: "STAGING_CATALOG_DERIVED",
  originalSqlFoundInGitHistory: false,
  stagingDefMd5: "0be77671f95c52b1d5e00496bee2adf1",
  productionDefMd5: "0be77671f95c52b1d5e00496bee2adf1",
  liveDelta: "NONE",
  referenceSql: {
    path: m11ApplyRel,
    sha256ExactGitBlobBytes: m11ApplyH.sha256ExactGitBlobBytes,
    sha256CanonicalLf: m11ApplyH.sha256CanonicalLf,
    executionEligible: false,
  },
  mutationsExecuted: 0,
  sqlApplied: false,
});

writeJson(path.join(evidenceDir, "04_M0_M11_ORDER_AND_CHECKSUM_CERTIFICATION_2026-07-31.json"), {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_ORDER_CHECKSUM_CERT",
  correction: "PHASE5B_V2_INTEGRITY",
  generatedAt,
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  secondaryField: "sha256CanonicalLf",
  conflictsCorrected: true,
  exampleCorrection: {
    file: "10_TT2B_LINEUP_DEADLINE.sql",
    priorWorkingTreeExactBytes: "777BFC77661AE1E18FFF442CB7B78F38EE6C724F17A7A9B1DDECF4A0053FC91B",
    priorCanonicalLfOrMismatchedField: "1E4429C77C32E7FF224FCFA167B9121767D3665F6AA1E6625203CF830C8A2A1F",
    sha256ExactGitBlobBytes: m9Artefacts.find((a) => a.order === 10).sha256ExactGitBlobBytes,
    sha256CanonicalLf: m9Artefacts.find((a) => a.order === 10).sha256CanonicalLf,
    note: "Authoritative value is git blob bytes; working-tree CRLF must not be labeled exact-byte",
  },
  executionSequenceSteps: executionSequence.map((s) => s.step),
  m11Action: "VERIFY_ONLY_ALREADY_EQUIVALENT",
  tt5dInExecutableOrder: false,
  m8TenantContractRetained: { tenant_id: "text", p_tenant_id: "text", user_venue_id_result: "text" },
  exactPathAudit: "PASS_NO_GLOBS_OR_RANGES_IN_FAMILY_ARTEFACTS",
  mutationsExecuted: 0,
});

writeJson(path.join(evidenceDir, "05_PHASE5B_DECISION_2026-07-31.json"), {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_DECISION",
  correction: "PHASE5B_V2_INTEGRITY",
  generatedAt,
  decision: "BLOCKED_PHASE5B_EXECUTION_PACKAGE",
  m9: "BLOCKED_STAGING_CATALOG_NOT_PROVEN_FOR_TT5D",
  m10: "READY",
  m11: "READY_STAGING_CATALOG_DERIVED_ALREADY_EQUIVALENT_ON_PRODUCTION",
  mandatoryBlockers: [
    "TT5D Staging activation/catalog certification not completed",
    "M9 Production applicability incomplete",
    "M9 replaced-function rollback incomplete (BACKUP_PITR_ONLY_AFTER_REPLACE)",
    "Production backup/PITR/restore remains NOT_PROVABLE",
    "executionRunbookAccepted=false",
    "productionExecutionGo=false",
  ],
  continuingPhase5: {
    decision: "BLOCKED_PHASE5_READINESS",
    productionExecutionGo: false,
    executionRunbookAccepted: false,
    PHASE_05_COMPLETE: "NOT_ISSUED",
    backupPitrRestore: "NOT_PROVABLE_CANNOT_WAIVE",
  },
  ownerDecisionsUnchanged: {
    canonicalMigrationScope: "M0_TO_M11_ACCEPTED",
    club_ai_data: "PERMANENT_DROP_NO_RECREATE",
  },
  mutationsExecuted: { staging: 0, production: 0 },
  sqlApplied: false,
  deploymentsByAgent: 0,
  readyNotIssuedDespiteChecksumCorrection: true,
});

// --- Finalize checksums from git index blobs (after staging written artefacts) ---
function stagePackage() {
  const paths = [
    "docs/platform-hard-cutover-01/phase-05b-execution-package",
    "docs/platform-hard-cutover-01/phase-05-readiness/PHASE5_ORDERED_RUNBOOK_DRAFT.md",
  ];
  spawnSync("git", ["add", "-A", ...paths], { cwd: ROOT, encoding: "utf8" });
}

function indexHash(rel) {
  return gitBlobBytes(rel);
}

stagePackage();

const checksumFilesFinal = [];
function addPkgTreeFinal(relDir) {
  const abs = path.join(PKG, relDir);
  for (const name of fs.readdirSync(abs).sort()) {
    const fp = path.join(abs, name);
    if (!fs.statSync(fp).isFile()) continue;
    const rel = `docs/platform-hard-cutover-01/phase-05b-execution-package/${relDir}/${name}`.replace(
      /\\/g,
      "/"
    );
    const h = indexHash(rel);
    checksumFilesFinal.push({
      path: rel,
      sha256ExactGitBlobBytes: h.sha256ExactGitBlobBytes,
      sha256CanonicalLf: h.sha256CanonicalLf,
      hashSource: h.source,
      gitBlobOid: h.oid,
    });
  }
}
addPkgTreeFinal("sql/m9-team-tournament");
addPkgTreeFinal("sql/m10-referee-v5");
addPkgTreeFinal("sql/m11-private-pairing-digest");
{
  const rel = "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json";
  const h = indexHash(rel);
  checksumFilesFinal.push({
    path: rel,
    sha256ExactGitBlobBytes: h.sha256ExactGitBlobBytes,
    sha256CanonicalLf: h.sha256CanonicalLf,
    hashSource: h.source,
    gitBlobOid: h.oid,
  });
}

const checksumManifestFinal = {
  marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_CHECKSUM_MANIFEST",
  correction: "PHASE5B_V2_INTEGRITY",
  generatedAt,
  algorithm: "SHA-256",
  checksumFieldAuthoritative: "sha256ExactGitBlobBytes",
  secondaryField: "sha256CanonicalLf",
  files: checksumFilesFinal,
  orderedApplyRules: {
    m9: m9Exec.map((a) => path.basename(a.applyFile)),
    m10: m10Executable,
    m11: [],
  },
  nonExecutionCandidates: {
    m9: TT5D,
    m10: [],
    m11: ["10_PRIVATE_PAIRING_DIGEST.sql"],
  },
};
writeJson(path.join(PKG, "PHASE5B_CHECKSUM_MANIFEST.json"), checksumManifestFinal);
spawnSync(
  "git",
  ["add", "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json"],
  { cwd: ROOT, encoding: "utf8" }
);

console.log(
  JSON.stringify(
    {
      generatedAt,
      m9Executable: m9Exec.length,
      m9NonExec: m9NonExec.length,
      m10: m10Artefacts.length,
      m11Action: "VERIFY_ONLY_ALREADY_EQUIVALENT",
      tt2bExact: m9Artefacts.find((a) => a.order === 10).sha256ExactGitBlobBytes,
      tt2bLf: m9Artefacts.find((a) => a.order === 10).sha256CanonicalLf,
      decision: "BLOCKED_PHASE5B_EXECUTION_PACKAGE",
      checksumFiles: checksumFilesFinal.length,
    },
    null,
    2
  )
);
