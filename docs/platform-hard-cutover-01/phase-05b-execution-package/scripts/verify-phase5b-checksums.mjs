/**
 * Phase 5B checksum verifier (V2).
 * Authoritative: sha256ExactGitBlobBytes from staged (:path) or HEAD blob bytes.
 * Secondary: sha256CanonicalLf (must match LF normalization of those exact bytes).
 * No network. No database access.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");
const ROOT = path.resolve(PKG, "../../..");
const MANIFEST_REL =
  "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json";
const UNIFIED_REL =
  "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json";

function sha256Exact(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}

function sha256CanonicalLf(buf) {
  const t = buf.toString("utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(Buffer.from(t, "utf8")).digest("hex").toUpperCase();
}

function resolveExactBytes(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  // Prefer staged index blob, then HEAD blob, then working tree exact bytes.
  for (const spec of [`:${norm}`, `HEAD:${norm}`]) {
    const oidR = spawnSync("git", ["rev-parse", "--verify", "--quiet", spec], {
      cwd: ROOT,
      encoding: "utf8",
    });
    if (oidR.status !== 0) continue;
    const oid = oidR.stdout.trim();
    if (!oid) continue;
    const blob = spawnSync("git", ["cat-file", "blob", oid], {
      cwd: ROOT,
      encoding: "buffer",
    });
    if (blob.status === 0 && blob.stdout?.length) {
      return { bytes: blob.stdout, source: spec.startsWith(":") ? "INDEX" : "HEAD" };
    }
  }
  const abs = path.join(ROOT, norm);
  if (!fs.existsSync(abs)) return null;
  return { bytes: fs.readFileSync(abs), source: "WORKING_TREE" };
}

function main() {
  const errors = [];
  const fail = (m) => errors.push(m);

  const manifestPath = path.join(ROOT, MANIFEST_REL);
  if (!fs.existsSync(manifestPath)) {
    console.error(`FAIL: missing ${MANIFEST_REL}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.checksumFieldAuthoritative !== "sha256ExactGitBlobBytes") {
    fail("checksumFieldAuthoritative must be sha256ExactGitBlobBytes");
  }
  if (!manifest?.files?.length) fail("checksum manifest has no files");

  const seen = new Set();
  const listed = new Set();

  for (const entry of manifest.files || []) {
    if (!entry?.path) {
      fail(`invalid entry missing path: ${JSON.stringify(entry)}`);
      continue;
    }
    const p = entry.path.replace(/\\/g, "/");
    if (seen.has(p)) fail(`duplicate path: ${p}`);
    seen.add(p);
    listed.add(p);

    const exact = entry.sha256ExactGitBlobBytes;
    if (!exact) {
      fail(`missing sha256ExactGitBlobBytes for ${p}`);
      continue;
    }
    if (entry.sha256 && entry.sha256 !== "SELF" && entry.sha256ExactGitBlobBytes) {
      if (String(entry.sha256).toUpperCase() !== String(entry.sha256ExactGitBlobBytes).toUpperCase()) {
        fail(`legacy sha256 conflicts with sha256ExactGitBlobBytes: ${p}`);
      }
    }

    const resolved = resolveExactBytes(p);
    if (!resolved) {
      fail(`missing file/blob: ${p}`);
      continue;
    }
    const gotExact = sha256Exact(resolved.bytes);
    if (gotExact !== String(exact).toUpperCase()) {
      fail(
        `exact-byte mismatch (${resolved.source}): ${p} expected=${exact} got=${gotExact}`
      );
    }
    if (entry.sha256CanonicalLf) {
      const gotLf = sha256CanonicalLf(resolved.bytes);
      if (gotLf !== String(entry.sha256CanonicalLf).toUpperCase()) {
        fail(`canonical-LF mismatch: ${p} expected=${entry.sha256CanonicalLf} got=${gotLf}`);
      }
    }
    // Never allow canonical-LF value to be stored as the exact field when bytes differ
    if (entry.sha256CanonicalLf && entry.sha256ExactGitBlobBytes) {
      const lfOfExact = sha256CanonicalLf(resolved.bytes);
      const exactOfBytes = sha256Exact(resolved.bytes);
      if (
        String(entry.sha256ExactGitBlobBytes).toUpperCase() ===
          String(entry.sha256CanonicalLf).toUpperCase() &&
        exactOfBytes !== lfOfExact
      ) {
        fail(`exact/LF fields identical but byte forms differ: ${p}`);
      }
    }
  }

  const sqlRoot = path.join(PKG, "sql");
  function walk(dir, relBase) {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const rel = `docs/platform-hard-cutover-01/phase-05b-execution-package/${relBase}/${name}`.replace(
        /\\/g,
        "/"
      );
      if (fs.statSync(abs).isDirectory()) {
        walk(abs, `${relBase}/${name}`);
        continue;
      }
      if (!listed.has(rel)) fail(`extra unmanifested file: ${rel}`);
    }
  }
  if (fs.existsSync(sqlRoot)) walk(sqlRoot, "sql");

  const rules = manifest.orderedApplyRules || {};
  const nonExec = manifest.nonExecutionCandidates || {};
  for (const [family, ordered] of Object.entries(rules)) {
    if (!Array.isArray(ordered)) {
      fail(`orderedApplyRules.${family} not array`);
      continue;
    }
    if (family === "m11") {
      if (ordered.length !== 0) {
        fail("m11 orderedApply must be empty (VERIFY_ONLY_ALREADY_EQUIVALENT)");
      }
      continue;
    }
    if (!ordered.length) fail(`orderedApplyRules.${family} empty`);
    const nums = ordered.map((n) => parseInt(n, 10));
    for (let i = 1; i < nums.length; i++) {
      if (!(nums[i] > nums[i - 1])) {
        fail(`apply order not strictly increasing for ${family}: ${ordered[i - 1]} -> ${ordered[i]}`);
      }
    }
    for (const name of ordered) {
      if (/^90_|^99_/.test(name)) fail(`${family} apply includes rollback/verify: ${name}`);
      if ((nonExec[family] || []).includes(name)) {
        fail(`candidate-only SQL in executable order (${family}): ${name}`);
      }
    }
    const dir =
      family === "m9" ? "sql/m9-team-tournament" : family === "m10" ? "sql/m10-referee-v5" : null;
    if (dir) {
      for (const name of ordered) {
        const rel = `docs/platform-hard-cutover-01/phase-05b-execution-package/${dir}/${name}`;
        if (!resolveExactBytes(rel)) fail(`missing ordered file: ${rel}`);
        if (!listed.has(rel)) fail(`ordered file not in checksum manifest: ${rel}`);
      }
    }
  }

  for (const name of [
    "190_TT5D_ASSIGNMENT_SAFETY.sql",
    "200_TT5D_REOPEN_RESULT.sql",
    "210_TT5D_CORRECTION.sql",
    "220_TT5D_SECURITY_GUARDS.sql",
  ]) {
    if (!(nonExec.m9 || []).includes(name)) {
      fail(`TT5D candidate missing from nonExecutionCandidates.m9: ${name}`);
    }
    if ((rules.m9 || []).includes(name)) fail(`TT5D in executable m9 order: ${name}`);
  }

  const unifiedPath = path.join(ROOT, UNIFIED_REL);
  if (!fs.existsSync(unifiedPath)) fail("missing M0_M11_EXECUTION_MANIFEST.json");
  else {
    const u = JSON.parse(fs.readFileSync(unifiedPath, "utf8"));
    if (u.checksumFieldAuthoritative !== "sha256ExactGitBlobBytes") {
      fail("unified manifest missing authoritative checksum field");
    }
    if (u.phase5bDecision !== "BLOCKED_PHASE5B_EXECUTION_PACKAGE") {
      fail("unified decision must remain BLOCKED_PHASE5B_EXECUTION_PACKAGE");
    }
    if (u.families?.M11?.productionRunbookAction !== "VERIFY_ONLY_ALREADY_EQUIVALENT") {
      fail("M11 productionRunbookAction must be VERIFY_ONLY_ALREADY_EQUIVALENT");
    }
    if ((u.families?.M9?.exactOrderedApplyFiles || []).length !== (rules.m9 || []).length) {
      fail("M9 executable count mismatch vs orderedApplyRules.m9");
    }
    const m9b = u.executionSequence?.find((s) => String(s.step).startsWith("M9B"));
    for (const p of m9b?.orderedApply || []) {
      if (/TT5D/i.test(p)) fail(`TT5D path in M9B executable sequence: ${p}`);
    }
    const bad = /(\.\.|\*|\bpackages\b|10\.\.50|phase-1g\/10\.\.60)/i;
    for (const [fam, rec] of Object.entries(u.families || {})) {
      const apply = rec.exactOrderedApplyFiles;
      if (typeof apply === "string") fail(`${fam} exactOrderedApplyFiles still string/non-exact`);
      if (Array.isArray(apply)) {
        for (const item of apply) {
          const p = typeof item === "string" ? item : item?.path;
          if (!p || bad.test(p) || /\/$/.test(p)) fail(`${fam} non-exact apply path: ${p}`);
          if (!item?.sha256ExactGitBlobBytes && typeof item === "object") {
            fail(`${fam} apply entry missing sha256ExactGitBlobBytes: ${p}`);
          }
        }
      }
      for (const field of ["verifyArtefact", "rollbackArtefact"]) {
        const v = rec[field];
        if (typeof v === "string" && bad.test(v)) fail(`${fam} ${field} non-exact: ${v}`);
      }
    }
  }

  if (errors.length) {
    for (const e of errors) console.error(`FAIL: ${e}`);
    console.error(`Phase 5B checksum verifier V2: ${errors.length} error(s)`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `PASS Phase 5B checksum verifier V2: ${listed.size} files, exact git-blob bytes OK, TT5D excluded`
  );
}

main();
