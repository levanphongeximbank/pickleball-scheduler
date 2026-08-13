/**
 * Canonical Team Tournament captain identity.
 *
 * Authority:
 *   auth.uid() → athletes.user_id → athletes.id
 *
 * captain_player_id MUST be compared to athletes.id.
 * profiles.player_id / user.playerId / localStorage are NOT authority.
 */

import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

function isCaptainOrDeputy(team, athleteId) {
  const id = normalizeId(athleteId);
  if (!team || !id) {
    return false;
  }
  if (normalizeId(team.captainPlayerId) === id) {
    return true;
  }
  return (team.deputyPlayerIds || []).some((value) => normalizeId(value) === id);
}

export const CAPTAIN_IDENTITY_CODES = Object.freeze({
  IDENTITY_UNPROVEN: "IDENTITY_UNPROVEN",
  IDENTITY_AMBIGUOUS: "IDENTITY_AMBIGUOUS",
  NOT_CAPTAIN: "NOT_CAPTAIN",
  CAPTAIN_TEAM_AMBIGUOUS: "CAPTAIN_TEAM_AMBIGUOUS",
  TENANT_DENIED: "TENANT_DENIED",
});

function normalizeId(value) {
  return value ? String(value).trim() : "";
}

/**
 * Sync athlete id only when the caller already holds athletes.id.
 * Never promote profiles.player_id / user.playerId / auth uid.
 *
 * @param {object|null|undefined} user
 * @returns {string|null}
 */
export function resolveCanonicalCaptainAthleteIdFromUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const athleteId = normalizeId(
    user.athleteId || user.athlete_id || user.canonicalAthleteId
  );
  if (!athleteId) {
    return null;
  }

  const authUid = normalizeId(user.id);
  if (authUid && athleteId === authUid) {
    return null;
  }

  return athleteId;
}

/**
 * @param {object[]} rows
 * @param {string} userId
 * @returns {{
 *   ok: boolean,
 *   athleteId: string|null,
 *   code: string|null,
 *   error: string|null
 * }}
 */
export function selectCanonicalAthleteIdForUser(rows, userId) {
  const uid = normalizeId(userId);
  if (!uid) {
    return {
      ok: false,
      athleteId: null,
      code: CAPTAIN_IDENTITY_CODES.IDENTITY_UNPROVEN,
      error: "Không xác định được danh tính vận động viên.",
    };
  }

  const matched = (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row) return false;
    if (normalizeId(row.user_id || row.userId) !== uid) return false;
    const status = String(row.status || "active").trim().toLowerCase();
    return !status || status === "active";
  });

  const uniqueIds = [
    ...new Set(
      matched
        .map((row) => normalizeId(row.id || row.athleteId || row.athlete_id))
        .filter(Boolean)
    ),
  ];

  if (uniqueIds.length === 1) {
    return {
      ok: true,
      athleteId: uniqueIds[0],
      code: null,
      error: null,
    };
  }

  if (uniqueIds.length > 1) {
    return {
      ok: false,
      athleteId: null,
      code: CAPTAIN_IDENTITY_CODES.IDENTITY_AMBIGUOUS,
      error: "Không xác định được danh tính vận động viên.",
    };
  }

  return {
    ok: false,
    athleteId: null,
    code: CAPTAIN_IDENTITY_CODES.IDENTITY_UNPROVEN,
    error: "Không xác định được danh tính vận động viên.",
  };
}

async function defaultFetchCanonicalAthleteIdViaRpc() {
  const client = getSupabaseAuthClient();
  if (!client?.rpc) {
    return { ok: false, athleteId: null, error: "Supabase chưa sẵn sàng." };
  }
  const { data, error } = await client.rpc("team_tournament_user_player_id");
  if (error) {
    return { ok: false, athleteId: null, error: error.message };
  }
  const athleteId = normalizeId(data);
  if (!athleteId) {
    return { ok: false, athleteId: null, error: "Không xác định được danh tính vận động viên." };
  }
  return { ok: true, athleteId };
}

async function defaultFetchAthletesByUserId(userId) {
  const client = getSupabaseAuthClient();
  if (!client?.from) {
    return { ok: false, rows: [], error: "Supabase chưa sẵn sàng." };
  }
  const { data, error } = await client
    .from("athletes")
    .select("id, user_id, status")
    .eq("user_id", userId);
  if (error) {
    return { ok: false, rows: [], error: error.message };
  }
  return { ok: true, rows: Array.isArray(data) ? data : [] };
}

