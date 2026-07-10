import { useEffect, useMemo, useState } from "react";
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
  canRelinquishClubPresident,
  canManageClubGovernance,
  fetchGovernanceNameHints,
  getClubById,
  getClubStats,
  getGovernanceDisplayLabels,
  getVicePresidentUserIds,
  listClubGovernanceCandidates,
  transferClubPresident,
} from "../../../features/club/index.js";
import { miniGovernanceCardSx } from "./myClubUiStyles.js";
import { resolvePresidentDisplayLabel } from "./myClubViewLogic.js";

function GovernanceMiniCard({ accent, icon, title, value, action = null }) {
  return (
    <Box sx={miniGovernanceCardSx(accent)}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {icon}
          <Box>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {value}
            </Typography>
          </Box>
        </Stack>
        {action}
      </Stack>
    </Box>
  );
}

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
  const [nameHints, setNameHints] = useState({});

  const club = useMemo(() => getClubById(clubId, tenantId), [clubId, tenantId, revision]);

  useEffect(() => {
    let cancelled = false;
    const gov = club?.governance || {};
    const ids = [
      gov.presidentUserId,
      gov.ownerUserId,
      ...getVicePresidentUserIds(gov),
    ].filter(Boolean);

    void fetchGovernanceNameHints(ids).then((hints) => {
      if (!cancelled) {
        setNameHints(hints);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    club?.id,
    club?.governance?.presidentUserId,
    club?.governance?.ownerUserId,
    club?.governance?.vicePresidentUserId,
    club?.governance?.vicePresidentUserIds,
    revision,
  ]);

  const labels = useMemo(
    () => (club ? getGovernanceDisplayLabels(club, tenantId, nameHints) : null),
    [club, tenantId, nameHints, revision]
  );
  const stats = useMemo(() => getClubStats(clubId, tenantId), [clubId, tenantId, revision]);
  const candidates = useMemo(
    () => listClubGovernanceCandidates(clubId, tenantId),
    [clubId, tenantId, revision]
  );

  if (!club || !labels) {
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
      onMessage?.({ type: "error", text: result.error });
      return;
    }
    onMessage?.({ type: "success", text: "Đã chuyển Chủ tịch CLB." });
    setNextPresidentId("");
    setTransferOpen(false);
    onRefresh?.();
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Cấu trúc CLB
        </Typography>

        <Stack spacing={1.5}>
          <GovernanceMiniCard
            accent="president"
            icon={<WorkspacePremiumIcon color="warning" fontSize="small" />}
            title="Chủ tịch"
            value={presidentLabel}
            action={
              canTransfer ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SwapHorizIcon />}
                  onClick={() => setTransferOpen(true)}
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
              icon={<StarIcon color="primary" fontSize="small" />}
              title={`Phó CT ${index + 1}`}
              value={viceLabels[index] || "(trống)"}
            />
          ))}

          <GovernanceMiniCard
            accent="members"
            icon={<GroupsIcon color="action" fontSize="small" />}
            title="Thành viên"
            value={`${stats?.activeMemberCount ?? 0} thành viên`}
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
          >
            Xác nhận chuyển
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
