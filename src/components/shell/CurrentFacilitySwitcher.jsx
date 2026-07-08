import { useEffect, useState } from "react";
import { Button, Chip, FormControl, MenuItem, Select, Stack, Typography } from "@mui/material";

import { useCluster } from "../../context/ClusterContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { canAccessCluster } from "../../auth/rbac.js";
import { refreshAuthProfileFromSupabase } from "../../auth/authService.js";
import {
  COURT_CLAIM_REQUEST_STATUS_LABELS,
} from "../../features/court-cluster/constants/courtClaimRequestStatuses.js";
import {
  getPendingCourtClaimRequestForUser,
  listMyCourtClaimRequests,
  userHasApprovedClusterAssignments,
} from "../../features/court-cluster/services/courtClaimRequestService.js";
import { isCourtOwnerCandidate } from "../../features/court-cluster/utils/courtOwnerUtils.js";
import FacilityClaimDialog from "./FacilityClaimDialog.jsx";
import { SHELL_COLORS } from "./shellTokens.js";

const CLAIM_POLL_MS = 20000;

export default function CurrentFacilitySwitcher({ size = "small" }) {
  const { clusters, activeClusterId, activeCluster, switchCluster, refreshClusters, syncClustersFromCloud } =
    useCluster();
  const { user, rbacEnabled, isAuthenticated, refresh } = useAuth();
  const [claimOpen, setClaimOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);

  const hasApprovedClusters = userHasApprovedClusterAssignments(user);
  const isOwnerCandidate = isAuthenticated && isCourtOwnerCandidate(user);
  const shouldPollClaims = isOwnerCandidate && (!hasApprovedClusters || pendingRequest);

  useEffect(() => {
    if (!isOwnerCandidate) {
      setPendingRequest(null);
      return undefined;
    }

    const localPending = getPendingCourtClaimRequestForUser(user);
    setPendingRequest(localPending);

    let cancelled = false;

    const syncClaimState = async () => {
      const result = await listMyCourtClaimRequests();
      if (cancelled) {
        return;
      }

      if (result.ok) {
        const pending = (result.requests || []).find((item) => item.status === "pending") || null;
        setPendingRequest(pending);

        const hasRecentApproval = (result.requests || []).some((item) => {
          if (item.status !== "approved" || !item.reviewedAt) {
            return false;
          }
          return Date.now() - new Date(item.reviewedAt).getTime() < CLAIM_POLL_MS * 2;
        });

        if (pending || hasRecentApproval || !userHasApprovedClusterAssignments(user)) {
          const sync = await syncClustersFromCloud();
          if (!cancelled && sync?.ok) {
            await refreshAuthProfileFromSupabase(user.id);
            refresh();
            refreshClusters();
          }
        }
      }
    };

    void syncClaimState();

    if (!shouldPollClaims) {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(syncClaimState, CLAIM_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    isOwnerCandidate,
    refresh,
    refreshClusters,
    shouldPollClaims,
    syncClustersFromCloud,
    user,
    claimOpen,
  ]);

  const visibleClusters =
    rbacEnabled && isAuthenticated
      ? clusters.filter((cluster) =>
          canAccessCluster(user, cluster.id, { venueId: cluster.venueId }, { rbacEnabled })
        )
      : clusters;

  const handleClaimSubmitted = async () => {
    await syncClustersFromCloud();
    await refreshAuthProfileFromSupabase(user?.id);
    refresh();
    refreshClusters();
    setClaimOpen(false);
  };

  const claimDialog = (
    <FacilityClaimDialog
      open={claimOpen}
      onClose={() => setClaimOpen(false)}
      onSubmitted={handleClaimSubmitted}
    />
  );

  const addClusterButton = isOwnerCandidate && !pendingRequest && (
    <Button
      size="small"
      variant="text"
      onClick={() => setClaimOpen(true)}
      sx={{
        color: SHELL_COLORS.sidebarAccent,
        textTransform: "none",
        fontSize: 10.5,
        px: 0,
        py: 0,
        minWidth: 0,
        alignSelf: "flex-start",
      }}
    >
      {hasApprovedClusters || visibleClusters.length > 0 ? "Gắn thêm cụm" : "Yêu cầu gắn cụm"}
    </Button>
  );

  if (isOwnerCandidate && visibleClusters.length === 0) {
    return (
      <>
        <Stack spacing={0.75}>
          {pendingRequest ? (
            <Chip
              size="small"
              label={`Đang chờ duyệt (${pendingRequest.clusterIds.length} cụm)`}
              sx={{ alignSelf: "flex-start", maxWidth: "100%" }}
            />
          ) : (
            <Button
              size="small"
              variant="outlined"
              onClick={() => setClaimOpen(true)}
              sx={{
                color: SHELL_COLORS.sidebarText,
                borderColor: "rgba(255,255,255,0.35)",
                textTransform: "none",
                fontSize: 11,
                py: 0.35,
              }}
            >
              Yêu cầu gắn cụm sân
            </Button>
          )}
          {pendingRequest && (
            <Typography variant="caption" sx={{ color: SHELL_COLORS.sidebarTextMuted, fontSize: 10.5 }}>
              {COURT_CLAIM_REQUEST_STATUS_LABELS.pending}
            </Typography>
          )}
        </Stack>
        {claimDialog}
      </>
    );
  }

  if (visibleClusters.length === 0) {
    return (
      <>
        <Typography
          variant="caption"
          sx={{ color: SHELL_COLORS.sidebarTextMuted, fontSize: 11.5, display: "block", py: 0.5 }}
        >
          Chưa có cụm sân
        </Typography>
        {addClusterButton}
        {claimDialog}
      </>
    );
  }

  const value = visibleClusters.some((cluster) => cluster.id === activeClusterId)
    ? activeClusterId
    : visibleClusters[0]?.id || "";

  const selectedCluster =
    visibleClusters.find((cluster) => cluster.id === value) || activeCluster || visibleClusters[0];

  if (visibleClusters.length === 1) {
    return (
      <>
        <Stack spacing={0.35}>
          <Typography
            variant="body2"
            sx={{
              color: SHELL_COLORS.sidebarText,
              fontWeight: 600,
              fontSize: 11.5,
              py: 0.5,
              px: 0.25,
            }}
            noWrap
            title={selectedCluster?.address || selectedCluster?.name}
          >
            {selectedCluster?.name || "Cụm sân"}
          </Typography>
          {addClusterButton}
        </Stack>
        {claimDialog}
      </>
    );
  }

  return (
    <>
      <Stack spacing={0.35}>
        <FormControl size={size} sx={{ width: "100%" }}>
          <Select
            value={value || ""}
            onChange={(event) => switchCluster(event.target.value)}
            displayEmpty
            sx={{
              bgcolor: "rgba(255,255,255,0.12)",
              color: "common.white",
              borderRadius: 1,
              fontWeight: 500,
              fontSize: 11.5,
              height: 30,
              "& .MuiSelect-select": { py: 0.5 },
              ".MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
              ".MuiSvgIcon-root": { color: "common.white" },
            }}
          >
            {visibleClusters.map((cluster) => (
              <MenuItem key={cluster.id} value={cluster.id}>
                {cluster.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {addClusterButton}
      </Stack>
      {claimDialog}
    </>
  );
}
