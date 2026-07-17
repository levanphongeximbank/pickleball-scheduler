#!/usr/bin/env node
/**
 * Phase 2A — Competition Engine architecture boundary lock (CI only).
 *
 * Enforces import-direction rules for competition-core, format modules, and
 * domain engines. Grandfathered debt lives in competition-architecture-lock-baseline.json;
 * the lock fails on NEW files, increased occurrence counts, or fingerprint changes.
 *
 * Usage:
 *   node scripts/ci/competition-architecture-lock.mjs          # check
 *   node scripts/ci/competition-architecture-lock.mjs --init   # regenerate baseline
 *   node scripts/ci/competition-architecture-lock.mjs --report # list current violations
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE_PATH = process.env.COMPETITION_ARCHITECTURE_BASELINE
  ? path.resolve(ROOT, process.env.COMPETITION_ARCHITECTURE_BASELINE)
  : path.join(ROOT, "scripts", "ci", "competition-architecture-lock-baseline.json");

const SCAN_DIRS = ["src"];
const SCAN_EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);
const IGNORE_DIRS = new Set(["node_modules", "dist", ".git", "coverage"]);

const STATIC_IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;

/**
 * @typedef {Object} ArchRule
 * @property {string} id
 * @property {string} description
 * @property {string[]} [onlyIn]
 * @property {string[]} [allow]
 * @property {(relPath: string, importSpec: string) => string|null} matchImport
 */

/** @type {ArchRule[]} */
const RULES = [
  {
    id: "cc-no-format-module",
    description:
      "competition-core must not import format modules (team-tournament, individual-tournament, tournament-engine).",
    onlyIn: ["src/features/competition-core/"],
    matchImport: (_file, spec) =>
      /team-tournament|individual-tournament|tournament-engine/.test(spec) ? spec : null,
  },
  {
    id: "cc-no-legacy-tournament-engines",
    description:
      "competition-core must not import legacy tournament engines under src/tournament/engines/.",
    onlyIn: ["src/features/competition-core/"],
    matchImport: (_file, spec) =>
      /(?:^|\/)(?<!team-)tournament\/engines\//.test(spec.replace(/\\/g, "/")) ? spec : null,
  },
  {
    id: "cc-no-page-logic",
    description: "competition-core must not import page logic or pages/ UI modules.",
    onlyIn: ["src/features/competition-core/"],
    matchImport: (_file, spec) =>
      /\/pages\//.test(spec) || /\.logic(\.|$)/.test(spec) ? spec : null,
  },
  {
    id: "cc-no-react-ui",
    description: "competition-core must not import React or MUI.",
    onlyIn: ["src/features/competition-core/"],
    matchImport: (_file, spec) =>
      /^react$|^react-dom$|^react\//.test(spec) || /^@mui\//.test(spec) ? spec : null,
  },
  {
    id: "cc-no-supabase-gateway",
    description:
      "competition-core domain/application must not import Supabase client gateways directly.",
    onlyIn: ["src/features/competition-core/"],
    matchImport: (_file, spec) =>
      /@supabase\/supabase-js/.test(spec) || /auth\/supabaseClient/.test(spec) ? spec : null,
  },
  {
    id: "cc-no-domain-persistence",
    description:
      "competition-core must not import domain persistence (clubStorage) — use ports in Phase 2B+.",
    onlyIn: ["src/features/competition-core/"],
    matchImport: (_file, spec) =>
      /domain\/clubStorage/.test(spec) ? spec : null,
  },
  {
    id: "engine-no-page-logic",
    description:
      "Domain engines must not import page logic (pages/*.logic.js).",
    onlyIn: [
      "src/tournament/engines/",
      "src/features/team-tournament/engines/",
      "src/ai/",
    ],
    matchImport: (_file, spec) =>
      /\/pages\//.test(spec) || /\.logic(\.|$)/.test(spec) ? spec : null,
  },
  {
    id: "engine-no-react-ui",
    description: "Domain engines must not import React components.",
    onlyIn: [
      "src/tournament/engines/",
      "src/features/team-tournament/engines/",
      "src/ai/",
    ],
    matchImport: (_file, spec) =>
      /^react$|^react-dom$|^react\//.test(spec) ||
      /^@mui\//.test(spec) ||
      /\/components\//.test(spec)
        ? spec
        : null,
  },
];

