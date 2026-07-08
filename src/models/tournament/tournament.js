import {
  CERTIFICATION_STATUS,
  OFFICIAL_MODE,
  TOURNAMENT_LEVEL,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
  VPR_AWARD_STATUS,
  VPR_ELIGIBLE_LEVELS,
} from "./constants.js";
import { normalizeEvents } from "./event.js";
import { normalizeCourtSchedule } from "./courtSchedule.js";

const VALID_MODES = new Set(Object.values(TOURNAMENT_MODE));
const VALID_OFFICIAL_MODES = new Set(Object.values(OFFICIAL_MODE));
const VALID_STATUSES = new Set(Object.values(TOURNAMENT_STATUS));
const VALID_LEVELS = new Set(Object.values(TOURNAMENT_LEVEL));
const VALID_CERTIFICATION = new Set(Object.values(CERTIFICATION_STATUS));
const VALID_AWARD_STATUS = new Set(Object.values(VPR_AWARD_STATUS));

function normalizeTournamentLevel(value) {
  const raw = String(value || TOURNAMENT_LEVEL.COMMUNITY).trim().toLowerCase();
  return VALID_LEVELS.has(raw) ? raw : TOURNAMENT_LEVEL.COMMUNITY;
}

function normalizeCertificationStatus(value, tournamentLevel) {
  const raw = String(value || "").trim().toLowerCase();
  if (VALID_CERTIFICATION.has(raw)) {
    return raw;
  }
  return VPR_ELIGIBLE_LEVELS.includes(tournamentLevel)
    ? CERTIFICATION_STATUS.PENDING
    : CERTIFICATION_STATUS.NOT_REQUIRED;
}

function normalizeCertificationBlock(certification = {}) {
  const src = certification && typeof certification === "object" ? certification : {};
  return {
    requestedAt: src.requestedAt || null,
    reviewedAt: src.reviewedAt || null,
    reviewedBy: src.reviewedBy ? String(src.reviewedBy) : null,
    rejectionReason: src.rejectionReason ? String(src.rejectionReason) : "",
    notes: src.notes ? String(src.notes) : "",
  };
}

function normalizeResultsConfirmation(block = {}) {
  const src = block && typeof block === "object" ? block : {};
  return {
    confirmed: src.confirmed === true,
    confirmedAt: src.confirmedAt || null,
    confirmedBy: src.confirmedBy ? String(src.confirmedBy) : null,
  };
}

function normalizeVprAward(block = {}) {
  const src = block && typeof block === "object" ? block : {};
  const status = String(src.status || VPR_AWARD_STATUS.PENDING).trim().toLowerCase();
  return {
    status: VALID_AWARD_STATUS.has(status) ? status : VPR_AWARD_STATUS.PENDING,
    awardedAt: src.awardedAt || null,
    batchId: src.batchId ? String(src.batchId) : null,
  };
}

/** Apply certification rules when BTC sets tournament level (not admin override). */
export function resolveCertificationForLevel(tournamentLevel, existing = {}) {
  const level = normalizeTournamentLevel(tournamentLevel);
  const eligible = VPR_ELIGIBLE_LEVELS.includes(level);

  if (!eligible) {
    return {
      tournamentLevel: level,
      certificationStatus: CERTIFICATION_STATUS.NOT_REQUIRED,
      rankingEnabled: false,
      certification: normalizeCertificationBlock(existing.certification),
    };
  }

  const currentStatus = existing.certificationStatus;
  const preserveApproved =
    currentStatus === CERTIFICATION_STATUS.APPROVED &&
    existing.tournamentLevel === level;

  return {
    tournamentLevel: level,
    certificationStatus: preserveApproved
      ? CERTIFICATION_STATUS.APPROVED
      : CERTIFICATION_STATUS.PENDING,
    rankingEnabled: preserveApproved ? existing.rankingEnabled === true : false,
    certification: {
      ...normalizeCertificationBlock(existing.certification),
      requestedAt:
        preserveApproved && existing.certification?.requestedAt
          ? existing.certification.requestedAt
          : new Date().toISOString(),
    },
  };
}

