/**
 * Mobile inbox compatibility adapter (Phase 1.4).
 *
 * Prefers canonical cloud inbox; merges legacy mobile notifications without duplicates.
 * Dedup keys: eventId, idempotencyKey, or legacy payload event markers.
 */
import {
  listInbox,
  markNotificationRead as markCanonicalRead,
} from "../services/notificationInboxService.js";
import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";

function canonicalDedupeKey(item) {
  return (
    item?.eventId ||
    item?.idempotencyKey ||
    (item?.sourceEntityType && item?.sourceEntityId
      ? `${item.sourceEntityType}:${item.sourceEntityId}:${item.eventType || ""}`
      : null) ||
    item?.id ||
    item?.notificationId ||
    null
  );
}

function legacyDedupeKey(row) {
  const payload = row?.payload_json || row?.payload || {};
  return (
    payload.eventId ||
    payload.idempotencyKey ||
    payload.canonicalEventId ||
    (payload.sourceEntityType && payload.sourceEntityId
      ? `${payload.sourceEntityType}:${payload.sourceEntityId}:${payload.eventType || row.type || ""}`
      : null) ||
    row?.id ||
    null
  );
}

function normalizeCanonical(item) {
  return {
    id: item.id || item.notificationId,
    source: "canonical",
    title: item.title || "Thông báo",
    body: item.message || item.body || "",
    message: item.message || "",
    status: item.status,
    read: item.status === NOTIFICATION_STATUSES.READ || Boolean(item.readAt),
    created_at: item.createdAt || item.created_at,
    createdAt: item.createdAt || item.created_at,
    category: item.category || null,
    priority: item.priority || null,
    eventId: item.eventId || null,
    idempotencyKey: item.idempotencyKey || null,
    eventType: item.eventType || null,
    tenantId: item.tenantId,
    recipientUserId: item.recipientUserId,
    raw: item,
  };
}

function normalizeLegacy(row) {
  return {
    id: row.id,
    source: "legacy-mobile",
    title: row.title || "Thông báo",
    body: row.body || "",
    message: row.body || "",
    status: row.status === "read" || row.read_at ? NOTIFICATION_STATUSES.READ : row.status,
    read: row.status === "read" || Boolean(row.read_at),
    created_at: row.created_at,
    createdAt: row.created_at,
    category: row.type || null,
    priority: null,
    eventId: row.payload_json?.eventId || null,
    idempotencyKey: row.payload_json?.idempotencyKey || null,
    eventType: row.type || null,
    tenantId: row.tenant_id,
    recipientUserId: row.user_id,
    raw: row,
  };
}

/**
 * @param {object} options
 * @param {string} options.tenantId
 * @param {string} options.userId
 * @param {Function} [options.listLegacy] — async () => { ok, notifications }
 * @param {number} [options.limit]
 */
export async function listMobileCompatibleInbox({
  tenantId,
  userId,
  listLegacy = null,
  limit = 50,
} = {}) {
  if (!tenantId || !userId) {
    return { ok: false, error: "tenantId and userId are required.", items: [], skippedDuplicates: 0 };
  }

  const canonical = await listInbox({ tenantId, userId, limit });
  if (!canonical.ok) {
    return {
      ok: false,
      error: canonical.error || "Failed to list canonical inbox.",
      items: [],
      skippedDuplicates: 0,
    };
  }

  const canonicalItems = (canonical.items || []).map(normalizeCanonical);
  const seen = new Set(
    canonicalItems.map(canonicalDedupeKey).filter(Boolean)
  );

  let legacyItems = [];
  let skippedDuplicates = 0;
  if (typeof listLegacy === "function") {
    const legacyResult = await listLegacy({ tenantId, userId, limit });
    const rows = legacyResult?.notifications || legacyResult?.items || [];
    for (const row of rows) {
      const key = legacyDedupeKey(row);
      if (key && seen.has(key)) {
        skippedDuplicates += 1;
        continue;
      }
      if (key) seen.add(key);
      legacyItems.push(normalizeLegacy(row));
    }
  }

  const merged = [...canonicalItems, ...legacyItems].sort((a, b) => {
    const ta = new Date(a.createdAt || a.created_at || 0).getTime();
    const tb = new Date(b.createdAt || b.created_at || 0).getTime();
    return tb - ta;
  });

  return {
    ok: true,
    items: merged.slice(0, limit),
    skippedDuplicates,
    canonicalCount: canonicalItems.length,
    legacyCount: legacyItems.length,
  };
}

/**
 * Mark read: canonical records update cloud SoT; legacy-only keep legacy callback.
 */
export async function markMobileCompatibleRead({
  tenantId,
  userId,
  item,
  markLegacyRead = null,
} = {}) {
  if (!item) {
    return { ok: false, error: "item is required." };
  }
  if (item.source === "canonical" || item.raw?.notificationId || item.raw?.eventId) {
    const notificationId = item.id || item.raw?.id || item.raw?.notificationId;
    return markCanonicalRead({ tenantId, userId, notificationId });
  }
  if (typeof markLegacyRead === "function") {
    return markLegacyRead(item.id || item.raw?.id);
  }
  return { ok: false, error: "No mark-read path for legacy item." };
}
