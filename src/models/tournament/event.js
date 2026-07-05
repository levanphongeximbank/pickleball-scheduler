import { EVENT_TYPE, EVENT_TYPE_ALIASES } from "./constants.js";
import { normalizeEntries } from "./entry.js";
import { normalizeGroups } from "./group.js";
import { normalizeMatches } from "./match.js";

const VALID_EVENT_TYPES = new Set(Object.values(EVENT_TYPE));

function normalizeEventType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (VALID_EVENT_TYPES.has(raw)) {
    return raw;
  }
  if (EVENT_TYPE_ALIASES[raw]) {
    return EVENT_TYPE_ALIASES[raw];
  }
  return EVENT_TYPE.MIXED_DOUBLE;
}

export function normalizeEvent(event, index = 0) {
  if (!event || event.id === undefined || event.id === null) {
    return null;
  }

  return {
    ...event,
    id: String(event.id).trim(),
    tournamentId: event.tournamentId ? String(event.tournamentId).trim() : "",
    name: String(event.name || `Nội dung ${index + 1}`).trim(),
    eventType: normalizeEventType(event.eventType),
    entries: normalizeEntries(event.entries || []),
    groups: normalizeGroups(event.groups || []),
    matches: normalizeMatches(event.matches || []),
    standings: Array.isArray(event.standings) ? event.standings : [],
    bracket: event.bracket && typeof event.bracket === "object" ? event.bracket : null,
    status: event.status || "draft",
  };
}

export function normalizeEvents(events = []) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .map((event, index) => normalizeEvent(event, index))
    .filter(Boolean);
}

export function createEventRecord(options = {}) {
  return normalizeEvent({
    id: options.id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tournamentId: options.tournamentId || "",
    name: options.name || "",
    eventType: options.eventType || EVENT_TYPE.MIXED_DOUBLE,
    entries: options.entries || [],
    groups: options.groups || [],
    matches: options.matches || [],
    standings: options.standings || [],
    bracket: options.bracket || null,
    status: options.status || "draft",
  });
}
