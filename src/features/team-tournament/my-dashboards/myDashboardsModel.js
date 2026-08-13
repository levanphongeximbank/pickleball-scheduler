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
