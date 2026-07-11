export const OFFLINE_QUEUE_STATUS = Object.freeze({
  PENDING: "pending",
  SYNCING: "syncing",
  SYNCED: "synced",
  FAILED: "failed",
  CONFLICT: "conflict",
  QUARANTINED: "quarantined",
});

export const OFFLINE_MUTATION_TYPES = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  NOTE: "note",
});

export const LEGACY_UNSCOPED_ERROR = "LEGACY_UNSCOPED";

function createUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function mapTypeToMutation(type) {
  switch (type) {
    case "checkin":
      return OFFLINE_MUTATION_TYPES.CREATE;
    case "referee_note":
      return OFFLINE_MUTATION_TYPES.NOTE;
    case "match_score":
      return OFFLINE_MUTATION_TYPES.UPDATE;
    default:
      return OFFLINE_MUTATION_TYPES.UPDATE;
  }
}

export function mapTypeToEntityType(type) {
  switch (type) {
    case "checkin":
      return "checkin";
    case "referee_note":
      return "referee_note";
    case "match_score":
      return "match_score";
    default:
      return String(type || "unknown");
  }
}

export function normalizeQueueEntry(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const type = raw.type || raw.entityType || "unknown";
  const userId = raw.userId || raw.user_id || null;
  const tenantId = raw.tenantId || raw.tenant_id || null;
  const clubId = raw.clubId || raw.club_id || null;
  const requestId = raw.requestId || raw.request_id || null;
  const entityScopeId = raw.entityScopeId || raw.entity_scope_id || clubId || tenantId || null;

  let status = raw.status || OFFLINE_QUEUE_STATUS.PENDING;
  let lastError = raw.lastError || raw.last_error || null;

  if (!userId || !tenantId) {
    status = OFFLINE_QUEUE_STATUS.QUARANTINED;
    lastError = lastError || LEGACY_UNSCOPED_ERROR;
  }

  return {
    id: raw.id || createUuid(),
    requestId: requestId || createUuid(),
    userId,
    tenantId,
    clubId,
    entityScopeId,
    entityType: raw.entityType || raw.entity_type || mapTypeToEntityType(type),
    entityId: raw.entityId || raw.entity_id || raw.payload?.entityId || raw.payload?.matchId || null,
    mutationType: raw.mutationType || raw.mutation_type || mapTypeToMutation(type),
    type,
    payload: raw.payload || {},
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    attempts: Number(raw.attempts ?? raw.retry_count ?? 0),
    status,
    lastError,
    conflictVersion: raw.conflictVersion ?? raw.conflict_version ?? null,
    syncedAt: raw.syncedAt || raw.synced_at || null,
  };
}

export function normalizeQueueEntries(entries) {
  return (entries || []).map(normalizeQueueEntry).filter(Boolean);
}

export function createScopedQueueEntry({
  type,
  payload,
  userId,
  tenantId,
  clubId = null,
  entityId = null,
}) {
  const scopeClubId = clubId || payload?.clubId || null;
  const scopeTenantId = tenantId || payload?.tenantId || null;

  return {
    id: createUuid(),
    requestId: createUuid(),
    userId,
    tenantId: scopeTenantId,
    clubId: scopeClubId,
    entityScopeId: scopeClubId || scopeTenantId,
    entityType: mapTypeToEntityType(type),
    entityId: entityId || payload?.entityId || payload?.matchId || null,
    mutationType: mapTypeToMutation(type),
    type,
    payload: payload || {},
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: OFFLINE_QUEUE_STATUS.PENDING,
    lastError: null,
    conflictVersion: null,
    syncedAt: null,
  };
}

export function entryMatchesSession(entry, { userId, tenantId }) {
  if (!entry || entry.status === OFFLINE_QUEUE_STATUS.QUARANTINED) {
    return false;
  }
  if (!entry.userId || !entry.tenantId) {
    return false;
  }
  if (!userId || !tenantId) {
    return false;
  }
  return entry.userId === userId && entry.tenantId === tenantId;
}

export function isFlushableEntry(entry) {
  if (!entry) {
    return false;
  }
  if (entry.status === OFFLINE_QUEUE_STATUS.SYNCED) {
    return false;
  }
  if (entry.status === OFFLINE_QUEUE_STATUS.QUARANTINED) {
    return false;
  }
  return (
    entry.status === OFFLINE_QUEUE_STATUS.PENDING ||
    entry.status === OFFLINE_QUEUE_STATUS.FAILED
  );
}
