import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import {
  approveClubMembershipRequest,
  canApproveClubMembershipRequests,
  isClubStorageV2Enabled,
  listPendingMembershipRequests,
  rejectClubMembershipRequest,
} from "../../../features/club/index.js";
import { formatPickVnRating } from "../../../features/pick-vn-rating/constants/pickVnRatingScale.js";

export default function MyClubMembershipRequestsPanel({
  clubId,
  clubRecord,
  tenantId,
  user,
  revision = 0,
  onRefresh,
  onMessage,
}) {
  const [reviewNotes, setReviewNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const canApprove =
    (clubRecord && user && canApproveClubMembershipRequests(user, clubRecord)) ||
    (isClubStorageV2Enabled() && Boolean(clubId && user?.id));

  useEffect(() => {
    let cancelled = false;

    async function loadPending() {
      if (!clubId || !user?.id) {
        setPendingRequests([]);
        return;
      }

      if (!isClubStorageV2Enabled() && !canApproveClubMembershipRequests(user, clubRecord)) {
        setPendingRequests([]);
        return;
      }

      setLoadingPending(true);
      try {
        const rows = await listPendingMembershipRequests(clubId, tenantId, user);
        if (!cancelled) {
          setPendingRequests(rows);
        }
      } finally {
        if (!cancelled) {
          setLoadingPending(false);
        }
      }
    }

    void revision;
    loadPending();
    return () => {
      cancelled = true;
    };
  }, [clubId, tenantId, user, clubRecord, revision]);

  if (!isClubStorageV2Enabled() && !canApprove) {
    return null;
  }

  const handleApprove = async (request) => {
    setBusyId(request.id);
    try {
      const result = await approveClubMembershipRequest(clubId, request.id, tenantId, {
        user,
        reviewNote: reviewNotes[request.id] || "",
      });
      if (!result.ok) {
        onMessage?.({ type: "error", text: result.error });
        return;
      }
      onMessage?.({
        type: "success",
        text: `Đã duyệt ${request.displayName || "VĐV"} vào CLB.`,
      });
      onRefresh?.();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (request) => {
    setBusyId(request.id);
    try {
      const result = await rejectClubMembershipRequest(clubId, request.id, tenantId, {
        user,
        reviewNote: reviewNotes[request.id] || "",
      });
      if (!result.ok) {
        onMessage?.({ type: "error", text: result.error });
        return;
      }
      onMessage?.({ type: "info", text: "Đã từ chối yêu cầu tham gia." });
      onRefresh?.();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Yêu cầu gia nhập CLB
            </Typography>
            <Typography variant="body2" color="text.secondary">
              VĐV gửi yêu cầu từ mục Khám phá CLB — duyệt tại đây hoặc tab Thành viên trong Chi tiết CLB.
            </Typography>
          </Box>

          {loadingPending ? (
            <Alert severity="info" variant="outlined">
              Đang tải yêu cầu…
            </Alert>
          ) : pendingRequests.length === 0 ? (
            <Alert severity="info" variant="outlined">
              Không có yêu cầu đang chờ duyệt.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>VĐV</TableCell>
                    <TableCell>Pick_VN</TableCell>
                    <TableCell>Ngày gửi</TableCell>
                    <TableCell>Lời nhắn</TableCell>
                    <TableCell>Ghi chú</TableCell>
                    <TableCell align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingRequests.map((request) => (
                    <TableRow key={request.id} hover>
                      <TableCell>{request.displayName || request.userId}</TableCell>
                      <TableCell>
                        {request.pickVnRating != null
                          ? formatPickVnRating(request.pickVnRating)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {new Date(request.requestedAt).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell>{request.message || "—"}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Ghi chú (tuỳ chọn)"
                          value={reviewNotes[request.id] || ""}
                          onChange={(event) =>
                            setReviewNotes((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={busyId === request.id}
                            onClick={() => handleReject(request)}
                          >
                            Từ chối
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={busyId === request.id}
                            onClick={() => handleApprove(request)}
                          >
                            Duyệt
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
