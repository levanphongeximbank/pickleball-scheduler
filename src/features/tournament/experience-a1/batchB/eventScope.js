import { EVENT_TYPE, EVENT_TYPE_LABELS } from "../../../../models/tournament/constants.js";
import { listTournamentEvents, resolveSelectedEvent } from "../deriveOverview.js";

const SINGLE_EVENT_TYPES = new Set([EVENT_TYPE.MEN_SINGLE, EVENT_TYPE.WOMEN_SINGLE]);

export function expectedPlayerCount(event) {
  return SINGLE_EVENT_TYPES.has(event?.eventType) ? 1 : 2;
}

export function eventDisplayName(event) {
  if (!event) return "";
  return String(event.name || EVENT_TYPE_LABELS[event.eventType] || "Nội dung");
}

export function formatViDateTime(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Date(parsed).toLocaleString("vi-VN");
}

export function resolveBatchBEvent(tournament, selectedEventId) {
  const events = listTournamentEvents(tournament);
  return {
    events,
    event: resolveSelectedEvent(events, selectedEventId),
    needsEventChoice: events.length > 1 && !String(selectedEventId || "").trim(),
    emptyEvents: events.length === 0,
  };
}

export function isProfileComplete(entry, event) {
  const name = String(entry?.name || "").trim();
  const playerIds = Array.isArray(entry?.playerIds) ? entry.playerIds.filter(Boolean) : [];
  const needed = expectedPlayerCount(event);
  return Boolean(name) && playerIds.length >= needed;
}
