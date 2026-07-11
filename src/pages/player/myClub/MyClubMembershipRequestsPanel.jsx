import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import {
  approveClubMembershipRequest,
  canApproveClubMembershipRequests,
  isClubStorageV2Enabled,
  listPendingMembershipRequests,
  rejectClubMembershipRequest,
} from "../../../features/club/index.js";
import {
  ClubConfirmDialog,
  ClubEmptyState,
} from "../../../features/club/ui/index.js";
import { formatPickVnRating } from "../../../features/pick-vn-rating/constants/pickVnRatingScale.js";

function RequestReviewNotes({ requestId, value, onChange }) {
  return (
    <TextField
      size="small"
      fullWidth
      label="Ghi chú (tuỳ chọn)"
      placeholder="Ghi chú khi duyệt / từ chối"
      value={value}
      onChange={(event) => onChange(requestId, event.target.value)}
    />
  );
}

function RequestActions({ request, busyId, onApprove, onReject }) {
  const disabled = busyId === request.id;
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
      <Button
        size="small"
        color="error"
        variant="outlined"
        disabled={disabled}
        onClick={() => onReject(request)}
      >
        Từ chối
      </Button>
      <Button size="small" variant="contained" disabled={disabled} onClick={() => onApprove(request)}>
        Duyệt
      </Button>
    </Stack>
  );
}

export default function MyClubMembershipRequestsPanel({
  clubId,
  clubRecord,
  tenantId,
  user,
  revision = 0,
  onRefresh,
  onMessage,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [reviewNotes, setReviewNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);

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

  const handleNoteChange = (requestId, value) => {
    setReviewNotes((current) => ({ ...current, [requestId]: value }));
  };

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

  const handleRejectConfirm = async () => {
    const request = rejectTarget;
    if (!request) {
      return;
    }
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
      setRejectTarget(null);
      onRefresh?.();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Card sx={{ mt: 3, borderRadius: 2, border: 1, borderColor: "divider" }}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} component="h3">
                Yêu cầu gia nhập CLB
              </Typography>
              <Typography variant="body2" color="text.secondary">
                VĐV gửi yêu cầu từ mục Khám phá CLB — duyệt tại đây hoặc tab Thành viên trong Chi
                tiết CLB.
              </Typography>
            </Box>

            {loadingPending ? (
              <Stack spacing={1.5} aria-busy="true" aria-label="Đang tải yêu cầu">
                <Skeleton variant="rounded" height={72} />
                <Skeleton variant="rounded" height={72} />
              </Stack>
            ) : pendingRequests.length === 0 ? (
              <ClubEmptyState preset="requests" />
            ) : isMobile ? (
              <Stack spacing={1.5}>
                {pendingRequests.map((request) => (
                  <Card key={request.id} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Box>
                          <Typography fontWeight={700}>
                            {request.displayName || request.userId}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Pick_VN:{" "}
                            {request.pickVnRating != null
                              ? formatPickVnRating(request.pickVnRating)
                              : "—"}
                            {" · "}
                            {new Date(request.requestedAt).toLocaleDateString("vi-VN")}
                          </Typography>
                          {request.message && (
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              Lời nhắn: {request.message}
                            </Typography>
                          )}
                        </Box>
                        <RequestReviewNotes
                          requestId={request.id}
                          value={reviewNotes[request.id] || ""}
                          onChange={handleNoteChange}
                        />
                        <RequestActions
                          request={request}
                          busyId={busyId}
                          onApprove={handleApprove}
                          onReject={setRejectTarget}
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            ) : (
              <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2 }}>
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
                          <RequestReviewNotes
                            requestId={request.id}
                            value={reviewNotes[request.id] || ""}
                            onChange={handleNoteChange}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <RequestActions
                            request={request}
                            busyId={busyId}
                            onApprove={handleApprove}
                            onReject={setRejectTarget}
                          />
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

      <ClubConfirmDialog
        open={Boolean(rejectTarget)}
        title="Từ chối yêu cầu gia nhập?"
        description={
          rejectTarget
            ? `Xác nhận từ chối yêu cầu của ${rejectTarget.displayName || "VĐV"}. Hành động này không thể hoàn tác.`
            : ""
        }
        confirmLabel="Từ chối"
        confirmColor="error"
        loading={Boolean(rejectTarget && busyId === rejectTarget.id)}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => void handleRejectConfirm()}
      />
    </>
  );
}
