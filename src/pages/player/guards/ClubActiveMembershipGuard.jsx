import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";

import { useMyClubMembership } from "../../../features/club/hooks/useMyClubMembership.js";
import {
  CLUB_ROUTE_PATHS,
  clearClubRouteRedirectLoop,
  isClubRouteRedirectLoop,
  markClubRouteRedirect,
  resolveLegacyMyClubQueryRedirect,
  shouldRedirectMyClubToDiscover,
} from "../../../features/club/routing/clubMembershipRouteLogic.js";

export default function ClubActiveMembershipGuard({ children, revision = 0 }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const membership = useMyClubMembership(revision);

  const legacyDiscover = resolveLegacyMyClubQueryRedirect(searchParams);
  if (legacyDiscover) {
    markClubRouteRedirect(location.pathname, legacyDiscover);
    return <Navigate to={legacyDiscover} replace />;
  }

  if (membership.loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress aria-label="Đang tải thông tin CLB" />
      </Box>
    );
  }

  if (!membership.ok) {
    return (
      <Box sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void membership.reload()}>
              Thử lại
            </Button>
          }
        >
          {membership.error || "Không tải được thông tin CLB. Vui lòng thử lại."}
        </Alert>
      </Box>
    );
  }

  if (
    shouldRedirectMyClubToDiscover({
      loading: false,
      ok: membership.ok,
      hasActiveMembership: membership.hasActiveMembership,
    })
  ) {
    const target = CLUB_ROUTE_PATHS.DISCOVER;
    if (isClubRouteRedirectLoop(location.pathname, target)) {
      clearClubRouteRedirectLoop();
      return (
        <Box sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
          <Alert severity="warning">
            Không thể xác định CLB của bạn. Vui lòng mở Khám phá CLB từ menu.
          </Alert>
        </Box>
      );
    }
    markClubRouteRedirect(location.pathname, target);
    return <Navigate to={target} replace state={{ from: location.pathname }} />;
  }

  clearClubRouteRedirectLoop();
  return children;
}
