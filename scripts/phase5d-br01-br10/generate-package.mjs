import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";

const ROOT = process.cwd();
const PKG = "docs/platform-hard-cutover-01/phase-05d-staging-rebuild-readiness-02";
const SCRIPTS = "scripts/phase5d-br01-br10";

function sha256File(rel) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  return {
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
    bytes: buf.length,
  };
}

function write(rel, text) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const n = String(text).replace(/\r\n/g, "\n");
  fs.writeFileSync(abs, n.endsWith("\n") ? n : n + "\n", "utf8");
}

function writeJson(rel, obj) {
  write(rel, JSON.stringify(obj, null, 2));
}

const ledger = [];
function add(id, rel, deps, purpose, family) {
  if (!fs.existsSync(path.join(ROOT, rel))) throw new Error("missing " + rel);
  const h = sha256File(rel);
  ledger.push({
    order: ledger.length + 1,
    migrationId: id,
    path: rel.replace(/\\/g, "/"),
    sha256: h.sha256,
    bytes: h.bytes,
    dependencies: deps,
    purpose,
    family,
  });
}

const F0 = [
  ["F0.01", "docs/supabase-club-v3.sql", [], "club_data_v3"],
  ["F0.02", "docs/supabase-rbac.sql", ["F0.01"], "venues/profiles/helpers text tenant"],
  ["F0.03", "docs/supabase-club-v3-rls.sql", ["F0.01", "F0.02"], "club_data_v3 RLS"],
  ["F0.04", "docs/supabase-match-live.sql", ["F0.02"], "tournament_match_live"],
  ["F0.05", "docs/supabase-match-live-rls.sql", ["F0.04"], "match live RLS/RPC"],
  ["F0.06", "docs/supabase-security-hardening-v357.sql", ["F0.02"], "signup/profile guards"],
  ["F0.07", "docs/supabase-match-live-v2.sql", ["F0.04"], "match live v2 columns"],
  ["F0.08", "docs/supabase-identity-v40-sprint1.sql", ["F0.02"], "roles/permissions/audit"],
  ["F0.09", "docs/supabase-identity-v40-phaseB.sql", ["F0.08"], "identity phase B"],
  ["F0.10", "docs/supabase-identity-v40-phaseC.sql", ["F0.09"], "identity phase C RPCs"],
  ["F0.11", "docs/supabase-multi-tenant-sprint2.sql", ["F0.02"], "tenants view"],
  ["F0.12", "docs/supabase-subscription-sprint4.sql", ["F0.02"], "subscription columns"],
  ["F0.13", "docs/supabase-ai-assistant-sprint7.sql", ["F0.02"], "ai_suggestions"],
  ["F0.14", "docs/supabase-mobile-sprint9.sql", ["F0.02"], "mobile push/qr/checkins"],
  ["F0.15", "docs/supabase-sprint10.sql", ["F0.02"], "api/marketplace"],
  ["F0.16", "docs/supabase-identity-avatars-storage.sql", ["F0.08"], "user-avatars storage SQL"],
  ["F0.17", "docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql", ["F0.08"], "V5.2 RBAC roles"],
];
for (const [id, p, d, pur] of F0) add(id, p, d, pur, "FOUNDATION");

const F1 = [
  ["F1.01", "docs/supabase-billing-phase9.sql", ["F0.12"], "billing tables"],
  ["F1.02", "docs/supabase-billing-phase9-trial-rpc.sql", ["F1.01"], "trial RPC"],
  ["F1.03", "docs/supabase-sprint10-phase11a-rls.sql", ["F0.15"], "sprint10 RLS"],
  ["F1.04", "docs/supabase-sprint10-phase11b-persistence.sql", ["F1.03"], "sprint10 persistence"],
  ["F1.05", "docs/supabase-sprint10-phase11c-api-key-guard.sql", ["F1.04"], "api key guard"],
  ["F1.06", "docs/supabase-sprint10-phase11e-integration-audit.sql", ["F1.05"], "integration audit"],
  ["F1.07", "docs/supabase-phase16-kn6-qr-checkins-rls.sql", ["F0.14"], "KN6 RLS"],
];
for (const [id, p, d, pur] of F1) add(id, p, d, pur, "FOUNDATION_EXTENDED");

