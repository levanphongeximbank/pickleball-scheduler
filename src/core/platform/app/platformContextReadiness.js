/**
 * Wave 1 — Canonical Platform Context readiness projection (pure).
 *
 * MISSING REQUIRED CONTEXT ≠ VALID EMPTY BUSINESS DATA.
 * Platform Core projects readiness only; it does not own Club/Venue/Cluster entities
 * and does not absorb Business Domain truth.
 */

export const PLATFORM_CONTEXT_STATE = Object.freeze({
  AUTH_LOADING: "AUTH_LOADING",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  TENANT_LOADING: "TENANT_LOADING",
  TENANT_REQUIRED: "TENANT_REQUIRED",
  CLUB_LOADING: "CLUB_LOADING",
  CLUB_REQUIRED: "CLUB_REQUIRED",
  CLUB_EMPTY: "CLUB_EMPTY",
  CONTEXT_READY: "CONTEXT_READY",
  FORBIDDEN: "FORBIDDEN",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  ERROR: "ERROR",
});

/**
 * Explicit compatibility mapping for Wave 1 PC-TENANT-01 minimum portion.
 * tenantId and venueId are NOT universally identical; when a club projection
 * carries either field, operational scope matching may treat them as the
 * compatibility alias used by the current venue≡tenant runtime. Callers must
 * pass selectedTenantId explicitly — never invent Organization.
 *
 * @param {object|null|undefined} club
 * @returns {string|null}
 */
export function resolveClubOperationalTenantId(club) {
  if (!club || typeof club !== "object") {
    return null;
  }
  const raw =
    club.tenantId ?? club.venueId ?? club.tenant_id ?? club.venue_id ?? null;
  const id = String(raw || "").trim();
  return id || null;
}

/**
 * True when club belongs to the selected operational tenant under the explicit
 * Wave 1 compatibility mapping (tenantId ↔ venueId on the club projection).
 *
 * @param {object|null|undefined} club
 * @param {string|null|undefined} selectedTenantId
 * @returns {boolean}
 */
export function clubBelongsToSelectedTenant(club, selectedTenantId) {
  const selected = String(selectedTenantId || "").trim();
  if (!selected) {
    return false;
  }
  return resolveClubOperationalTenantId(club) === selected;
}

/**
 * Filter club options to the selected operational tenant.
 * Platform-wide AUTHORIZED_SCOPE must not leak foreign clubs into SELECTED_OPERATIONAL_CONTEXT.
 *
 * @param {Array} clubs
 * @param {string|null|undefined} selectedTenantId
 * @returns {Array}
 */
export function filterClubsForSelectedOperationalTenant(clubs, selectedTenantId) {
  const list = Array.isArray(clubs) ? clubs : [];
  const selected = String(selectedTenantId || "").trim();
  if (!selected) {
    return [];
  }
  return list.filter((club) => clubBelongsToSelectedTenant(club, selected));
}

/**
 * Compose canonical platform context readiness from auth/tenant/club signals.
 *
 * @param {object} input
 * @returns {{
 *   state: string,
 *   ready: boolean,
 *   requireClub: boolean,
 *   selectedTenantId: string|null,
 *   activeClubId: string|null,
 *   eligibleClubCount: number,
 *   code: string|null,
 *   message: string|null,
 * }}
 */
