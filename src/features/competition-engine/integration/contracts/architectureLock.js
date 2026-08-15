/**
 * Architecture lock helpers for Canonical Competition Adapter Contracts v1.
 * Prevents future drift without performing a legacy cutover.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  COMPETITION_COURT_ADAPTER_AUTHORITATIVE_IMPORT_PATH,
} from "../../../competition-core/contracts/competitionCourtAdapterContract.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
} from "../referee/constants.js";
import {
  COURT_CONTRACT_PROTECTED_PATHS,
  REFEREE_CONTRACT_PROTECTED_PATHS,
  WORKSTREAM_OWNED_CONTRACT_IDS,
} from "./kernel/constants.js";
import { WORKSTREAM_CONTRACT_DEFINITIONS } from "./definitions.js";

const SCAN_EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);
const IGNORE_DIRS = new Set(["node_modules", "dist", ".git", "coverage"]);

const MODE_ROOTS = [
  "src/tournament/",
  "src/features/team-tournament/",
  "src/features/individual-tournament/",
  "src/pages/tournament/",
];

const CONTRACTS_ROOT =
  "src/features/competition-engine/integration/contracts/";

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

function relFrom(root, abs) {
  return path.relative(root, abs).split(path.sep).join("/");
}

export function listSourceFiles(rootAbs, relativeDir) {
  const files = [];
  walk(path.join(rootAbs, relativeDir), files);
  return files.map((abs) => relFrom(rootAbs, abs));
}

export function readRepoFile(rootAbs, relativePath) {
  return readFileSync(path.join(rootAbs, relativePath), "utf8");
}

export function collectAlternateContractDefinitions(rootAbs) {
  const hits = [];
  for (const modeRoot of MODE_ROOTS) {
    const files = [];
    walk(path.join(rootAbs, modeRoot), files);
    for (const abs of files) {
      const rel = relFrom(rootAbs, abs);
      const content = readFileSync(abs, "utf8");
      for (const id of WORKSTREAM_OWNED_CONTRACT_IDS) {
        if (content.includes(id)) {
          hits.push({ file: rel, contractId: id });
        }
      }
    }
  }
  return hits;
}

export function collectPrivatePersistenceImports(rootAbs) {
  const files = [];
  walk(path.join(rootAbs, CONTRACTS_ROOT), files);
  const hits = [];
  const forbidden = [
    "domain/clubStorage",
    "auth/supabaseClient",
    "@supabase/supabase-js",
  ];
  const importRe =
    /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const abs of files) {
    const rel = relFrom(rootAbs, abs);
    const content = readFileSync(abs, "utf8");
    importRe.lastIndex = 0;
    let match;
    while ((match = importRe.exec(content)) !== null) {
      const spec = match[1];
      for (const needle of forbidden) {
        if (spec.includes(needle)) {
          hits.push({ file: rel, spec });
        }
      }
    }
  }
  return hits;
}

export function lockedContractIdSet() {
  return new Set(WORKSTREAM_OWNED_CONTRACT_IDS);
}

export function lockedDefinitions() {
  return WORKSTREAM_CONTRACT_DEFINITIONS;
}

export function courtAuthoritativePath() {
  return COMPETITION_COURT_ADAPTER_AUTHORITATIVE_IMPORT_PATH;
}

export function refereeContractId() {
  return COMPETITION_REFEREE_ADAPTER_CONTRACT_ID;
}

export function isProtectedCourtOrRefereePath(relativePath) {
  const normalized = String(relativePath || "").split(path.sep).join("/");
  return (
    COURT_CONTRACT_PROTECTED_PATHS.includes(normalized) ||
    REFEREE_CONTRACT_PROTECTED_PATHS.includes(normalized) ||
    normalized === COMPETITION_COURT_ADAPTER_AUTHORITATIVE_IMPORT_PATH
  );
}