add(
  "M0.10",
  "docs/production-security/prod-sec-g3-b12-01/10_CLUB_AI_DATA_ANON_WRITE_LOCKDOWN.sql",
  ["F0.01"],
  "G3-B12 lockdown",
  "M0"
);
add("M1.10", "docs/customer-management/phase-3/10_CUSTOMER_PHASE_3_TABLES.sql", ["F0.10"], "customer tables", "M1");
add("M1.20", "docs/customer-management/phase-3/20_CUSTOMER_PHASE_3_INDEXES.sql", ["M1.10"], "customer indexes", "M1");
add("M1.30", "docs/customer-management/phase-3/30_CUSTOMER_PHASE_3_RLS.sql", ["M1.20"], "customer RLS", "M1");
add("M1.40", "docs/customer-management/phase-3/40_CUSTOMER_PHASE_3_SAVE_RPC.sql", ["M1.30"], "customer save RPC", "M1");
add("M1.50", "docs/customer-management/phase-3/50_CUSTOMER_PHASE_3_GRANTS.sql", ["M1.40"], "customer grants", "M1");
add("M2.10", "docs/supabase-finance-phase1f.sql", ["F0.08"], "finance_*", "M2");

const m3 = [
  "10_CRM_PHASE_1G_TABLES",
  "20_CRM_PHASE_1G_INDEXES",
  "30_CRM_PHASE_1G_RLS",
  "40_CRM_PHASE_1G_CLAIM_RELEASE_RPCS",
  "50_CRM_PHASE_1G_GRANTS",
  "60_CRM_PHASE_1G_CONSENT_IMMUTABLE",
];
let prev = "F0.10";
for (const n of m3) {
  const id = "M3G." + n.slice(0, 2);
  add(id, `docs/crm/phase-1g/${n}.sql`, [prev], n, "M3");
  prev = id;
}
add("M3H.10", "docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql", ["M3G.60", "F0.08"], "CRM perm seed", "M3");
add(
  "M3H.20",
  "docs/crm/phase-1h/20_CRM_PHASE_1H_ROLE_PERMISSION_ASSIGNMENT.sql",
  ["M3H.10"],
  "CRM role-perm",
  "M3"
);

const m4 = [
  "10_REPORTING_02_TABLES",
  "20_REPORTING_02_INDEXES",
  "30_REPORTING_02_RLS",
  "40_REPORTING_02_PERMISSION_SEED",
  "50_REPORTING_02_GRANTS",
];
prev = "F0.08";
for (const n of m4) {
  const id = "M4." + n.slice(0, 2);
  add(id, `docs/reporting-analytics/reporting-02/${n}.sql`, [prev], n, "M4");
  prev = id;
}

const m5 = [
  "10_NEWS_PHASE_02_TABLES",
  "20_NEWS_PHASE_02_INDEXES",
  "30_NEWS_PHASE_02_RLS",
  "40_NEWS_PHASE_02_SAVE_RPC",
  "50_NEWS_PHASE_02_GRANTS",
  "60_NEWS_PHASE_02_IMMUTABLE_REVISIONS",
];
prev = "F0.08";
for (const n of m5) {
  const id = "M5." + n.slice(0, 2);
  add(id, `docs/news-public-content/news-02/${n}.sql`, [prev], n, "M5");
  prev = id;
}
add(
  "M5N3.10",
  "docs/news-public-content/news-03/10_NEWS_PHASE_03_PERMISSION_SEED.sql",
  ["M5.50", "F0.08"],
  "news perm seed",
  "M5"
);
add(
  "M5N4.10",
  "docs/news-public-content/news-04/10_NEWS_PHASE_04_PUBLIC_RPC_LIVE_ONLY.sql",
  ["M5.40"],
  "news public RPC",
  "M5"
);

