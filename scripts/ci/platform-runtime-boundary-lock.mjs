#!/usr/bin/env node
/**
 * Wave 2 — Platform Core runtime boundary lock (CI only).
 *
 * Ownership-aware: Platform Core / public-foundation surfaces must not import
 * private Business Module implementations. Approved public ports/capabilities
 * are allowlisted explicitly.
 *
 * Usage:
 *   node scripts/ci/platform-runtime-boundary-lock.mjs
 *   node scripts/ci/platform-runtime-boundary-lock.mjs --report
 *   node scripts/ci/platform-runtime-boundary-lock.mjs --self-test
 */
import {
  readFileSync,
  readdirSync,
  statSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SCAN_EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);
const IGNORE_DIRS = new Set(["node_modules", "dist", ".git", "coverage"]);

const STATIC_IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

const PLATFORM_SURFACES = [
  "src/context/ClubContext.jsx",
  "src/context/TenantContext.jsx",
  "src/context/AuthContext.jsx",
  "src/auth/authStorage.js",
  "src/auth/tournamentEngineRouteAccess.js",
  "src/models/tenant.js",
];

const PLATFORM_CORE_PREFIX = "src/core/platform/";

/** Approved public ports / pure platform contracts (not BM implementations). */
const APPROVED_PUBLIC_BOUNDARIES = new Set([
  "src/core/platform/app/billingAccessCapability.js",
  "src/core/platform/app/platformContextDiagnostics.js",
  "src/core/platform/app/platformContextReadiness.js",
  "src/core/platform/app/runtimeAccess.js",
  "src/core/platform/app/usePlatformRuntime.js",
  "src/core/platform/app/PlatformRuntimeProvider.jsx",
  "src/auth/authSessionHooks.js",
  "src/auth/authSessionLifecycle.js",
  "src/auth/ports/tournamentAccessPort.js",
]);

