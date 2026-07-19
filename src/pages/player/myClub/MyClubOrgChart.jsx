import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import StarIcon from "@mui/icons-material/Star";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

import GovernanceMemberSelect from "../../../components/club/GovernanceMemberSelect.jsx";
import {
  GOVERNANCE_NO_VP_LABEL,
  GOVERNANCE_READ_STATE,
  GOVERNANCE_UNASSIGNED_LABEL,
  canRelinquishClubPresident,
  canManageClubGovernance,
  getClubById,
  getClubStats,
  getVicePresidentUserIds,
  isClubStorageV2Enabled,
  listClubGovernanceCandidatesAsync,
  transferClubPresident,
  useGovernanceReadModel,
} from "../../../features/club/index.js";
import { miniGovernanceCardSx } from "./myClubUiStyles.js";
import { resolvePresidentDisplayLabel } from "./myClubViewLogic.js";

function GovernanceMiniCard({ accent, icon, title, value, action = null }) {
  return (
    <Box sx={miniGovernanceCardSx(accent)}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {icon}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-word" }}>
              {value}
            </Typography>
          </Box>
        </Stack>
        {action}
      </Stack>
    </Box>
  );
}

function resolveActiveMemberCount(clubRecord, clubId, tenantId) {
  if (isClubStorageV2Enabled()) {
    if (clubRecord && clubRecord.activeMemberCount != null) {
      return Number(clubRecord.activeMemberCount) || 0;
    }
    return 0;
  }
  return getClubStats(clubId, tenantId)?.activeMemberCount ?? 0;
}

export default function MyClubOrgChart({
  clubId,
  tenantId,
  user,
  clubRecord: clubRecordProp = null,
  revision = 0,
  onRefresh,
  onMessage,
}) {
  const [nextPresidentId, setNextPresidentId] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState([]);

  const club = useMemo(() => {
    if (clubRecordProp?.id === clubId) {
      return clubRecordProp;
    }
    if (isClubStorageV2Enabled()) {
      return clubRecordProp || null;
    }
    return getClubById(clubId, tenantId);
  }, [clubRecordProp, clubId, tenantId, revision]);

  const governanceRead = useGovernanceReadModel({
    clubId,
    clubSeed: club,
    revision,
    hydrateProfiles: true,
    enabled: Boolean(clubId),
  });

  useEffect(() => {
    let cancelled = false;
    void listClubGovernanceCandidatesAsync(clubId, tenantId).then((rows) => {
      if (!cancelled) {
        setCandidates(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clubId, tenantId, revision]);

  const labels = governanceRead.labels;
  const activeMemberCount = useMemo(
    () => resolveActiveMemberCount(club, clubId, tenantId),
    [club, clubId, tenantId, revision]
  );

  if (!club) {
    return null;
  }

  if (governanceRead.state === GOVERNANCE_READ_STATE.LOADING && !labels) {
    return (
      <Card variant="outlined" sx={{ height: "100%" }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} aria-label="Đang tải sơ đồ tổ chức" />
            <Typography variant="body2" color="text.secondary">
              Đang tải sơ đồ tổ chức…
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (governanceRead.error && !labels) {
    return (
      <Card variant="outlined" sx={{ height: "100%" }}>
        <CardContent>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void governanceRead.reload()}>
                Thử lại
              </Button>
            }
          >
            {governanceRead.errorMessage || "Không tải được sơ đồ tổ chức."}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!labels) {
    return null;
  }

  const viceLabels = labels.vicePresidentLabels || [];
  const canTransfer = canRelinquishClubPresident(user, club);
  const canManage = canManageClubGovernance(user, club);
  const viceIds = getVicePresidentUserIds(club.governance || {});
  const presidentLabel = resolvePresidentDisplayLabel(labels);

  const handleTransferPresident = async () => {
    if (!nextPresidentId) {
      return;
    }
    setBusy(true);
    const result = await transferClubPresident(clubId, nextPresidentId, tenantId);
    setBusy(false);
    if (!result.ok) {
      const serverCode = String(result.serverCode || "").trim();
      const text =
        serverCode === "VERSION_CONFLICT"
          ? "Dữ liệu CLB đã thay đổi trên máy chủ. Vui lòng tải lại rồi thử lại."
          : result.error || "Không chuyển được Chủ tịch.";
      onMessage?.({ type: "error", text });
      void governanceRead.handleMutationResult(result);
      onRefresh?.();
      return;
    }
    setTransferOpen(false);
    setNextPresidentId("");
    onMessage?.({ type: "success", text: "Đã chuyển Chủ tịch CLB." });
    void governanceRead.handleMutationResult(result);
    onRefresh?.();
  };

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Sơ đồ tổ chức
        </Typography>

        <Stack spacing={1.25}>
          <GovernanceMiniCard
            accent="owner"
            icon={<WorkspacePremiumIcon color="warning" fontSize="small" aria-hidden />}
            title="Chủ sở hữu"
            value={labels.ownerLabel || GOVERNANCE_UNASSIGNED_LABEL}
          />

          <GovernanceMiniCard
            accent="president"
            icon={<StarIcon color="secondary" fontSize="small" aria-hidden />}
            title="Chủ tịch"
            value={presidentLabel || GOVERNANCE_UNASSIGNED_LABEL}
            action={
              canTransfer ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SwapHorizIcon />}
                  onClick={() => setTransferOpen(true)}
                  aria-label="Nhường chức Chủ tịch"
                >
                  Nhường chức
                </Button>
              ) : null
            }
          />

          {[0, 1].map((index) => (
            <GovernanceMiniCard
              key={index}
              accent="vice"
              icon={<StarIcon color="primary" fontSize="small" aria-hidden />}
              title={`Phó chủ tịch ${index + 1}`}
              value={viceLabels[index] || GOVERNANCE_NO_VP_LABEL}
            />
          ))}

          <GovernanceMiniCard
            accent="members"
            icon={<GroupsIcon color="action" fontSize="small" aria-hidden />}
            title="Thành viên"
            value={`${activeMemberCount} thành viên`}
          />

          {canManage && viceIds.length < 2 && (
            <Typography variant="caption" color="text.secondary">
              Gán Phó chủ tịch trong mục Quản trị CLB (tối đa 2 người).
            </Typography>
          )}
        </Stack>
      </CardContent>

      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nhường chức Chủ tịch</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Chọn thành viên trong CLB để nhường vai trò Chủ tịch. Bạn sẽ trở thành thành viên
            thường sau khi chuyển.
          </Typography>
          <GovernanceMemberSelect
            label="Chủ tịch mới"
            value={nextPresidentId}
            onChange={setNextPresidentId}
            candidates={candidates.filter(
              (item) => item.userId !== club.governance?.presidentUserId
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferOpen(false)}>Hủy</Button>
          <Button
            variant="contained"
            onClick={handleTransferPresident}
            disabled={busy || !nextPresidentId}
            aria-label="Xác nhận chuyển Chủ tịch"
          >
            Xác nhận chuyển
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
