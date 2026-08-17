import { Alert, Box } from "@mui/material";

import ClubSwitcher from "../ClubSwitcher.jsx";
import TenantSwitcher from "../TenantSwitcher.jsx";
import {
  PLATFORM_CONTEXT_STATE,
  isPlatformContextLoading,
  isPlatformContextReady,
  isPlatformContextRequired,
} from "../../core/platform/app/platformContextReadiness.js";
import { usePlatformContextReadiness } from "./usePlatformContextReadiness.js";
import { useTenant } from "../../context/TenantContext.jsx";

/**
 * Reusable shared context-readiness surface (not Tournament-specific).
 * Distinguishes CONTEXT_READY vs CONTEXT_REQUIRED vs FORBIDDEN vs ERROR.
 */
export default function PlatformContextReadinessGate({
  requireClub = true,
  children,
  showClubSwitcher = true,
  sx = {},
}) {
  const readiness = usePlatformContextReadiness({ requireClub });
  const { canSwitchTenant, isSuperAdmin } = useTenant();

  if (isPlatformContextReady(readiness.state)) {
    return children;
  }

  if (isPlatformContextLoading(readiness.state)) {
    return (
      <Alert severity="info" sx={{ mb: 2, ...sx }} data-testid="platform-context-loading">
        {readiness.message || "Đang tải ngữ cảnh nền tảng…"}
      </Alert>
    );
  }

  if (readiness.state === PLATFORM_CONTEXT_STATE.FORBIDDEN) {
    return (
      <Alert severity="error" sx={{ mb: 2, ...sx }} data-testid="platform-context-forbidden">
        {readiness.message || "Không có quyền truy cập."}
      </Alert>
    );
  }

  if (readiness.state === PLATFORM_CONTEXT_STATE.ERROR) {
    return (
      <Alert severity="error" sx={{ mb: 2, ...sx }} data-testid="platform-context-error">
        {readiness.message || "Lỗi ngữ cảnh nền tảng."}
      </Alert>
    );
  }

  if (isPlatformContextRequired(readiness.state)) {
    const showTenantPicker =
      (isSuperAdmin || canSwitchTenant) &&
      readiness.state === PLATFORM_CONTEXT_STATE.TENANT_REQUIRED;
    const showClubPicker =
      showClubSwitcher &&
      (readiness.state === PLATFORM_CONTEXT_STATE.CLUB_REQUIRED ||
        readiness.state === PLATFORM_CONTEXT_STATE.CLUB_EMPTY);

    return (
      <Box sx={{ mb: 2, ...sx }} data-testid="platform-context-required" data-state={readiness.state}>
        <Alert
          severity={readiness.state === PLATFORM_CONTEXT_STATE.CLUB_EMPTY ? "info" : "warning"}
          sx={{ mb: showTenantPicker || showClubPicker ? 1.5 : 0 }}
        >
          {readiness.message || "Cần hoàn thiện ngữ cảnh trước khi xem dữ liệu."}
        </Alert>
        {showTenantPicker ? (
          <Box sx={{ maxWidth: 320 }}>
            <TenantSwitcher variant="context" minWidth={240} />
          </Box>
        ) : null}
        {showClubPicker ? (
          <Box sx={{ maxWidth: 320, mt: showTenantPicker ? 1 : 0 }}>
            <ClubSwitcher variant="context" minWidth={240} />
          </Box>
        ) : null}
      </Box>
    );
  }

  return children;
}
