/**
 * Resolve staging-apply evidence output directory.
 *
 * Env override: PICK_VN_STAGING_EVIDENCE_DIR
 * - unset / empty / whitespace → canonical tracked docs path under repoRoot
 * - absolute path → normalize and use as-is (tests pass os.tmpdir() here)
 * - relative path → resolve against cwd
 *
 * Production / Owner live runs omit the env → write to canonical docs paths.
 */
import path from "node:path";

export const PICK_VN_STAGING_EVIDENCE_DIR_ENV = "PICK_VN_STAGING_EVIDENCE_DIR";

/**
 * @param {{
 *   repoRoot: string,
 *   canonicalRelativeDir: string,
 *   env?: NodeJS.ProcessEnv,
 *   cwd?: string,
 * }} options
 * @returns {string} absolute evidence directory
 */
export function resolveStagingEvidenceDir({
  repoRoot,
  canonicalRelativeDir,
  env = process.env,
  cwd = process.cwd(),
}) {
  if (!repoRoot || typeof repoRoot !== "string") {
    throw new Error("resolveStagingEvidenceDir: repoRoot is required");
  }
  if (!canonicalRelativeDir || typeof canonicalRelativeDir !== "string") {
    throw new Error("resolveStagingEvidenceDir: canonicalRelativeDir is required");
  }

  const raw = String(env?.[PICK_VN_STAGING_EVIDENCE_DIR_ENV] ?? "").trim();
  if (!raw) {
    return path.join(repoRoot, canonicalRelativeDir);
  }
  return path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(cwd, raw);
}
