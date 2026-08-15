/**
 * My Tournaments hub projection — server list_my_dashboards is sole authority.
 * Client does not filter by activeClub / local tenant.
 */
import { isUnresolvedBracketPlaceholder } from "../engines/teamKnockoutEngine.js";


export function normalizeMyDashboardListResult(payload = {}) {
  if (!payload || payload.ok === false) {
    const code = payload?.code || "DASHBOARD_LIST_UNAVAILABLE";
    return {
      ok: false,
      code,
      error:
        payload?.error ||
        (code === "NOT_AUTHENTICATED"
          ? "Phiên đăng nhập hết hạn — đăng nhập lại."
          : code === "CROSS_TENANT_DENIED"
            ? "Không xem được giải của tenant khác."
            : code === "RPC_MISSING"
              ? "Danh sách Giải của tôi chưa sẵn sàng trên máy chủ."
              : "Không tải được danh sách giải của tôi."),
      tournaments: [],
    };
  }
  const tournaments = Array.isArray(payload.tournaments) ? payload.tournaments : [];
  return {
    ok: true,
    tournaments: tournaments.map(projectMyDashboardCard).filter(Boolean),
  };
}

export function projectMyDashboardCard(raw = {}) {
  const id = String(raw.id || raw.tournamentId || "").trim();
  if (!id) return null;
  const roles = Array.isArray(raw.roles)
    ? raw.roles.map(String).filter(Boolean)
    : [];
  const href = String(raw.href || `/tournaments/${id}`).trim();
  const clubId = raw.clubId || raw.club_id || null;
  const captainPortalHref =
    raw.captainPortalHref ||
    (roles.includes("captain")
      ? `/team-portal/${id}${clubId ? `?club=${encodeURIComponent(clubId)}` : ""}`
      : null);
  const refereeHref =
    raw.refereeHref ||
    (roles.includes("referee") ? `/team-referee/${id}` : null);

  return {
    id,
    tournamentId: id,
    competitionType: "team",
    teamDomainId: raw.teamDomainId || null,
    name: raw.name || "Giải đồng đội",
    status: String(raw.status || "draft").toLowerCase(),
    clubId,
    tenantId: raw.tenantId || raw.tenant_id || null,
    roles,
    myTeam: raw.myTeam
      ? {
          id: raw.myTeam.id || null,
          name: raw.myTeam.name || null,
        }
      : null,
    openTaskCount: Number(raw.openTaskCount || 0) || 0,
    nextMatchup:
      raw.nextMatchup && !isUnresolvedBracketPlaceholder(raw.nextMatchup)
        ? raw.nextMatchup
        : null,
    href,
    captainPortalHref,
    refereeHref,
    requiresSecureOpen: false,
    assignmentMatch: null,
  };
}

export function normalizeOfficialRefereeAssignmentListResult(payload = {}) {
  if (!payload || payload.ok === false) {
    const code = payload?.code || "OFFICIAL_DISCOVERY_UNAVAILABLE";
    return {
      ok: false,
      code,
      error:
        payload?.error ||
        (code === "NOT_AUTHENTICATED"
          ? "Phiên đăng nhập hết hạn — đăng nhập lại."
          : code === "SQL_NOT_APPLIED" || code === "RPC_MISSING"
            ? "Danh sách phân công Official/Open chưa sẵn sàng trên máy chủ."
            : "Không tải được phân công Official/Open."),
      tournaments: [],
    };
  }

  const assignments = Array.isArray(payload.assignments) ? payload.assignments : [];
  return {
    ok: true,
    tournaments: assignments.map(projectOfficialRefereeDashboardCard).filter(Boolean),
  };
}

export function projectOfficialRefereeDashboardCard(raw = {}) {
  const tournamentId = String(raw.tournamentId || "").trim();
  const matchId = String(raw.matchId || "").trim();
  if (!tournamentId || !matchId) return null;

  return {
    id: `official:${tournamentId}:${matchId}`,
    tournamentId,
    matchId,
    name: raw.tournamentName || "Giải Official/Open",
    status: String(raw.status || "ready").toLowerCase(),
    clubId: null,
    tenantId: null,
    roles: ["referee"],
    competitionType: "official_open",
    competitionTypeLabel: "Official/Open",
    myTeam: null,
    openTaskCount: 0,
    nextMatchup: null,
    href: null,
    captainPortalHref: null,
    refereeHref: null,
    requiresSecureOpen: raw.canOpen !== false,
    assignmentMatch: {
      matchId,
      stage: raw.stage || "",
      round: raw.round || "",
      groupLabel: raw.groupLabel || "",
      teamAName: raw.teamAName || "Cặp A",
      teamBName: raw.teamBName || "Cặp B",
      scheduledStart: raw.scheduledStart || "",
      scheduledEnd: raw.scheduledEnd || "",
      courtId: raw.courtId || "",
      courtLabel: raw.courtLabel || "",
    },
  };
}

export function roleLabelsVi(roles = []) {
  const map = {
    organizer: "Ban tổ chức",
    captain: "Đội trưởng",
    referee: "Trọng tài",
    participant: "Thành viên",
    viewer: "Người xem",
  };
  return roles.map((role) => map[role] || role);
}