const RULES = [
  {
    id: "club-context-no-ai-sync",
    description: "ClubContext must not import AI cloud sync / auto sync implementations.",
    files: ["src/context/ClubContext.jsx"],
    matchImport: (spec) =>
      /(?:^|\/)ai\/(?:cloudSync|autoCloudSync)/.test(spec) ? spec : null,
  },
  {
    id: "club-context-no-skill-level",
    description: "ClubContext must not import skill-level business processing.",
    files: ["src/context/ClubContext.jsx"],
    matchImport: (spec) => (/skillLevelService/.test(spec) ? spec : null),
  },
  {
    id: "tenant-model-no-ai-config",
    description: "Tenant model must not depend on AI configuration.",
    files: ["src/models/tenant.js"],
    matchImport: (spec) => (/(?:^|\/)ai\//.test(spec) ? spec : null),
  },
  {
    id: "tenant-context-no-billing-internals",
    description:
      "TenantContext must not import Billing repositories/runtime internals (use billingAccessCapability).",
    files: ["src/context/TenantContext.jsx"],
    matchImport: (spec) =>
      /features\/billing\/(repositories|bridges|guards|services)\//.test(spec) ? spec : null,
  },
  {
    id: "auth-storage-no-mobile-impl",
    description: "authStorage must not import Mobile offline-queue implementation.",
    files: ["src/auth/authStorage.js"],
    matchImport: (spec) =>
      /features\/mobile\//.test(spec) || /offlineQueueQuarantine/.test(spec) ? spec : null,
  },
  {
    id: "auth-storage-no-club-impl",
    description: "authStorage must not import Club governance / membership implementations.",
    files: ["src/auth/authStorage.js"],
    matchImport: (spec) =>
      /features\/club\//.test(spec) || /governanceRoleElevation/.test(spec) ? spec : null,
  },
  {
    id: "tournament-route-access-no-domain-impl",
    description:
      "tournamentEngineRouteAccess must not import tournamentService / clubTournamentBridge (use port).",
    files: ["src/auth/tournamentEngineRouteAccess.js"],
    matchImport: (spec) =>
      /tournamentService|clubTournamentBridge/.test(spec) ? spec : null,
  },
  {
    id: "platform-core-no-business-features",
    description:
      "src/core/platform must not import features/*, ai/*, or Auth/Club/Tenant React contexts.",
    files: null,
    matchImport: (spec) => {
      if (/features\//.test(spec)) return spec;
      if (/(?:^|\/)ai\//.test(spec)) return spec;
      if (/context\/(Auth|Club|Tenant)Context/.test(spec)) return spec;
      return null;
    },
  },
];

function extractImports(content) {
  const specs = [];
  let m;
  STATIC_IMPORT_RE.lastIndex = 0;
  while ((m = STATIC_IMPORT_RE.exec(content)) !== null) {
    specs.push(m[1]);
  }
  return specs;
}

function walk(dirAbs, out) {
  let entries;
  try {
    entries = readdirSync(dirAbs);
  } catch {
    return;
  }
  for (const name of entries) {
    if (IGNORE_DIRS.has(name)) continue;
    const abs = path.join(dirAbs, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(abs, out);
    else if (SCAN_EXT.has(path.extname(name))) out.push(abs);
  }
}

function collectViolations(scanRoot = ROOT) {
  const found = [];
  const targets = PLATFORM_SURFACES.map((f) => path.join(scanRoot, f));
  walk(path.join(scanRoot, PLATFORM_CORE_PREFIX), targets);

  const seen = new Set();
  for (const abs of targets) {
    const normalized = path.relative(scanRoot, abs).split(path.sep).join("/");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    if (APPROVED_PUBLIC_BOUNDARIES.has(normalized)) continue;

    let content;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    const imports = extractImports(content);
    const isPlatformCore = normalized.startsWith(PLATFORM_CORE_PREFIX);

    for (const rule of RULES) {
      const applies =
        (Array.isArray(rule.files) && rule.files.includes(normalized)) ||
        (rule.files === null && isPlatformCore);
      if (!applies) continue;

      for (const spec of imports) {
        const hit = rule.matchImport(spec);
        if (hit) found.push({ rule: rule.id, file: normalized, symbol: hit });
      }
    }
  }
  return found;
}

function runSelfTest() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "pc-runtime-boundary-"));
  try {
    mkdirSync(path.join(tmp, "src", "context"), { recursive: true });
    mkdirSync(path.join(tmp, "src", "auth"), { recursive: true });
    mkdirSync(path.join(tmp, "src", "models"), { recursive: true });
    mkdirSync(path.join(tmp, "src", "core", "platform", "app"), { recursive: true });

    writeFileSync(
      path.join(tmp, "src", "context", "ClubContext.jsx"),
      'import { pullClubFromCloud } from "../ai/cloudSync.js";\nexport const x = 1;\n'
    );
    writeFileSync(path.join(tmp, "src", "context", "TenantContext.jsx"), "export const x = 1;\n");
    writeFileSync(path.join(tmp, "src", "context", "AuthContext.jsx"), "export const x = 1;\n");
    writeFileSync(
      path.join(tmp, "src", "auth", "authStorage.js"),
      'import { quarantineOfflineQueueOnLogout } from "../features/mobile/services/offlineQueueQuarantine.js";\n'
    );
    writeFileSync(
      path.join(tmp, "src", "auth", "tournamentEngineRouteAccess.js"),
      "export const x = 1;\n"
    );
    writeFileSync(
      path.join(tmp, "src", "models", "tenant.js"),
      'import { DEFAULT_TIMEZONE } from "../ai/config.js";\n'
    );
    writeFileSync(
      path.join(tmp, "src", "core", "platform", "app", "leaky.js"),
      'import { foo } from "../../../features/billing/repositories/billingRepository.js";\n'
    );

    const violations = collectViolations(tmp);
    const ruleIds = new Set(violations.map((v) => v.rule));
    const required = [
      "club-context-no-ai-sync",
      "auth-storage-no-mobile-impl",
      "tenant-model-no-ai-config",
      "platform-core-no-business-features",
    ];
    const missing = required.filter((id) => !ruleIds.has(id));
    if (missing.length) {
      console.error(
        `platform-runtime-boundary-lock self-test FAIL — missed: ${missing.join(", ")}`
      );
      console.error(violations);
      process.exit(1);
    }
    console.log(
      `platform-runtime-boundary-lock self-test OK — caught ${violations.length} synthetic violation(s)`
    );
    process.exit(0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function runCli() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }

  const violations = collectViolations();
  if (process.argv.includes("--report")) {
    console.log(`platform-runtime-boundary-lock: ${violations.length} violation(s)`);
    for (const v of violations) {
      console.log(`  - ${v.rule} :: ${v.file} :: ${v.symbol}`);
    }
    process.exit(0);
  }

  if (violations.length > 0) {
    console.error(
      `platform-runtime-boundary-lock: FAIL — ${violations.length} reverse dependenc(ies):`
    );
    for (const v of violations) {
      console.error(`  + ${v.rule} :: ${v.file} :: ${v.symbol}`);
    }
    process.exit(1);
  }

  console.log("platform-runtime-boundary-lock: OK — PLATFORM_CORE_REVERSE_DEPENDENCIES=0");
  process.exit(0);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath && selfPath === invokedPath) {
  runCli();
}

export { RULES, collectViolations, extractImports, APPROVED_PUBLIC_BOUNDARIES };
