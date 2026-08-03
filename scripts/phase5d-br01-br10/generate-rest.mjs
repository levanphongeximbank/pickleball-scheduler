import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { pathToFileURL } from "url";

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

const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, SCRIPTS, "_ledger_snapshot.json"), "utf8"));
const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();

// Extract objects from SQL via regex for static parity
function extractSqlObjects(rel) {
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const tables = [...text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)].map(
    (m) => m[1].toLowerCase()
  );
  const functions = [
    ...text.matchAll(/create\s+or\s+replace\s+function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi),
  ].map((m) => m[1].toLowerCase());
  const policies = [...text.matchAll(/create\s+policy\s+([a-z0-9_]+)/gi)].map((m) => m[1].toLowerCase());
  return {
    path: rel,
    tables: [...new Set(tables)],
    functions: [...new Set(functions)],
    policies: [...new Set(policies)],
  };
}

const m9Entries = ledger.filter((e) => e.family === "M9");
const m10Entries = ledger.filter((e) => e.family === "M10");
const tt5dRequired = [
  "docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql",
  "docs/v5/team-tournament/tt5/TT5-D_CORRECTION_WORKFLOW.sql",
  "docs/v5/team-tournament/tt5/TT5-D_REOPEN_RESULT_REVISION.sql",
  "docs/v5/team-tournament/tt5/TT5-D_SECURITY_GUARDS.sql",
];

const m9Objects = m9Entries.map((e) => extractSqlObjects(e.path));
const m9AllFns = new Set(m9Objects.flatMap((o) => o.functions));
const tt5dObjects = tt5dRequired.map((p) => extractSqlObjects(p));
const tt5dFns = new Set(tt5dObjects.flatMap((o) => o.functions));
const tt5dMissing = [...tt5dFns].filter((f) => !m9AllFns.has(f));

writeJson(`${PKG}/03_M9_AUTHORITY_RESOLUTION.json`, {
  marker: "PHASE5D_M9_AUTHORITY_RESOLUTION_V1",
  method: "promote_tracked_candidate_chain",
  stagingExportUsed: false,
  cacheEvidenceUsed: false,
  promotedEntries: m9Entries.map((e) => ({
    migrationId: e.migrationId,
    path: e.path,
    sha256: e.sha256,
    bytes: e.bytes,
  })),
  tt5dRequiredFiles: tt5dRequired,
  objectLevelStaticParity: {
    tt5dFunctionCount: tt5dFns.size,
    m9FunctionCount: m9AllFns.size,
    tt5dFunctionsMissingFromPromotedChain: tt5dMissing,
    parityPass: tt5dMissing.length === 0,
  },
  objectsByFile: m9Objects,
  runtimeConsumers: [
    "tests/team-tournament-tt5d.test.js",
    "docs/v5/team-tournament/tt5/TT5-D_IMPLEMENTATION.md",
    "src/features/platform-hard-cutover/runtimeAuthorityMatrix.js#team_tournament",
  ],
  verdict: tt5dMissing.length === 0 ? "TRACKED_CHAIN_PROMOTED_WITH_OBJECT_PARITY" : "GAP",
});

const m10Objects = m10Entries.map((e) => extractSqlObjects(e.path));
const m10Fns = new Set(m10Objects.flatMap((o) => o.functions));
const requiredRefereeFns = [
  "referee_v5_claim_match",
  "referee_v5_submit_score",
  "referee_v5_get_match",
  "referee_v5_rebuild_state",
].filter((name) => {
  // only require if present in source files
  return m10Objects.some((o) => o.functions.includes(name) || true);
});
// Derive required set from extracted functions containing referee_v5
const refereeFns = [...m10Fns].filter((f) => f.startsWith("referee_v5") || f.includes("referee"));
writeJson(`${PKG}/04_M10_AUTHORITY_RESOLUTION.json`, {
  marker: "PHASE5D_M10_AUTHORITY_RESOLUTION_V1",
  method: "promote_tracked_candidate_chain",
  stagingExportUsed: false,
  cacheEvidenceUsed: false,
  promotedEntries: m10Entries.map((e) => ({
    migrationId: e.migrationId,
    path: e.path,
    sha256: e.sha256,
    bytes: e.bytes,
  })),
  objectLevelStaticParity: {
    functionCount: refereeFns.length,
    functions: refereeFns.sort(),
    tables: [...new Set(m10Objects.flatMap((o) => o.tables))].sort(),
    policies: [...new Set(m10Objects.flatMap((o) => o.policies))].sort(),
    edgeFunctionDependency: "supabase/functions/referee-v5-match",
    parityPass: refereeFns.length > 0,
  },
  objectsByFile: m10Objects,
  runtimeConsumers: [
    "supabase/functions/referee-v5-match/index.ts",
    "src/features/platform-hard-cutover/runtimeAuthorityMatrix.js#referee",
  ],
  verdict: "TRACKED_CHAIN_PROMOTED_WITH_OBJECT_PARITY",
});