function normalizeMode(value) {
  const raw = String(value || "").trim().toLowerCase();
  return VALID_MODES.has(raw) ? raw : TOURNAMENT_MODE.DAILY_PLAY;
}

function normalizeOfficialMode(value) {
  if (!value) {
    return null;
  }
  const raw = String(value).trim().toLowerCase();
  return VALID_OFFICIAL_MODES.has(raw) ? raw : null;
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  return VALID_STATUSES.has(raw) ? raw : TOURNAMENT_STATUS.DRAFT;
}

export function normalizeTournament(tournament, index = 0) {
  if (!tournament || tournament.id === undefined || tournament.id === null) {
    return null;
  }

  const mode = normalizeMode(tournament.mode);
  const tournamentLevel = normalizeTournamentLevel(
    tournament.tournamentLevel || tournament.tournament_level
  );
  const certificationStatus = normalizeCertificationStatus(
    tournament.certificationStatus || tournament.certification_status,
    tournamentLevel
  );

  return {
    ...tournament,
    id: String(tournament.id).trim(),
    clubId: tournament.clubId ? String(tournament.clubId).trim() : "",
    seasonId: tournament.seasonId ? String(tournament.seasonId).trim() : "",
    leagueId: tournament.leagueId ? String(tournament.leagueId).trim() : "",
    roundId: tournament.roundId ? String(tournament.roundId).trim() : "",
    name: String(tournament.name || `Giải ${index + 1}`).trim(),
    mode,
    tournamentLevel,
    certificationStatus,
    rankingEnabled: tournament.rankingEnabled === true,
    certification: normalizeCertificationBlock(tournament.certification),
    resultsConfirmation: normalizeResultsConfirmation(tournament.resultsConfirmation),
    vprAward: normalizeVprAward(tournament.vprAward),
    officialMode:
      mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
        ? normalizeOfficialMode(tournament.officialMode) || OFFICIAL_MODE.OPEN
        : normalizeOfficialMode(tournament.officialMode),
    hostClubName: tournament.hostClubName
      ? String(tournament.hostClubName).trim()
      : "",
    events: normalizeEvents(tournament.events || []),
    status: normalizeStatus(tournament.status),
    settings:
      tournament.settings && typeof tournament.settings === "object"
        ? tournament.settings
        : {},
    courtSchedule: normalizeCourtSchedule(tournament.courtSchedule),
    createdAt: tournament.createdAt || new Date().toISOString(),
    updatedAt: tournament.updatedAt || new Date().toISOString(),
    ...(tournament.tenantId ? { tenantId: String(tournament.tenantId).trim() } : {}),
  };
}

export function normalizeTournaments(tournaments = []) {
  if (!Array.isArray(tournaments)) {
    return [];
  }

  return tournaments
    .map((tournament, index) => normalizeTournament(tournament, index))
    .filter(Boolean);
}

export function createTournamentRecord(clubId, options = {}) {
  const mode = normalizeMode(options.mode);
  const certFields = resolveCertificationForLevel(
    options.tournamentLevel || TOURNAMENT_LEVEL.COMMUNITY,
    options
  );

  return normalizeTournament({
    id: options.id || `tournament-${Date.now()}`,
    clubId,
    ...(options.tenantId ? { tenantId: options.tenantId } : {}),
    seasonId: options.seasonId || "",
    leagueId: options.leagueId || "",
    roundId: options.roundId || "",
    name: options.name || "Giải mới",
    mode,
    tournamentLevel: certFields.tournamentLevel,
    certificationStatus: certFields.certificationStatus,
    rankingEnabled: certFields.rankingEnabled,
    certification: certFields.certification,
    resultsConfirmation: options.resultsConfirmation || {},
    vprAward: options.vprAward || {},
    officialMode:
      mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT
        ? options.officialMode || OFFICIAL_MODE.OPEN
        : options.officialMode || null,
    hostClubName: options.hostClubName || "",
    events: options.events || [],
    status: options.status || TOURNAMENT_STATUS.DRAFT,
    settings: options.settings || {},
    courtSchedule: options.courtSchedule || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
