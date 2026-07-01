export function resolveCourtEngineContextState({
  activeClubId = null,
  seasons = [],
  activeSeason = null,
  leaguesForActiveSeason = [],
  activeLeague = null,
  tenantCheck = { ok: true },
  rbacEnabled = false,
  isAuthenticated = false,
} = {}) {
  if (rbacEnabled && isAuthenticated && tenantCheck && !tenantCheck.ok) {
    return {
      ready: false,
      code: "TENANT_ERROR",
      message: tenantCheck.error || "Không thể tải tenant. Vui lòng liên hệ quản trị viên.",
    };
  }

  if (!activeClubId) {
    return {
      ready: false,
      code: "NO_CLUB",
      message: "Chưa chọn CLB. Vui lòng chọn hoặc tạo CLB trước khi điều phối sân.",
    };
  }

  if (seasons.length === 0 || !activeSeason) {
    return {
      ready: false,
      code: "NO_SEASON",
      message: "Chưa có mùa giải hoặc league để điều phối sân.",
    };
  }

  if (leaguesForActiveSeason.length === 0 || !activeLeague) {
    return {
      ready: false,
      code: "NO_LEAGUE",
      message: "Chưa có giải/league trong mùa giải hiện tại. Hãy tạo hoặc chọn league trước.",
    };
  }

  return {
    ready: true,
    code: "READY",
    message: null,
  };
}
