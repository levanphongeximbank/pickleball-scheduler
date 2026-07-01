import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { getCurrentUser, isRbacEnabled } from "../../../auth/authService.js";
import { guardPermission } from "../../../auth/guardAction.js";
import { ROLES, normalizeRole } from "../../../auth/roles.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import {
  CHECKIN_SOURCE,
  CHECKIN_STATUS,
} from "../constants/checkInStatus.js";
import { validateQrToken, auditQrScan, parseQrPayload } from "./qrTokenService.js";
import {
  enqueueOfflineAction,
  OFFLINE_ACTION_TYPES,
} from "./offlineQueue.js";
import { guardOfflineAction } from "./offlineGuardService.js";

const DEV_CHECKINS_KEY = "pickleball-checkins-v1";

function loadDevCheckins() {
  try {
    const raw = localStorage.getItem(DEV_CHECKINS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDevCheckins(entries) {
  localStorage.setItem(DEV_CHECKINS_KEY, JSON.stringify(entries));
}

function findExistingCheckin({ tenantId, tournamentId, entityType, entityId }) {
  const checkins = loadDevCheckins();
  return checkins.find(
    (c) =>
      c.tenant_id === tenantId &&
      c.tournament_id === tournamentId &&
      c.entity_type === entityType &&
      c.entity_id === entityId &&
      c.status === CHECKIN_STATUS.CHECKED_IN
  );
}

async function loadCheckinsFromStore({ tenantId, tournamentId }) {
  if (!hasSupabaseConfig()) {
    return loadDevCheckins().filter(
      (c) =>
        (!tenantId || c.tenant_id === tenantId) &&
        (!tournamentId || c.tournament_id === tournamentId)
    );
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return loadDevCheckins();
  }

  let query = client.from("checkins").select("*").order("checked_in_at", { ascending: false });
  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  if (tournamentId) {
    query = query.eq("tournament_id", tournamentId);
  }
  const { data, error } = await query;
  if (error) {
    return loadDevCheckins();
  }
  return data || [];
}

export function canPerformCheckin(user) {
  if (!user) {
    return false;
  }

  if (normalizeRole(user.role) === ROLES.PLAYER) {
    return false;
  }

  const check = guardPermission(PERMISSIONS.TOURNAMENT_UPDATE, { user });
  if (check.ok) {
    return true;
  }
  const viewCheck = guardPermission(PERMISSIONS.TOURNAMENT_VIEW, { user });
  return viewCheck.ok;
}

/** Resolve manual code input — accepts raw token or full pbs:// payload. */
export function resolveManualQrInput(input) {
  const value = String(input || "").trim();
  if (!value) {
    return { ok: false, error: "Vui lòng nhập mã check-in.", code: "EMPTY" };
  }

  if (value.startsWith("pbs://")) {
    return parseQrPayload(value);
  }

  if (value.length < 16) {
    return { ok: false, error: "Mã check-in quá ngắn.", code: "INVALID" };
  }

  return { ok: true, token: value };
}

export async function processQrCheckin({
  rawToken,
  tenantId,
  venueId = null,
  tournamentId,
  clubId,
  registeredPlayerIds = [],
  skipPermissionCheck = false,
} = {}) {
  const user = getCurrentUser();

  if (!skipPermissionCheck && user && isRbacEnabled() && !canPerformCheckin(user)) {
    const forbidden = {
      ok: false,
      error: "Bạn không có quyền thực hiện check-in.",
      code: "FORBIDDEN",
    };
    await auditQrScan({ rawToken, result: forbidden });
    return forbidden;
  }

  const validation = await validateQrToken(rawToken, {
    expectedTenantId: tenantId,
    expectedVenueId: venueId,
  });

  if (!validation.ok) {
    await auditQrScan({ rawToken, result: validation });
    return validation;
  }

  const { record } = validation;
  const entityId = record.entity_id;
  const entityType = record.entity_type;

  if (tournamentId && record.tournament_id && record.tournament_id !== tournamentId) {
    const wrongTournament = {
      ok: false,
      error: "QR không thuộc giải đấu hiện tại.",
      code: "WRONG_TOURNAMENT",
      record,
    };
    await auditQrScan({ rawToken, result: wrongTournament });
    return wrongTournament;
  }

  if (
    venueId &&
    record.venue_id &&
    record.venue_id !== venueId &&
    record.entity_type === "court"
  ) {
    const wrongVenue = {
      ok: false,
      error: "QR sân không thuộc venue hiện tại.",
      code: "WRONG_VENUE",
      record,
    };
    await auditQrScan({ rawToken, result: wrongVenue });
    return wrongVenue;
  }

  if (
    entityType === "player" &&
    registeredPlayerIds.length > 0 &&
    !registeredPlayerIds.includes(entityId)
  ) {
    const notRegistered = {
      ok: false,
      error: "Người chơi chưa đăng ký giải.",
      code: "NOT_REGISTERED",
      record,
    };
    await auditQrScan({ rawToken, result: notRegistered });
    return notRegistered;
  }

  const existing = findExistingCheckin({
    tenantId: record.tenant_id,
    tournamentId: tournamentId || record.tournament_id,
    entityType,
    entityId,
  });

  if (existing) {
    const duplicate = {
      ok: false,
      error: `Đã check-in lúc ${new Date(existing.checked_in_at).toLocaleString("vi-VN")}.`,
      code: "DUPLICATE",
      status: CHECKIN_STATUS.DUPLICATE,
      existingCheckin: existing,
      record,
    };
    await auditQrScan({ rawToken, result: duplicate });
    return duplicate;
  }

  const now = new Date();
  const checkinRow = {
    id: `ci-${Date.now()}`,
    tenant_id: record.tenant_id,
    tournament_id: tournamentId || record.tournament_id || null,
    club_id: clubId || null,
    entity_type: entityType,
    entity_id: entityId,
    checked_in_by: user?.id || null,
    checked_in_at: now.toISOString(),
    source: CHECKIN_SOURCE.QR_SCAN,
    status: CHECKIN_STATUS.CHECKED_IN,
    note: "",
  };

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (isOffline) {
    const offlineGuard = guardOfflineAction(OFFLINE_ACTION_TYPES.CHECKIN);
    if (!offlineGuard.ok) {
      await auditQrScan({ rawToken, result: offlineGuard });
      return offlineGuard;
    }

    const checkins = loadDevCheckins();
    checkins.push(checkinRow);
    saveDevCheckins(checkins);
    enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.CHECKIN,
      payload: checkinRow,
      tenantId: record.tenant_id,
      clubId,
    });
    const offlineResult = {
      ok: true,
      checkin: checkinRow,
      offline: true,
      status: CHECKIN_STATUS.CHECKED_IN,
      record,
    };
    await auditQrScan({ rawToken, result: offlineResult, metadata: { offline: true } });
    return offlineResult;
  }

  if (!hasSupabaseConfig()) {
    const checkins = loadDevCheckins();
    checkins.push(checkinRow);
    saveDevCheckins(checkins);
    const devResult = { ok: true, checkin: checkinRow, status: CHECKIN_STATUS.CHECKED_IN, record };
    await auditQrScan({ rawToken, result: devResult });
    return devResult;
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    const checkins = loadDevCheckins();
    checkins.push(checkinRow);
    saveDevCheckins(checkins);
    return { ok: true, checkin: checkinRow, status: CHECKIN_STATUS.CHECKED_IN, record, provider: "dev" };
  }

  const { data, error } = await client.from("checkins").insert(checkinRow).select("*").single();
  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Xung đột dữ liệu — đã có check-in trước đó.",
        code: "CONFLICT",
        record,
      };
    }
    return { ok: false, error: error.message, record };
  }

  await auditQrScan({ rawToken, result: { ok: true, record, checkin: data } });
  return { ok: true, checkin: data, status: CHECKIN_STATUS.CHECKED_IN, record };
}

