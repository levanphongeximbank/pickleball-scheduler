import { buildFinalRanking } from "../../../individual-tournament/engines/awardsEngine.js";
import { eventDisplayName } from "../batchB/eventScope.js";
import { listTournamentEvents } from "../deriveOverview.js";
import { projectEventMatches } from "../batchE/collectMatches.js";
import { PRESENTATION_SESSION } from "./presentationSessionState.js";

const OUTPUT_CATALOG = Object.freeze([
  { id: "draw", label: "Bốc thăm", hint: "Kết quả bốc thăm công bố", status: "READY" },
  { id: "live", label: "Trận đang diễn ra", hint: "Tỷ số trận live", status: "READY" },
  { id: "standings", label: "Bảng xếp hạng", hint: "BXH vòng bảng", status: "READY" },
  { id: "bracket", label: "Nhánh đấu", hint: "Vòng loại trực tiếp", status: "READY" },
  { id: "court", label: "Sân", hint: "Trạng thái sân", status: "READY" },
  { id: "champion", label: "Vô địch", hint: "Bục vô địch", status: "READY" },
  { id: "sponsor", label: "Nhà tài trợ", hint: "Luân phiên thương hiệu", status: "READY" },
  { id: "media", label: "Truyền thông", hint: "Thư viện media", status: "READY" },
]);

function normalizeScoreLine(score) {
  const text = String(score || "").trim();
  if (!text || text === "—") return "—";
  return text.replace(/\s+/g, "");
}

export function deriveMediaPresentationModel(tournament, { selectedEventId = "all", activeOutputId = "live" } = {}) {
  const events = listTournamentEvents(tournament);
  const projected = projectEventMatches(tournament, selectedEventId);
  const liveMatch = projected.matches.find((item) => item.status === "live") || null;
  const scopeEvent =
    projected.event ||
    (selectedEventId && selectedEventId !== "all"
      ? events.find((item) => String(item.id) === String(selectedEventId)) || null
      : events.length === 1
        ? events.at(0)
        : null);
  const ranking = scopeEvent ? buildFinalRanking(tournament, scopeEvent.id) : { ranking: [] };
  const champion = ranking.ranking?.find((item) => item.rank === 1);

  const outputs = OUTPUT_CATALOG.map((item) => {
    if (item.id === "live") {
      return { ...item, status: liveMatch ? "LIVE" : "READY", available: Boolean(liveMatch) };
    }
    if (item.id === "champion") {
      return {
        ...item,
        status: champion?.name ? "CONFIRMED" : "NOT_READY",
        available: Boolean(champion?.name),
      };
    }
    return { ...item, available: true };
  });

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: scopeEvent ? eventDisplayName(scopeEvent) : projected.events.length > 1 ? "Mọi nội dung" : "",
    events,
    outputs,
    activeOutputId,
    livePreview: liveMatch
      ? {
          event: liveMatch.event,
          stage: liveMatch.stage,
          court: liveMatch.court,
          a: liveMatch.a,
          b: liveMatch.b,
          score: normalizeScoreLine(liveMatch.score),
        }
      : null,
    championPreview: champion?.name || "",
    devices: [],
    sponsors: [],
    obsUrl: "",
    outputUrl: "",
    defaultSessionStatus: liveMatch ? PRESENTATION_SESSION.READY : PRESENTATION_SESSION.OFFLINE,
    hasPersistedSession: false,
  };
}

export { normalizeScoreLine };
