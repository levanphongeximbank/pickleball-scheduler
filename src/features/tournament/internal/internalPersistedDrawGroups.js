/**
 * Canonical Internal draw projection.
 * One field path: tournament.events[0].groups (payload.events[].groups).
 * Pairing proposal / suggestedPairs are never authoritative after Chia bảng.
 */

export const INTERNAL_PERSISTED_GROUP_FIELD = "events[].groups";

export function getInternalCanonicalEvent(tournamentOrEvent) {
  if (!tournamentOrEvent || typeof tournamentOrEvent !== "object") return null;
  if (Array.isArray(tournamentOrEvent.events)) {
    return tournamentOrEvent.events[0] || null;
  }
  return tournamentOrEvent;
}

export function listInternalPersistedGroups(tournamentOrEvent) {
  const event = getInternalCanonicalEvent(tournamentOrEvent);
  const groups = Array.isArray(event?.groups) ? event.groups : [];
  const seen = new Set();
  return groups.filter((group) => {
    const id = String(group?.id || "").trim();
    if (!id) return Boolean(group);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function countInternalPersistedGroups(tournamentOrEvent) {
  return listInternalPersistedGroups(tournamentOrEvent).length;
}

export function resolveInternalGroupMemberLabels(group, tournamentOrEvent) {
  if (Array.isArray(group?.entries) && group.entries.length > 0) {
    return group.entries.map((entry) => String(entry?.name || entry?.id || "").trim()).filter(Boolean);
  }
  const event = getInternalCanonicalEvent(tournamentOrEvent);
  const byId = new Map(
    (event?.entries || []).map((entry) => [String(entry?.id || ""), entry])
  );
  return (group?.entryIds || [])
    .map((id) => {
      const entry = byId.get(String(id));
      return String(entry?.name || id || "").trim();
    })
    .filter(Boolean);
}

/**
 * Keep a valid write-result draw. Background GET / scope restore must not
 * replace groups with an empty same-or-older snapshot.
 */
export function selectAuthoritativeCanonicalTournament(current, incoming) {
  if (!incoming) return current || null;
  if (!current) return incoming;
  const currentGroups = countInternalPersistedGroups(current);
  const nextGroups = countInternalPersistedGroups(incoming);
  const currentVersion = Number(current.version);
  const nextVersion = Number(incoming.version);
  if (
    currentGroups > 0 &&
    nextGroups === 0 &&
    (!Number.isFinite(nextVersion) ||
      !Number.isFinite(currentVersion) ||
      nextVersion <= currentVersion)
  ) {
    return current;
  }
  return incoming;
}
