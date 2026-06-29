export function createRefereeToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `ref${Date.now()}${Math.random().toString(36).slice(2, 14)}`;
}

export function normalizeReferee(referee) {
  if (!referee || typeof referee !== "object") {
    return null;
  }

  const name = String(referee.name || "").trim();
  const token = String(referee.token || "").trim();

  if (!name && !token) {
    return null;
  }

  return {
    id: referee.id ? String(referee.id) : createRefereeToken(),
    rosterId: referee.rosterId ? String(referee.rosterId) : "",
    name: name || "Trọng tài",
    token: token || createRefereeToken(),
    assignedAt: referee.assignedAt || new Date().toISOString(),
  };
}
