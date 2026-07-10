import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useTenant } from "../../../context/TenantContext.jsx";
import { canApproveClubMembershipRequests } from "../../../features/club/index.js";
import { MyClubMembershipProvider } from "../../../features/club/hooks/MyClubMembershipContext.jsx";
import { useMyClubMembership } from "../../../features/club/hooks/useMyClubMembership.js";
import { useResolvedClubRecord } from "../../../features/club/hooks/useResolvedClubRecord.js";
import { rpcV2ClubListPendingRequests } from "../../../features/club/services/clubStorageV2RpcService.js";
import {
  CLUB_LANDING_STATE,
  CLUB_ROUTE_PATHS,
  resolveClubLandingState,
} from "../../../features/club/routing/clubMembershipRouteLogic.js";

/**
 * Phase 42J.1 — /my-club/requests guard.
 * Waits for membership + club hydrate; 403 only when permission denied.
 */
export default function ClubMembershipRequestsGuard({ children, revision = 0 }) {
  const { user } = useAuth();
  const { currentTenantId } = useTenant();
  const tenantId = currentTenantId || user?.tenantId || user?.venueId || "";
  const membership = useMyClubMembership(revision);
  const clubId = membership.clubId;
  const landingState = resolveClubLandingState(membership);
  const { clubRecord, clubLoading, clubError, reload } = useResolvedClubRecord(membership, tenantId);
  const [reviewRpcOk, setReviewRpcOk] = useState(null);

  useEffect(() => {
    if (!clubId || landingState !== CLUB_LANDING_STATE.ACTIVE_MEMBERSHIP) {
      setReviewRpcOk(null);
      return undefined;
    }

    let cancelled = false;
    void rpcV2ClubListPendingRequests(clubId).then((result) => {
      if (!cancelled) {
        setReviewRpcOk(Boolean(result.ok));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [clubId, landingState, revision]);

  if (landingState === CLUB_LANDING_STATE.LOADING) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress aria-label="Đang tải membership" />
      </Box>
    );
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
          {membership.error || "Không tải được thông tin CLB."}
        </Alert>
      </Box>
    );
  }

  if (landingState === CLUB_LANDING_STATE.NO_MEMBERSHIP) {
    return <Navigate to={CLUB_ROUTE_PATHS.DISCOVER} replace />;
  }

  if (clubLoading || reviewRpcOk === null) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress aria-label="Đang tải quyền duyệt" />
      </Box>
    );
  }

  if (clubError) {
    return (
      <Box sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={reload}>
              Thử lại
            </Button>
          }
        >
          {clubError}
        </Alert>
      </Box>
    );
  }

  const canReview =
    (clubRecord && user && canApproveClubMembershipRequests(user, clubRecord)) || reviewRpcOk === true;

  if (!canReview) {
    return <Navigate to="/403" replace state={{ from: "/my-club/requests" }} />;
  }

  return <MyClubMembershipProvider value={membership}>{children}</MyClubMembershipProvider>;
}