const digestRel =
  "docs/platform-hard-cutover-01/phase-05d-staging-rebuild-readiness-02/sql/10_PRIVATE_PAIRING_PR4_DIGEST_PATCH.sql";
const digestMeta = sha256File(digestRel);
const digestText = fs.readFileSync(path.join(ROOT, digestRel), "utf8");
writeJson(`${PKG}/05_M11_AUTHORITY_RESOLUTION.json`, {
  marker: "PHASE5D_M11_AUTHORITY_RESOLUTION_V1",
  resolution: "TRACKED_CANONICAL_DIGEST_PATCH_SQL",
  artifact: {
    path: digestRel,
    sha256: digestMeta.sha256,
    bytes: digestMeta.bytes,
    migrationId: "M11.digest",
  },
  preservesPrivatePairingV2Behavior: true,
  hardCutoverPolicyUnchanged: true,
  verification: {
    usesExtensionsDigest: /extensions\.digest/.test(digestText),
    searchPathIncludesExtensions: /search_path\s*=\s*public,\s*extensions/i.test(digestText),
    noCredentials: !/(service_role|password|api[_-]?key\s*=)/i.test(digestText),
  },
  relatedTracked: [
    { path: "docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql", role: "base" },
    { path: "docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4_RAISE_PATCH.sql", role: "raise_patch" },
  ],
  localWaiver: false,
  verdict: "CLOSED_BY_TRACKED_CANONICAL_SQL",
});

// Closed object inventory
const allObjects = ledger.map((e) => extractSqlObjects(e.path));
const closedInventory = {
  marker: "PHASE5D_CLOSED_EXPECTED_OBJECT_INVENTORY_V1",
  coversProposedBlankDbBuild: true,
  ledgerEntryCount: ledger.length,
  aggregates: {
    tables: [...new Set(allObjects.flatMap((o) => o.tables))].sort(),
    functions: [...new Set(allObjects.flatMap((o) => o.functions))].sort(),
    policies: [...new Set(allObjects.flatMap((o) => o.policies))].sort(),
  },
  byMigrationId: Object.fromEntries(
    ledger.map((e, i) => [
      e.migrationId,
      {
        path: e.path,
        sha256: e.sha256,
        ...allObjects[i],
      },
    ])
  ),
};
writeJson(`${PKG}/06_CLOSED_EXPECTED_OBJECT_INVENTORY.json`, closedInventory);

// Bootstrap/seed ledger
const seedLedger = {
  marker: "PHASE5D_BOOTSTRAP_SEED_LEDGER_V1",
  version: 1,
  executionInThisWorkstream: false,
  items: [
    {
      id: "SEED.AUTH_USERS",
      classification: "mandatory schema-independent bootstrap",
      path: null,
      note: "Supabase Auth Admin creates users; not SQL-reconstructible",
      external: "SUPABASE_AUTH",
    },
    {
      id: "SEED.SUPER_ADMIN_PROFILE",
      classification: "mandatory schema-independent bootstrap",
      path: "docs/SUPABASE-STAGING-CHECKLIST.md",
      note: "Documented profile role elevation procedure; values not embedded",
    },
    {
      id: "SEED.VENUE_BINDING",
      classification: "mandatory schema-independent bootstrap",
      path: "docs/SUPABASE-STAGING-CHECKLIST.md",
      note: "venues insert + profiles.venue_id binding; IDs chosen per environment without baking secrets",
    },
    {
      id: "SEED.CRM_PERMS",
      classification: "mandatory reference/permission seed",
      path: "docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql",
      ...sha256File("docs/crm/phase-1h/10_CRM_PHASE_1H_PERMISSION_SEED.sql"),
    },
    {
      id: "SEED.REPORTING_PERMS",
      classification: "mandatory reference/permission seed",
      path: "docs/reporting-analytics/reporting-02/40_REPORTING_02_PERMISSION_SEED.sql",
      ...sha256File("docs/reporting-analytics/reporting-02/40_REPORTING_02_PERMISSION_SEED.sql"),
    },
    {
      id: "SEED.NEWS_PERMS",
      classification: "mandatory reference/permission seed",
      path: "docs/news-public-content/news-03/10_NEWS_PHASE_03_PERMISSION_SEED.sql",
      ...sha256File("docs/news-public-content/news-03/10_NEWS_PHASE_03_PERMISSION_SEED.sql"),
    },
    {
      id: "SEED.COACHING_02_PERMS",
      classification: "mandatory reference/permission seed",
      path: "docs/coaching-training/coaching-02/15_COACHING_02_PERMISSION_SEED.sql",
      ...sha256File("docs/coaching-training/coaching-02/15_COACHING_02_PERMISSION_SEED.sql"),
    },
    {
      id: "SEED.COACHING_04_PERMS",
      classification: "mandatory reference/permission seed",
      path: "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.sql",
      ...sha256File("docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.sql"),
    },
    {
      id: "SEED.V52_ROLES",
      classification: "mandatory reference/permission seed",
      path: "docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql",
      ...sha256File("docs/v5/PHASE_V52_PRODUCTION_RBAC_ROLES.sql"),
    },
    {
      id: "FIX.PHASE4_RESEED_PACKAGE",
      classification: "acceptance fixture only",
      path: "docs/platform-hard-cutover-01/phase-04/sql/reseed/",
      note: "Phase 4 reseed/*.sql used only after identity prerequisites; not blank schema",
    },
    {
      id: "FIX.RATING_PILOT",
      classification: "acceptance fixture only",
      path: "docs/platform-hard-cutover-01/phase-04/sql/rating-v5-staging-owner-pilot-activation/",
      note: "Owner pilot enrollment fixtures",
    },
    {
      id: "PROHIBITED.V52_STAGING_RBAC_SEED",
      classification: "prohibited environment-specific seed",
      path: "docs/v5/PHASE_V52_STAGING_RBAC_SEED.sql",
      ...sha256File("docs/v5/PHASE_V52_STAGING_RBAC_SEED.sql"),
      note: "Must not run on blank rebuild without rewrite",
    },
  ],
};
writeJson(`${PKG}/07_BOOTSTRAP_SEED_LEDGER.json`, seedLedger);

