import { useEffect, useMemo, useState } from "react";
import { Button, Chip, FormControl, MenuItem, Select, Stack, Typography } from "@mui/material";

import { useCluster } from "../../context/ClusterContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { canAccessCluster } from "../../auth/rbac.js";
import { ROLES, normalizeRole } from "../../auth/roles.js";
import {
  COURT_CLAIM_REQUEST_STATUS_LABELS,
} from "../../features/court-cluster/constants/courtClaimRequestStatuses.js";
import {
  getPendingCourtClaimRequestForUser,
  listMyCourtClaimRequests,
  userHasApprovedClusterAssignments,
} from "../../features/court-cluster/services/courtClaimRequestService.js";
import FacilityClaimDialog from "./FacilityClaimDialog.jsx";
import { SHELL_COLORS } from "./shellTokens.js";

function isCourtOwnerCandidate(user) {
  const role = normalizeRole(user?.role);
  return [ROLES.PLAYER, ROLES.COURT_OWNER, ROLES.TENANT_OWNER].includes(role);
}

export default function CurrentFacilitySwitcher({ size = "small" }) {
  const { clusters, activeClusterId, activeCluster, switchCluster, refreshClusters } = useCluster();
  const { user, rbacEnabled, isAuthenticated } = useAuth();
  const [claimOpen, setClaimOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);

  const hasApprovedClusters = userHasApprovedClusterAssignments(user);
  const showClaimFlow = isAuthenticated && isCourtOwnerCandidate(user) && !hasApprovedClusters;

  useEffect(() => {
    if (!showClaimFlow) {
      setPendingRequest(null);
      return;
    }

    const localPending = getPendingCourtClaimRequestForUser(user);
    setPendingRequest(localPending);

    void listMyCourtClaimRequests().then((result) => {
      if (result.ok) {
        const pending = (result.requests || []).find((item) => item.status === "pending") || null;
        setPendingRequest(pending);
      }
    });
  }, [showClaimFlow, user, claimOpen]);

  const visibleClusters =
    rbacEnabled && isAuthenticated
      ? clusters.filter((cluster) =>
          canAccessCluster(user, cluster.id, { venueId: cluster.venueId }, { rbacEnabled })
        )
      : clusters;

  const handleClaimSubmitted = () => {
    refreshClusters();
    setClaimOpen(false);
  };

  if (showClaimFlow && visibleClusters.length === 0) {
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
        <FacilityClaimDialog
          open={claimOpen}
          onClose={() => setClaimOpen(false)}
          onSubmitted={handleClaimSubmitted}
        />
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
        {showClaimFlow && (
          <Button
            size="small"
            variant="text"
            onClick={() => setClaimOpen(true)}
            sx={{ color: SHELL_COLORS.sidebarAccent, textTransform: "none", fontSize: 11, px: 0 }}
          >
            Yêu cầu gắn cụm
          </Button>
        )}
        <FacilityClaimDialog
          open={claimOpen}
          onClose={() => setClaimOpen(false)}
          onSubmitted={handleClaimSubmitted}
        />
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
    );
  }

  return (
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
  );
}
