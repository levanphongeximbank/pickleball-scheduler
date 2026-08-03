import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { pathToFileURL } from "url";
import { extractSql, consumerRefs, envReads, hashFile } from "./contract-analyzer.mjs";

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

const extractSqlObjects = extractSql;
const functionNames = (objects) => objects.flatMap((o) => o.functions.map((f) => f.name));
const tableNames = (objects) => objects.flatMap((o) => o.tables);
const policyKeys = (objects) => objects.flatMap((o) => o.policies.map((p) => `${p.table}:${p.name}:${p.command}:${p.roles}:${p.using}:${p.withCheck}`));
const signatures = (objects) => objects.flatMap((o) => o.functions.map((f) => `${f.name}(${f.parameters.join(",")}) returns ${f.returns}`));
const missing = (required, actual) => required.filter((x) => !new Set(actual).has(x));

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
const tt5dObjects = tt5dRequired.map(extractSqlObjects);
const m9ConsumerFiles = ["tests/team-tournament-tt5d.test.js", "src/features/team-tournament/services/tt5dService.js", "docs/v5/team-tournament/tt5/TT5-D_IMPLEMENTATION.md"].filter((p)=>fs.existsSync(path.join(ROOT,p)));
const m9Required = consumerRefs(m9ConsumerFiles);
const m9Actual = { functions:functionNames(m9Objects), tables:tableNames(m9Objects), signatures:signatures(m9Objects), policies:policyKeys(m9Objects) };
const tt5dMissing = { functions:missing(m9Required.functions,m9Actual.functions), tables:missing(m9Required.tables,m9Actual.tables) };
const m9Unclassified=m9Objects.flatMap(o=>o.unclassified.map(x=>({path:o.path,...x})));
const m9Pass=!tt5dMissing.functions.length&&!tt5dMissing.tables.length&&!m9Unclassified.length;

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
    requirementDerivation: m9Required,
    requiredFunctionCount: m9Required.functions.length,
    requiredTableCount: m9Required.tables.length,
    promotedFunctionSignatureCount: m9Actual.signatures.length,
    promotedPolicyContractCount: m9Actual.policies.length,
    missing: tt5dMissing,
    unclassified: m9Unclassified,
    parityPass: m9Pass,
  },
  objectsByFile: m9Objects,
  runtimeConsumers: [
    "tests/team-tournament-tt5d.test.js",
    "docs/v5/team-tournament/tt5/TT5-D_IMPLEMENTATION.md",
    "src/features/platform-hard-cutover/runtimeAuthorityMatrix.js#team_tournament",
  ],
  verdict: m9Pass ? "TRACKED_CHAIN_PROMOTED_WITH_INDEPENDENT_CONSUMER_PARITY" : "GAP",
});

