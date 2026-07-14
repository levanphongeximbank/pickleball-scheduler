/**
 * S1-G — Awards module for Individual Tournament.
 */

import { createId } from "../../../utils/id.js";
import { MATCH_STAGE, MATCH_STATUS } from "../../../models/tournament/constants.js";
import {
  RESULTS_OPS_AUDIT,
  appendResultsOpsAudit,
  getResultsOps,
} from "./walkoverEngine.js";
import { getThirdPlaceMedalEntryId } from "./thirdPlaceEngine.js";
import { buildIndividualAllGroupStandings } from "../adapters/individualStandingsAdapter.js";
import { getLiveStandings } from "./resultPropagationEngine.js";

export const AWARD_KEY = Object.freeze({
  CHAMPION: "champion",
  RUNNER_UP: "runnerUp",
  THIRD_PLACE: "thirdPlace",
  FOURTH_PLACE: "fourthPlace",
  SPORTSMANSHIP: "sportsmanship",
  MVP: "mvp",
});

export const DEFAULT_AWARDS_CONFIG = Object.freeze({
  [AWARD_KEY.CHAMPION]: { enabled: true, label: "Vô địch" },
  [AWARD_KEY.RUNNER_UP]: { enabled: true, label: "Á quân" },
  [AWARD_KEY.THIRD_PLACE]: { enabled: true, label: "Hạng ba" },
  [AWARD_KEY.FOURTH_PLACE]: { enabled: true, label: "Hạng tư" },
  [AWARD_KEY.SPORTSMANSHIP]: { enabled: false, label: "Fair-play / Thể thao" },
  [AWARD_KEY.MVP]: { enabled: false, label: "MVP" },
});

function patchAwards(tournament, patch) {
  const current = getAwardsState(tournament);
  return {
    ...tournament,
    settings: {
      ...(tournament.settings || {}),
      awards: {
        ...current,
        ...patch,
      },
    },
  };
}

export function normalizeAwardsConfig(config = {}) {
  return Object.entries(DEFAULT_AWARDS_CONFIG).reduce((acc, [key, defaults]) => {
    const value = config[key] && typeof config[key] === "object" ? config[key] : {};
    acc[key] = {
      enabled: value.enabled !== undefined ? value.enabled === true : defaults.enabled,
      label: value.label ? String(value.label).trim() : defaults.label,
      entryId: value.entryId ? String(value.entryId).trim() : "",
    };
    return acc;
  }, {});
}

export function getAwardsState(tournament) {
  const raw = tournament?.settings?.awards || {};
  return {
    config: normalizeAwardsConfig(raw.config || {}),
    assignments: raw.assignments && typeof raw.assignments === "object" ? raw.assignments : {},
    certificates: Array.isArray(raw.certificates) ? raw.certificates : [],
    updatedAt: raw.updatedAt || null,
  };
}

export function getAwardsConfig(tournament) {
  return getAwardsState(tournament).config;
}

export function updateAwardsConfig(tournament, patch = {}) {
  const current = getAwardsConfig(tournament);
  const next = normalizeAwardsConfig({ ...current, ...patch });
  return {
    ok: true,
    tournament: patchAwards(tournament, {
      ...getAwardsState(tournament),
      config: next,
      updatedAt: new Date().toISOString(),
    }),
    awardsConfig: next,
  };
}

function entryName(event, entryId) {
  const entry = (event?.entries || []).find((e) => String(e.id) === String(entryId));
  return entry?.name || entryId || "";
}

function resolveFinalists(event) {
  const finalMatch = (event?.matches || []).find((m) => m.stage === MATCH_STAGE.FINAL);
  if (
    finalMatch &&
    (finalMatch.status === MATCH_STATUS.COMPLETED || finalMatch.status === MATCH_STATUS.FORFEIT)
  ) {
    return {
      championId: finalMatch.winnerId || "",
      runnerUpId: finalMatch.loserId || "",
      finalMatch,
    };
  }
  return { championId: "", runnerUpId: "", finalMatch: null };
}

