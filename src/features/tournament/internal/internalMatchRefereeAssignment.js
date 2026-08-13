/**
 * Internal match referee assignment — reuses canonical referee engine/roster.
 * No new referee authority, table, or identity mapping.
 */
import {
  assignRefereeToMatch,
  findRefereeRosterEntry,
  getRefereeSettings,
} from "../../../tournament/engines/refereeEngine.js";

export const INTERNAL_NO_REFEREE_ROSTER_MESSAGE =
  "Chưa có trọng tài. Thêm trọng tài ở phần Thiết lập trước khi phân công trận.";

export function listEligibleInternalReferees(tournament) {
  return (getRefereeSettings(tournament).roster || []).filter(
    (entry) => entry?.active !== false && entry?.id && entry?.name
  );
}

export function assignInternalMatchReferee({
  tournament,
  event,
  matchId,
  rosterId,
} = {}) {
  if (!event || !matchId) {
    return { ok: false, error: "Thiếu trận để phân công trọng tài." };
  }

  const matches = Array.isArray(event.matches) ? event.matches : [];
  const matchIndex = matches.findIndex((item) => String(item.id) === String(matchId));
  if (matchIndex < 0) {
    return { ok: false, error: "Không tìm thấy trận." };
  }

  const match = matches[matchIndex];
  const nextId = rosterId == null ? "" : String(rosterId).trim();

  if (!nextId) {
    const nextMatches = matches.map((item, index) =>
      index === matchIndex ? { ...item, referee: null } : item
    );
    return {
      ok: true,
      event: { ...event, matches: nextMatches },
      referee: null,
    };
  }

  const eligible = listEligibleInternalReferees(tournament);
  if (!eligible.length) {
    return {
      ok: false,
      code: "NO_REFEREE_ROSTER",
      error: INTERNAL_NO_REFEREE_ROSTER_MESSAGE,
    };
  }

  const entry = findRefereeRosterEntry(eligible, nextId);
  if (!entry) {
    return {
      ok: false,
      error: "Trọng tài không thuộc danh sách của giải này.",
    };
  }

  const assigned = assignRefereeToMatch(match, entry.name, { rosterId: entry.id });
  const nextMatches = matches.map((item, index) =>
    index === matchIndex ? assigned.match : item
  );

  return {
    ok: true,
    event: { ...event, matches: nextMatches },
    referee: assigned.referee,
  };
}
