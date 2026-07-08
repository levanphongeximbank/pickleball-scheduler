import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import DirectionsIcon from "@mui/icons-material/Directions";

import { useAuth } from "../../../context/AuthContext.jsx";
import { useCluster } from "../../../context/ClusterContext.jsx";
import { fetchProfileByUserId } from "../../../auth/profileService.js";
import { refreshAuthProfileFromSupabase } from "../../../auth/authService.js";
import {
  COURT_CLAIM_REQUEST_STATUS_LABELS,
} from "../constants/courtClaimRequestStatuses.js";
import {
  listAssignmentsForCluster,
} from "../services/courtClusterService.js";
import {
  listMyCourtClaimRequests,
  userHasApprovedClusterAssignments,
} from "../services/courtClaimRequestService.js";
import { openClusterInGoogleMaps } from "../utils/clusterMapsUtils.js";
import { isCourtOwnerCandidate } from "../utils/courtOwnerUtils.js";
import FacilityClaimDialog from "../../../components/shell/FacilityClaimDialog.jsx";

function resolveOwnerUserId(cluster) {
  if (cluster?.ownerUserId) {
    return cluster.ownerUserId;
  }
  const assignment = listAssignmentsForCluster(cluster.id).find(
    (item) => item.role === "CLUSTER_OWNER"
  );
  return assignment?.userId || null;
}

function ClusterInfoCard({ cluster, ownerPhone }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            {cluster.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Địa chỉ:</strong> {cluster.address || "—"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Số điện thoại:</strong> {ownerPhone || "—"}
          </Typography>
          {typeof cluster.courtCount === "number" && (
            <Typography variant="body2" color="text.secondary">
              <strong>Số sân:</strong> {cluster.courtCount}
            </Typography>
          )}
          {cluster.googleMapsUrl && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<DirectionsIcon />}
              onClick={() => openClusterInGoogleMaps(cluster)}
              sx={{ alignSelf: "flex-start", mt: 0.5 }}
            >
              Chỉ đường
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function MyFacilityPanel() {
  const { user, isAuthenticated, refresh } = useAuth();
  const { clusters, refreshClusters, syncClustersFromCloud } = useCluster();
  const [claimOpen, setClaimOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [ownerPhones, setOwnerPhones] = useState({});
  const [loading, setLoading] = useState(false);

  const showPanel = isAuthenticated && isCourtOwnerCandidate(user);
  const hasApprovedClusters = userHasApprovedClusterAssignments(user);
  const assignedClusters = useMemo(() => {
    if (!showPanel) {
      return [];
    }
    if (hasApprovedClusters) {
      return clusters;
    }
    return clusters.filter((cluster) =>
      listAssignmentsForCluster(cluster.id).some(
        (item) => item.userId === user?.id && item.role === "CLUSTER_OWNER"
      )
    );
  }, [showPanel, hasApprovedClusters, clusters, user?.id]);

  const loadClaimState = useCallback(async () => {
    if (!showPanel) {
      return;
    }

    setLoading(true);
    const result = await listMyCourtClaimRequests();
    setLoading(false);

    if (result.ok) {
      const pending = (result.requests || []).find((item) => item.status === "pending") || null;
      setPendingRequest(pending);
    }
  }, [showPanel]);

  useEffect(() => {
    void loadClaimState();
  }, [loadClaimState, claimOpen]);

  useEffect(() => {
    if (!showPanel || assignedClusters.length === 0) {
      setOwnerPhones({});
      return;
    }

    let cancelled = false;

    const loadPhones = async () => {
      const next = {};
      await Promise.all(
        assignedClusters.map(async (cluster) => {
          const ownerUserId = resolveOwnerUserId(cluster);
          if (!ownerUserId) {
            next[cluster.id] = "";
            return;
          }
          const profile = await fetchProfileByUserId(ownerUserId);
          next[cluster.id] = profile.ok ? profile.user.phone || "" : "";
        })
      );
      if (!cancelled) {
        setOwnerPhones(next);
      }
    };

    void loadPhones();
    return () => {
      cancelled = true;
    };
  }, [assignedClusters, showPanel]);

  const handleClaimSubmitted = async () => {
    setClaimOpen(false);
    await syncClustersFromCloud();
    await refreshAuthProfileFromSupabase(user?.id);
    refresh();
    refreshClusters();
    await loadClaimState();
  };

  if (!showPanel) {
    return null;
  }

  return (
    <Box sx={{ mb: 2.5 }}>
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
            >
              <Typography variant="h6" fontWeight={700}>
                Cơ sở của tôi
              </Typography>
              {!pendingRequest && (
                <Button
                  size="small"
                  variant={hasApprovedClusters ? "outlined" : "contained"}
                  onClick={() => setClaimOpen(true)}
                >
                  {hasApprovedClusters ? "Gắn thêm cụm sân" : "Yêu cầu gắn cụm sân"}
                </Button>
              )}
            </Stack>

            {loading && (
              <Typography variant="body2" color="text.secondary">
                Đang tải…
              </Typography>
            )}

            {pendingRequest && (
              <Stack spacing={1}>
                <Chip
                  size="small"
                  color="warning"
                  label={`Đang chờ duyệt (${pendingRequest.clusterIds.length} cụm)`}
                  sx={{ alignSelf: "flex-start" }}
                />
                <Typography variant="body2" color="text.secondary">
                  {COURT_CLAIM_REQUEST_STATUS_LABELS.pending}
                </Typography>
              </Stack>
            )}

            {!pendingRequest && !hasApprovedClusters && assignedClusters.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Bạn chưa được gắn cụm sân. Gửi yêu cầu để admin duyệt trước khi vận hành.
              </Typography>
            )}

            {assignedClusters.length > 0 && (
              <>
                <Divider />
                <Stack spacing={1.5}>
                  {assignedClusters.map((cluster) => (
                    <ClusterInfoCard
                      key={cluster.id}
                      cluster={cluster}
                      ownerPhone={ownerPhones[cluster.id]}
                    />
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <FacilityClaimDialog
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        onSubmitted={handleClaimSubmitted}
      />
    </Box>
  );
}
