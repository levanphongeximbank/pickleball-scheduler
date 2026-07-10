import { useEffect, useMemo, useState } from "react";
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
  fetchGovernanceNameHints,
  getClubDiscoverySummary,
  getGovernanceDisplayLabels,
  isClubStorageV2Enabled,
  listDiscoverableClubs,
  listMyMembershipRequestsAll,
  rpcV2ClubListDiscoverable,
  rpcV2ClubListMyRequests,
} from "../../../features/club/index.js";
import { syncClubRegistryForUser } from "../../../features/club/services/clubRegistryCloudSync.js";
import JoinClubDialog from "./JoinClubDialog.jsx";
import { requestStatusChip } from "./clubMembershipUi.jsx";
import { clubAvatarColor, clubInitials } from "./myClubUiStyles.js";
import { resolvePresidentDisplayLabel } from "./myClubViewLogic.js";

export default function MyClubDiscoverPanel({
  user,
  revision = 0,
  onRevision,
  onMessage,
  showHeader = true,
  showSearch = true,
  hasClub: hasClubProp = null,
}) {
  const [joinClub, setJoinClub] = useState(null);
  const [search, setSearch] = useState("");
  const [nameHints, setNameHints] = useState({});
  const [v2Clubs, setV2Clubs] = useState([]);
  const [v2Requests, setV2Requests] = useState([]);
  const [loading, setLoading] = useState(false);
  const storageV2 = isClubStorageV2Enabled();

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    if (!storageV2) {
      void syncClubRegistryForUser(user).then((result) => {
        if (result.ok) {
          onRevision?.();
        }
      });
      return;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all([
      rpcV2ClubListDiscoverable({ search, limit: 200 }),
      rpcV2ClubListMyRequests(),
    ]).then(([clubsResult, requestsResult]) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (clubsResult.ok) {
        setV2Clubs(clubsResult.clubs || []);
      } else {
        onMessage?.({ type: "error", text: clubsResult.error || "Không tải được danh sách CLB." });
      }
      if (requestsResult.ok) {
        setV2Requests(requestsResult.requests || []);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, onRevision, storageV2, search, revision, onMessage]);

  const myRequests = useMemo(() => {
    if (storageV2) {
      return (v2Requests || []).map((request) => ({
        id: request.id,
        clubId: request.club_id,
        userId: request.user_id,
        status: request.status,
        message: request.message,
        version: request.version,
        requestedAt: request.created_at,
      }));
    }
    void revision;
    if (!user?.id) {
      return [];
    }
    return listMyMembershipRequestsAll(user.id);
  }, [revision, user?.id, storageV2, v2Requests]);

  const requestByClubId = useMemo(
    () => new Map(myRequests.map((request) => [request.clubId, request])),
    [myRequests]
  );

  const discoverableClubs = useMemo(() => {
    if (storageV2) {
      return v2Clubs;
    }
    void revision;
    const query = search.trim().toLowerCase();
    const clubs = listDiscoverableClubs();
    if (!query) {
      return clubs;
    }
    return clubs.filter((club) => String(club.name || "").toLowerCase().includes(query));
  }, [revision, search, storageV2, v2Clubs]);

  useEffect(() => {
    if (storageV2) {
      return undefined;
    }
    let cancelled = false;
    const ids = discoverableClubs
      .flatMap((club) => [
        club?.governance?.presidentUserId,
        club?.governance?.ownerUserId,
      ])
      .filter(Boolean);

    void fetchGovernanceNameHints(ids).then((hints) => {
      if (!cancelled) {
        setNameHints(hints);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [discoverableClubs, storageV2]);

  const bumpRevision = () => {
    onRevision?.();
  };

  const handleCancelRequest = async (request) => {
    const result = await cancelClubMembershipRequest(request.clubId, request.id, user.id, {
      expectedVersion: request.version,
    });
    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }
    onMessage?.({ type: "info", text: "Đã hủy yêu cầu tham gia." });
    bumpRevision();
  };

  const hasClub =
    hasClubProp != null ? Boolean(hasClubProp) : Boolean(user?.clubId || user?.club_id);

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

      {loading && storageV2 ? (
        <Alert severity="info">Đang tải danh sách CLB từ cloud…</Alert>
      ) : discoverableClubs.length === 0 ? (
        <Alert severity="info">
          {search.trim() ? "Không tìm thấy CLB phù hợp." : "Chưa có CLB đang hoạt động trên hệ thống."}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {discoverableClubs.map((club) => {
            const summary = storageV2
              ? {
                  name: club.name,
                  activeMemberCount: club.activeMemberCount ?? 0,
                  presidentLabel: club.presidentLabel,
                  clusterLabel: null,
                }
              : getClubDiscoverySummary(club.id);
            const labels = storageV2
              ? null
              : getGovernanceDisplayLabels(club, club.tenantId || club.venueId, nameHints);
            const presidentLabel = storageV2
              ? club.presidentLabel
              : resolvePresidentDisplayLabel(labels) !== "Chưa gán"
                ? resolvePresidentDisplayLabel(labels)
                : summary?.presidentLabel;
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
                            {presidentLabel ? ` · Chủ tịch: ${presidentLabel}` : ""}
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
                              onClick={() => void handleCancelRequest(request)}
                            >
                              Hủy yêu cầu
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
          bumpRevision();
        }}
        onError={(text) => onMessage?.({ type: "error", text })}
      />
    </Box>
  );
}
