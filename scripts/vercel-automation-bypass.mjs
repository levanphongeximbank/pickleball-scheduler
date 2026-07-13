/**
 * Resolve Vercel Deployment Protection bypass for Preview automation.
 * Never logs the secret value.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DEFAULT_TEAM = "pickleball-scheduler";
const DEFAULT_PROJECT = "pickleball-scheduler-tt6-realtime-sync";

function readVercelCliToken() {
  const candidates = [
    path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"),
    path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const token = data.token || data.credentials?.[0]?.token || "";
    if (token) {
      return token;
    }
  }
  return "";
}

function pickEnvVarBypass() {
  return String(
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS || "",
  ).trim();
}

/**
 * @param {{ team?: string, project?: string }} [opts]
 */
export async function resolveVercelAutomationBypass(opts = {}) {
  const fromEnv = pickEnvVarBypass();
  if (fromEnv) {
    return { configured: true, source: "env", secret: fromEnv };
  }

  const token = readVercelCliToken();
  if (!token) {
    return { configured: false, source: "none", secret: "" };
  }

  const team = opts.team || DEFAULT_TEAM;
  const project = opts.project || DEFAULT_PROJECT;
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${project}?teamId=${team}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    return { configured: false, source: "api_error", secret: "" };
  }

  const body = await res.json();
  const bypassMap = body.protectionBypass || {};
  const envEntry = Object.entries(bypassMap).find(([, meta]) => meta?.isEnvVar);
  const secret = envEntry?.[0] || Object.keys(bypassMap)[0] || "";
  if (!secret) {
    return { configured: false, source: "api_missing", secret: "" };
  }

  return { configured: true, source: "vercel_api", secret };
}

export function getVercelBypassHeaders(secret) {
  if (!secret) {
    return {};
  }
  return {
    "x-vercel-protection-bypass": secret,
    "x-vercel-set-bypass-cookie": "true",
  };
}

/**
 * @param {string} previewUrl
 * @param {string} secret
 */
export async function probeVercelProtection(previewUrl, secret) {
  const base = String(previewUrl || "").replace(/\/+$/, "");
  if (!base) {
    return {
      protectionPassed: false,
      failureClass: "protection_blocked",
      detail: "Missing preview URL",
      httpStatus: 0,
    };
  }

  const headers = getVercelBypassHeaders(secret);
  if (!secret) {
    const unauth = await fetch(`${base}/login`, { redirect: "manual" });
    const location = unauth.headers.get("location") || "";
    const blocked = unauth.status === 302 && location.includes("vercel.com");
    return {
      protectionPassed: false,
      failureClass: "protection_blocked",
      detail: blocked
        ? "Vercel SSO redirect without bypass"
        : "VERCEL_AUTOMATION_BYPASS_SECRET not configured",
      httpStatus: unauth.status,
    };
  }

  const first = await fetch(`${base}/login`, { headers, redirect: "manual" });
  const firstLocation = first.headers.get("location") || "";
  if (first.status >= 300 && first.status < 400 && firstLocation.includes("vercel.com")) {
    return {
      protectionPassed: false,
      failureClass: "protection_blocked",
      detail: "Bypass rejected — still redirected to Vercel SSO",
      httpStatus: first.status,
    };
  }

  const second = await fetch(`${base}/login`, { headers, redirect: "manual" });
  const text = await second.text();
  const blocked =
    second.url?.includes("vercel.com/login") ||
    (text.includes("Authentication Required") && text.includes("Vercel"));
  const hasApp =
    /Pickleball Scheduler|đăng nhập|Email|Mật khẩu/i.test(text) && !blocked;

  return {
    protectionPassed: !blocked && hasApp,
    failureClass: blocked ? "protection_blocked" : hasApp ? null : "network_failed",
    detail: blocked
      ? "Deployment Protection HTML after bypass"
      : hasApp
        ? `App login reachable (HTTP ${second.status})`
        : `Unexpected login body (HTTP ${second.status})`,
    httpStatus: second.status,
  };
}
