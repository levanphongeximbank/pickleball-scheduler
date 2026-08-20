import { getRefereeSettings } from "../../../../models/tournament/refereeRoster.js";
import { eventDisplayName } from "../batchB/eventScope.js";
import { listTournamentCourts } from "../batchD/matchPresentation.js";
import { projectEventMatches } from "./collectMatches.js";
import { OPS_STATUS } from "./opsStatus.js";

function refereeKey(name) {
  return String(name || "").trim().toLowerCase();
}

export function deriveRefereeBoardModel(tournament, { selectedEventId = "all", status = "all", court = "all", stage = "all" } = {}) {
  const projected = projectEventMatches(tournament, selectedEventId);
  const settings = getRefereeSettings(tournament);
  const roster = Array.isArray(settings.roster) ? settings.roster : [];
  const byName = new Map();
  for (const entry of roster) {
    byName.set(refereeKey(entry.name), {
      id: entry.id,
      name: entry.name,
      matches: [],
      source: "roster",
    });
  }
  for (const match of projected.matches) {
    if (!match.referee || match.referee === "Chưa gán") continue;
    const key = refereeKey(match.referee);
    const current = byName.get(key) || { id: `ref-${key}`, name: match.referee, matches: [], source: "match" };
    current.matches.push(match);
    byName.set(key, current);
  }

  const rows = [...byName.values()].map((ref) => {
    const live = ref.matches.filter((item) => item.status === "live");
    const next = ref.matches.find((item) => item.status === "upcoming" || item.status === "waiting");
    const attention = ref.matches.filter((item) => item.status === "attention" || item.issues.length);
    const doubleLive = live.length > 1;
    let derivedStatus = "";
    if (live.length) derivedStatus = OPS_STATUS.LIVE;
    else if (doubleLive || attention.length) derivedStatus = OPS_STATUS.ATTENTION;
    else if (next) derivedStatus = OPS_STATUS.NEXT;
    const issue = doubleLive
      ? "Trùng trận đang thi đấu"
      : attention[0]?.issues?.[0] || "";
    return {
      id: ref.id,
      name: ref.name,
      derivedStatus,
      currentMatch: live[0]?.id || "",
      court: live[0]?.court || next?.court || "",
      currentTime: live[0]?.time || "",
      nextAssignment: next?.id || "",
      nextCourt: next?.court || "",
      nextTime: next?.time || "",
      workload: ref.matches.length ? `${ref.matches.length} trận trên hồ sơ` : "Chưa có trận trên hồ sơ",
      issue,
      event: live[0]?.event || next?.event || "",
      stage: live[0]?.stage || next?.stage || "",
      refereeLaunchTo: live[0]?.refereeLaunchTo || next?.refereeLaunchTo || "",
    };
  });

  const unassigned = projected.matches.filter(
    (item) => (!item.referee || item.referee === "Chưa gán") && item.status !== "completed"
  );
  const filtered = rows.filter((row) => {
    if (status !== "all") {
      if (status === "none") {
        if (row.derivedStatus) return false;
      } else if (row.derivedStatus !== status) return false;
    }
    if (court !== "all" && row.court !== court) return false;
    if (stage !== "all" && row.stage !== stage) return false;
    return true;
  });

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: projected.event ? eventDisplayName(projected.event) : "Mọi nội dung",
    eventId: projected.event?.id || "",
    events: projected.events,
    emptyEvents: projected.emptyEvents,
    kpis: {
      live: rows.filter((item) => item.derivedStatus === OPS_STATUS.LIVE).length,
      available: 0,
      next: rows.filter((item) => item.derivedStatus === OPS_STATUS.NEXT).length,
      unassigned: unassigned.length,
      attention: rows.filter((item) => item.derivedStatus === OPS_STATUS.ATTENTION || item.issue).length,
    },
    referees: filtered,
    allReferees: rows,
    unassigned,
    courts: listTournamentCourts(tournament),
    stages: [...new Set(projected.matches.map((item) => item.stage).filter(Boolean))],
    hasAvailabilityModel: false,
  };
}
