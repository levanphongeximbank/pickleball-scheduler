import { createClient } from "@supabase/supabase-js";

import {
  createScoreAdjustLogEntry,
  createScoreLogEntry,
  normalizeScoreLog,
  REFEREE_LINK_LOCKED_MESSAGE,
  SCORE_LOG_ACTION,
  SCORE_LOG_SOURCE,
} from "../models/tournament/scoreLog.js";

export const MATCH_LIVE_TABLE = "tournament_match_live";

export const MATCH_LIVE_STATUS = {
  PLAYING: "playing",
  FINALIZE_REQUESTED: "finalize_requested",
  PROCESSED: "processed",
  LOCKED: "locked",
};

export { REFEREE_LINK_LOCKED_MESSAGE };

const SUPABASE_URL =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_URL || ""
    : "";

const SUPABASE_KEY =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_ANON_KEY || ""
    : "";

let client = null;

export function hasSupabaseConfig() {
  return SUPABASE_URL.trim() !== "" && SUPABASE_KEY.trim() !== "";
}

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return client;
}

export function buildSupabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function buildMatchLiveId(clubId, tournamentId, matchId) {
  return `${clubId}::${tournamentId}::${matchId}`;
}

function normalizeAuditLog(value) {
  return normalizeScoreLog(Array.isArray(value) ? value : []);
}

export function normalizeMatchLiveRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: String(row.id || ""),
    clubId: String(row.club_id || row.clubId || ""),
    tournamentId: String(row.tournament_id || row.tournamentId || ""),
    eventId: String(row.event_id || row.eventId || ""),
    matchId: String(row.match_id || row.matchId || ""),
    refereeToken: String(row.referee_token || row.refereeToken || ""),
    refereeName: String(row.referee_name || row.refereeName || ""),
    tournamentName: String(row.tournament_name || row.tournamentName || ""),
    stageLabel: String(row.stage_label || row.stageLabel || ""),
    entryALabel: String(row.entry_a_label || row.entryALabel || "Đội A"),
    entryBLabel: String(row.entry_b_label || row.entryBLabel || "Đội B"),
    courtLabel: String(row.court_label || row.courtLabel || ""),
    scoreA: Number(row.score_a ?? row.scoreA ?? 0),
    scoreB: Number(row.score_b ?? row.scoreB ?? 0),
    status: String(row.status || MATCH_LIVE_STATUS.PLAYING),
    isDaily: Boolean(row.is_daily ?? row.isDaily),
    auditLog: normalizeAuditLog(row.audit_log ?? row.auditLog),
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

function isLockedStatus(status) {
  return (
    status === MATCH_LIVE_STATUS.FINALIZE_REQUESTED ||
    status === MATCH_LIVE_STATUS.PROCESSED ||
    status === MATCH_LIVE_STATUS.LOCKED
  );
}

function toDbRow(record) {
  return {
    id: record.id,
    club_id: record.clubId,
    tournament_id: record.tournamentId,
    event_id: record.eventId || "",
    match_id: record.matchId,
    referee_token: record.refereeToken,
    referee_name: record.refereeName || "",
    tournament_name: record.tournamentName || "",
    stage_label: record.stageLabel || "",
    entry_a_label: record.entryALabel || "Đội A",
    entry_b_label: record.entryBLabel || "Đội B",
    court_label: record.courtLabel || "",
    score_a: Math.max(0, Number(record.scoreA) || 0),
    score_b: Math.max(0, Number(record.scoreB) || 0),
    status: record.status || MATCH_LIVE_STATUS.PLAYING,
    is_daily: Boolean(record.isDaily),
    audit_log: normalizeAuditLog(record.auditLog),
    updated_at: new Date().toISOString(),
  };
}

export async function upsertMatchLive(record) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "Chua cau hinh Supabase." };
  }

  const { data, error } = await supabase
    .from(MATCH_LIVE_TABLE)
    .upsert(toDbRow(record), { onConflict: "id" })
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, row: normalizeMatchLiveRow(data) };
}

export async function fetchMatchLiveByToken(token) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "Chua cau hinh Supabase." };
  }

  const { data, error } = await supabase
    .from(MATCH_LIVE_TABLE)
    .select("*")
    .eq("referee_token", String(token))
    .maybeSingle();

  if (error) {
    return { ok: false, error: REFEREE_LINK_LOCKED_MESSAGE };
  }

  if (!data) {
    return { ok: false, error: REFEREE_LINK_LOCKED_MESSAGE };
  }

  return { ok: true, row: normalizeMatchLiveRow(data) };
}

export async function fetchMatchLiveForTournament(clubId, tournamentId) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "Chua cau hinh Supabase.", rows: [] };
  }

  const { data, error } = await supabase
    .from(MATCH_LIVE_TABLE)
    .select("*")
    .eq("club_id", String(clubId))
    .eq("tournament_id", String(tournamentId));

  if (error) {
    return { ok: false, error: error.message, rows: [] };
  }

  return {
    ok: true,
    rows: (data || []).map(normalizeMatchLiveRow).filter(Boolean),
  };
}

