#!/usr/bin/env node
/**
 * Offline secret scan for CRM Phase 1H-B artifacts.
 * Aligns with Phase 1H-A patterns: detect credential material, not prose mentions.
 * Never prints secret values.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const patterns = [
  { name: "supabase_service_role_key_literal", re: /supabase_service_role/i },
  { name: "begin_private_key", re: /BEGIN PRIVATE KEY/ },
  { name: "jwt_alg_header", re: /eyJhbGciOiJ/ },
  { name: "assigned_password", re: /password\s*=\s*['"][^'"]{8,}/i },
  { name: "postgres_url_with_creds", re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i },
];

const jwtLike =
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/;

const roots = [
  "docs/crm/phase-1h-b",
  "src/features/crm/staging",
  "scripts/crm/phase-1h-staging-apply.mjs",
  "scripts/crm/phase-1h-staging-preflight.mjs",
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const hits = [];
for (const rel of roots) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) continue;
  const files = statSync(abs).isDirectory() ? walk(abs) : [abs];
  for (const file of files) {
    if (file.endsWith(".png") || file.endsWith(".jpg")) continue;
    const text = readFileSync(file, "utf8");
    const relFile = path.relative(root, file);
    if (jwtLike.test(text)) {
      hits.push({ file: relFile, kind: "jwt_like" });
    }
    for (const p of patterns) {
      if (p.re.test(text)) {
        hits.push({ file: relFile, kind: p.name });
      }
    }
  }
}

const report = {
  ok: hits.length === 0,
  hits,
  scannedRoots: roots,
  secretsPrinted: false,
};
console.log(JSON.stringify(report, null, 2));
process.exit(hits.length ? 1 : 0);