/**
 * @param {{
 *   userId?: string|null,
 *   user?: object|null,
 *   fetchAthletesByUserId?: (userId: string) => Promise<{ ok: boolean, rows?: object[], error?: string }>
 * }} input
 */
function rejectAuthUidAsAthleteId(athleteId, userId) {
  const id = normalizeId(athleteId);
  const uid = normalizeId(userId);
  if (!id) {
    return null;
  }
  if (uid && id === uid) {
    return null;
  }
  return id;
}

export function extractServerCaptainViewerPlayerId(viewer) {
  if (!viewer || typeof viewer !== "object") {
    return null;
  }
  return rejectAuthUidAsAthleteId(
    viewer.viewerPlayerId || viewer.playerId,
    viewer.userId || viewer.authUid || viewer.authUserId
  );
}

export async function lookupCanonicalCaptainAthleteId(input = {}) {
  const user = input.user || null;
  const synced = resolveCanonicalCaptainAthleteIdFromUser(user);
  if (synced) {
    return {
      ok: true,
      athleteId: synced,
      code: null,
      error: null,
    };
  }

  const userId = normalizeId(input.userId || user?.id);
  if (!userId) {
    return {
      ok: false,
      athleteId: null,
      code: CAPTAIN_IDENTITY_CODES.IDENTITY_UNPROVEN,
      error: "Không xác định được danh tính vận động viên.",
    };
  }

  const fetchViaRpc =
    typeof input.fetchCanonicalAthleteIdViaRpc === "function"
      ? input.fetchCanonicalAthleteIdViaRpc
      : defaultFetchCanonicalAthleteIdViaRpc;

  const fromRpc = await fetchViaRpc();
  const rpcAthleteId = rejectAuthUidAsAthleteId(fromRpc?.athleteId, userId);
  if (fromRpc?.ok && rpcAthleteId) {
    return {
      ok: true,
      athleteId: rpcAthleteId,
      code: null,
      error: null,
    };
  }

  const fetchRows =
    typeof input.fetchAthletesByUserId === "function"
      ? input.fetchAthletesByUserId
      : defaultFetchAthletesByUserId;

  const fetched = await fetchRows(userId);
  if (!fetched?.ok) {
    return {
      ok: false,
      athleteId: null,
      code: CAPTAIN_IDENTITY_CODES.IDENTITY_UNPROVEN,
      error: fetched?.error || fromRpc?.error || "Không xác định được danh tính vận động viên.",
    };
  }

  const selected = selectCanonicalAthleteIdForUser(fetched.rows || [], userId);
  if (selected.ok) {
    const safeId = rejectAuthUidAsAthleteId(selected.athleteId, userId);
    if (!safeId) {
      return {
        ok: false,
        athleteId: null,
        code: CAPTAIN_IDENTITY_CODES.IDENTITY_UNPROVEN,
        error: "Không xác định được danh tính vận động viên.",
      };
    }
    return { ...selected, athleteId: safeId };
  }
  return selected;
}

/**
 * @param {object|null|undefined} teamData
 * @param {string|null|undefined} athleteId
 * @returns {object[]}
 */
export function listTeamsForCaptain(teamData, athleteId) {
  const id = normalizeId(athleteId);
  if (!teamData?.teams || !id) {
    return [];
  }
  return teamData.teams.filter((team) => isCaptainOrDeputy(team, id));
}

/**
 * Exactly one captain/deputy team → ok.
 * Zero → NOT_CAPTAIN. Multiple → fail closed.
 *
 * @param {object|null|undefined} teamData
 * @param {string|null|undefined} athleteId
 */
export function resolveUniqueCaptainTeam(teamData, athleteId) {
  const matches = listTeamsForCaptain(teamData, athleteId);
  if (matches.length === 1) {
    return {
      ok: true,
      team: matches[0],
      code: null,
      error: null,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      team: null,
      code: CAPTAIN_IDENTITY_CODES.CAPTAIN_TEAM_AMBIGUOUS,
      error: "Không xác định được đội đội trưởng — liên hệ ban tổ chức.",
    };
  }
  return {
    ok: false,
    team: null,
    code: CAPTAIN_IDENTITY_CODES.NOT_CAPTAIN,
    error: "Bạn không có quyền truy cập đội này.",
  };
}

export function isProfilePlayerIdForbiddenAsCaptainAuthority(sourceText) {
  const src = String(sourceText || "");
  return (
    src.includes("user.playerId") ||
    src.includes("user.player_id") ||
    src.includes("profile?.player_id") ||
    src.includes("profiles.player_id")
  );
}
