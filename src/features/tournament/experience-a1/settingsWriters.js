/**
 * Screen 03 writers — exact existing production paths.
 * Event factory = models/createEventRecord (same as createOfficialEventRecord).
 * Persist = useCanonicalTournament.update → updateTournamentCommand.
 * Do not add lock / publish / complete commands here.
 */
import { createEventRecord } from "../../../models/tournament/event.js";
import { EVENT_TYPE, EVENT_TYPE_LABELS } from "../../../models/tournament/constants.js";

export const A1_SETTINGS_WRITER = Object.freeze({
  command: "updateTournamentCommand",
  hook: "useCanonicalTournament.update",
  eventFactory: "createEventRecord",
  eventUpsert: "upsertEventById",
});

export function upsertEventById(events = [], event) {
  const list = Array.isArray(events) ? [...events] : [];
  const index = list.findIndex((item) => String(item.id) === String(event.id));
  if (index < 0) {
    return [...list, event];
  }
  const next = [...list];
  next[index] = event;
  return next;
}

export function buildIdentityPatch({ name, hostClubName, officialMode } = {}) {
  const patch = {};
  if (name != null) patch.name = String(name).trim();
  if (hostClubName != null) patch.hostClubName = String(hostClubName).trim();
  if (officialMode != null) patch.officialMode = officialMode;
  return patch;
}

export function buildAddOfficialEventPatch(tournament, eventType) {
  const type = eventType || EVENT_TYPE.MEN_DOUBLE;
  const event = createEventRecord({
    tournamentId: tournament?.id || "",
    name: EVENT_TYPE_LABELS[type] || `Nội dung ${(tournament?.events?.length || 0) + 1}`,
    eventType: type,
    entries: [],
    groups: [],
    matches: [],
    standings: [],
    bracket: null,
    status: "draft",
  });
  return {
    patch: {
      events: upsertEventById(listEvents(tournament), event),
    },
    event,
  };
}

export function buildUpdateEventPatch(tournament, eventId, eventPatch) {
  const events = listEvents(tournament);
  const current = events.find((event) => String(event.id) === String(eventId));
  if (!current) {
    return { ok: false, error: "Chưa chọn nội dung." };
  }
  return {
    ok: true,
    patch: {
      events: upsertEventById(events, { ...current, ...eventPatch, id: current.id }),
    },
  };
}

function listEvents(tournament) {
  return Array.isArray(tournament?.events) ? tournament.events : [];
}