const DEBT_META = {
  "cc-no-format-module::src/features/competition-core/constraints/adapters/teamTournamentRulesBridge.js":
    {
      reason: "Inverted adapter — core imports TT lineup contract; invert via port in Phase 3A/4.",
      removalPhase: "Phase 2B–3 (draw/formation/rules adapter inversion)",
    },
  "cc-no-format-module::src/features/competition-core/draw/adapters/teamDrawAdapter.js": {
    reason: "Transitional strangler adapter delegates to teamAutoDrawEngine legacy executor.",
    removalPhase: "Phase 3C (draw adapter inversion + DI legacyExecutor)",
  },
  "cc-no-format-module::src/features/competition-core/formation/adapters/teamFormationAdapter.js": {
    reason: "Transitional strangler adapter delegates to teamAutoDrawEngine legacy executor.",
    removalPhase: "Phase 3C (formation adapter inversion)",
  },
  "cc-no-legacy-tournament-engines::src/features/competition-core/rating/competitionEloEngine.js": {
    reason: "Rating bridge reads legacy eloEngine constants/helpers during strangler migration.",
    removalPhase: "Phase 2B (rating port extraction)",
  },
  "cc-no-legacy-tournament-engines::src/features/competition-core/rating/monthlyReviewV2.js": {
    reason: "Monthly review bridge uses skillLevelEngine during rating V2 migration.",
    removalPhase: "Phase 2B (rating port extraction)",
  },
  "cc-no-supabase-gateway::src/features/competition-core/rating/ratingRpcService.js": {
    reason: "Rating RPC adapter reads hasSupabaseConfig and calls injected supabase.rpc — move to persistence port.",
    removalPhase: "Phase 2B (RatingRepository port)",
  },
  "cc-no-domain-persistence::src/features/competition-core/rating/ratingAtomicApply.js": {
    reason: "Blob rating apply path uses clubStorage during V2 migration.",
    removalPhase: "Phase 2B (persistence ports)",
  },
  "cc-no-domain-persistence::src/features/competition-core/rating/ratingServiceV2.js": {
    reason: "Rating service V2 reads/writes club blob via clubStorage during migration.",
    removalPhase: "Phase 2B (persistence ports)",
  },
  "engine-no-page-logic::src/tournament/engines/bracketEngine.js": {
    reason: "Legacy engine imports bracket page logic; extract to domain module.",
    removalPhase: "Phase 2B–3 (extract pages/*.logic to domain)",
  },
  "engine-no-page-logic::src/tournament/engines/scheduleEngine.js": {
    reason: "Legacy engine imports fixtures page logic; extract to domain module.",
    removalPhase: "Phase 2B–3 (extract tournament.fixtures.logic)",
  },
  "engine-no-page-logic::src/tournament/engines/seededGroupEngine.js": {
    reason: "Legacy engine imports seeding page logic; extract to domain module.",
    removalPhase: "Phase 2B–3 (extract tournament.seeding.logic)",
  },
  "engine-no-page-logic::src/tournament/engines/teamPairingEngine.js": {
    reason: "Legacy engine imports seeding page logic; extract to domain module.",
    removalPhase: "Phase 2B–3 (extract tournament.seeding.logic)",
  },
  "engine-no-page-logic::src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js": {
    reason: "TT schedule engine imports fixtures page logic; extract to shared domain scheduling.",
    removalPhase: "Phase 3G (scheduling adapter + fixtures extraction)",
  },
};

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join("/");
}

function isAllowed(relPath, rule) {
  return (rule.allow || []).some((a) => relPath === a || relPath.startsWith(a));
}

function extractImports(content) {
  const specs = [];
  let m;
  STATIC_IMPORT_RE.lastIndex = 0;
  while ((m = STATIC_IMPORT_RE.exec(content)) !== null) {
    specs.push(m[1]);
  }
  return specs;
}