export function resolvePlatformContextReadiness({
  authLoading = false,
  isAuthenticated = false,
  rbacEnabled = false,
  tenantCheck = null,
  selectedTenantId = null,
  canOperateWithoutTenant = false,
  clubReadLoading = false,
  clubReadError = false,
  clubReadErrorCode = null,
  eligibleClubs = null,
  activeClub = null,
  activeClubReady = false,
  requireClub = true,
  organizationConfigured = false,
} = {}) {
  const tenantId = String(selectedTenantId || "").trim() || null;
  const clubs = Array.isArray(eligibleClubs) ? eligibleClubs : [];
  const eligibleClubCount = clubs.length;

  if (authLoading) {
    return base(PLATFORM_CONTEXT_STATE.AUTH_LOADING, {
      requireClub,
      selectedTenantId: tenantId,
      eligibleClubCount,
      message: "Đang xác thực…",
    });
  }

  if (!isAuthenticated) {
    return base(PLATFORM_CONTEXT_STATE.AUTH_REQUIRED, {
      requireClub,
      selectedTenantId: tenantId,
      eligibleClubCount,
      message: "Cần đăng nhập để tiếp tục.",
    });
  }

  if (tenantCheck && tenantCheck.ok === false) {
    const code = String(tenantCheck.code || "");
    if (code === "TENANT_FORBIDDEN" || code === "FORBIDDEN") {
      return base(PLATFORM_CONTEXT_STATE.FORBIDDEN, {
        requireClub,
        selectedTenantId: tenantId,
        eligibleClubCount,
        code,
        message: tenantCheck.error || "Không có quyền truy cập tenant này.",
      });
    }
    if (code === "TENANT_MISSING") {
      return base(PLATFORM_CONTEXT_STATE.TENANT_REQUIRED, {
        requireClub,
        selectedTenantId: tenantId,
        eligibleClubCount,
        code,
        message: tenantCheck.error || "Cần chọn hoặc gán tenant.",
      });
    }
    return base(PLATFORM_CONTEXT_STATE.ERROR, {
      requireClub,
      selectedTenantId: tenantId,
      eligibleClubCount,
      code: code || "TENANT_ERROR",
      message: tenantCheck.error || "Lỗi ngữ cảnh tenant.",
    });
  }

  if (rbacEnabled && !tenantId) {
    // Super Admin / platform tech may browse unassigned for some gates, but
    // club-required business modules need an explicit operational tenant.
    if (requireClub || !canOperateWithoutTenant) {
      return base(PLATFORM_CONTEXT_STATE.TENANT_REQUIRED, {
        requireClub,
        selectedTenantId: null,
        eligibleClubCount,
        code: "TENANT_REQUIRED",
        message: "Cần chọn tenant trước khi thao tác nghiệp vụ.",
      });
    }
  }

  if (!requireClub) {
    return base(PLATFORM_CONTEXT_STATE.CONTEXT_READY, {
      ready: true,
      requireClub: false,
      selectedTenantId: tenantId,
      activeClubId: activeClub?.id || null,
      eligibleClubCount,
    });
  }

  if (clubReadLoading) {
    return base(PLATFORM_CONTEXT_STATE.CLUB_LOADING, {
      requireClub: true,
      selectedTenantId: tenantId,
      eligibleClubCount,
      message: "Đang tải danh sách CLB…",
    });
  }

  if (clubReadError) {
    return base(PLATFORM_CONTEXT_STATE.ERROR, {
      requireClub: true,
      selectedTenantId: tenantId,
      eligibleClubCount,
      code: clubReadErrorCode || "CLUB_READ_ERROR",
      message: "Không tải được ngữ cảnh CLB.",
    });
  }

  if (eligibleClubCount === 0) {
    return base(PLATFORM_CONTEXT_STATE.CLUB_EMPTY, {
      requireClub: true,
      selectedTenantId: tenantId,
      eligibleClubCount: 0,
      code: "CLUB_EMPTY",
      message: "Tenant này chưa có CLB khả dụng.",
    });
  }

  if (!activeClubReady || !activeClub?.id) {
    return base(PLATFORM_CONTEXT_STATE.CLUB_REQUIRED, {
      requireClub: true,
      selectedTenantId: tenantId,
      eligibleClubCount,
      code: "CLUB_REQUIRED",
      message:
        eligibleClubCount > 1
          ? "Cần chọn CLB trước khi xem dữ liệu nghiệp vụ."
          : "Cần chọn CLB hợp lệ trong phạm vi tenant.",
    });
  }

  if (
    tenantId &&
    !clubBelongsToSelectedTenant(activeClub, tenantId)
  ) {
    return base(PLATFORM_CONTEXT_STATE.CLUB_REQUIRED, {
      requireClub: true,
      selectedTenantId: tenantId,
      eligibleClubCount,
      code: "CLUB_TENANT_MISMATCH",
      message: "CLB đang chọn không thuộc tenant đang chọn.",
    });
  }

  // Organization remains NOT_CONFIGURED in Wave 1 — surface only when asked.
  if (organizationConfigured === true) {
    // reserved — Wave 1 never enables Organization authority
  }

  return base(PLATFORM_CONTEXT_STATE.CONTEXT_READY, {
    ready: true,
    requireClub: true,
    selectedTenantId: tenantId,
    activeClubId: activeClub.id,
    eligibleClubCount,
  });
}

/**
 * Business consumers: missing club must not look like empty business data.
 * @param {string} state
 * @returns {boolean}
 */
export function isPlatformContextReady(state) {
  return state === PLATFORM_CONTEXT_STATE.CONTEXT_READY;
}

/**
 * @param {string} state
 * @returns {boolean}
 */
export function isPlatformContextRequired(state) {
  return (
    state === PLATFORM_CONTEXT_STATE.AUTH_REQUIRED ||
    state === PLATFORM_CONTEXT_STATE.TENANT_REQUIRED ||
    state === PLATFORM_CONTEXT_STATE.CLUB_REQUIRED ||
    state === PLATFORM_CONTEXT_STATE.CLUB_EMPTY ||
    state === PLATFORM_CONTEXT_STATE.NOT_CONFIGURED
  );
}

/**
 * @param {string} state
 * @returns {boolean}
 */
export function isPlatformContextLoading(state) {
  return (
    state === PLATFORM_CONTEXT_STATE.AUTH_LOADING ||
    state === PLATFORM_CONTEXT_STATE.TENANT_LOADING ||
    state === PLATFORM_CONTEXT_STATE.CLUB_LOADING
  );
}

function base(state, extra = {}) {
  return {
    state,
    ready: false,
    requireClub: true,
    selectedTenantId: null,
    activeClubId: null,
    eligibleClubCount: 0,
    code: null,
    message: null,
    ...extra,
  };
}