function resolveFourth(event, thirdPlaceWinnerId) {
  const third = (event?.matches || []).find(
    (m) => m.stage === MATCH_STAGE.THIRD_PLACE || m.isThirdPlace
  );
  if (
    third &&
    (third.status === MATCH_STATUS.COMPLETED || third.status === MATCH_STATUS.FORFEIT)
  ) {
    return third.loserId || "";
  }
  // Fallback: SF losers excluding third medal
  const semis = (event?.matches || []).filter((m) => m.stage === MATCH_STAGE.SEMIFINAL);
  const losers = semis.map((m) => m.loserId).filter(Boolean);
  return losers.find((id) => id && id !== thirdPlaceWinnerId) || losers[1] || "";
}

/**
 * Build final ranking podium from KO results, else group standings fallback.
 */
export function buildFinalRanking(tournament, eventId = "") {
  const event =
    (tournament.events || []).find((e) => String(e.id) === String(eventId)) ||
    tournament.events?.[0];
  if (!event) {
    return { ok: false, error: "Không tìm thấy nội dung.", ranking: [] };
  }

  const { championId, runnerUpId } = resolveFinalists(event);
  const thirdId = getThirdPlaceMedalEntryId(event) || "";
  const fourthId = resolveFourth(event, thirdId);

  const ranking = [];
  if (championId) {
    ranking.push({ rank: 1, entryId: championId, name: entryName(event, championId), medal: "gold" });
  }
  if (runnerUpId) {
    ranking.push({
      rank: 2,
      entryId: runnerUpId,
      name: entryName(event, runnerUpId),
      medal: "silver",
    });
  }
  if (thirdId) {
    ranking.push({ rank: 3, entryId: thirdId, name: entryName(event, thirdId), medal: "bronze" });
  }
  if (fourthId) {
    ranking.push({
      rank: 4,
      entryId: fourthId,
      name: entryName(event, fourthId),
      medal: null,
    });
  }

  if (ranking.length === 0) {
    const live = getLiveStandings(tournament, event.id);
    const groups =
      live?.groups ||
      buildIndividualAllGroupStandings(event, { forceCanonical: false });
    const flat = [];
    (groups || []).forEach((g) => {
      (g.standing || []).forEach((row) => {
        flat.push({
          entryId: row.id || row.entryId,
          name: row.name,
          matchPoints: row.matchPoints || 0,
          scoreDiff: row.scoreDiff || 0,
        });
      });
    });
    flat
      .sort(
        (a, b) =>
          b.matchPoints - a.matchPoints || b.scoreDiff - a.scoreDiff
      )
      .slice(0, 4)
      .forEach((row, index) => {
        ranking.push({
          rank: index + 1,
          entryId: row.entryId,
          name: row.name || row.entryId,
          medal: index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "bronze" : null,
          source: "standings_fallback",
        });
      });
  }

  return { ok: true, eventId: event.id, ranking };
}

export function buildAwardsPreview(tournament, options = {}) {
  const eventId = options.eventId || tournament.events?.[0]?.id || "";
  const event =
    (tournament.events || []).find((e) => String(e.id) === String(eventId)) ||
    tournament.events?.[0];
  const config = normalizeAwardsConfig({
    ...getAwardsConfig(tournament),
    ...(options.awardsConfig || {}),
  });
  const state = getAwardsState(tournament);
  const final = buildFinalRanking(tournament, eventId);
  const byRank = new Map((final.ranking || []).map((r) => [r.rank, r]));

  const awards = [];

  const pushAuto = (key, rank) => {
    if (!config[key]?.enabled) return;
    const ranked = byRank.get(rank);
    const manualId = state.assignments[key] || config[key].entryId || "";
    const entryId = manualId || ranked?.entryId || "";
    awards.push({
      key,
      label: config[key].label,
      rank,
      entryId,
      entryName: entryName(event, entryId) || ranked?.name || "",
      medal: ranked?.medal || null,
      auto: !manualId,
      certificateStatus: resolveCertificateStatus(state.certificates, key, entryId),
    });
  };

  pushAuto(AWARD_KEY.CHAMPION, 1);
  pushAuto(AWARD_KEY.RUNNER_UP, 2);
  pushAuto(AWARD_KEY.THIRD_PLACE, 3);
  pushAuto(AWARD_KEY.FOURTH_PLACE, 4);

  [AWARD_KEY.SPORTSMANSHIP, AWARD_KEY.MVP].forEach((key) => {
    if (!config[key]?.enabled) return;
    const entryId = state.assignments[key] || config[key].entryId || "";
    awards.push({
      key,
      label: config[key].label,
      rank: null,
      entryId,
      entryName: entryName(event, entryId),
      medal: null,
      auto: false,
      certificateStatus: resolveCertificateStatus(state.certificates, key, entryId),
    });
  });

  return {
    awards,
    ranking: final.ranking || [],
    eventId,
    standingsFallback: (final.ranking || []).some((r) => r.source === "standings_fallback"),
  };
}

