import { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import {
  CLUB_MEMBERSHIP_REQUEST_STATUSES,
  cancelClubMembershipRequest,
  getClubDiscoverySummary,
  listDiscoverableClubs,
  listMyMembershipRequestsAll,
} from "../../../features/club/index.js";
import JoinClubDialog from "./JoinClubDialog.jsx";
import { requestStatusChip } from "./clubMembershipUi.jsx";
import { clubAvatarColor, clubInitials } from "./myClubUiStyles.js";

export default function MyClubDiscoverPanel({
  user,
  revision = 0,
  onRevision,
  onMessage,
  showHeader = true,
  showSearch = true,
}) {
  const [joinClub, setJoinClub] = useState(null);
  const [search, setSearch] = useState("");

  const myRequests = useMemo(() => {
    void revision;
    if (!user?.id) {
      return [];
    }
    return listMyMembershipRequestsAll(user.id);
  }, [revision, user?.id]);

  const requestByClubId = useMemo(
    () => new Map(myRequests.map((request) => [request.clubId, request])),
    [myRequests]
  );

  const discoverableClubs = useMemo(() => {
    void revision;
    const query = search.trim().toLowerCase();
    const clubs = listDiscoverableClubs();
    if (!query) {
      return clubs;
    }
    return clubs.filter((club) => String(club.name || "").toLowerCase().includes(query));
  }, [revision, search]);

  const bumpRevision = () => {
    onRevision?.();
  };

  const handleCancelRequest = (request) => {
    const result = cancelClubMembershipRequest(request.clubId, request.id, user.id);
    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }
    onMessage?.({ type: "info", text: "Đã hủy yêu cầu tham gia." });
    bumpRevision();
  };

  const hasClub = Boolean(user?.clubId || user?.club_id);

  return (
    <Box>
      {showHeader && (
        <>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Danh sách câu lạc bộ
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Xem tất cả CLB trên hệ thống. Chưa gia nhập chỉ hiển thị tên CLB, chủ tịch, số thành
            viên và cụm sân đăng ký. Bạn có thể xin gia nhập bất kỳ CLB nào.
          </Typography>
        </>
      )}

      {showSearch && (
        <TextField
          size="small"
          fullWidth
          placeholder="Tìm theo tên CLB"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ mb: 2, maxWidth: 520 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      )}

      {discoverableClubs.length === 0 ? (
        <Alert severity="info">
          {search.trim() ? "Không tìm thấy CLB phù hợp." : "Chưa có CLB đang hoạt động trên hệ thống."}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {discoverableClubs.map((club) => {
            const summary = getClubDiscoverySummary(club.id);
            const request = requestByClubId.get(club.id);
            const isMyClub = user?.clubId === club.id || user?.club_id === club.id;

            const clubName = summary?.name || club.name;
            const initials = clubInitials(clubName);
            const avatarColor = clubAvatarColor(clubName);

            return (
              <Grid item xs={12} md={6} key={club.id}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: 2,
                    transition: "box-shadow 0.2s ease",
                    "&:hover": { boxShadow: 4 },
                  }}
                >
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        <Avatar sx={{ bgcolor: avatarColor, fontWeight: 700 }}>{initials}</Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Typography variant="h6" fontWeight={700}>
                              {clubName}
                            </Typography>
                            {isMyClub ? (
                              <Chip size="small" label="CLB của bạn" color="success" />
                            ) : (
                              request && requestStatusChip(request.status)
                            )}
                          </Stack>

                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {summary?.activeMemberCount ?? 0} thành viên
                            {summary?.presidentLabel ? ` · Chủ tịch: ${summary.presidentLabel}` : ""}
                          </Typography>

                          {summary?.clusterLabel && (
                            <Typography variant="body2" color="text.secondary">
                              Cụm sân: {summary.clusterLabel}
                            </Typography>
                          )}
                        </Box>
                      </Stack>

                      {request?.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED &&
                        request.reviewNote && (
                          <Typography variant="caption" color="error">
                            Lý do: {request.reviewNote}
                          </Typography>
                        )}

                      {!hasClub && !isMyClub && (
                        <Stack direction="row" spacing={1}>
                          {!request && (
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => setJoinClub(club)}
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
                              onClick={() => setJoinClub(club)}
                            >
                              Gửi lại
                            </Button>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <JoinClubDialog
        open={Boolean(joinClub)}
        onClose={() => setJoinClub(null)}
        user={user}
        clubs={discoverableClubs}
        preselectedClub={joinClub}
        onSuccess={(text) => {
          onMessage?.({ type: "success", text });
          setJoinClub(null);
          bumpRevision();
        }}
        onError={(text) => onMessage?.({ type: "error", text })}
      />
    </Box>
  );
}
