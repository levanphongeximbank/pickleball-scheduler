import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
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
  userHasApprovedClusterAssignments,
} from "../../features/court-cluster/services/courtClaimRequestService.js";
import { listAssignmentsForUser } from "../../features/court-cluster/services/courtClusterService.js";
import { getCurrentUser } from "../../auth/authService.js";

const SEARCH_DEBOUNCE_MS = 300;

function clusterSearchLabel(cluster) {
  return cluster?.name || cluster?.id || "";
}

function clusterSearchSubtitle(cluster) {
  const venue = cluster?.venueName || cluster?.venueId || "";
  const address = cluster?.address || "";
  return [venue, address].filter(Boolean).join(" · ");
}

export default function FacilityClaimDialog({ open, onClose, onSubmitted }) {
  const [clusters, setClusters] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [myRequests, setMyRequests] = useState([]);

  const pendingRequest = useMemo(
    () => myRequests.find((item) => item.status === "pending") || null,
    [myRequests]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
      const user = getCurrentUser();
      const ownedIds = new Set(
        listAssignmentsForUser(user?.id)
          .filter((item) => item.role === "CLUSTER_OWNER")
          .map((item) => item.clusterId)
      );
      const available = (clusterResult.clusters || []).filter((cluster) => !ownedIds.has(cluster.id));
      setClusters(available);
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
            {userHasApprovedClusterAssignments()
              ? "Chọn cụm sân chưa có chủ để gửi yêu cầu gắn thêm. Admin hoặc người được phân quyền sẽ duyệt."
              : "Chọn cụm sân chưa có chủ trên hệ thống. Admin hoặc người được phân quyền sẽ duyệt trước khi bạn vận hành."}
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
              <Autocomplete
                freeSolo
                options={clusters}
                loading={loading}
                inputValue={searchInput}
                onInputChange={(_event, value) => setSearchInput(value)}
                getOptionLabel={clusterSearchLabel}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                filterOptions={(options) => options}
                onChange={(_event, cluster) => {
                  if (cluster?.id) {
                    toggleCluster(cluster.id);
                  }
                }}
                renderOption={(props, cluster) => (
                  <Box component="li" {...props} key={cluster.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {clusterSearchLabel(cluster)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {clusterSearchSubtitle(cluster)}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tìm cụm sân"
                    placeholder="Tìm theo tên cụm sân..."
                    helperText="Gõ tên cụm sân để lọc danh sách bên dưới"
                    fullWidth
                  />
                )}
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
                      <TableRow
                        key={cluster.id}
                        hover
                        selected={selectedIds.includes(cluster.id)}
                        sx={{ cursor: "pointer" }}
                        onClick={() => toggleCluster(cluster.id)}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.includes(cluster.id)}
                            onChange={() => toggleCluster(cluster.id)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {cluster.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{cluster.venueName || cluster.venueId}</TableCell>
                        <TableCell>{cluster.address || "—"}</TableCell>
                        <TableCell align="right">{cluster.courtCount ?? 0}</TableCell>
                      </TableRow>
                    ))}
                    {clusters.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Alert severity="info" sx={{ my: 1 }}>
                            {userHasApprovedClusterAssignments()
                              ? "Tất cả cụm trên hệ thống đã có chủ. Liên hệ admin để tạo cụm sân mới trước khi gửi yêu cầu gắn thêm."
                              : "Hiện không có cụm sân trống để xin gắn. Liên hệ admin để tạo cụm sân hoặc gán trực tiếp cho bạn."}
                          </Alert>
                        </TableCell>
                      </TableRow>
                    )}
                    {clusters.length === 0 && loading && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          Đang tải…
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