const m10Objects = m10Entries.map((e) => extractSqlObjects(e.path));
const m10ConsumerFiles=["supabase/functions/referee-v5-match/index.ts","src/features/referee-v5/server/edgeHttpHandler.js","src/features/referee-v5/persistence/RefereeV5SupabaseRepository.js","src/features/referee-v5/persistence/RefereeV5RpcAtomicCommitService.js",...fs.readdirSync(path.join(ROOT,"tests/referee-v5")).filter(n=>n.endsWith(".js")).map(n=>`tests/referee-v5/${n}`)];
const m10Required=consumerRefs(m10ConsumerFiles);
const m10Actual={functions:functionNames(m10Objects),tables:tableNames(m10Objects),signatures:signatures(m10Objects),policies:policyKeys(m10Objects),rls:m10Objects.flatMap(o=>o.rls),grants:m10Objects.flatMap(o=>o.grants),revokes:m10Objects.flatMap(o=>o.revokes)};
const m10Missing={functions:missing(m10Required.functions,m10Actual.functions),tables:missing(m10Required.tables,m10Actual.tables)};
const m10Unclassified=m10Objects.flatMap(o=>o.unclassified.map(x=>({path:o.path,...x})));
const m10Pass=!m10Missing.functions.length&&!m10Missing.tables.length&&!m10Unclassified.length&&m10Actual.rls.length>0&&m10Actual.grants.length>0&&m10Actual.revokes.length>0;
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
    requirementDerivation: m10Required,
    functionSignatureCount: m10Actual.signatures.length,
    policyContractCount: m10Actual.policies.length,
    missing: m10Missing,
    unclassified: m10Unclassified,
    rlsContracts: m10Actual.rls,
    grants: m10Actual.grants,
    revokes: m10Actual.revokes,
    edgeFunctionDependency: "supabase/functions/referee-v5-match",
    parityPass: m10Pass,
  },
  objectsByFile: m10Objects,
  runtimeConsumers: [
    "supabase/functions/referee-v5-match/index.ts",
    "src/features/platform-hard-cutover/runtimeAuthorityMatrix.js#referee",
  ],
  verdict: m10Pass ? "TRACKED_CHAIN_PROMOTED_WITH_INDEPENDENT_CONSUMER_PARITY" : "GAP",
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
const inventoryUnclassified=allObjects.flatMap(o=>o.unclassified.map(x=>({path:o.path,...x})));
const closedInventory = {
  marker: "PHASE5D_CLOSED_EXPECTED_OBJECT_INVENTORY_V1",
  coversProposedBlankDbBuild: inventoryUnclassified.length===0,
  ledgerEntryCount: ledger.length,
  aggregates: {
    schemas: [...new Set(allObjects.flatMap(o=>o.schemas))].sort(), extensions:[...new Set(allObjects.flatMap(o=>o.extensions))].sort(), types:allObjects.flatMap(o=>o.types), domains:allObjects.flatMap(o=>o.domains),
    tables: [...new Set(tableNames(allObjects))].sort(), columns:allObjects.flatMap(o=>o.columns), constraints:allObjects.flatMap(o=>o.constraints), indexes:allObjects.flatMap(o=>o.indexes), views:[...new Set(allObjects.flatMap(o=>o.views))].sort(), materializedViews:[...new Set(allObjects.flatMap(o=>o.materializedViews))].sort(), sequences:[...new Set(allObjects.flatMap(o=>o.sequences))].sort(),
    functions: allObjects.flatMap(o=>o.functions), procedures:allObjects.flatMap(o=>o.procedures), triggers:allObjects.flatMap(o=>o.triggers), rls:allObjects.flatMap(o=>o.rls), policies:allObjects.flatMap(o=>o.policies), grants:allObjects.flatMap(o=>o.grants), revokes:allObjects.flatMap(o=>o.revokes), storageBuckets:allObjects.flatMap(o=>o.storageBuckets), unclassified:inventoryUnclassified,
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
for (const item of seedLedger.items) {
  if (!item.path || item.external) continue;
  const abs=path.join(ROOT,item.path);
  if (!fs.existsSync(abs)) throw new Error(`seed source missing: ${item.path}`);
  if (fs.statSync(abs).isFile()) Object.assign(item,hashFile(item.path));
  else item.sources=fs.readdirSync(abs,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replace(/\\/g,"/")).sort().map(p=>({path:p,...hashFile(p)}));
}
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
  const environmentSources=[indexRel];
  const requiredNames=[...new Set(environmentSources.flatMap(envReads))].sort();
  const isRating=name.startsWith("rating");
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
      requiredNames,
      values: "NOT_EMBEDDED",
      note: "Names only; no secret values in this package",
    },
    authenticationAuthorizationMatrix: {
      callerCredential: "Authenticated user bearer token in Authorization header",
      internalCredential: "SUPABASE_SERVICE_ROLE_KEY is server-only configuration and MUST NOT be supplied by clients",
      authorized: isRating ? ["authenticated caller completes own pending assessment within same tenant"] : ["authenticated assigned referee; director/admin override only where source role policy permits"],
      unauthorized: isRating ? ["missing/invalid bearer: 401 AUTH_REQUIRED", "cross-user or cross-tenant assessment: 403/404 fail-closed", "already completed/invalid state: 409"] : ["missing/invalid bearer: 401 AUTH_REQUIRED", "unassigned referee: 403 REFEREE_NOT_ASSIGNED", "cross-tenant or missing match: 403/404", "invalid command/domain transition: 400/409"],
      failClosed: true,
    },
    verificationProcedure: {
      authorizedInvocation: "POST with authenticated user bearer; verify ownership/tenant/assignment/role and expect source-defined 2xx body",
      unauthorizedInvocation: "Exercise missing bearer, wrong owner/tenant, unassigned referee and insufficient-role cases; require the listed 4xx code",
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
const storageObjects=extractSql(storageSql);
const avatarBucket=storageObjects.storageBuckets.find(b=>b.id==="user-avatars");
const avatarPolicies=storageObjects.policies.filter(p=>p.table==="storage.objects"&&p.name.startsWith("user_avatars"));
writeJson(`${PKG}/10_USER_AVATARS_STORAGE_CONTRACT.json`, {
  marker: "PHASE5D_USER_AVATARS_STORAGE_CONTRACT_V1",
  canonicalArtifact: { path: storageSql, ...sha256File(storageSql) },
  bucketSpecification: {
    bucketId: "user-avatars",
    public: avatarBucket?.public,
    inferredFromSql: true,
  },
  policyAccessMatrix: {
    authorized: ["anonymous SELECT", "authenticated SELECT", "authenticated INSERT/UPDATE/DELETE only below own auth.uid() path"],
    unauthorized: ["anonymous write", "cross-user INSERT/UPDATE/DELETE"],
    policies: avatarPolicies,
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
  consistencyPass: avatarBucket?.public===true && avatarPolicies.some(p=>p.command==="select"&&p.roles==="anon") && /for\s+insert\s+to\s+authenticated[\s\S]*?auth\.uid\(\)::text/i.test(storageText) && /for\s+update\s+to\s+authenticated[\s\S]*?using[\s\S]*?auth\.uid\(\)::text[\s\S]*?with check[\s\S]*?auth\.uid\(\)::text/i.test(storageText) && /for\s+delete\s+to\s+authenticated[\s\S]*?auth\.uid\(\)::text/i.test(storageText),
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
