export function appendWorkflowHistoryEntry(history = [], entry = {}) {
  const nextEntry = {
    id: entry.id || `workflow-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    action: entry.action || "workflow",
    status: entry.status || "success",
    detail: entry.detail || "",
    timestamp: entry.timestamp || new Date().toISOString(),
    actor: entry.actor || null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  };

  const next = [nextEntry, ...history].slice(0, 8);
  return next;
}

export function groupWorkflowHistoryByDate(history = []) {
  const groups = new Map();

  history.forEach((entry) => {
    const date = entry.timestamp ? new Date(entry.timestamp) : new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    if (!groups.has(key)) {
      groups.set(key, {
        label: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
        entries: [],
      });
    }

    groups.get(key).entries.push(entry);
  });

  return Array.from(groups.values());
}

export function resetWorkflowHistory() {
  return [];
}
