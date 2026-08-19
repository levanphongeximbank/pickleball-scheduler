import { TOURNAMENT_MODE } from "../../../models/tournament/constants.js";
import {
  directorPath,
  engineTabPath,
  individualPlayerRegistrationPath,
  individualPublicTournamentPath,
  isIndividualTournament,
  isTeamTournament,
} from "../../../config/tournamentRoutes.js";

function legacySetupPath(tournament) {
  const id = String(tournament?.id || "").trim();
  if (!id) return "/tournament";
  if (tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT) {
    return `/tournament/internal/${id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT) {
    return `/tournament/official/${id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.TEAM_TOURNAMENT) {
    return `/tournament/team/${id}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return `/tournament/daily/${id}`;
  }
  return "/tournament";
}

export function individualOverviewPath(tournamentId) {
  const id = String(tournamentId || "").trim();
  return id ? `/tournament/${encodeURIComponent(id)}/overview` : "/tournament";
}

export function withEventQuery(path, eventId = "") {
  const selected = String(eventId || "").trim();
  if (!selected) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}eventId=${encodeURIComponent(selected)}`;
}

export function individualSettingsPath(tournamentId, eventId = "") {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  return withEventQuery(`/tournament/${encodeURIComponent(id)}/settings`, eventId);
}

export function individualRegistrationPublicationPath(tournamentId, eventId = "") {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  return withEventQuery(`/tournament/${encodeURIComponent(id)}/registration`, eventId);
}

export function individualParticipantsPath(tournamentId, eventId = "") {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  return withEventQuery(`/tournament/${encodeURIComponent(id)}/participants`, eventId);
}

export function individualPairsPath(tournamentId, eventId = "") {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  return withEventQuery(`/tournament/${encodeURIComponent(id)}/pairs`, eventId);
}

export function individualPairDrawPath(tournamentId, eventId = "") {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  return withEventQuery(`/tournament/${encodeURIComponent(id)}/pair-draw`, eventId);
}

export function individualGroupDrawPath(tournamentId, eventId = "") {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  return withEventQuery(`/tournament/${encodeURIComponent(id)}/group-draw`, eventId);
}

export function individualGroupStagePath(tournamentId, eventId = "") {
  const id = String(tournamentId || "").trim();
  if (!id) return "/tournament";
  return withEventQuery(`/tournament/${encodeURIComponent(id)}/groups`, eventId);
}

export function a1LegacyHubPath() {
  return "/tournament?experience=legacy";
}

export function resolveA1OpenPath(tournament) {
  if (!tournament?.id) return "/tournament";
  if (isIndividualTournament(tournament)) {
    return individualOverviewPath(tournament.id);
  }
  if (isTeamTournament(tournament)) {
    return `/tournaments/${encodeURIComponent(tournament.id)}`;
  }
  if (tournament.mode === TOURNAMENT_MODE.DAILY_PLAY) {
    return `/tournament/daily/${encodeURIComponent(tournament.id)}`;
  }
  return legacySetupPath(tournament);
}

export function resolveA1OperationLinks(tournament) {
  const id = String(tournament?.id || "").trim();
  if (!id || !isIndividualTournament(tournament)) {
    return [];
  }
  return [
    { key: "settings", label: "Cài đặt giải / Nội dung", to: individualSettingsPath(id) },
    { key: "legacy-setup", label: "Thiết lập đầy đủ (hiện tại)", to: legacySetupPath(tournament) },
    { key: "register", label: "Đăng ký VĐV", to: individualPlayerRegistrationPath(id) },
    { key: "public", label: "Trang công khai", to: individualPublicTournamentPath(id) },
    { key: "director", label: "Điều hành giải", to: directorPath(id) },
    { key: "engine", label: "Tournament Engine", to: engineTabPath(id, "engine") },
    {
      key: "bracket",
      label: "Sơ đồ nhánh đấu",
      to:
        tournament.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT
          ? `/tournament/internal/${encodeURIComponent(id)}/bracket`
          : `/tournament/official/${encodeURIComponent(id)}/bracket`,
    },
  ];
}

export const A1_CONFIG_LINKS = Object.freeze([
  { key: "age", label: "Độ tuổi", path: "/tournament/config/age-rules" },
  { key: "gender", label: "Giới tính", path: "/tournament/config/gender-rules" },
  { key: "fee", label: "Lệ phí tham gia", path: "/tournament/config/fee" },
  { key: "regulations", label: "Mẫu điều lệ", path: "/tournament/config/regulations" },
  { key: "eligibility", label: "Điều kiện tham gia", path: "/tournament/eligibility/check" },
]);

export function configLinkWithTournament(path, tournamentId) {
  const id = String(tournamentId || "").trim();
  if (!id) return path;
  return `${path}?tournamentId=${encodeURIComponent(id)}`;
}
