import { SESSION_STATUS, SESSION_TYPE } from "../constants/statuses.js";
import { getDefaultSessionConfig } from "../constants/playModes.js";

export function normalizeCourtSession(raw = {}) {
  const id = String(raw.id || "").trim();
  return {
    id,
    tenantId: raw.tenantId ? String(raw.tenantId) : null,
    clubId: String(raw.clubId || "").trim(),
    name: String(raw.name || "Phiên điều phối sân").trim(),
    sessionType: Object.values(SESSION_TYPE).includes(raw.sessionType)
      ? raw.sessionType
      : SESSION_TYPE.SOCIAL,
    status: Object.values(SESSION_STATUS).includes(raw.status)
      ? raw.status
      : SESSION_STATUS.DRAFT,
    startTime: raw.startTime || null,
    endTime: raw.endTime || null,
    createdBy: raw.createdBy ? String(raw.createdBy) : null,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    config: { ...getDefaultSessionConfig(), ...(raw.config || {}) },
    checkIns: Array.isArray(raw.checkIns) ? raw.checkIns : [],
    queue: Array.isArray(raw.queue) ? raw.queue : [],
    assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
    refereeAssignments: Array.isArray(raw.refereeAssignments) ? raw.refereeAssignments : [],
    transferLogs: Array.isArray(raw.transferLogs) ? raw.transferLogs : [],
    events: Array.isArray(raw.events) ? raw.events : [],
    courtStates: raw.courtStates && typeof raw.courtStates === "object" ? raw.courtStates : {},
  };
}

export function createCourtSession({
  clubId,
  tenantId = null,
  name = "Phiên điều phối sân",
  sessionType = SESSION_TYPE.SOCIAL,
  createdBy = null,
  config = {},
} = {}) {
  const now = new Date().toISOString();
  const id = `cs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return normalizeCourtSession({
    id,
    clubId,
    tenantId,
    name,
    sessionType,
    status: SESSION_STATUS.DRAFT,
    createdBy,
    createdAt: now,
    updatedAt: now,
    config: { ...getDefaultSessionConfig(), ...config },
    checkIns: [],
    queue: [],
    assignments: [],
    refereeAssignments: [],
    transferLogs: [],
    events: [],
    courtStates: {},
  });
}
