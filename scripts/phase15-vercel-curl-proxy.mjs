/**
 * Vercel Preview HTTP via `vercel curl` (bypasses Deployment Protection when CLI is authenticated).
 * Used by Phase 15 browser QA — never logs secrets.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_DEPLOYMENT =
  "https://pickleball-scheduler-git-v5-platfor-47ef4a-pickleball-scheduler.vercel.app";

/** @type {Map<string, { ok: boolean, status: number, headers: Record<string,string>, body: string, error: string|null }>} */
const curlCache = new Map();

export function getPhase15DeploymentUrl() {
  const raw = String(process.env.STAGING_PREVIEW_URL || DEFAULT_DEPLOYMENT).trim();
  return raw.replace(/\/+$/, "");
}

/**
 * @param {string} endpoint - path + optional query, e.g. `/login` or `/assets/foo.js`
 * @param {{ method?: string, deployment?: string }} [opts]
 */
export function vercelCurlRequest(endpoint, opts = {}) {
  const deployment = (opts.deployment || getPhase15DeploymentUrl()).replace(/\/+$/, "");
  let pathPart = String(endpoint || "/").trim();
  if (!pathPart.startsWith("/")) {
    pathPart = `/${pathPart}`;
  }

  const cacheKey = `${deployment}${pathPart}`;
  if (!opts.skipCache && curlCache.has(cacheKey)) {
    return curlCache.get(cacheKey);
  }

  const args = [
    "vercel",
    "curl",
    "--yes",
    pathPart,
    "--deployment",
    deployment,
    "--",
    "-sS",
    "-D",
    "-",
    "-o",
    "-",
  ];

  if (opts.method && opts.method !== "GET") {
    args.splice(4, 0, "-X", opts.method);
  }

  const proc = spawnSync("npx", args, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    shell: process.platform === "win32",
  });

  if (proc.error) {
    return { ok: false, status: 0, headers: {}, body: "", error: proc.error.message };
  }

  if (proc.status !== 0) {
    const stderr = String(proc.stderr || "").trim();
    return {
      ok: false,
      status: proc.status ?? 1,
      headers: {},
      body: String(proc.stdout || ""),
      error: stderr || `vercel curl exit ${proc.status}`,
    };
  }

  const raw = String(proc.stdout || "");
  const sep = raw.search(/\r?\n\r?\n/);
  if (sep === -1) {
    return { ok: true, status: 200, headers: {}, body: raw, error: null };
  }

  const headerBlock = raw.slice(0, sep);
  const body = raw.slice(sep).replace(/^\r?\n/, "");
  const statusLine = headerBlock.split(/\r?\n/).find((line) => line.startsWith("HTTP/"));
  const statusMatch = statusLine?.match(/HTTP\/[\d.]+ (\d+)/);
  const status = statusMatch ? Number(statusMatch[1]) : 200;

  /** @type {Record<string, string>} */
  const headers = {};
  for (const line of headerBlock.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
  }

  const protectionBlocked =
    body.includes("Authentication Required") ||
    body.includes("Log in to Vercel") ||
    (body.includes("vercel.com/login") && !body.includes("Pickleball Scheduler"));

  const result = {
    ok: status >= 200 && status < 400 && !protectionBlocked,
    status,
    headers,
    body,
    error: protectionBlocked ? "vercel_deployment_protection" : null,
  };

  if (!opts.skipCache && result.ok) {
    curlCache.set(cacheKey, result);
  }

  return result;
}