function fingerprint(matches) {
  const norm = [...matches].sort();
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex").slice(0, 16);
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

/** @returns {Map<string, { rule: string, file: string, symbol: string, count: number, fingerprint: string }>} */
function collectViolations() {
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  const found = new Map();

  for (const abs of files) {
    const relPath = rel(abs);
    let content;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const imports = extractImports(content);

    for (const rule of RULES) {
      if (rule.onlyIn && !rule.onlyIn.some((p) => relPath.startsWith(p))) continue;
      if (isAllowed(relPath, rule)) continue;

      const hits = [];
      for (const spec of imports) {
        const hit = rule.matchImport(relPath, spec);
        if (hit) hits.push(hit);
      }
      if (hits.length > 0) {
        found.set(`${rule.id}::${relPath}`, {
          rule: rule.id,
          file: relPath,
          symbol: [...new Set(hits)].join(" | "),
          count: hits.length,
          fingerprint: fingerprint(hits),
        });
      }
    }
  }
  return found;
}

function loadBaseline() {
  try {
    const data = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    const map = new Map();
    for (const e of data.exceptions || []) map.set(`${e.rule}::${e.file}`, e);
    return map;
  } catch {
    return null;
  }
}

function runCli() {
  const mode = process.argv.includes("--init")
    ? "init"
    : process.argv.includes("--report")
      ? "report"
      : "check";

  const current = collectViolations();
  const sortedKeys = [...current.keys()].sort();

  if (mode === "init") {
    const exceptions = sortedKeys.map((k) => {
      const v = current.get(k);
      const meta = DEBT_META[k] || {};
      return {
        rule: v.rule,
        file: v.file,
        symbol: v.symbol,
        count: v.count,
        fingerprint: v.fingerprint,
        reason: meta.reason || "TODO: classify",
        removalPhase: meta.removalPhase || "Phase 2B+",
      };
    });
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        {
          note: "Phase 2A baseline — TEMPORARY DEBT only. Lock fails on NEW files, count increases, or fingerprint changes.",
          generatedAt: new Date().toISOString().slice(0, 10),
          phase: "2A",
          rules: RULES.map((r) => ({ id: r.id, description: r.description })),
          exceptions,
        },
        null,
        2
      ) + "\n"
    );
    console.log(
      `competition-architecture-lock: baseline written with ${exceptions.length} debt exception(s) → ${rel(BASELINE_PATH)}`
    );
    process.exit(0);
  }

  if (mode === "report") {
    console.log(`competition-architecture-lock: ${sortedKeys.length} current violation(s)`);
    for (const k of sortedKeys) {
      const v = current.get(k);
      console.log(`  - ${k}  (count=${v.count}, fp=${v.fingerprint}, symbol=${v.symbol})`);
    }
    process.exit(0);
  }

  const baseline = loadBaseline();
  if (!baseline) {
    console.error(
      "competition-architecture-lock: FAIL — baseline missing. Run `node scripts/ci/competition-architecture-lock.mjs --init`."
    );
    process.exit(1);
  }

  const failures = [];
  for (const k of sortedKeys) {
    const v = current.get(k);
    const base = baseline.get(k);
    if (!base) {
      failures.push(`NEW violation: ${k} (count=${v.count}, symbol=${v.symbol})`);
      continue;
    }
    if (v.count > base.count) {
      failures.push(`NEW occurrence in baselined file: ${k} (was ${base.count}, now ${v.count})`);
      continue;
    }
    if (v.count === base.count && v.fingerprint !== base.fingerprint) {
      failures.push(
        `CHANGED occurrence in baselined file: ${k} (fingerprint ${base.fingerprint} → ${v.fingerprint})`
      );
    }
  }

  const resolved = [...baseline.keys()].filter((k) => !current.has(k));

  if (failures.length > 0) {
    console.error(`competition-architecture-lock: FAIL — ${failures.length} issue(s):`);
    for (const f of failures) console.error(`  + ${f}`);
    process.exit(1);
  }

  console.log(
    `competition-architecture-lock: OK — 0 new/changed violation(s) (debt baseline: ${baseline.size}${resolved.length ? `, resolved: ${resolved.length}` : ""})`
  );
  process.exit(0);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const selfPath = fileURLToPath(import.meta.url);
if (invokedPath && selfPath === invokedPath) {
  runCli();
}

export { RULES, collectViolations, extractImports, DEBT_META };
