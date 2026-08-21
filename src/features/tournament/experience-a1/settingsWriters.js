/**
 * Screen 03 writers — exact existing production paths.
 * Event factory = models/createEventRecord (same as createOfficialEventRecord).
 * Persist = useCanonicalTournament.update → updateTournamentCommand.
 * Do not add lock / publish / complete commands here.
 */
import { createEventRecord } from "../../../models/tournament/event.js";
import {
  EVENT_TYPE,
  EVENT_TYPE_LABELS,
  OFFICIAL_MODE,
} from "../../../models/tournament/constants.js";
import {
  OFFICIAL_REGISTRATION_MODE,
  patchOfficialCompetitionSettings,
} from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";

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

/**
 * Create one Official Event via existing createEventRecord + events[] upsert.
 * @param {object} tournament
 * @param {string|{ eventType?: string, name?: string, registrationMode?: string }} eventTypeOrOptions
 */
export function buildAddOfficialEventPatch(tournament, eventTypeOrOptions) {
  const options =
    eventTypeOrOptions && typeof eventTypeOrOptions === "object"
      ? eventTypeOrOptions
      : { eventType: eventTypeOrOptions };

  const type = options.eventType || EVENT_TYPE.MEN_DOUBLE;
  const explicitName = String(options.name || "").trim();
  const name =
    explicitName ||
    EVENT_TYPE_LABELS[type] ||
    `Nội dung ${(tournament?.events?.length || 0) + 1}`;

  const registrationMode = options.registrationMode
    ? String(options.registrationMode).trim()
    : "";

  if (
    registrationMode === OFFICIAL_REGISTRATION_MODE.PAIR &&
    String(tournament?.officialMode || "") === OFFICIAL_MODE.AI_BALANCE
  ) {
    return {
      ok: false,
      code: "AI_BALANCE_PAIR_REGISTRATION_BLOCKED",
      error: "AI Balance chỉ cho đăng ký cá nhân — không tạo nội dung với chế độ theo cặp.",
      patch: null,
      event: null,
    };
  }

  const event = createEventRecord({
    tournamentId: tournament?.id || "",
    name,
    eventType: type,
    entries: [],
    groups: [],
    matches: [],
    standings: [],
    bracket: null,
    status: "draft",
  });

  const patch = {
    events: upsertEventById(listEvents(tournament), event),
  };

  if (registrationMode) {
    try {
      const withMode = patchOfficialCompetitionSettings(
        { ...tournament, events: patch.events },
        { registrationMode }
      );
      patch.settings = withMode.settings;
    } catch (err) {
      return {
        ok: false,
        code: err?.code || "REGISTRATION_MODE_DENIED",
        error: err instanceof Error ? err.message : String(err || "Không đặt chế độ đăng ký."),
        patch: null,
        event: null,
      };
    }
  }

  return {
    ok: true,
    patch,
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
