import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import PlaceIcon from "@mui/icons-material/Place";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";

import {
  canAssignClubOwner,
  listClubGovernanceCandidates,
} from "../../../features/club/index.js";
import { CLUB_STATUS_LABELS } from "../../../features/club/constants/clubStatus.js";
import AssignClubOwnerDialog from "./AssignClubOwnerDialog.jsx";
import {
  clubAvatarColor,
  clubInitials,
  heroGradientSx,
  statBoxSx,
} from "./myClubUiStyles.js";
import {
  resolveOwnerStatContent,
  resolvePresidentDisplayLabel,
} from "./myClubViewLogic.js";

export default function MyClubSummaryCard({
  clubSummary,
  clubStats,
  governanceLabels,
  registeredCluster,
  user,
  manageHref = null,
  clubId,
  tenantId,
  clubRecord,
  onRefresh,
  onMessage,
}) {
  const [assignOpen, setAssignOpen] = useState(false);

  const canAssign = canAssignClubOwner(user);
  const ownerStat = resolveOwnerStatContent({
    club: clubRecord,
    governanceLabels,
    canAssign,
  });
  const presidentLabel = resolvePresidentDisplayLabel(governanceLabels);

  const candidates = useMemo(
    () => (clubId ? listClubGovernanceCandidates(clubId, tenantId) : []),
    [clubId, tenantId, clubRecord?.governance?.ownerUserId]
  );

  const initials = clubInitials(clubSummary.name);
  const avatarColor = clubAvatarColor(clubSummary.name);

  return (
    <>
      <Card sx={{ mb: 2, overflow: "hidden", borderRadius: 2 }}>
        <Box sx={{ ...heroGradientSx, p: { xs: 2, md: 2.5 } }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: avatarColor,
                fontWeight: 700,
                fontSize: "1.25rem",
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h5" fontWeight={700}>
                  {clubSummary.name}
                </Typography>
                <Chip
                  size="small"
                  label={CLUB_STATUS_LABELS[clubSummary.status] || clubSummary.status}
                  color={clubSummary.status === "active" ? "success" : "default"}
                />
              </Stack>
              {registeredCluster && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                  <PlaceIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    Cụm sân: {registeredCluster.name}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>
        </Box>

        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
            <Box sx={statBoxSx}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <GroupsIcon fontSize="small" color="primary" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Thành viên
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {clubStats?.activeMemberCount ?? clubSummary.memberCount}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Box sx={statBoxSx}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <PersonIcon fontSize="small" color="primary" />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Chủ tịch
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {presidentLabel}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Box sx={statBoxSx}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <WorkspacePremiumIcon fontSize="small" color="action" />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Chủ sở hữu
                  </Typography>
                  {ownerStat.mode === "assigned" && (
                    <Typography variant="body1" fontWeight={600}>
                      {ownerStat.label}
                    </Typography>
                  )}
                  {ownerStat.mode === "assign" && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setAssignOpen(true)}
                      sx={{ mt: 0.25, px: 1.5 }}
                    >
                      Gắn chủ sở hữu
                    </Button>
                  )}
                  {ownerStat.mode === "unassigned" && (
                    <Typography variant="body1" color="text.secondary">
                      Chưa gán
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Box>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <Button
              component={RouterLink}
              to="/tournament"
              variant="contained"
              startIcon={<SportsTennisIcon />}
            >
              Giải đấu CLB
            </Button>
            {user?.playerId && (
              <Button
                component={RouterLink}
                to={`/players/profile/${user.playerId}`}
                variant="outlined"
                startIcon={<PersonIcon />}
              >
                Hồ sơ thi đấu
              </Button>
            )}
            {manageHref && (
              <Button component={RouterLink} to={manageHref} variant="text">
                Chi tiết CLB
              </Button>
            )}
          </Stack>
        </Box>
      </Card>

      <AssignClubOwnerDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        clubId={clubId}
        tenantId={tenantId}
        candidates={candidates}
        onSuccess={() => {
          onMessage?.({ type: "success", text: "Đã gắn Chủ sở hữu CLB." });
          onRefresh?.();
        }}
        onError={(text) => onMessage?.({ type: "error", text })}
      />
    </>
  );
}
