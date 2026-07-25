#!/usr/bin/env node
/**
 * PM-ID-01 activation package offline secret scan (no network).
 * Scans activation docs/scripts/tests only. Never prints secret values.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const roots = [
  "docs/player-management/pm-id-01/activation",
  "scripts/player-management/pm-id-01-activation-lib.mjs",
  "scripts/player-management/pm-id-01-activation-preflight.mjs",
  "scripts/player-management/pm-id-01-staging-apply.mjs",
  "scripts/player-management/pm-id-01-activation-secret-scan.mjs",
  "tests/player-management-pm-id-01-activation.test.js",
];

const PEM_BEGIN = ["BEGIN", "PRIVATE", "KEY"].join(" ");
const patterns = [
  { name: "begin_private_key", re: new RegExp(PEM_BEGIN) },
  {
    name: "jwt_like",
    re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  },
  {
    name: "postgres_url_with_creds",
    re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  },
];

function walk(p, acc = []) {
  if (!existsSync(p)) return acc;
  const st = statSync(p);
  if (st.isFile()) {
    acc.push(p);
    return acc;
  }
  for (const n of readdirSync(p)) walk(path.join(p, n), acc);
  return acc;
}

const hits = [];
let files = 0;
for (const r of roots) {
  const abs = path.join(root, r);
  for (const f of walk(abs)) {
    files += 1;
    const text = readFileSync(f, "utf8");
    for (const p of patterns) {
      if (p.re.test(text)) {
        hits.push({ file: path.relative(root, f).replace(/\\/g, "/"), kind: p.name });
      }
    }
  }
}

const report = {
  ok: hits.length === 0,
  secretScanPass: hits.length === 0,
  hits,
  filesScanned: files,
  databaseWrites: 0,
  sqlApplied: false,
  filesDeleted: false,
  CODEX_DELETE_ALLOWED: "NO",
};

console.log(JSON.stringify(report, null, 2));
process.exitCode = hits.length === 0 ? 0 : 1;