const m6 = [
  "10_COACHING_02_TABLES",
  "15_COACHING_02_PERMISSION_SEED",
  "20_COACHING_02_INDEXES",
  "30_COACHING_02_RLS",
  "40_COACHING_02_ATTENDANCE_CORRECTION_RPC",
  "45_COACHING_02_ENTITLEMENT_CONSUME_RPC",
  "50_COACHING_02_GRANTS",
  "60_COACHING_02_IMMUTABLE",
];
prev = "F0.08";
for (const n of m6) {
  const id = "M6." + n.slice(0, 2);
  add(id, `docs/coaching-training/coaching-02/${n}.sql`, [prev], n, "M6");
  prev = id;
}
const m6c4 = [
  "10_COACHING_04_ASSIGNMENT_HELPERS",
  "11_COACHING_04_PLAYER_SELF_SCOPE_HELPERS",
  "20_COACHING_04_ASSIGNMENT_RLS",
  "21_COACHING_04_PLAYER_SELF_SCOPE_RLS",
  "30_COACHING_04_SCOPED_RPCS",
  "41_COACHING_04_HELPER_EXECUTE_ACL_HARDENING",
];
prev = "M6.50";
for (const n of m6c4) {
  const id = "M6C4." + n.slice(0, 2);
  add(id, `docs/coaching-training/coaching-04/${n}.sql`, [prev], n, "M6");
  prev = id;
}
add(
  "M6C4.40",
  "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.sql",
  ["M6.15"],
  "coaching-04 permission seed CANONICAL (B-R10)",
  "M6"
);

add("M7.cc02", "docs/competition-core/supabase-cc02-rating-v2.sql", ["F0.02"], "rating v2", "M7");
add(
  "M7.cc02c",
  "docs/competition-core/supabase-cc02c-rating-durability.sql",
  ["M7.cc02"],
  "rating durability",
  "M7"
);

const m8 = [
  "10_TABLES",
  "20_INDEXES",
  "30_RLS",
  "40_RPC_COMMAND_AND_FINALIZE",
  "50_GRANTS",
  "51_GRANTS_TIGHTEN",
  "52_GRANTS_EXACT_BASELINE",
];
prev = "F0.02";
for (const n of m8) {
  const id = "M8." + n.slice(0, 2);
  add(
    id,
    `docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/${n}.sql`,
    [prev],
    `M8 ${n} text tenant`,
    "M8"
  );
  prev = id;
}

