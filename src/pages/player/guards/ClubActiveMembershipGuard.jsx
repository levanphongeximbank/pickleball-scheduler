import { Alert, Box, Button, CircularProgress, Skeleton, Stack } from "@mui/material";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";

import { useRequiredMyClubMembership } from "../../../features/club/hooks/MyClubMembershipContext.jsx";
import {
  CLUB_LANDING_STATE,
  CLUB_ROUTE_PATHS,
  clearClubRouteRedirectLoop,
  isClubRouteRedirectLoop,
  markClubRouteRedirect,
  resolveClubLandingState,
  resolveLegacyMyClubQueryRedirect,
  shouldRedirectMyClubToDiscover,
} from "../../../features/club/routing/clubMembershipRouteLogic.js";

function ClubRouteLoadingShell({ label = "Đang tải thông tin CLB" }) {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }} aria-busy="true">
      <Stack spacing={2}>
        <Skeleton variant="text" width="40%" height={36} />
        <Skeleton variant="rounded" height={48} />
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress aria-label={label} />
        </Box>
      </Stack>
    </Box>
  );
}

export default function ClubActiveMembershipGuard({ children }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const membership = useRequiredMyClubMembership();
  const landingState = resolveClubLandingState(membership);

  const legacyDiscover = resolveLegacyMyClubQueryRedirect(searchParams);
  if (legacyDiscover) {
    markClubRouteRedirect(location.pathname, legacyDiscover);
    return <Navigate to={legacyDiscover} replace />;
  }

  if (landingState === CLUB_LANDING_STATE.LOADING) {
    return <ClubRouteLoadingShell />;
  }

  if (landingState === CLUB_LANDING_STATE.ERROR) {
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

  if (shouldRedirectMyClubToDiscover(membership)) {
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
