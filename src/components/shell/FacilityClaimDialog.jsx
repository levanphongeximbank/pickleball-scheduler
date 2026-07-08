import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  COURT_CLAIM_REQUEST_STATUS_LABELS,
} from "../../features/court-cluster/constants/courtClaimRequestStatuses.js";
import {
  cancelCourtClaimRequest,
  listMyCourtClaimRequests,
  listUnassignedClusters,
  submitCourtClaimRequest,
} from "../../features/court-cluster/services/courtClaimRequestService.js";

export default function FacilityClaimDialog({ open, onClose, onSubmitted }) {
  const [clusters, setClusters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [myRequests, setMyRequests] = useState([]);

  const pendingRequest = useMemo(
    () => myRequests.find((item) => item.status === "pending") || null,
    [myRequests]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [clusterResult, requestResult] = await Promise.all([
      listUnassignedClusters({ search }),
      listMyCourtClaimRequests(),
    ]);

    setLoading(false);

    if (!clusterResult.ok) {
      setError(clusterResult.error);
      setClusters([]);
    } else {
      setClusters(clusterResult.clusters || []);
    }

    if (requestResult.ok) {
      setMyRequests(requestResult.requests || []);
    }
  }, [search]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [loadData, open]);

  const selectedVenues = useMemo(() => {
    const venues = new Set(
      clusters
        .filter((cluster) => selectedIds.includes(cluster.id))
        .map((cluster) => cluster.venueId)
    );
    return venues;
  }, [clusters, selectedIds]);

  const mixedVenueWarning = selectedVenues.size > 1;

  const toggleCluster = (clusterId) => {
    setSelectedIds((prev) =>
      prev.includes(clusterId) ? prev.filter((id) => id !== clusterId) : [...prev, clusterId]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await submitCourtClaimRequest({
      clusterIds: selectedIds,
      message,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSelectedIds([]);
    setMessage("");
    onSubmitted?.(result.request);
    await loadData();
  };

  const handleCancelPending = async () => {
    if (!pendingRequest?.id) {
      return;
    }
    setSubmitting(true);
    const result = await cancelCourtClaimRequest(pendingRequest.id);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await loadData();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Yêu cầu gắn cụm sân</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Chọn cụm sân chưa có chủ trên hệ thống. Admin hoặc người được phân quyền sẽ duyệt
            trước khi bạn vận hành.
          </Typography>

          {pendingRequest && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={handleCancelPending} disabled={submitting}>
                  Hủy yêu cầu
                </Button>
              }
            >
              Đang chờ duyệt {pendingRequest.clusterIds.length} cụm —{" "}
              {COURT_CLAIM_REQUEST_STATUS_LABELS.pending}
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!pendingRequest && (
            <>
              <TextField
                size="small"
                label="Tìm cụm sân"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={loadData}
                fullWidth
              />

              {mixedVenueWarning && (
                <Alert severity="warning">
                  Chỉ chọn cụm sân cùng một tổ chức trong một yêu cầu.
                </Alert>
              )}

              <Box sx={{ maxHeight: 280, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>Cụm sân</TableCell>
                      <TableCell>Tổ chức</TableCell>
                      <TableCell>Địa chỉ</TableCell>
                      <TableCell align="right">Số sân</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clusters.map((cluster) => (
                      <TableRow key={cluster.id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.includes(cluster.id)}
                            onChange={() => toggleCluster(cluster.id)}
                          />
                        </TableCell>
                        <TableCell>{cluster.name}</TableCell>
                        <TableCell>{cluster.venueName || cluster.venueId}</TableCell>
                        <TableCell>{cluster.address || "—"}</TableCell>
                        <TableCell align="right">{cluster.courtCount ?? 0}</TableCell>
                      </TableRow>
                    ))}
                    {clusters.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          {loading ? "Đang tải…" : "Không có cụm sân trống."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>

              <TextField
                label="Ghi chú cho admin"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </>
          )}

          {myRequests.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Lịch sử yêu cầu
              </Typography>
              <Stack spacing={0.5}>
                {myRequests.slice(0, 5).map((request) => (
                  <Typography key={request.id} variant="caption" color="text.secondary">
                    {new Date(request.requestedAt).toLocaleString("vi-VN")} —{" "}
                    {COURT_CLAIM_REQUEST_STATUS_LABELS[request.status] || request.status} —{" "}
                    {request.clusterIds.length} cụm
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
        {!pendingRequest && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || selectedIds.length === 0 || mixedVenueWarning}
          >
            Gửi yêu cầu xác nhận
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