export async function adjustMatchLiveScore(token, { team, delta, userAgent = "" } = {}) {
  const currentResult = await fetchMatchLiveByToken(token);
  if (!currentResult.ok || !currentResult.row) {
    return { ok: false, error: REFEREE_LINK_LOCKED_MESSAGE, locked: true };
  }

  const current = currentResult.row;
  if (current.status !== MATCH_LIVE_STATUS.PLAYING) {
    return { ok: false, error: REFEREE_LINK_LOCKED_MESSAGE, locked: true };
  }

  const oldScoreA = current.scoreA;
  const oldScoreB = current.scoreB;
  const nextScoreA =
    team === "A" ? Math.max(0, oldScoreA + delta) : oldScoreA;
  const nextScoreB =
    team === "B" ? Math.max(0, oldScoreB + delta) : oldScoreB;

  const auditEntry = createScoreAdjustLogEntry({
    source: SCORE_LOG_SOURCE.REFEREE,
    actorName: current.refereeName || "Trọng tài",
    matchId: current.matchId,
    refereeToken: current.refereeToken,
    team,
    delta,
    oldScoreA,
    oldScoreB,
    scoreA: nextScoreA,
    scoreB: nextScoreB,
    userAgent,
  });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(MATCH_LIVE_TABLE)
    .update({
      score_a: nextScoreA,
      score_b: nextScoreB,
      audit_log: [...current.auditLog, auditEntry],
      updated_at: new Date().toISOString(),
    })
    .eq("referee_token", String(token))
    .eq("status", MATCH_LIVE_STATUS.PLAYING)
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: REFEREE_LINK_LOCKED_MESSAGE, locked: true };
  }

  return { ok: true, row: normalizeMatchLiveRow(data), auditEntry };
}

export async function updateMatchLiveScores(token, scoreA, scoreB) {
  void scoreB;
  return adjustMatchLiveScore(token, {
    team: "A",
    delta: Math.max(0, Number(scoreA) || 0) - 0,
  });
}

export async function requestMatchLiveFinalize(token, scoreA, scoreB, options = {}) {
  const currentResult = await fetchMatchLiveByToken(token);
  if (!currentResult.ok || !currentResult.row) {
    return { ok: false, error: REFEREE_LINK_LOCKED_MESSAGE, locked: true };
  }

  if (isLockedStatus(currentResult.row.status)) {
    return { ok: false, error: REFEREE_LINK_LOCKED_MESSAGE, locked: true };
  }

  const current = currentResult.row;
  const nextScoreA = Math.max(0, Number(scoreA) || 0);
  const nextScoreB = Math.max(0, Number(scoreB) || 0);

  const finalizeEntry = createScoreLogEntry({
    source: SCORE_LOG_SOURCE.REFEREE,
    action: SCORE_LOG_ACTION.FINALIZED,
    actorName: current.refereeName || "Trọng tài",
    matchId: current.matchId,
    refereeToken: current.refereeToken,
    oldScoreA: current.scoreA,
    oldScoreB: current.scoreB,
    scoreA: nextScoreA,
    scoreB: nextScoreB,
    userAgent: options.userAgent || "",
    note: options.note || "",
  });

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "Chua cau hinh Supabase." };
  }

  const { data, error } = await supabase
    .from(MATCH_LIVE_TABLE)
    .update({
      score_a: nextScoreA,
      score_b: nextScoreB,
      status: MATCH_LIVE_STATUS.FINALIZE_REQUESTED,
      audit_log: [...current.auditLog, finalizeEntry],
      updated_at: new Date().toISOString(),
    })
    .eq("referee_token", String(token))
    .eq("status", MATCH_LIVE_STATUS.PLAYING)
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: REFEREE_LINK_LOCKED_MESSAGE, locked: true };
  }

  return { ok: true, row: normalizeMatchLiveRow(data), finalizeEntry };
}

export async function markMatchLiveProcessed(id) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "Chua cau hinh Supabase." };
  }

  const { error } = await supabase
    .from(MATCH_LIVE_TABLE)
    .update({
      status: MATCH_LIVE_STATUS.LOCKED,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(id));

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function resetMatchLiveForDispute(matchLiveId, options = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "Chua cau hinh Supabase." };
  }

  const { data: current, error: readError } = await supabase
    .from(MATCH_LIVE_TABLE)
    .select("*")
    .eq("id", String(matchLiveId))
    .maybeSingle();

  if (readError || !current) {
    return { ok: false, error: readError?.message || "Khong tim thay tran live." };
  }

  const row = normalizeMatchLiveRow(current);
  const resetEntry = createScoreLogEntry({
    source: SCORE_LOG_SOURCE.DIRECTOR,
    action: SCORE_LOG_ACTION.DISPUTE_RESET,
    actorName: options.actorName || "BTC",
    matchId: row.matchId,
    refereeToken: row.refereeToken,
    oldScoreA: row.scoreA,
    oldScoreB: row.scoreB,
    scoreA: 0,
    scoreB: 0,
    note: options.note || "Reset điểm live trọng tài",
  });

  const { data, error } = await supabase
    .from(MATCH_LIVE_TABLE)
    .update({
      score_a: 0,
      score_b: 0,
      status: MATCH_LIVE_STATUS.PLAYING,
      audit_log: [...row.auditLog, resetEntry],
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(matchLiveId))
    .select()
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, row: normalizeMatchLiveRow(data), resetEntry };
}

export function subscribeTournamentMatchLive(clubId, tournamentId, onChange) {
  const supabase = getSupabaseClient();
  if (!supabase || !clubId || !tournamentId) {
    return () => {};
  }

  const channel = supabase
    .channel(`match-live-${clubId}-${tournamentId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: MATCH_LIVE_TABLE,
        filter: `club_id=eq.${clubId}`,
      },
      (payload) => {
        const row = normalizeMatchLiveRow(payload.new || payload.old);
        if (!row || String(row.tournamentId) !== String(tournamentId)) {
          return;
        }
        onChange(row, payload.eventType);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeMatchLiveByToken(token, onChange) {
  const supabase = getSupabaseClient();
  if (!supabase || !token) {
    return () => {};
  }

  const channel = supabase
    .channel(`referee-${token}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: MATCH_LIVE_TABLE,
        filter: `referee_token=eq.${token}`,
      },
      (payload) => {
        const row = normalizeMatchLiveRow(payload.new);
        if (row) {
          onChange(row);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
