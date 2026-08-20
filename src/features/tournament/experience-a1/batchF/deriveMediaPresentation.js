import { buildFinalRanking } from "../../../individual-tournament/engines/awardsEngine.js";
import { getLiveStandings } from "../../../individual-tournament/engines/resultPropagationEngine.js";
import { buildIndividualAllGroupStandings } from "../../../individual-tournament/adapters/individualStandingsAdapter.js";
import { isDrawPublished } from "../../../../tournament/engines/publishDrawEngine.js";
import { MATCH_STAGE } from "../../../../models/tournament/constants.js";
import { eventDisplayName } from "../batchB/eventScope.js";
import { listTournamentEvents } from "../deriveOverview.js";
import { projectEventMatches } from "../batchE/collectMatches.js";
import { PRESENTATION_SESSION } from "./presentationSessionState.js";

const OUTPUT_CATALOG = Object.freeze([
  { id: "draw", label: "Bốc thăm", hint: "Kết quả bốc thăm công bố" },
  { id: "live", label: "Trận đang diễn ra", hint: "Tỷ số trận live" },
  { id: "standings", label: "Bảng xếp hạng", hint: "BXH vòng bảng" },
  { id: "bracket", label: "Nhánh đấu", hint: "Vòng loại trực tiếp" },
  { id: "court", label: "Sân", hint: "Trạng thái sân" },
  { id: "champion", label: "Vô địch", hint: "Bục vô địch" },
  { id: "sponsor", label: "Nhà tài trợ", hint: "Luân phiên thương hiệu" },
  { id: "media", label: "Truyền thông", hint: "Thư viện media" },
]);

function normalizeScoreLine(score) {
  const text = String(score || "").trim();
  if (!text || text === "—") return "—";
  return text.replace(/\s+/g, "");
}

function outputMeta({ available, status, emptyHint }) {
  return {
    available: Boolean(available),
    status: available ? status : "NO_DATA",
    emptyHint: emptyHint || "Chưa có dữ liệu",
  };
}

function hasRealDrawContent(tournament, events) {
  if (isDrawPublished(tournament)) return true;
  return events.some((event) => Array.isArray(event.groups) && event.groups.length > 0);
}

function hasRealStandingsContent(tournament, events) {
  for (const event of events) {
    const live = getLiveStandings(tournament, event.id);
    const groups = live?.groups || buildIndividualAllGroupStandings(event, { forceCanonical: false });
    if ((groups || []).some((group) => Array.isArray(group.standing) && group.standing.length > 0)) {
      return true;
    }
  }
  return false;
}

function hasRealBracketContent(events) {
  return events.some((event) => {
    const bracketRounds = event?.bracket?.rounds;
    if (Array.isArray(bracketRounds) && bracketRounds.length > 0) return true;
    const matches = Array.isArray(event?.matches) ? event.matches : [];
    return matches.some(
      (match) =>
        match.stage === MATCH_STAGE.ROUND_OF_16 ||
        match.stage === MATCH_STAGE.QUARTERFINAL ||
        match.stage === MATCH_STAGE.SEMIFINAL ||
        match.stage === MATCH_STAGE.FINAL ||
        match.stage === MATCH_STAGE.THIRD_PLACE ||
        match.bracketMatchId ||
        match.roundName
    );
  });
}

function hasRealCourtContent(tournament) {
  const courts = Array.isArray(tournament?.courts) ? tournament.courts : [];
  if (courts.length > 0) return true;
  const ids = tournament?.courtSchedule?.physicalCourtIds || tournament?.courtSchedule?.courtIds || [];
  return Array.isArray(ids) && ids.length > 0;
}

function hasRealSponsorContent(tournament) {
  const sponsors =
    tournament?.sponsors ||
    tournament?.settings?.sponsors ||
    tournament?.branding?.sponsors ||
    [];
  return Array.isArray(sponsors) && sponsors.length > 0;
}

function hasRealMediaLibraryContent(tournament) {
  const media =
    tournament?.mediaLibrary ||
    tournament?.settings?.mediaLibrary ||
    tournament?.media ||
    [];
  return Array.isArray(media) && media.length > 0;
}

export function deriveMediaPresentationModel(tournament, { selectedEventId = "all", activeOutputId = "live" } = {}) {
  const events = listTournamentEvents(tournament);
  const projected = projectEventMatches(tournament, selectedEventId);
  const sourceEvents = projected.sourceEvents?.length ? projected.sourceEvents : events;
  const liveMatch = projected.matches.find((item) => item.status === "live") || null;
  const scopeEvent =
    projected.event ||
    (selectedEventId && selectedEventId !== "all"
      ? events.find((item) => String(item.id) === String(selectedEventId)) || null
      : events.length === 1
        ? events.at(0)
        : null);
  const ranking = scopeEvent ? buildFinalRanking(tournament, scopeEvent.id) : { ranking: [] };
  const champion = ranking.ranking?.find((item) => item.rank === 1 && item.name);

  const readiness = {
    draw: outputMeta({
      available: hasRealDrawContent(tournament, sourceEvents),
      status: "READY",
      emptyHint: "Chưa có dữ liệu bốc thăm",
    }),
    live: outputMeta({
      available: Boolean(liveMatch),
      status: "LIVE",
      emptyHint: "Chưa có trận live",
    }),
    standings: outputMeta({
      available: hasRealStandingsContent(tournament, sourceEvents),
      status: "READY",
      emptyHint: "Chưa có dữ liệu bảng xếp hạng",
    }),
    bracket: outputMeta({
      available: hasRealBracketContent(sourceEvents),
      status: "READY",
      emptyHint: "Chưa có nhánh đấu",
    }),
    court: outputMeta({
      available: hasRealCourtContent(tournament),
      status: "READY",
      emptyHint: "Chưa có dữ liệu sân",
    }),
    champion: outputMeta({
      available: Boolean(champion?.name),
      status: "CONFIRMED",
      emptyHint: "Chưa có vô địch",
    }),
    sponsor: outputMeta({
      available: hasRealSponsorContent(tournament),
      status: "READY",
      emptyHint: "Chưa có nhà tài trợ",
    }),
    media: outputMeta({
      available: hasRealMediaLibraryContent(tournament),
      status: "READY",
      emptyHint: "Chưa có thư viện media",
    }),
  };

  const outputs = OUTPUT_CATALOG.map((item) => {
    const meta = readiness[item.id] || outputMeta({ available: false, status: "READY" });
    return {
      ...item,
      ...meta,
      hint: meta.available ? item.hint : meta.emptyHint,
    };
  });

  const selected = outputs.find((item) => item.id === activeOutputId) || outputs[0];
  const selectedOutputHasData = Boolean(selected?.available);

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: scopeEvent ? eventDisplayName(scopeEvent) : projected.events.length > 1 ? "Mọi nội dung" : "",
    events,
    outputs,
    activeOutputId,
    selectedOutputHasData,
    fakeReadyCount: outputs.filter((item) => item.status === "READY" && !item.available).length,
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
    sponsors: hasRealSponsorContent(tournament)
      ? tournament.sponsors || tournament.settings?.sponsors || tournament.branding?.sponsors || []
      : [],
    obsUrl: "",
    outputUrl: "",
    defaultSessionStatus: liveMatch ? PRESENTATION_SESSION.READY : PRESENTATION_SESSION.OFFLINE,
    hasPersistedSession: false,
  };
}

export { normalizeScoreLine };
