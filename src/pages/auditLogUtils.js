export function normalizeAuditEntry(entry) {
  if (!entry) {
    return null;
  }

  const action = entry.action || entry.type || "unknown";
  const normalized = {
    ...entry,
    action,
    created_at: entry.created_at || entry.occurredAt || new Date().toISOString(),
    actor_email: entry.actor_email || entry.actorId || entry.actor_user_id || "system",
    resource_type: entry.resource_type || entry.entityType || "workflow",
    resource_id: entry.resource_id || entry.entityId || "—",
    metadata: entry.metadata || {},
  };

  if (normalized.action === "workflow.notification" && normalized.metadata) {
    normalized.metadata = {
      ...normalized.metadata,
      eventLabel: normalized.metadata.title || "Workflow notification",
      detail: normalized.metadata.body || normalized.metadata.detail || "Notification detail",
    };
  }

  return normalized;
}

export function mergeAuditEntries(...sources) {
  const merged = sources.flatMap((source) => Array.isArray(source) ? source : []);
  const normalized = merged.map(normalizeAuditEntry).filter(Boolean);

  const seen = new Set();
  const deduped = [];

  for (const entry of normalized) {
    const fingerprint = entry.id || `${entry.action}-${entry.created_at}-${entry.actor_email}-${entry.resource_id}`;
    if (seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    deduped.push(entry);
  }

  return deduped.sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
}