function resolveCertificateStatus(certificates, awardKey, entryId) {
  const found = (certificates || []).find(
    (c) => c.awardKey === awardKey && String(c.entryId) === String(entryId)
  );
  return found?.status || (entryId ? "pending" : "none");
}

export function assignAward(tournament, awardKey, entryId, options = {}) {
  if (!Object.values(AWARD_KEY).includes(awardKey)) {
    return { ok: false, error: "Loại giải không hợp lệ." };
  }
  if (getResultsOps(tournament).closed && !options.allowWhenClosed) {
    return { ok: false, error: "Giải đã đóng — chỉ xem giải thưởng." };
  }

  const state = getAwardsState(tournament);
  const assignments = {
    ...state.assignments,
    [awardKey]: entryId ? String(entryId) : "",
  };

  let certificates = [...state.certificates];
  if (entryId) {
    const existingIdx = certificates.findIndex((c) => c.awardKey === awardKey);
    const cert = {
      id: createId("cert"),
      awardKey,
      entryId: String(entryId),
      status: "ready",
      assignedAt: new Date().toISOString(),
      assignedBy: options.actor?.id || options.userId || "",
    };
    if (existingIdx >= 0) certificates[existingIdx] = cert;
    else certificates.push(cert);
  }

  let next = patchAwards(tournament, {
    ...state,
    assignments,
    certificates,
    updatedAt: new Date().toISOString(),
  });

  next = appendResultsOpsAudit(
    next,
    {
      action: RESULTS_OPS_AUDIT.AWARD_ASSIGNED,
      entryId: entryId || "",
      actor: options.actor,
      reason: awardKey,
      meta: { awardKey, entryId },
    },
    options
  );

  return { ok: true, tournament: next, awardKey, entryId };
}

export function autoAssignAwardsFromRanking(tournament, options = {}) {
  const preview = buildAwardsPreview(tournament, options);
  let next = tournament;
  for (const award of preview.awards) {
    if (!award.entryId) continue;
    if (award.key === AWARD_KEY.SPORTSMANSHIP || award.key === AWARD_KEY.MVP) continue;
    const result = assignAward(next, award.key, award.entryId, options);
    if (result.ok) next = result.tournament;
  }
  return { ok: true, tournament: next, preview: buildAwardsPreview(next, options) };
}

/** Export awards sheet as JSON string (download-ready). */
export function exportAwardsJson(tournament, options = {}) {
  const preview = buildAwardsPreview(tournament, options);
  const payload = {
    tournamentId: tournament.id,
    tournamentName: tournament.name || "",
    exportedAt: new Date().toISOString(),
    awards: preview.awards,
    ranking: preview.ranking,
  };
  return {
    ok: true,
    filename: `awards-${tournament.id || "tournament"}.json`,
    mimeType: "application/json",
    content: JSON.stringify(payload, null, 2),
    payload,
  };
}

export function exportAwardsCsv(tournament, options = {}) {
  const preview = buildAwardsPreview(tournament, options);
  const lines = ["award,label,rank,entryId,entryName,medal,certificateStatus"];
  preview.awards.forEach((a) => {
    lines.push(
      [
        a.key,
        JSON.stringify(a.label),
        a.rank ?? "",
        a.entryId,
        JSON.stringify(a.entryName || ""),
        a.medal || "",
        a.certificateStatus,
      ].join(",")
    );
  });
  return {
    ok: true,
    filename: `awards-${tournament.id || "tournament"}.csv`,
    mimeType: "text/csv",
    content: lines.join("\n"),
  };
}

export function getPlayerAwardSummary(tournament, entryId) {
  const preview = buildAwardsPreview(tournament);
  const mine = preview.awards.filter((a) => String(a.entryId) === String(entryId));
  const rankRow = (preview.ranking || []).find((r) => String(r.entryId) === String(entryId));
  return {
    entryId,
    awards: mine,
    finalRank: rankRow?.rank || null,
    medal: rankRow?.medal || mine.find((a) => a.medal)?.medal || null,
    certificateStatus: mine[0]?.certificateStatus || "none",
  };
}