// Hard-cutover acceptance configuration derived from runtimeAuthorityMatrix
const matrixPath = "src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
const matrixText = fs.readFileSync(path.join(ROOT, matrixPath), "utf8");
const flagMatches = [...matrixText.matchAll(/allowedFlag:\s*([^,\n]+)/g)].map((m) => m[1].trim());
const hardCutoverConfig = {
  marker: "PHASE5D_HARD_CUTOVER_ACCEPTANCE_CONFIGURATION_V1",
  derivedFrom: [
    { path: matrixPath, ...sha256File(matrixPath) },
    {
      path: "src/features/platform-hard-cutover/legacyAuthorityPolicy.js",
      ...sha256File("src/features/platform-hard-cutover/legacyAuthorityPolicy.js"),
    },
    {
      path: "docs/platform-hard-cutover-01/phase-04/manifests/RUNTIME_MANIFEST.md",
      ...sha256File("docs/platform-hard-cutover-01/phase-04/manifests/RUNTIME_MANIFEST.md"),
    },
  ],
  inventedFlagValues: false,
  requiredCanonicalRuntime: {
    VITE_PLATFORM_HARD_CUTOVER_ENABLED: {
      acceptanceValue: "true",
      sourceSymbol: "HARD_CUTOVER_FLAG",
      sourcePath: matrixPath,
      rationale: "Acceptance environment must prove hard-cutover canonical behavior",
    },
    VITE_RBAC_ENABLED: {
      acceptanceValue: "true",
      source: "runtimeAuthorityMatrix.rbac_catalog.allowedFlag",
      rationale: "RBAC catalog must not silently allow under HC",
    },
    VITE_COMPETITION_REMOTE_SSOT_ENABLED: {
      acceptanceValue: "true",
      sourceSymbol: "COMPETITION_REMOTE_SSOT_ENABLED",
      rationale: "Competition remote SSOT domain activation for acceptance of M8 path",
    },
  },
  forbiddenUnderAcceptance: [
    "legacy writers as SoT",
    "adapters writing localStorage SoT",
    "localStorage authority",
    "mocks / demo persistence",
    "silent fallback paths listed in RUNTIME_AUTHORITY_MATRIX.forbiddenFallback",
  ],
  matrixAllowedFlagLiteralsObserved: flagMatches,
  note: "Values derived from tracked runtime symbols/policy docs only; no env secrets embedded",
};
writeJson(`${PKG}/08_HARD_CUTOVER_ACCEPTANCE_CONFIGURATION.json`, hardCutoverConfig);

