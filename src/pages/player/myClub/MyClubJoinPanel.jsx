import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  CLUB_MEMBERSHIP_REQUEST_STATUS_LABELS,
  CLUB_MEMBERSHIP_REQUEST_STATUSES,
  cancelClubMembershipRequest,
  getClubStats,
  getGovernanceDisplayLabels,
  listJoinableClubs,
  listMyMembershipRequests,
  submitClubMembershipRequest,
} from "../../../features/club/index.js";

function requestStatusChip(status) {
  const label = CLUB_MEMBERSHIP_REQUEST_STATUS_LABELS[status] || status;
  const color =
    status === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING
      ? "warning"
      : status === CLUB_MEMBERSHIP_REQUEST_STATUSES.APPROVED
        ? "success"
        : status === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED
          ? "error"
          : "default";
  return <Chip size="small" label={label} color={color} />;
}

export default function MyClubJoinPanel({ tenantId, user, onRevision }) {
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState(null);
  const [joinClub, setJoinClub] = useState(null);
  const [joinMessage, setJoinMessage] = useState("");

  const myRequests = useMemo(() => {
    void revision;
    if (!user?.id || !tenantId) {
      return [];
    }
    return listMyMembershipRequests(tenantId, user.id);
  }, [revision, tenantId, user?.id]);

  const requestByClubId = useMemo(
    () => new Map(myRequests.map((request) => [request.clubId, request])),
    [myRequests]
  );

  const joinableClubs = useMemo(() => {
    void revision;
    if (!tenantId) {
      return [];
    }
    return listJoinableClubs(tenantId);
  }, [tenantId, revision]);

  const bumpRevision = () => {
    setRevision((value) => value + 1);
    onRevision?.();
  };

  const handleSubmitJoin = () => {
    if (!joinClub) {
      return;
    }

    const result = submitClubMembershipRequest(joinClub.id, tenantId, user, {
      message: joinMessage,
    });

    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }

    setMessage({ type: "success", text: "Đã gửi yêu cầu tham gia CLB." });
    setJoinClub(null);
    setJoinMessage("");
    bumpRevision();
  };

  const handleCancelRequest = (request) => {
    const result = cancelClubMembershipRequest(request.clubId, request.id, user.id);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "info", text: "Đã hủy yêu cầu tham gia." });
    bumpRevision();
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Duyệt danh sách CLB trong hệ thống và gửi yêu cầu tham gia. Chủ tịch hoặc Phó chủ tịch
        CLB sẽ duyệt yêu cầu của bạn.
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {joinableClubs.length === 0 ? (
        <Alert severity="info">Chưa có CLB đang hoạt động trong tenant này.</Alert>
      ) : (
        <Grid container spacing={2}>
          {joinableClubs.map((club) => {
            const stats = getClubStats(club.id, tenantId);
            const gov = getGovernanceDisplayLabels(club, tenantId);
            const request = requestByClubId.get(club.id);

            return (
              <Grid item xs={12} md={6} key={club.id}>
                <Card sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="h6" fontWeight={700}>
                          {club.name}
                        </Typography>
                        {request && requestStatusChip(request.status)}
                      </Stack>

                      <Typography variant="body2" color="text.secondary">
                        {stats?.activeMemberCount ?? 0} thành viên
                        {gov.presidentLabel ? ` · Chủ tịch: ${gov.presidentLabel}` : ""}
                      </Typography>

                      {request?.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED &&
                        request.reviewNote && (
                          <Typography variant="caption" color="error">
                            Lý do: {request.reviewNote}
                          </Typography>
                        )}

                      <Stack direction="row" spacing={1}>
                        {!request && (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => {
                              setJoinClub(club);
                              setJoinMessage("");
                            }}
                          >
                            Xin tham gia
                          </Button>
                        )}
                        {request?.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING && (
                          <Button
                            variant="outlined"
                            size="small"
                            color="inherit"
                            onClick={() => handleCancelRequest(request)}
                          >
                            Hủy yêu cầu
                          </Button>
                        )}
                        {request?.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              setJoinClub(club);
                              setJoinMessage("");
                            }}
                          >
                            Gửi lại
                          </Button>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={Boolean(joinClub)} onClose={() => setJoinClub(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Xin tham gia {joinClub?.name}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Lời nhắn (tùy chọn)"
            value={joinMessage}
            onChange={(event) => setJoinMessage(event.target.value)}
            sx={{ mt: 1 }}
            placeholder="Giới thiệu ngắn hoặc lý do muốn tham gia CLB..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinClub(null)}>Hủy</Button>
          <Button variant="contained" onClick={handleSubmitJoin}>
            Gửi yêu cầu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
