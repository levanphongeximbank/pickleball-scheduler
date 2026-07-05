import { writeAuditLog } from "../../identity/services/auditService.js";

const DEV_TEAM_AUDIT_KEY = "pickleball-team-tournament-audit-v1";
const DEV_TEAM_AUDIT_CAP = 500;

function loadDevLogs() {
  try {
    const raw = localStorage.getItem(DEV_TEAM_AUDIT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDevLogs(logs) {
  try {
    localStorage.setItem(
      DEV_TEAM_AUDIT_KEY,
      JSON.stringify(logs.slice(0, DEV_TEAM_AUDIT_CAP))
    );
  } catch {
    // ignore storage failures in tests
  }
}

export function appendTeamAuditLog({
  action,
  targetId = null,
  metadata = {},
  actorUserId = null,
}) {
  const entry = {
    id: `team-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    entityType: "team_tournament",
    targetId,
    metadata,
    actorUserId,
    createdAt: new Date().toISOString(),
  };

  if (typeof localStorage !== "undefined") {
    const logs = loadDevLogs();
    logs.unshift(entry);
    saveDevLogs(logs);
  }

  writeAuditLog({
    action,
    resourceType: "team_tournament",
    resourceId: targetId,
    metadata,
  }).catch(() => {
    // audit is best-effort
  });

  return entry;
}

export function listTeamAuditLogs(limit = 100) {
  if (typeof localStorage === "undefined") {
    return [];
  }

  return loadDevLogs().slice(0, limit);
}
