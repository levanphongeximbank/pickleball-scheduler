import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { guardPermission } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { rpcListAuditLogs } from "./identityRpcService.js";
export const AUDIT_ACTIONS = Object.freeze({
  LOGIN: "login",
  LOGIN_FAILED: "login_failed",
  LOGOUT: "logout",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  ASSIGN_ROLE: "assign_role",
  PERMISSION_CHANGE: "permission_change",
  PASSWORD_CHANGE: "password_change",
  RESET_PASSWORD: "reset_password",
});

const AUDIT_TABLE = "audit_logs";
const DEV_AUDIT_KEY = "pickleball-audit-logs-v1";
const DEV_AUDIT_CAP = 500;

function getClientContext() {
  if (typeof navigator !== "undefined") {
    return {
      userAgent: String(navigator.userAgent || "").slice(0, 512),
    };
  }
  return { userAgent: "" };
}

function sanitizeMetadata(metadata = {}) {
  const blocked = new Set([
    "password",
    "currentPassword",
    "newPassword",
    "token",
    "accessToken",
    "refreshToken",
    "resetToken",
  ]);

  return Object.entries(metadata).reduce((accumulator, [key, value]) => {
    if (blocked.has(key)) {
      return accumulator;
    }
    if (typeof value === "string" && value.length > 500) {
      accumulator[key] = `${value.slice(0, 500)}…`;
      return accumulator;
    }
    accumulator[key] = value;
    return accumulator;
  }, {});
}

function loadDevAuditLogs() {
  try {
    const raw = localStorage.getItem(DEV_AUDIT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDevAuditLogs(entries) {
  localStorage.setItem(
    DEV_AUDIT_KEY,
    JSON.stringify(entries.slice(-DEV_AUDIT_CAP))
  );
}

/**
 * Ghi audit log — Supabase khi có config, fallback localStorage dev.
 */
export async function writeAuditLog({
  action,
  resourceType = "",
  resourceId = "",
  venueId = null,
  clubId = null,
  metadata = {},
  actor = null,
} = {}) {
  if (!action) {
    return { ok: false, error: "Thiếu action.", code: "INVALID_ACTION" };
  }

  const currentUser = actor || getCurrentUser();
  const { userAgent } = getClientContext();
  const row = {
    action,
    resource_type: String(resourceType || ""),
    resource_id: String(resourceId || ""),
    venue_id: venueId || currentUser?.venueId || null,
    club_id: clubId || currentUser?.clubId || null,
    actor_email: currentUser?.email || "",
    metadata: sanitizeMetadata(metadata),
    user_agent: userAgent,
    ip_address: "",
    created_at: new Date().toISOString(),
  };

  if (currentUser?.id) {
    row.actor_id = currentUser.id;
  }

  if (!hasSupabaseConfig()) {
    const devEntry = {
      id: `audit-${Date.now()}`,
      ...row,
      actor_id: currentUser?.id || null,
    };
    const logs = loadDevAuditLogs();
    logs.push(devEntry);
    saveDevAuditLogs(logs);
    return { ok: true, entry: devEntry, provider: "dev" };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa sẵn sàng.", code: "NO_SUPABASE" };
  }

  const { data, error } = await client.from(AUDIT_TABLE).insert(row).select("*").single();

  if (error) {
    const devEntry = { id: `audit-fallback-${Date.now()}`, ...row };
    const logs = loadDevAuditLogs();
    logs.push(devEntry);
    saveDevAuditLogs(logs);
    return { ok: true, entry: devEntry, provider: "dev-fallback", warning: error.message };
  }

  return { ok: true, entry: data, provider: "supabase" };
}

export async function listAuditLogs({ limit = 50, actorId = null, action = "", venueId = null } = {}) {
  const check = guardPermission(PERMISSIONS.USER_MANAGE, {});
  if (!check.ok) {
    return check;
  }

  const capped = Math.min(Math.max(limit, 1), 200);

  if (!hasSupabaseConfig()) {
    let logs = loadDevAuditLogs();
    if (actorId) {
      logs = logs.filter((entry) => entry.actor_id === actorId);
    }
    if (action) {
      logs = logs.filter((entry) => entry.action === action);
    }
    return { ok: true, logs: logs.slice(-capped).reverse(), provider: "dev" };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa sẵn sàng.", code: "NO_SUPABASE" };
  }

  const rpcResult = await rpcListAuditLogs({
    limit: capped,
    action,
    venueId,
  });

  if (rpcResult.ok) {
    let logs = rpcResult.logs || [];
    if (actorId) {
      logs = logs.filter((entry) => entry.actor_id === actorId);
    }
    return { ok: true, logs, provider: "rpc" };
  }

  if (rpcResult.code !== "RPC_NOT_DEPLOYED") {
    return rpcResult;
  }

  let query = client
    .from(AUDIT_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(capped);

  if (actorId) {
    query = query.eq("actor_id", actorId);
  }

  const { data, error } = await query;
  if (error) {
    return { ok: false, error: error.message, code: "AUDIT_FETCH_FAILED" };
  }

  return { ok: true, logs: data || [], provider: "supabase" };
}