const m9 = [
  "docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql",
  "docs/v5/PHASE_TT2B_LINEUP_DEADLINE_SERVER_TIME.sql",
  "docs/v5/PHASE_TT2C_LINEUP_VALIDATION.sql",
  "docs/v5/PHASE_TT2C_SUBMIT_LINEUP_VALIDATION.sql",
  "docs/v5/PHASE_TT2D_RANDOMIZE_LOCK_WORKFLOW.sql",
  "docs/v5/PHASE_TT2E_ATOMIC_PUBLISH_WORKFLOW.sql",
  "docs/v5/PHASE_TT2E_GET_SETUP_FIX.sql",
  "docs/v5/PHASE_TT3_GET_SETUP_PATCH.sql",
  "docs/v5/PHASE_TT3_LINEUP_OVERRIDE.sql",
  "docs/v5/PHASE_TT4_FORFEIT_WITHDRAWAL.sql",
  "docs/v5/PHASE_TT4_GET_SETUP_PATCH.sql",
  "docs/v5/team-tournament/p1/PHASE_P1_2_S1B_SNAPSHOT_SCHEMA.sql",
  "docs/v5/team-tournament/p1/PHASE_P1_2_S1C_GET_SETUP_V7.sql",
  "docs/v5/team-tournament/p1/PHASE_P1_3_DOMAIN_PERSISTENCE_SCHEMA.sql",
  "docs/v5/team-tournament/p1/PHASE_P1_3_DOMAIN_PERSISTENCE_RPCS.sql",
  "docs/v5/team-tournament/p1/PHASE_P1_3_GET_SETUP_V7_GROUPS.sql",
  "docs/v5/team-tournament/p1/PHASE_P1_3_SAVE_DRAFT_RPC.sql",
  "docs/v5/team-tournament/tt5/TT5-B_BRIDGE_SCHEMA.sql",
  "docs/v5/team-tournament/tt5/TT5-B_PROVISION_RPC.sql",
  "docs/v5/team-tournament/tt5/TT5-B_GET_SETUP_PATCH.sql",
  "docs/v5/team-tournament/tt5/TT5-B_LEGACY_LOCK_GUARD.sql",
  "docs/v5/team-tournament/tt5/TT5-C_REPROVISION_STATE.sql",
  "docs/v5/team-tournament/tt5/TT5-C_RESULT_PROPAGATION.sql",
  "docs/v5/team-tournament/tt5/TT5-C_RESULT_OUTBOX_CONSUMER.sql",
  "docs/v5/team-tournament/tt5/TT5-C_STANDINGS_RECOMPUTE.sql",
  "docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql",
  "docs/v5/team-tournament/tt5/TT5-D_CORRECTION_WORKFLOW.sql",
  "docs/v5/team-tournament/tt5/TT5-D_REOPEN_RESULT_REVISION.sql",
  "docs/v5/team-tournament/tt5/TT5-D_SECURITY_GUARDS.sql",
  "docs/v5/team-tournament/tt6/TT6-B_REALTIME_CORE.sql",
  "docs/v5/team-tournament/tt6/TT6-B_REALTIME_SECURITY.sql",
];
prev = "M8.40";
m9.forEach((p, i) => {
  const id = `M9.${String(i + 1).padStart(2, "0")}`;
  add(id, p, [prev], `M9 promoted tracked ${path.basename(p)}`, "M9");
  prev = id;
});

const m10 = [
  "docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql",
  "docs/v5/referee-v5/PHASE_V5D_REFEREE_PERSISTENCE.sql",
  "docs/v5/referee-v5/PHASE_V5D1_REFEREE_HARDENING.sql",
];
prev = "M8.40";
m10.forEach((p, i) => {
  const id = `M10.${i + 1}`;
  add(id, p, [prev], `M10 promoted tracked ${path.basename(p)}`, "M10");
  prev = id;
});

add("M11.pr4", "docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql", ["F0.08"], "Private Pairing PR4 base", "M11");
add(
  "M11.digest",
  "docs/platform-hard-cutover-01/phase-05d-staging-rebuild-readiness-02/sql/10_PRIVATE_PAIRING_PR4_DIGEST_PATCH.sql",
  ["M11.pr4"],
  "PR4 digest patch extensions.digest",
  "M11"
);
add(
  "M11.raise",
  "docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4_RAISE_PATCH.sql",
  ["M11.pr4"],
  "PR4 raise exception patch",
  "M11"
);

add(
  "P4.court1",
  "docs/platform-hard-cutover-01/phase-04/sql/court-cluster-admin-rpc-staging/10_PHASE_33_COURT_CLAIM_REQUESTS.sql",
  ["F0.02"],
  "court claim",
  "P4"
);
add(
  "P4.court2",
  "docs/platform-hard-cutover-01/phase-04/sql/court-cluster-admin-rpc-staging/20_PHASE_36_COURT_CLUSTER_CLOUD_SYNC.sql",
  ["P4.court1"],
  "court cluster sync",
  "P4"
);
add(
  "P4.court3",
  "docs/platform-hard-cutover-01/phase-04/sql/court-cluster-admin-rpc-staging/30_PHASE_37_CLUB_REGISTERABLE_CLUSTERS.sql",
  ["P4.court2"],
  "registerable clusters",
  "P4"
);
add(
  "P4.courtAuth",
  "docs/platform-hard-cutover-01/phase-04/sql/court-admin-upsert-venue-owner-auth/10_COURT_ADMIN_UPSERT_VENUE_OWNER_AUTH.sql",
  ["F0.02"],
  "venue owner auth",
  "P4"
);
add(
  "P4.rateRbac",
  "docs/platform-hard-cutover-01/phase-04/sql/rating-v5-owner-assess-self-rbac/10_OWNER_ASSESS_SELF_RBAC.sql",
  ["F0.02"],
  "owner assess self RBAC",
  "P4"
);
add(
  "P4.pairView",
  "docs/platform-hard-cutover-01/phase-04/sql/pairing-owner-view-rbac/10_OWNER_PAIRING_VIEW_RBAC.sql",
  ["M11.pr4"],
  "pairing owner view RBAC",
  "P4"
);

