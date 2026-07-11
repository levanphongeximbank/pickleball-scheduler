import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Grid,
  InputAdornment,
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
import { resolvePresidentDisplayLabel } from "./myClubViewLogic.js";
import {
  ClubCard,
  ClubDiscoverSkeleton,
  ClubEmptyState,
} from "../../../features/club/ui/index.js";

export default function MyClubDiscoverPanel({
  user,
  revision = 0,
  onRevision,
  onMessage,
  showHeader = true,
  showSearch = true,
  hasClub: hasClubProp = null,
  activeClubId = null,
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
    hasClubProp != null
      ? Boolean(hasClubProp)
      : Boolean(activeClubId);

  const resolvedActiveClubId = activeClubId || null;

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
        <ClubDiscoverSkeleton count={3} />
      ) : discoverableClubs.length === 0 ? (
        <ClubEmptyState
          preset={search.trim() ? "discoverSearch" : "discover"}
          actionLabel={search.trim() ? "Xóa tìm kiếm" : undefined}
          onAction={search.trim() ? () => setSearch("") : undefined}
        />
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
            const isMyClub = resolvedActiveClubId === club.id;

            const clubName = summary?.name || club.name;
            let variant = "joinable";
            if (isMyClub) {
              variant = "your-club";
            } else if (request?.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.PENDING) {
              variant = "pending";
            } else if (request?.status === CLUB_MEMBERSHIP_REQUEST_STATUSES.REJECTED) {
              variant = "rejected";
            }

            return (
              <Grid item xs={12} md={6} lg={4} key={club.id}>
                <ClubCard
                  clubName={clubName}
                  memberCount={summary?.activeMemberCount ?? 0}
                  presidentLabel={presidentLabel}
                  clusterLabel={summary?.clusterLabel}
                  variant={variant}
                  requestStatus={!isMyClub ? request?.status : null}
                  reviewNote={request?.reviewNote}
                  disabled={hasClub}
                  onJoin={() => setJoinClub(club)}
                  onCancel={() => void handleCancelRequest(request)}
                />
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
