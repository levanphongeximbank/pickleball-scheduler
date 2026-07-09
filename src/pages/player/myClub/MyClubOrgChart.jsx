import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
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
  canChangeClubPresident,
  canManageClubGovernance,
  getClubById,
  getClubStats,
  getGovernanceDisplayLabels,
  getVicePresidentUserIds,
  isClubPresident,
  listClubGovernanceCandidates,
  transferClubPresident,
} from "../../../features/club/index.js";

export default function MyClubOrgChart({
  clubId,
  tenantId,
  user,
  revision = 0,
  onRefresh,
  onMessage,
}) {
  const [nextPresidentId, setNextPresidentId] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const club = useMemo(() => getClubById(clubId, tenantId), [clubId, tenantId, revision]);
  const labels = useMemo(
    () => (club ? getGovernanceDisplayLabels(club, tenantId) : null),
    [club, tenantId, revision]
  );
  const stats = useMemo(() => getClubStats(clubId, tenantId), [clubId, tenantId, revision]);
  const candidates = useMemo(
    () => listClubGovernanceCandidates(clubId, tenantId),
    [clubId, tenantId, revision]
  );

  if (!club || !labels) {
    return null;
  }

  const viceIds = getVicePresidentUserIds(club.governance || {});
  const viceLabels = labels.vicePresidentLabels || [];
  const canTransfer = canChangeClubPresident(user, club) && isClubPresident(user, club);
  const canManage = canManageClubGovernance(user, club);

  const handleTransferPresident = async () => {
    if (!nextPresidentId) {
      return;
    }
    setBusy(true);
    const result = await transferClubPresident(clubId, nextPresidentId, tenantId);
    setBusy(false);
    if (!result.ok) {
      onMessage?.({ type: "error", text: result.error });
      return;
    }
    onMessage?.({ type: "success", text: "Đã chuyển Chủ tịch CLB." });
    setNextPresidentId("");
    setTransferOpen(false);
    onRefresh?.();
  };

  return (
    <Card variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Cấu trúc CLB
        </Typography>

        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <WorkspacePremiumIcon color="warning" fontSize="small" />
            <Typography variant="body2">
              <strong>Chủ tịch:</strong>{" "}
              {labels.presidentLabel || labels.ownerLabel || "Chưa gán"}
            </Typography>
            {canTransfer && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<SwapHorizIcon />}
                onClick={() => setTransferOpen(true)}
              >
                Nhường chức
              </Button>
            )}
          </Stack>

          {[0, 1].map((index) => (
            <Stack key={index} direction="row" spacing={1} alignItems="center">
              <StarIcon color="primary" fontSize="small" />
              <Typography variant="body2">
                <strong>Phó CT {index + 1}:</strong> {viceLabels[index] || "(trống)"}
              </Typography>
            </Stack>
          ))}

          <Stack direction="row" spacing={1} alignItems="center">
            <GroupsIcon color="action" fontSize="small" />
            <Typography variant="body2">
              {stats?.activeMemberCount ?? 0} thành viên
            </Typography>
          </Stack>

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
          >
            Xác nhận chuyển
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
