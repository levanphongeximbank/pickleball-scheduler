import { useRef } from "react";
import { Alert, Box, Button, CircularProgress, Skeleton, Stack } from "@mui/material";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";

import { useRequiredMyClubMembership } from "../../../features/club/hooks/MyClubMembershipContext.jsx";
import {
  isMembershipPhasePending,
  MEMBERSHIP_PHASE,
  resolveMembershipPhase,
} from "../../../features/club/membership/membershipState.js";
import {
  clearClubRouteRedirectLoop,
  isClubRouteRedirectLoop,
  markClubRouteRedirect,
  resolveLegacyMyClubQueryRedirect,
} from "../../../features/club/routing/clubMembershipRouteLogic.js";
import { resolveDirectMyClubPath } from "../../../features/club/routing/clubLandingResolver.js";

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

/**
 * Phase 42J.2.1 — direct protected /my-club routes only (not post-login landing).
 */
export default function ClubActiveMembershipGuard({ children }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const membership = useRequiredMyClubMembership();
  const phase = resolveMembershipPhase(membership);
  const redirectIssuedRef = useRef(false);

  const legacyDiscover = resolveLegacyMyClubQueryRedirect(searchParams);
  if (legacyDiscover) {
    markClubRouteRedirect(location.pathname, legacyDiscover);
    return <Navigate to={legacyDiscover} replace />;
  }

  if (isMembershipPhasePending(phase)) {
    redirectIssuedRef.current = false;
    return <ClubRouteLoadingShell />;
  }

  if (phase === MEMBERSHIP_PHASE.ERROR) {
    redirectIssuedRef.current = false;
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

  const directTarget = resolveDirectMyClubPath(membership);
  if (directTarget) {
    if (redirectIssuedRef.current) {
      return <ClubRouteLoadingShell label="Đang chuyển hướng" />;
    }
    if (isClubRouteRedirectLoop(location.pathname, directTarget)) {
      clearClubRouteRedirectLoop();
      return (
        <Box sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
          <Alert severity="warning">
            Không thể xác định CLB của bạn. Vui lòng mở Khám phá CLB từ menu.
          </Alert>
        </Box>
      );
    }
    redirectIssuedRef.current = true;
    markClubRouteRedirect(location.pathname, directTarget);
    return <Navigate to={directTarget} replace />;
  }

  redirectIssuedRef.current = false;
  clearClubRouteRedirectLoop();
  return children;
}