const idSet = new Set(ledger.map((e) => e.migrationId));
let unresolved = 0;
let forward = 0;
let self = 0;
const order = new Map(ledger.map((e, i) => [e.migrationId, i]));
for (const e of ledger) {
  for (const d of e.dependencies) {
    if (d === e.migrationId) self++;
    if (!idSet.has(d)) unresolved++;
    else if (order.get(d) >= order.get(e.migrationId)) forward++;
  }
}
const paths = ledger.map((e) => e.path);
const dupPaths = paths.filter((p, i) => paths.indexOf(p) !== i);
if (unresolved || forward || self || dupPaths.length || idSet.size !== ledger.length) {
  console.error({ unresolved, forward, self, dupPaths, dupIds: ledger.length - idSet.size });
  process.exit(2);
}

const externalDependencies = [
  { id: "SUPABASE_AUTH", purpose: "Auth users / session bootstrap" },
  { id: "SUPABASE_STORAGE", purpose: "Storage API for user-avatars bucket apply" },
  {
    id: "EDGE_FUNCTION_rating-v5-complete-assessment",
    purpose: "Deploy after schema; G15",
  },
  { id: "EDGE_FUNCTION_referee-v5-match", purpose: "Deploy after schema; G16" },
  {
    id: "OWNER_BOOTSTRAP",
    purpose: "First SUPER_ADMIN / venue binding via Auth Admin + tracked bootstrap ledger",
  },
];

const ledgerDoc = {
  marker: "PHASE5D_PROPOSED_EXECUTABLE_BLANK_DB_LEDGER_V1",
  classification: "PROPOSED_EXECUTABLE_LEDGER_PENDING_INDEPENDENT_REVIEW",
  approvedApplySequenceClaim: false,
  distinctFromEvidenceInventory: true,
  evidenceInventoryEntriesReference: 155,
  entryCount: ledger.length,
  topology: {
    unresolved: 0,
    forward: 0,
    self: 0,
    cycles: 0,
    duplicateMigrationIds: 0,
    duplicatePaths: 0,
  },
  externalDependencies,
  excludedFromThisLedger: [
    {
      path: "docs/v5/PHASE_V52_STAGING_RBAC_SEED.sql",
      reason: "prohibited environment-specific seed (see bootstrap/seed ledger)",
    },
    {
      path: "docs/competition-core/supabase-cc02d-staging-hardening.sql",
      reason: "staging-named hardening; not blank-DB portable — excluded by tracked decision",
    },
    {
      path: "docs/platform-hard-cutover-01/phase-04/sql/rating-v5-staging-owner-pilot-activation/*",
      reason: "acceptance fixture / env-specific pilot — seed ledger only",
    },
    {
      path: "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql",
      reason: "superseded by canonical 40_*.sql (B-R10)",
    },
  ],
  orderedEntries: ledger,
};
writeJson(`${PKG}/02_PROPOSED_EXECUTABLE_BLANK_DB_LEDGER.json`, ledgerDoc);
fs.writeFileSync(path.join(ROOT, SCRIPTS, "_ledger_snapshot.json"), JSON.stringify(ledger, null, 2));
console.log("ledgerEntries", ledger.length);