export async function getCheckinDashboard({ tenantId, tournamentId, filters = {} } = {}) {
  let checkins = await loadCheckinsFromStore({ tenantId, tournamentId });

  if (filters.status) {
    checkins = checkins.filter((c) => c.status === filters.status);
  }
  if (filters.entityType) {
    checkins = checkins.filter((c) => c.entity_type === filters.entityType);
  }
  if (filters.clubId) {
    checkins = checkins.filter((c) => c.club_id === filters.clubId);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    checkins = checkins.filter(
      (c) =>
        String(c.entity_id).toLowerCase().includes(q) ||
        String(c.note || "").toLowerCase().includes(q)
    );
  }

  const stats = {
    total: checkins.length,
    checkedIn: checkins.filter((c) => c.status === CHECKIN_STATUS.CHECKED_IN).length,
    pending: checkins.filter((c) => c.status === CHECKIN_STATUS.PENDING).length,
    late: checkins.filter((c) => c.status === CHECKIN_STATUS.LATE).length,
    invalid: checkins.filter((c) => c.status === CHECKIN_STATUS.INVALID).length,
  };

  return { ok: true, checkins, stats };
}

export function buildCheckinSummaryForPlayers({ players, checkins, registeredIds = [] }) {
  const registered = registeredIds.length > 0 ? registeredIds : players.map((p) => p.id);
  const checkedInIds = new Set(
    checkins.filter((c) => c.status === CHECKIN_STATUS.CHECKED_IN).map((c) => c.entity_id)
  );

  return {
    totalRegistered: registered.length,
    checkedIn: registered.filter((id) => checkedInIds.has(id)).length,
    notCheckedIn: registered.filter((id) => !checkedInIds.has(id)).length,
    rows: players
      .filter((p) => registered.includes(p.id))
      .map((player) => ({
        player,
        status: checkedInIds.has(player.id) ? CHECKIN_STATUS.CHECKED_IN : CHECKIN_STATUS.PENDING,
        checkin: checkins.find((c) => c.entity_id === player.id) || null,
      })),
  };
}
