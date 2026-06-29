import {
  createRefereeToken,
  normalizeReferee,
} from "../../models/tournament/referee.js";
import {
  findRefereeRosterEntry,
  getRefereeSettings,
} from "../../models/tournament/refereeRoster.js";

export { createRefereeToken, normalizeReferee };

export function assignRefereeToMatch(match, refereeName, options = {}) {
  const token = createRefereeToken();
  const rosterId = options.rosterId ? String(options.rosterId) : "";
  const referee = normalizeReferee({
    id: rosterId || undefined,
    rosterId,
    name: String(refereeName || "").trim() || "Trọng tài",
    token,
    assignedAt: new Date().toISOString(),
  });

  return {
    match: {
      ...match,
      referee,
    },
    referee,
    token,
  };
}

export function buildRefereeUrl(token) {
  const path = `/referee/${encodeURIComponent(token)}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function buildRefereeShareText({ url, matchLabels = {}, refereeName = "" }) {
  const lines = [
    "Pickleball Scheduler — Trọng tài",
    refereeName ? `Trọng tài: ${refereeName}` : null,
    `${matchLabels.entryALabel || matchLabels.teamALabel || "Đội A"} vs ${matchLabels.entryBLabel || matchLabels.teamBLabel || "Đội B"}`,
    matchLabels.courtLabel ? `Sân: ${matchLabels.courtLabel}` : null,
    `Link: ${url}`,
  ].filter(Boolean);

  return lines.join("\n");
}

export async function copyRefereeShareText(payload) {
  const text = buildRefereeShareText(payload);

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function buildWhatsAppRefereeUrl(payload) {
  const text = encodeURIComponent(buildRefereeShareText(payload));
  return `https://wa.me/?text=${text}`;
}

export function buildMatchLiveRecord({
  clubId,
  tournamentId,
  eventId,
  match,
  labels = {},
  isDaily = false,
  tournamentName = "",
}) {
  const referee = normalizeReferee(match?.referee);
  if (!referee) {
    return null;
  }

  return {
    id: `${clubId}::${tournamentId}::${match.id}`,
    clubId: String(clubId),
    tournamentId: String(tournamentId),
    eventId: String(eventId || ""),
    matchId: String(match.id),
    refereeToken: referee.token,
    refereeName: referee.name,
    tournamentName: String(tournamentName || ""),
    entryALabel: labels.entryALabel || labels.teamALabel || "Đội A",
    entryBLabel: labels.entryBLabel || labels.teamBLabel || "Đội B",
    courtLabel: labels.courtLabel || "",
    stageLabel: labels.stageLabel || match.stageLabel || "",
    scoreA: Number(match.scoreA) || 0,
    scoreB: Number(match.scoreB) || 0,
    status: "playing",
    isDaily: Boolean(isDaily),
  };
}

export function patchRefereeInTournament(tournament, { eventId, matchId, referee, isDaily }) {
  if (!tournament || !matchId) {
    return null;
  }

  if (isDaily) {
    const dailyPlay = tournament.settings?.dailyPlay || {};
    const matches = (dailyPlay.matches || []).map((item) =>
      String(item.id) === String(matchId) ? { ...item, referee } : item
    );

    return {
      settings: {
        ...tournament.settings,
        dailyPlay: {
          ...dailyPlay,
          matches,
        },
      },
    };
  }

  const events = (tournament.events || []).map((event) => {
    if (eventId && String(event.id) !== String(eventId)) {
      return event;
    }

    const matches = (event.matches || []).map((item) =>
      String(item.id) === String(matchId) ? { ...item, referee } : item
    );

    return { ...event, matches };
  });

  return { events };
}

export function resolveMatchLabels(match, { entries = [], players = [], courts = [] } = {}) {
  const court = courts.find((item) => String(item.id) === String(match.courtId));
  const courtLabel = court?.name || (match.courtId ? `Sân ${match.courtId}` : "");

  if (match.entryALabel || match.teamALabel) {
    return {
      entryALabel: match.entryALabel || match.teamALabel,
      entryBLabel: match.entryBLabel || match.teamBLabel,
      courtLabel,
    };
  }

  const entryById = new Map((entries || []).map((entry) => [String(entry.id), entry]));
  const playerById = new Map((players || []).map((player) => [String(player.id), player]));

  function labelForEntry(entryId, teamPlayerIds) {
    const entry = entryById.get(String(entryId));
    if (entry?.name) {
      return entry.name;
    }

    const ids = teamPlayerIds || (entryId ? [entryId] : []);
    const names = ids
      .map((id) => playerById.get(String(id))?.name)
      .filter(Boolean);
    return names.length ? names.join(" / ") : "TBD";
  }

  return {
    entryALabel: labelForEntry(match.entryAId, match.teamAPlayerIds),
    entryBLabel: labelForEntry(match.entryBId, match.teamBPlayerIds),
    courtLabel,
    stageLabel:
      match.stageLabel ||
      (match.groupId ? `Bảng ${match.groupId}` : match.bracketMatchId ? "Knock-out" : ""),
  };
}

export function resolveCourtRefereeForAssignment(tournament, courtId) {
  const { roster, courtReferees } = getRefereeSettings(tournament);
  const rosterId = courtReferees[String(courtId)];
  if (!rosterId) {
    return null;
  }

  const entry = findRefereeRosterEntry(roster, rosterId);
  if (!entry || entry.active === false) {
    return null;
  }

  return entry;
}

export function assignCourtRefereeToMatch(match, rosterEntry) {
  if (!rosterEntry?.name) {
    return null;
  }

  return assignRefereeToMatch(match, rosterEntry.name, {
    rosterId: rosterEntry.id,
  });
}

export {
  buildRefereeSettingsPatch,
  createRefereeRosterEntry,
  findRefereeRosterEntry,
  getRefereeSettings,
  normalizeCourtReferees,
  normalizeRefereeRoster,
  removeRefereeRosterEntry,
  resolveCourtRefereeName,
  setCourtRefereeAssignment,
  upsertRefereeRosterEntry,
} from "../../models/tournament/refereeRoster.js";