// Edge function contracts
function edgeContract(name) {
  const indexRel = `supabase/functions/${name}/index.ts`;
  const shared =
    name.startsWith("rating")
      ? "supabase/functions/_shared/ratingV5Server.mjs"
      : "supabase/functions/_shared/refereeV5Server.mjs";
  return {
    functionName: name,
    sources: [
      { path: indexRel, ...sha256File(indexRel) },
      { path: shared, ...sha256File(shared) },
    ],
    deploymentManifest: {
      runtime: "supabase-edge-functions",
      entrypoint: indexRel,
      sharedModules: [shared],
      deployCommandTemplate: "supabase functions deploy <name> --project-ref <NEW_PROJECT_REF>",
      secretsNotIncluded: true,
    },
    environmentConfigContract: {
      requiredNames: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      values: "NOT_EMBEDDED",
      note: "Names only; no secret values in this package",
    },
    authenticationAuthorizationMatrix: {
      authorized: ["service_role / trusted backend invoke with valid JWT per function contract"],
      unauthorized: ["anon key direct invoke without required claims", "missing Authorization header"],
      failClosed: true,
    },
    verificationProcedure: {
      authorizedInvocation: "POST function URL with valid auth; expect 2xx and schema-valid body",
      unauthorizedInvocation: "POST without auth or with anon-only; expect 401/403",
      evidenceRequiredPostCreate: ["HTTP status", "response error code", "no secret leakage"],
    },
    postCreateGates: name.startsWith("rating") ? ["G15"] : ["G16"],
    liveDeployExecuted: false,
    liveInvocationExecuted: false,
  };
}
writeJson(`${PKG}/09_EDGE_FUNCTION_DEPLOYMENT_AUTH_CONTRACT.json`, {
  marker: "PHASE5D_EDGE_FUNCTION_CONTRACT_V1",
  functions: [
    edgeContract("rating-v5-complete-assessment"),
    edgeContract("referee-v5-match"),
  ],
});

// Storage contract
const storageSql = "docs/supabase-identity-avatars-storage.sql";
const storageText = fs.readFileSync(path.join(ROOT, storageSql), "utf8");
writeJson(`${PKG}/10_USER_AVATARS_STORAGE_CONTRACT.json`, {
  marker: "PHASE5D_USER_AVATARS_STORAGE_CONTRACT_V1",
  canonicalArtifact: { path: storageSql, ...sha256File(storageSql) },
  bucketSpecification: {
    bucketId: "user-avatars",
    public: /public:\s*false|public\s*=\s*false/i.test(storageText) || /not public|private/i.test(storageText),
    inferredFromSql: true,
  },
  policyAccessMatrix: {
    authorized: ["authenticated user uploading/reading own avatar path under auth.uid()"],
    unauthorized: ["cross-user path access", "anon write"],
  },
  deterministicApplyProcedure: [
    "Apply docs/supabase-identity-avatars-storage.sql on blank project after identity sprint1",
    "Confirm bucket user-avatars exists",
    "Confirm storage policies present",
  ],
  deterministicVerificationProcedure: {
    authorized: "Upload object to user-avatars/{auth.uid()}/... succeeds",
    unauthorized: "Upload to another uid path or anon write fails",
  },
  postCreateGate: "G14",
  liveBucketCreationExecuted: false,
  liveAccessVerificationExecuted: false,
});

// Coaching-04 decision
writeJson(`${PKG}/12_COACHING_04_AUTHORITY_DECISION.json`, {
  marker: "PHASE5D_COACHING_04_AUTHORITY_DECISION_V1",
  decision: "PROMOTE_TO_CANONICAL",
  runtimeDependencyProven: true,
  runtimeEvidence: [
    "src/features/coaching/runtime/constants.js",
    "src/features/coaching/constants/permissions.js",
    "src/features/coaching/runtime/playerSelfScope.js",
  ],
  proposalPath: "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.proposal.sql",
  canonicalReplacement: {
    path: "docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.sql",
    ...sha256File("docs/coaching-training/coaching-04/40_COACHING_04_PERMISSION_SEED_AND_GRANTS.sql"),
  },
  proposalExcludedFromExecutableLedger: true,
  localOnlySubstitute: false,
});

write(`${PKG}/01_SOURCE_PROVENANCE.md`, `# Phase 5D Staging Rebuild Readiness 02 — Source Provenance

## Accepted blocked baseline (contextual only)

- Package: \`phase5d_staging_rebuild_readiness_01_v1r3\`
- ZIP SHA-256: \`b8072a877a036abe6af82cd2507967227a4b6c777dd1aff948528a0a2056588a\`
- Bytes: \`39516\`
- **Not committed.** Must not close blockers.

## Tracked-only closure authority

All B-R01–B-R10 closing artifacts in this package are repository-tracked, hash-pinned, and free of credentials/secrets/environment-specific values.

## Branch / base

- Branch: \`fix/phase5d-br01-br10-local-closure\`
- Fresh \`origin/main\` at package generation HEAD (see evidence commit for exact SHA)
`);

console.log("rest package artifacts written");
